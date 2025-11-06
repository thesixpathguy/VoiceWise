import json
from typing import Optional, List, Dict, Any
from app.schemas.schemas import InsightData
from app.core.config import settings
from app.prompts.insight_extraction import INSIGHT_EXTRACTION_PROMPT


class AIService:
    """Service for AI operations: insight extraction using Groq LLM"""
    
    def __init__(self):
        self.groq_api_key = settings.GROQ_API_KEY
        self.groq_api_url = "https://api.groq.com/openai/v1/chat/completions"
    
    async def extract_insights(self, transcript: str, rag_context: str = "", custom_instructions: Optional[List[str]] = None) -> InsightData:
        """
        Extract insights from transcript using Groq LLM with optional RAG context
        
        Args:
            transcript: Call transcript text
            rag_context: Optional RAG context string to enhance extraction
            custom_instructions: Optional list of custom instructions to extract answers for
        
        Returns:
            InsightData with extracted information
        """
        # Debug: Log transcript info
        print(f"🔍 Extracting insights from transcript (length: {len(transcript) if transcript else 0} chars)")
        if transcript:
            print(f"📝 Transcript preview: {transcript[:200]}...")
        else:
            print("⚠️ WARNING: Empty transcript received!")
        
        if not self.groq_api_key:
            raise Exception("GROQ_API_KEY is not configured. Please set it in your .env file.")
        
        # Check if transcript is empty
        if not transcript or len(transcript.strip()) == 0:
            raise Exception("Cannot extract insights from empty transcript.")
        
        try:
            print(f"🤖 Calling Groq API for insight extraction...")
            base_prompt = INSIGHT_EXTRACTION_PROMPT(transcript, custom_instructions)
            
            # Enhance prompt with RAG context if provided
            if rag_context:
                prompt = f"""{rag_context}

{base_prompt}

USING THE CONTEXT ABOVE:
- Ensure consistency with similar past calls when possible - pattern matching, consistency validation
- Use historical benchmarks to validate your extraction - benchmark comparison, trend awareness
- Consider the patterns from high-quality examples - few-shot learning, quality reference
- IMP: However, extract truthfully from the current transcript (don't force alignment)
"""
            else:
                prompt = base_prompt
            
            headers = {
                "Authorization": f"Bearer {self.groq_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "meta-llama/llama-4-scout-17b-16e-instruct",  # Best model with high rate limits
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an expert business analyst specializing in the fitness industry. Extract structured insights from gym member conversations. CRITICAL: You MUST return ONLY valid JSON. Every property except the last one MUST have a trailing comma. Ensure all JSON syntax is correct and parseable."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.3,
                "max_tokens": 1500
            }
            
            # Use requests library with certifi for SSL
            import requests
            import certifi
            
            response = requests.post(
                self.groq_api_url,
                headers=headers,
                json=payload,
                timeout=60.0,
                verify=certifi.where()
            )
            
            # Log detailed error for debugging
            if response.status_code != 200:
                print(f"❌ Groq API error {response.status_code}: {response.text}")
            
            response.raise_for_status()
            result = response.json()
            
            # Parse AI response
            content = result["choices"][0]["message"]["content"]
            print(f"🤖 Groq API response received (length: {len(content)} chars)")
            print(f"📄 Raw response preview: {content[:300]}...")
            
            # Extract JSON from content (may have markdown code blocks)
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            print(f"📊 Parsing JSON response...")
            try:
                insights_dict = json.loads(content)
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse AI response as JSON: {str(e)}")
                print(f"Raw content: {content}")
                raise Exception(f"Failed to parse Groq API response as JSON: {str(e)}. The AI did not return valid JSON. Please check the prompt.")
            
            print(f"✅ Successfully extracted insights: {insights_dict}")
            
            # Round scores to 1 decimal place (churn_score, revenue_interest_score)
            # Default to 0.0 instead of None if not provided or null
            churn_score = insights_dict.get("churn_score")
            if churn_score is None:
                churn_score = 0.0
            else:
                churn_score = round(float(churn_score), 1)
                # Ensure it's within 0.0-1.0 range
                churn_score = max(0.0, min(1.0, churn_score))
            
            revenue_interest_score = insights_dict.get("revenue_interest_score")
            if revenue_interest_score is None:
                revenue_interest_score = 0.0
            else:
                revenue_interest_score = round(float(revenue_interest_score), 1)
                # Ensure it's within 0.0-1.0 range
                revenue_interest_score = max(0.0, min(1.0, revenue_interest_score))
            
            # Only include quotes if scores are >= 0.7
            churn_quote = insights_dict.get("churn_interest_quote")
            if churn_score < 0.7:
                churn_quote = None
            
            revenue_quote = insights_dict.get("revenue_interest_quote")
            if revenue_interest_score < 0.7:
                revenue_quote = None
            
            return InsightData(
                main_topics=insights_dict.get("main_topics", []),
                sentiment=insights_dict.get("sentiment", "neutral"),
                gym_rating=insights_dict.get("gym_rating"),
                pain_points=insights_dict.get("pain_points", []),
                opportunities=insights_dict.get("opportunities", []),
                churn_score=churn_score,
                churn_interest_quote=churn_quote,
                revenue_interest_score=revenue_interest_score,
                revenue_interest_quote=revenue_quote,
                confidence=insights_dict.get("confidence", 0.5),
                custom_instruction_answers=insights_dict.get("custom_instruction_answers")
            )
        
        except requests.exceptions.HTTPError as e:
            print(f"❌ Insight extraction HTTP error: {e}")
            print(f"Response: {e.response.text if hasattr(e, 'response') else 'No response'}")
            raise Exception(f"Groq API HTTP error: {e}")
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse AI response as JSON: {str(e)}")
            print(f"Raw content: {content if 'content' in locals() else 'N/A'}")
            raise Exception(f"Failed to parse Groq API response as JSON: {str(e)}")
        except Exception as e:
            print(f"❌ Insight extraction error: {str(e)}")
            raise
    
    async def analyze_live_call(
        self,
        user_conversation: str,
        previous_sentiment: Optional[str] = None,
        previous_churn_score: Optional[float] = None,
        previous_revenue_score: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Analyze sentiment, churn, revenue, and confidence from user conversation in live calls (fast, no RAG)
        
        Args:
            user_conversation: Only the USER's conversation turns (not agent)
            previous_sentiment: Previous sentiment if this is an update (None for first analysis)
            previous_churn_score: Previous churn score if this is an update (None for first analysis)
            previous_revenue_score: Previous revenue score if this is an update (None for first analysis)
        
        Returns:
            Dictionary with: sentiment, churn_score, revenue_interest_score, confidence
        """
        from app.prompts.live_call_analysis import LIVE_CALL_ANALYSIS_PROMPT
        
        if not self.groq_api_key:
            raise Exception("GROQ_API_KEY is not configured. Please set it in your .env file.")
        
        # Default values
        default_result = {
            "sentiment": "neutral",
            "churn_score": 0.0,
            "revenue_interest_score": 0.0,
            "confidence": 0.5
        }
        
        if not user_conversation or len(user_conversation.strip()) == 0:
            return default_result
        
        try:
            prompt = LIVE_CALL_ANALYSIS_PROMPT(
                user_conversation,
                previous_sentiment,
                previous_churn_score,
                previous_revenue_score
            )
            
            headers = {
                "Authorization": f"Bearer {self.groq_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an expert business analyst. Analyze conversation for sentiment, churn risk, revenue interest, and confidence. Return ONLY valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.23,  # Lower temperature for more consistent results
                "max_tokens": 400  # Slightly more tokens for all fields
            }
            
            import requests
            import certifi
            
            response = requests.post(
                self.groq_api_url,
                headers=headers,
                json=payload,
                timeout=15.0,  # Shorter timeout for real-time analysis
                verify=certifi.where()
            )
            
            if response.status_code != 200:
                print(f"❌ Groq API error {response.status_code}: {response.text}")
            
            response.raise_for_status()
            result = response.json()
            
            # Parse AI response
            content = result["choices"][0]["message"]["content"]
            
            # Extract JSON from content (may have markdown code blocks)
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            
            try:
                analysis_dict = json.loads(content)
                
                # Extract and validate sentiment
                sentiment = analysis_dict.get("sentiment", "neutral").lower()
                if sentiment not in ["positive", "neutral", "negative"]:
                    print(f"⚠️ Invalid sentiment '{sentiment}', defaulting to 'neutral'")
                    sentiment = "neutral"
                
                # Extract and validate churn_score
                churn_score = analysis_dict.get("churn_score", 0.0)
                if churn_score is None:
                    churn_score = 0.0
                else:
                    churn_score = round(float(churn_score), 1)
                    churn_score = max(0.0, min(1.0, churn_score))
                
                # Extract and validate revenue_interest_score
                revenue_score = analysis_dict.get("revenue_interest_score", 0.0)
                if revenue_score is None:
                    revenue_score = 0.0
                else:
                    revenue_score = round(float(revenue_score), 1)
                    revenue_score = max(0.0, min(1.0, revenue_score))
                
                # Extract and validate confidence
                confidence = analysis_dict.get("confidence", 0.5)
                if confidence is None:
                    confidence = 0.5
                else:
                    confidence = round(float(confidence), 2)
                    confidence = max(0.0, min(1.0, confidence))
                
                return {
                    "sentiment": sentiment,
                    "churn_score": churn_score,
                    "revenue_interest_score": revenue_score,
                    "confidence": confidence
                }
            except json.JSONDecodeError as e:
                print(f"❌ Failed to parse analysis response as JSON: {str(e)}")
                print(f"Raw content: {content}")
                return default_result
            except (ValueError, TypeError) as e:
                print(f"❌ Failed to parse analysis values: {str(e)}")
                print(f"Raw content: {content}")
                return default_result
        
        except Exception as e:
            print(f"❌ Live call analysis error: {str(e)}")
            return default_result