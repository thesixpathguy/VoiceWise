"""
RAG (Retrieval Augmented Generation) Service
Enhances AI insight extraction with contextual information from historical data
"""
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from collections import Counter
import numpy as np

from app.models.models import Call, Insight
from app.services.search_service import SearchService


class RAGContext:
    """Container for RAG-retrieved context"""
    
    def __init__(self):
        self.similar_calls: List[Dict] = []
        self.historical_stats: Dict[str, Any] = {}
        self.high_quality_examples: List[Dict] = []
        self.gym_id: Optional[str] = None
        
    def to_prompt_context(self) -> str:
        """Convert context to formatted string for prompt injection"""
        context_parts = []
        
        # Similar calls context
        if self.similar_calls:
            context_parts.append("SIMILAR PAST CALLS:")
            for i, call in enumerate(self.similar_calls[:5], 1):
                similar_info = f"{i}. Rating: {call.get('rating', 'N/A')}, "
                similar_info += f"Sentiment: {call.get('sentiment', 'N/A')}, "
                similar_info += f"Confidence: {call.get('confidence', 0):.2f}, "
                similar_info += f"Pain Points: {', '.join(call.get('pain_points', [])) if call.get('pain_points') else 'None'}"
                context_parts.append(similar_info)
            context_parts.append("")
        
        # Historical stats context
        if self.historical_stats:
            context_parts.append("GYM HISTORICAL BENCHMARKS:")
            avg_rating = self.historical_stats.get('avg_rating')
            if avg_rating is not None:
                context_parts.append(f"- Average Rating: {avg_rating:.2f}/10")
            if self.historical_stats.get('sentiment_distribution'):
                sent = self.historical_stats['sentiment_distribution']
                context_parts.append(f"- Sentiment: {sent.get('positive', 0)} positive, {sent.get('neutral', 0)} neutral, {sent.get('negative', 0)} negative")
            top_pain_points = self.historical_stats.get('top_pain_points')
            if top_pain_points and len(top_pain_points) > 0:
                context_parts.append(f"- Common Pain Points: {', '.join([p['name'] for p in top_pain_points[:3]])}")
            context_parts.append("")
        
        # High-quality examples context
        if self.high_quality_examples:
            context_parts.append("HIGH-QUALITY REFERENCE EXAMPLES:")
            for i, example in enumerate(self.high_quality_examples[:3], 1):
                ex_info = f"{i}. Rating: {example.get('rating', 'N/A')}, "
                ex_info += f"Sentiment: {example.get('sentiment', 'N/A')}, "
                ex_info += f"Topics: {', '.join(example.get('topics', [])[:3]) if example.get('topics') else 'None'}"
                context_parts.append(ex_info)
            context_parts.append("")
        
        return "\n".join(context_parts) if context_parts else ""


