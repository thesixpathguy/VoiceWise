"""
Backfill embeddings for existing calls in BATCHES (for large databases).

This script processes calls in batches to avoid memory issues with large datasets.
Useful if you have thousands of calls to process.

Usage:
    python backfill_embeddings_batch.py [--batch-size 10]
"""

import sys
import argparse
from app.core.database import SessionLocal
from app.models.models import Call
from app.services.search_service import SearchService


def backfill_embeddings_batch(batch_size=10):
    """
    Generate embeddings for all calls with transcripts but no embeddings.
    Processes in batches to avoid memory issues.
    
    Args:
        batch_size: Number of calls to process before committing
    """
    
    print("🔍 Starting BATCH embedding backfill process...")
    print(f"📦 Batch size: {batch_size}")
    print("=" * 60)
    
    db = SessionLocal()
    search_service = SearchService(db)
    
    try:
        # Count total calls needing embeddings
        total_calls = db.query(Call).filter(
            Call.raw_transcript.isnot(None),
            Call.transcript_embedding.is_(None)
        ).count()
        
        if total_calls == 0:
            print("✅ No calls need embedding generation!")
            print("All calls with transcripts already have embeddings.")
            return
        
        print(f"📊 Found {total_calls} calls that need embeddings")
        print(f"📦 Will process in {(total_calls + batch_size - 1) // batch_size} batches")
        print("=" * 60)
        
        success_count = 0
        failed_count = 0
        processed = 0
        
        while True:
            # Get next batch of calls
            batch = db.query(Call).filter(
                Call.raw_transcript.isnot(None),
                Call.transcript_embedding.is_(None)
            ).limit(batch_size).all()
            
            if not batch:
                break  # No more calls to process
            
            print(f"\n📦 Processing batch: calls {processed + 1} to {processed + len(batch)}")
            print("-" * 60)
            
            for i, call in enumerate(batch, 1):
                try:
                    print(f"  [{processed + i}/{total_calls}] {call.call_id} ({call.phone_number})")
                    
                    # Generate embedding
                    embedding = search_service.generate_embedding(call.raw_transcript)
                    
                    if embedding:
                        call.transcript_embedding = embedding
                        success_count += 1
                        print(f"    ✅ Embedding generated")
                    else:
                        failed_count += 1
                        print(f"    ⚠️ Failed to generate embedding")
                        
                except Exception as e:
                    failed_count += 1
                    print(f"    ❌ Error: {str(e)}")
            
            # Commit batch
            try:
                db.commit()
                print(f"  💾 Batch committed successfully")
            except Exception as e:
                print(f"  ❌ Batch commit failed: {str(e)}")
                db.rollback()
            
            processed += len(batch)
            print(f"  Progress: {processed}/{total_calls} ({processed/total_calls*100:.1f}%)")
        
        print("\n" + "=" * 60)
        print("📊 SUMMARY")
        print("=" * 60)
        print(f"Total calls processed: {processed}")
        print(f"✅ Successful: {success_count}")
        print(f"❌ Failed: {failed_count}")
        print(f"Success rate: {(success_count/processed*100):.1f}%")
        print("=" * 60)
        print("✨ Backfill complete!")
        
    except Exception as e:
        print(f"\n❌ Fatal error: {str(e)}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Backfill embeddings in batches')
    parser.add_argument(
        '--batch-size',
        type=int,
        default=10,
        help='Number of calls to process per batch (default: 10)'
    )
    
    args = parser.parse_args()
    backfill_embeddings_batch(batch_size=args.batch_size)

