"""One-time migration: add new columns to existing tables for RBAC."""
from database import engine
from sqlalchemy import text

migrations = [
    "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS subject_id INTEGER REFERENCES subjects(id)",
    "ALTER TABLE lessons ADD COLUMN IF NOT EXISTS source_document_id INTEGER REFERENCES source_documents(id)",
    "ALTER TABLE source_documents ADD COLUMN IF NOT EXISTS subject_id INTEGER REFERENCES subjects(id)",
    "ALTER TABLE prompt_configs ADD COLUMN IF NOT EXISTS subject_id INTEGER REFERENCES subjects(id)",
    "ALTER TABLE prompt_configs ADD COLUMN IF NOT EXISTS inherit_global BOOLEAN DEFAULT true",
]

with engine.connect() as conn:
    for sql in migrations:
        try:
            conn.execute(text(sql))
            print(f"[OK] {sql[:60]}...")
        except Exception as e:
            print(f"[SKIP] {sql[:60]}... ({e})")
    conn.commit()
    print("\n[DONE] Migration complete.")
