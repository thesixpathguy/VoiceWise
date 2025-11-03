"""
Script to process all existing calls through insight extraction
Extracts insights, calculates anomaly scores, and stores them in the insights table
"""
import sys
import os
import asyncio
import numpy as np
import traceback

# Add the parent directory to the path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.models import Call, Insight
from app.services.insight_service import InsightService
from app.services.search_service import SearchService


async def process_all_calls_for_insights():
    """Process all calls in the database through insight extraction"""
    db: Session = SessionLocal()
    insight_service = InsightService(db)
    search_service = SearchService(db)
    
    try:
        # Get all calls that don't have insights yet - filter in query for efficiency
        print("🔍 Querying calls from database...")
        
        # Use LEFT JOIN to find calls without insights
        query = db.query(Call).outerjoin(
            Insight, Call.call_id == Insight.call_id
        ).filter(
            Call.raw_transcript.isnot(None),
            Call.status == "completed",
            Insight.call_id.is_(None)  # No insight exists for this call
        ).order_by(Call.created_at.desc())
        
        all_calls = query.all()
        total_calls = len(all_calls)
        print(f"📊 Found {total_calls} calls that need processing\n")
        
        processed_count = 0
        skipped_count = 0
        error_count = 0
        errors_by_type = {}
        
        for i, call in enumerate(all_calls, 1):
            # Double-check if insights already exist (race condition protection)
            existing_insight = db.query(Insight).filter(
                Insight.call_id == call.call_id
            ).first()
            
            if existing_insight:
                print(f"⏭️  [{i}/{total_calls}] Skipping {call.call_id} - insights already exist")
                skipped_count += 1
                continue
            
            if not call.raw_transcript or len(call.raw_transcript.strip()) == 0:
                print(f"⚠️  [{i}/{total_calls}] Skipping {call.call_id} - no transcript")
                skipped_count += 1
                continue
            
            try:
                print(f"🔄 [{i}/{total_calls}] Processing {call.call_id}...")
                
                # Extract embedding if it exists (avoid boolean check on array which causes error)
                embedding = None
                try:
                    # Access embedding attribute and check for None using 'is' operator (not truthiness)
                    vec = getattr(call, 'transcript_embedding', None)
                    if vec is not None:
                        # Convert Vector to list if it exists
                        if hasattr(vec, 'tolist'):
                            embedding = vec.tolist()
                        elif isinstance(vec, np.ndarray):
                            embedding = vec.tolist()
                        elif isinstance(vec, list):
                            embedding = vec
                        else:
                            # Try to convert to list
                            embedding = list(vec)
                except Exception as e:
                    print(f"  ⚠️ Could not extract embedding: {str(e)}, generating new one...")
                    embedding = None
                
                if not embedding:
                    print(f"  📝 Generating embedding...")
                    embedding = search_service.generate_embedding(call.raw_transcript)
                    if embedding:
                        # Refresh the call object and update embedding
                        db.refresh(call)
                        call.transcript_embedding = embedding
                        db.commit()
                        print(f"  ✅ Embedding saved")
                
                # Process through insight service (includes RAG and anomaly detection)
                try:
                    insights_data = await insight_service.analyze_and_store_insights(
                        call_id=call.call_id,
                        transcript=call.raw_transcript,
                        transcript_embedding=embedding
                    )
                    print(f"  📊 Insights extracted: sentiment={insights_data.sentiment}, confidence={insights_data.confidence}, rating={insights_data.gym_rating}")
                except Exception as inner_e:
                    print(f"  ❌ Error in insight service: {str(inner_e)}")
                    raise  # Re-raise to be caught by outer exception handler
                
                # Verify insight was saved - expire cache and query again
                db.expire_all()  # Clear any cached queries to force fresh read
                saved_insight = db.query(Insight).filter(
                    Insight.call_id == call.call_id
                ).first()
                
                if saved_insight:
                    processed_count += 1
                    print(f"  ✅ Successfully processed {call.call_id}")
                    print(f"     Insight ID: {saved_insight.id}, Sentiment: {saved_insight.sentiment}, Confidence: {saved_insight.confidence}")
                    if saved_insight.gym_rating:
                        print(f"     Rating: {saved_insight.gym_rating}/10")
                    if saved_insight.anomaly_score is not None:
                        print(f"     Anomaly Score: {saved_insight.anomaly_score:.3f}")
                else:
                    # Insight service should have committed, but we can't find it
                    print(f"  ❌ CRITICAL: Insight service reported success but insight not found in DB!")
                    print(f"     This suggests a commit failure or validation error")
                    print(f"     The insight service may have committed but the record is missing")
                    error_count += 1
                    error_type = "CommitFailure"
                    errors_by_type[error_type] = errors_by_type.get(error_type, 0) + 1
                    # Don't continue - let's see if we can identify the issue
                    continue
                
                # Delay between calls to avoid rate limits (increase delay if hitting limits)
                # Note: If you hit rate limits, wait for the specified time and re-run the script
                # It will automatically skip calls that already have insights
                await asyncio.sleep(3.0)  # 3 second delay to reduce API call rate
                
            except Exception as e:
                error_count += 1
                error_type = type(e).__name__
                errors_by_type[error_type] = errors_by_type.get(error_type, 0) + 1
                
                print(f"  ❌ Error processing {call.call_id}")
                print(f"     Error Type: {error_type}")
                print(f"     Error Message: {str(e)}")
                
                # Print full traceback for debugging
                error_traceback = traceback.format_exc()
                print(f"     Traceback:\n{error_traceback}")
                
                db.rollback()
                # Continue with next call even if one fails
                continue
        
        print(f"\n{'='*60}")
        print(f"📊 Processing Summary:")
        print(f"  ✅ Successfully processed: {processed_count}")
        print(f"  ⏭️  Skipped (already have insights): {skipped_count}")
        print(f"  ❌ Errors: {error_count}")
        print(f"  📝 Total calls: {total_calls}")
        if errors_by_type:
            print(f"\n  Error Breakdown by Type:")
            for error_type, count in errors_by_type.items():
                print(f"    - {error_type}: {count}")
        print(f"{'='*60}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Fatal error: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("🚀 Starting insight extraction for all calls...\n")
    asyncio.run(process_all_calls_for_insights())
    print("\n✅ Insight extraction completed!")

