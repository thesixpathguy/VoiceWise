import re
import json
from typing import List, Optional, Dict, Any
from collections import Counter
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from sentence_transformers import SentenceTransformer
from app.core.config import settings
from app.prompts.query_expansion import QUERY_EXPANSION_PROMPT, QUERY_EXPANSION_SYSTEM_MESSAGE

from app.models.models import Call, Insight
from app.schemas.schemas import CallDetail


class SearchService:
    """Service for hybrid search: phone number, status, sentiment filters + NLP semantic search with LLM query expansion"""
    
    # Class-level cache for expanded queries (simple in-memory cache)
    _query_expansion_cache = {}
    _max_cache_size = 100  # Limit cache size to prevent memory issues
    
    def __init__(self, db: Session):
        self.db = db
        # Load free embedding model (all-MiniLM-L6-v2: 384 dimensions, fast, good quality)
        self._model = None
        self.groq_api_key = settings.GROQ_API_KEY
        self.groq_api_url = "https://api.groq.com/openai/v1/chat/completions"
    
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
        similarity_threshold: float = 0.54  # For NLP search: 0.0 (strict) to 2.0 (lenient)
    ) -> Dict[str, Any]:
        """
        Hybrid search for calls
        
        Args:
            query: Search query
            search_type: Type of search ("phone", "sentiment", "nlp")
            gym_id: Filter by gym
            limit: Max results (default 50)
            skip: Pagination offset
        
        Returns:
            Dictionary with aggregated insights and individual call results
        """
        print(f"🔍 Search: query='{query}', type={search_type}")
        
        # Route to appropriate search method
        if search_type == "phone":
            calls = self._search_by_phone(query, gym_id, limit, skip)
        elif search_type == "sentiment":
            calls = self._search_by_sentiment(query, gym_id, limit, skip)
        elif search_type == "nlp":
            calls = self._semantic_search(query, gym_id, limit, skip, similarity_threshold)
        else:
            raise ValueError(f"Invalid search_type: {search_type}. Must be 'phone', 'sentiment', or 'nlp'")
        
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
                "api_key_index": getattr(call, "api_key_index", 0),
                "gym_id": call.gym_id,
                "custom_instructions": call.custom_instructions if call.custom_instructions else None,
                "insights": {
                    "sentiment": insight.sentiment if insight else None,
                    "topics": insight.topics if insight and insight.topics else [],
                    "gym_rating": insight.gym_rating if insight else None,
                    "pain_points": insight.pain_points if insight and insight.pain_points else [],
                    "opportunities": insight.opportunities if insight and insight.opportunities else [],
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
        
        result = {
            "query": query,
            "search_type": search_type,
            "total_results": len(calls),
            "aggregated_insights": aggregated,
            "calls": formatted_calls
        }
        
        # Ensure top_opportunities is always present in aggregated_insights
        if "aggregated_insights" in result and result["aggregated_insights"]:
            if "top_opportunities" not in result["aggregated_insights"]:
                result["aggregated_insights"]["top_opportunities"] = []
            print(f"🔍 Final response - top_opportunities present: {'top_opportunities' in result['aggregated_insights']}")
            print(f"🔍 Final response - top_opportunities value: {result['aggregated_insights'].get('top_opportunities')}")
        
        return result
    
    def _search_by_phone(
        self,
        phone_number: str,
        gym_id: Optional[str],
        limit: int,
        skip: int
    ) -> List[Call]:
        """Search by phone number (exact or partial match), sorted by average confidence descending"""
        # Clean phone number (remove spaces, dashes, parentheses)
        clean_phone = re.sub(r'[^\d+]', '', phone_number)
        
        # Join with Insight to sort by confidence
        query = self.db.query(Call).outerjoin(Insight, Call.call_id == Insight.call_id)
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        # Search for phone numbers containing the query
        query = query.filter(Call.phone_number.ilike(f"%{clean_phone}%"))
        
        # Sort by confidence descending (higher confidence first), then by created_at desc
        # Use COALESCE to handle NULL confidence values (put them at the end)
        query = query.order_by(
            func.coalesce(Insight.confidence, 0.0).desc(),
            Call.created_at.desc()
        )
        
        query = query.offset(skip).limit(limit)
        
        return query.all()
    
    def _search_by_sentiment(
        self,
        sentiment: str,
        gym_id: Optional[str],
        limit: int,
        skip: int
    ) -> List[Call]:
        """Search by sentiment (requires JOIN with insights), sorted by revenue_score desc for positive, churn_score desc for negative"""
        query = self.db.query(Call).join(Insight, Call.call_id == Insight.call_id)
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        query = query.filter(Insight.sentiment == sentiment.lower())
        
        # Sort based on sentiment:
        # - Positive sentiment: sort by revenue_interest_score descending
        # - Negative sentiment: sort by churn_score descending
        # - Neutral sentiment: sort by confidence descending
        if sentiment.lower() == "positive":
            # Sort by revenue_interest_score desc, then confidence desc
            query = query.order_by(
                func.coalesce(Insight.revenue_interest_score, 0.0).desc(),
                func.coalesce(Insight.confidence, 0.0).desc(),
                Call.created_at.desc()
            )
        elif sentiment.lower() == "negative":
            # Sort by churn_score desc, then confidence desc
            query = query.order_by(
                func.coalesce(Insight.churn_score, 0.0).desc(),
                func.coalesce(Insight.confidence, 0.0).desc(),
                Call.created_at.desc()
            )
        else:
            # Neutral: sort by confidence desc
            query = query.order_by(
                func.coalesce(Insight.confidence, 0.0).desc(),
                Call.created_at.desc()
            )
        
        query = query.offset(skip).limit(limit)
        
        return query.all()
    
    def _expand_query_with_llm(self, query_text: str) -> str:
        """
        Use LLM (Groq) to expand and understand the search query, capturing variations,
        synonyms, misspellings, and related terms for better semantic search.
        
        Uses in-memory caching to avoid redundant API calls for the same query.
        
        Args:
            query_text: Original user query
        
        Returns:
            Expanded query with synonyms and variations
        """
        if not self.groq_api_key:
            print("⚠️ GROQ_API_KEY not configured, skipping query expansion")
            return query_text
        
        # Check cache first (case-insensitive)
        query_key = query_text.lower().strip()
        if query_key in self._query_expansion_cache:
            print(f"💾 Using cached query expansion for: '{query_text}'")
            return self._query_expansion_cache[query_key]
        
        try:
            print(f"🤖 Expanding query with LLM: '{query_text}'")
            
            # Get prompt from prompts module
            expansion_prompt = QUERY_EXPANSION_PROMPT(query_text)
            system_message = QUERY_EXPANSION_SYSTEM_MESSAGE()
            
            headers = {
                "Authorization": f"Bearer {self.groq_api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                "messages": [
                    {
                        "role": "system",
                        "content": system_message
                    },
                    {
                        "role": "user",
                        "content": expansion_prompt
                    }
                ],
                "temperature": 0.3,
                "max_tokens": 200
            }
            
            import requests
            import certifi
            
            response = requests.post(
                self.groq_api_url,
                headers=headers,
                json=payload,
                timeout=10.0,
                verify=certifi.where()
            )
            
            if response.status_code != 200:
                print(f"⚠️ Groq API error {response.status_code} for query expansion, using original query")
                return query_text
            
            result = response.json()
            expanded_query = result["choices"][0]["message"]["content"].strip()
            
            # Clean up if LLM added extra formatting
            if expanded_query.startswith('"') and expanded_query.endswith('"'):
                expanded_query = expanded_query[1:-1]
            if expanded_query.startswith("EXPANDED QUERY:"):
                expanded_query = expanded_query.replace("EXPANDED QUERY:", "").strip()
            
            print(f"✅ Query expanded: '{query_text}' → '{expanded_query}'")
            
            # Cache the expanded query (with size limit)
            if len(self._query_expansion_cache) >= self._max_cache_size:
                # Remove oldest entry (simple FIFO - remove first item)
                oldest_key = next(iter(self._query_expansion_cache))
                del self._query_expansion_cache[oldest_key]
            
            self._query_expansion_cache[query_key] = expanded_query
            return expanded_query
            
        except Exception as e:
            print(f"⚠️ Error expanding query with LLM: {str(e)}, using original query")
            return query_text
    
    def _semantic_search(
        self,
        query_text: str,
        gym_id: Optional[str],
        limit: int,
        skip: int,
        similarity_threshold: float = 0.54
    ) -> List[Call]:
        """
        Semantic search using vector similarity with LLM query expansion
        
        Args:
            query_text: NLP query (e.g., "users that go to gym and yoga classes")
            gym_id: Filter by gym
            limit: Max results
            skip: Pagination offset
            similarity_threshold: Cosine distance threshold (lower = stricter)
        
        Returns:
            List of calls ordered by similarity (only returns relevant results)
        """
        # Step 1: Expand query using LLM to capture variations and synonyms
        expanded_query = self._expand_query_with_llm(query_text)
        
        # Step 2: Generate embedding for expanded query
        query_embedding = self.generate_embedding(expanded_query)
        
        if not query_embedding:
            print("⚠️ Failed to generate query embedding, falling back to text search")
            return self._fallback_text_search(query_text, gym_id, limit, skip)
        
        # Step 3: Pure semantic search with configurable threshold
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
        
        print(f"🔍 Semantic search for '{query_text}' (expanded: '{expanded_query}'): found {len(results)} relevant calls (threshold: {similarity_threshold})")
        
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
                "top_opportunities": [],
                "churn_interest_count": 0,
                "revenue_interest_count": 0,
                "average_confidence": 0.0,
                "total_duration_seconds": sum(c.duration_seconds or 0 for c in calls)
            }
        
        # Count sentiments
        sentiments = [i.sentiment for i in insights if i.sentiment]
        
        # Collect all topics, pain points, and opportunities
        all_topics = []
        all_pain_points = []
        all_opportunities = []
        
        for insight in insights:
            if insight.topics:
                all_topics.extend(insight.topics)
            if insight.pain_points:
                all_pain_points.extend(insight.pain_points)
            if insight.opportunities:
                all_opportunities.extend(insight.opportunities)
        
        # Debug logging
        print(f"📊 Aggregation: Found {len(all_topics)} topics, {len(all_pain_points)} pain points, {len(all_opportunities)} opportunities")
        
        # Count occurrences
        topic_counts = Counter(all_topics)
        pain_point_counts = Counter(all_pain_points)
        opportunity_counts = Counter(all_opportunities)
        
        # Build top opportunities list (always return a list, even if empty)
        top_opportunities_list = [
            {"name": opportunity, "count": count}
            for opportunity, count in opportunity_counts.most_common(10)
        ] if opportunity_counts else []
        
        print(f"📊 Top opportunities: {top_opportunities_list}")
        print(f"📊 Top opportunities type: {type(top_opportunities_list)}")
        
        result = {
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
            "top_opportunities": top_opportunities_list,
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
        
        print(f"📊 Final aggregated result keys: {list(result.keys())}")
        print(f"📊 Final top_opportunities in result: {result.get('top_opportunities')}")
        return result

