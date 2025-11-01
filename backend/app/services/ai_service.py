import os
import httpx
import json
from typing import Optional
from app.schemas.schemas import InsightData
from app.core.config import settings


class AIService:
    """Service for AI operations: transcription and insight extraction"""
    
    def __init__(self):
        self.groq_api_key = settings.GROQ_API_KEY
        self.groq_api_url = "https://api.groq.com/openai/v1/chat/completions"
        self.groq_audio_url = "https://api.groq.com/openai/v1/audio/transcriptions"
    
    async def transcribe_audio(self, audio_url: str) -> Optional[str]:
        """
        Transcribe audio using Groq Whisper API
        
        Args:
            audio_url: URL to the audio recording
        
        Returns:
            Transcript text or None
        """
        if not self.groq_api_key:
            return "This is a sample transcript. The gym member expressed satisfaction with the facilities but mentioned the gym is crowded during peak hours. They showed interest in personal training services and suggested adding more cardio equipment."
        
        try:
            # Use requests library with certifi for SSL
            import requests
            import certifi
            
            # Download audio file
            audio_response = requests.get(audio_url, timeout=60.0, verify=certifi.where())
            audio_response.raise_for_status()
            audio_data = audio_response.content
            
            # Transcribe using Groq Whisper
            headers = {
                "Authorization": f"Bearer {self.groq_api_key}"
            }
            
            files = {
                "file": ("recording.mp3", audio_data, "audio/mpeg")
            }
            
            data = {
                "model": "whisper-large-v3",
                "response_format": "json",
                "language": "en"
            }
            
            response = requests.post(
                self.groq_audio_url,
                headers=headers,
                files=files,
                data=data,
                timeout=120.0,
                verify=certifi.where()
            )
            response.raise_for_status()
            result = response.json()
            
            return result.get("text", "")
        
        except Exception as e:
            print(f"❌ Transcription error: {str(e)}")
            return None
    
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
            print("⚠️ No Groq API key found - returning mock data")
            # Return mock data for development
            return InsightData(
                main_topics=["equipment quality", "class schedules", "facility cleanliness"],
                sentiment="positive",
                pain_points=["crowded during peak hours", "needs more cardio machines"],
                opportunities=["interested in personal training", "nutrition counseling interest"],
                capital_interest=True,
                confidence=0.85
            )
        
        # Check if transcript is empty
        if not transcript or len(transcript.strip()) == 0:
            print("⚠️ Empty transcript - returning default insights")
            return InsightData(
                main_topics=["no conversation"],
                sentiment="neutral",
                pain_points=[],
                opportunities=[],
                capital_interest=False,
                confidence=0.0
            )
        
        try:
            print(f"🤖 Calling Groq API for insight extraction...")
            prompt = self._build_insight_prompt(transcript)
            
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
                confidence=insights_dict.get("confidence", 0.5)
            )
        
        except requests.exceptions.HTTPError as e:
            print(f"❌ Insight extraction HTTP error: {e}")
            print(f"Response: {e.response.text if hasattr(e, 'response') else 'No response'}")
            # Return default insights on error
            return InsightData(
                main_topics=["general discussion"],
                sentiment="neutral",
                pain_points=[],
                opportunities=[],
                capital_interest=False,
                confidence=0.0
            )
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse AI response as JSON: {str(e)}")
            print(f"Raw content: {content if 'content' in locals() else 'N/A'}")
            # Return default insights on error
            return InsightData(
                main_topics=["general discussion"],
                sentiment="neutral",
                pain_points=[],
                opportunities=[],
                capital_interest=False,
                confidence=0.0
            )
        except Exception as e:
            print(f"❌ Insight extraction error: {str(e)}")
            # Return default insights on error
            return InsightData(
                main_topics=["general discussion"],
                sentiment="neutral",
                pain_points=[],
                opportunities=[],
                capital_interest=False,
                confidence=0.0
            )
    
    def _build_insight_prompt(self, transcript: str) -> str:
        """Build the prompt for insight extraction"""
        return f"""
Analyze this customer feedback call from a gym member and extract structured insights.

TRANSCRIPT:
{transcript}

Extract the following information and return as JSON:

{{
    "main_topics": [list of 2-5 main topics discussed in the feedback],
    "sentiment": "positive" | "neutral" | "negative",
    "pain_points": [list of specific complaints, concerns, or issues mentioned by the member],
    "opportunities": [list of suggested improvements, requested services, or upsell opportunities],
    "capital_interest": true/false (indicates interest in premium services, personal training, or higher-tier memberships),
    "confidence": 0.0-1.0 (your confidence in the analysis)
}}

Guidelines:
- Be specific and extract actual feedback mentioned, not generic assumptions
- Sentiment should reflect the member's overall satisfaction with the gym
- Pain points include any complaints, concerns, or dissatisfaction expressed
- Opportunities include service requests, improvement suggestions, or interest in upgrades
- Capital interest means interest in premium/paid services (personal training, nutrition plans, upgraded memberships)
- Confidence should reflect clarity of the conversation and information quality
- Return valid JSON only, no additional text

JSON:
"""