class RAGService:
    """Service for retrieving contextual information to enhance AI extraction"""
    
    def __init__(self, db: Session):
        self.db = db
        self.search_service = SearchService(db)
    
    def retrieve_context(
        self,
        transcript: str,
        gym_id: str,
        top_k: int = 5,
        transcript_embedding: Optional[List[float]] = None
    ) -> RAGContext:
        """
        Retrieve contextual information for RAG-enhanced extraction
        
        Args:
            transcript: Current call transcript
            gym_id: Gym identifier
            top_k: Number of similar calls to retrieve
            transcript_embedding: Optional pre-generated embedding to avoid duplicate generation
            
        Returns:
            RAGContext with retrieved information
        """
        context = RAGContext()
        context.gym_id = gym_id
        
        # Use provided embedding or generate if not provided
        if transcript_embedding is None:
            transcript_embedding = self.search_service.generate_embedding(transcript)
        
        # Source 1: Similar calls (vector search)
        if transcript_embedding and isinstance(transcript_embedding, list):
            context.similar_calls = self._retrieve_similar_calls(
                transcript_embedding, gym_id, top_k
            )
        
        # Source 2: Historical aggregations
        context.historical_stats = self._retrieve_historical_stats(gym_id)
        
        # Source 3: High-quality examples
        context.high_quality_examples = self._retrieve_high_quality_examples(
            transcript_embedding, gym_id
        )
        
        return context
    
    def _retrieve_similar_calls(
        self,
        transcript_embedding: List[float],
        gym_id: str,
        top_k: int
    ) -> List[Dict]:
        """Retrieve similar calls using vector search"""
        try:
            # Vector similarity search
            query = self.db.query(Call).filter(
                Call.transcript_embedding.isnot(None),
                Call.gym_id == gym_id,
                Call.transcript_embedding.cosine_distance(transcript_embedding) < 0.85
            ).order_by(
                Call.transcript_embedding.cosine_distance(transcript_embedding)
            ).limit(top_k)
            
            calls = query.all()
            
            # Get insights for these calls
            call_ids = [c.call_id for c in calls]
            insights = self.db.query(Insight).filter(
                Insight.call_id.in_(call_ids)
            ).all()
            
            insight_map = {i.call_id: i for i in insights}
            
            # Format results
            similar_calls = []
            for call in calls:
                insight = insight_map.get(call.call_id)
                # Only include calls that have insights
                if insight:
                    # Calculate similarity score (invert cosine distance)
                    # cosine_distance ranges from 0 (identical) to 2 (opposite)
                    # Convert to similarity: 1 - (distance / 2)
                    distance = float(call.transcript_embedding.cosine_distance(transcript_embedding))
                    similarity = max(0, 1 - (distance / 2))
                    
                    similar_calls.append({
                        "call_id": call.call_id,
                        "rating": insight.gym_rating,  # Can be None
                        "sentiment": insight.sentiment,  # Can be None
                        "confidence": insight.confidence if insight.confidence is not None else 0.0,  # Default to 0.0 if None
                        "pain_points": insight.pain_points or [],
                        "topics": insight.topics or [],
                        "similarity_score": similarity
                    })
            
            return similar_calls
            
        except Exception as e:
            print(f"⚠️ Error retrieving similar calls: {str(e)}")
            return []
    
    def _retrieve_historical_stats(self, gym_id: str) -> Dict[str, Any]:
        """Retrieve historical aggregated statistics for gym"""
        try:
            # Get all insights for this gym
            insights_query = self.db.query(Insight).join(Call).filter(
                Call.gym_id == gym_id,
                Insight.confidence >= 0.3  # Only high-confidence insights
            )
            
            insights = insights_query.all()
            
            if not insights:
                return {}
            
            # Calculate average rating and std (only from insights with ratings)
            ratings = [i.gym_rating for i in insights if i.gym_rating is not None]
            avg_rating = sum(ratings) / len(ratings) if len(ratings) > 0 else None
            std_rating = float(np.std(ratings)) if len(ratings) > 1 else None
            
            # Sentiment distribution
            sentiments = [i.sentiment for i in insights if i.sentiment]
            sentiment_distribution = {
                "positive": sentiments.count("positive"),
                "neutral": sentiments.count("neutral"),
                "negative": sentiments.count("negative")
            }
            
            # Top pain points
            all_pain_points = []
            for insight in insights:
                if insight.pain_points:
                    all_pain_points.extend([p.lower().strip() for p in insight.pain_points])
            
            pain_point_counts = Counter(all_pain_points)
            top_pain_points = [
                {"name": name.capitalize(), "count": count}
                for name, count in pain_point_counts.most_common(5)
            ]
            
            # Average confidence (only from insights with confidence scores)
            confidences = [i.confidence for i in insights if i.confidence is not None]
            avg_confidence = sum(confidences) / len(confidences) if len(confidences) > 0 else None
            
            return {
                "avg_rating": avg_rating,
                "std_rating": std_rating,
                "sentiment_distribution": sentiment_distribution,
                "top_pain_points": top_pain_points,
                "avg_confidence": avg_confidence,
                "total_calls": len(insights)
            }
            
        except Exception as e:
            print(f"⚠️ Error retrieving historical stats: {str(e)}")
            return {}
    
    def _retrieve_high_quality_examples(
        self,
        transcript_embedding: Optional[List[float]],
        gym_id: str,
        limit: int = 3
    ) -> List[Dict]:
        """Retrieve high-quality examples (confidence > 0.8)"""
        try:
            # Get high-confidence insights
            query = self.db.query(Insight, Call).join(
                Call, Insight.call_id == Call.call_id
            ).filter(
                Insight.confidence >= 0.8,
                Call.gym_id == gym_id,
                Call.transcript_embedding.isnot(None)
            ).order_by(Insight.confidence.desc()).limit(limit * 2)  # Get more for filtering
            
            results = query.all()
            
            if not transcript_embedding or not isinstance(transcript_embedding, list) or not results:
                # Return top examples by confidence if no embedding
                examples = []
                for insight, call in results[:limit]:
                    examples.append({
                        "call_id": call.call_id,
                        "rating": insight.gym_rating,  # Can be None
                        "sentiment": insight.sentiment,  # Can be None
                        "topics": insight.topics or [],
                        "confidence": insight.confidence if insight.confidence is not None else 0.0
                    })
                return examples[:limit]
            
            # Find most similar high-quality examples
            examples_with_similarity = []
            for insight, call in results:
                try:
                    distance = float(call.transcript_embedding.cosine_distance(transcript_embedding))
                    similarity = max(0, 1 - (distance / 2))
                    examples_with_similarity.append({
                        "call_id": call.call_id,
                        "rating": insight.gym_rating,  # Can be None
                        "sentiment": insight.sentiment,  # Can be None
                        "topics": insight.topics or [],
                        "confidence": insight.confidence if insight.confidence is not None else 0.0,
                        "similarity": similarity
                    })
                except:
                    continue
            
            # Sort by similarity and return top
            examples_with_similarity.sort(key=lambda x: x.get('similarity', 0), reverse=True)
            return examples_with_similarity[:limit]
            
        except Exception as e:
            print(f"⚠️ Error retrieving high-quality examples: {str(e)}")
            return []

