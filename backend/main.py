import os
import uuid
import io
import json
import re
import asyncio
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from sqlalchemy import Column, String, DateTime, Text, desc, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.sql import select, and_
from dotenv import load_dotenv
from supabase import create_client, Client
from PyPDF2 import PdfReader
from collections import Counter
from ddgs import DDGS
import httpx
from urllib.parse import quote_plus
from opportunity_sources import gather_opportunity_listings
import csv
from datetime import datetime as dt

load_dotenv()

# ---------- Environment ----------
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# DuckDuckGo: completely free, no API key needed, no rate limits for normal use

if not all([SUPABASE_URL, SUPABASE_ANON_KEY, DATABASE_URL]):
    raise ValueError("Missing environment variables. Check .env file")

# ---------- Gemini Setup ----------
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

# ---------- Models ----------
class ApplicationTable(Base):
    __tablename__ = "applications"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True)
    company = Column(String)
    role = Column(String)
    status = Column(String)
    applied_date = Column(String)
    salary = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    job_description = Column(Text, nullable=True)
    jd_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UserResumeTable(Base):
    __tablename__ = "user_resumes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), index=True)
    resume_text = Column(Text)
    keywords = Column(Text)
    label = Column(String, nullable=True)  # e.g., "Updated October 2026" or "Razorpay SWE Intern"
    ats_score = Column(Integer, nullable=True)  # ATS score for this version
    score_diff = Column(Integer, nullable=True)  # Score difference from previous version
    is_tailored = Column(Boolean, default=False)  # True if this is a tailored version
    tailored_for_company = Column(String, nullable=True)  # Company name if tailored
    tailored_for_application_id = Column(UUID(as_uuid=True), nullable=True)  # Reference to application
    created_at = Column(DateTime, default=datetime.utcnow)

class JobDescriptionTable(Base):
    __tablename__ = "job_descriptions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name = Column(String, index=True)
    role = Column(String)
    job_description = Column(Text)
    extracted_skills = Column(ARRAY(Text))
    extracted_keywords = Column(ARRAY(Text))
    source_type = Column(String, default="community")
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    added_by_user_id = Column(UUID(as_uuid=True), nullable=True)
    times_used = Column(Integer, default=0)
    share_consent = Column(Boolean, default=False)

