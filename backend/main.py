import os
import uuid
import io
import json
import re
import asyncio
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Query
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
try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS  # legacy fallback
import httpx
from urllib.parse import quote_plus
from opportunity_sources import gather_opportunity_listings

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
    user_id = Column(String, index=True)
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
    user_id = Column(String, index=True)
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
    user_id = Column(String, nullable=False)
    company_name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    source_url = Column(String, nullable=False)
    source_platform = Column(String, nullable=True)
    trust_score = Column(Integer, default=100)
    match_percent = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    allow_origins=["*"],  # Restrict to your Vercel domain in production
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

        response = genai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        tailored_text = response.text.strip()
        return tailored_text
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
        "keywords": query,
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

    try:
        from duckduckgo_search import DDGS as LegacyDDGS
        with LegacyDDGS() as ddgs:
            legacy_kwargs = dict(kwargs)
            legacy_kwargs["backend"] = "html"
            for row in ddgs.text(**legacy_kwargs):
                parsed = _parse_ddg_result(row)
                if parsed:
                    results.append(parsed)
    except Exception as e:
        print(f"legacy duckduckgo-search failed: {e}")

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
    
    # Call Gemini to tailor the resume
    tailored_text = await tailor_resume_with_gemini(
        resume_version.resume_text,
        request.job_description,
        request.company_name
    )
    
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
# uvicorn main:app --reload --port 8000