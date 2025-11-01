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


class InsightService:
    """Service for managing insights and AI analysis"""
    
    def __init__(self, db: Session):
        self.db = db
        self.ai_service = AIService()
    
    async def analyze_and_store_insights(
        self,
        call_id: str,
        transcript: str
    ) -> InsightData:
        """
        Analyze transcript using AI and store insights
        
        Args:
            call_id: Unique call identifier
            transcript: Call transcript text
        
        Returns:
            InsightData with extracted insights
        """
        # Extract insights using AI
        insights_data = await self.ai_service.extract_insights(transcript)
        
        # Check if insights already exist
        existing_insight = self.db.query(Insight).filter(
            Insight.call_id == call_id
        ).first()
        
        if existing_insight:
            # Update existing insights
            existing_insight.topics = insights_data.main_topics
            existing_insight.sentiment = insights_data.sentiment
            existing_insight.pain_points = insights_data.pain_points
            existing_insight.opportunities = insights_data.opportunities
            existing_insight.revenue_interest = insights_data.capital_interest
            existing_insight.revenue_interest_quote = insights_data.revenue_interest_quote
            existing_insight.confidence = insights_data.confidence
            existing_insight.extracted_at = datetime.utcnow()
            
            self.db.commit()
            self.db.refresh(existing_insight)
        else:
            # Create new insights
            insight = Insight(
                call_id=call_id,
                topics=insights_data.main_topics,
                sentiment=insights_data.sentiment,
                pain_points=insights_data.pain_points,
                opportunities=insights_data.opportunities,
                revenue_interest=insights_data.capital_interest,
                revenue_interest_quote=insights_data.revenue_interest_quote,
                confidence=insights_data.confidence
            )
            
            self.db.add(insight)
            self.db.commit()
            self.db.refresh(insight)
        
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
        
        # Get sentiment distribution
        insights_query = self.db.query(Insight)
        if gym_id:
            insights_query = insights_query.join(Call).filter(Call.gym_id == gym_id)
        
        # Count sentiments
        positive_count = insights_query.filter(Insight.sentiment == "positive").count()
        neutral_count = insights_query.filter(Insight.sentiment == "neutral").count()
        negative_count = insights_query.filter(Insight.sentiment == "negative").count()
        
        sentiment = SentimentDistribution(
            positive=positive_count,
            neutral=neutral_count,
            negative=negative_count
        )
        
        # Get top pain points
        top_pain_points = self._get_top_pain_points(gym_id)
        
        # Get high-interest quotes
        high_interest_quotes = self._get_high_interest_quotes(gym_id)
        
        # Calculate revenue opportunities
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
        Get most common pain points across calls
        
        Args:
            gym_id: Optional gym filter
            limit: Max number of pain points to return
        
        Returns:
            List of PainPoint objects
        """
        query = self.db.query(Insight)
        
        if gym_id:
            query = query.join(Call).filter(Call.gym_id == gym_id)
        
        # Get all insights with pain points
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
        Get quotes from high-interest calls
        
        Args:
            gym_id: Optional gym filter
            limit: Max number of quotes
        
        Returns:
            List of HighInterestQuote objects
        """
        query = self.db.query(Insight, Call).join(
            Call, Insight.call_id == Call.call_id
        ).filter(
            Insight.revenue_interest == True,
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
