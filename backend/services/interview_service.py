import uuid
import json
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update
from sqlalchemy.orm import selectinload

from services.gemini_service import GeminiService
from services.context_builder import ContextBuilder
from prompts import dsa_interviewer, technical_interviewer, system_design_interviewer, hr_interviewer, debrief_generator


class InterviewService:
    """Service for managing interview sessions and rounds"""
    
    # Round configuration
    ROUND_CONFIG = {
        "dsa": {
            "name": "DSA Round",
            "interviewer_name": "Arjun",
            "interviewer_persona": "Senior Software Engineer",
            "message_threshold": 14,  # 12-16 messages
            "order": 1
        },
        "technical": {
            "name": "Technical Round",
            "interviewer_name": "Priya",
            "interviewer_persona": "Tech Lead",
            "message_threshold": 12,  # 10-14 messages
            "order": 2
        },
        "system_design": {
            "name": "System Design Round",
            "interviewer_name": "Vikram",
            "interviewer_persona": "Principal Engineer",
            "message_threshold": 12,  # 10-14 messages
            "order": 3
        },
        "hr": {
            "name": "HR Round",
            "interviewer_name": "Sneha",
            "interviewer_persona": "HR Lead",
            "message_threshold": 10,  # 8-12 messages
            "order": 4
        }
    }
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.gemini = GeminiService()
        self.context_builder = ContextBuilder(db)
    
    async def create_session(
        self,
        user_id: str,
        company_name: str,
        jd_text: Optional[str] = None,
        resume_snapshot: Optional[Dict[str, Any]] = None,
        mode: str = "full",
        selected_rounds: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Create a new interview session with rounds"""
        from main import InterviewSessionTable, InterviewRoundTable

        # Create session
        session = InterviewSessionTable(
            user_id=uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
            company_name=company_name,
            jd_text=jd_text,
            resume_snapshot=json.dumps(resume_snapshot) if resume_snapshot else None,
            mode=mode,
            status="in_progress"
        )
        
        self.db.add(session)
        await self.db.flush()
        
        # Determine which rounds to create
        if mode == "single_round" and selected_rounds:
            rounds_to_create = selected_rounds
        else:
            rounds_to_create = ["dsa", "technical", "system_design", "hr"]
        
        # Create rounds
        for i, round_type in enumerate(rounds_to_create, 1):
            config = self.ROUND_CONFIG[round_type]
            round_obj = InterviewRoundTable(
                session_id=session.id,
                round_type=round_type,
                round_number=i,
                interviewer_name=config["interviewer_name"],
                interviewer_persona=config["interviewer_persona"],
                status="pending"
            )
            self.db.add(round_obj)
        
        await self.db.commit()
        
        # Return session with rounds
        return await self.get_session(str(session.id))
    
    async def get_session(self, session_id: str) -> Dict[str, Any]:
        """Get session with all rounds and current round info"""
        from main import InterviewSessionTable, InterviewRoundTable
        
        result = await self.db.execute(
            select(InterviewSessionTable)
            .where(InterviewSessionTable.id == uuid.UUID(session_id))
            .options(selectinload(InterviewSessionTable.rounds))
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise ValueError("Session not found")
        
        # Find current round (first pending or in_progress)
        current_round = None
        for round_obj in session.rounds:
            if round_obj.status in ["pending", "in_progress"]:
                current_round = round_obj
                break
        
        return {
            "id": str(session.id),
            "user_id": str(session.user_id),
            "company_name": session.company_name,
            "jd_text": session.jd_text,
            "resume_snapshot": json.loads(session.resume_snapshot) if session.resume_snapshot else None,
            "mode": session.mode,
            "status": session.status,
            "overall_score": session.overall_score,
            "created_at": session.created_at,
            "rounds": [
                {
                    "id": str(r.id),
                    "round_type": r.round_type,
                    "round_number": r.round_number,
                    "interviewer_name": r.interviewer_name,
                    "interviewer_persona": r.interviewer_persona,
                    "status": r.status,
                    "score": r.score,
                    "feedback": json.loads(r.feedback) if r.feedback else None,
                    "started_at": r.started_at,
                    "completed_at": r.completed_at
                }
                for r in session.rounds
            ],
            "current_round": {
                "id": str(current_round.id),
                "round_type": current_round.round_type,
                "round_number": current_round.round_number,
                "interviewer_name": current_round.interviewer_name,
                "interviewer_persona": current_round.interviewer_persona,
                "status": current_round.status,
                "score": current_round.score,
                "feedback": json.loads(current_round.feedback) if current_round.feedback else None,
                "started_at": current_round.started_at,
                "completed_at": current_round.completed_at
            } if current_round else None
        }
    
    async def send_message(
        self,
        session_id: str,
        user_message: str
    ) -> Dict[str, Any]:
        """Process user message and generate interviewer response"""
        from main import InterviewMessageTable, InterviewRoundTable
        
        # Get session
        session_data = await self.get_session(session_id)
        current_round = session_data["current_round"]
        
        if not current_round:
            raise ValueError("No active round")
        
        if current_round["status"] == "completed":
            raise ValueError("Round is already completed")
        
        # Save user message
        user_msg = InterviewMessageTable(
            session_id=uuid.UUID(session_id),
            round_id=uuid.UUID(current_round["id"]),
            role="user",
            content=user_message
        )
        self.db.add(user_msg)
        
        # Update round status if first message
        if current_round["status"] == "pending":
            await self.db.execute(
                update(InterviewRoundTable)
                .where(InterviewRoundTable.id == uuid.UUID(current_round["id"]))
                .values(status="in_progress", started_at=datetime.utcnow())
            )
        
        await self.db.flush()
        
        # Get conversation history for this round
        conversation_history = await self._get_round_conversation(current_round["id"])
        
        # Build prompt based on round type
        prompt = await self._build_interview_prompt(
            session_data,
            current_round,
            conversation_history
        )
        
        # Generate interviewer response
        interviewer_response = self.gemini.generate_interview_response(prompt)
        
        # Check for round completion
        round_complete = self.gemini.check_round_completion(interviewer_response)
        if round_complete:
            interviewer_response = self.gemini.strip_completion_token(interviewer_response)
        
        # Save interviewer message
        interviewer_msg = InterviewMessageTable(
            session_id=uuid.UUID(session_id),
            round_id=uuid.UUID(current_round["id"]),
            role="interviewer",
            content=interviewer_response
        )
        self.db.add(interviewer_msg)
        
        # Check message count threshold
        message_count = len(conversation_history) + 2  # +2 for user and interviewer messages
        threshold = self.ROUND_CONFIG[current_round["round_type"]]["message_threshold"]
        
        auto_complete = message_count >= threshold
        
        # If round should complete, mark it and generate score
        if round_complete or auto_complete:
            await self._complete_round(current_round["id"], session_id)
            next_action = "next_round"
        else:
            next_action = "continue"
        
        await self.db.commit()
        
        return {
            "message": {
                "id": str(interviewer_msg.id),
                "round_id": str(interviewer_msg.round_id),
                "role": interviewer_msg.role,
                "content": interviewer_msg.content,
                "created_at": interviewer_msg.created_at
            },
            "round_status": current_round["status"],
            "next_action": next_action,
            "round_complete": round_complete or auto_complete,
            "session_complete": False
        }
    
    async def _get_round_conversation(self, round_id: str) -> List[Dict[str, Any]]:
        """Get conversation history for a specific round"""
        from main import InterviewMessageTable
        
        result = await self.db.execute(
            select(InterviewMessageTable)
            .where(InterviewMessageTable.round_id == uuid.UUID(round_id))
            .order_by(InterviewMessageTable.created_at)
        )
        messages = result.scalars().all()
        
        return [
            {
                "role": msg.role,
                "content": msg.content
            }
            for msg in messages
        ]
    
    async def _build_interview_prompt(
        self,
        session_data: Dict[str, Any],
        current_round: Dict[str, Any],
        conversation_history: List[Dict[str, Any]]
    ) -> str:
        """Build the interview prompt based on round type"""
        round_type = current_round["round_type"]
        company_name = session_data["company_name"]
        resume_snapshot = session_data["resume_snapshot"] or {}
        
        # Get weak topics from context
        context = await self.context_builder.build_interview_context(
            session_data["user_id"],
            company_name,
            resume_snapshot,
            session_data["jd_text"]
        )
        
        if round_type == "dsa":
            weak_topics = context.get("dsa_patterns", {}).get("topics", [])
            return dsa_interviewer.build_dsa_prompt(company_name, weak_topics, conversation_history)
        
        elif round_type == "technical":
            project_name = resume_snapshot.get("projects", [{}])[0].get("name") if resume_snapshot.get("projects") else None
            tech_stack = resume_snapshot.get("skills", [])
            return technical_interviewer.build_technical_prompt(company_name, project_name, tech_stack, conversation_history)
        
        elif round_type == "system_design":
            company_domain = company_name  # Could be enhanced with company type detection
            return system_design_interviewer.build_system_design_prompt(company_name, company_domain, conversation_history)
        
        elif round_type == "hr":
            return hr_interviewer.build_hr_prompt(company_name, conversation_history)
        
        else:
            raise ValueError(f"Unknown round type: {round_type}")
    
    async def _complete_round(self, round_id: str, session_id: str):
        """Mark round as complete and generate score"""
        from main import InterviewRoundTable
        
        # Get conversation history
        conversation_history = await self._get_round_conversation(round_id)
        
        # Get round info
        result = await self.db.execute(
            select(InterviewRoundTable)
            .where(InterviewRoundTable.id == uuid.UUID(round_id))
        )
        round_obj = result.scalar_one()
        
        # Build score prompt
        conversation_text = "\n".join([
            f"{msg['role']}: {msg['content']}" 
            for msg in conversation_history
        ])
        
        score_prompt = debrief_generator.build_round_score_prompt(
            round_obj.round_type,
            round_obj.interviewer_name,  # Using interviewer name as proxy for company
            conversation_text
        )
        
        # Generate score
        score_data = self.gemini.generate_round_score(score_prompt)
        
        # Update round
        await self.db.execute(
            update(InterviewRoundTable)
            .where(InterviewRoundTable.id == uuid.UUID(round_id))
            .values(
                status="completed",
                score=score_data["score"],
                feedback=json.dumps(score_data["feedback"]),
                completed_at=datetime.utcnow()
            )
        )
    
    async def complete_session(self, session_id: str) -> Dict[str, Any]:
        """Mark session as complete and generate debrief"""
        from main import InterviewSessionTable, InterviewDebriefTable
        
        # Get session data
        session_data = await self.get_session(session_id)
        
        # Mark session as complete
        await self.db.execute(
            update(InterviewSessionTable)
            .where(InterviewSessionTable.id == uuid.UUID(session_id))
            .values(status="completed")
        )
        
        # Generate debrief
        debrief_data = await self._generate_debrief(session_data)
        
        # Calculate overall score
        overall_score = debrief_data["overall_score"]
        
        # Update session with overall score
        await self.db.execute(
            update(InterviewSessionTable)
            .where(InterviewSessionTable.id == uuid.UUID(session_id))
            .values(overall_score=overall_score)
        )
        
        # Save debrief
        debrief = InterviewDebriefTable(
            session_id=uuid.UUID(session_id),
            overall_score=overall_score,
            overall_feedback=json.dumps(debrief_data.get("overall_feedback", {})),
            round_breakdowns=json.dumps(debrief_data.get("per_round_feedback", {})),
            strengths=json.dumps(debrief_data.get("strengths", [])),
            improvements=json.dumps(debrief_data.get("improvements", []))
        )
        self.db.add(debrief)
        
        await self.db.commit()
        
        return debrief_data
    
    async def _generate_debrief(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        """Generate comprehensive debrief using Gemini"""
        # Get all messages
        from main import InterviewMessageTable
        
        result = await self.db.execute(
            select(InterviewMessageTable)
            .where(InterviewMessageTable.session_id == uuid.UUID(session_data["id"]))
            .order_by(InterviewMessageTable.created_at)
        )
        all_messages = result.scalars().all()
        
        # Build rounds summary
        rounds_summary = await self.context_builder.build_rounds_summary(
            session_data["rounds"],
            all_messages
        )
        
        # Get resume summary
        resume_summary = await self.context_builder.get_resume_summary(
            session_data["resume_snapshot"] or {}
        )
        
        # Build debrief prompt
        debrief_prompt = debrief_generator.build_debrief_prompt(
            session_data["company_name"],
            resume_summary,
            session_data["jd_text"],
            rounds_summary
        )
        
        # Generate debrief
        return self.gemini.generate_debrief(debrief_prompt)
    
    async def get_user_sessions(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all sessions for a user"""
        from main import InterviewSessionTable
        
        result = await self.db.execute(
            select(InterviewSessionTable)
            .where(InterviewSessionTable.user_id == uuid.UUID(user_id))
            .order_by(InterviewSessionTable.created_at.desc())
        )
        sessions = result.scalars().all()
        
        return [
            {
                "id": str(s.id),
                "company_name": s.company_name,
                "mode": s.mode,
                "status": s.status,
                "overall_score": s.overall_score,
                "created_at": s.created_at
            }
            for s in sessions
        ]
    
    async def get_debrief(self, session_id: str) -> Dict[str, Any]:
        """Get debrief for a completed session"""
        from main import InterviewDebriefTable
        
        result = await self.db.execute(
            select(InterviewDebriefTable)
            .where(InterviewDebriefTable.session_id == uuid.UUID(session_id))
        )
        debrief = result.scalar_one_or_none()
        
        if not debrief:
            raise ValueError("Debrief not found")
        
        return {
            "id": str(debrief.id),
            "session_id": str(debrief.session_id),
            "overall_score": debrief.overall_score,
            "overall_feedback": json.loads(debrief.overall_feedback) if debrief.overall_feedback else {},
            "round_breakdowns": json.loads(debrief.round_breakdowns) if debrief.round_breakdowns else {},
            "strengths": json.loads(debrief.strengths) if debrief.strengths else [],
            "improvements": json.loads(debrief.improvements) if debrief.improvements else [],
            "created_at": debrief.created_at
        }
