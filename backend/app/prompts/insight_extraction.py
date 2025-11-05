"""
Insight Extraction Prompt for AI Analysis
Uses combined techniques: Chain-of-Thought, Few-Shot, Keyword Triggers, Structured Output
"""
from typing import Optional, List


def INSIGHT_EXTRACTION_PROMPT(transcript: str, custom_instructions: Optional[List[str]] = None) -> str:
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
        custom_instructions: Optional list of custom instructions to extract answers for
        
    Returns:
        Formatted prompt string
    """
    # Build custom instructions section for prompt
    custom_instructions_section = ""
    custom_instructions_prompt = ""
    custom_answers_json = ""
    
    if custom_instructions and len(custom_instructions) > 0:
        custom_instructions_section = "\n".join([f"{i+1}. {inst}" for i, inst in enumerate(custom_instructions)])
        custom_instructions_prompt = f"""
STEP 5 - CUSTOM INSTRUCTIONS PROCESSING:
For each custom instruction below, determine if it's a QUESTION or an INSTRUCTION, then process accordingly:
{custom_instructions_section}

PROCESSING RULES:

1. DETERMINE TYPE:
   - If the instruction ends with "?" or asks for information (e.g., "What is your preferred time?", "Ask about their goals"), it's a QUESTION
   - If it's a directive telling the agent what to do (e.g., "Mention the new yoga class", "Focus on equipment feedback"), it's an INSTRUCTION

2. FOR QUESTIONS (user-facing questions):
   - Extract the member's answer from the transcript (what the MEMBER said, not what Alex said)
   - Look for the member's response related to that question
   - Extract the EXACT answer or relevant quote from the transcript
   - If the member did not answer or the topic was not discussed, set answer to null
   - Format: {{"type": "question", "answer": "extracted answer or null"}}
   - DO NOT include "followed" or "summary" fields for questions

