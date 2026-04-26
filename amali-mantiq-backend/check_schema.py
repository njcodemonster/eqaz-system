from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='lessons'"))
    cols = [r[0] for r in result]
    print('lessons columns:', cols)
    
    result2 = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='subjects'"))
    cols2 = [r[0] for r in result2]
    print('subjects columns:', cols2)
    
    result3 = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='prompt_configs'"))
    cols3 = [r[0] for r in result3]
    print('prompt_configs columns:', cols3)
