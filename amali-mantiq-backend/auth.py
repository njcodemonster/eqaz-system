"""
Authentication utilities: JWT token generation/verification + password hashing.
"""
import os
import datetime
from typing import Optional
from functools import wraps

import jwt
import bcrypt
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db
import models

# --- Config ---

SECRET_KEY = os.getenv("JWT_SECRET", "eqaz-super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# --- Password Hashing ---

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


# --- JWT Tokens ---

def create_access_token(user_id: int, email: str, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        payload["sub"] = int(payload["sub"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# --- FastAPI Dependencies ---

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> models.User:
    """Extract and validate the current user from the JWT token."""
    payload = decode_access_token(credentials.credentials)
    user = db.query(models.User).filter(models.User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_role(*allowed_roles: str):
    """Dependency factory: restrict endpoint to specific roles."""
    def dependency(current_user: models.User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied. Required role: {', '.join(allowed_roles)}"
            )
        return current_user
    return dependency


# --- Super Admin Seeding ---

def seed_super_admin(db: Session):
    """Create the Super Admin account on first startup if it doesn't exist."""
    email = os.getenv("SUPER_ADMIN_EMAIL", "admin@eqaz.com")
    password = os.getenv("SUPER_ADMIN_PASSWORD", "admin123")
    name = os.getenv("SUPER_ADMIN_NAME", "Super Admin")
    
    existing = db.query(models.User).filter(models.User.email == email).first()
    if not existing:
        admin = models.User(
            email=email,
            password_hash=hash_password(password),
            full_name=name,
            role=models.UserRole.super_admin
        )
        db.add(admin)
        db.commit()
        print(f"[AUTH] Super Admin seeded: {email}")
    else:
        print(f"[AUTH] Super Admin already exists: {email}")