3. FOR INSTRUCTIONS (agent directives):
   - Evaluate whether the agent (Alex) followed the instruction by examining Alex's behavior in the transcript
   - Look at what Alex said and did, not what the member said
   - Summarize what happened related to the instruction (what Alex did or didn't do)
   - Determine if the instruction was followed (true/false)
   - Format: {{"type": "instruction", "followed": true/false, "summary": "brief summary of what Alex did or didn't do"}}
   - DO NOT include "answer" field for instructions
   - If the instruction was not followed, explain why in the summary
   - If the instruction was partially followed, set followed to false and explain in summary
   - The summary should focus on Alex's actions, not the member's responses

EXAMPLES:
- Question: "What is your preferred workout time?" 
  → {{"type": "question", "answer": "I usually go in the mornings"}}
  Note: No "followed" or "summary" fields for questions

- Question: "Ask about their goals" 
  → {{"type": "question", "answer": "I want to lose 20 pounds"}}
  Note: Extract what the member said, not what Alex asked

- Instruction: "Mention the new yoga class" 
  → {{"type": "instruction", "followed": true, "summary": "Alex mentioned the new yoga class starting next week during the conversation"}}
  Note: No "answer" field for instructions

- Instruction: "Focus on equipment feedback" 
  → {{"type": "instruction", "followed": false, "summary": "Alex did not specifically focus on equipment feedback, instead asked general questions about overall satisfaction"}}
  Note: Evaluate Alex's behavior, explain why instruction wasn't followed

- Instruction: "If they mention any issues, offer to connect them with a trainer"
  → {{"type": "instruction", "followed": true, "summary": "Member mentioned overcrowding issues, and Alex offered to connect them with a trainer to discuss alternative workout times"}}
"""
        # Build the JSON structure for custom instruction results
        instruction_lines = []
        for inst in custom_instructions:
            instruction_lines.append(f'        "{inst}": {{"type": "question|instruction", "answer": "extracted answer or null (only for questions)", "followed": true/false (only for instructions), "summary": "brief summary (only for instructions)"}}')
        custom_answers_json = f""",
    "custom_instruction_answers": {{
{chr(10).join(instruction_lines)}
    }}"""
    
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

STEP 2 - CHURN RISK DETECTION (Churn Segment):
Detect churn risk indicators:
- Explicit cancellation language: "thinking of canceling", "not renewing", "considering leaving", "not worth it", "waste of money"
- High frustration: "fed up", "disappointed", "terrible experience", "worst decision"
- Multiple severe complaints: equipment broken, unsafe conditions, rude staff, overcrowded
- Comparison to competitors: "other gyms are better", "found a better place"
- Low engagement: "barely go", "haven't been in months", "not using it"

CHURN SCORE CALCULATION (0.0-1.0, 1 decimal place):
- 0.0-0.3: Low churn risk - No cancellation indicators, satisfied member
- 0.4-0.6: Medium churn risk - Some complaints but no explicit cancellation intent
- 0.7-0.9: High churn risk - Multiple complaints OR explicit cancellation language
- 1.0: Critical churn risk - Explicit cancellation intent + multiple severe complaints

CHURN INTEREST QUOTE:
- ONLY extract the EXACT sentence/phrase showing churn intent if churn_score >= 0.7
- If churn_score < 0.7 or no churn indicators, churn_interest_quote = null
- Must be word-for-word from transcript
- IMPORTANT: Only include quote if the calculated churn_score is >= 0.7

STEP 3 - REVENUE INTEREST DETECTION (Revenue Segment):
Look for these indicators in the gym/fitness industry:
- Personal training interest or inquiries
- Nutrition counseling or meal planning services
- Premium/upgraded membership mentions
- Group class packages or specialized classes
- Specialized programs (yoga, CrossFit, pilates, etc.)
- Additional paid services (massage, physical therapy, etc.)
- Long-term commitment or contract extensions
- Family or couple membership upgrades

REVENUE INTEREST SCORE CALCULATION (0.0-1.0, 1 decimal place):
- 0.0: No revenue interest - No mentions of paid services
- 0.1-0.4: Low interest - Casual mention or asking about availability
- 0.5-0.7: Medium interest - Specific questions about services, pricing inquiries
- 0.8-0.9: High interest - Strong interest, "I'd love to", "I'm interested", "tell me more"
- 1.0: Critical interest - Ready to purchase, "I want to sign up", "when can I start"

REVENUE INTEREST QUOTE:
- ONLY extract the EXACT sentence/phrase showing revenue interest if revenue_interest_score >= 0.7
- If revenue_interest_score < 0.7 or no revenue interest, revenue_interest_quote = null
- Must be word-for-word from transcript
- IMPORTANT: Only include quote if the calculated revenue_interest_score is >= 0.7

STEP 4 - QUOTE EXTRACTION (Few-Shot Examples):

Example 1 (Revenue Interest):
Transcript: "The gym is great! I've been thinking about hiring a personal trainer to help me reach my goals faster."
Analysis: Member expressed strong interest in personal training (high engagement, specific service mention)
revenue_interest_score: 0.9 (high interest - strong language, specific service)
revenue_interest_quote: "I've been thinking about hiring a personal trainer to help me reach my goals faster"
churn_score: 0.0 (no churn indicators)
churn_interest_quote: null
gym_rating: null

Example 2 (No Interest):
Transcript: "Everything is fine. The equipment is good and staff is friendly. No complaints from me."
Analysis: General satisfaction, no revenue interest or churn indicators
revenue_interest_score: 0.0 (no revenue interest)
revenue_interest_quote: null
churn_score: 0.0 (no churn indicators, satisfied member)
churn_interest_quote: null
gym_rating: null

Example 3 (Revenue Interest - Medium):
Transcript: "I love the classes here. Actually, I wanted to ask about your nutrition counseling program. Do you offer that?"
Analysis: Member inquired about nutrition counseling service (specific question, medium engagement)
revenue_interest_score: 0.7 (medium-high interest - specific inquiry, but asking availability)
revenue_interest_quote: "I wanted to ask about your nutrition counseling program"
churn_score: 0.0 (no churn indicators)
churn_interest_quote: null
gym_rating: null

Example 4 (Churn Risk - Medium):
Transcript: "The gym is okay but it's too crowded during peak hours. I wish there were more cardio machines. Honestly, I'm thinking about canceling my membership because it's just not worth it anymore."
Analysis: Multiple complaints + explicit cancellation language indicates churn risk
churn_score: 0.8 (high churn risk - explicit cancellation intent + multiple complaints)
churn_interest_quote: "I'm thinking about canceling my membership because it's just not worth it anymore"
revenue_interest_score: 0.0 (no revenue interest)
revenue_interest_quote: null
gym_rating: null

Example 5 (Revenue Interest - High):
Transcript: "I'm really enjoying my membership. I'm thinking of upgrading to the premium plan to get access to the spa and sauna."
Analysis: Member expressed strong interest in premium membership upgrade (ready to upgrade)
revenue_interest_score: 1.0 (critical interest - ready to purchase/upgrade)
revenue_interest_quote: "I'm thinking of upgrading to the premium plan to get access to the spa and sauna"
churn_score: 0.0 (no churn indicators)
churn_interest_quote: null
gym_rating: null

Example 6 (Churn Risk - High):
Transcript: "I'd give it an 8 out of 10, but honestly the staff has been really rude lately and the equipment is always broken. I'm seriously considering switching to another gym. This place just isn't working for me anymore."
Analysis: Rating is 8 but explicit cancellation intent + multiple severe complaints
sentiment: "negative" (safety concerns and cancellation intent override positive rating)
gym_rating: 8
churn_score: 0.9 (critical churn risk - explicit cancellation intent + multiple severe complaints + competitor mention)
churn_interest_quote: "I'm seriously considering switching to another gym. This place just isn't working for me anymore"
revenue_interest_score: 0.0
revenue_interest_quote: null

Example 7 (Churn Risk - Medium):
Transcript: "I've been really frustrated with the equipment breaking down all the time. The weights are chipped and machines squeak constantly. It's been really disappointing. I'm not sure if I'll renew my membership."
Analysis: Multiple complaints + uncertainty about renewal (implicit churn risk)
churn_score: 0.7 (high churn risk - multiple complaints + renewal uncertainty)
churn_interest_quote: "I'm not sure if I'll renew my membership"
revenue_interest_score: 0.0
revenue_interest_quote: null
gym_rating: null

Example 8 (Both Churn and Revenue):
Transcript: "I've been thinking about canceling because the equipment is always broken, but I'd actually love to try personal training if that could help. Maybe that would make it worth staying."
Analysis: Explicit cancellation intent but also strong interest in personal training
churn_score: 0.8 (high churn risk - explicit cancellation language)
churn_interest_quote: "I've been thinking about canceling because the equipment is always broken"
revenue_interest_score: 0.8 (high interest - strong language about personal training)
revenue_interest_quote: "I'd actually love to try personal training if that could help"
gym_rating: null

Example 9 (Low Churn Risk):
Transcript: "The gym is okay but it's too crowded during peak hours. I wish there were more cardio machines."
Analysis: Some complaints but no cancellation indicators or strong frustration
churn_score: 0.4 (medium churn risk - complaints but no explicit cancellation intent)
churn_interest_quote: null (no explicit churn language)
revenue_interest_score: 0.0
revenue_interest_quote: null
gym_rating: null
{custom_instructions_prompt}
STEP 6 - EXTRACT FROM THIS TRANSCRIPT:
{transcript}

STEP 7 - RETURN STRUCTURED JSON (Structured Output):
CRITICAL JSON FORMATTING RULES:
- Return ONLY valid JSON, no additional text, explanations, or markdown code blocks
- EVERY property MUST be followed by a comma (,) except the LAST property before the closing brace
- Example CORRECT: "confidence": 0.92, "custom_instruction_answers": {{...}}
- Example INCORRECT: "confidence": 0.92 "custom_instruction_answers": {{...}} (missing comma)
- Double-check that EVERY property except the last one has a trailing comma
- Ensure all strings use double quotes ("), numbers are unquoted, null/true/false are lowercase
- The JSON must be valid and parseable by json.loads() without any modifications

JSON Structure:
{{
    "main_topics": [list of 2-5 main topics discussed in the feedback],
    "sentiment": "positive" | "neutral" | "negative",
    "gym_rating": number between 1-10 if mentioned in transcript, or null,
    "pain_points": [list of specific complaints, concerns, or issues mentioned by the member - for churn segment],
    "opportunities": [list of suggested improvements, requested services, or upsell opportunities - for revenue segment],
    "churn_score": 0.0-1.0 (1 decimal place, e.g., 0.0, 0.5, 0.8, 1.0). Use 0.0 if no churn indicators are present (never use null),
    "churn_interest_quote": "exact verbatim sentence from transcript showing churn intent or null",
    "revenue_interest_score": 0.0-1.0 (1 decimal place, e.g., 0.0, 0.5, 0.8, 1.0). Use 0.0 if no revenue interest is present (never use null),
    "revenue_interest_quote": "exact verbatim sentence from transcript showing revenue interest or null",
    "confidence": 0.00-1.00 (rounded to 2 decimal places, e.g., 0.75, 0.92, 0.35),{custom_answers_json}
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
- churn_interest_quote MUST be word-for-word from the transcript (no paraphrasing)
- revenue_interest_quote MUST be word-for-word from the transcript (no paraphrasing)
- If churn_score is 0.0 (or null for backward compatibility), churn_interest_quote MUST be null
- If revenue_interest_score is 0.0 (or null for backward compatibility), revenue_interest_quote MUST be null
- Only extract ONE most relevant quote for each (churn or revenue), not multiple
- Quotes should be complete sentences or meaningful phrases
- Do not paraphrase or summarize - use EXACT words from transcript
- Sentiment should reflect the member's overall satisfaction with the gym
- Pain points include any complaints, concerns, or dissatisfaction expressed (for churn segment)
- Opportunities include service requests, improvement suggestions, or interest in upgrades (for revenue segment)
- churn_score and revenue_interest_score are independent - a call can have both, neither, or one
- Calculate scores based on the criteria in STEP 2 and STEP 3 above
- For custom instructions: ALWAYS determine if it's a question or instruction first
- For questions: Extract the member's answer (what they said, not what the agent said)
- For instructions: Evaluate the agent's behavior, not the member's response
- Instructions evaluation: Look for evidence in the transcript that the agent (Alex) followed the instruction
- If instruction evaluation is unclear, set followed to false and explain why in summary

CONFIDENCE CALCULATION (CRITICAL - Calculate based on conversation quality):
The confidence score MUST be calculated to 2 decimal places (0.00-1.00, e.g., 0.75, 0.92, 0.35) based on these factors:
- Transcript length and detail: 
  * Very short/one-word responses or unclear speech → 0.10-0.40
  * Brief responses with minimal detail → 0.41-0.60
  * Good conversation with clear responses → 0.61-0.80
  * Detailed, comprehensive feedback → 0.80-1.00
- Clarity and completeness:
  * Member provided rating AND detailed feedback → higher confidence (0.71-1.00)
  * Member provided only rating OR only brief feedback → medium confidence (0.41-0.70)
  * Unclear or incomplete responses → lower confidence (0.20-0.40)
  * Very poor audio quality or unintelligible transcript → low confidence (0.10-0.35)
- Information quality:
  * Specific examples and details mentioned → higher confidence
  * Vague responses like "it's okay" → lower confidence
  * Member actively engaged in conversation → higher confidence
  * Member seemed distracted or uninterested → lower confidence

IMPORTANT: Dont give a default confidence score. Calculate confidence based on actual conversation quality.
Take weightage from the factors mentioned above.
For a bad call (poor audio, short responses, unclear feedback), confidence should be 0.2-0.4.
For a mediocre call, confidence should be 0.5-0.7.
For a good call, confidence should be 0.8-1.0.

Return ONLY valid JSON, no additional text or explanations."""

