"""
Script to process existing calls through insight extraction
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


# Configuration: Set to True to re-analyze calls that already have insights
REANALYZE_EXISTING = False

# Groq API Rate Limits for llama-3.1-8b-instant: ~240 RPM (Requests Per Minute) = ~0.25 seconds between calls
# Using 1 second delay to be safe and respect rate limits
DELAY_BETWEEN_CALLS = 20.0  # seconds between API calls


async def process_all_calls_for_insights(max_insights: int = None, reanalyze: bool = False):
    """
    Process calls through insight extraction
    
    Args:
        max_insights: Maximum number of calls to process (None = all)
        reanalyze: If True, re-analyze calls that already have insights
    """
    db: Session = SessionLocal()
    insight_service = InsightService(db)
    search_service = SearchService(db)
    
    try:
        # Get calls based on reanalyze flag
        print("🔍 Querying calls from database...")
        
        if reanalyze:
            # Get all calls with transcripts (including those with existing insights)
            query = db.query(Call).filter(
                Call.raw_transcript.isnot(None),
                Call.status == "completed"
            ).order_by(Call.id.asc())  # Process from min ID to max ID
            print("📋 Mode: Re-analyzing ALL calls (including existing insights)")
        else:
            # Use LEFT JOIN to find calls without insights
            query = db.query(Call).outerjoin(
                Insight, Call.call_id == Insight.call_id
            ).filter(
                Call.raw_transcript.isnot(None),
                Call.status == "completed",
                Insight.call_id.is_(None)  # No insight exists for this call
            ).order_by(Call.id.asc())  # Process from min ID to max ID
            print("📋 Mode: Processing only calls WITHOUT insights")
        
        all_calls = query.all()
        total_calls = len(all_calls)
        
        # Apply limit if specified
        if max_insights is not None and max_insights > 0:
            all_calls = all_calls[:max_insights]
            print(f"📊 Found {total_calls} total calls, processing {len(all_calls)} calls (limit: {max_insights})\n")
        else:
            print(f"📊 Found {total_calls} calls that need processing\n")
        
        processed_count = 0
        skipped_count = 0
        error_count = 0
        errors_by_type = {}
        
        for i, call in enumerate(all_calls, 1):
            # Check if insights already exist
            existing_insight = db.query(Insight).filter(
                Insight.call_id == call.call_id
            ).first()
            
            if existing_insight and not reanalyze:
                print(f"⏭️  [{i}/{len(all_calls)}] Skipping {call.call_id} - insights already exist")
                skipped_count += 1
                continue
            elif existing_insight and reanalyze:
                print(f"🔄 [{i}/{len(all_calls)}] Re-analyzing {call.call_id} - insights exist, will be updated")
            
            if not call.raw_transcript or len(call.raw_transcript.strip()) == 0:
                print(f"⚠️  [{i}/{len(all_calls)}] Skipping {call.call_id} - no transcript")
                skipped_count += 1
                continue
            
            try:
                if not existing_insight:
                    print(f"🔄 [{i}/{len(all_calls)}] Processing {call.call_id}...")
                
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
                
                # Delay between calls to respect Groq rate limits (30 RPM = 2 seconds minimum)
                await asyncio.sleep(DELAY_BETWEEN_CALLS)
                
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
        if not reanalyze:
            print(f"  ⏭️  Skipped (already have insights): {skipped_count}")
        else:
            print(f"  🔄 Re-analyzed (existing insights updated): {processed_count}")
        print(f"  ❌ Errors: {error_count}")
        print(f"  📝 Total calls processed: {len(all_calls)}")
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
    print("🚀 Starting insight extraction script...\n")
    
    # Ask user how many insights to process
    try:
        user_input = input("How many calls do you want to process? (Enter number or 'all' for all calls): ").strip().lower()
        
        if user_input == 'all':
            max_insights = None
            print("📊 Processing ALL calls\n")
        else:
            max_insights = int(user_input)
            if max_insights <= 0:
                print("❌ Invalid input. Please enter a positive number or 'all'")
                sys.exit(1)
            print(f"📊 Processing {max_insights} calls\n")
    except ValueError:
        print("❌ Invalid input. Please enter a number or 'all'")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Cancelled by user")
        sys.exit(0)
    
    # Ask user if they want to re-analyze existing insights
    reanalyze = REANALYZE_EXISTING
    if not REANALYZE_EXISTING:
        try:
            reanalyze_input = input("Do you want to re-analyze calls that already have insights? (y/n, default=n): ").strip().lower()
            reanalyze = reanalyze_input in ['y', 'yes']
            if reanalyze:
                print("🔄 Re-analyze mode: Will update existing insights\n")
            else:
                print("📋 Normal mode: Will skip calls with existing insights\n")
        except KeyboardInterrupt:
            print("\n\n⚠️  Cancelled by user")
            sys.exit(0)
    else:
        print(f"🔄 Re-analyze mode ENABLED (REANALYZE_EXISTING=True)\n")
    
    try:
        asyncio.run(process_all_calls_for_insights(max_insights=max_insights, reanalyze=reanalyze))
        print("\n✅ Insight extraction completed!")
    except KeyboardInterrupt:
        print("\n\n⚠️  Process interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        sys.exit(1)

