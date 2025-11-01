from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from sqlalchemy.orm import Session
import json

from app.core.database import get_db
from app.schemas.schemas import WebhookPayload
from app.services.call_service import CallService
from app.services.insight_service import InsightService
from app.services.search_service import SearchService
from app.models.models import Call

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


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
        
        # Validate and parse using Pydantic
        try:
            payload = WebhookPayload(**raw_payload)
        except Exception as e:
            print(f"⚠️ Validation error: {str(e)}")
            print(f"Raw payload: {raw_payload}")
            # Return success to Bland AI but log the issue
            return {"status": "accepted", "note": "validation_warning"}
        
        # Update call record in database
        call_service = CallService(db)
        call = call_service.update_call_from_webhook(payload)
        
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
            background_tasks.add_task(
                _process_call_completion,
                insight_service,
                search_service,
                payload.call_id,
                payload.concatenated_transcript
            )
            print(f"✅ Call {payload.call_id} updated, processing scheduled")
        else:
            print(f"✅ Call {payload.call_id} updated")
        
        return {
            "status": "success",
            "call_id": payload.call_id,
            "processing": "scheduled" if should_process else "none"
        }
        
    except Exception as e:
        print(f"❌ Webhook error: {str(e)}")
        # Don't raise HTTPException - return success to prevent retries
        return {"status": "error", "message": str(e)}


async def _process_call_completion(
    insight_service: InsightService,
    search_service: SearchService,
    call_id: str,
    transcript: str
) -> None:
    """
    Background task to process completed call.
    
    Extracts insights from the transcript using AI analysis and generates
    embeddings for semantic search.
    
    Args:
        insight_service: Service for insight extraction
        search_service: Service for embedding generation
        call_id: Unique identifier for the call
        transcript: The call transcript text
    """
    try:
        print(f"🔄 Processing call {call_id}...")
        print(f"📝 Transcript length: {len(transcript) if transcript else 0} chars")
        
        # Extract insights from transcript
        await insight_service.analyze_and_store_insights(call_id, transcript)
        
        # Generate embedding for semantic search
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
