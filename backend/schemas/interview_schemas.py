from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


# Request Schemas
class StartSessionRequest(BaseModel):
    company_name: str
    jd_text: Optional[str] = None
    resume_snapshot: Optional[Dict[str, Any]] = None
    mode: str = Field(default="full", description="full or single_round")
    selected_rounds: Optional[List[str]] = Field(default=None, description="List of round types if single_round mode")


class MessageRequest(BaseModel):
    content: str


class CompleteRoundRequest(BaseModel):
    pass


class CompleteSessionRequest(BaseModel):
    pass


# Response Schemas
class InterviewRoundResponse(BaseModel):
    id: UUID
    round_type: str
    round_number: int
    interviewer_name: str
    interviewer_persona: Optional[str]
    status: str
    score: Optional[int]
    feedback: Optional[Dict[str, Any]]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class InterviewMessageResponse(BaseModel):
    id: UUID
    round_id: UUID
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class InterviewSessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    company_name: str
    jd_text: Optional[str]
    resume_snapshot: Optional[Dict[str, Any]]
    mode: str
    status: str
    overall_score: Optional[int]
    created_at: datetime
    rounds: List[InterviewRoundResponse]
    current_round: Optional[InterviewRoundResponse]

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: InterviewMessageResponse
    round_status: str
    next_action: Optional[str] = None
    round_complete: bool = False
    session_complete: bool = False


class InterviewDebriefResponse(BaseModel):
    id: UUID
    session_id: UUID
    overall_score: int
    overall_feedback: Dict[str, Any]
    round_breakdowns: Dict[str, Any]
    strengths: List[str]
    improvements: List[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SessionListItem(BaseModel):
    id: UUID
    company_name: str
    mode: str
    status: str
    overall_score: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class SessionsListResponse(BaseModel):
    sessions: List[SessionListItem]


# Internal Schemas (not exposed to API)
class InterviewContext(BaseModel):
    company_name: str
    resume_snapshot: Dict[str, Any]
    jd_text: Optional[str]
    dsa_patterns: Optional[Dict[str, Any]]
    skill_gaps: Optional[List[str]]
    current_round: InterviewRoundResponse
    conversation_history: List[InterviewMessageResponse]


class RoundScoreRequest(BaseModel):
    session_id: UUID
    round_id: UUID
    conversation_history: List[InterviewMessageResponse]
    round_type: str


class RoundScoreResponse(BaseModel):
    score: int
    feedback: Dict[str, Any]


class DebriefRequest(BaseModel):
    session_id: UUID
    all_rounds: List[InterviewRoundResponse]
    all_messages: List[InterviewMessageResponse]
    resume_snapshot: Dict[str, Any]
    company_name: str
    jd_text: Optional[str]
