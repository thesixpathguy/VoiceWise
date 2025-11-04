import re
from typing import List, Optional, Dict, Any
from collections import Counter
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from sentence_transformers import SentenceTransformer

from app.models.models import Call, Insight
from app.schemas.schemas import CallDetail


class SearchService:
    """Service for hybrid search: phone number, status, sentiment filters + NLP semantic search"""
    
    def __init__(self, db: Session):
        self.db = db
        # Load free embedding model (all-MiniLM-L6-v2: 384 dimensions, fast, good quality)
        self._model = None
    
    @property
    def model(self):
        """Lazy load the embedding model"""
        if self._model is None:
            print("🤖 Loading sentence transformer model (all-MiniLM-L6-v2)...")
            self._model = SentenceTransformer('all-MiniLM-L6-v2')
            print("✅ Model loaded successfully")
        return self._model
    
    def generate_embedding(self, text: str) -> List[float]:
        """
        Generate embedding for text using sentence-transformers
        
        Args:
            text: Text to embed
        
        Returns:
            384-dimensional embedding vector
        """
        if not text or len(text.strip()) == 0:
            return None
        
        try:
            embedding = self.model.encode(text, convert_to_numpy=True)
            return embedding.tolist()
        except Exception as e:
            print(f"❌ Error generating embedding: {str(e)}")
            return None
    
    def search_calls(
        self,
        query: str,
        search_type: str = "nlp",  # "phone", "status", "sentiment", "nlp"
        gym_id: Optional[str] = None,
        limit: int = 50,
        skip: int = 0,
        similarity_threshold: float = 0.77  # For NLP search: 0.0 (strict) to 2.0 (lenient)
    ) -> Dict[str, Any]:
        """
        Hybrid search for calls
        
        Args:
            query: Search query
            search_type: Type of search ("phone", "status", "sentiment", "nlp")
            gym_id: Filter by gym
            limit: Max results
            skip: Pagination offset
        
        Returns:
            Dictionary with aggregated insights and individual call results
        """
        print(f"🔍 Search: query='{query}', type={search_type}")
        
        # Route to appropriate search method
        if search_type == "phone":
            calls = self._search_by_phone(query, gym_id, limit, skip)
        elif search_type == "status":
            calls = self._search_by_status(query, gym_id, limit, skip)
        elif search_type == "sentiment":
            calls = self._search_by_sentiment(query, gym_id, limit, skip)
        elif search_type == "nlp":
            calls = self._semantic_search(query, gym_id, limit, skip, similarity_threshold)
        else:
            raise ValueError(f"Invalid search_type: {search_type}")
        
        # Get insights for all matching calls
        call_ids = [c.call_id for c in calls]
        insights = self.db.query(Insight).filter(
            Insight.call_id.in_(call_ids)
        ).all() if call_ids else []
        
        # Create insight lookup
        insight_map = {i.call_id: i for i in insights}
        
        # Aggregate insights
        aggregated = self._aggregate_insights(insights, calls)
        
        # Format calls with insights
        formatted_calls = []
        for call in calls:
            insight = insight_map.get(call.call_id)
            formatted_calls.append({
                "call_id": call.call_id,
                "phone_number": call.phone_number,
                "status": call.status,
                "created_at": call.created_at.isoformat() if call.created_at else None,
                "duration_seconds": call.duration_seconds,
                "raw_transcript": call.raw_transcript,
                "gym_id": call.gym_id,
                "custom_instructions": call.custom_instructions if call.custom_instructions else None,
                "insights": {
                    "sentiment": insight.sentiment if insight else None,
                    "topics": insight.topics if insight else [],
                    "gym_rating": insight.gym_rating if insight else None,
                    "pain_points": insight.pain_points if insight else [],
                    "opportunities": insight.opportunities if insight else [],
                    "churn_score": insight.churn_score if insight else None,
                    "churn_interest_quote": insight.churn_interest_quote if insight else None,
                    "revenue_interest_score": insight.revenue_interest_score if insight else None,
                    "revenue_interest_quote": insight.revenue_interest_quote if insight else None,
                    "confidence": insight.confidence if insight else 0.0,
                    "anomaly_score": insight.anomaly_score if insight else None,
                    "custom_instruction_answers": insight.custom_instruction_answers if insight else None,
                    "extracted_at": insight.extracted_at.isoformat() if insight and insight.extracted_at else None
                } if insight else None
            })
        
        return {
            "query": query,
            "search_type": search_type,
            "total_results": len(calls),
            "aggregated_insights": aggregated,
            "calls": formatted_calls
        }
    
    def _search_by_phone(
        self,
        phone_number: str,
        gym_id: Optional[str],
        limit: int,
        skip: int
    ) -> List[Call]:
        """Search by phone number (exact or partial match)"""
        # Clean phone number (remove spaces, dashes, parentheses)
        clean_phone = re.sub(r'[^\d+]', '', phone_number)
        
        query = self.db.query(Call)
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        # Search for phone numbers containing the query
        query = query.filter(Call.phone_number.ilike(f"%{clean_phone}%"))
        
        query = query.order_by(Call.created_at.desc())
        query = query.offset(skip).limit(limit)
        
        return query.all()
    
    def _search_by_status(
        self,
        status: str,
        gym_id: Optional[str],
        limit: int,
        skip: int
    ) -> List[Call]:
        """Search by call status"""
        query = self.db.query(Call)
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        query = query.filter(Call.status == status.lower())
        
        query = query.order_by(Call.created_at.desc())
        query = query.offset(skip).limit(limit)
        
        return query.all()
    
    def _search_by_sentiment(
        self,
        sentiment: str,
        gym_id: Optional[str],
        limit: int,
        skip: int
    ) -> List[Call]:
        """Search by sentiment (requires JOIN with insights)"""
        query = self.db.query(Call).join(Insight, Call.call_id == Insight.call_id)
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        query = query.filter(Insight.sentiment == sentiment.lower())
        
        query = query.order_by(Call.created_at.desc())
        query = query.offset(skip).limit(limit)
        
        return query.all()
    
    def _semantic_search(
        self,
        query_text: str,
        gym_id: Optional[str],
        limit: int,
        skip: int,
        similarity_threshold: float = 0.77
    ) -> List[Call]:
        """
        Pure semantic search using vector similarity
        
        Args:
            query_text: NLP query (e.g., "need trainer", "equipment issues")
            gym_id: Filter by gym
            limit: Max results
            skip: Pagination offset
        
        Returns:
            List of calls ordered by similarity (only returns relevant results)
        """
        # Generate embedding for query
        query_embedding = self.generate_embedding(query_text)
        
        if not query_embedding:
            print("⚠️ Failed to generate query embedding, falling back to text search")
            return self._fallback_text_search(query_text, gym_id, limit, skip)
        
        # Pure semantic search with configurable threshold
        # Lower threshold = stricter (fewer but more relevant results)
        # Higher threshold = more lenient (more results but may include less relevant)
        
        query = self.db.query(Call).filter(
            Call.transcript_embedding.isnot(None),
            Call.transcript_embedding.cosine_distance(query_embedding) < similarity_threshold
        )
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        # Order by cosine similarity (lower distance = more similar)
        query = query.order_by(
            Call.transcript_embedding.cosine_distance(query_embedding)
        )
        
        query = query.offset(skip).limit(limit)
        
        results = query.all()
        
        print(f"🔍 Semantic search for '{query_text}': found {len(results)} relevant calls (threshold: {similarity_threshold})")
        
        return results
    
    def _fallback_text_search(
        self,
        query_text: str,
        gym_id: Optional[str],
        limit: int,
        skip: int
    ) -> List[Call]:
        """
        Fallback to simple text search if embedding fails
        """
        query = self.db.query(Call).filter(
            Call.raw_transcript.isnot(None)
        )
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        # Case-insensitive text search
        query = query.filter(Call.raw_transcript.ilike(f"%{query_text}%"))
        
        query = query.order_by(Call.created_at.desc())
        query = query.offset(skip).limit(limit)
        
        return query.all()
    
    def _aggregate_insights(
        self,
        insights: List[Insight],
        calls: List[Call]
    ) -> Dict[str, Any]:
        """
        Aggregate insights across all matching calls
        
        Args:
            insights: List of insights
            calls: List of calls
        
        Returns:
            Aggregated statistics
        """
        if not insights:
            return {
                "total_calls": len(calls),
                "sentiment_distribution": {
                    "positive": 0,
                    "neutral": 0,
                    "negative": 0
                },
                "top_topics": [],
                "top_pain_points": [],
                "churn_interest_count": 0,
                "revenue_interest_count": 0,
                "average_confidence": 0.0,
                "total_duration_seconds": sum(c.duration_seconds or 0 for c in calls)
            }
        
        # Count sentiments
        sentiments = [i.sentiment for i in insights if i.sentiment]
        
        # Collect all topics and pain points
        all_topics = []
        all_pain_points = []
        
        for insight in insights:
            if insight.topics:
                all_topics.extend(insight.topics)
            if insight.pain_points:
                all_pain_points.extend(insight.pain_points)
        
        # Count occurrences
        topic_counts = Counter(all_topics)
        pain_point_counts = Counter(all_pain_points)
        
        return {
            "total_calls": len(calls),
            "sentiment_distribution": {
                "positive": sentiments.count("positive"),
                "neutral": sentiments.count("neutral"),
                "negative": sentiments.count("negative")
            },
            "top_topics": [
                {"name": topic, "count": count}
                for topic, count in topic_counts.most_common(10)
            ],
            "top_pain_points": [
                {"name": point, "count": count}
                for point, count in pain_point_counts.most_common(10)
            ],
            "churn_interest_count": sum(
                1 for i in insights if i.churn_score is not None and i.churn_score > 0.75
            ),
            "revenue_interest_count": sum(
                1 for i in insights if i.revenue_interest_score is not None and i.revenue_interest_score > 0.75
            ),
            "average_confidence": sum(
                i.confidence for i in insights if i.confidence
            ) / len(insights) if insights else 0.0,
            "total_duration_seconds": sum(
                c.duration_seconds or 0 for c in calls
            )
        }

