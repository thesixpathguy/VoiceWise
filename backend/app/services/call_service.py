from sqlalchemy.orm import Session
from typing import List, Optional
import httpx
import os
import asyncio
from datetime import datetime
from app.models.models import Call
from app.schemas.schemas import CallResponse, CallInitiateResponse, WebhookPayload, LiveCall, ConversationTurn
from app.services.ai_service import AIService
from app.services.cache_service import CacheService
from app.core.config import settings
from app.prompts.call_script import generate_call_script


class CallService:
    """Service for managing call operations"""
    
    def __init__(self, db: Session):
        self.db = db
        self.bland_api_keys_list = settings.bland_ai_api_keys_list  # List of API keys for round-robin
        self.bland_api_url = "https://api.bland.ai/v1/calls"
        self.ai_service = AIService()
    
    async def initiate_batch_calls(
        self,
        phone_numbers: List[str],
        gym_id: str,
        custom_instructions: Optional[List[str]] = None
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
                    print(f"⏳ Waiting 85 seconds before next call (Bland AI rate limit)...")
                    print(f"phone_number: {phone_number}")
                    await asyncio.sleep(85)
                
                # Simple toggle for round-robin: alternate between API key 0 and 1
                api_key_index = index % 2
                print(f"🔄 Round-robin: Call #{index} → Using API key index {api_key_index}")
                
                # Call Bland AI API to initiate call with selected API key
                call_id = await self._initiate_bland_call(phone_number, gym_id, custom_instructions, api_key_index)
                
                # Store call in database with api_key_index
                call = Call(
                    call_id=call_id,
                    phone_number=phone_number,
                    gym_id=gym_id,
                    status="initiated",
                    api_key_index=api_key_index,  # Track which API key was used
                    custom_instructions=custom_instructions if custom_instructions else None
                )
                self.db.add(call)
                self.db.commit()
                self.db.refresh(call)
                
                calls_initiated.append(
                    CallResponse(
                        phone_number=phone_number,
                        call_id=call_id,
                        status="initiated",
                        api_key_index=api_key_index  # Include the key index
                    )
                )
            
            except Exception as e:
                print(f"❌ Failed to initiate call to {phone_number}: {str(e)}")
                # Continue with other numbers even if one fails
                api_key_index = index % 2  # Still track which key would have been used
                calls_initiated.append(
                    CallResponse(
                        phone_number=phone_number,
                        call_id="failed",
                        status="failed",
                        api_key_index=api_key_index
                    )
                )
        
        return CallInitiateResponse(
            calls_initiated=calls_initiated,
            total=len(calls_initiated)
        )
    
    async def _initiate_bland_call(
        self, 
        phone_number: str, 
        gym_id: str, 
        custom_instructions: Optional[List[str]] = None,
        api_key_index: int = 0
    ) -> str:
        """
        Call Bland AI API to initiate a call with specified API key
        
        Args:
            phone_number: Number to call
            gym_id: Gym identifier
            custom_instructions: Optional instructions
            api_key_index: Which API key to use (0 or 1)
        
        Returns:
            call_id from Bland AI
        """
        # Select API key based on index
        api_key = self.bland_api_keys_list[api_key_index]
        
        if not api_key:
            raise Exception(f"BLAND_AI_API_KEY at index {api_key_index} is not configured.")
        
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        
        # Generate call script with custom instructions
        call_script = generate_call_script(custom_instructions)
        
        payload = {
            "phone_number": phone_number,
            "task": call_script,
            "voice": "josh",  # Voice selection
            "max_duration": 180,  # 180 sec max
            "metadata": {
                "gym_id": gym_id
            }
        }
        
        # Only add webhook if it's configured and valid
        if settings.BLAND_AI_WEBHOOK_URL and settings.BLAND_AI_WEBHOOK_URL.startswith("https://"):
            payload["webhook"] = settings.BLAND_AI_WEBHOOK_URL
            payload["webhook_events"] = ["call"]
        
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
        opportunity: Optional[str] = None,
        revenue_interest: Optional[bool] = None,
        churn_min_score: Optional[float] = None,
        revenue_min_score: Optional[float] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        order_by: Optional[str] = None,  # "churn_score_desc", "revenue_score_desc", "created_at_desc" (default)
        limit: int = 50,
        skip: int = 0
    ) -> tuple[List[Call], int]:
        """
        Retrieve calls with optional filtering including insights-based filters
        
        Args:
            gym_id: Filter by gym
            status: Filter by status
            sentiment: Filter by sentiment (positive, neutral, negative)
            pain_point: Filter by specific pain point
            opportunity: Filter by specific opportunity
            revenue_interest: Filter by revenue interest (boolean legacy)
            churn_min_score: Filter by minimum churn score (for drill-down)
            revenue_min_score: Filter by minimum revenue interest score (for drill-down)
            start_date: Filter by start date (ISO format string)
            end_date: Filter by end date (ISO format string)
            order_by: Order results ("churn_score_desc", "revenue_score_desc", "created_at_desc")
            limit: Max results
            skip: Pagination offset
        
        Returns:
            Tuple of (List of Call objects, total_count)
        """
        from app.models.models import Insight
        from datetime import datetime
        
        # Start with base query
        query = self.db.query(Call)
        
        # Apply basic filters
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        if status:
            query = query.filter(Call.status == status)
        
        # Apply date range filters
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                query = query.filter(Call.created_at >= start_dt)
            except (ValueError, AttributeError):
                pass  # Invalid date format, skip filter
        
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                query = query.filter(Call.created_at <= end_dt)
            except (ValueError, AttributeError):
                pass  # Invalid date format, skip filter
        
        # Apply insight-based filters (requires JOIN)
        # OPTIMIZED: Use inner join for better performance when ordering by score
        needs_join = (
            sentiment or pain_point or opportunity or 
            revenue_interest is not None or 
            churn_min_score is not None or 
            revenue_min_score is not None or
            order_by in ["churn_score_desc", "revenue_score_desc"]
        )
        
        if needs_join:
            # Use inner join for better performance - only get calls with insights
            query = query.join(Insight, Call.call_id == Insight.call_id)
            
            # Add confidence filter early to reduce dataset size
            query = query.filter(Insight.confidence >= 0.3)
            
            if sentiment:
                query = query.filter(Insight.sentiment == sentiment)
            
            if pain_point:
                # Filter where pain_points array contains the specified pain point (case-insensitive)
                pain_point_lower = pain_point.lower().strip()
                query = query.filter(Insight.pain_points.any(pain_point_lower))
            
            if opportunity:
                # Filter where opportunities array contains the specified opportunity (case-insensitive)
                opportunity_lower = opportunity.lower().strip()
                query = query.filter(Insight.opportunities.any(opportunity_lower))
            
            if revenue_interest is not None:
                # Convert boolean filter to score threshold (>= 0.75 for True, < 0.75 for False)
                if revenue_interest:
                    query = query.filter(Insight.revenue_interest_score >= 0.75)
                else:
                    query = query.filter(
                        (Insight.revenue_interest_score < 0.75) | 
                        (Insight.revenue_interest_score.is_(None))
                    )
            
            if churn_min_score is not None:
                query = query.filter(Insight.churn_score >= churn_min_score)
            
            if revenue_min_score is not None:
                query = query.filter(Insight.revenue_interest_score >= revenue_min_score)
        
        # Apply ordering
        if order_by == "churn_score_desc":
            from sqlalchemy import desc
            # OPTIMIZED: Order by score first, then nulls last, then by date
            query = query.order_by(
                desc(Insight.churn_score).nulls_last(),
                Call.created_at.desc()
            )
        elif order_by == "revenue_score_desc":
            from sqlalchemy import desc
            query = query.order_by(
                desc(Insight.revenue_interest_score).nulls_last(),
                Call.created_at.desc()
            )
        else:
            query = query.order_by(Call.created_at.desc())
        
        # OPTIMIZED: Get total count more efficiently
        # For chart queries (skip=0, has date filters), we can estimate or skip count
        # But for now, keep it for API compatibility
        
        # Apply pagination FIRST to reduce data processed
        query = query.offset(skip).limit(limit)
        
        # Execute query and get results
        calls = query.all()
        
        # OPTIMIZED: Get count separately only if needed (for chart queries, we can skip or use estimate)
        # For now, still get count but it's executed after limit which is faster
        if skip == 0 and limit <= 200:
            # For chart queries, count is expensive - use a separate optimized count query
            count_query = self.db.query(Call)
            if gym_id:
                count_query = count_query.filter(Call.gym_id == gym_id)
            if start_date:
                try:
                    start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                    count_query = count_query.filter(Call.created_at >= start_dt)
                except (ValueError, AttributeError):
                    pass
            if end_date:
                try:
                    end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                    count_query = count_query.filter(Call.created_at <= end_dt)
                except (ValueError, AttributeError):
                    pass
            if needs_join:
                count_query = count_query.join(Insight, Call.call_id == Insight.call_id)
                count_query = count_query.filter(Insight.confidence >= 0.3)
                if sentiment:
                    count_query = count_query.filter(Insight.sentiment == sentiment)
                if pain_point:
                    pain_point_lower = pain_point.lower().strip()
                    count_query = count_query.filter(Insight.pain_points.any(pain_point_lower))
                if opportunity:
                    opportunity_lower = opportunity.lower().strip()
                    count_query = count_query.filter(Insight.opportunities.any(opportunity_lower))
                if churn_min_score is not None:
                    count_query = count_query.filter(Insight.churn_score >= churn_min_score)
                if revenue_min_score is not None:
                    count_query = count_query.filter(Insight.revenue_interest_score >= revenue_min_score)
            total_count = count_query.count()
        else:
            # For pagination queries, get accurate count
            total_count_query = self.db.query(Call)
            if gym_id:
                total_count_query = total_count_query.filter(Call.gym_id == gym_id)
            if start_date:
                try:
                    start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                    total_count_query = total_count_query.filter(Call.created_at >= start_dt)
                except (ValueError, AttributeError):
                    pass
            if end_date:
                try:
                    end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                    total_count_query = total_count_query.filter(Call.created_at <= end_dt)
                except (ValueError, AttributeError):
                    pass
            if needs_join:
                total_count_query = total_count_query.join(Insight, Call.call_id == Insight.call_id)
                total_count_query = total_count_query.filter(Insight.confidence >= 0.3)
                if sentiment:
                    total_count_query = total_count_query.filter(Insight.sentiment == sentiment)
                if pain_point:
                    pain_point_lower = pain_point.lower().strip()
                    total_count_query = total_count_query.filter(Insight.pain_points.any(pain_point_lower))
                if opportunity:
                    opportunity_lower = opportunity.lower().strip()
                    total_count_query = total_count_query.filter(Insight.opportunities.any(opportunity_lower))
                if revenue_interest is not None:
                    if revenue_interest:
                        total_count_query = total_count_query.filter(Insight.revenue_interest_score >= 0.75)
                    else:
                        total_count_query = total_count_query.filter(
                            (Insight.revenue_interest_score < 0.75) | 
                            (Insight.revenue_interest_score.is_(None))
                        )
                if churn_min_score is not None:
                    total_count_query = total_count_query.filter(Insight.churn_score >= churn_min_score)
                if revenue_min_score is not None:
                    total_count_query = total_count_query.filter(Insight.revenue_interest_score >= revenue_min_score)
            total_count = total_count_query.count()
        
        return calls, total_count
    
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
        
        if payload.answered_by:
            call.answered_by = payload.answered_by
            print(f"📞 Answered by: {payload.answered_by} for call {call.call_id}")
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
    
    def get_top_churn_phone_numbers(
        self,
        gym_id: Optional[str] = None,
        threshold: float = 0.7,
        limit: int = 100
    ) -> List[dict]:
        """
        Get top churn phone numbers (latest call per phone number, churn_score >= threshold)
        Returns phone numbers ordered by churn score descending
        
        Args:
            gym_id: Filter by gym ID
            threshold: Minimum churn score (default 0.7)
            limit: Maximum number of results
        
        Returns:
            List of dicts with phone_number, call_id, churn_score, created_at
        """
        from app.models.models import Insight
        from sqlalchemy import desc, func
        
        # Subquery to get latest call per phone number
        latest_calls_subquery = (
            self.db.query(
                Call.phone_number,
                func.max(Call.created_at).label('latest_created_at')
            )
            .group_by(Call.phone_number)
            .subquery()
        )
        
        # Main query: Join calls with insights, filter by threshold, get latest per phone
        query = (
            self.db.query(
                Call.phone_number,
                Call.call_id,
                Insight.churn_score,
                Call.created_at
            )
            .join(Insight, Call.call_id == Insight.call_id)
            .join(
                latest_calls_subquery,
                (Call.phone_number == latest_calls_subquery.c.phone_number) &
                (Call.created_at == latest_calls_subquery.c.latest_created_at)
            )
            .filter(Insight.churn_score >= threshold)
        )
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        query = query.order_by(desc(Insight.churn_score)).limit(limit)
        
        results = query.all()
        
        return [
            {
                "phone_number": row.phone_number,
                "call_id": row.call_id,
                "churn_score": float(row.churn_score) if row.churn_score else None,
                "created_at": row.created_at.isoformat() if row.created_at else None
            }
            for row in results
        ]
    
    def get_top_revenue_phone_numbers(
        self,
        gym_id: Optional[str] = None,
        threshold: float = 0.7,
        limit: int = 100
    ) -> List[dict]:
        """
        Get top revenue phone numbers (latest call per phone number, revenue_interest_score >= threshold)
        Returns phone numbers ordered by revenue score descending
        
        Args:
            gym_id: Filter by gym ID
            threshold: Minimum revenue interest score (default 0.7)
            limit: Maximum number of results
        
        Returns:
            List of dicts with phone_number, call_id, revenue_interest_score, created_at
        """
        from app.models.models import Insight
        from sqlalchemy import desc, func
        
        # Subquery to get latest call per phone number
        latest_calls_subquery = (
            self.db.query(
                Call.phone_number,
                func.max(Call.created_at).label('latest_created_at')
            )
            .group_by(Call.phone_number)
            .subquery()
        )
        
        # Main query: Join calls with insights, filter by threshold, get latest per phone
        query = (
            self.db.query(
                Call.phone_number,
                Call.call_id,
                Insight.revenue_interest_score,
                Call.created_at
            )
            .join(Insight, Call.call_id == Insight.call_id)
            .join(
                latest_calls_subquery,
                (Call.phone_number == latest_calls_subquery.c.phone_number) &
                (Call.created_at == latest_calls_subquery.c.latest_created_at)
            )
            .filter(Insight.revenue_interest_score >= threshold)
        )
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        query = query.order_by(desc(Insight.revenue_interest_score)).limit(limit)
        
        results = query.all()
        
        return [
            {
                "phone_number": row.phone_number,
                "call_id": row.call_id,
                "revenue_interest_score": float(row.revenue_interest_score) if row.revenue_interest_score else None,
                "created_at": row.created_at.isoformat() if row.created_at else None
            }
            for row in results
        ]
    
    def get_latest_call_by_phone_number(
        self,
        phone_number: str,
        gym_id: Optional[str] = None
    ) -> Optional[Call]:
        """
        Get the latest call for a specific phone number
        
        Args:
            phone_number: Phone number to search for
            gym_id: Optional gym ID filter
        
        Returns:
            Latest Call object or None
        """
        query = self.db.query(Call).filter(Call.phone_number == phone_number)
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        return query.order_by(Call.created_at.desc()).first()
    
    def get_speaker_type(self, message: str) -> str:
        """
        Determine speaker type based on message prefix.
        
        Args:
            message: The message string to analyze
            
        Returns:
            "AGENT" if message begins with "Agent speech:" or "Ending call:", otherwise "USER"
        """
        
        return "AGENT" if (message.startswith("Agent speech:") or message.startswith("Ending call:")) else "USER"
    
    def trim_message_prefix(self, message: str) -> str:
        """
        Remove conversation turn prefixes from message.
        
        Args:
            message: The message string to trim
            
        Returns:
            Message with prefix removed and trimmed whitespace
        """
        if not message:
            return ""
        
        prefixes = [
            "Handling user speech: ",
            "Ending call: ",
            "Agent speech: "
        ]
        
        for prefix in prefixes:
            if message.startswith(prefix):
                return message[len(prefix):].strip()
        
        return message.strip()
    
    def check_prefix_similarity(self, text1: str, text2: str, threshold: float = 0.7) -> bool:
        """
        Check if prefixes of two strings match 70% or more using similarity comparison.
        
        Args:
            text1: First string to compare
            text2: Second string to compare  
            threshold: Similarity threshold (default 0.7 for 70%)
            
        Returns:
            True if prefix similarity >= threshold, False otherwise
        """
        if not text1 or not text2:
            return False
        
        # Take first 50 characters as prefix for comparison
        prefix_length = min(50, min(len(text1), len(text2)))
        
        if prefix_length == 0:
            return False
        
        prefix1 = text1[:prefix_length].lower().strip()
        prefix2 = text2[:prefix_length].lower().strip()
        
        # Calculate character-level similarity
        # Using simple character overlap ratio
        if len(prefix1) == 0 or len(prefix2) == 0:
            return False
        
        # Convert to sets of characters for comparison
        chars1 = set(prefix1)
        chars2 = set(prefix2)
        
        # Calculate Jaccard similarity (intersection over union)
        intersection = len(chars1.intersection(chars2))
        union = len(chars1.union(chars2))
        
        if union == 0:
            return False
        
        similarity = intersection / union
        
        return similarity >= threshold
    
    def process_live_call_conversation_turn(self, payload: WebhookPayload) -> None:
        """
        Process a live call conversation turn from webhook payload.
        
        Args:
            payload: WebhookPayload containing conversation turn data
        """
        try:
            from app.services.insight_service import InsightService
            insight_service = InsightService(self.db)
            
            # Get cache entry from live calls cache for call id
            live_call = CacheService.get_live_call(payload.call_id)
                        
            # If absent, create a new LiveCall object
            if live_call is None:
                call = self.get_call_by_id(payload.call_id)
                phone_number = call.phone_number if call else "unknown"
                api_key_index = call.api_key_index if call and hasattr(call, 'api_key_index') else 0
                
                # Get timestamp from payload, call, or current time
                call_timestamp = payload.timestamp
                if not call_timestamp and call and call.created_at:
                    call_timestamp = call.created_at.isoformat()
                if not call_timestamp:
                    from datetime import datetime
                    call_timestamp = datetime.utcnow().isoformat()
                
                # Create new LiveCall with first conversation turn
                new_conversation_turn = ConversationTurn(
                    speaker_type=self.get_speaker_type(payload.message),
                    speech=self.trim_message_prefix(payload.message)
                )
                
                live_call = LiveCall(
                    call_id=payload.call_id,
                    conversation=[new_conversation_turn],
                    sentiment=None,
                    call_initiated_timestamp=call_timestamp,
                    phone_number=phone_number,
                    api_key_index=api_key_index
                )
                
                # Store in cache
                CacheService.set_live_call(payload.call_id, live_call)
                insight_service.queue_live_call_analysis(live_call, payload.call_id)
                
            else:
                # Check if the current speaker type matches the last conversation turn's speaker type
                # Get the current speaker type
                current_speaker_type = self.get_speaker_type(payload.message)
                 
                # Get the last conversation turn's speaker type
                last_turn = live_call.conversation[-1]
                last_speaker_type = last_turn.speaker_type
                 
                # Check if speaker types match and message prefixes matches 70%
                last_message = last_turn.speech
                current_message = self.trim_message_prefix(payload.message)
                if last_speaker_type == current_speaker_type and self.check_prefix_similarity(last_message, current_message):
                    # Same speaker continuing - update existing turn
                    updated_conversation = live_call.conversation.copy()
                    updated_conversation[-1] = ConversationTurn(
                        speaker_type=current_speaker_type,
                        speech=current_message
                    )
                    updated_live_call = live_call.model_copy(update={"conversation": updated_conversation})
                else:
                    # Different speaker - create new turn
                    updated_conversation = live_call.conversation.copy()
                    updated_conversation.append(ConversationTurn(
                        speaker_type=current_speaker_type,
                        speech=current_message
                    ))
                    updated_live_call = live_call.model_copy(update={"conversation": updated_conversation})
                 
                CacheService.set_live_call(payload.call_id, updated_live_call)
                insight_service.queue_live_call_analysis(updated_live_call, payload.call_id)
            
        except Exception as e:
            print(f"❌ Error processing live call conversation turn: {str(e)}")