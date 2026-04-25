from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types
import fitz
import json

# Import DB configurations
import models
from database import engine, get_db
from sqlalchemy.orm import Session

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
                pass  # Column likely already exists
        try:
            conn.execute(text("ALTER TABLE prompt_configs ADD COLUMN IF NOT EXISTS prompt_name VARCHAR DEFAULT 'extraction'"))
        except Exception:
            pass
        conn.commit()
    print("[OK] Successfully connected to Supabase Database.")
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

# --- Database Endpoints (Supabase) ---

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
