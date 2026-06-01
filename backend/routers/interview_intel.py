from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import AsyncSessionLocal
from schemas.interview_schemas import (
    StartSessionRequest,
    MessageRequest,
    CompleteRoundRequest,
    CompleteSessionRequest,
    InterviewSessionResponse,
    MessageResponse,
    InterviewDebriefResponse,
    SessionsListResponse
)
from services.interview_service import InterviewService

router = APIRouter(prefix="/interview", tags=["interview"])
security = HTTPBearer()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Extract user_id from JWT token (simplified - implement proper JWT validation)"""
    # For now, return the token as user_id (implement proper JWT validation in production)
    # In production, decode and validate the JWT token
    return credentials.credentials


@router.post("/session/start", response_model=InterviewSessionResponse)
async def start_session(
    request: StartSessionRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new interview session with 4 rounds"""
    try:
        service = InterviewService(db)
        session = await service.create_session(
            user_id=user_id,
            company_name=request.company_name,
            jd_text=request.jd_text,
            resume_snapshot=request.resume_snapshot,
            mode=request.mode,
            selected_rounds=request.selected_rounds
        )
        return session
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


import traceback

@router.get("/session/{session_id}", response_model=InterviewSessionResponse)
async def get_session(
    session_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get full session with current round status"""
    try:
        service = InterviewService(db)
        session = await service.get_session(session_id)
        
        # Verify user owns this session
        if session["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return session
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        traceback.print_exc()  # ← full error in server terminal
        raise HTTPException(status_code=500, detail=str(e))  # ← real message to frontend


@router.post("/session/{session_id}/message", response_model=MessageResponse)
async def send_message(
    session_id: str,
    request: MessageRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a message in the current round and get interviewer response"""
    try:
        service = InterviewService(db)
        
        # Verify user owns this session
        session = await service.get_session(session_id)
        if session["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        response = await service.send_message(session_id, request.content)
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()  # ← full error in server terminal
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/{session_id}/round/complete")
async def complete_round(
    session_id: str,
    request: CompleteRoundRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Manually complete the current round and trigger score generation"""
    try:
        service = InterviewService(db)
        
        # Verify user owns this session
        session = await service.get_session(session_id)
        if session["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        current_round = session["current_round"]
        if not current_round:
            raise HTTPException(status_code=400, detail="No active round")
        
        await service._complete_round(current_round["id"], session_id)
        await db.commit()
        
        return {"status": "success", "message": "Round completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/session/{session_id}/complete")
async def complete_session(
    session_id: str,
    request: CompleteSessionRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark session as complete and trigger full debrief generation"""
    try:
        service = InterviewService(db)
        
        # Verify user owns this session
        session = await service.get_session(session_id)
        if session["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        debrief = await service.complete_session(session_id)
        return debrief
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions", response_model=SessionsListResponse)
async def get_sessions(
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all past sessions for the user (for history page)"""
    try:
        service = InterviewService(db)
        sessions = await service.get_user_sessions(user_id)
        return {"sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/session/{session_id}/debrief", response_model=InterviewDebriefResponse)
async def get_debrief(
    session_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get full debrief report for a completed session"""
    try:
        service = InterviewService(db)
        
        # Verify user owns this session
        session = await service.get_session(session_id)
        if session["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        debrief = await service.get_debrief(session_id)
        return debrief
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
