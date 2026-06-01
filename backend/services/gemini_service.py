import json
import os
from typing import Dict, Any, Optional

# Lazy import to avoid import errors when google-genai is not installed
genai = None
try:
    from google import genai
except ImportError:
    pass


class GeminiService:
    """Service for interacting with Google Gemini AI"""

    def __init__(self):
        self.client = None
        self.api_key = os.getenv("GEMINI_API_KEY")

        if self.api_key and genai:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                print(f"Failed to initialize Gemini client: {e}")
        elif self.api_key and not genai:
            print("⚠️ google-genai package not installed")
    
    def generate_interview_response(
        self,
        prompt: str,
        model: str = "gemini-2.0-flash-exp"
    ) -> str:
        """Generate a response for the interview conversation"""
        if not self.client:
            raise Exception("Gemini client not initialized. Set GEMINI_API_KEY and install google-genai")

        try:
            response = self.client.models.generate_content(
                model=model,
                contents=prompt
            )
            return response.text
        except Exception as e:
            print(f"Error generating interview response: {e}")
            raise
    
    def generate_round_score(
        self,
        prompt: str,
        model: str = "gemini-2.0-flash-exp"
    ) -> Dict[str, Any]:
        """Generate a score and feedback for a completed round"""
        if not self.client:
            raise Exception("Gemini client not initialized")
        
        try:
            response = self.client.models.generate_content(
                model=model,
                contents=prompt
            )
            
            # Parse JSON response
            response_text = response.text.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON response: {e}")
            print(f"Response text: {response_text}")
            # Return default score if parsing fails
            return {
                "score": 70,
                "feedback": {
                    "strengths": ["Unable to parse detailed feedback"],
                    "weaknesses": ["Please try again"],
                    "key_points": ["System error"],
                    "overall_assessment": "Unable to generate detailed feedback"
                }
            }
        except Exception as e:
            print(f"Error generating round score: {e}")
            raise
    
    def generate_debrief(
        self,
        prompt: str,
        model: str = "gemini-2.0-flash-exp"
    ) -> Dict[str, Any]:
        """Generate a comprehensive debrief for the completed interview"""
        if not self.client:
            raise Exception("Gemini client not initialized")
        
        try:
            response = self.client.models.generate_content(
                model=model,
                contents=prompt
            )
            
            # Parse JSON response
            response_text = response.text.strip()
            
            # Remove markdown code blocks if present
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            if response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"Error parsing debrief JSON: {e}")
            print(f"Response text: {response_text}")
            # Return default debrief if parsing fails
            return {
                "overall_score": 70,
                "per_round_scores": {
                    "dsa": 70,
                    "technical": 70,
                    "system_design": 70,
                    "hr": 70
                },
                "per_round_feedback": {
                    "dsa": "Unable to generate detailed feedback",
                    "technical": "Unable to generate detailed feedback",
                    "system_design": "Unable to generate detailed feedback",
                    "hr": "Unable to generate detailed feedback"
                },
                "strengths": ["Unable to parse detailed feedback"],
                "improvements": ["Please try again"],
                "hire_recommendation": "borderline",
                "hire_recommendation_reasoning": "System error occurred during debrief generation"
            }
        except Exception as e:
            print(f"Error generating debrief: {e}")
            raise
    
    def check_round_completion(self, response: str) -> bool:
        """Check if the response contains the round completion token"""
        return "[ROUND_COMPLETE]" in response
    
    def strip_completion_token(self, response: str) -> str:
        """Remove the round completion token from the response"""
        return response.replace("[ROUND_COMPLETE]", "").strip()
