import os
import uuid
import io
import json
import re
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from sqlalchemy import Column, String, DateTime, Text, desc, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.sql import select, and_
from dotenv import load_dotenv
from supabase import create_client, Client
from PyPDF2 import PdfReader
from collections import Counter

load_dotenv()

# ---------- Environment ----------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not all([SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL]):
    raise ValueError("Missing environment variables. Check .env file")

# ---------- Gemini Setup (New SDK) ----------
genai_client = None
if GEMINI_API_KEY:
    try:
        from google import genai
        genai_client = genai.Client(api_key=GEMINI_API_KEY)
        print("✅ Gemini AI configured successfully")
    except ImportError:
        print("⚠️ google-genai not installed. Add to requirements.txt")
    except Exception as e:
        print(f"⚠️ Gemini setup failed: {e}")

# ---------- Async SQLAlchemy ----------
engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    pool_pre_ping=True,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "server_settings": {
            "application_name": "careeros"
        }
    }
)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

# ---------- Models (UUID columns matching your database) ----------
class ApplicationTable(Base):
    __tablename__ = "applications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, index=True)  # Supabase Auth user IDs are strings (varchar)
    company = Column(String)
    role = Column(String)
    status = Column(String)
    applied_date = Column(String)
    salary = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    job_description = Column(Text, nullable=True)
    jd_id = Column(UUID(as_uuid=True), nullable=True)  # FK referencing job_descriptions (UUID)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UserResumeTable(Base):
    __tablename__ = "user_resumes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String, index=True)
    resume_text = Column(Text)
    keywords = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

class JobDescriptionTable(Base):
    __tablename__ = "job_descriptions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name = Column(String, index=True)
    role = Column(String)
    job_description = Column(Text)
    extracted_skills = Column(Text)
    extracted_keywords = Column(Text)
    source_type = Column(String, default="community")
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    added_by_user_id = Column(String)  # Supabase user ID is a string
    times_used = Column(Integer, default=0)
    share_consent = Column(Boolean, default=False)

