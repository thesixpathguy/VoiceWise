from app.services.cache_service import CacheService
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from sqlalchemy.orm import Session
from typing import Optional, List
import json
import os
from datetime import datetime
from pathlib import Path

from app.core.database import get_db
from app.schemas.schemas import WebhookPayload
from app.services.call_service import CallService
from app.services.insight_service import InsightService
from app.services.search_service import SearchService
from app.models.models import Call

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

# Create logs directory if it doesn't exist
LOGS_DIR = Path(__file__).parent.parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)
WEBHOOK_LOG_FILE = LOGS_DIR / "webhook_payloads2.log"


def log_payload_to_file(payload: dict, context: str = ""):
    """
    Log raw payload to file with timestamp
    
    Args:
        payload: The payload dictionary to log
        context: Optional context string (e.g., "validation_error")
    """
    try:
        timestamp = datetime.now().isoformat()
        log_entry = {
            "timestamp": timestamp,
            "context": context,
            "payload": payload
        }
        
        with open(WEBHOOK_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry, indent=2) + "\n" + "-" * 80 + "\n")
    except Exception as e:
        print(f"⚠️ Failed to log payload to file: {str(e)}")


@router.post("/bland-ai")
async def bland_ai_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Webhook endpoint for Bland AI call status updates.
    
    Receives notifications when call is completed, recording is available,
    or transcript is ready. Automatically triggers background processing
    for completed calls.
    
    Args:
        request: Raw request to handle any payload structure
        background_tasks: FastAPI background tasks manager
        db: Database session
    """
    try:
        # Get raw JSON payload
        raw_payload = await request.json()
        print(f"📨 Raw webhook payload: {json.dumps(raw_payload, indent=2)}")
        # Log all incoming payloads to file
        # log_payload_to_file(raw_payload, context="incoming_webhook")
        
        # Validate and parse using Pydantic
        try:
            payload = WebhookPayload(**raw_payload)
        except Exception as e:
            print(f"⚠️ Validation error: {str(e)}")
            print(f"Raw payload: {raw_payload}")
            # Log to file
            # log_payload_to_file(raw_payload, context="validation_error")
            # Return success to Bland AI but log the issue
            return {"status": "accepted", "note": "validation_warning"}
        
        if(is_conversation_turn_webhook(payload.message)):
            return await process_conversation_turn(payload, db)
        elif(payload.completed == True):        
            return await process_final_webhook(payload, background_tasks, db)
        else:
            return {"status": "ignored", "reason": "call_completed"}
            
    except Exception as e:
        print(f"❌ Webhook error: {str(e)}")
        # Don't raise HTTPException - return success to prevent retries
        return {"status": "error", "message": str(e)}


def is_conversation_turn_webhook(message: str) -> bool:
    """
    Check if a webhook message represents a conversation turn.
    
    Args:
        message: The message string to check
        
    Returns:
        True if the message begins with conversation turn prefixes, False otherwise
    """
    if not message:
        return False
    
    conversation_prefixes = [
        "Agent speech:",
        "Handling user speech:",
        "Ending call:"
    ]
    
    return any(message.startswith(prefix) for prefix in conversation_prefixes)

async def process_conversation_turn(
    payload: WebhookPayload,
    db: Session
) -> dict:
    """
    Process a conversation turn from webhook payload.
    """
    call_service = CallService(db)
    call_service.process_live_call_conversation_turn(payload)
    return {
        "status": "success",
        "call_id": payload.call_id,
        "message": "Conversation turn processed successfully"
    }


async def process_final_webhook(
    payload: WebhookPayload,
    background_tasks: BackgroundTasks,
    db: Session
) -> dict:
    """
    Process the final webhook by updating call record and scheduling processing.
    
    Args:
        payload: Validated webhook payload
        background_tasks: FastAPI background tasks manager
        db: Database session
        
    Returns:
        Response dictionary with status and processing info
    """
    # Update call record in database
    call_service = CallService(db)
    call = call_service.update_call_from_webhook(payload)

    # Invalidate live call cache
    CacheService.invalidate_live_call_cache(payload.call_id)
    
    if not call:
        print(f"⚠️ Call {payload.call_id} not found in database")
        return {"status": "ignored", "reason": "call_not_found"}
    
    # Schedule processing for completed calls with transcripts
    should_process = (
        payload.status == "completed" and 
        payload.concatenated_transcript is not None
    )
    
    if should_process:
        insight_service = InsightService(db)
        search_service = SearchService(db)
        # Generate embedding once to reuse in insight extraction
        print(f"🔍 Generating embedding for call {payload.call_id}...")
        embedding = search_service.generate_embedding(payload.concatenated_transcript)
        background_tasks.add_task(
            _process_call_completion,
            insight_service,
            search_service,
            payload.call_id,
            payload.concatenated_transcript,
            embedding
        )
        print(f"✅ Call {payload.call_id} updated, processing scheduled")
    else:
        print(f"✅ Call {payload.call_id} updated")
    
    return {
        "status": "success",
        "call_id": payload.call_id,
        "processing": "scheduled" if should_process else "none"
    }


async def _process_call_completion(
    insight_service: InsightService,
    search_service: SearchService,
    call_id: str,
    transcript: str,
    embedding: Optional[List[float]] = None
) -> None:
    """
    Background task to process completed call.
    
    Extracts insights from the transcript using AI analysis and stores
    embeddings for semantic search.
    
    Args:
        insight_service: Service for insight extraction
        search_service: Service for embedding storage
        call_id: Unique identifier for the call
        transcript: The call transcript text
        embedding: Pre-generated embedding to reuse (if None, will generate)
    """
    try:
        print(f"🔄 Processing call {call_id}...")
        print(f"📝 Transcript length: {len(transcript) if transcript else 0} chars")
        
        # Extract insights from transcript (pass embedding to avoid regenerating)
        await insight_service.analyze_and_store_insights(call_id, transcript, transcript_embedding=embedding)
        
        # Use provided embedding or generate if not provided
        if embedding is None:
            print(f"🔍 Generating embedding for call {call_id}...")
            embedding = search_service.generate_embedding(transcript)
        
        if embedding:
            # Update call with embedding
            call = search_service.db.query(Call).filter(
                Call.call_id == call_id
            ).first()
            
            if call:
                call.transcript_embedding = embedding
                search_service.db.commit()
                print(f"✅ Embedding saved for call {call_id}")
            else:
                print(f"⚠️ Call {call_id} not found for embedding update")
        else:
            print(f"⚠️ Failed to generate embedding for call {call_id}")
        
        print(f"✅ Call {call_id} processed successfully")
        
    except Exception as e:
        print(f"❌ Error processing call {call_id}: {str(e)}")
