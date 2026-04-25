from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime
from database import Base
import datetime

class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(String, default="basic")
    title_english = Column(String, index=True)
    title_urdu = Column(String)
    objective = Column(Text)
    
    definition_classic = Column(Text)
    definition_modern = Column(Text)
    
    source_document = Column(String, default="User Configured Docs")
    
    is_approved = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)     # Live lessons can be hidden/disabled
    is_trashed = Column(Boolean, default=False)    # Soft-delete to trash
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class SourceDocument(Base):
    __tablename__ = "source_documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_path = Column(String)
    extracted_text = Column(Text)
    status = Column(String, default="pending") # pending, extracted, failed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class PromptConfig(Base):
    __tablename__ = "prompt_configs"

    id = Column(Integer, primary_key=True, index=True)
    prompt_name = Column(String, unique=True, index=True, default="extraction")
    prompt_text = Column(Text, default="""Perform a high-level philosophical extraction:
        1. Extract the core concept from the source text.
        2. Map it to Modern Epistemology / Analytical Philosophy equivalents.
        3. Return ONLY a valid JSON array of objects with exactly these keys:
           "title_urdu", "title_english", "objective", "definition_classic", "definition_modern"
        """)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
