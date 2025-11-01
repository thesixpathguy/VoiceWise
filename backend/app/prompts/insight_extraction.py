"""
Insight Extraction Prompt for AI Analysis
Uses combined techniques: Chain-of-Thought, Few-Shot, Keyword Triggers, Structured Output
"""


def INSIGHT_EXTRACTION_PROMPT(transcript: str) -> str:
    """
    Generate prompt for extracting insights from gym member feedback transcript.
    
    Combines 5 advanced techniques:
    1. Two-Stage Extraction
    2. Chain-of-Thought Reasoning
    3. Structured JSON Output
    4. Keyword Trigger Extraction
    5. Few-Shot Learning
    
    Args:
        transcript: The call transcript text
        
    Returns:
        Formatted prompt string
    """
    return f"""TASK: Analyze gym member feedback and extract structured insights with revenue interest quotes.

STEP 1 - REASONING (Chain-of-Thought):
Think through:
1. What is the overall sentiment of the member?
2. What topics were discussed in the conversation?
3. Are there any complaints, concerns, or pain points?
4. Did the member express interest in paid services or upgrades?
5. If yes, what EXACT sentence shows this interest?

STEP 2 - REVENUE INTEREST DETECTION (Keyword Triggers):
Look for these indicators in the gym/fitness industry:
- Personal training interest or inquiries
- Nutrition counseling or meal planning services
- Premium/upgraded membership mentions
- Group class packages or specialized classes
- Specialized programs (yoga, CrossFit, pilates, etc.)
- Additional paid services (massage, physical therapy, etc.)
- Long-term commitment or contract extensions
- Family or couple membership upgrades

STEP 3 - QUOTE EXTRACTION (Few-Shot Examples):

Example 1:
Transcript: "The gym is great! I've been thinking about hiring a personal trainer to help me reach my goals faster."
Analysis: Member expressed interest in personal training
Quote: "I've been thinking about hiring a personal trainer to help me reach my goals faster"
capital_interest: true

Example 2:
Transcript: "Everything is fine. The equipment is good and staff is friendly. No complaints from me."
Analysis: No revenue interest expressed, general satisfaction
Quote: null
capital_interest: false

Example 3:
Transcript: "I love the classes here. Actually, I wanted to ask about your nutrition counseling program. Do you offer that?"
Analysis: Member inquired about nutrition counseling service
Quote: "I wanted to ask about your nutrition counseling program"
capital_interest: true

Example 4:
Transcript: "The gym is okay but it's too crowded during peak hours. I wish there were more cardio machines."
Analysis: Complaints about crowding and equipment, no revenue interest
Quote: null
capital_interest: false

Example 5:
Transcript: "I'm really enjoying my membership. I'm thinking of upgrading to the premium plan to get access to the spa and sauna."
Analysis: Member expressed interest in premium membership upgrade
Quote: "I'm thinking of upgrading to the premium plan to get access to the spa and sauna"
capital_interest: true

STEP 4 - EXTRACT FROM THIS TRANSCRIPT:
{transcript}

STEP 5 - RETURN STRUCTURED JSON (Structured Output):
{{
    "main_topics": [list of 2-5 main topics discussed in the feedback],
    "sentiment": "positive" | "neutral" | "negative",
    "pain_points": [list of specific complaints, concerns, or issues mentioned by the member],
    "opportunities": [list of suggested improvements, requested services, or upsell opportunities],
    "capital_interest": true | false,
    "revenue_interest_quote": "exact verbatim sentence from transcript or null",
    "confidence": 0.0-1.0
}}

CRITICAL RULES:
- revenue_interest_quote MUST be word-for-word from the transcript (no paraphrasing)
- If capital_interest is false, revenue_interest_quote MUST be null
- Only extract ONE most relevant quote showing revenue interest (not multiple)
- Quote should be a complete sentence or meaningful phrase
- Do not paraphrase or summarize - use EXACT words from transcript
- Sentiment should reflect the member's overall satisfaction with the gym
- Pain points include any complaints, concerns, or dissatisfaction expressed
- Opportunities include service requests, improvement suggestions, or interest in upgrades
- Capital interest means interest in premium/paid services (personal training, nutrition plans, upgraded memberships)
- Confidence should reflect clarity of the conversation and information quality
- Return ONLY valid JSON, no additional text or explanations

JSON:"""

