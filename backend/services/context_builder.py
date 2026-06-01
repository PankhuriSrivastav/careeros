import json
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
import uuid


class ContextBuilder:
    """Builds interview context by fetching data from various sources"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def build_interview_context(
        self,
        user_id: str,
        company_name: str,
        resume_snapshot: Optional[Dict[str, Any]] = None,
        jd_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Assemble full interview context including:
        - Resume data
        - Company DSA patterns
        - User skill gaps
        - Job description
        """
        context = {
            "company_name": company_name,
            "resume_snapshot": resume_snapshot or {},
            "jd_text": jd_text,
            "dsa_patterns": await self._get_dsa_patterns(company_name),
            "skill_gaps": await self._get_skill_gaps(user_id),
        }
        
        return context
    
    async def _get_dsa_patterns(self, company_name: str) -> Optional[Dict[str, Any]]:
        """Fetch DSA patterns for the company from Coding Round Intel data"""
        try:
            # Try to load from the company_dsa_patterns.json file
            import os
            json_path = os.path.join(os.path.dirname(__file__), "..", "company_dsa_patterns.json")
            
            if os.path.exists(json_path):
                with open(json_path, 'r') as f:
                    all_patterns = json.load(f)
                
                # Normalize company name for matching
                company_lower = company_name.lower()
                
                for company_data in all_patterns:
                    if company_data.get("company", "").lower() == company_lower:
                        return {
                            "topics": company_data.get("topics", []),
                            "difficulty_distribution": company_data.get("difficulty_distribution", {}),
                            "frequent_patterns": company_data.get("frequent_patterns", [])
                        }
            
            return None
        except Exception as e:
            print(f"Error loading DSA patterns: {e}")
            return None
    
    async def _get_skill_gaps(self, user_id: str) -> List[str]:
        """Fetch skill gaps from Skill Gap Analyzer data"""
        try:
            # Import models from main.py
            from main import UserResumeTable

            # Get the latest resume for the user
            result = await self.db.execute(
                select(UserResumeTable)
                .where(UserResumeTable.user_id == (uuid.UUID(user_id) if isinstance(user_id, str) else user_id))
                .order_by(UserResumeTable.created_at.desc())
                .limit(1)
            )
            resume = result.scalar_one_or_none()

            if resume and resume.keywords:
                # Parse keywords to identify potential skill gaps
                # This is a simplified approach - in production, you'd call the actual Skill Gap Analyzer
                keywords_str = resume.keywords
                if isinstance(keywords_str, str):
                    keywords = keywords_str.split(",")
                else:
                    keywords = []

                # For now, return empty list - actual skill gap analysis would be more sophisticated
                return []

            return []
        except Exception as e:
            print(f"Error fetching skill gaps: {e}")
            return []
    
    async def get_resume_summary(self, resume_snapshot: Dict[str, Any]) -> str:
        """Generate a summary of the resume for debrief generation"""
        if not resume_snapshot:
            return "No resume data available"
        
        try:
            summary_parts = []
            
            if "projects" in resume_snapshot:
                projects = resume_snapshot["projects"]
                if isinstance(projects, list):
                    project_names = [p.get("name", "Unknown") for p in projects]
                    summary_parts.append(f"Projects: {', '.join(project_names)}")
            
            if "skills" in resume_snapshot:
                skills = resume_snapshot["skills"]
                if isinstance(skills, list):
                    summary_parts.append(f"Skills: {', '.join(skills[:10])}")  # Limit to top 10
            
            if "experience" in resume_snapshot:
                exp = resume_snapshot["experience"]
                summary_parts.append(f"Experience: {exp}")
            
            return " | ".join(summary_parts) if summary_parts else "Resume data available"
        except Exception as e:
            print(f"Error generating resume summary: {e}")
            return "Resume data available"
    
    async def build_rounds_summary(
        self,
        rounds: List[Any],
        messages: List[Any]
    ) -> str:
        """Build a summary of all rounds for debrief generation"""
        try:
            summary = []
            
            # Group messages by round
            round_messages = {}
            for msg in messages:
                round_id = str(msg.round_id)
                if round_id not in round_messages:
                    round_messages[round_id] = []
                round_messages[round_id].append(msg)
            
            for round_obj in rounds:
                round_id = str(round_obj.id)
                round_type = round_obj.round_type
                round_num = round_obj.round_number
                
                messages_list = round_messages.get(round_id, [])
                conversation = "\n".join([
                    f"{msg.role}: {msg.content}" 
                    for msg in messages_list
                ])
                
                summary.append(f"""
=== Round {round_num}: {round_type.upper()} ===
Interviewer: {round_obj.interviewer_name}
Status: {round_obj.status}
Score: {round_obj.score or 'Not scored'}

Conversation:
{conversation}
""")
            
            return "\n".join(summary)
        except Exception as e:
            print(f"Error building rounds summary: {e}")
            return "Unable to generate rounds summary"
