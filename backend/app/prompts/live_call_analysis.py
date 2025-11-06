"""
Live Call Sentiment Analysis Prompt
Optimized for real-time, incremental sentiment analysis
"""
from typing import Optional


def LIVE_CALL_SENTIMENT_PROMPT(
    user_conversation: str,
    previous_sentiment: Optional[str] = None
) -> str:
    """
    Generate prompt for analyzing sentiment from user conversation in live calls.
    
    This is optimized for speed - no RAG, no anomaly detection, just sentiment analysis.
    
    Args:
        user_conversation: Only the USER's conversation turns (not agent)
        previous_sentiment: Previous sentiment if this is an update (None for first analysis)
        
    Returns:
        Formatted prompt string
    """
    previous_context = ""
    if previous_sentiment:
        previous_context = f"""
PREVIOUS SENTIMENT CONTEXT:
The previous sentiment analysis for this call was: {previous_sentiment.upper()}
Consider this previous sentiment when analyzing the new conversation turns.
The sentiment may evolve as the conversation progresses.
"""
    
    return f"""TASK: Analyze the sentiment from the USER's conversation in a live call.

{previous_context}

INSTRUCTIONS:
1. Analyze ONLY the USER's speech (customer/member), ignore AGENT speech
2. Determine the overall sentiment: "positive", "neutral", or "negative"
3. Consider:
   - Positive indicators: compliments, satisfaction, enthusiasm, positive words
   - Neutral indicators: neutral responses, factual statements, no strong emotion
   - Negative indicators: complaints, dissatisfaction, frustration, negative words
4. If previous sentiment exists, consider how the new conversation affects it:
   - Sentiment can stay the same, improve, or worsen
   - Focus on the overall trend and current state

USER CONVERSATION:
{user_conversation}

Return ONLY valid JSON in this format:
{{
    "sentiment": "positive" | "neutral" | "negative"
}}

CRITICAL: Return ONLY the JSON object, no additional text, explanations, or markdown."""

