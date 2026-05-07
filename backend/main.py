import os
import uuid
import io
from datetime import datetime
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from sqlalchemy import Column, String, DateTime, Text, desc
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.sql import select
from dotenv import load_dotenv
from supabase import create_client, Client
from PyPDF2 import PdfReader
from collections import Counter
import re

load_dotenv()

# ---------- Environment ----------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")

if not all([SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL]):
    raise ValueError("Missing environment variables. Check .env file")

# ---------- Async SQLAlchemy ----------
engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

# ---------- Models ----------
class ApplicationTable(Base):
    __tablename__ = "applications"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True)
    company = Column(String)
    role = Column(String)
    status = Column(String)
    applied_date = Column(String)
    salary = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class UserResumeTable(Base):
    __tablename__ = "user_resumes"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, index=True)
    resume_text = Column(Text)
    keywords = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# ---------- FastAPI ----------
app = FastAPI(title="CareerOS API")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://careeros-ny7q.vercel.app",
        "https://careeros-7vwa.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        user_response = supabase.auth.get_user(token)
        if user_response.user is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = user_response.user
        return {"email": user.email, "sub": user.id}
    except Exception as e:
        print(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# ---------- Pydantic models ----------
class JobApplication(BaseModel):
    company: str
    role: str
    status: str = "Applied"
    applied_date: str
    salary: Optional[str] = None
    notes: Optional[str] = None

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class JobMatchRequest(BaseModel):
    job_description: str
    resume_text: Optional[str] = None

# ---------- Helper functions ----------
def extract_keywords(text: str, top_n: int = 20):
    words = text.lower().split()
    stopwords = {"the","and","for","with","experience","skills","of","to","in","that","is","are","was","were","a","an","on","at","by","be","this","from","as","i","you","we","they","your","our","their","have","has","had","will","would","could","should","may","might","must","also","etc","via","etc"}
    words = [re.sub(r'[^a-z]', '', w) for w in words if len(w) > 2 and w not in stopwords and re.match(r'^[a-z]+$', w)]
    counter = Counter(words)
    return [w for w, _ in counter.most_common(top_n)]

def calculate_match(resume_keywords: List[str], job_keywords: List[str]):
    resume_set = set(resume_keywords)
    job_set = set(job_keywords)
    matched = resume_set.intersection(job_set)
    missing = job_set - resume_set
    match_percent = len(matched) / len(job_set) * 100 if job_set else 0
    return round(match_percent), list(missing)

# ---------- API Endpoints ----------
@app.on_event("startup")
async def startup():
    await init_db()

@app.get("/")
async def root():
    return {"status": "CareerOS API running with Supabase"}

@app.post("/auth/register")
async def register(user: UserRegister):
    try:
        resp = supabase.auth.sign_up({
            "email": user.email,
            "password": user.password,
            "options": {"data": {"name": user.name}}
        })
        if resp.user is None:
            raise HTTPException(400, "Registration failed")
        return {"msg": "User created", "user_id": resp.user.id}
    except Exception as e:
        print(f"Register error: {e}")
        raise HTTPException(400, detail=str(e))

@app.post("/auth/login")
async def login(user: UserLogin):
    try:
        resp = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password
        })
        if resp.user is None:
            raise HTTPException(401, "Invalid credentials")
        return {"access_token": resp.session.access_token, "token_type": "bearer"}
    except Exception as e:
        print(f"Login error: {e}")
        raise HTTPException(401, detail=str(e))

@app.post("/applications/")
async def create_application(
    app_data: JobApplication,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    app_dict = app_data.dict()
    app_dict["id"] = str(uuid.uuid4())
    app_dict["user_id"] = current_user["sub"]
    stmt = ApplicationTable.__table__.insert().values(**app_dict)
    await db.execute(stmt)
    await db.commit()
    return {"message": "Application added", "id": app_dict["id"]}

@app.get("/applications/")
async def get_applications(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        ApplicationTable.__table__.select().where(ApplicationTable.user_id == current_user["sub"])
    )
    apps = result.fetchall()
    return [dict(app._mapping) for app in apps]

@app.delete("/applications/{app_id}")
async def delete_application(
    app_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = ApplicationTable.__table__.delete().where(
        ApplicationTable.id == app_id,
        ApplicationTable.user_id == current_user["sub"]
    )
    res = await db.execute(stmt)
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Application not found")
    return {"message": "Deleted"}

# ✅ PUT endpoint for editing applications
@app.put("/applications/{app_id}")
async def update_application(
    app_id: str,
    app_data: JobApplication,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Find the application
    stmt = select(ApplicationTable).where(
        ApplicationTable.id == app_id,
        ApplicationTable.user_id == current_user["sub"]
    )
    result = await db.execute(stmt)
    existing_app = result.scalar_one_or_none()
    
    if not existing_app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Update fields
    existing_app.company = app_data.company
    existing_app.role = app_data.role
    existing_app.status = app_data.status
    existing_app.applied_date = app_data.applied_date
    existing_app.salary = app_data.salary
    existing_app.notes = app_data.notes
    existing_app.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "Application updated", "id": app_id}

@app.post("/resume/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    content = await file.read()
    pdf = PdfReader(io.BytesIO(content))
    text = "".join(page.extract_text() or "" for page in pdf.pages)
    keywords = extract_keywords(text, top_n=20)
    ideal_skills = {"python", "react", "mongodb", "express", "nodejs", "git", "docker", "aws", "javascript", "typescript"}
    missing = [skill for skill in ideal_skills if skill not in keywords]
    score = max(0, 100 - len(missing) * 8)

    new_resume = UserResumeTable(
        user_id=current_user["sub"],
        resume_text=text,
        keywords=",".join(keywords)
    )
    db.add(new_resume)
    await db.commit()

    return {
        "score": score,
        "keywords": keywords,
        "missing": missing,
        "text_preview": text[:500]
    }

@app.post("/job/match")
async def match_job(
    request: JobMatchRequest,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if request.resume_text:
        resume_text = request.resume_text
    else:
        stmt = select(UserResumeTable).where(UserResumeTable.user_id == current_user["sub"]).order_by(desc(UserResumeTable.created_at))
        result = await db.execute(stmt)
        latest_resume = result.scalars().first()
        if not latest_resume:
            raise HTTPException(400, "No resume found. Please upload a resume first.")
        resume_text = latest_resume.resume_text

    resume_keywords = extract_keywords(resume_text, top_n=30)
    job_keywords = extract_keywords(request.job_description, top_n=30)
    match_percent, missing_keywords = calculate_match(resume_keywords, job_keywords)

    suggestions = []
    if match_percent < 50:
        suggestions.append("Your resume shares few keywords with this job description. Consider adding relevant skills and experiences.")
    elif match_percent < 75:
        suggestions.append("Decent match. Add some of the missing keywords to improve your resume.")
    else:
        suggestions.append("Great match! Your resume aligns well with this role.")

    if missing_keywords:
        suggestions.append(f"Add these keywords to your resume: {', '.join(missing_keywords[:5])}")

    return {
        "match_percent": match_percent,
        "resume_keywords": resume_keywords[:20],
        "job_keywords": job_keywords[:20],
        "missing_keywords": missing_keywords[:10],
        "suggestions": suggestions
    }
# uvicorn main:app --reload --port 8000