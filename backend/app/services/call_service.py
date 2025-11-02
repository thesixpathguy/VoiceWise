from sqlalchemy.orm import Session
from typing import List, Optional
import httpx
import os
import asyncio
from datetime import datetime
from app.models.models import Call
from app.schemas.schemas import CallResponse, CallInitiateResponse, WebhookPayload
from app.services.ai_service import AIService
from app.core.config import settings
from app.prompts.call_script import CALL_SCRIPT_PROMPT


class CallService:
    """Service for managing call operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.bland_api_key = settings.BLAND_AI_API_KEY
        self.bland_api_url = "https://api.bland.ai/v1/calls"
        self.ai_service = AIService()
    
    async def initiate_batch_calls(
        self,
        phone_numbers: List[str],
        gym_id: str
    ) -> CallInitiateResponse:
        """
        Initiate multiple calls using Bland AI
        
        Args:
            phone_numbers: List of phone numbers to call
            gym_id: Gym identifier for tracking
        
        Returns:
            CallInitiateResponse with initiated calls
        """
        calls_initiated = []
        
        for index, phone_number in enumerate(phone_numbers):
            try:
                # Add 30-second delay between calls (Bland AI rate limit)
                if index > 0:
                    print(f"⏳ Waiting 30 seconds before next call (Bland AI rate limit)...")
                    await asyncio.sleep(30)
                
                # Call Bland AI API to initiate call
                call_id = await self._initiate_bland_call(phone_number, gym_id)
                
                # Store call in database
                call = Call(
                    call_id=call_id,
                    phone_number=phone_number,
                    gym_id=gym_id,
                    status="initiated"
                )
                self.db.add(call)
                self.db.commit()
                self.db.refresh(call)
                
                calls_initiated.append(
                    CallResponse(
                        phone_number=phone_number,
                        call_id=call_id,
                        status="initiated"
                    )
                )
            
            except Exception as e:
                print(f"❌ Failed to initiate call to {phone_number}: {str(e)}")
                # Continue with other numbers even if one fails
                calls_initiated.append(
                    CallResponse(
                        phone_number=phone_number,
                        call_id="failed",
                        status="failed"
                    )
                )
        
        return CallInitiateResponse(
            calls_initiated=calls_initiated,
            total=len(calls_initiated)
        )
    
    async def _initiate_bland_call(self, phone_number: str, gym_id: str) -> str:
        """
        Call Bland AI API to initiate a call
        
        Returns:
            call_id from Bland AI
        """
        if not self.bland_api_key:
            raise Exception("BLAND_AI_API_KEY is not configured. Please set it in your .env file.")
        
        headers = {
            "Authorization": f"Bearer {self.bland_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "phone_number": phone_number,
            "task": CALL_SCRIPT_PROMPT,
            "voice": "josh",  # Voice selection
            "max_duration": 180,  # 180 sec max
            "metadata": {
                "gym_id": gym_id
            }
        }
        
        # Only add webhook if it's configured and valid
        if settings.BLAND_AI_WEBHOOK_URL and settings.BLAND_AI_WEBHOOK_URL.startswith("https://"):
            payload["webhook"] = settings.BLAND_AI_WEBHOOK_URL
        
        # Fallback: Use curl command (system curl has newer SSL than Python's LibreSSL)
        try:
            import subprocess
            import json as json_module
            
            # Prepare curl command
            curl_command = [
                'curl',
                '-X', 'POST',
                self.bland_api_url,
                '-H', f'Authorization: {headers["Authorization"]}',
                '-H', f'Content-Type: {headers["Content-Type"]}',
                '-d', json_module.dumps(payload),
                '--max-time', '30'
            ]
            
            # Execute curl
            result = subprocess.run(
                curl_command,
                capture_output=True,
                text=True,
                check=True
            )
            
            # Log response for debugging
            print(f"📞 Bland AI Response: {result.stdout}")
            
            # Parse response
            data = json_module.loads(result.stdout)
            
            # Check for call_id in response
            call_id = data.get("call_id") or data.get("id") or data.get("call", {}).get("id")
            
            if not call_id:
                print(f"❌ Error: No call_id in response. Full response: {data}")
                raise Exception(f"Bland AI API did not return a call_id. Response: {data}")
            
            return call_id
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Bland AI API error (status {e.returncode}): {e.stderr}")
            print(f"📄 Response output: {e.stdout}")
            raise Exception(f"API call failed: {e.stderr}")
        except json_module.JSONDecodeError as e:
            print(f"❌ Failed to parse Bland AI response: {e}")
            print(f"� Raw output: {result.stdout}")
            raise Exception(f"Invalid JSON response from Bland AI")
        except Exception as e:
            print(f"❌ Bland AI API error: {str(e)}")
            raise
    
    def get_calls(
        self,
        gym_id: Optional[str] = None,
        status: Optional[str] = None,
        sentiment: Optional[str] = None,
        pain_point: Optional[str] = None,
        revenue_interest: Optional[bool] = None,
        limit: int = 50,
        skip: int = 0
    ) -> List[Call]:
        """
        Retrieve calls with optional filtering including insights-based filters
        
        Args:
            gym_id: Filter by gym
            status: Filter by status
            sentiment: Filter by sentiment (positive, neutral, negative)
            pain_point: Filter by specific pain point
            revenue_interest: Filter by revenue interest
            limit: Max results
            skip: Pagination offset
        
        Returns:
            List of Call objects
        """
        from app.models.models import Insight
        
        # Start with base query
        query = self.db.query(Call)
        
        # Apply basic filters
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        if status:
            query = query.filter(Call.status == status)
        
        # Apply insight-based filters (requires JOIN)
        if sentiment or pain_point or revenue_interest is not None:
            query = query.join(Insight, Call.call_id == Insight.call_id)
            
            if sentiment:
                query = query.filter(Insight.sentiment == sentiment)
            
            if pain_point:
                # Filter where pain_points array contains the specified pain point (case-insensitive)
                # Convert to lowercase to match how pain points are stored
                from sqlalchemy import any_
                
                pain_point_lower = pain_point.lower().strip()
                # Use PostgreSQL's ANY operator for array containment check
                query = query.filter(Insight.pain_points.any(pain_point_lower))
            
            if revenue_interest is not None:
                query = query.filter(Insight.revenue_interest == revenue_interest)
        
        query = query.order_by(Call.created_at.desc())
        query = query.offset(skip).limit(limit)
        
        return query.all()
    
    def get_call_by_id(self, call_id: str) -> Optional[Call]:
        """
        Get a specific call by ID
        
        Args:
            call_id: Unique call identifier
        
        Returns:
            Call object or None
        """
        return self.db.query(Call).filter(Call.call_id == call_id).first()
    
    def update_call_from_webhook(self, payload: WebhookPayload) -> Optional[Call]:
        """
        Update call information from webhook payload
        
        Args:
            payload: Webhook data from Bland AI
        
        Returns:
            Updated Call object
        """
        call = self.get_call_by_id(payload.call_id)
        
        if not call:
            return None
        
        # Update call fields from webhook
        call.status = payload.status
        
        # Convert call_length from minutes to seconds
        if payload.call_length:
            call.duration_seconds = int(payload.call_length * 60)
        
        # Store transcript from concatenated_transcript field
        if payload.concatenated_transcript:
            call.raw_transcript = payload.concatenated_transcript
            print(f"✅ Stored transcript for call {call.call_id} (length: {len(payload.concatenated_transcript)} chars)")
        else:
            print(f"⚠️ No transcript in webhook payload for call {call.call_id}")
        
        call.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(call)
        
        return call
    
    def delete_call(self, call_id: str) -> bool:
        """
        Delete a call and its insights
        
        Args:
            call_id: Unique call identifier
        
        Returns:
            True if deleted, False otherwise
        """
        call = self.get_call_by_id(call_id)
        
        if not call:
            return False
        
        try:
            self.db.delete(call)
            self.db.commit()
            return True
        except Exception as e:
            self.db.rollback()
            print(f"❌ Failed to delete call {call_id}: {str(e)}")
            return False
