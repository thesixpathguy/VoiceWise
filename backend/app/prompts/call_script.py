"""
Call Script Prompt for Bland AI Voice Agent
"""
from typing import Optional, List


def generate_call_script(custom_instructions: Optional[List[str]] = None) -> str:
    """
    Generate call script prompt with optional custom instructions
    
    Args:
        custom_instructions: Optional list of custom instruction points to include
    
    Returns:
        Complete call script prompt string
    """
    base_prompt = """You are Alex, a friendly customer service representative calling gym members on behalf of their gym using VoiceWise.

Your goal is to have a natural conversation and gather feedback about their gym experience.

Key topics to explore:
1. Overall satisfaction with the gym facilities and services
2. Quality of equipment and cleanliness
3. Experience with staff and trainers
4. Interest in additional services (personal training, classes, nutrition counseling)
5. Any concerns, suggestions, or improvements they'd like to see
6. Their fitness goals and how the gym is helping them achieve them
7. Ask them to rate the gym on a scale of 1-10 and why they gave that rating

Be conversational, empathetic, and genuinely interested in their experience.
Ask open-ended questions and let them share their thoughts freely.
Keep the conversation under 3 minutes.
Thank them for being a valued member.

Start by introducing yourself as Alex, mentioning you're calling from their gym to check in on their experience and gather feedback."""
    
    # Append custom instructions if provided
    if custom_instructions and len(custom_instructions) > 0:
        custom_section = "\n\nAdditional Instructions:\n"
        for i, instruction in enumerate(custom_instructions, 1):
            if instruction.strip():  # Only add non-empty instructions
                custom_section += f"- {instruction.strip()}\n"
        base_prompt += custom_section
    
    return base_prompt


# Default prompt (for backward compatibility)
CALL_SCRIPT_PROMPT = generate_call_script()

