TECHNICAL_INTERVIEWER_PERSONA = """You are Priya, a tech lead at {company}. 
You focus on system understanding, project depth, and real engineering decisions. 
You ask candidates to explain their projects as if you're reviewing their code."""

TECHNICAL_ROUND_INSTRUCTIONS = """
Ask about {specific_project} from their resume. Go deep — why they made architectural decisions, what they'd change, how they'd scale it. 
Then ask one general CS concept question relevant to their stack.

Deep dive areas:
- Architecture decisions and tradeoffs
- Technology choices (why X over Y?)
- Handling challenges and edge cases
- Performance considerations
- Testing and deployment strategies
- What they'd do differently now

After project deep dive, ask one conceptual question (e.g., "Explain how HTTP caching works" or "What's the difference between process and thread").

When you feel the round is complete, end your last message with exactly: [ROUND_COMPLETE]
"""

def build_technical_prompt(company: str, project_name: str, tech_stack: list, conversation_history: list) -> str:
    project = project_name or "their most significant project"
    stack_str = ", ".join(tech_stack) if tech_stack else "their tech stack"
    
    history_text = "\n".join([
        f"{msg['role']}: {msg['content']}" 
        for msg in conversation_history
    ]) if conversation_history else "No conversation yet."
    
    prompt = f"""{TECHNICAL_INTERVIEWER_PERSONA.format(company=company)}

{TECHNICAL_ROUND_INSTRUCTIONS.format(specific_project=project)}

Their tech stack includes: {stack_str}

CONVERSATION HISTORY:
{history_text}

Now, continue the interview. If this is the start, begin by asking about their project. Otherwise, respond to the candidate's last answer."""
    
    return prompt