class JDFeedbackTable(Base):
    __tablename__ = "jd_feedback"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    jd_id = Column(UUID(as_uuid=True), nullable=True)
    user_id = Column(String, nullable=True)
    is_accurate = Column(Boolean, nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# ---------- FastAPI ----------
app = FastAPI(title="CareerOS API")

# Custom JSON serialization for UUID objects
import uuid as uuid_module
def custom_json_serializer(obj):
    if isinstance(obj, uuid_module.UUID):
        return str(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

# Override default JSON encoder
from fastapi.responses import JSONResponse
import json as json_module

class CustomJSONResponse(JSONResponse):
    def render(self, content) -> bytes:
        return json_module.dumps(
            content,
            default=custom_json_serializer,
            ensure_ascii=False,
            indent=None,
        ).encode("utf-8")

# Set as default response class
app.default_response_class = CustomJSONResponse

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    job_description: Optional[str] = None

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

class JobDescriptionCreate(BaseModel):
    company_name: str
    role: str
    job_description: str
    share_consent: bool = False

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

async def extract_skills_with_gemini(text: str) -> List[str]:
    """Extract SPECIFIC technical skills from resume or JD using Gemini"""
    if genai_client is None:
        return extract_keywords(text, top_n=15)
    
    try:
        prompt = f"""
Extract SPECIFIC technical skills from the following text.
Focus on concrete technologies, frameworks, languages, tools, and technical concepts.
Return ONLY a JSON array of skill names, nothing else.

Rules:
- Include specific technologies (e.g., "React", "PostgreSQL", "Docker", NOT "Front-end technologies")
- Include concrete concepts (e.g., "REST API Design", "Database Optimization", "CI/CD Pipelines")
- DO NOT include soft skills like "Problem Solving", "Communication", "Teamwork", "Leadership"
- DO NOT include vague terms like "System Design" unless specifically mentioned with technology context
- DO NOT include generic terms like "Programming", "Coding", "Development"
- Limit to 5-10 most important skills
- Prefer specific tools/languages over general concepts

Text: {text[:3000]}

Example good output: ["React", "Node.js", "PostgreSQL", "REST API Design", "AWS", "Docker", "CI/CD", "TypeScript"]
Example bad output: ["Problem Solving", "Communication", "Front-end technologies", "Backend Development"]

Output:"""
        
        response = genai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        json_match = re.search(r'\[.*\]', response.text, re.DOTALL)
        if json_match:
            skills = json.loads(json_match.group())
            soft_skills = {"problem solving", "communication", "teamwork", "leadership", 
                          "critical thinking", "time management", "creativity", "adaptability",
                          "work ethic", "attention to detail", "organization"}
            skills = [s for s in skills if s.lower() not in soft_skills]
            return skills[:15]
        return extract_keywords(text, top_n=15)
    except Exception as e:
        print(f"Gemini error: {e}")
        return extract_keywords(text, top_n=15)

async def get_company_skills_estimate(company: str, role: str) -> dict:
    """Get estimated skills for a company using Gemini (fallback when no JD exists)"""
    if genai_client is None:
        return {
            "skills": ["Python", "Java", "SQL", "Data Structures", "Algorithms"],
            "sample_problems": ["LeetCode Top Interview Questions"],
            "resources": ["LeetCode", "GeeksforGeeks"]
        }
    
    try:
        prompt = f"""
What are the SPECIFIC technical skills typically required for a {role} at {company}?
Focus on concrete technologies, programming languages, frameworks, and tools.
Return ONLY a JSON object with this structure:
{{
  "skills": ["skill1", "skill2", "skill3"],
  "sample_problems": ["problem1", "problem2"],
  "resources": ["resource1", "resource2"]
}}

Rules:
- Include specific technologies (e.g., "React", "Python", "AWS", NOT "Front-end")
- Include concrete concepts (e.g., "Distributed Systems", "CI/CD", NOT "System Design")
- DO NOT include soft skills
- Keep it to 5-7 most important technical skills
- Focus on what the company actually tests/requires in interviews

Example for Google SWE: ["Python", "Java", "Data Structures", "Algorithms", "System Design", "Distributed Systems"]
Example for Amazon SDE: ["Java", "AWS", "Microservices", "System Design", "Data Structures"]
"""
        response = genai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        json_match = re.search(r'\{.*\}', response.text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
            soft_skills = {"problem solving", "communication", "teamwork", "leadership"}
            if "skills" in result:
                result["skills"] = [s for s in result["skills"] if s.lower() not in soft_skills]
            return result
    except Exception as e:
        print(f"Gemini estimate error: {e}")
    
    return {
        "skills": ["Python", "Java", "SQL", "Data Structures", "Algorithms"],
        "sample_problems": ["LeetCode Top Interview Questions"],
        "resources": ["LeetCode", "GeeksforGeeks"]
    }

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
    app_dict["id"] = uuid.uuid4()  # Now returns UUID object
    app_dict["user_id"] = current_user["sub"]
    stmt = ApplicationTable.__table__.insert().values(**app_dict)
    await db.execute(stmt)
    await db.commit()
    return {"message": "Application added", "id": str(app_dict["id"])}

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
    try:
        app_uuid = uuid.UUID(app_id)
    except ValueError:
        raise HTTPException(400, "Invalid UUID format")
    stmt = ApplicationTable.__table__.delete().where(
        ApplicationTable.id == app_uuid,
        ApplicationTable.user_id == current_user["sub"]
    )
    res = await db.execute(stmt)
    await db.commit()
    if res.rowcount == 0:
        raise HTTPException(404, "Application not found")
    return {"message": "Deleted"}

@app.put("/applications/{app_id}")
async def update_application(
    app_id: str,
    app_data: JobApplication,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        app_uuid = uuid.UUID(app_id)
    except ValueError:
        raise HTTPException(400, "Invalid UUID format")
    stmt = select(ApplicationTable).where(
        ApplicationTable.id == app_uuid,
        ApplicationTable.user_id == current_user["sub"]
    )
    result = await db.execute(stmt)
    existing_app = result.scalar_one_or_none()
    
    if not existing_app:
        raise HTTPException(404, "Application not found")
    
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
    
    keywords = await extract_skills_with_gemini(text)
    ideal_skills = {"python", "react", "mongodb", "express", "nodejs", "git", "docker", "aws", "javascript", "typescript"}
    missing = [skill for skill in ideal_skills if skill not in [k.lower() for k in keywords]]
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

# ---------- Skill Gap Analyzer Endpoints ----------
@app.post("/api/job-descriptions")
async def create_job_description(
    jd_data: JobDescriptionCreate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    extracted_skills = await extract_skills_with_gemini(jd_data.job_description)
    
    new_jd = JobDescriptionTable(
        company_name=jd_data.company_name,
        role=jd_data.role,
        job_description=jd_data.job_description,
        extracted_skills=json.dumps(extracted_skills),
        extracted_keywords=",".join(extracted_skills),
        source_type="community",
        added_by_user_id=current_user["sub"],
        share_consent=jd_data.share_consent
    )
    db.add(new_jd)
    await db.commit()
    await db.refresh(new_jd)
    
    return {
        "id": str(new_jd.id),
        "extracted_skills": extracted_skills,
        "source_type": "community",
        "created_at": new_jd.created_at.isoformat() if new_jd.created_at else None
    }

@app.get("/api/job-descriptions/{company}/{role}")
async def get_job_description_by_company_role(
    company: str,
    role: str,
    db: AsyncSession = Depends(get_db)
):
    six_months_ago = datetime.utcnow() - timedelta(days=180)
    
    stmt = select(JobDescriptionTable).where(
        and_(
            JobDescriptionTable.company_name.ilike(company),
            JobDescriptionTable.role.ilike(role),
            JobDescriptionTable.source_type == "community",
            JobDescriptionTable.created_at >= six_months_ago,
            JobDescriptionTable.is_active == True
        )
    ).order_by(desc(JobDescriptionTable.created_at))
    
    result = await db.execute(stmt)
    community_jd = result.scalar_one_or_none()
    
    if community_jd:
        age_days = (datetime.utcnow() - community_jd.created_at).days
        return {
            "exists": True,
            "source_type": "community",
            "id": str(community_jd.id),
            "extracted_skills": json.loads(community_jd.extracted_skills),
            "created_at": community_jd.created_at.isoformat(),
            "age_days": age_days,
            "is_fresh": age_days < 30,
            "job_description": community_jd.job_description
        }
    
    estimated_skills = await get_company_skills_estimate(company, role)
    
    return {
        "exists": False,
        "source_type": "ai_estimate",
        "extracted_skills": estimated_skills.get("skills", []),
        "sample_problems": estimated_skills.get("sample_problems", []),
        "resources": estimated_skills.get("resources", []),
        "message": "These skills are AI-estimated. Paste a real JD for accurate results."
    }
# uvicorn main:app --reload --port 8000