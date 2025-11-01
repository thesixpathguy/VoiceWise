import json
from app.schemas.schemas import InsightData
from app.core.config import settings
from app.prompts.insight_extraction import INSIGHT_EXTRACTION_PROMPT


class AIService:
    """Service for AI operations: insight extraction using Groq LLM"""
    
    def __init__(self):
        self.groq_api_key = settings.GROQ_API_KEY
        self.groq_api_url = "https://api.groq.com/openai/v1/chat/completions"
    
    async def extract_insights(self, transcript: str) -> InsightData:
        """
        Extract insights from transcript using Groq LLM
        
        Args:
            transcript: Call transcript text
        
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
            prompt = INSIGHT_EXTRACTION_PROMPT(transcript)
            
            headers = {
                "Authorization": f"Bearer {self.groq_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "llama-3.3-70b-versatile",  # Current production model
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an expert business analyst specializing in the fitness industry. Extract structured insights from gym member conversations. Always respond with valid JSON only."
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
            insights_dict = json.loads(content)
            print(f"✅ Successfully extracted insights: {insights_dict}")
            
            return InsightData(
                main_topics=insights_dict.get("main_topics", []),
                sentiment=insights_dict.get("sentiment", "neutral"),
                pain_points=insights_dict.get("pain_points", []),
                opportunities=insights_dict.get("opportunities", []),
                capital_interest=insights_dict.get("capital_interest", False),
                revenue_interest_quote=insights_dict.get("revenue_interest_quote"),
                confidence=insights_dict.get("confidence", 0.5)
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
