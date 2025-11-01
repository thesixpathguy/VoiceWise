"""
Backfill embeddings for existing calls in the database.

This script generates embeddings for all calls that have transcripts but no embeddings.
Run this after setting up the search feature to enable semantic search on existing calls.

Usage:
    python backfill_embeddings.py
"""

import sys
from app.core.database import SessionLocal
from app.models.models import Call
from app.services.search_service import SearchService


def backfill_embeddings():
    """Generate embeddings for all calls with transcripts but no embeddings"""
    
    print("🔍 Starting embedding backfill process...")
    print("=" * 60)
    
    db = SessionLocal()
    search_service = SearchService(db)
    
    try:
        # Get all calls with transcripts but no embeddings
        calls = db.query(Call).filter(
            Call.raw_transcript.isnot(None),
            Call.transcript_embedding.is_(None)
        ).all()
        
        total_calls = len(calls)
        
        if total_calls == 0:
            print("✅ No calls need embedding generation!")
            print("All calls with transcripts already have embeddings.")
            return
        
        print(f"📊 Found {total_calls} calls that need embeddings")
        print("=" * 60)
        
        success_count = 0
        failed_count = 0
        
        for i, call in enumerate(calls, 1):
            try:
                print(f"\n[{i}/{total_calls}] Processing call: {call.call_id}")
                print(f"  Phone: {call.phone_number}")
                print(f"  Transcript length: {len(call.raw_transcript)} chars")
                
                # Generate embedding
                embedding = search_service.generate_embedding(call.raw_transcript)
                
                if embedding:
                    # Save embedding to database
                    call.transcript_embedding = embedding
                    db.commit()
                    success_count += 1
                    print(f"  ✅ Embedding saved successfully")
                else:
                    failed_count += 1
                    print(f"  ⚠️ Failed to generate embedding")
                    
            except Exception as e:
                failed_count += 1
                print(f"  ❌ Error: {str(e)}")
                db.rollback()
        
        print("\n" + "=" * 60)
        print("📊 SUMMARY")
        print("=" * 60)
        print(f"Total calls processed: {total_calls}")
        print(f"✅ Successful: {success_count}")
        print(f"❌ Failed: {failed_count}")
        print(f"Success rate: {(success_count/total_calls*100):.1f}%")
        print("=" * 60)
        print("✨ Backfill complete!")
        
    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    backfill_embeddings()

