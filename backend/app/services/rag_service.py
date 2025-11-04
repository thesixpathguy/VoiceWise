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
                similar_info += f"Confidence: {call.get('confidence', 0):.2f}"
                
                # Add churn score if available
                if call.get('churn_score') is not None:
                    similar_info += f", Churn Score: {call.get('churn_score', 0):.1f}"
                
                # Add revenue interest score if available
                if call.get('revenue_interest_score') is not None:
                    similar_info += f", Revenue Interest Score: {call.get('revenue_interest_score', 0):.1f}"
                
                # Add pain points
                pain_points = call.get('pain_points', [])
                if pain_points:
                    similar_info += f", Pain Points: {', '.join(pain_points)}"
                
                # Add opportunities
                opportunities = call.get('opportunities', [])
                if opportunities:
                    similar_info += f", Opportunities: {', '.join(opportunities)}"
                
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
            
            # Add top opportunities if available
            top_opportunities = self.historical_stats.get('top_opportunities')
            if top_opportunities and len(top_opportunities) > 0:
                context_parts.append(f"- Common Opportunities: {', '.join([o['name'] for o in top_opportunities[:3]])}")
            
            # Add average churn score if available
            avg_churn_score = self.historical_stats.get('avg_churn_score')
            if avg_churn_score is not None:
                context_parts.append(f"- Average Churn Score: {avg_churn_score:.1f}")
            
            # Add average revenue interest score if available
            avg_revenue_score = self.historical_stats.get('avg_revenue_interest_score')
            if avg_revenue_score is not None:
                context_parts.append(f"- Average Revenue Interest Score: {avg_revenue_score:.1f}")
            
            context_parts.append("")
        
        # High-quality examples context
        if self.high_quality_examples:
            context_parts.append("HIGH-QUALITY REFERENCE EXAMPLES:")
            for i, example in enumerate(self.high_quality_examples[:3], 1):
                ex_info = f"{i}. Rating: {example.get('rating', 'N/A')}, "
                ex_info += f"Sentiment: {example.get('sentiment', 'N/A')}, "
                ex_info += f"Confidence: {example.get('confidence', 0):.2f}"
                
                # Add churn score if available
                if example.get('churn_score') is not None:
                    ex_info += f", Churn Score: {example.get('churn_score', 0):.1f}"
                
                # Add revenue interest score if available
                if example.get('revenue_interest_score') is not None:
                    ex_info += f", Revenue Interest Score: {example.get('revenue_interest_score', 0):.1f}"
                
                # Add topics
                topics = example.get('topics', [])
                if topics:
                    ex_info += f", Topics: {', '.join(topics[:3])}"
                
                # Add pain points if available
                pain_points = example.get('pain_points', [])
                if pain_points:
                    ex_info += f", Pain Points: {', '.join(pain_points[:2])}"
                
                # Add opportunities if available
                opportunities = example.get('opportunities', [])
                if opportunities:
                    ex_info += f", Opportunities: {', '.join(opportunities[:2])}"
                
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
    
    def _calculate_cosine_distance(self, vec1, vec2: List[float]) -> float:
        """
        Calculate cosine distance between two vectors (matches pgvector behavior).
        Returns distance from 0 (identical) to 2 (opposite).
        Efficiently handles numpy arrays and lists.
        """
        # Convert to numpy arrays (handles both lists and arrays efficiently)
        vec1 = np.asarray(vec1, dtype=np.float32)
        vec2 = np.asarray(vec2, dtype=np.float32)
        
        # Calculate norms
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 2.0  # Maximum distance for zero vectors
        
        # Cosine similarity: dot product / (norm1 * norm2)
        cosine_sim = np.dot(vec1, vec2) / (norm1 * norm2)
        
        # pgvector cosine_distance = 1 - cosine_similarity
        # This gives range 0 (identical) to 2 (opposite)
        return float(1 - cosine_sim)
    
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
                    # Use numpy to calculate since call.transcript_embedding is now a numpy array
                    if call.transcript_embedding is not None:
                        distance = self._calculate_cosine_distance(call.transcript_embedding, transcript_embedding)
                        similarity = max(0, 1 - (distance / 2))
                    else:
                        similarity = 0.0
                    
                    similar_calls.append({
                        "call_id": call.call_id,
                        "rating": insight.gym_rating,  # Can be None
                        "sentiment": insight.sentiment,  # Can be None
                        "confidence": insight.confidence if insight.confidence is not None else 0.0,  # Default to 0.0 if None
                        "pain_points": insight.pain_points or [],
                        "opportunities": insight.opportunities or [],
                        "topics": insight.topics or [],
                        "churn_score": insight.churn_score,  # Can be None
                        "revenue_interest_score": insight.revenue_interest_score,  # Can be None
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
            
            # Top opportunities
            all_opportunities = []
            for insight in insights:
                if insight.opportunities:
                    all_opportunities.extend([o.lower().strip() for o in insight.opportunities])
            
            opportunity_counts = Counter(all_opportunities)
            top_opportunities = [
                {"name": name.capitalize(), "count": count}
                for name, count in opportunity_counts.most_common(5)
            ]
            
            # Average confidence (only from insights with confidence scores)
            confidences = [i.confidence for i in insights if i.confidence is not None]
            avg_confidence = sum(confidences) / len(confidences) if len(confidences) > 0 else None
            
            # Average churn score (only from insights with churn scores)
            churn_scores = [i.churn_score for i in insights if i.churn_score is not None]
            avg_churn_score = sum(churn_scores) / len(churn_scores) if len(churn_scores) > 0 else None
            
            # Average revenue interest score (only from insights with revenue scores)
            revenue_scores = [i.revenue_interest_score for i in insights if i.revenue_interest_score is not None]
            avg_revenue_interest_score = sum(revenue_scores) / len(revenue_scores) if len(revenue_scores) > 0 else None
            
            return {
                "avg_rating": avg_rating,
                "std_rating": std_rating,
                "sentiment_distribution": sentiment_distribution,
                "top_pain_points": top_pain_points,
                "top_opportunities": top_opportunities,
                "avg_confidence": avg_confidence,
                "avg_churn_score": avg_churn_score,
                "avg_revenue_interest_score": avg_revenue_interest_score,
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
                        "pain_points": insight.pain_points or [],
                        "opportunities": insight.opportunities or [],
                        "churn_score": insight.churn_score,  # Can be None
                        "revenue_interest_score": insight.revenue_interest_score,  # Can be None
                        "confidence": insight.confidence if insight.confidence is not None else 0.0
                    })
                return examples[:limit]
            
            # Find most similar high-quality examples
            examples_with_similarity = []
            for insight, call in results:
                try:
                    # Use numpy to calculate cosine distance since call.transcript_embedding is a numpy array
                    if call.transcript_embedding is not None:
                        distance = self._calculate_cosine_distance(call.transcript_embedding, transcript_embedding)
                        similarity = max(0, 1 - (distance / 2))
                    else:
                        similarity = 0.0
                    
                    examples_with_similarity.append({
                        "call_id": call.call_id,
                        "rating": insight.gym_rating,  # Can be None
                        "sentiment": insight.sentiment,  # Can be None
                        "topics": insight.topics or [],
                        "pain_points": insight.pain_points or [],
                        "opportunities": insight.opportunities or [],
                        "churn_score": insight.churn_score,  # Can be None
                        "revenue_interest_score": insight.revenue_interest_score,  # Can be None
                        "confidence": insight.confidence if insight.confidence is not None else 0.0,
                        "similarity": similarity
                    })
                except Exception as e:
                    print(f"⚠️ Error calculating similarity for call {call.call_id}: {str(e)}")
                    continue
            
            # Sort by similarity and return top
            examples_with_similarity.sort(key=lambda x: x.get('similarity', 0), reverse=True)
            return examples_with_similarity[:limit]
            
        except Exception as e:
            print(f"⚠️ Error retrieving high-quality examples: {str(e)}")
            return []