class JDFeedbackTable(Base):
    __tablename__ = "jd_feedback"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    jd_id = Column(UUID(as_uuid=True), nullable=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    is_accurate = Column(Boolean, nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class OpportunityTable(Base):
    __tablename__ = "opportunities"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False)
    company_name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    source_url = Column(String, nullable=False)
    source_platform = Column(String, nullable=True)
    trust_score = Column(Integer, default=100)
    match_percent = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class ReferralOutreachTable(Base):
    __tablename__ = "referral_outreach"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    application_id = Column(UUID(as_uuid=True), nullable=True)  # Links to applications table
    company = Column(String, nullable=False)
    role = Column(String, nullable=False)
    profile_url = Column(String, nullable=False)
    profile_name = Column(String, nullable=False)
    profile_college = Column(String, nullable=True)
    message_drafted = Column(Text, nullable=False)
    status = Column(String, default="Draft")  # Draft / Sent / Responded / Referred / Declined
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class CodingProfileTable(Base):
    __tablename__ = "coding_profiles"
    id = Column(Integer, primary_key=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    source = Column(String, nullable=False)  # "leetcode", "hackerrank", "manual", "combined"
    topic_counts = Column(Text, nullable=False)  # JSON: {"topic": count, ...}
    difficulty_breakdown = Column(Text, nullable=False)  # JSON: {"topic": {"easy": X, "medium": Y, "hard": Z}, ...}
    total_solved = Column(Integer, nullable=False)
    weekly_pace = Column(String, nullable=True)  # JSON: weekly solving pace in float
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Tables managed by Alembic — no manual creation
async def init_db():
    pass

# ---------- FastAPI ----------
app = FastAPI(title="CareerOS API")

def custom_json_serializer(obj):
    if isinstance(obj, uuid.UUID):
        return str(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

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

app.default_response_class = CustomJSONResponse

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://careeros-ny7q.vercel.app",
        "https://careeros-beta.vercel.app",
        "http://localhost:3000",
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
        user_id = uuid.UUID(user.id) if isinstance(user.id, str) else user.id
        return {"email": user.email, "sub": user_id}
    except Exception as e:
        print(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# ---------- Pydantic Models ----------
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

class JobDescriptionUpdate(BaseModel):
    job_description: str
    share_consent: Optional[bool] = None

class OpportunitySearchRequest(BaseModel):
    keywords: Optional[List[str]] = None   # if None, auto-pulled from resume
    platforms: Optional[List[str]] = None  # filter by platform
    opportunity_type: Optional[str] = "all"  # all, internship, hackathon, job

class TrackOpportunityRequest(BaseModel):
    company_name: str
    role: str
    source_url: str
    source_platform: Optional[str] = None
    description: Optional[str] = None
    trust_score: Optional[int] = 100
    match_percent: Optional[int] = 0

class DraftMessageRequest(BaseModel):
    profile_name: str
    profile_college: Optional[str] = None
    profile_yoe: Optional[int] = None
    company: str
    role: str
    user_name: str
    user_college: str
    user_project: Optional[str] = "CareerOS"

class TrackReferralRequest(BaseModel):
    application_id: Optional[str] = None
    company: str
    role: str
    profile_url: str
    profile_name: str
    profile_college: Optional[str] = None
    message_drafted: str

class UpdateReferralStatusRequest(BaseModel):
    status: str  # Draft / Sent / Responded / Referred / Declined

class ReferralProfile(BaseModel):
    name: str
    college: Optional[str] = None
    yoe_estimate: Optional[int] = None
    url: str
    snippet: str
    tier: int  # 1, 2, 3 for ranking

# ---------- Helper Functions ----------
IDEAL_SKILLS = {
    "python", "react", "mongodb", "express", "nodejs", "git",
    "docker", "aws", "javascript", "typescript",
}

SKILL_ALIASES = {
    "python": ["python"],
    "react": ["react", "next.js", "nextjs"],
    "mongodb": ["mongodb", "mongo"],
    "express": ["express"],
    "nodejs": ["nodejs", "node.js", "node js"],
    "git": ["git", "github"],
    "docker": ["docker"],
    "aws": ["aws"],
    "javascript": ["javascript"],
    "typescript": ["typescript"],
}

# Display name -> lowercase aliases scanned in resume text
RESUME_SKILL_CATALOG = [
    ("Python", ["python"]),
    ("JavaScript", ["javascript"]),
    ("TypeScript", ["typescript"]),
    ("C++", ["c++"]),
    ("Java", ["java"]),
    ("React", ["react"]),
    ("Next.js", ["next.js", "nextjs"]),
    ("Node.js", ["node.js", "nodejs"]),
    ("Express", ["express"]),
    ("FastAPI", ["fastapi"]),
    ("SQLAlchemy", ["sqlalchemy"]),
    ("PostgreSQL", ["postgresql", "postgres"]),
    ("MongoDB", ["mongodb", "mongo"]),
    ("Supabase", ["supabase"]),
    ("SQL", [" sql", "sql "]),
    ("HTML", ["html"]),
    ("CSS", ["css"]),
    ("Tailwind CSS", ["tailwind"]),
    ("Git", ["git", "github"]),
    ("Docker", ["docker"]),
    ("AWS", ["aws"]),
    ("Vercel", ["vercel"]),
    ("Render", ["render"]),
    ("Gemini", ["gemini"]),
    ("Machine Learning", ["machine learning"]),
]

def _skill_alias_present(alias: str, haystack: str) -> bool:
    alias = alias.strip().lower()
    if not alias:
        return False
    if alias.startswith(" "):
        return alias in haystack
    pattern = r"(?<![a-z0-9+.#\-])" + re.escape(alias) + r"(?![a-z0-9+.#\-])"
    return bool(re.search(pattern, haystack, re.IGNORECASE))

def extract_skills_from_text(text: str) -> List[str]:
    """Detect known tech skills from resume text (used when Gemini is unavailable)."""
    haystack = f" {text.lower()} "
    found: List[str] = []
    seen: set = set()
    for display_name, aliases in RESUME_SKILL_CATALOG:
        if any(_skill_alias_present(alias, haystack) for alias in aliases):
            key = display_name.lower()
            if key not in seen:
                seen.add(key)
                found.append(display_name)
    return found

def merge_skill_lists(*lists: List[str]) -> List[str]:
    merged: List[str] = []
    seen: set = set()
    for skills in lists:
        for skill in skills:
            key = skill.strip().lower()
            if key and key not in seen:
                seen.add(key)
                merged.append(skill.strip())
    return merged

def calculate_resume_ats_score(keywords: List[str], text: str):
    """
    Score resume against a common full-stack ideal stack.
    Matches against extracted keywords AND full resume text so skills
    listed in the PDF still count when Gemini is unavailable.
    """
    haystack = text.lower() + " " + " ".join(k.lower() for k in keywords)
    matched: List[str] = []
    missing: List[str] = []
    for skill in sorted(IDEAL_SKILLS):
        aliases = SKILL_ALIASES.get(skill, [skill])
        if any(_skill_alias_present(alias, haystack) for alias in aliases):
            matched.append(skill)
        else:
            missing.append(skill)
    score = max(0, 100 - len(missing) * 8)
    return score, matched, missing

def extract_keywords(text: str, top_n: int = 20):
    words = text.lower().split()
    stopwords = {
        "the","and","for","with","experience","skills","of","to","in","that","is","are",
        "was","were","a","an","on","at","by","be","this","from","as","i","you","we","they",
        "your","our","their","have","has","had","will","would","could","should","may",
        "might","must","also","etc","via"
    }
    words = [
        re.sub(r'[^a-z]', '', w)
        for w in words
        if len(w) > 2 and w not in stopwords and re.match(r'^[a-z]+$', w)
    ]
    counter = Counter(words)
    return [w for w, _ in counter.most_common(top_n)]

def calculate_match(resume_keywords: List[str], job_keywords: List[str]):
    resume_set = set(resume_keywords)
    job_set = set(job_keywords)
    matched = resume_set.intersection(job_set)
    missing = job_set - resume_set
    match_percent = len(matched) / len(job_set) * 100 if job_set else 0
    return round(match_percent), list(missing)

def calculate_trust_score(title: str, snippet: str, url: str) -> int:
    """
    Rule-based trust scoring. No AI needed — simple pattern matching.
    Start at 100, subtract for red flags, add for trusted platforms.
    """
    trust = 100
    text = (title + " " + snippet).lower()
    url_lower = url.lower()

    # Red flags — deduct points
    payment_flags = ["registration fee", "pay to apply", "deposit required", "fee required", "pay fee"]
    if any(flag in text for flag in payment_flags):
        trust -= 40

    urgency_flags = ["apply in 24 hours", "limited seats", "hurry", "act now", "immediate joining"]
    if any(flag in text for flag in urgency_flags):
        trust -= 15

    # Unrealistic salary for freshers
    if ("no experience" in text or "fresher" in text) and any(x in text for x in ["10 lpa", "15 lpa", "20 lpa"]):
        trust -= 20

    # Suspicious domains
    suspicious_domains = ["blogspot", "wordpress", "freejob", ".tk", ".ml", ".cf", "bit.ly"]
    if any(dom in url_lower for dom in suspicious_domains):
        trust -= 25

    # No company info in snippet
    if len(snippet.strip()) < 50:
        trust -= 10

    # Trusted platforms — add points
    trusted_domains = ["unstop.com", "internshala.com", "linkedin.com", "wellfound.com", "hackerearth.com", "naukri.com"]
    if any(dom in url_lower for dom in trusted_domains):
        trust += 30

    return max(0, min(100, trust))

def is_opportunity_closed(title: str, snippet: str, source: str = "web_search") -> bool:
    """
    Detect if an opportunity listing is closed or registration expired.
    Context-aware: RSS/APIs are trusted as live; only filter web_search aggressively.
    """
    # Trust RSS feeds and official APIs — they only show CURRENT opportunities
    if source in ["rss_unstop", "rss_hackerearth", "rss_github", "remotive", "adzuna", "jsearch"]:
        return False  # These sources are live by definition
    
    # For Internshala and web search, use keyword matching
    text = (title + " " + snippet).lower()
    
    # HIGH CONFIDENCE closed indicators only (very specific phrases)
    VERY_STRONG_CLOSED = [
        "registration closed", "applications closed", "registrations closed",
        "applications closed", "hiring closed", "recruitment closed",
        "no longer accepting", "not accepting applications", "not accepting registrations",
        "closed", "ended", "expired",
    ]
    
    # Check for strong indicators - multiple words in phrase
    for indicator in VERY_STRONG_CLOSED:
        if indicator in text:
            return True
    
    # Pattern: Status indicators
    import re
    status_pattern = r"(?:status|marked)\s*(?:as)?\s*(?:closed|expired|archived|ended)"
    if re.search(status_pattern, text, re.IGNORECASE):
        return True
    
    return False

def extract_registration_deadline(title: str, snippet: str, source: str = "web_search") -> Optional[str]:
    """
    Extract registration/application deadline from title and snippet.
    Returns date string or None if not found.
    ONLY returns deadline if the opportunity is OPEN (not closed).
    Context-aware: trusts RSS/API sources as live.
    """
    import re
    
    # First check if it's closed - if yes, return None (don't show deadline)
    # Pass source for context-aware filtering
    if is_opportunity_closed(title, snippet, source):
        return None
    
    text = f"{title} {snippet}"
    
    # Enhanced patterns to catch various deadline formats
    patterns = [
        # "Deadline: May 31", "Closes: June 15", "Apply by: 31 May"
        r"(?:deadline|closes?|apply by|register by|registration closes?|last date|last day|closing date)[\s:]*([a-z]+\s+\d{1,2}(?:\s*,?\s*\d{4})?)",
        # "31-05-2024" or "31/5/2024" or "5-31"
        r"(?:deadline|closes?|apply by|register by|registration closes?|last date|last day|closing date)[\s:]*(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)",
        # Bare dates: "May 31", "15 June", "31st May"
        r"\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)(?:\s+\d{4})?)\b",
        # "May 31" variant
        r"\b((?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2}(?:\s*,?\s*\d{4})?)\b",
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            date_str = match.group(1).strip()
            # Clean up the date string
            date_str = re.sub(r'\s+', ' ', date_str)  # Remove extra spaces
            return date_str
    
    return None

def detect_platform(url: str) -> Optional[str]:
    """Detect source platform from URL."""
    url_lower = url.lower()
    platforms = {
        "unstop": "Unstop",
        "internshala": "Internshala",
        "linkedin": "LinkedIn",
        "wellfound": "Wellfound",
        "naukri": "Naukri",
        "github": "GitHub",
        "hackerearth": "HackerEarth"
    }
    for key, name in platforms.items():
        if key in url_lower:
            return name
    return None

def calculate_match_from_snippet(resume_keywords: List[str], title: str, snippet: str) -> int:
    """Match resume keywords against job title and snippet."""
    if not resume_keywords:
        return 0
    combined_text = (title + " " + snippet).lower()
    matched = [kw for kw in resume_keywords if kw.lower() in combined_text]
    return int((len(matched) / len(resume_keywords)) * 100) if resume_keywords else 0

async def extract_skills_with_gemini(text: str) -> tuple[List[str], str]:
    """
    Extract technical skills from resume text.
    Returns (skills, source) where source is 'gemini' or 'text_scan'.
    Always merges text-based detection so keywords stay accurate without AI.
    """
    text_skills = extract_skills_from_text(text)

    if genai_client is None:
        return text_skills, "text_scan"

    try:
        prompt = f"""
Extract SPECIFIC technical skills from the following text.
Return ONLY a JSON array of skill names, nothing else.

Rules:
- Only list concrete technologies, languages, frameworks, libraries, platforms (e.g., "React", "Python", "AWS")
- Do NOT include soft skills like "Problem Solving", "Communication", "Teamwork"
- Do NOT include generic words like "backend", "frontend", "architecture"
- Limit to 5-10 most important skills

Text: {text[:3000]}

Example good output: ["React", "Node.js", "PostgreSQL", "AWS", "Docker", "TypeScript"]
Output:"""

        response = genai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        json_match = re.search(r'\[.*\]', response.text, re.DOTALL)
        if json_match:
            skills = json.loads(json_match.group())
            banned = {
                "problem solving", "communication", "teamwork", "leadership",
                "backend", "frontend", "architecture", "work", "support",
                "knowledge", "understanding", "models", "optimize", "api", "apis"
            }
            gemini_skills = [s for s in skills if s.lower() not in banned][:15]
            return merge_skill_lists(gemini_skills, text_skills), "gemini"
        return text_skills, "text_scan"
    except Exception as e:
        print(f"Gemini skill extraction error: {e}")
        return text_skills, "text_scan"

async def tailor_resume_with_gemini(resume_text: str, job_description: str, company_name: str) -> str:
    """
    Tailor resume for a specific job using Gemini.
    Returns the tailored resume text.
    """
    if genai_client is None:
        raise Exception("Gemini AI not configured")

    try:
        prompt = f"""
You are an expert career coach helping tailor a resume for a specific job application.

IMPORTANT INSTRUCTIONS:
1. Rewrite resume content to highlight skills and experiences matching the job description
2. Keep all real experience and achievements - do NOT fabricate anything
3. Change only the presentation and emphasis of real experience
4. Use keywords from the job description where relevant
5. Maintain professional formatting and clarity
6. Keep it truthful and honest - this is crucial
7. Make the resume compelling but factual

COMPANY: {company_name}

ORIGINAL RESUME:
{resume_text}

JOB DESCRIPTION:
{job_description}

Please provide the tailored resume (text only, no markdown):"""

        # Add timeout to prevent hanging
        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: genai_client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=prompt
                )
            ),
            timeout=60.0  # 60 second timeout
        )
        tailored_text = response.text.strip()
        return tailored_text
    except asyncio.TimeoutError:
        print("Gemini tailoring timed out after 60 seconds")
        raise Exception("Resume tailoring took too long. Please try again.")
    except Exception as e:
        print(f"Gemini tailoring error: {e}")
        raise

def calculate_keyword_match_percent(resume_text: str, job_description: str) -> float:
    """Calculate percentage of job keywords found in resume."""
    resume_keywords_list = extract_skills_from_text(resume_text)
    job_keywords_list = extract_skills_from_text(job_description)
    
    if not job_keywords_list:
        return 0.0
    
    matched = sum(1 for kw in job_keywords_list if any(
        kw.lower() in resume_text.lower() or 
        extract_skills_from_text(kw) 
        for _ in [1]
    ))
    
    return (matched / len(job_keywords_list)) * 100 if job_keywords_list else 0.0

LOW_VALUE_SEARCH_DOMAINS = {
    "wikipedia.org",
    "geeksforgeeks.org",
    "youtube.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
}

def _parse_ddg_result(row: dict) -> Optional[dict]:
    url = row.get("href", "") or row.get("link", "") or row.get("url", "")
    if not url:
        return None
    return {
        "title": row.get("title", ""),
        "snippet": row.get("body", "") or row.get("snippet", "") or row.get("description", ""),
        "url": url,
    }

def _run_ddg_search(query: str, region: str, max_results: int, timelimit: Optional[str] = None) -> List[dict]:
    results: List[dict] = []
    kwargs = {
        "query": query,
        "region": region,
        "safesearch": "moderate",
        "max_results": max_results,
    }
    if timelimit:
        kwargs["timelimit"] = timelimit

    try:
        client = DDGS()
        rows = client.text(**kwargs)
        rows = list(rows) if rows is not None else []
        for row in rows:
            parsed = _parse_ddg_result(row)
            if parsed:
                results.append(parsed)
        if results:
            return results
    except Exception as e:
        print(f"ddgs package search failed: {e}")

    return results

async def search_duckduckgo(query: str, max_results: int = 10) -> List[dict]:
    """Search DuckDuckGo for job/internship listings (free, no API key)."""
    try:
        loop = asyncio.get_running_loop()
        for region, timelimit in [("in-en", None), ("wt-wt", None), ("in-en", "y")]:
            results = await loop.run_in_executor(
                None, lambda r=region, t=timelimit: _run_ddg_search(query, r, max_results, t)
            )
            filtered = [
                r for r in results
                if not any(d in r["url"].lower() for d in LOW_VALUE_SEARCH_DOMAINS)
            ]
            if filtered:
                return filtered
            if results:
                return results
        return []
    except Exception as e:
        print(f"DuckDuckGo search error for '{query[:60]}...': {e}")
        return []

VALID_OPPORTUNITY_TYPES = {
    "all",
    "internship",
    "internship_software",
    "internship_ai_ml",
    "internship_data",
    "internship_web",
    "internship_mobile",
    "internship_devops",
    "hackathon",
    "job",
    "job_fresher",
}

# Maps filter -> extra search phrases appended to resume keywords
OPPORTUNITY_CATEGORY_TERMS = {
    "internship": ["internship"],
    "internship_software": ["software development internship", "SDE intern", "backend intern"],
    "internship_ai_ml": ["AI internship", "machine learning intern", "deep learning intern"],
    "internship_data": ["data science internship", "data analyst intern"],
    "internship_web": ["web development internship", "frontend intern", "full stack intern"],
    "internship_mobile": ["android internship", "mobile app development intern", "iOS intern"],
    "internship_devops": ["devops internship", "cloud engineering intern", "SRE intern"],
    "hackathon": ["hackathon", "coding competition"],
    "job": ["fresher job", "graduate job"],
    "job_fresher": ["fresher", "entry level", "graduate trainee"],
}

def resolve_resume_keywords(latest_resume: UserResumeTable) -> List[str]:
    """Use stored keywords and refresh from resume text when possible."""
    stored = [kw.strip() for kw in (latest_resume.keywords or "").split(",") if kw.strip()]
    if latest_resume.resume_text:
        refreshed = extract_skills_from_text(latest_resume.resume_text)
        merged = merge_skill_lists(stored, refreshed)
        if merged:
            return merged[:15]
    return stored

def _keyword_search_fragment(keywords: List[str]) -> str:
    top = keywords[:3] if keywords else ["software", "developer"]
    return " ".join(top)

def build_opportunity_queries(keywords: List[str], opportunity_type: str = "all") -> List[str]:
    """Short, proven DuckDuckGo queries (long site: queries often return 0 on servers)."""
    if opportunity_type not in VALID_OPPORTUNITY_TYPES:
        opportunity_type = "all"

    kw = _keyword_search_fragment(keywords)
    year = datetime.utcnow().year
    queries: List[str] = []

    internship_types = {
        "all", "internship", "internship_software", "internship_ai_ml",
        "internship_data", "internship_web", "internship_mobile", "internship_devops",
    }

    if opportunity_type in internship_types:
        queries.extend([
            f"internshala {kw} internship India {year}",
            f"unstop {kw} internship India",
            f"linkedin {kw} internship India",
            f"{kw} internship India students",
        ])

    if opportunity_type in ["all", "hackathon"]:
        queries.extend([
            f"unstop hackathon {kw} {year}",
            f"hackerearth hackathon {kw}",
        ])

    if opportunity_type in {"all", "job", "job_fresher"}:
        queries.extend([
            f"naukri {kw} fresher job India",
            f"linkedin {kw} fresher India",
        ])

    return queries[:8]

def build_fallback_opportunity_queries(keywords: List[str], opportunity_type: str) -> List[str]:
    kw = _keyword_search_fragment(keywords)
    return [
        f"internshala internship {kw}",
        f"{kw} internship openings India",
        f"{kw} hiring fresher India",
    ]

INTERSHALA_SLUG_BY_SKILL = {
    "python": "python",
    "javascript": "javascript",
    "typescript": "web-development",
    "react": "web-development",
    "next.js": "web-development",
    "nextjs": "web-development",
    "fastapi": "python",
    "java": "java",
    "c++": "computer-science",
    "sql": "computer-science",
    "postgresql": "computer-science",
    "mongodb": "computer-science",
    "machine learning": "machine-learning",
    "ai": "machine-learning",
}

INTERSHALA_SLUG_BY_FILTER = {
    "internship_software": "computer-science",
    "internship_ai_ml": "machine-learning",
    "internship_data": "data-science",
    "internship_web": "web-development",
    "internship_mobile": "android-app-development",
    "internship_devops": "cloud-computing",
}

def _internshala_slug(keywords: List[str], opportunity_type: str) -> str:
    for kw in keywords:
        slug = INTERSHALA_SLUG_BY_SKILL.get(kw.lower().strip())
        if slug:
            return slug
    return INTERSHALA_SLUG_BY_FILTER.get(opportunity_type, "computer-science")

def _linkedin_search_url(keywords: List[str], role_hint: str) -> str:
    query = quote_plus(f"{' '.join(keywords[:3])} {role_hint} India")
    return f"https://www.linkedin.com/jobs/search/?keywords={query}&location=India"

def build_curated_platform_opportunities(
    keywords: List[str],
    opportunity_type: str,
) -> List[dict]:
    """
    Direct links to trusted job boards — always available even when DuckDuckGo is blocked.
    """
    skill_label = ", ".join(keywords[:4]) if keywords else "software"
    slug = _internshala_slug(keywords, opportunity_type)
    q = quote_plus(" ".join(keywords[:3]))
    curated: List[dict] = []

    internship_types = {
        "all", "internship", "internship_software", "internship_ai_ml",
        "internship_data", "internship_web", "internship_mobile", "internship_devops",
    }

    if opportunity_type in internship_types:
        curated.extend([
            {
                "title": f"{keywords[0] if keywords else 'Tech'} Internships on Internshala",
                "snippet": f"Browse active internships matching your skills: {skill_label}.",
                "url": f"https://internshala.com/internships/{slug}-internship/",
                "platform": "Internshala",
                "curated": True,
            },
            {
                "title": "Internships on Unstop",
                "snippet": f"Competitions and internships for {skill_label} on Unstop.",
                "url": "https://unstop.com/internships",
                "platform": "Unstop",
                "curated": True,
            },
            {
                "title": f"LinkedIn — {skill_label} Internships",
                "snippet": "Search internship listings on LinkedIn filtered to India.",
                "url": _linkedin_search_url(keywords, "internship"),
                "platform": "LinkedIn",
                "curated": True,
            },
            {
                "title": f"Wellfound — Startup roles ({keywords[0] if keywords else 'developer'})",
                "snippet": "Early-stage startup internships and junior roles.",
                "url": f"https://wellfound.com/role/l/{quote_plus(keywords[0].lower() if keywords else 'software-engineer')}",
                "platform": "Wellfound",
                "curated": True,
            },
        ])

    if opportunity_type in ["all", "hackathon"]:
        curated.extend([
            {
                "title": "Hackathons on Unstop",
                "snippet": f"Hackathons and coding contests for {skill_label}.",
                "url": "https://unstop.com/hackathons",
                "platform": "Unstop",
                "curated": True,
            },
            {
                "title": "HackerEarth Challenges",
                "snippet": "Live hackathons and hiring challenges.",
                "url": "https://www.hackerearth.com/challenges/",
                "platform": "HackerEarth",
                "curated": True,
            },
        ])

    if opportunity_type in {"all", "job", "job_fresher"}:
        primary = (keywords[0] if keywords else "software").lower().replace(" ", "-")
        curated.extend([
            {
                "title": f"Naukri — Fresher {keywords[0] if keywords else 'Tech'} Jobs",
                "snippet": f"Fresher job listings in India for {skill_label}.",
                "url": f"https://www.naukri.com/{primary}-jobs",
                "platform": "Naukri",
                "curated": True,
            },
            {
                "title": f"LinkedIn — Fresher {skill_label} Jobs",
                "snippet": "Entry-level and graduate roles on LinkedIn.",
                "url": _linkedin_search_url(keywords, "fresher"),
                "platform": "LinkedIn",
                "curated": True,
            },
        ])

    return curated

_ddg_semaphore = asyncio.Semaphore(3)

async def _search_with_limit(query: str, max_results: int) -> List[dict]:
    async with _ddg_semaphore:
        return await search_duckduckgo(query, max_results=max_results)

async def collect_search_results(queries: List[str], max_per_query: int = 8) -> List[dict]:
    """Run DuckDuckGo queries in parallel and dedupe by URL."""
    if not queries:
        return []

    batches = await asyncio.gather(
        *[_search_with_limit(q, max_per_query) for q in queries],
        return_exceptions=True,
    )

    all_raw: List[dict] = []
    seen_urls: set = set()
    for batch in batches:
        if isinstance(batch, Exception):
            print(f"Query batch error: {batch}")
            continue
        for item in batch:
            url = item.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                all_raw.append(item)
    return all_raw

def score_opportunity_results(
    raw_results: List[dict],
    resume_keywords: List[str],
    opportunity_type: str,
    min_trust: int = 15,
) -> List[dict]:
    scored_results = []
    closed_count = 0
    low_trust_count = 0
    
    for item in raw_results:
        title = item.get("title", "")
        snippet = item.get("snippet", "")
        url = item.get("url", "")
        source = item.get("source", "web_search")  # Get source type
        
        if not url:
            continue

        # Skip closed opportunities (pass source for context-aware filtering)
        if is_opportunity_closed(title, snippet, source):
            closed_count += 1
            print(f"[FILTERED CLOSED] {title[:50]} (source: {source})")
            continue

        match_percent = calculate_match_from_snippet(resume_keywords, title, snippet)
        trust_score = calculate_trust_score(title, snippet, url)
        if trust_score < min_trust:
            low_trust_count += 1
            continue

        # Extract deadline, passing source for context-aware filtering
        registration_deadline = extract_registration_deadline(title, snippet, source)

        scored_results.append({
            "title": title,
            "snippet": snippet,
            "url": url,
            "platform": item.get("platform") or detect_platform(url),
            "match_percent": match_percent,
            "trust_score": trust_score,
            "trust_label": "High" if trust_score >= 70 else "Medium" if trust_score >= 40 else "Low",
            "opportunity_type": opportunity_type,
            "source": source,
            "registration_deadline": registration_deadline,
        })

    print(f"[SCORING SUMMARY] Raw: {len(raw_results)}, Closed filtered: {closed_count}, Low trust: {low_trust_count}, Final: {len(scored_results)}")
    scored_results.sort(key=lambda x: (x["match_percent"], x["trust_score"]), reverse=True)
    return scored_results

async def generate_study_plan_with_gemini(
    weak_topics: List[dict],
    company: str,
    role: str,
    weeks: int
) -> str:
    """Generate study plan using Gemini — completely free tier."""
    if genai_client is None:
        plan = f"Study plan for {company} {role} ({weeks} weeks):\n\n"
        for i, topic in enumerate(weak_topics[:weeks], 1):
            plan += f"Week {i}: Focus on {topic['topic']} — solve 8-10 medium problems\n"
        return plan

    topics_text = "\n".join([
        f"- {t['topic']}: appears in {t['company_frequency']}% of {company} interviews"
        for t in weak_topics
    ])

    prompt = f"""A student is preparing for {company} {role} interview. They have {weeks} weeks.

Their weakest DSA topics based on real interview data:
{topics_text}

Generate a specific week-by-week study plan. For each week:
- Primary topic to focus on
- 3 specific LeetCode problems by name
- One free resource (YouTube or article)
- Daily time commitment

Keep it practical and specific. Maximum 300 words."""

    try:
        response = genai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        return response.text
    except Exception as e:
        print(f"Gemini study plan error: {e}")
        return f"Focus on {weak_topics[0]['topic']} first — it appears most frequently in {company} interviews."

# ---------- Startup ----------
@app.on_event("startup")
async def startup():
    await init_db()

@app.get("/")
async def root():
    return {
        "status": "CareerOS API running",
        "version": "2.1",
        "search_provider": "Internshala + web search + job APIs",
    }

# ---------- Auth Endpoints ----------
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

# ---------- Application Endpoints ----------
@app.post("/applications/")
async def create_application(
    app_data: JobApplication,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    print(f"➕ CREATE: New app for user {current_user['sub']}: {app_data.company}")
    
    # Use ORM-style insert for consistency
    app_id = uuid.uuid4()
    new_app = ApplicationTable(
        id=app_id,
        user_id=current_user["sub"],
        company=app_data.company,
        role=app_data.role,
        status=app_data.status,
        applied_date=app_data.applied_date,
        salary=app_data.salary,
        notes=app_data.notes,
        job_description=app_data.job_description
    )
    db.add(new_app)
    try:
        await db.flush()
        await db.commit()
        await db.refresh(new_app)
        print(f"✅ CREATE: Added app {app_id}")
    except Exception as e:
        print(f"❌ CREATE ERROR: {e}")
        await db.rollback()
        raise HTTPException(500, f"Database error: {str(e)}")
    
    return {"message": "Application added", "id": str(app_id)}

@app.get("/applications/")
async def get_applications(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        ApplicationTable.__table__.select().where(
            ApplicationTable.user_id == current_user["sub"]
        ).order_by(desc(ApplicationTable.created_at))
    )
    apps = result.fetchall()
    return [dict(app._mapping) for app in apps]

@app.delete("/applications/{app_id}")
async def delete_application(
    app_id: str,
    current_user=Depends(get_current_user),
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
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        app_uuid = uuid.UUID(app_id)
    except ValueError:
        raise HTTPException(400, "Invalid UUID format")

    print(f"🔄 UPDATE: Fetching app {app_id} for user {current_user['sub']}")
    
    stmt = select(ApplicationTable).where(
        and_(
            ApplicationTable.id == app_uuid,
            ApplicationTable.user_id == current_user["sub"]
        )
    )
    result = await db.execute(stmt)
    existing_app = result.scalar_one_or_none()
    if not existing_app:
        print(f"❌ UPDATE: App not found - {app_id}")
        raise HTTPException(404, "Application not found")

    print(f"✏️  UPDATE: Updating app {app_id} with: company={app_data.company}, jd_len={len(app_data.job_description or '')}")
    
    existing_app.company = app_data.company
    existing_app.role = app_data.role
    existing_app.status = app_data.status
    existing_app.applied_date = app_data.applied_date
    existing_app.salary = app_data.salary
    existing_app.notes = app_data.notes
    existing_app.job_description = app_data.job_description
    existing_app.updated_at = datetime.utcnow()
    
    try:
        await db.flush()  # Flush to catch any database errors
        await db.commit()
        # Refresh to get any database-generated values
        await db.refresh(existing_app)
        print(f"✅ UPDATE: Successfully committed app {app_id}")
    except Exception as e:
        print(f"❌ UPDATE COMMIT ERROR: {e}")
        await db.rollback()
        raise HTTPException(500, f"Database error: {str(e)}")
    
    return {
        "message": "Application updated", 
        "id": app_id,
        "company": existing_app.company,
        "job_description": existing_app.job_description[:50] + "..." if existing_app.job_description and len(existing_app.job_description) > 50 else existing_app.job_description
    }

# ---------- Resume Endpoints ----------
@app.post("/resume/analyze")
async def analyze_resume(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    content = await file.read()
    pdf = PdfReader(io.BytesIO(content))
    text = "".join(page.extract_text() or "" for page in pdf.pages)

    if len(text.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="Could not read enough text from this PDF. Export a text-based PDF (not a scanned image) and try again.",
        )

    keywords, analysis_source = await extract_skills_with_gemini(text)
    score, matched, missing = calculate_resume_ats_score(keywords, text)

    # Get previous version to calculate score_diff
    stmt = select(UserResumeTable).where(
        UserResumeTable.user_id == current_user["sub"]
    ).order_by(desc(UserResumeTable.created_at))
    result = await db.execute(stmt)
    previous_resume = result.scalars().first()
    
    score_diff = None
    if previous_resume and previous_resume.ats_score is not None:
        score_diff = score - previous_resume.ats_score

    # Generate a label with current date
    current_date = datetime.utcnow()
    label = f"Version {current_date.strftime('%d %B %Y')}"

    new_resume = UserResumeTable(
        user_id=current_user["sub"],
        resume_text=text,
        keywords=",".join(keywords),
        ats_score=score,
        score_diff=score_diff,
        label=label,
        is_tailored=False
    )
    db.add(new_resume)
    await db.commit()

    return {
        "score": score,
        "keywords": keywords,
        "matched": matched,
        "missing": missing,
        "text_preview": text[:500],
        "analysis_source": analysis_source,
    }

@app.get("/resume/versions")
async def get_resume_versions(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all resume versions for the current user, ordered newest first."""
    stmt = select(UserResumeTable).where(
        UserResumeTable.user_id == current_user["sub"]
    ).order_by(desc(UserResumeTable.created_at))
    result = await db.execute(stmt)
    versions = result.scalars().all()
    
    return [
        {
            "id": str(v.id),
            "label": v.label or "Untitled Version",
            "ats_score": v.ats_score,
            "score_diff": v.score_diff,
            "upload_date": v.created_at.strftime("%d %b %Y") if v.created_at else "",
            "is_tailored": v.is_tailored,
            "tailored_for_company": v.tailored_for_company,
            "created_at": v.created_at.isoformat()
        }
        for v in versions
    ]

class TailorRequest(BaseModel):
    resume_version_id: str
    job_description: str
    company_name: str
    application_id: Optional[str] = None

@app.post("/resume/tailor")
async def tailor_resume(
    request: TailorRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Tailor a resume for a specific company and job."""
    try:
        # Validate input
        if not request.resume_version_id:
            raise HTTPException(400, "Resume version ID is required")
        if not request.job_description or not request.job_description.strip():
            raise HTTPException(400, "Job description is required")
        if not request.company_name or not request.company_name.strip():
            raise HTTPException(400, "Company name is required")
        
        try:
            version_uuid = uuid.UUID(request.resume_version_id)
        except ValueError:
            raise HTTPException(400, "Invalid version ID format")
        
        # Get the resume version
        stmt = select(UserResumeTable).where(
            and_(
                UserResumeTable.id == version_uuid,
                UserResumeTable.user_id == current_user["sub"]
            )
        )
        result = await db.execute(stmt)
        resume_version = result.scalar_one_or_none()
        
        if not resume_version:
            raise HTTPException(404, "Resume version not found")
        
        if not resume_version.resume_text or not resume_version.resume_text.strip():
            raise HTTPException(400, "Resume version is empty")
        
        # Call Gemini to tailor the resume
        try:
            tailored_text = await tailor_resume_with_gemini(
                resume_version.resume_text,
                request.job_description,
                request.company_name
            )
        except Exception as e:
            error_msg = str(e)
            print(f"Gemini API error: {error_msg}")
            
            # Check for rate limit/quota errors
            if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                raise HTTPException(
                    status_code=429,
                    detail="AI quota exceeded. Please try again in a few hours."
                )
            
            raise HTTPException(500, f"Failed to generate tailored resume: {error_msg}")
        
        # Calculate match scores
        original_match = calculate_keyword_match_percent(resume_version.resume_text, request.job_description)
        tailored_match = calculate_keyword_match_percent(tailored_text, request.job_description)
        
        return {
            "original_resume": resume_version.resume_text,
            "tailored_resume": tailored_text,
            "original_match": round(original_match),
            "tailored_match": round(tailored_match),
            "match_improvement": round(tailored_match - original_match),
            "company_name": request.company_name
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in tailor_resume: {e}")
        raise HTTPException(500, "An unexpected error occurred while tailoring your resume")

class SaveTailoredResumeRequest(BaseModel):
    tailored_text: str
    company_name: str
    original_match: int
    tailored_match: int
    application_id: Optional[str] = None

@app.post("/resume/save-tailored")
async def save_tailored_resume(
    request: SaveTailoredResumeRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Save a tailored resume as a new version."""
    # Extract keywords from tailored resume
    keywords, _ = await extract_skills_with_gemini(request.tailored_text)
    score, _, _ = calculate_resume_ats_score(keywords, request.tailored_text)
    
    # Calculate score_diff from previous version
    stmt = select(UserResumeTable).where(
        UserResumeTable.user_id == current_user["sub"]
    ).order_by(desc(UserResumeTable.created_at))
    result = await db.execute(stmt)
    previous_resume = result.scalars().first()
    
    score_diff = None
    if previous_resume and previous_resume.ats_score is not None:
        score_diff = score - previous_resume.ats_score
    
    # Get application ID if provided
    application_id = None
    if request.application_id:
        try:
            application_id = uuid.UUID(request.application_id)
        except ValueError:
            pass
    
    # Create new tailored version
    label = f"{request.company_name} • {datetime.utcnow().strftime('%d %b %Y')}"
    
    new_resume = UserResumeTable(
        user_id=current_user["sub"],
        resume_text=request.tailored_text,
        keywords=",".join(keywords),
        ats_score=score,
        score_diff=score_diff,
        label=label,
        is_tailored=True,
        tailored_for_company=request.company_name,
        tailored_for_application_id=application_id
    )
    db.add(new_resume)
    await db.commit()
    
    return {
        "message": "Tailored resume saved",
        "id": str(new_resume.id),
        "label": label,
        "ats_score": score,
        "score_diff": score_diff
    }

@app.post("/job/match")
async def match_job(
    request: JobMatchRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get match percentage between resume and job."""
    if request.resume_text:
        resume_text = request.resume_text
    else:
        stmt = select(UserResumeTable).where(
            UserResumeTable.user_id == current_user["sub"]
        ).order_by(desc(UserResumeTable.created_at))
        result = await db.execute(stmt)
        latest_resume = result.scalars().first()
        if not latest_resume:
            raise HTTPException(400, "No resume found. Please upload a resume first.")
        resume_text = latest_resume.resume_text

    resume_keywords = extract_skills_from_text(resume_text)
    job_keywords = extract_skills_from_text(request.job_description)
    match_percent, missing_keywords = calculate_match(resume_keywords, job_keywords)

    suggestions = []
    if match_percent < 50:
        suggestions.append("Low match. Your resume shares few keywords with this job. Add relevant skills.")
    elif match_percent < 75:
        suggestions.append("Decent match. Adding missing keywords will improve your chances.")
    else:
        suggestions.append("Great match. Your resume aligns well with this role.")

    if missing_keywords:
        suggestions.append(f"Consider adding: {', '.join(missing_keywords[:5])}")

    return {
        "match_percent": match_percent,
        "resume_keywords": resume_keywords[:20],
        "job_keywords": job_keywords[:20],
        "missing_keywords": missing_keywords[:10],
        "suggestions": suggestions
    }

# ---------- Skill Gap / JD Endpoints ----------
@app.post("/api/job-descriptions")
async def create_job_description(
    jd_data: JobDescriptionCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    extracted_skills, _ = await extract_skills_with_gemini(jd_data.job_description)

    try:
        user_uuid = uuid.UUID(current_user["sub"])
    except ValueError:
        user_uuid = None

    new_jd = JobDescriptionTable(
        company_name=jd_data.company_name,
        role=jd_data.role,
        job_description=jd_data.job_description,
        extracted_skills=extracted_skills,
        extracted_keywords=extracted_skills,
        source_type="community",
        added_by_user_id=user_uuid,
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

@app.put("/api/job-descriptions/{jd_id}")
async def update_job_description(
    jd_id: str,
    jd_update: JobDescriptionUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        jd_uuid = uuid.UUID(jd_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JD ID")

    stmt = select(JobDescriptionTable).where(JobDescriptionTable.id == jd_uuid)
    result = await db.execute(stmt)
    jd = result.scalar_one_or_none()

    if not jd:
        raise HTTPException(status_code=404, detail="Job description not found")

    # Extract new skills from updated JD
    extracted_skills, _ = await extract_skills_with_gemini(jd_update.job_description)

    # Update the JD
    jd.job_description = jd_update.job_description
    jd.extracted_skills = extracted_skills
    jd.extracted_keywords = extracted_skills
    jd.updated_at = datetime.utcnow()
    
    if jd_update.share_consent is not None:
        jd.share_consent = jd_update.share_consent

    await db.commit()
    await db.refresh(jd)

    return {
        "id": str(jd.id),
        "extracted_skills": extracted_skills,
        "source_type": jd.source_type,
        "created_at": jd.created_at.isoformat() if jd.created_at else None,
        "updated_at": jd.updated_at.isoformat() if jd.updated_at else None
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
        raw_skills = community_jd.extracted_skills or []
        # If skills look like generic words, re-extract with Gemini
        if raw_skills and any(s.lower() in ["implement", "improve", "prepare", "what", "edge", "functions", "databases"] for s in raw_skills):
            raw_skills, _ = await extract_skills_with_gemini(community_jd.job_description)
        return {
            "exists": True,
            "source_type": "community",
            "id": str(community_jd.id),
            "extracted_skills": raw_skills,
            "created_at": community_jd.created_at.isoformat(),
            "age_days": age_days,
            "is_fresh": age_days < 30,
            "job_description": community_jd.job_description
        }

    return {
        "exists": False,
        "source_type": "no_data",
        "extracted_skills": [],
        "message": "No JD found for this company and role. Paste a real JD to get accurate skill gap analysis.",
        "disclaimer": "AI estimates for company requirements are not provided as they may be inaccurate."
    }

# ---------- Opportunity Finder (DuckDuckGo) ----------
@app.get("/api/opportunities/search")
async def search_opportunities(
    opportunity_type: str = Query(
        default="all",
        description=(
            "all, internship, internship_software, internship_ai_ml, internship_data, "
            "internship_web, internship_mobile, internship_devops, hackathon, job, job_fresher"
        ),
    ),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if opportunity_type not in VALID_OPPORTUNITY_TYPES:
        opportunity_type = "all"

    stmt = select(UserResumeTable).where(
        UserResumeTable.user_id == current_user["sub"]
    ).order_by(desc(UserResumeTable.created_at))
    result = await db.execute(stmt)
    latest_resume = result.scalars().first()

    if not latest_resume:
        raise HTTPException(
            status_code=400,
            detail="No resume found. Upload your resume in the Resume Analyzer tab first.",
        )

    resume_keywords = resolve_resume_keywords(latest_resume)
    if not resume_keywords:
        raise HTTPException(
            status_code=400,
            detail="Could not read skills from your resume. Re-upload a text-based PDF in Resume Analyzer.",
        )

    all_raw_results, source_stats = await gather_opportunity_listings(
        resume_keywords, opportunity_type
    )

    scored_results = score_opportunity_results(all_raw_results, resume_keywords, opportunity_type)

    if not scored_results and all_raw_results:
        scored_results = score_opportunity_results(
            all_raw_results, resume_keywords, opportunity_type, min_trust=0
        )

    message = None
    if not scored_results:
        message = (
            "Could not fetch listings right now. Try again in a minute or switch category. "
            "Make sure your resume is uploaded in Resume Analyzer."
        )
    elif source_stats.get("internshala", 0) > 0:
        message = (
            f"Found {len(scored_results)} live openings matched to your skills — "
            "including live Internshala postings you can apply to directly."
        )

    # Pagination: 15 results per page
    results_per_page = 15
    total_results = len(scored_results)
    total_pages = (total_results + results_per_page - 1) // results_per_page
    
    # Validate page number
    if page > total_pages and total_pages > 0:
        page = total_pages
    
    start_idx = (page - 1) * results_per_page
    end_idx = start_idx + results_per_page
    paginated_results = scored_results[start_idx:end_idx]

    return {
        "results": paginated_results,
        "total": total_results,
        "page": page,
        "total_pages": total_pages,
        "results_per_page": results_per_page,
        "keywords_used": resume_keywords[:8],
        "opportunity_type": opportunity_type,
        "sources": source_stats,
        "message": message,
        "disclaimer": "Listings are aggregated from the web. Only showing live opportunities with open registration. Always verify details on the original site before applying.",
    }

@app.post("/api/opportunities/track")
async def track_opportunity(
    data: TrackOpportunityRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_opp = OpportunityTable(
        user_id=current_user["sub"],
        company_name=data.company_name,
        role=data.role,
        description=data.description or "",
        source_url=data.source_url,
        source_platform=data.source_platform,
        trust_score=data.trust_score,
        match_percent=data.match_percent
    )
    db.add(new_opp)

    new_app = ApplicationTable(
        id=uuid.uuid4(),
        user_id=current_user["sub"],
        company=data.company_name,
        role=data.role,
        status="Interested",
        applied_date=datetime.utcnow().strftime("%Y-%m-%d"),
        notes=f"Found via {data.source_platform or 'Opportunity Finder'}. {data.source_url}",
        job_description=data.description
    )
    db.add(new_app)

    await db.commit()
    await db.refresh(new_opp)

    return {
        "message": "Opportunity tracked and added to your application tracker",
        "opportunity_id": str(new_opp.id),
        "application_id": str(new_app.id),
        "company": data.company_name,
        "role": data.role
    }

@app.get("/api/opportunities/saved")
async def get_saved_opportunities(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(OpportunityTable).where(
        OpportunityTable.user_id == current_user["sub"]
    ).order_by(desc(OpportunityTable.created_at))
    result = await db.execute(stmt)
    opportunities = result.scalars().all()
    return [
        {
            "id": str(opp.id),
            "company_name": opp.company_name,
            "role": opp.role,
            "description": opp.description,
            "source_url": opp.source_url,
            "source_platform": opp.source_platform,
            "trust_score": opp.trust_score,
            "trust_label": "High" if opp.trust_score >= 70 else "Medium" if opp.trust_score >= 40 else "Low",
            "match_percent": opp.match_percent,
            "created_at": opp.created_at.isoformat() if opp.created_at else None
        }
        for opp in opportunities
    ]

@app.get("/api/opportunities/hackerearth")
async def fetch_hackerearth_challenges():
    client_id = os.getenv("HACKEREARTH_CLIENT_ID")
    client_secret = os.getenv("HACKEREARTH_CLIENT_SECRET")

    if not client_id or not client_secret:
        return {
            "challenges": [],
            "message": "HackerEarth API not configured."
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.hackerearth.com/v3/challenges/upcoming/",
                params={"client_id": client_id, "client_secret": client_secret}
            )
            if resp.status_code != 200:
                return {"challenges": [], "message": "HackerEarth API error"}
            data = resp.json()
            return {"challenges": data.get("data", []), "total": len(data.get("data", []))}
    except Exception as e:
        print(f"HackerEarth API error: {e}")
        return {"challenges": [], "message": "Could not reach HackerEarth API"}

# ---------- Study Plan (Gemini Free Tier) ----------
@app.post("/api/study-plan")
async def generate_study_plan(
    company: str,
    role: str,
    weeks: int = 4,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    weak_topics = [
        {"topic": "Dynamic Programming", "gap_score": 60, "company_frequency": 75},
        {"topic": "Graphs", "gap_score": 45, "company_frequency": 60},
        {"topic": "Trees", "gap_score": 30, "company_frequency": 55},
    ]

    plan = await generate_study_plan_with_gemini(weak_topics, company, role, weeks)

    return {
        "company": company,
        "role": role,
        "weeks": weeks,
        "study_plan": plan,
        "disclaimer": "Study plan is AI-generated based on commonly reported interview topics."
    }

# ---------- Analytics Endpoint ----------
@app.get("/api/analytics")
async def get_analytics(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        ApplicationTable.__table__.select().where(
            ApplicationTable.user_id == current_user["sub"]
        ).order_by(ApplicationTable.applied_date)
    )
    apps = result.fetchall()
    apps_list = [dict(app._mapping) for app in apps]

    status_counts = {}
    for app in apps_list:
        status = app.get("status", "Unknown")
        status_counts[status] = status_counts.get(status, 0) + 1

    date_counts = {}
    for app in apps_list:
        date = app.get("applied_date", "")[:7]
        if date:
            date_counts[date] = date_counts.get(date, 0) + 1

    company_counts = {}
    for app in apps_list:
        company = app.get("company", "Unknown")
        company_counts[company] = company_counts.get(company, 0) + 1

    top_companies = sorted(company_counts.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_applications": len(apps_list),
        "status_distribution": status_counts,
        "applications_over_time": [
            {"month": month, "count": count}
            for month, count in sorted(date_counts.items())
        ],
        "top_companies": [
            {"company": company, "count": count}
            for company, count in top_companies
        ],
        "offer_rate": round(
            status_counts.get("Offer", 0) / len(apps_list) * 100
            if apps_list else 0, 1
        )
    }

# ---------- Referral Finder Endpoints ----------

async def _draft_message_with_gemini(
    profile_name: str,
    profile_college: Optional[str],
    profile_yoe: Optional[int],
    company: str,
    role: str,
    user_name: str,
    user_college: str,
    user_project: str
) -> str:
    """
    Draft a personalized LinkedIn outreach message using Gemini.
    Returns at most 5 lines — lead with college if shared, mention real project, end with "no pressure".
    Falls back to template if Gemini unavailable or quota exceeded.
    """
    if genai_client is None:
        # Fallback template when Gemini not available
        return _fallback_message_template(
            profile_name, profile_college, company, role, user_name, user_college, user_project
        )
    
    try:
        shared_college = "Yes" if profile_college and user_college.lower() in profile_college.lower() else "No"
        
        prompt = f"""Draft a short LinkedIn outreach message (max 5 lines). Be authentic, no flattery.

Rules:
- If shared college: Lead with college connection ("I saw you also attended VIT...")
- Mention the specific project: {user_project}
- End with "no pressure to respond"
- Keep it genuine and brief
- No fake compliments

Profile: {profile_name} at {company}, {role}, graduated ~{profile_yoe or '?'} years ago
Shared college: {shared_college}
You: {user_name} from {user_college}
Project: {user_project}

Message:"""

        response = genai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        message = response.text.strip()
        # Ensure message ends with "no pressure" or similar
        if "no pressure" not in message.lower():
            message += "\n\nNo pressure to respond — just thought we could connect!"
        return message
    except Exception as e:
        print(f"Gemini message draft error: {e}")
        # Fallback to template on any error (rate limit, quota, etc.)
        return _fallback_message_template(
            profile_name, profile_college, company, role, user_name, user_college, user_project
        )

def _fallback_message_template(
    profile_name: str,
    profile_college: Optional[str],
    company: str,
    role: str,
    user_name: str,
    user_college: str,
    user_project: str
) -> str:
    """
    Fallback message template when Gemini is unavailable.
    Always returns a clean, 5-line message without AI.
    """
    intro = f"Hi {profile_name.split()[0]},"
    
    # College line if shared
    college_line = ""
    if profile_college and user_college.lower() in profile_college.lower():
        college_line = f"I noticed you're a {user_college} alum too! "
    
    body = f"{college_line}I'm interested in {role} roles at {company} and would love to learn about your experience. I've built {user_project} and would appreciate any insights you could share."
    
    return f"{intro}\n\n{body}\n\nNo pressure to respond — just wanted to connect!\n\nBest,\n{user_name}"

def _rank_profiles(profiles: List[dict], user_college: str):
    """
    Filter interns/contractors FIRST, then multi-signal rank.
    Returns (eligible_profiles, filtered_count).
    """
    current_year = datetime.utcnow().year
    tier_2_colleges = {"NIT", "BITS", "MANIPAL", "SRM", "IIIT", "DTU", "NSIT"}

    # Signals that indicate someone CANNOT refer
    ineligible_signals = [
        "intern", "internship", "contractor", "contract",
        "student", "trainee", "apprentice", "part-time",
        "freelance", "freelancer", "consultant"
    ]

    eligible = []
    filtered_count = 0

    for profile in profiles:
        snippet = (profile.get("snippet") or "").lower()
        name = (profile.get("name") or "").lower()

        # Filter out interns and contractors
        if any(signal in snippet or signal in name
               for signal in ineligible_signals):
            filtered_count += 1
            continue

        # Multi-signal scoring
        score = 0
        college = (profile.get("college") or "").upper()
        yoe = profile.get("yoe") or 0
        url = (profile.get("url") or "").lower()

        # Signal 1 — Same college
        if user_college.upper() in college and college:
            score += 50

        # Signal 2 — Tier 2 college
        elif any(tc in college for tc in tier_2_colleges):
            score += 20

        # Signal 3 — YoE sweet spot 1-4 years
        if 1 <= yoe <= 4:
            score += 30
        elif 5 <= yoe <= 7:
            score += 15
        elif yoe > 7:
            score += 5

        # Signal 4 — Not a former employee
        if "former" not in snippet and "ex-" not in snippet and "previously" not in snippet:
            score += 20
        else:
            score -= 30

        # Signal 5 — Engineering role
        role_keywords = ["engineer", "developer", "sde", "swe", "software", "tech"]
        if any(kw in snippet for kw in role_keywords):
            score += 10

        # Signal 6 — Indian name
        indian_suffixes = [
            "kumar", "sharma", "singh", "gupta", "patel", "jain",
            "agarwal", "mishra", "verma", "yadav", "reddy", "nair",
            "iyer", "pillai", "menon", "rao", "bhat", "joshi"
        ]
        if any(suffix in name for suffix in indian_suffixes):
            score += 10

        # Signal 7 — Direct profile URL
        if "/in/" in url:
            score += 15
        elif "search" in url:
            score -= 20

        profile["score"] = score
        profile["tier"] = 1 if score >= 80 else 2 if score >= 40 else 3
        eligible.append(profile)

    # Sort by score descending
    eligible.sort(key=lambda p: p.get("score", 0), reverse=True)
    return eligible, filtered_count

def _parse_profile_from_ddg(result: dict, user_college: str) -> Optional[dict]:
    """
    Parse a DuckDuckGo search result into a profile object.
    Extracts: name, college (if detected), YoE estimate, URL, snippet.
    """
    title = result.get("title", "")
    snippet = result.get("snippet", "")
    url = result.get("url", "")
    
    if not url or "linkedin" not in url.lower():
        return None

    # Filter out LinkedIn search pages — only want individual profiles
    if "/search/" in url or "searchResults" in url:
        return None
    
    # Extract name from title (usually first 1-3 words)
    name_parts = title.split("|")[0].split("—")[0].split("-")[0].strip().split()[:3]
    name = " ".join(name_parts) if name_parts else "Professional"
    
    # Detect college from snippet
    college = None
    college_keywords = {
        "VIT": ["VIT", "Vellore"],
        "IIT": ["IIT", "Indian Institute of Technology"],
        "NIT": ["NIT", "National Institute of Technology"],
        "BITS": ["BITS", "Pilani"],
        "Manipal": ["Manipal", "MIT"],
        "SRM": ["SRM", "Chennai"],
        "IIIT": ["IIIT", "International Institute"],
    }
    for col, keywords in college_keywords.items():
        if any(kw.lower() in snippet.lower() for kw in keywords):
            college = col
            break
    
    # Estimate YoE from snippet (look for "20XX-20YY" patterns or "X years")
    yoe = None
    yoe_match = re.search(r"(\d+)\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)", snippet, re.IGNORECASE)
    if yoe_match:
        yoe = int(yoe_match.group(1))
    else:
        # Try to extract from graduation year
        grad_match = re.search(r"(20\d{2})", snippet)
        if grad_match:
            grad_year = int(grad_match.group(1))
            yoe = datetime.utcnow().year - grad_year
    
    return {
        "name": name,
        "college": college,
        "yoe": yoe or 0,
        "url": url,
        "snippet": snippet,
        "tier": 3  # Will be updated by ranking function
    }

@app.get("/api/referral/search")
async def search_professionals(
    company: str = Query(..., description="Target company"),
    role: str = Query(..., description="Target role"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Search for professionals at a target company.
    Returns top 8-10 ranked profiles found via DuckDuckGo.
    """
    # Get user's college for ranking preference
    # (For now, assume from resume or default to any college)
    user_college = "Any"
    stmt = select(UserResumeTable).where(
        UserResumeTable.user_id == current_user["sub"]
    ).order_by(desc(UserResumeTable.created_at))
    result = await db.execute(stmt)
    latest_resume = result.scalars().first()
    if latest_resume:
        resume_text = latest_resume.resume_text or ""
        # Try to detect college from resume text
        vit_match = re.search(r"Vellore|VIT", resume_text, re.IGNORECASE)
        if vit_match:
            user_college = "VIT"
    
    # Build 3-4 search queries targeting LinkedIn profiles (individual profiles, not search pages)
    queries = [
        f'linkedin.com/in "{company}" "software engineer" India',
        f'linkedin.com/in "{company}" "developer" India',
        f'"{company}" engineer India linkedin profile -search',
        f'linkedin "{company}" "{role}" India site:linkedin.com/in',
    ]
    
    # Run searches in parallel
    all_results = []
    for query in queries:
        try:
            results = await search_duckduckgo(query, max_results=5)
            all_results.extend(results)
        except Exception as e:
            print(f"Search error for query '{query}': {e}")
    
    # Parse and dedupe profiles
    profiles = []
    seen_urls = set()
    for result in all_results:
        url = result.get("url", "")
        if url not in seen_urls:
            seen_urls.add(url)
            profile = _parse_profile_from_ddg(result, user_college)
            if profile:
                profiles.append(profile)
    
    # Rank profiles (filters interns/contractors)
    ranked_profiles, filtered_count = _rank_profiles(profiles, user_college)
    
    # Return top 8-10
    top_profiles = ranked_profiles[:10]
    
    return {
        "company": company,
        "role": role,
        "profiles": [
            {
                "name": p["name"],
                "college": p.get("college"),
                "yoe_estimate": p.get("yoe"),
                "profile_url": p["url"],
                "snippet": p["snippet"][:200],
                "tier": p["tier"],
                "score": p.get("score", 0)
            }
            for p in top_profiles
        ],
        "total_found": len(ranked_profiles),
        "filtered_count": filtered_count,
        "total_before_filter": len(ranked_profiles) + filtered_count,
        "disclaimer": "Profiles found via public search. Verify on LinkedIn — role may have changed."
    }

@app.post("/api/referral/draft")
async def draft_outreach_message(
    request: DraftMessageRequest,
    current_user=Depends(get_current_user)
):
    """
    Draft a personalized LinkedIn outreach message using Gemini.
    Max 5 lines, no fake flattery, lead with college if applicable.
    """
    message = await _draft_message_with_gemini(
        profile_name=request.profile_name,
        profile_college=request.profile_college,
        profile_yoe=request.profile_yoe,
        company=request.company,
        role=request.role,
        user_name=request.user_name,
        user_college=request.user_college,
        user_project=request.user_project
    )
    
    return {
        "profile_name": request.profile_name,
        "company": request.company,
        "role": request.role,
        "message_drafted": message,
        "character_count": len(message),
        "disclaimer": "Edit message before sending. This is AI-drafted and should be reviewed for accuracy."
    }

@app.post("/api/referral/track")
async def save_referral_outreach(
    request: TrackReferralRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Save a referral outreach attempt to the database.
    Links to an application if provided.
    """
    # Parse application ID if provided
    app_id = None
    if request.application_id:
        try:
            app_id = uuid.UUID(request.application_id)
        except ValueError:
            pass
    
    # Create outreach record with "Sent" status
    outreach = ReferralOutreachTable(
        user_id=current_user["sub"],
        application_id=app_id,
        company=request.company,
        role=request.role,
        profile_url=request.profile_url,
        profile_name=request.profile_name,
        profile_college=request.profile_college,
        message_drafted=request.message_drafted,
        status="Sent"
    )
    db.add(outreach)
    try:
        await db.flush()
        await db.commit()
        await db.refresh(outreach)
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, f"Failed to save outreach: {str(e)}")
    
    return {
        "message": "Outreach saved",
        "outreach_id": str(outreach.id),
        "company": outreach.company,
        "profile_name": outreach.profile_name,
        "status": outreach.status
    }

@app.put("/api/referral/track/{outreach_id}")
async def update_referral_status(
    outreach_id: str,
    request: UpdateReferralStatusRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update the status of a referral outreach attempt.
    Status: Draft / Sent / Responded / Referred / Declined
    """
    # Parse outreach ID
    try:
        outreach_uuid = uuid.UUID(outreach_id)
    except ValueError:
        raise HTTPException(400, "Invalid outreach ID")
    
    # Fetch outreach
    stmt = select(ReferralOutreachTable).where(
        and_(
            ReferralOutreachTable.id == outreach_uuid,
            ReferralOutreachTable.user_id == current_user["sub"]
        )
    )
    result = await db.execute(stmt)
    outreach = result.scalar_one_or_none()
    
    if not outreach:
        raise HTTPException(404, "Outreach record not found")
    
    # Validate status
    valid_statuses = ["Draft", "Sent", "Responded", "Referred", "Declined"]
    if request.status not in valid_statuses:
        raise HTTPException(400, f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    # Update status and timestamp
    outreach.status = request.status
    outreach.updated_at = datetime.utcnow()
    
    try:
        await db.commit()
        await db.refresh(outreach)
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, f"Failed to update status: {str(e)}")
    
    return {
        "message": "Status updated",
        "outreach_id": str(outreach.id),
        "status": outreach.status,
        "updated_at": outreach.updated_at.isoformat()
    }

@app.get("/api/referral/history")
async def get_referral_history(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all referral attempts for the current user, grouped by company.
    """
    stmt = select(ReferralOutreachTable).where(
        ReferralOutreachTable.user_id == current_user["sub"]
    ).order_by(desc(ReferralOutreachTable.created_at))
    
    result = await db.execute(stmt)
    outreaches = result.scalars().all()
    
    # Group by company
    by_company = {}
    for outreach in outreaches:
        company = outreach.company
        if company not in by_company:
            by_company[company] = []
        
        by_company[company].append({
            "id": str(outreach.id),
            "profile_name": outreach.profile_name,
            "role": outreach.role,
            "status": outreach.status,
            "profile_url": outreach.profile_url,
            "created_at": outreach.created_at.isoformat() if outreach.created_at else None,
            "updated_at": outreach.updated_at.isoformat() if outreach.updated_at else None
        })
    
    # Calculate summary stats
    total_sent = sum(1 for o in outreaches if o.status == "Sent")
    total_responded = sum(1 for o in outreaches if o.status == "Responded")
    total_referred = sum(1 for o in outreaches if o.status == "Referred")
    
    response_rate = round((total_responded / total_sent * 100) if total_sent > 0 else 0, 1)
    referral_rate = round((total_referred / total_sent * 100) if total_sent > 0 else 0, 1)
    
    return {
        "by_company": by_company,
        "summary": {
            "total_outreaches": len(outreaches),
            "total_sent": total_sent,
            "total_responded": total_responded,
            "total_referred": total_referred,
            "response_rate": response_rate,
            "referral_conversion_rate": referral_rate
        }
    }

# ========== CODING ROUND INTEL ==========

# Topic normalization mapping
TOPIC_NORMALIZATION = {
    "Dynamic Programming": ["DP", "Dynamic Programming", "dynamic-programming", "memoization"],
    "Trees": ["Tree", "Trees", "Binary Tree", "Binary Search Tree", "tree-traversal", "binary-trees"],
    "Graphs": ["Graph", "Graphs", "BFS", "DFS", "Graph Theory", "graph-theory"],
    "Arrays": ["Array", "Arrays", "array-manipulation", "implementation", "warmup", "problem-solving", "algorithms"],
    "Linked Lists": ["Linked List", "Linked Lists", "linked-list"],
    "Binary Search": ["Binary Search", "binary-search"],
    "Sorting": ["Sorting", "sort", "sorting-algorithms"],
    "Hashmaps": ["Hash Table", "Hash Map", "Hashmap", "Dictionaries and Hashmaps", "dictionaries-and-hashmaps", "collections", "dictionary", "map"],
    "Strings": ["String", "Strings", "Regex", "regular-expressions", "regex-and-parsing"],
    "Recursion": ["Recursion", "Backtracking", "recursion", "backtracking", "functional-programming"],
    "Heaps": ["Heap", "Heaps", "Priority Queue", "priority-queue", "heapq"],
    "Tries": ["Trie"],
    "Greedy": ["Greedy"],
    "Math/Bit Manipulation": ["Math", "Mathematics", "Bit Manipulation", "Bit", "bit-manipulation", "basic-mathematics", "statistics", "number-theory"],
    "Stack/Queue": ["Stack", "Stacks", "Queue", "Queues", "Monotonic Stack", "deque"],
    "General Problem Solving": ["problem solving", "problem-solving", "algorithms", "algorithm", "data structures", "data-structures", "practice"]
}

TOPIC_KEYWORDS = {
    "Dynamic Programming": ["dynamic programming", "memoization", "coin change", "climbing stairs", "subsequence", "knapsack"],
    "Trees": ["tree", "binary search tree", "bst", "inorder", "preorder", "postorder", "lowest common ancestor"],
    "Graphs": ["graph", "bfs", "dfs", "shortest path", "dijkstra", "connected component", "island"],
    "Arrays": ["array", "list", "subarray", "matrix", "grid", "triplet", "diagonal", "hourglass", "implementation", "warmup"],
    "Linked Lists": ["linked list", "linked-list"],
    "Binary Search": ["binary search", "lower bound", "upper bound"],
    "Sorting": ["sort", "sorting", "merge sort", "quick sort"],
    "Hashmaps": ["hash", "dictionary", "hashmap", "hash map", "counter", "frequency", "anagram"],
    "Strings": ["string", "substring", "palindrome", "regex", "regular expression", "anagram"],
    "Recursion": ["recursion", "recursive", "backtracking", "permutation", "combination"],
    "Heaps": ["heap", "priority queue"],
    "Tries": ["trie", "prefix tree"],
    "Greedy": ["greedy", "minimum", "maximum", "interval"],
    "Math/Bit Manipulation": ["math", "bit", "xor", "prime", "factor", "modulo", "statistics"],
    "Stack/Queue": ["stack", "queue", "deque", "balanced brackets", "parentheses"],
    "General Problem Solving": ["solve me", "plus minus", "mini max", "staircase", "grading students", "kangaroo", "apple and orange", "birthday cake"]
}

# Pydantic models for coding-intel
class TopicCount(BaseModel):
    topic: str
    count: int
    difficulty_breakdown: dict = {"easy": 0, "medium": 0, "hard": 0}

class CodingProfileResponse(BaseModel):
    source: str
    topic_counts: dict
    difficulty_breakdown: dict
    total_solved: int
    weekly_pace: Optional[float] = None

class GapAnalysisRequest(BaseModel):
    companies: List[str]
    profile_id: Optional[int] = None

class TopicGap(BaseModel):
    topic: str
    user_solved: int
    company_expected: int
    coverage_percent: float
    status: str  # "covered", "partial", "critical"
    priority: int
    companies_needing: List[str]
    weeks_to_close: Optional[float] = None
    problems_needed: int = 0
    frequency: Optional[str] = None
    difficulty: Optional[str] = None
    resources: Optional[dict] = None
    source: str = "community"

class GapAnalysisResponse(BaseModel):
    critical_gaps: List[TopicGap]
    partial_gaps: List[TopicGap]
    covered_topics: List[TopicGap]
    summary: dict

class StudyPlanRequest(BaseModel):
    weeks_until_interview: int
    hours_per_day: float
    company: str
    critical_gaps: List[TopicGap]

def normalize_topic(raw_topic: str) -> Optional[str]:
    """Convert raw topic tags to standard topic names."""
    if raw_topic is None:
        return None
    raw_topic = str(raw_topic).strip()
    if not raw_topic:
        return None

    normalized_raw = re.sub(r"[^a-z0-9]+", " ", raw_topic.lower()).strip()
    for standard_topic, aliases in TOPIC_NORMALIZATION.items():
        normalized_aliases = [
            re.sub(r"[^a-z0-9]+", " ", alias.lower()).strip()
            for alias in aliases
        ]
        if normalized_raw == standard_topic.lower() or normalized_raw in normalized_aliases:
            return standard_topic
        if any(alias and alias in normalized_raw for alias in normalized_aliases):
            return standard_topic
    for standard_topic, keywords in TOPIC_KEYWORDS.items():
        if any(keyword in normalized_raw for keyword in keywords):
            return standard_topic
    return None

def _safe_int(value, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default

def _normalize_difficulty(value: str) -> Optional[str]:
    difficulty = str(value or "").strip().lower()
    return difficulty if difficulty in {"easy", "medium", "hard"} else None

def _add_topic_count(topic_counts: dict, difficulty_breakdown: dict, raw_topic: str, count: int = 1, difficulty: str = "medium"):
    normalized = normalize_topic(raw_topic)
    if not normalized or count <= 0:
        return

    topic_counts[normalized] = topic_counts.get(normalized, 0) + count
    if normalized not in difficulty_breakdown:
        difficulty_breakdown[normalized] = {"easy": 0, "medium": 0, "hard": 0}

    normalized_difficulty = _normalize_difficulty(difficulty) or "medium"
    difficulty_breakdown[normalized][normalized_difficulty] += count

def _first_present(mapping: dict, keys: List[str]):
    for key in keys:
        if isinstance(mapping, dict) and mapping.get(key) not in (None, ""):
            return mapping.get(key)
    return None

def _nested_get(mapping: dict, path: List[str]):
    current = mapping
    for key in path:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current

def _collect_strings(value, max_items: int = 30) -> List[str]:
    strings = []
    if len(strings) >= max_items:
        return strings
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        for item in value:
            strings.extend(_collect_strings(item, max_items - len(strings)))
            if len(strings) >= max_items:
                break
    elif isinstance(value, dict):
        priority_keys = [
            "subdomain", "Subdomain", "track", "Track", "domain", "Domain",
            "category", "Category", "topic", "Topic", "tags", "Tags",
            "challenge_name", "challengeName", "title", "Title", "name", "Name", "slug"
        ]
        for key in priority_keys:
            if key in value:
                strings.extend(_collect_strings(value[key], max_items - len(strings)))
        for nested_key in ("challenge", "Challenge"):
            if nested_key in value:
                strings.extend(_collect_strings(value[nested_key], max_items - len(strings)))
    return strings[:max_items]

def _profile_has_topic_data(profile: dict) -> bool:
    return bool(profile.get("topic_counts"))

def _extract_total_solved(payload: dict) -> int:
    if not isinstance(payload, dict):
        return 0

    direct = _safe_int(
        payload.get("totalSolved")
        or payload.get("total_solved")
        or payload.get("solvedProblem")
        or payload.get("problemsSolved")
    )
    if direct:
        return direct

    submit_stats = (
        _nested_get(payload, ["submitStats", "acSubmissionNum"])
        or _nested_get(payload, ["matchedUser", "submitStats", "acSubmissionNum"])
        or _nested_get(payload, ["data", "matchedUser", "submitStats", "acSubmissionNum"])
        or []
    )
    for stat in submit_stats:
        if str(stat.get("difficulty", "")).lower() == "all":
            return _safe_int(stat.get("count"))

    return 0

def _json_dict_or_empty(value) -> dict:
    if isinstance(value, dict):
        return value
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except (TypeError, json.JSONDecodeError):
        return {}

async def fetch_leetcode_profile(username: str) -> dict:
    """Fetch LeetCode profile from API wrapper. Returns topic counts and stats."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Try the wrapper API first
            skills_url = f"https://leetcode-api-pied.vercel.app/user/{username}/skills"
            skills_response = await client.get(skills_url)

            if skills_response.status_code != 200:
                raise Exception(f"Skills API failed: {skills_response.status_code}")

            skills_data = skills_response.json()

            # Also fetch basic stats for pace calculation
            stats_url = f"https://leetcode-api-pied.vercel.app/user/{username}"
            stats_response = await client.get(stats_url)
            stats_data = stats_response.json() if stats_response.status_code == 200 else {}

            # Parse skills into normalized topic counts
            topic_counts = {}
            difficulty_breakdown = {}

            # Handle wrapper responses and LeetCode GraphQL-style tag buckets.
            skills_list = []
            if isinstance(skills_data, list):
                skills_list = skills_data
            elif isinstance(skills_data, dict):
                skills_list = (
                    skills_data.get("skills")
                    or skills_data.get("topics")
                    or skills_data.get("tags")
                    or skills_data.get("skillStats")
                    or []
                )
                tag_counts = (
                    skills_data.get("tagProblemCounts")
                    or skills_data.get("data", {}).get("matchedUser", {}).get("tagProblemCounts")
                    or skills_data.get("matchedUser", {}).get("tagProblemCounts")
                    or {}
                )
                for bucket in ("fundamental", "intermediate", "advanced"):
                    for tag in tag_counts.get(bucket, []) or []:
                        _add_topic_count(
                            topic_counts,
                            difficulty_breakdown,
                            tag.get("tagName") or tag.get("name") or tag.get("slug"),
                            _safe_int(tag.get("problemsSolved") or tag.get("problems") or tag.get("count")),
                            "medium",
                        )

            for skill in skills_list:
                if isinstance(skill, dict):
                    skill_name = _first_present(skill, ["name", "tagName", "topic", "slug", "tagSlug"])
                    count = _safe_int(_first_present(skill, ["problemsSolved", "problems", "count", "solved", "problemsCount"]))
                else:
                    skill_name = str(skill)
                    count = 1

                _add_topic_count(topic_counts, difficulty_breakdown, skill_name, count, "medium")

            # Calculate total solved and weekly pace
            total_solved = sum(topic_counts.values()) if topic_counts else _extract_total_solved(stats_data)

            if not topic_counts:
                raise Exception("LeetCode API returned no topic data")

            # Estimate weekly pace: total_solved / weeks_active
            weekly_pace = None
            if "joinDate" in stats_data:
                try:
                    join_date = datetime.fromisoformat(stats_data["joinDate"].replace('Z', '+00:00'))
                    days_active = (datetime.now(join_date.tzinfo) - join_date).days
                    weeks_active = max(days_active / 7, 1)
                    weekly_pace = round(total_solved / weeks_active, 2)
                except:
                    pass

            # If no weekly pace calculated, estimate from total
            if not weekly_pace and total_solved > 0:
                weekly_pace = round(total_solved / 52, 2)  # Rough estimate

            return {
                "source": "leetcode",
                "topic_counts": topic_counts,
                "difficulty_breakdown": difficulty_breakdown,
                "total_solved": total_solved,
                "weekly_pace": weekly_pace
            }
    except Exception as e:
        raise Exception(f"Failed to fetch LeetCode profile: {str(e)}")

async def fetch_leetcode_profile_fallback(username: str) -> dict:
    """Fallback: Fetch from LeetCode GraphQL directly."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            query = """
            query GetUserProfile($username: String!) {
                matchedUser(username: $username) {
                    username
                    profile {
                        userAvatar
                        realName
                    }
                    languageProblemCount {
                        languageName
                        problemsSolved
                    }
                    tagProblemCounts {
                        advanced {
                            tagName
                            problemsSolved
                        }
                        intermediate {
                            tagName
                            problemsSolved
                        }
                        fundamental {
                            tagName
                            problemsSolved
                        }
                    }
                    problemsSolvedBeatsStats {
                        difficulty
                        percentage
                    }
                    userCalendar(year: 2024) {
                        activeYears
                    }
                    submitStats {
                        acSubmissionNum {
                            difficulty
                            count
                            submissions
                        }
                    }
                }
            }
            """

            response = await client.post(
                "https://leetcode.com/graphql",
                json={"query": query, "variables": {"username": username}},
                headers={"Content-Type": "application/json"}
            )

            if response.status_code != 200:
                raise Exception(f"GraphQL failed: {response.status_code}")

            data = response.json()

            if "errors" in data or not data.get("data", {}).get("matchedUser"):
                raise Exception("User not found")

            # Extract stats
            matched_user = data["data"]["matchedUser"]
            topic_counts = {}
            difficulty_breakdown = {}
            total_solved = 0

            tag_counts = matched_user.get("tagProblemCounts", {}) or {}
            for bucket in ("fundamental", "intermediate", "advanced"):
                for tag in tag_counts.get(bucket, []) or []:
                    _add_topic_count(
                        topic_counts,
                        difficulty_breakdown,
                        tag.get("tagName"),
                        _safe_int(tag.get("problemsSolved")),
                        "medium",
                    )

            # Parse submission stats. LeetCode includes an "All" row, so use that
            # as the total and do not double count Easy/Medium/Hard.
            submit_stats = matched_user.get("submitStats", {}).get("acSubmissionNum", [])
            for stat in submit_stats:
                difficulty = stat.get("difficulty", "").lower()
                count = stat.get("count", 0)
                if difficulty == "all":
                    total_solved = _safe_int(count)
                    break

            if total_solved == 0:
                total_solved = sum(topic_counts.values())

            if not topic_counts:
                raise Exception("LeetCode returned no topic data for this username")

            # Default weekly pace estimate
            weekly_pace = 5 if total_solved == 0 else round(total_solved / 50, 2)

            return {
                "source": "leetcode",
                "topic_counts": topic_counts,
                "difficulty_breakdown": difficulty_breakdown,
                "total_solved": total_solved,
                "weekly_pace": weekly_pace
            }
    except Exception as e:
        raise Exception(f"LeetCode GraphQL fallback failed: {str(e)}")

def parse_hackerrank_csv(csv_content: str) -> dict:
    """Parse HackerRank CSV export and return topic counts."""
    topic_counts = {}
    difficulty_breakdown = {}
    total_solved = 0
    dates = []

    f = io.StringIO(csv_content)
    reader = csv.DictReader(f)

    for row in reader:
        # Only count solved problems
        status = str(_first_present(row, ["Status", "status", "Result", "result", "State", "state"]) or "").lower()
        if status and status not in {"solved", "accepted", "ac", "correct", "passed"}:
            continue

        # Parse subdomain as topic
        subdomain = _first_present(row, ["Subdomain", "subdomain", "Track", "track", "Domain", "domain", "Category", "category", "Challenge", "challenge"])
        if not normalize_topic(subdomain):
            for candidate in _collect_strings(row):
                if normalize_topic(candidate):
                    subdomain = candidate
                    break
        if not normalize_topic(subdomain):
            subdomain = _hackerrank_fallback_topic(row)
        if subdomain and normalize_topic(subdomain):
            total_solved += 1
            _add_topic_count(topic_counts, difficulty_breakdown, subdomain, 1, "medium")

        # Extract date
        try:
            date_str = _first_present(row, ["Solved On", "solved_on", "Date", "date", "created_at", "createdAt"])
            if date_str:
                dates.append(dt.strptime(str(date_str)[:10], "%Y-%m-%d"))
        except Exception:
            pass

    if reader.line_num > 0 and total_solved == 0:
        raise Exception("No solved HackerRank DSA topics found in this file")

    # Calculate weekly pace from dates if available
    weekly_pace = None
    if dates:
        days_span = (max(dates) - min(dates)).days + 1
        weeks_span = days_span / 7
        weekly_pace = total_solved / weeks_span if weeks_span > 0 else None

    return {
        "source": "hackerrank",
        "topic_counts": topic_counts,
        "difficulty_breakdown": difficulty_breakdown,
        "total_solved": total_solved,
        "weekly_pace": weekly_pace
    }
def _hackerrank_topic_from_submission(record: dict) -> Optional[str]:
    """Extract topic from HackerRank's basic submission export format."""
    challenge_name = str(record.get("challenge", "")).lower()
    language = str(record.get("language", "")).lower()

    topic_keywords = {
        "Arrays": ["array", "rotation", "hourglass", "left rotation"],
        "Strings": ["string", "anagram", "palindrome", "caesar", "pangram"],
        "Linked Lists": ["linked list", "node", "pointer"],
        "Sorting": ["sort", "bubble", "insertion", "comparator"],
        "Hashmaps": ["hashmap", "dictionary", "map", "frequency"],
        "Recursion": ["recursion", "recursive", "fibonacci"],
        "Dynamic Programming": ["dynamic", "dp ", "knapsack", "subsequence"],
        "Trees": ["tree", "bst", "binary search tree", "height"],
        "Graphs": ["graph", "bfs", "dfs", "shortest path"],
        "Math/Bit Manipulation": ["bit", "math", "power", "prime"],
        "Stacks": ["stack", "balanced", "brackets"],
        "Queues": ["queue", "deque"],
    }

    for topic, keywords in topic_keywords.items():
        if any(kw in challenge_name for kw in keywords):
            return topic

    # Skip basic language tutorial challenges — not DSA
    lang_basics = ["if-else", "loops", "stdin", "stdout", "output formatting",
                   "welcome", "data types", "operators"]
    if any(kw in challenge_name for kw in lang_basics):
        return None

    return "General Problem Solving"
def _find_hackerrank_records(data) -> List[dict]:
    if isinstance(data, list):
        return [item for item in data if isinstance(item, dict)]

    if not isinstance(data, dict):
        return []

    for key in ("submissions", "submission_history", "challenges", "models", "data", "items", "results"):
        value = data.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
        if isinstance(value, dict):
            nested = _find_hackerrank_records(value)
            if nested:
                return nested

    return [data] if any(key in data for key in ("status", "challenge", "subdomain", "track", "domain", "category")) else []

def _hackerrank_status_is_solved(record: dict) -> bool:
    status = str(_first_present(record, ["status", "Status", "result", "Result", "state", "State"]) or "").lower()
    if status in {"solved", "accepted", "ac", "correct", "passed"}:
        return True
    if status in {"wrong answer", "rejected", "failed", "compile error", "runtime error"}:
        return False

    score = _safe_int(_first_present(record, ["score", "Score", "max_score", "maxScore"]), -1)
    return score > 0

def _hackerrank_topic_from_record(record: dict) -> Optional[str]:
    direct_topic = _first_present(record, [
        "subdomain", "Subdomain", "track", "Track", "domain", "Domain",
        "category", "Category", "topic", "Topic", "tags", "Tags"
    ])
    if isinstance(direct_topic, list):
        for topic in direct_topic:
            if normalize_topic(topic):
                return str(topic)
    if direct_topic:
        direct_topic_text = str(direct_topic)
        if normalize_topic(direct_topic_text):
            return direct_topic_text

    challenge = record.get("challenge") or record.get("Challenge") or {}
    if isinstance(challenge, dict):
        nested_topic = _first_present(challenge, [
            "subdomain", "Subdomain", "track", "Track", "domain", "Domain",
            "category", "Category", "topic", "Topic", "tags", "Tags", "name", "Name", "slug"
        ])
        if isinstance(nested_topic, list):
            for topic in nested_topic:
                if normalize_topic(topic):
                    return str(topic)
        if nested_topic:
            nested_topic_text = str(nested_topic)
            if normalize_topic(nested_topic_text):
                return nested_topic_text

    for candidate in _collect_strings(record):
        if normalize_topic(candidate):
            return candidate

    return None

def _hackerrank_fallback_topic(record: dict) -> Optional[str]:
    """Keep solved HackerRank practice visible when exports omit usable topic metadata."""
    joined = " ".join(_collect_strings(record, max_items=50)).lower()
    if any(word in joined for word in ["sql", "database", "select ", "query"]):
        return None
    if any(word in joined for word in ["java", "python", "c++", "javascript", "language proficiency"]):
        return None
    return "General Problem Solving"

def parse_hackerrank_json(json_content: str) -> dict:
    """Parse HackerRank JSON export and return topic counts."""
    topic_counts = {}
    difficulty_breakdown = {}
    total_solved = 0

    try:
        data = json.loads(json_content)
    except json.JSONDecodeError as e:
        raise Exception(f"Invalid JSON format: {str(e)}")

    # Handle HackerRank's user data export format (has a "submissions" key)
    if isinstance(data, dict) and "submissions" in data:
        submissions = data["submissions"]
    else:
        submissions = _find_hackerrank_records(data)

    for record in submissions:
        # In this export format, score > 0 means solved
        score = record.get("score", 0)
        if not score or float(score) <= 0:
            continue

        subdomain = _hackerrank_topic_from_record(record)
        if not subdomain:
            subdomain = _hackerrank_topic_from_submission(record)
        if not subdomain:
            subdomain = _hackerrank_fallback_topic(record)
        if subdomain:
            total_solved += 1
            _add_topic_count(topic_counts, difficulty_breakdown, subdomain, 1, "medium")

    if submissions and total_solved == 0:
        raise Exception("No solved HackerRank DSA topics found in this file")

    weekly_pace = round(total_solved / 10, 2) if total_solved > 0 else 5

    return {
        "source": "hackerrank",
        "topic_counts": topic_counts,
        "difficulty_breakdown": difficulty_breakdown,
        "total_solved": total_solved,
        "weekly_pace": weekly_pace
    }

def merge_profiles(*profiles) -> dict:
    """Merge multiple parsed profiles (LeetCode, HackerRank, manual) into combined."""
    merged_counts = {}
    merged_difficulty = {}
    total_solved = 0
    paces = []
    
    for profile in profiles:
        if not profile:
            continue
        
        # Merge topic counts
        for topic, count in profile.get("topic_counts", {}).items():
            merged_counts[topic] = merged_counts.get(topic, 0) + count
        
        # Merge difficulty
        for topic, difficulties in profile.get("difficulty_breakdown", {}).items():
            if topic not in merged_difficulty:
                merged_difficulty[topic] = {"easy": 0, "medium": 0, "hard": 0}
            for diff_level, count in difficulties.items():
                merged_difficulty[topic][diff_level] += count
        
        total_solved += profile.get("total_solved", 0)
        if profile.get("weekly_pace"):
            paces.append(profile["weekly_pace"])
    
    # Average weekly pace
    weekly_pace = sum(paces) / len(paces) if paces else None
    
    return {
        "source": "combined",
        "topic_counts": merged_counts,
        "difficulty_breakdown": merged_difficulty,
        "total_solved": total_solved,
        "weekly_pace": weekly_pace
    }

async def get_combined_coding_profile(db: AsyncSession, user_id) -> Optional[dict]:
    """Return a merged profile from the user's latest profile for each source."""
    stmt = select(CodingProfileTable).where(
        CodingProfileTable.user_id == user_id
    ).order_by(desc(CodingProfileTable.created_at))

    result = await db.execute(stmt)
    records = result.scalars().all()
    if not records:
        return None

    latest_by_source = {}
    latest_combined = None
    for record in records:
        if record.source == "combined" and latest_combined is None:
            latest_combined = record
        elif record.source not in latest_by_source:
            latest_by_source[record.source] = record

    selected_records = list(latest_by_source.values())
    if not selected_records and latest_combined:
        selected_records = [latest_combined]

    profiles = []
    source_totals = {}
    for record in selected_records:
        profile = {
            "id": record.id,
            "source": record.source,
            "topic_counts": _json_dict_or_empty(record.topic_counts),
            "difficulty_breakdown": _json_dict_or_empty(record.difficulty_breakdown),
            "total_solved": record.total_solved,
            "weekly_pace": float(record.weekly_pace) if record.weekly_pace else None,
            "created_at": record.created_at.isoformat()
        }
        profiles.append(profile)
        source_totals[record.source] = record.total_solved

    combined = merge_profiles(*profiles)
    combined["id"] = latest_combined.id if latest_combined else selected_records[0].id
    combined["sources"] = source_totals
    combined["created_at"] = selected_records[0].created_at.isoformat()
    return combined

def estimate_company_pattern(company: str) -> dict:
    """Fallback topic expectations for companies not yet in the curated database."""
    return {
        "role": "SWE Intern",
        "source": "ai_estimated",
        "topics": {
            "Arrays": {"frequency": "high", "expected_problems": 18, "difficulty": "easy-medium", "priority": 1},
            "Strings": {"frequency": "high", "expected_problems": 12, "difficulty": "easy-medium", "priority": 2},
            "Hashmaps": {"frequency": "high", "expected_problems": 10, "difficulty": "easy-medium", "priority": 3},
            "Trees": {"frequency": "medium", "expected_problems": 10, "difficulty": "medium", "priority": 4},
            "Graphs": {"frequency": "medium", "expected_problems": 8, "difficulty": "medium", "priority": 5},
            "Dynamic Programming": {"frequency": "medium", "expected_problems": 8, "difficulty": "medium-hard", "priority": 6},
            "Binary Search": {"frequency": "medium", "expected_problems": 6, "difficulty": "easy-medium", "priority": 7}
        },
        "note": f"{company} is not in the curated DSA database yet, so these expectations use a generic SWE interview pattern."
    }

def calculate_gaps(user_profile: dict, companies: List[str], company_patterns: dict) -> dict:
    """Calculate coverage gaps for user against selected companies."""
    critical_gaps = []
    partial_gaps = []
    covered_topics = []
    
    user_counts = user_profile.get("topic_counts", {})
    all_company_needs = {}
    
    # Aggregate what all companies need
    for company in companies:
        company_data = company_patterns.get(company) or estimate_company_pattern(company)
        pattern_source = company_data.get("source", "community")
        for topic, info in company_data.get("topics", {}).items():
            if topic not in all_company_needs:
                all_company_needs[topic] = {
                    "companies": [],
                    "expected": 0,
                    "priority": info.get("priority", 10),
                    "frequency": info.get("frequency"),
                    "difficulty": info.get("difficulty"),
                    "source": pattern_source
                }
            all_company_needs[topic]["companies"].append(company)
            all_company_needs[topic]["expected"] = max(all_company_needs[topic]["expected"], info.get("expected_problems", 10))
            if info.get("priority", 10) < all_company_needs[topic]["priority"]:
                all_company_needs[topic]["priority"] = info.get("priority", 10)
    
    # Calculate coverage for each topic
    for topic, expected in all_company_needs.items():
        user_solved = user_counts.get(topic, 0)
        coverage = user_solved / expected["expected"] if expected["expected"] > 0 else 0
        
        # Estimate weeks to close gap (default 5 problems/week if no pace)
        pace = user_profile.get("weekly_pace", 5)
        gap = max(0, expected["expected"] - user_solved)
        weeks_to_close = gap / pace if pace > 0 else None
        topic_resources = DSA_RESOURCES.get(topic, {})
        
        gap_obj = TopicGap(
            topic=topic,
            user_solved=user_solved,
            company_expected=expected["expected"],
            coverage_percent=round(coverage * 100, 1),
            status="covered" if coverage >= 1.0 else "partial" if coverage >= 0.6 else "critical",
            priority=len(expected["companies"]),  # Higher priority = more companies need it
            companies_needing=expected["companies"],
            weeks_to_close=weeks_to_close,
            problems_needed=gap,
            frequency=expected.get("frequency"),
            difficulty=expected.get("difficulty"),
            resources=topic_resources,
            source=expected.get("source", "community")
        )
        
        if gap_obj.status == "critical":
            critical_gaps.append(gap_obj)
        elif gap_obj.status == "partial":
            partial_gaps.append(gap_obj)
        else:
            covered_topics.append(gap_obj)
    
    # Sort by priority
    critical_gaps.sort(key=lambda x: (-len(x.companies_needing), x.topic))
    partial_gaps.sort(key=lambda x: (-len(x.companies_needing), x.topic))
    covered_topics.sort(key=lambda x: (-len(x.companies_needing), x.topic))

    for index, gap in enumerate(critical_gaps, start=1):
        gap.priority = index
    for index, gap in enumerate(partial_gaps, start=1):
        gap.priority = index
    for index, gap in enumerate(covered_topics, start=1):
        gap.priority = index
    
    return {
        "critical_gaps": critical_gaps,
        "partial_gaps": partial_gaps,
        "covered_topics": covered_topics,
        "summary": {
            "total_topics_covered": len(covered_topics),
            "total_partial": len(partial_gaps),
            "total_critical": len(critical_gaps),
            "total_topics_analyzed": len(all_company_needs),
            "selected_companies": companies
        }
    }

# Load company DSA patterns and resources
try:
    with open("company_dsa_patterns.json", "r") as f:
        COMPANY_DSA_PATTERNS = json.load(f)
except:
    COMPANY_DSA_PATTERNS = {}

try:
    with open("dsa_resources.json", "r") as f:
        DSA_RESOURCES = json.load(f)
except:
    DSA_RESOURCES = {}

# API Endpoints for Coding Round Intel

@app.get("/api/coding-intel/parse/leetcode")
async def parse_leetcode(username: str = Query(..., description="LeetCode username"), current_user = Depends(get_current_user)):
    """Fetch LeetCode profile by username and return parsed profile."""
    try:
        # Validate username exists
        if not username or len(username.strip()) == 0:
            raise HTTPException(status_code=400, detail="Username cannot be empty")

        username = username.strip()

        # Try primary API first
        try:
            profile = await fetch_leetcode_profile(username)
            return profile
        except Exception as primary_error:
            print(f"Primary API failed: {primary_error}")

            # Try fallback GraphQL
            try:
                profile = await fetch_leetcode_profile_fallback(username)
                if not _profile_has_topic_data(profile):
                    raise Exception("LeetCode returned no topic data")
                return profile
            except Exception as fallback_error:
                print(f"Fallback GraphQL failed: {fallback_error}")
                raise HTTPException(
                    status_code=404,
                    detail=f"Could not fetch LeetCode profile for '{username}'. Please try again or enter manually."
                )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching LeetCode profile: {str(e)}")

@app.post("/api/coding-intel/parse/hackerrank")
async def parse_hackerrank(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    """Parse HackerRank JSON or CSV export and return parsed profile."""
    try:
        content = await file.read()
        text_content = content.decode("utf-8")

        if file.filename and file.filename.lower().endswith(".json"):
            try:
                return parse_hackerrank_json(text_content)
            except Exception as json_error:
                raise HTTPException(status_code=400, detail=f"Error parsing HackerRank JSON: {str(json_error)}")

        if file.filename and file.filename.lower().endswith(".csv"):
            try:
                return parse_hackerrank_csv(text_content)
            except Exception as csv_error:
                raise HTTPException(status_code=400, detail=f"Error parsing HackerRank CSV: {str(csv_error)}")

        # Unknown extension: detect file format.
        try:
            json.loads(text_content)
            return parse_hackerrank_json(text_content)
        except json.JSONDecodeError:
            try:
                return parse_hackerrank_csv(text_content)
            except Exception as csv_error:
                raise HTTPException(status_code=400, detail=f"Error parsing HackerRank file: {str(csv_error)}")
        except Exception as json_error:
            raise HTTPException(status_code=400, detail=f"Error parsing HackerRank JSON: {str(json_error)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing HackerRank file: {str(e)}")

@app.post("/api/coding-intel/manual")
async def manual_entry(topics: dict = Body(...), current_user = Depends(get_current_user)):
    """Accept manual topic entry."""
    return {
        "source": "manual",
        "topic_counts": topics,
        "difficulty_breakdown": {t: {"easy": 0, "medium": count, "hard": 0} for t, count in topics.items()},
        "total_solved": sum(topics.values()),
        "weekly_pace": None
    }

@app.post("/api/coding-intel/profile")
async def save_profile(
    profile_data: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Save combined coding profile to database."""
    try:
        user_id = current_user["sub"]
        
        # Determine source and merge if multiple
        source = profile_data.get("source", "combined")
        
        # Create new profile record
        profile = CodingProfileTable(
            user_id=user_id,
            source=source,
            topic_counts=json.dumps(profile_data.get("topic_counts", {})),
            difficulty_breakdown=json.dumps(profile_data.get("difficulty_breakdown", {})),
            total_solved=profile_data.get("total_solved", 0),
            weekly_pace=str(profile_data.get("weekly_pace")) if profile_data.get("weekly_pace") else None
        )
        
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
        
        return {
            "id": profile.id,
            "source": profile.source,
            "total_solved": profile.total_solved,
            "created_at": profile.created_at.isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error saving profile: {str(e)}")

@app.post("/api/coding-intel/analyze")
async def analyze_gaps(
    request: GapAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Analyze coding gaps for selected companies."""
    try:
        user_id = current_user["sub"]

        if request.profile_id:
            stmt = select(CodingProfileTable).where(
                CodingProfileTable.id == request.profile_id,
                CodingProfileTable.user_id == user_id
            )
            result = await db.execute(stmt)
            profile_record = result.scalar_one_or_none()

            if not profile_record:
                raise HTTPException(status_code=404, detail="No coding profile found")

            user_profile = {
                "source": profile_record.source,
                "topic_counts": _json_dict_or_empty(profile_record.topic_counts),
                "difficulty_breakdown": _json_dict_or_empty(profile_record.difficulty_breakdown),
                "total_solved": profile_record.total_solved,
                "weekly_pace": float(profile_record.weekly_pace) if profile_record.weekly_pace else 5.0
            }
        else:
            user_profile = await get_combined_coding_profile(db, user_id)
            if not user_profile:
                raise HTTPException(status_code=404, detail="No coding profile found")
        
        # Calculate gaps
        gaps = calculate_gaps(user_profile, request.companies, COMPANY_DSA_PATTERNS)
        
        return gaps
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error analyzing gaps: {str(e)}")

@app.post("/api/coding-intel/study-plan")
async def generate_study_plan(
    request: StudyPlanRequest,
    current_user = Depends(get_current_user)
):
    """Generate a week-by-week study plan using Gemini."""
    try:
        if not genai_client:
            raise HTTPException(status_code=503, detail="Gemini API not configured")
        
        # Format critical gaps for Gemini
        gaps_text = "\n".join([
            f"{i+1}. {gap.topic} — needs {gap.company_expected - gap.user_solved} more problems — affects {', '.join(gap.companies_needing)}"
            for i, gap in enumerate(request.critical_gaps[:5])
        ])
        
        prompt = f"""Student is preparing for {request.company} SWE Intern in {request.weeks_until_interview} weeks.
Available: {request.hours_per_day} hours per day.

Their critical gaps (sorted by priority):
{gaps_text}

Generate a specific week-by-week study plan:
- Which topic to focus each week
- 3 specific LeetCode problems by name and difficulty
- One free resource (YouTube or article)
- Daily time split

Rules:
- Be specific, not generic
- Prioritize by cross-company frequency
- Maximum 300 words"""
        
        response = await asyncio.to_thread(
            lambda: genai_client.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt
            )
        )
        
        return {
            "study_plan": response.text,
            "company": request.company,
            "weeks": request.weeks_until_interview,
            "hours_per_day": request.hours_per_day
        }
    except Exception as e:
        # Fallback to generic plan
        return {
            "study_plan": "Study plan generation unavailable. Focus on your critical gaps in order.",
            "company": request.company,
            "weeks": request.weeks_until_interview,
            "is_fallback": True
        }

@app.get("/api/coding-intel/profile")
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get user's most recent coding profile."""
    try:
        user_id = current_user["sub"]

        profile = await get_combined_coding_profile(db, user_id)
        if not profile:
            return {"profile": None}
        
        return {"profile": profile}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error fetching profile: {str(e)}")

@app.get("/api/coding-intel/resources/{topic}")
async def get_resources(topic: str, current_user = Depends(get_current_user)):
    """Get study resources for a specific topic."""
    if topic not in DSA_RESOURCES:
        return {"error": f"Resources not found for {topic}"}
    
    return DSA_RESOURCES[topic]

@app.get("/api/coding-intel/companies")
async def get_companies(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get companies from DSA patterns plus the user's application tracker."""
    company_names = set(COMPANY_DSA_PATTERNS.keys())

    result = await db.execute(
        select(ApplicationTable.company).where(
            ApplicationTable.user_id == current_user["sub"],
            ApplicationTable.company.isnot(None)
        )
    )
    for company in result.scalars().all():
        if company and company.strip():
            company_names.add(company.strip())

    return {"companies": sorted(company_names)}

# uvicorn main:app --reload --port 8000
