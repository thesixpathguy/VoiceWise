from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime
from app.models.models import Insight, Call
from app.schemas.schemas import (
    InsightData,
    DashboardSummary,
    SentimentDistribution,
    PainPoint,
    HighInterestQuote
)
from app.services.ai_service import AIService
from app.services.rag_service import RAGService
from app.services.anomaly_service import AnomalyService


class InsightService:
    """Service for managing insights and AI analysis"""
    
    def __init__(self, db: Session):
        self.db = db
        self.ai_service = AIService()
        self.rag_service = RAGService(db)
        self.anomaly_service = AnomalyService(db)
    
    async def analyze_and_store_insights(
        self,
        call_id: str,
        transcript: str,
        transcript_embedding: Optional[List[float]] = None
    ) -> InsightData:
        """
        Analyze transcript using AI with RAG context and store insights
        
        Args:
            call_id: Unique call identifier
            transcript: Call transcript text
            transcript_embedding: Optional pre-generated embedding to avoid duplicate generation
        
        Returns:
            InsightData with extracted insights
        """
        # Get call info to retrieve gym_id
        call = self.db.query(Call).filter(Call.call_id == call_id).first()
        gym_id = call.gym_id if call else None
        
        # Retrieve RAG context (similar calls, historical stats, examples)
        # Pass embedding if available to avoid regenerating it
        rag_context = None
        if gym_id:
            try:
                print(f"🔍 Retrieving RAG context for call {call_id}...")
                rag_context = self.rag_service.retrieve_context(transcript, gym_id, top_k=8, transcript_embedding=transcript_embedding)
                print(f"✅ RAG context retrieved: {len(rag_context.similar_calls)} similar calls, stats available: {bool(rag_context.historical_stats)}")
            except Exception as e:
                print(f"⚠️ RAG context retrieval failed: {str(e)}, proceeding without context")
        
        # Extract insights using AI with RAG context
        rag_context_str = rag_context.to_prompt_context() if rag_context else ""
        insights_data = await self.ai_service.extract_insights(transcript, rag_context_str)
        
        # Calculate anomaly score
        anomaly_score = None
        if rag_context and gym_id:
            try:
                print(f"📊 Calculating anomaly score for call {call_id}...")
                insights_dict = {
                    'gym_rating': insights_data.gym_rating,
                    'sentiment': insights_data.sentiment,
                    'pain_points': insights_data.pain_points,
                    'confidence': insights_data.confidence,
                    'topics': insights_data.main_topics
                }
                anomaly_score = self.anomaly_service.calculate_anomaly_score(
                    insights_dict, rag_context, gym_id
                )
                print(f"✅ Anomaly score calculated: {anomaly_score:.3f}")
            except Exception as e:
                print(f"⚠️ Anomaly score calculation failed: {str(e)}")
        
        # Check if insights already exist
        existing_insight = self.db.query(Insight).filter(
            Insight.call_id == call_id
        ).first()
        
        if existing_insight:
            # Update existing insights
            existing_insight.topics = insights_data.main_topics
            existing_insight.sentiment = insights_data.sentiment
            existing_insight.gym_rating = insights_data.gym_rating
            existing_insight.pain_points = insights_data.pain_points
            existing_insight.opportunities = insights_data.opportunities
            existing_insight.revenue_interest = insights_data.capital_interest
            existing_insight.revenue_interest_quote = insights_data.revenue_interest_quote
            existing_insight.confidence = insights_data.confidence
            existing_insight.anomaly_score = anomaly_score
            existing_insight.extracted_at = datetime.utcnow()
            
            try:
                self.db.commit()
                self.db.refresh(existing_insight)
            except Exception as commit_error:
                self.db.rollback()
                print(f"❌ Failed to update insight for {call_id}: {str(commit_error)}")
                raise  # Re-raise so caller knows it failed
        else:
            # Create new insights
            insight = Insight(
                call_id=call_id,
                topics=insights_data.main_topics,
                sentiment=insights_data.sentiment,
                gym_rating=insights_data.gym_rating,
                pain_points=insights_data.pain_points,
                opportunities=insights_data.opportunities,
                revenue_interest=insights_data.capital_interest,
                revenue_interest_quote=insights_data.revenue_interest_quote,
                confidence=insights_data.confidence,
                anomaly_score=anomaly_score
            )
            
            self.db.add(insight)
            try:
                self.db.commit()
                self.db.refresh(insight)
            except Exception as commit_error:
                self.db.rollback()
                print(f"❌ Failed to commit insight for {call_id}: {str(commit_error)}")
                raise  # Re-raise so caller knows it failed
        
        return insights_data
    
    def get_insights_by_call_id(self, call_id: str) -> Optional[Insight]:
        """
        Get insights for a specific call
        
        Args:
            call_id: Unique call identifier
        
        Returns:
            Insight object or None
        """
        return self.db.query(Insight).filter(Insight.call_id == call_id).first()
    
    def get_dashboard_summary(self, gym_id: Optional[str] = None) -> DashboardSummary:
        """
        Generate dashboard summary with aggregated insights
        
        Args:
            gym_id: Optional gym filter
        
        Returns:
            DashboardSummary with aggregated data
        """
        # Base query for calls
        calls_query = self.db.query(Call)
        if gym_id:
            calls_query = calls_query.filter(Call.gym_id == gym_id)
        
        total_calls = calls_query.count()
        
        # Get sentiment distribution - EXCLUDE low confidence insights (confidence < 0.3)
        insights_query = self.db.query(Insight).filter(Insight.confidence >= 0.3)
        if gym_id:
            insights_query = insights_query.join(Call).filter(Call.gym_id == gym_id)
        
        # Count sentiments (only from high-confidence insights)
        positive_count = insights_query.filter(Insight.sentiment == "positive").count()
        neutral_count = insights_query.filter(Insight.sentiment == "neutral").count()
        negative_count = insights_query.filter(Insight.sentiment == "negative").count()
        
        sentiment = SentimentDistribution(
            positive=positive_count,
            neutral=neutral_count,
            negative=negative_count
        )
        
        # Get top pain points (excludes low confidence)
        top_pain_points = self._get_top_pain_points(gym_id)
        
        # Get high-interest quotes (excludes low confidence)
        high_interest_quotes = self._get_high_interest_quotes(gym_id)
        
        # Calculate revenue opportunities (excludes low confidence)
        revenue_opportunities = insights_query.filter(
            Insight.revenue_interest == True
        ).count()
        
        return DashboardSummary(
            total_calls=total_calls,
            sentiment=sentiment,
            top_pain_points=top_pain_points,
            high_interest_quotes=high_interest_quotes,
            revenue_opportunities=revenue_opportunities
        )
    
    def _get_top_pain_points(
        self,
        gym_id: Optional[str] = None,
        limit: int = 5
    ) -> List[PainPoint]:
        """
        Get most common pain points across calls (excludes low confidence insights)
        
        Args:
            gym_id: Optional gym filter
            limit: Max number of pain points to return
        
        Returns:
            List of PainPoint objects
        """
        # Filter out low confidence insights (confidence < 0.3)
        query = self.db.query(Insight).filter(Insight.confidence >= 0.3)
        
        if gym_id:
            query = query.join(Call).filter(Call.gym_id == gym_id)
        
        # Get all insights with pain points (only high confidence)
        insights = query.filter(Insight.pain_points.isnot(None)).all()
        
        # Count pain point occurrences
        pain_point_counts = {}
        for insight in insights:
            if insight.pain_points:
                for pain_point in insight.pain_points:
                    pain_point_lower = pain_point.lower().strip()
                    pain_point_counts[pain_point_lower] = pain_point_counts.get(pain_point_lower, 0) + 1
        
        # Sort by count and return top N
        sorted_pain_points = sorted(
            pain_point_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]
        
        return [
            PainPoint(name=name.capitalize(), count=count)
            for name, count in sorted_pain_points
        ]
    
    def _get_high_interest_quotes(
        self,
        gym_id: Optional[str] = None,
        limit: int = 3
    ) -> List[HighInterestQuote]:
        """
        Get quotes from high-interest calls (excludes low confidence insights)
        
        Args:
            gym_id: Optional gym filter
            limit: Max number of quotes
        
        Returns:
            List of HighInterestQuote objects
        """
        # Filter out low confidence insights (confidence < 0.3)
        query = self.db.query(Insight, Call).join(
            Call, Insight.call_id == Call.call_id
        ).filter(
            Insight.revenue_interest == True,
            Insight.confidence >= 0.3,  # Only high confidence insights
            Call.raw_transcript.isnot(None)
        )
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        query = query.order_by(Insight.confidence.desc()).limit(limit)
        
        results = query.all()
        
        quotes = []
        for insight, call in results:
            # Use the AI-extracted revenue interest quote if available
            if insight.revenue_interest_quote:
                quote_text = insight.revenue_interest_quote
            else:
                # Fallback: use first 200 chars of transcript if quote not available
                transcript = call.raw_transcript or ""
                quote_text = transcript[:200] + "..." if len(transcript) > 200 else transcript
            
            quotes.append(
                HighInterestQuote(
                    quote=quote_text,
                    sentiment=insight.sentiment,
                    phone_number=call.phone_number,  # Full phone number
                    call_id=call.call_id
                )
            )
        
        return quotes
