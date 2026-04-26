from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
import time
import datetime
from dotenv import load_dotenv
from google import genai
from google.genai import types
import fitz
import json

# Import DB configurations
import models
from database import engine, get_db, SessionLocal
from sqlalchemy.orm import Session
from auth import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_role, seed_super_admin
)

load_dotenv()

# Initialize DB Tables directly onto Supabase
try:
    models.Base.metadata.create_all(bind=engine)
    # Migrate: add new columns to existing tables (create_all won't do this)
    from sqlalchemy import text
    with engine.connect() as conn:
        for col, default in [("is_trashed", "false"), ("is_active", "true")]:
            try:
                conn.execute(text(f"ALTER TABLE lessons ADD COLUMN IF NOT EXISTS {col} BOOLEAN DEFAULT {default}"))
            except Exception:
                pass
        # RBAC migrations
        rbac_migrations = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true",
            "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS subject_id INTEGER REFERENCES subjects(id)",
            "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS source_document_id INTEGER REFERENCES source_documents(id)",
            "ALTER TABLE source_documents ADD COLUMN IF NOT EXISTS subject_id INTEGER REFERENCES subjects(id)",
            "ALTER TABLE prompt_configs ADD COLUMN IF NOT EXISTS prompt_name VARCHAR DEFAULT 'extraction'",
            "ALTER TABLE prompt_configs ADD COLUMN IF NOT EXISTS subject_id INTEGER REFERENCES subjects(id)",
            "ALTER TABLE prompt_configs ADD COLUMN IF NOT EXISTS inherit_global BOOLEAN DEFAULT true",
        ]
        for sql in rbac_migrations:
            try:
                conn.execute(text(sql))
            except Exception:
                pass
        conn.commit()
    print("[OK] Successfully connected to Supabase Database.")
    # Seed Super Admin account
    seed_db = SessionLocal()
    try:
        seed_super_admin(seed_db)
    finally:
        seed_db.close()
except Exception as e:
    print("\n" + "="*50)
    print(f"[ERROR] DATABASE CONNECTION FAILED: {e}")
    print("Check your DATABASE_URL in .env - copy the exact URI from Supabase Dashboard -> Settings -> Database -> URI")
    print("="*50 + "\n")

app = FastAPI(title="Amali Mantiq Backend API")

# Build allowed origins: always allow localhost + production frontend URL from env
allowed_origins = ["http://localhost:3000"]
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the new google-genai client
try:
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key and api_key != "your_actual_key_here":
        client = genai.Client(api_key=api_key)
        gemini_initialized = True
        print("[OK] Gemini Client initialized successfully.")
    else:
        client = None
        gemini_initialized = False
        print("[WARN] GEMINI_API_KEY is not set in .env")
except Exception as e:
    client = None
    gemini_initialized = False
    print(f"[WARN] Failed to initialize Gemini. Error: {e}")


class GenerationRequest(BaseModel):
    source_text: str
    target_topic: str
    instruction: str = "Generate an Urdu/English lesson according to the 7-step criteria."

class LessonSync(BaseModel):
    title_english: str
    title_urdu: str
    objective: str
    definition_classic: str
    definition_modern: str


@app.get("/")
def check_status():
    return {
        "status": "success",
        "message": "Amali Mantiq Backend is running!",
        "db_connected": True,
        "gemini_ready": gemini_initialized
    }

# ============================================================
# AUTH ENDPOINTS
# ============================================================

