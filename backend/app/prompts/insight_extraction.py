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
1. Did the member provide a gym rating (1-10)? Extract it if mentioned.
   - Rating 8-10: Suggests POSITIVE sentiment
   - Rating 5-7: Suggests NEUTRAL sentiment  
   - Rating 1-4: Suggests NEGATIVE sentiment
2. Analyze the verbal feedback separately:
   - Positive words/phrases: compliments, praise, satisfaction, great, awesome, fantastic, wonderful, etc.
   - Neutral words/phrases: okay, fine, acceptable, average, decent, mediocre, etc.
   - Negative words/phrases: complaints, dissatisfaction, issues, bad, terrible, horrible, etc.
3. Determine sentiment with EQUAL WEIGHT to both rating and verbal feedback:
   - If rating and verbal feedback align (e.g., rating 9 + positive words) → clear sentiment
   - If rating and verbal feedback conflict (e.g., rating 8 but mentions complaints) → consider both equally and determine overall sentiment
   - If only rating OR only verbal feedback available → use the available signal
4. What topics were discussed in the conversation?
5. Are there any complaints, concerns, or pain points?
6. Did the member express interest in paid services or upgrades?
7. If yes, what EXACT sentence shows this interest?

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
gym_rating: null

Example 2:
Transcript: "Everything is fine. The equipment is good and staff is friendly. No complaints from me."
Analysis: No revenue interest expressed, general satisfaction
Quote: null
gym_rating: null
capital_interest: false

Example 3:
Transcript: "I love the classes here. Actually, I wanted to ask about your nutrition counseling program. Do you offer that?"
Analysis: Member inquired about nutrition counseling service
Quote: "I wanted to ask about your nutrition counseling program"
gym_rating: null
capital_interest: true

Example 4:
Transcript: "The gym is okay but it's too crowded during peak hours. I wish there were more cardio machines."
Analysis: Complaints about crowding and equipment, no revenue interest
Quote: null
gym_rating: null
capital_interest: false

Example 5:
Transcript: "I'm really enjoying my membership. I'm thinking of upgrading to the premium plan to get access to the spa and sauna."
Analysis: Member expressed interest in premium membership upgrade
gym_rating: null
Quote: "I'm thinking of upgrading to the premium plan to get access to the spa and sauna"
capital_interest: true

Example 6:
Transcript: "I'd give it an 8 out of 10, but honestly the staff has been really rude lately and the equipment is always broken."
Analysis: Rating is 8 but verbal feedback is very negative - weight both equally
sentiment: "neutral"  # Conflict resolved by considering both signals
gym_rating: 8
Quote: null
capital_interest: false

Example 7:
Transcript: "I'd rate it a 4, but actually I've been loving the new yoga classes and the trainers are fantastic!"
Analysis: Rating is 4 but verbal feedback is positive - weight both equally  
sentiment: "neutral"  # Conflict resolved
gym_rating: 4
capital_interest: true
Quote: "I've been loving the new yoga classes"

STEP 4 - EXTRACT FROM THIS TRANSCRIPT:
{transcript}

STEP 5 - RETURN STRUCTURED JSON (Structured Output):
{{
    "main_topics": [list of 2-5 main topics discussed in the feedback],
    "sentiment": "positive" | "neutral" | "negative",
    "gym_rating": number between 1-10 if mentioned in transcript, or null,
    "pain_points": [list of specific complaints, concerns, or issues mentioned by the member],
    "opportunities": [list of suggested improvements, requested services, or upsell opportunities],
    "capital_interest": true | false,
    "revenue_interest_quote": "exact verbatim sentence from transcript or null",
    "confidence": 0.0-1.0
}}

IMPORTANT: 
- Extract the gym rating (1-10) if the member mentioned it
- Give EQUAL WEIGHT to both the rating and verbal feedback when determining sentiment
- If rating is 8-10 AND verbal feedback is positive → "positive"
- If rating is 8-10 BUT verbal feedback is negative/mixed → consider both equally, may be "neutral" or "positive" depending on overall tone
- If rating is 5-7 OR verbal feedback is mixed/neutral → "neutral"  
- If rating is 1-4 AND verbal feedback is negative → "negative"
- If rating is 1-4 BUT verbal feedback is positive → consider both equally, may be "neutral" or "negative" depending on overall tone
- If only rating OR only verbal feedback available → use the available signal with full weight
- Balance both signals equally - don't let rating override verbal feedback or vice versa

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

