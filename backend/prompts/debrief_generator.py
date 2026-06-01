DEBRIEF_GENERATOR_PROMPT = """
You are an expert interview evaluator. Analyze the full interview conversation and generate a structured debrief.

INTERVIEW CONTEXT:
- Company: {company}
- Candidate Resume: {resume_summary}
- Job Description: {jd_text}

FULL CONVERSATION HISTORY BY ROUND:

{rounds_summary}

Generate a structured JSON debrief with the following format:

{{
  "overall_score": <0-100 integer>,
  "per_round_scores": {{
    "dsa": <0-100 integer>,
    "technical": <0-100 integer>,
    "system_design": <0-100 integer>,
    "hr": <0-100 integer>
  }},
  "per_round_feedback": {{
    "dsa": "<specific feedback on DSA performance>",
    "technical": "<specific feedback on technical round>",
    "system_design": "<specific feedback on system design>",
    "hr": "<specific feedback on HR round>"
  }},
  "strengths": [
    "<strength 1 - specific to what they said>",
    "<strength 2 - specific to what they said>",
    "<strength 3 - specific to what they said>"
  ],
  "improvements": [
    "<improvement 1 - specific and actionable>",
    "<improvement 2 - specific and actionable>",
    "<improvement 3 - specific and actionable>"
  ],
  "hire_recommendation": "<strong yes / yes / borderline / no>",
  "hire_recommendation_reasoning": "<brief explanation>"
}}

Scoring guidelines:
- 90-100: Exceptional, ready for senior roles
- 80-89: Strong hire, meets all expectations
- 70-79: Good hire, minor gaps
- 60-69: Borderline, significant concerns
- Below 60: Not recommended

Be specific in feedback. Reference actual answers they gave. Don't be generic.
"""

def build_debrief_prompt(company: str, resume_summary: str, jd_text: str, rounds_summary: str) -> str:
    prompt = DEBRIEF_GENERATOR_PROMPT.format(
        company=company,
        resume_summary=resume_summary or "Not provided",
        jd_text=jd_text or "Not provided",
        rounds_summary=rounds_summary
    )
    return prompt


ROUND_SCORE_PROMPT = """
Evaluate this {round_type} interview round and generate a score with feedback.

ROUND CONTEXT:
- Company: {company}
- Round Type: {round_type}

CONVERSATION HISTORY:
{conversation_history}

Generate a JSON response with:
{{
  "score": <0-100 integer>,
  "feedback": {{
    "strengths": ["<strength 1>", "<strength 2>"],
    "weaknesses": ["<weakness 1>", "<weakness 2>"],
    "key_points": ["<observation 1>", "<observation 2>"],
    "overall_assessment": "<2-3 sentence summary>"
  }}
}}

Scoring criteria for {round_type}:
{scoring_criteria}
"""

DSA_SCORING = """
- Problem-solving approach and clarity
- Time/space complexity analysis
- Code quality and correctness
- Handling edge cases
- Communication of thought process
"""

TECHNICAL_SCORING = """
- Depth of project knowledge
- Understanding of architectural decisions
- Ability to justify technology choices
- Knowledge of CS fundamentals
- Practical engineering mindset
"""

SYSTEM_DESIGN_SCORING = """
- Requirements gathering skills
- Architecture design clarity
- Scalability considerations
- Tradeoff awareness
- Component design and data flow
"""

HR_SCORING = """
- Communication clarity
- STAR format usage
- Cultural fit indicators
- Authenticity and honesty
- Professional maturity
"""

def build_round_score_prompt(round_type: str, company: str, conversation_history: str) -> str:
    scoring_map = {
        "dsa": DSA_SCORING,
        "technical": TECHNICAL_SCORING,
        "system_design": SYSTEM_DESIGN_SCORING,
        "hr": HR_SCORING
    }
    
    criteria = scoring_map.get(round_type, "Overall performance")
    
    prompt = ROUND_SCORE_PROMPT.format(
        round_type=round_type,
        company=company,
        conversation_history=conversation_history,
        scoring_criteria=criteria
    )
    return prompt