class SignupRequest(BaseModel):
    email: str
    password: str
    full_name: str

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/api/auth/signup")
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    """Student self-registration."""
    existing = db.query(models.User).filter(models.User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = models.User(
        email=req.email,
        password_hash=hash_password(req.password),
        full_name=req.full_name,
        role=models.UserRole.student
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, user.email, user.role)
    return {"status": "success", "token": token, "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role}}

@app.post("/api/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Login for all roles."""
    user = db.query(models.User).filter(models.User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if getattr(user, 'is_active', True) is False:
        raise HTTPException(status_code=403, detail="Account disabled by administrator")
    token = create_access_token(user.id, user.email, user.role)
    return {"status": "success", "token": token, "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role": user.role}}

@app.get("/api/auth/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    """Get current logged-in user info."""
    return {"status": "success", "user": {"id": current_user.id, "email": current_user.email, "full_name": current_user.full_name, "role": current_user.role}}

# ============================================================
# SUBJECT ENDPOINTS (Super Admin only)
# ============================================================

class SubjectCreate(BaseModel):
    name_english: str
    name_urdu: str
    description: str = ""

@app.post("/api/subjects")
def create_subject(req: SubjectCreate, admin: models.User = Depends(require_role("super_admin")), db: Session = Depends(get_db)):
    subject = models.Subject(name_english=req.name_english, name_urdu=req.name_urdu, description=req.description)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return {"status": "success", "data": {"id": subject.id, "name_english": subject.name_english, "name_urdu": subject.name_urdu, "description": subject.description}}

@app.get("/api/subjects")
def get_subjects(db: Session = Depends(get_db)):
    """Public: anyone can browse subject catalog."""
    subjects = db.query(models.Subject).all()
    result = []
    for s in subjects:
        lesson_count = db.query(models.Lesson).filter(models.Lesson.subject_id == s.id, models.Lesson.is_approved == True, models.Lesson.is_trashed == False).count()
        result.append({"id": s.id, "name_english": s.name_english, "name_urdu": s.name_urdu, "description": s.description, "lesson_count": lesson_count})
    return {"status": "success", "data": result}

@app.delete("/api/subjects/{subject_id}")
def delete_subject(subject_id: int, admin: models.User = Depends(require_role("super_admin")), db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    db.delete(subject)
    db.commit()
    return {"status": "success", "message": "Subject deleted"}

@app.put("/api/subjects/{subject_id}")
def update_subject(subject_id: int, req: SubjectCreate, admin: models.User = Depends(require_role("super_admin")), db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    subject.name_english = req.name_english
    subject.name_urdu = req.name_urdu
    subject.description = req.description
    db.commit()
    db.refresh(subject)
    return {"status": "success", "data": {"id": subject.id, "name_english": subject.name_english, "name_urdu": subject.name_urdu, "description": subject.description}}

# ============================================================
# TEACHER MANAGEMENT (Super Admin only)
# ============================================================

class TeacherCreate(BaseModel):
    email: str
    password: str
    full_name: str

@app.post("/api/users/teacher")
def create_teacher(req: TeacherCreate, admin: models.User = Depends(require_role("super_admin")), db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    teacher = models.User(email=req.email, password_hash=hash_password(req.password), full_name=req.full_name, role=models.UserRole.teacher)
    db.add(teacher)
    db.commit()
    db.refresh(teacher)
    return {"status": "success", "data": {"id": teacher.id, "email": teacher.email, "full_name": teacher.full_name, "role": teacher.role}}

@app.get("/api/teachers")
def list_teachers(admin: models.User = Depends(require_role("super_admin")), db: Session = Depends(get_db)):
    teachers = db.query(models.User).filter(models.User.role == models.UserRole.teacher).all()
    result = []
    for t in teachers:
        subjects = db.query(models.TeacherSubject).filter(models.TeacherSubject.teacher_id == t.id).all()
        subj_list = [{"id": ts.subject_id, "name": db.query(models.Subject).get(ts.subject_id).name_english} for ts in subjects if db.query(models.Subject).get(ts.subject_id)]
        result.append({"id": t.id, "email": t.email, "full_name": t.full_name, "subjects": subj_list})
    return {"status": "success", "data": result}

class TeacherSubjectAssign(BaseModel):
    teacher_id: int
    subject_id: int

@app.post("/api/teacher-subjects")
def assign_teacher_to_subject(req: TeacherSubjectAssign, admin: models.User = Depends(require_role("super_admin")), db: Session = Depends(get_db)):
    existing = db.query(models.TeacherSubject).filter(models.TeacherSubject.teacher_id == req.teacher_id, models.TeacherSubject.subject_id == req.subject_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Teacher already assigned to this subject")
    assignment = models.TeacherSubject(teacher_id=req.teacher_id, subject_id=req.subject_id)
    db.add(assignment)
    db.commit()
    return {"status": "success", "message": "Teacher assigned to subject"}

@app.delete("/api/teacher-subjects")
def unassign_teacher_from_subject(req: TeacherSubjectAssign, admin: models.User = Depends(require_role("super_admin")), db: Session = Depends(get_db)):
    assignment = db.query(models.TeacherSubject).filter(models.TeacherSubject.teacher_id == req.teacher_id, models.TeacherSubject.subject_id == req.subject_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(assignment)
    db.commit()
    return {"status": "success", "message": "Teacher unassigned from subject"}

class TeacherUpdate(BaseModel):
    full_name: str
    email: str

@app.put("/api/users/teacher/{teacher_id}")
def update_teacher(teacher_id: int, req: TeacherUpdate, admin: models.User = Depends(require_role("super_admin")), db: Session = Depends(get_db)):
    teacher = db.query(models.User).filter(models.User.id == teacher_id, models.User.role == models.UserRole.teacher).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    if req.email != teacher.email:
        dup = db.query(models.User).filter(models.User.email == req.email).first()
        if dup:
            raise HTTPException(status_code=400, detail="Email already taken")
    teacher.full_name = req.full_name
    teacher.email = req.email
    db.commit()
    db.refresh(teacher)
    return {"status": "success", "data": {"id": teacher.id, "email": teacher.email, "full_name": teacher.full_name}}

@app.delete("/api/users/teacher/{teacher_id}")
def delete_teacher(teacher_id: int, admin: models.User = Depends(require_role("super_admin")), db: Session = Depends(get_db)):
    teacher = db.query(models.User).filter(models.User.id == teacher_id, models.User.role == models.UserRole.teacher).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")
    # Remove subject assignments first
    db.query(models.TeacherSubject).filter(models.TeacherSubject.teacher_id == teacher_id).delete()
    db.delete(teacher)
    db.commit()
    return {"status": "success", "message": "Teacher deleted"}

# --- Student Management ---

@app.get("/api/users/students")
def get_all_students(admin: models.User = Depends(require_role("super_admin")), db: Session = Depends(get_db)):
    students = db.query(models.User).filter(models.User.role == models.UserRole.student).all()
    result = []
    for s in students:
        result.append({
            "id": s.id, "email": s.email, "full_name": s.full_name, "is_active": getattr(s, 'is_active', True)
        })
    return {"status": "success", "data": result}

@app.get("/api/teacher/students")
def get_teacher_students(teacher: models.User = Depends(require_role("teacher")), db: Session = Depends(get_db)):
    # Get subjects this teacher is assigned to
    teacher_subjects = db.query(models.TeacherSubject).filter(models.TeacherSubject.teacher_id == teacher.id).all()
    subject_ids = [ts.subject_id for ts in teacher_subjects]
    
    # Get students enrolled in these subjects (approved only)
    enrollments = db.query(models.StudentEnrollment).filter(
        models.StudentEnrollment.subject_id.in_(subject_ids),
        models.StudentEnrollment.status == "approved"
    ).all()
    
    student_ids = list(set([e.student_id for e in enrollments]))
    students = db.query(models.User).filter(models.User.id.in_(student_ids)).all()
    
    result = []
    for s in students:
        s_enrollments = [e for e in enrollments if e.student_id == s.id]
        subject_names = []
        for e in s_enrollments:
            sub = db.query(models.Subject).get(e.subject_id)
            if sub: subject_names.append(sub.name_english)
            
        result.append({
            "id": s.id, "email": s.email, "full_name": s.full_name, "is_active": getattr(s, 'is_active', True),
            "enrolled_subjects": ", ".join(subject_names)
        })
    return {"status": "success", "data": result}

@app.patch("/api/users/student/{student_id}/toggle-active")
def toggle_student_active(student_id: int, admin: models.User = Depends(require_role("super_admin")), db: Session = Depends(get_db)):
    student = db.query(models.User).filter(models.User.id == student_id, models.User.role == models.UserRole.student).first()
    if not student: raise HTTPException(status_code=404, detail="Student not found")
    
    current = getattr(student, 'is_active', True)
    student.is_active = not current
    db.commit()
    return {"status": "success", "message": f"Student {'enabled' if student.is_active else 'disabled'}"}

@app.delete("/api/enrollments/student/{student_id}")
def kick_student(student_id: int, user: models.User = Depends(require_role("teacher")), db: Session = Depends(get_db)):
    # Teacher kicks out a student from all their subjects
    teacher_subjects = db.query(models.TeacherSubject).filter(models.TeacherSubject.teacher_id == user.id).all()
    subject_ids = [ts.subject_id for ts in teacher_subjects]
    
    enrollments = db.query(models.StudentEnrollment).filter(
        models.StudentEnrollment.student_id == student_id,
        models.StudentEnrollment.subject_id.in_(subject_ids)
    ).all()
    
    if not enrollments:
        raise HTTPException(status_code=404, detail="Student not enrolled in your subjects")
        
    for enrollment in enrollments:
        # Delete progress
        lessons = db.query(models.Lesson).filter(models.Lesson.subject_id == enrollment.subject_id).all()
        lesson_ids = [l.id for l in lessons]
        if lesson_ids:
            db.query(models.StudentProgress).filter(
                models.StudentProgress.student_id == student_id,
                models.StudentProgress.lesson_id.in_(lesson_ids)
            ).delete(synchronize_session=False)
        db.delete(enrollment)
        
    db.commit()
    return {"status": "success", "message": "Student removed from your subjects"}

# ============================================================
# ENROLLMENT ENDPOINTS
# ============================================================

@app.post("/api/enrollments/request")
def request_enrollment(payload: dict, student: models.User = Depends(require_role("student")), db: Session = Depends(get_db)):
    subject_id = payload.get("subject_id")
    existing = db.query(models.StudentEnrollment).filter(models.StudentEnrollment.student_id == student.id, models.StudentEnrollment.subject_id == subject_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Already {existing.status}")
    enrollment = models.StudentEnrollment(student_id=student.id, subject_id=subject_id)
    db.add(enrollment)
    db.commit()
    return {"status": "success", "message": "Enrollment request submitted"}

@app.get("/api/enrollments/pending")
def get_pending_enrollments(user: models.User = Depends(require_role("super_admin", "teacher")), db: Session = Depends(get_db)):
    query = db.query(models.StudentEnrollment).filter(models.StudentEnrollment.status == "pending")
    if user.role == "teacher":
        teacher_subject_ids = [ts.subject_id for ts in db.query(models.TeacherSubject).filter(models.TeacherSubject.teacher_id == user.id).all()]
        query = query.filter(models.StudentEnrollment.subject_id.in_(teacher_subject_ids))
    enrollments = query.all()
    result = []
    for e in enrollments:
        student = db.query(models.User).get(e.student_id)
        subject = db.query(models.Subject).get(e.subject_id)
        result.append({"id": e.id, "student_name": student.full_name if student else "?", "student_email": student.email if student else "?", "subject_name": subject.name_english if subject else "?", "subject_id": e.subject_id, "requested_at": str(e.requested_at)})
    return {"status": "success", "data": result}

@app.patch("/api/enrollments/{enrollment_id}/approve")
def approve_enrollment(enrollment_id: int, user: models.User = Depends(require_role("super_admin", "teacher")), db: Session = Depends(get_db)):
    enrollment = db.query(models.StudentEnrollment).filter(models.StudentEnrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    enrollment.status = "approved"
    enrollment.approved_by = user.id
    enrollment.resolved_at = datetime.datetime.utcnow()
    db.commit()
    return {"status": "success", "message": "Student enrolled"}

@app.patch("/api/enrollments/{enrollment_id}/deny")
def deny_enrollment(enrollment_id: int, user: models.User = Depends(require_role("super_admin", "teacher")), db: Session = Depends(get_db)):
    enrollment = db.query(models.StudentEnrollment).filter(models.StudentEnrollment.id == enrollment_id).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    enrollment.status = "denied"
    enrollment.approved_by = user.id
    enrollment.resolved_at = datetime.datetime.utcnow()
    db.commit()
    return {"status": "success", "message": "Enrollment denied"}

@app.patch("/api/enrollments/bulk-approve")
def bulk_approve(payload: dict, admin: models.User = Depends(require_role("super_admin")), db: Session = Depends(get_db)):
    ids = payload.get("ids", [])
    count = 0
    for eid in ids:
        e = db.query(models.StudentEnrollment).filter(models.StudentEnrollment.id == eid, models.StudentEnrollment.status == "pending").first()
        if e:
            e.status = "approved"
            e.approved_by = admin.id
            e.resolved_at = datetime.datetime.utcnow()
            count += 1
    db.commit()
    return {"status": "success", "message": f"Approved {count} enrollments"}

@app.get("/api/enrollments/my")
def my_enrollments(student: models.User = Depends(require_role("student")), db: Session = Depends(get_db)):
    enrollments = db.query(models.StudentEnrollment).filter(models.StudentEnrollment.student_id == student.id).all()
    result = []
    for e in enrollments:
        subject = db.query(models.Subject).get(e.subject_id)
        result.append({"id": e.id, "subject_id": e.subject_id, "subject_name": subject.name_english if subject else "?", "subject_name_urdu": subject.name_urdu if subject else "?", "status": e.status})
    return {"status": "success", "data": result}

# ============================================================
# PROGRESS TRACKING
# ============================================================

class ProgressSave(BaseModel):
    lesson_id: int
    quiz_score: int
    quiz_total: int

@app.post("/api/progress")
def save_progress(req: ProgressSave, student: models.User = Depends(require_role("student")), db: Session = Depends(get_db)):
    existing = db.query(models.StudentProgress).filter(models.StudentProgress.student_id == student.id, models.StudentProgress.lesson_id == req.lesson_id).first()
    passed = req.quiz_score >= (req.quiz_total * 0.6)
    if existing:
        if req.quiz_score > existing.quiz_score:
            existing.quiz_score = req.quiz_score
            existing.quiz_total = req.quiz_total
            existing.quiz_passed = passed
            existing.completed = True
            existing.completed_at = datetime.datetime.utcnow()
    else:
        progress = models.StudentProgress(student_id=student.id, lesson_id=req.lesson_id, quiz_score=req.quiz_score, quiz_total=req.quiz_total, quiz_passed=passed, completed=True)
        db.add(progress)
    db.commit()
    return {"status": "success", "passed": passed, "score": req.quiz_score, "total": req.quiz_total}

@app.get("/api/progress/me")
def my_progress(student: models.User = Depends(require_role("student")), db: Session = Depends(get_db)):
    progress = db.query(models.StudentProgress).filter(models.StudentProgress.student_id == student.id).all()
    result = []
    for p in progress:
        lesson = db.query(models.Lesson).get(p.lesson_id)
        result.append({"lesson_id": p.lesson_id, "lesson_title": lesson.title_english if lesson else "?", "quiz_score": p.quiz_score, "quiz_total": p.quiz_total, "quiz_passed": p.quiz_passed, "completed_at": str(p.completed_at)})
    return {"status": "success", "data": result}

# --- Existing Database Endpoints (Supabase) ---

@app.post("/api/lessons/approve")
def approve_and_sync_lesson(payload: dict, db: Session = Depends(get_db)):
    """Approve a pending lesson by marking is_approved = True"""
    lesson_id = payload.get("id")
    if not lesson_id:
        raise HTTPException(status_code=400, detail="Lesson ID required")
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson.is_approved = True
    lesson.is_active = True
    db.commit()
    return {"status": "success", "message": "Lesson approved and published!", "id": lesson.id}

@app.get("/api/lessons")
def pull_active_lessons(db: Session = Depends(get_db)):
    """Student Portal fetches active, non-trashed lessons from Supabase"""
    lessons = db.query(models.Lesson).filter(
        models.Lesson.is_approved == True,
        models.Lesson.is_trashed == False,
        models.Lesson.is_active == True
    ).all()
    return {"status": "success", "data": lessons}

@app.get("/api/lessons/pending")
def pull_pending_lessons(db: Session = Depends(get_db)):
    """Teacher Dashboard fetches unapproved, non-trashed lessons"""
    lessons = db.query(models.Lesson).filter(
        models.Lesson.is_approved == False,
        models.Lesson.is_trashed == False
    ).all()
    return {"status": "success", "data": lessons}

@app.get("/api/lessons/trashed")
def get_trashed_lessons(db: Session = Depends(get_db)):
    """Fetch all trashed lessons for the Trash page"""
    lessons = db.query(models.Lesson).filter(models.Lesson.is_trashed == True).all()
    return {"status": "success", "data": lessons}

@app.get("/api/lessons/all")
def get_all_lessons(db: Session = Depends(get_db)):
    """Live DB: Fetch all non-trashed approved lessons"""
    lessons = db.query(models.Lesson).filter(models.Lesson.is_trashed == False, models.Lesson.is_approved == True).all()
    return {"status": "success", "data": lessons}

@app.delete("/api/lessons/{lesson_id}")
def delete_lesson(lesson_id: int, db: Session = Depends(get_db)):
    """Permanently delete a lesson (use trash instead for soft delete)"""
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    db.delete(lesson)
    db.commit()
    return {"status": "success", "message": "Lesson permanently deleted"}

@app.patch("/api/lessons/{lesson_id}/trash")
def trash_lesson(lesson_id: int, db: Session = Depends(get_db)):
    """Soft-delete: move lesson to trash"""
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson.is_trashed = True
    db.commit()
    return {"status": "success", "message": "Lesson moved to trash"}

@app.patch("/api/lessons/{lesson_id}/restore")
def restore_lesson(lesson_id: int, db: Session = Depends(get_db)):
    """Restore a trashed lesson"""
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson.is_trashed = False
    db.commit()
    return {"status": "success", "message": "Lesson restored"}

@app.patch("/api/lessons/{lesson_id}/toggle-active")
def toggle_lesson_active(lesson_id: int, db: Session = Depends(get_db)):
    """Toggle visibility of a published lesson (hide/show from students)"""
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    lesson.is_active = not lesson.is_active
    db.commit()
    return {"status": "success", "is_active": lesson.is_active, "message": f"Lesson {'enabled' if lesson.is_active else 'disabled'}"}

@app.put("/api/lessons/{lesson_id}")
def update_lesson(lesson_id: int, lesson_update: dict, db: Session = Depends(get_db)):
    lesson = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    for key, value in lesson_update.items():
        if hasattr(lesson, key):
            setattr(lesson, key, value)
    db.commit()
    db.refresh(lesson)
    return {"status": "success", "message": "Lesson updated", "data": lesson}

@app.delete("/api/reset")
def reset_database(db: Session = Depends(get_db)):
    """DANGER: Wipe all lessons and source documents. Fresh start."""
    deleted_lessons = db.query(models.Lesson).delete()
    deleted_docs = db.query(models.SourceDocument).delete()
    db.commit()
    return {"status": "success", "message": f"Deleted {deleted_lessons} lessons and {deleted_docs} source documents."}

# --- Prompt Configuration Endpoints ---

DEFAULT_PROMPTS = {
    "extraction": (
        "You are an expert Islamic Studies curriculum processor specializing in the Dars-e-Nizami syllabus.\n"
        "You can handle ANY subject from the Nizami canon including but not limited to:\n"
        "- Mantiq (Logic / Epistemology)\n"
        "- Nahw (Arabic Syntax / Grammar)\n"
        "- Sarf (Arabic Morphology)\n"
        "- Balagha (Rhetoric / Eloquence)\n"
        "- Fiqh (Islamic Jurisprudence)\n"
        "- Usul al-Fiqh (Principles of Jurisprudence)\n"
        "- Tafsir (Quranic Exegesis)\n"
        "- Hadith & Usul al-Hadith (Prophetic Traditions & their Sciences)\n"
        "- Aqeedah / Kalam (Islamic Theology / Creed)\n"
        "- Falsafa (Islamic Philosophy)\n"
        "- Adab (Arabic Literature)\n\n"
        "For each distinct topic you find:\n"
        "1. Identify the subject domain automatically from the content.\n"
        "2. Extract the classical Arabic/Urdu definition exactly as the author wrote it (definition_classic).\n"
        "3. Map it to its modern Western academic equivalent - e.g. Mantiq->Epistemology/Formal Logic, "
        "Nahw->Generative Grammar/Syntax Theory, Sarf->Morphological Analysis, Balagha->Rhetoric/Stylistics, "
        "Fiqh->Comparative Law, Usul->Legal Theory, Kalam->Philosophical Theology, etc (definition_modern).\n"
        "4. Write a clear learning objective (objective).\n"
        "5. Provide both Arabic/Urdu and English titles.\n\n"
        "Return ONLY a valid JSON array of objects with exactly these keys: "
        "title_urdu, title_english, objective, definition_classic, definition_modern"
    ),
    "tutor": (
        "You are an AI Tutor for the Dars-e-Nizami Islamic Studies curriculum.\n"
        "You are capable of teaching any subject from the Nizami syllabus including "
        "Mantiq, Nahw, Sarf, Balagha, Fiqh, Usul al-Fiqh, Tafsir, Hadith, Aqeedah, Kalam, and Falsafa.\n\n"
        "Rules:\n"
        "- Stay strictly within the context of the current lesson being studied.\n"
        "- Use the classical terminology from the source text while explaining in accessible language.\n"
        "- Bridge classical concepts to their modern academic equivalents when helpful.\n"
        "- Respond in a friendly, pedagogical tone using Urdu/English mix as appropriate.\n"
        "- Give examples from the relevant subject domain.\n"
        "- Keep it concise but thorough."
    )
}

def seed_prompts(db: Session):
    """Ensure default prompts exist in DB"""
    for name, text in DEFAULT_PROMPTS.items():
        existing = db.query(models.PromptConfig).filter(models.PromptConfig.prompt_name == name).first()
        if not existing:
            db.add(models.PromptConfig(prompt_name=name, prompt_text=text))
    db.commit()

@app.get("/api/prompts")
def get_all_prompts(db: Session = Depends(get_db)):
    """Fetch all system prompts."""
    seed_prompts(db)
    configs = db.query(models.PromptConfig).all()
    return {"status": "success", "data": [{"id": c.id, "prompt_name": c.prompt_name, "prompt_text": c.prompt_text} for c in configs]}

class PromptUpdate(BaseModel):
    prompt_name: str
    prompt_text: str

@app.put("/api/prompts")
def update_prompt_config(update: PromptUpdate, db: Session = Depends(get_db)):
    """Teacher updates a specific system prompt."""
    config = db.query(models.PromptConfig).filter(models.PromptConfig.prompt_name == update.prompt_name).first()
    if not config:
        config = models.PromptConfig(prompt_name=update.prompt_name, prompt_text=update.prompt_text)
        db.add(config)
    else:
        config.prompt_text = update.prompt_text
    db.commit()
    db.refresh(config)
    return {"status": "success", "message": f"Prompt '{update.prompt_name}' saved."}

# --- AI-Powered Student Features ---

class QuizRequest(BaseModel):
    lesson_id: int

class TutorChatRequest(BaseModel):
    lesson_id: int
    question: str
    history: list = []

@app.post("/api/quiz/generate")
def generate_quiz(req: QuizRequest, db: Session = Depends(get_db)):
    """Generate dynamic quiz questions from lesson content using Gemini."""
    if not gemini_initialized:
        raise HTTPException(status_code=503, detail="Gemini AI not available")
    
    lesson = db.query(models.Lesson).filter(models.Lesson.id == req.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    prompt = f"""You are a Dars-e-Nizami quiz generator. Based on this lesson, create exactly 4 multiple-choice questions.

LESSON TITLE (Urdu): {lesson.title_urdu}
LESSON TITLE (English): {lesson.title_english}
OBJECTIVE: {lesson.objective}
CLASSIC DEFINITION: {lesson.definition_classic}
MODERN DEFINITION: {lesson.definition_modern}

RULES:
1. Questions MUST be in Urdu with English terminology in brackets where needed
2. Each question must have exactly 3 options
3. Questions should test understanding of the lesson concepts
4. Mix conceptual and application-based questions
5. Return ONLY valid JSON array, no markdown, no extra text

FORMAT (return exactly this JSON structure):
[
  {{
    "id": 1,
    "text": "سوال کا متن یہاں (Question text here)",
    "options": [
      {{"key": "a", "text": "پہلا آپشن"}},
      {{"key": "b", "text": "دوسرا آپشن"}},
      {{"key": "c", "text": "تیسرا آپشن"}}
    ],
    "correct": "a",
    "explanation": "صحیح جواب کی وضاحت"
  }}
]"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        raw = response.text.strip()
        # Clean markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()
        
        questions = json.loads(raw)
        return {"status": "success", "data": questions}
    except Exception as e:
        print(f"[QUIZ] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Quiz generation failed: {str(e)}")


@app.post("/api/tutor/chat")
def tutor_chat(req: TutorChatRequest, db: Session = Depends(get_db)):
    """AI Tutor answers questions about a specific lesson using Gemini."""
    if not gemini_initialized:
        raise HTTPException(status_code=503, detail="Gemini AI not available")
    
    lesson = db.query(models.Lesson).filter(models.Lesson.id == req.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Get tutor prompt from DB or use default
    config = db.query(models.PromptConfig).filter(models.PromptConfig.prompt_name == "tutor_system_prompt").first()
    system_prompt = config.prompt_text if config else DEFAULT_PROMPTS.get("tutor_system_prompt", "")
    
    context = f"""{system_prompt}

CURRENT LESSON CONTEXT:
Title (Urdu): {lesson.title_urdu}
Title (English): {lesson.title_english}
Objective: {lesson.objective}
Classic Definition: {lesson.definition_classic}
Modern Definition: {lesson.definition_modern}

STUDENT'S QUESTION: {req.question}

RULES:
- Answer primarily in Urdu, use English technical terms in brackets
- Keep answers focused on this lesson's content
- Be encouraging and pedagogical
- If the question is unrelated, gently redirect to the lesson topic"""

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=context
        )
        return {"status": "success", "reply": response.text}
    except Exception as e:
        print(f"[TUTOR] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Tutor error: {str(e)}")


# --- Background PDF Processing ---

def process_pdf_background(pdf_bytes: bytes, filename: str, source_doc_id: int):
    """Background worker: sends PDF pages as images to Gemini for multimodal extraction."""
    from database import SessionLocal
    import base64
    db = SessionLocal()
    
    total_drafts = 0
    
    # Read the active extraction prompt from DB
    config = db.query(models.PromptConfig).filter(models.PromptConfig.prompt_name == "extraction").first()
    custom_prompt = config.prompt_text if config else "Extract all distinct logical topics as lessons."
    
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)
        
        # Process pages in batches of 3 to stay within token limits
        BATCH_SIZE = 3
        page_batches = [list(range(i, min(i + BATCH_SIZE, total_pages))) for i in range(0, total_pages, BATCH_SIZE)]
        
        print(f"[WORKER] PDF '{filename}' has {total_pages} pages. Processing in {len(page_batches)} batches of {BATCH_SIZE}...")
        
        for batch_idx, page_indices in enumerate(page_batches):
            print(f"[WORKER] Batch {batch_idx+1}/{len(page_batches)} (pages {page_indices[0]+1}-{page_indices[-1]+1}) for '{filename}'...")
            
            # Render pages to images and build multimodal content
            contents = []
            for page_num in page_indices:
                page = doc[page_num]
                pix = page.get_pixmap(dpi=150)
                img_bytes = pix.tobytes("png")
                
                # google-genai SDK: use dict format for inline image data
                contents.append({
                    "inline_data": {
                        "mime_type": "image/png",
                        "data": base64.b64encode(img_bytes).decode("utf-8")
                    }
                })
            
            # Add text prompt after images (just a plain string in the list)
            prompt_text = f"""You are reading pages {page_indices[0]+1} to {page_indices[-1]+1} of {total_pages} from a classical Dars-e-Nizami textbook called "{filename}".

First, identify what subject this text belongs to (Mantiq, Nahw, Sarf, Balagha, Fiqh, Usul al-Fiqh, Tafsir, Hadith, Aqeedah/Kalam, Falsafa, Adab, etc.).

Teacher Instructions:
{custom_prompt}

Look at the page images above carefully. Read ALL the Arabic/Urdu text visible in them.
Extract ALL distinct topics/lessons found across these pages.
Each topic should be a self-contained lesson unit from whatever subject the text covers.

زبان کے اصول (LANGUAGE RULES - CRITICAL):
- تمام آؤٹ پٹ اردو میں ہونا چاہیے۔
- صرف وہ اصطلاحات انگریزی میں لکھیں جن کا اردو ترجمہ ممکن نہ ہو، اور وہ بھی بریکٹ میں۔
- مثال: "تصور (Concept) وہ ذہنی صورت ہے جو..." — یہاں Concept بریکٹ میں ہے کیونکہ یہ ایک ٹیکنیکل ٹرم ہے۔
- objective, definition_classic, definition_modern سب اردو میں لکھیں۔
- definition_modern میں جدید مغربی مساوی اصطلاح بریکٹ میں دیں لیکن وضاحت اردو میں ہو۔

Return ONLY a valid JSON array of objects, where each object has these exact keys:
"title_urdu" (عنوان جیسا کتاب میں ہے — عربی/اردو),
"title_english" (English translation of the title only),
"objective" (اردو میں — طالب علم کیا سیکھے گا),
"definition_classic" (اردو/عربی میں — اصل کتاب کی عبارت من و عن، اصطلاحات کے ساتھ بریکٹ میں انگریزی مساوی),
"definition_modern" (اردو میں — جدید مغربی علمی وضاحت، ٹیکنیکل ٹرمز بریکٹ میں انگریزی)

If there are no distinct lessons on these pages, return an empty array [].
Be thorough - extract every distinct topic you can identify."""
            contents.append(prompt_text)
            
            try:
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=contents,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                    ),
                )
                
                chunked_data = json.loads(response.text)
                if isinstance(chunked_data, list):
                    for l_data in chunked_data:
                        draft = models.Lesson(
                            title_english=l_data.get("title_english", "Draft"),
                            title_urdu=l_data.get("title_urdu", "مسودہ"),
                            objective=l_data.get("objective", ""),
                            definition_classic=l_data.get("definition_classic", ""),
                            definition_modern=l_data.get("definition_modern", ""),
                            source_document=filename,
                            is_approved=False
                        )
                        db.add(draft)
                        total_drafts += 1
                    db.commit()
                    print(f"[WORKER] Batch {batch_idx+1} extracted {len(chunked_data)} lessons.")
            except Exception as chunk_err:
                err_str = str(chunk_err)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    print(f"[WORKER] Batch {batch_idx+1} rate limited. Waiting 15s and retrying...")
                    time.sleep(15)
                    try:
                        response = client.models.generate_content(
                            model="gemini-2.0-flash",
                            contents=contents,
                            config=types.GenerateContentConfig(
                                response_mime_type="application/json",
                            ),
                        )
                        chunked_data = json.loads(response.text)
                        if isinstance(chunked_data, list):
                            for l_data in chunked_data:
                                draft = models.Lesson(
                                    title_english=l_data.get("title_english", "Draft"),
                                    title_urdu=l_data.get("title_urdu", "مسودہ"),
                                    objective=l_data.get("objective", ""),
                                    definition_classic=l_data.get("definition_classic", ""),
                                    definition_modern=l_data.get("definition_modern", ""),
                                    source_document=filename,
                                    is_approved=False
                                )
                                db.add(draft)
                                total_drafts += 1
                            db.commit()
                            print(f"[WORKER] Batch {batch_idx+1} RETRY extracted {len(chunked_data)} lessons.")
                    except Exception as retry_err:
                        print(f"[WORKER] Batch {batch_idx+1} retry also failed: {retry_err}")
                else:
                    print(f"[WORKER] Batch {batch_idx+1} failed: {chunk_err}")
            
            # Rate limit protection: wait 8 seconds between API calls
            time.sleep(8)
        
        doc.close()
        
        # Mark document as fully processed
        source_doc = db.query(models.SourceDocument).filter(models.SourceDocument.id == source_doc_id).first()
        if source_doc:
            source_doc.status = f"completed ({total_drafts} lessons)"
            db.commit()
        print(f"[WORKER] DONE. Generated {total_drafts} lessons from '{filename}'.")
    except Exception as e:
        print(f"[WORKER] Fatal error: {e}")
        source_doc = db.query(models.SourceDocument).filter(models.SourceDocument.id == source_doc_id).first()
        if source_doc:
            source_doc.status = "failed"
            db.commit()
    finally:
        db.close()

@app.post("/api/documents/upload")
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Admin uploads PDF. Pages are sent as images to Gemini for multimodal extraction."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    if not gemini_initialized:
        raise HTTPException(status_code=500, detail="Gemini SDK failed to initialize. Cannot process document.")
    
    # Read raw PDF bytes
    pdf_bytes = await file.read()
    
    # Count pages for estimate
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(doc)
    estimated_batches = max(1, (total_pages + 2) // 3)  # batches of 3 pages
    doc.close()
        
    source_doc = models.SourceDocument(
        filename=file.filename,
        extracted_text=f"[PDF with {total_pages} pages - processed via Gemini Vision]",
        status="processing"
    )
    db.add(source_doc)
    db.commit()
    db.refresh(source_doc)

    # Dispatch background processing with raw PDF bytes
    background_tasks.add_task(process_pdf_background, pdf_bytes, file.filename, source_doc.id)
    
    return {
        "status": "success", 
        "document_id": source_doc.id, 
        "total_pages": total_pages,
        "estimated_batches": estimated_batches,
        "message": f"Document accepted. {total_pages} pages will be processed in {estimated_batches} batches via Gemini Vision. Lessons will appear in Pending Review."
    }

# --- AI Endpoints (Gemini) ---

@app.post("/api/generate-lesson")
def generate_lesson(req: GenerationRequest):
    if not gemini_initialized:
        raise HTTPException(status_code=500, detail="Gemini SDK failed to initialize. Check GEMINI_API_KEY in .env")

    try:
        prompt = f"""
        Source Classic Text: {req.source_text}
        Target Topic: {req.target_topic}
        Instruction: {req.instruction}

        Perform a high-level philosophical extraction:
        1. Extract the core concept from the source text.
        2. Map it to Modern Epistemology / Analytical Philosophy equivalents.
        3. Return ONLY a valid JSON object with these exact keys:
           "title_urdu", "title_english", "objective", "definition_classic_urdu", "definition_modern_english"
        """

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )

        return {"status": "success", "generated_data": response.text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    lesson_id: int
    user_message: str

@app.post("/api/tutor/chat")
def tutor_chat(req: ChatRequest, db: Session = Depends(get_db)):
    if not gemini_initialized:
        raise HTTPException(status_code=500, detail="Gemini SDK offline.")
    
    lesson = db.query(models.Lesson).filter(models.Lesson.id == req.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson context not found")
        
    # Pull tutor prompt from DB
    tutor_config = db.query(models.PromptConfig).filter(models.PromptConfig.prompt_name == "tutor").first()
    tutor_instructions = tutor_config.prompt_text if tutor_config else "You are an AI Tutor for Amali Mantiq. Be helpful and concise."
    
    prompt = f"""
    {tutor_instructions}
    
    Current Lesson English: {lesson.title_english}
    Current Lesson Urdu: {lesson.title_urdu}
    Classical Def: {lesson.definition_classic}
    Modern Def: {lesson.definition_modern}
    
    Student Question: {req.user_message}
    """
    
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        return {"status": "success", "reply": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
