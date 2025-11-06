"""
Live Call Analysis Prompt
Optimized for real-time, incremental analysis (sentiment, churn, revenue, confidence)
"""
from typing import Optional


def LIVE_CALL_ANALYSIS_PROMPT(
    user_conversation: str,
    previous_sentiment: Optional[str] = None,
    previous_churn_score: Optional[float] = None,
    previous_revenue_score: Optional[float] = None
) -> str:
    """
    Generate prompt for analyzing sentiment, churn, revenue, and confidence from user conversation in live calls.
    
    This is optimized for speed - no RAG, no anomaly detection, just essential analysis.
    
    Args:
        user_conversation: Only the USER's conversation turns (not agent)
        previous_sentiment: Previous sentiment if this is an update (None for first analysis)
        previous_churn_score: Previous churn score if this is an update (None for first analysis)
        previous_revenue_score: Previous revenue score if this is an update (None for first analysis)
        
    Returns:
        Formatted prompt string
    """
    previous_context = ""
    if previous_sentiment or previous_churn_score is not None or previous_revenue_score is not None:
        context_parts = []
        if previous_sentiment:
            context_parts.append(f"Previous sentiment: {previous_sentiment.upper()}")
        if previous_churn_score is not None:
            context_parts.append(f"Previous churn_score: {previous_churn_score:.1f}")
        if previous_revenue_score is not None:
            context_parts.append(f"Previous revenue_interest_score: {previous_revenue_score:.1f}")
        
        previous_context = f"""
PREVIOUS ANALYSIS CONTEXT:
{chr(10).join(context_parts)}
Consider these previous values when analyzing the new conversation turns.
Values may evolve as the conversation progresses.
"""
    
    return f"""TASK: Analyze sentiment, churn risk, revenue interest, and confidence from the USER's conversation in a live call.

{previous_context}

INSTRUCTIONS:
1. Analyze ONLY the USER's speech (customer/member), ignore AGENT speech
2. Determine the overall sentiment: "positive", "neutral", or "negative"
3. Calculate churn_score (0.0-1.0, 1 decimal place):
   - 0.0-0.3: Low churn risk - No cancellation indicators, satisfied member
   - 0.4-0.6: Medium churn risk - Some complaints but no explicit cancellation intent
   - 0.7-0.9: High churn risk - Multiple complaints OR explicit cancellation language
   - 1.0: Critical churn risk - Explicit cancellation intent + multiple severe complaints
   - Look for: "thinking of canceling", "not renewing", "considering leaving", "not worth it", "waste of money", "switching to another gym"
4. Calculate revenue_interest_score (0.0-1.0, 1 decimal place):
   - 0.0: No revenue interest - No mentions of paid services
   - 0.1-0.4: Low interest - Casual mention or asking about availability
   - 0.5-0.7: Medium interest - Specific questions about services, pricing inquiries
   - 0.8-0.9: High interest - Strong interest, "I'd love to", "I'm interested", "tell me more"
   - 1.0: Critical interest - Ready to purchase, "I want to sign up", "when can I start"
   - Look for: personal training, nutrition counseling, premium membership, group classes, specialized programs
5. Calculate confidence (0.0-1.0, 2 decimal places):
   - Based on conversation quality, clarity, and completeness
   - Very short/unclear responses: 0.20-0.40
   - Brief responses: 0.41-0.60
   - Good conversation: 0.61-0.80
   - Detailed feedback: 0.81-1.00
6. If previous values exist, consider how the new conversation affects them:
   - Values can stay the same, improve, or worsen
   - Focus on the overall trend and current state

USER CONVERSATION:
{user_conversation}

Return ONLY valid JSON in this format:
{{
    "sentiment": "positive" | "neutral" | "negative",
    "churn_score": 0.0-1.0 (1 decimal place, e.g., 0.0, 0.5, 0.8, 1.0),
    "revenue_interest_score": 0.0-1.0 (1 decimal place, e.g., 0.0, 0.5, 0.8, 1.0),
    "confidence": 0.00-1.00 (2 decimal places, e.g., 0.75, 0.92, 0.35)
}}

CRITICAL: Return ONLY the JSON object, no additional text, explanations, or markdown."""

