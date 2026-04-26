from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from database import Base
import datetime
import enum


# --- Enums ---

class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    teacher = "teacher"
    student = "student"


class EnrollmentStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    denied = "denied"


# --- Users ---

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default=UserRole.student, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    taught_subjects = relationship("TeacherSubject", back_populates="teacher")
    enrollments = relationship("StudentEnrollment", back_populates="student", foreign_keys="StudentEnrollment.student_id")
    progress = relationship("StudentProgress", back_populates="student")


# --- Subjects ---

class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name_english = Column(String, nullable=False, index=True)
    name_urdu = Column(String, nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    teachers = relationship("TeacherSubject", back_populates="subject")
    enrollments = relationship("StudentEnrollment", back_populates="subject")
    lessons = relationship("Lesson", back_populates="subject")
    source_documents = relationship("SourceDocument", back_populates="subject")
    prompts = relationship("PromptConfig", back_populates="subject")


# --- Teacher ↔ Subject Assignment ---

class TeacherSubject(Base):
    __tablename__ = "teacher_subjects"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)

    teacher = relationship("User", back_populates="taught_subjects")
    subject = relationship("Subject", back_populates="teachers")


# --- Student Enrollment ---

class StudentEnrollment(Base):
    __tablename__ = "student_enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    status = Column(String, default=EnrollmentStatus.pending, nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    requested_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    student = relationship("User", back_populates="enrollments", foreign_keys=[student_id])
    approver = relationship("User", foreign_keys=[approved_by])
    subject = relationship("Subject", back_populates="enrollments")


# --- Lessons (updated with subject_id) ---

class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)  # nullable for migration
    source_document_id = Column(Integer, ForeignKey("source_documents.id"), nullable=True)
    level = Column(String, default="basic")
    title_english = Column(String, index=True)
    title_urdu = Column(String)
    objective = Column(Text)

    definition_classic = Column(Text)
    definition_modern = Column(Text)

    source_document = Column(String, default="User Configured Docs")  # kept for backward compat

    is_approved = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_trashed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    subject = relationship("Subject", back_populates="lessons")


# --- Source Documents (updated with subject_id) ---

class SourceDocument(Base):
    __tablename__ = "source_documents"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)  # nullable for migration
    filename = Column(String, index=True)
    file_path = Column(String)
    extracted_text = Column(Text)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    subject = relationship("Subject", back_populates="source_documents")


# --- Student Progress ---

class StudentProgress(Base):
    __tablename__ = "student_progress"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lesson_id = Column(Integer, ForeignKey("lessons.id"), nullable=False)
    completed = Column(Boolean, default=False)
    quiz_score = Column(Integer, default=0)
    quiz_total = Column(Integer, default=0)
    quiz_passed = Column(Boolean, default=False)
    completed_at = Column(DateTime, default=datetime.datetime.utcnow)

    student = relationship("User", back_populates="progress")
    lesson = relationship("Lesson")


# --- Prompt Configs (updated with subject_id + inheritance) ---

class PromptConfig(Base):
    __tablename__ = "prompt_configs"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)  # NULL = global prompt
    prompt_name = Column(String, index=True, default="extraction")
    prompt_text = Column(Text, default="")
    inherit_global = Column(Boolean, default=True)  # If true, use global prompt instead
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    subject = relationship("Subject", back_populates="prompts")
