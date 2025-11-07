from sqlalchemy.orm import Session
from sqlalchemy import func, extract, case
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from collections import defaultdict
import asyncio
from app.models.models import Insight, Call
from app.schemas.schemas import (
    InsightData,
    DashboardSummary,
    SentimentDistribution,
    PainPoint,
    HighInterestQuote,
    ChurnInterestQuote,
    GenericSection,
    ChurnInterestSection,
    RevenueInterestSection,
    LiveCall
)
from app.services.ai_service import AIService
from app.services.rag_service import RAGService
from app.services.cache_service import CacheService


class InsightService:
    """Service for managing insights and AI analysis"""
    
    # Class-level async queue for live call analysis
    _live_call_queue: Optional[asyncio.Queue] = None
    _queue_processor_task: Optional[asyncio.Task] = None
    
    def __init__(self, db: Session):
        self.db = db
        self.ai_service = AIService()
        self.rag_service = RAGService(db)
        
        # Initialize queue if not already initialized
        if InsightService._live_call_queue is None:
            InsightService._live_call_queue = asyncio.Queue()
            # Start queue processor if not already running
            if InsightService._queue_processor_task is None or InsightService._queue_processor_task.done():
                InsightService._queue_processor_task = asyncio.create_task(
                    InsightService._process_live_call_queue()
                )
    
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
        
        # Get custom instructions from call
        custom_instructions = call.custom_instructions if call else None
        
        # Extract insights using AI with RAG context and custom instructions
        rag_context_str = rag_context.to_prompt_context() if rag_context else ""
        insights_data = await self.ai_service.extract_insights(transcript, rag_context_str, custom_instructions)
        
        # Anomaly score calculation removed to save latency
        # The anomaly_score field remains in the database for backward compatibility but is set to None
        anomaly_score = None
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
            existing_insight.churn_score = insights_data.churn_score
            existing_insight.churn_interest_quote = insights_data.churn_interest_quote
            existing_insight.revenue_interest_score = insights_data.revenue_interest_score
            existing_insight.revenue_interest_quote = insights_data.revenue_interest_quote
            existing_insight.confidence = insights_data.confidence
            existing_insight.anomaly_score = anomaly_score
            existing_insight.custom_instruction_answers = insights_data.custom_instruction_answers
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
                churn_score=insights_data.churn_score,
                churn_interest_quote=insights_data.churn_interest_quote,
                revenue_interest_score=insights_data.revenue_interest_score,
                revenue_interest_quote=insights_data.revenue_interest_quote,
                confidence=insights_data.confidence,
                anomaly_score=anomaly_score,
                custom_instruction_answers=insights_data.custom_instruction_answers
            )
            
            self.db.add(insight)
            try:
                self.db.commit()
                self.db.refresh(insight)
            except Exception as commit_error:
                self.db.rollback()
                print(f"❌ Failed to commit insight for {call_id}: {str(commit_error)}")
                raise  # Re-raise so caller knows it failed
        
        # Invalidate relevant caches after storing new/updated insights
        CacheService.invalidate_trend_cache(gym_id=gym_id)  # Invalidate all trend caches for this gym
        CacheService.invalidate_dashboard_cache(gym_id=gym_id)  # Invalidate dashboard cache
        CacheService.invalidate_chart_calls_cache(gym_id=gym_id)  # Invalidate chart calls cache
        # Clear bulk insights cache (small cache, easier to clear all than track which entries contain this call_id)
        CacheService.invalidate_bulk_insights_cache()
        
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
    
    def get_dashboard_summary(
        self, 
        gym_id: Optional[str] = None,
        churn_threshold: float = 0.8,
        revenue_threshold: float = 0.8
    ) -> DashboardSummary:
        """
        Generate dashboard summary with three distinct sections:
        1. Generic section (all calls)
        2. Churn interest section (calls with churn_score > threshold)
        3. Revenue interest section (calls with revenue_interest_score > threshold)
        
        Args:
            gym_id: Optional gym filter
            churn_threshold: Threshold for churn interest filtering (default 0.5)
            revenue_threshold: Threshold for revenue interest filtering (default 0.5)
        
        Returns:
            DashboardSummary with three sections
        """
        # Base query for calls
        calls_query = self.db.query(Call)
        if gym_id:
            calls_query = calls_query.filter(Call.gym_id == gym_id)
        
        total_calls = calls_query.count()
        
        # Base query for insights - EXCLUDE low confidence (confidence < 0.3)
        insights_query = self.db.query(Insight).filter(Insight.confidence >= 0.3)
        if gym_id:
            insights_query = insights_query.join(Call).filter(Call.gym_id == gym_id)
        
        # ===== GENERIC SECTION =====
        # Count sentiments (only from high-confidence insights)
        positive_count = insights_query.filter(Insight.sentiment == "positive").count()
        negative_count = insights_query.filter(Insight.sentiment == "negative").count()
        
        # Calculate average confidence
        avg_confidence = None
        confidences = insights_query.filter(Insight.confidence.isnot(None)).all()
        if confidences:
            confidence_values = [i.confidence for i in confidences if i.confidence is not None]
            if confidence_values:
                avg_confidence = round(sum(confidence_values) / len(confidence_values), 2)
        
        # Calculate total and average duration
        total_duration = None
        avg_duration = None
        calls_with_duration = calls_query.filter(Call.duration_seconds.isnot(None)).all()
        
        if calls_with_duration:
            durations = [c.duration_seconds for c in calls_with_duration if c.duration_seconds is not None]
            if durations:
                total_duration = sum(durations)
                avg_duration = round(sum(durations) / len(durations), 1)
        
        # Calculate call pickup rate (completed calls / total calls)
        pickup_rate = None
        if total_calls > 0:
            completed_calls = calls_query.filter(Call.status == 'completed').count()
            pickup_rate = round((completed_calls / total_calls) * 100, 1) if total_calls > 0 else 0.0

        # Calculate average gym rating across all calls (where rating is available)
        average_rating = None
        avg_rating_query = insights_query.filter(Insight.gym_rating.isnot(None)).with_entities(func.avg(Insight.gym_rating))
        avg_rating_value = avg_rating_query.scalar()
        if avg_rating_value is not None:
            average_rating = round(float(avg_rating_value), 1)
        
        # Top pain points from all calls
        top_pain_points = self._get_top_pain_points(gym_id, limit=5)
        
        # Top opportunities from all calls
        top_opportunities = self._get_top_opportunities(gym_id, limit=5)
        
        generic_section = GenericSection(
            total_calls=total_calls,
            positive_sentiment=positive_count,
            negative_sentiment=negative_count,
            average_confidence=avg_confidence,
            total_duration_seconds=total_duration,
            average_duration_seconds=avg_duration,
            call_pickup_rate=pickup_rate,
            average_gym_rating=average_rating,
            block_1=None,  # Placeholder - can be updated later
            block_2=None,  # Placeholder - can be updated later
            top_pain_points=top_pain_points,
            top_opportunities=top_opportunities
        )
        
        # ===== CHURN INTEREST SECTION =====
        # Get churn calls (churn_score >= threshold) - use >= to match user segment logic
        churn_insights_query = insights_query.filter(Insight.churn_score >= churn_threshold)
        churn_calls_count = churn_insights_query.count()
        
        # Calculate average gym rating for churn calls (only where rating is not None)
        churn_ratings = churn_insights_query.filter(Insight.gym_rating.isnot(None)).all()
        churn_avg_rating = None
        if churn_ratings:
            ratings_sum = sum(insight.gym_rating for insight in churn_ratings if insight.gym_rating is not None)
            ratings_count = len([insight for insight in churn_ratings if insight.gym_rating is not None])
            if ratings_count > 0:
                churn_avg_rating = round(ratings_sum / ratings_count, 1)
        
        # Top 5 pain points from churn calls
        churn_pain_points = self._get_top_pain_points_from_churn_calls(gym_id, churn_threshold, limit=5)
        
        # Top 5 churn interest quotes (highest churn scores, filtered by threshold)
        churn_quotes = self._get_churn_interest_quotes(gym_id, churn_threshold, limit=5)
        
        churn_section = ChurnInterestSection(
            total_calls=churn_calls_count,
            average_gym_rating=churn_avg_rating,
            top_pain_points=churn_pain_points,
            top_churn_quotes=churn_quotes,
            churn_threshold=churn_threshold
        )
        
        # ===== REVENUE INTEREST SECTION =====
        # Get revenue calls (revenue_interest_score >= threshold) - use >= to match user segment logic
        revenue_insights_query = insights_query.filter(Insight.revenue_interest_score >= revenue_threshold)
        revenue_calls_count = revenue_insights_query.count()
        
        # Calculate average gym rating for revenue calls (only where rating is not None)
        revenue_ratings = revenue_insights_query.filter(Insight.gym_rating.isnot(None)).all()
        revenue_avg_rating = None
        if revenue_ratings:
            ratings_sum = sum(insight.gym_rating for insight in revenue_ratings if insight.gym_rating is not None)
            ratings_count = len([insight for insight in revenue_ratings if insight.gym_rating is not None])
            if ratings_count > 0:
                revenue_avg_rating = round(ratings_sum / ratings_count, 1)
        
        # Top 5 opportunities from revenue calls
        revenue_opportunities = self._get_top_opportunities_from_revenue_calls(gym_id, revenue_threshold, limit=5)
        
        # Top 5 revenue interest quotes (highest revenue scores, filtered by threshold)
        revenue_quotes = self._get_high_interest_quotes(gym_id, revenue_threshold, limit=5)
        
        revenue_section = RevenueInterestSection(
            total_calls=revenue_calls_count,
            average_gym_rating=revenue_avg_rating,
            top_opportunities=revenue_opportunities,
            top_revenue_quotes=revenue_quotes,
            revenue_threshold=revenue_threshold
        )
        
        return DashboardSummary(
            generic=generic_section,
            churn_interest=churn_section,
            revenue_interest=revenue_section
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
    
    def _get_top_opportunities(
        self,
        gym_id: Optional[str] = None,
        limit: int = 5
    ) -> List[PainPoint]:
        """
        Get most common opportunities across all calls (excludes low confidence insights)
        
        Args:
            gym_id: Optional gym filter
            limit: Max number of opportunities to return
        
        Returns:
            List of PainPoint objects (using same schema for consistency)
        """
        # Filter out low confidence insights (confidence < 0.3)
        query = self.db.query(Insight).filter(Insight.confidence >= 0.3)
        
        if gym_id:
            query = query.join(Call).filter(Call.gym_id == gym_id)
        
        # Get all insights with opportunities (only high confidence)
        insights = query.filter(Insight.opportunities.isnot(None)).all()
        
        # Count opportunity occurrences
        opportunity_counts = {}
        for insight in insights:
            if insight.opportunities:
                for opportunity in insight.opportunities:
                    opportunity_lower = opportunity.lower().strip()
                    opportunity_counts[opportunity_lower] = opportunity_counts.get(opportunity_lower, 0) + 1
        
        # Sort by count and return top N
        sorted_opportunities = sorted(
            opportunity_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]
        
        return [
            PainPoint(name=name.capitalize(), count=count)
            for name, count in sorted_opportunities
        ]
    
    def _get_top_pain_points_from_churn_calls(
        self,
        gym_id: Optional[str] = None,
        churn_threshold: float = 0.5,
        limit: int = 5
    ) -> List[PainPoint]:
        """
        Get most common pain points from calls with churn_score > threshold
        
        Args:
            gym_id: Optional gym filter
            churn_threshold: Minimum churn score to include
            limit: Max number of pain points to return
        
        Returns:
            List of PainPoint objects
        """
        # Filter for churn calls with high confidence
        query = self.db.query(Insight).filter(
            Insight.confidence >= 0.3,
            Insight.churn_score >= churn_threshold
        )
        
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
    
    def _get_top_opportunities_from_revenue_calls(
        self,
        gym_id: Optional[str] = None,
        revenue_threshold: float = 0.5,
        limit: int = 5
    ) -> List[PainPoint]:
        """
        Get most common opportunities from calls with revenue_interest_score > threshold
        
        Args:
            gym_id: Optional gym filter
            revenue_threshold: Minimum revenue interest score to include
            limit: Max number of opportunities to return
        
        Returns:
            List of PainPoint objects (using same schema for consistency)
        """
        # Filter for revenue calls with high confidence
        query = self.db.query(Insight).filter(
            Insight.confidence >= 0.3,
            Insight.revenue_interest_score >= revenue_threshold
        )
        
        if gym_id:
            query = query.join(Call).filter(Call.gym_id == gym_id)
        
        # Get all insights with opportunities
        insights = query.filter(Insight.opportunities.isnot(None)).all()
        
        # Count opportunity occurrences
        opportunity_counts = {}
        for insight in insights:
            if insight.opportunities:
                for opportunity in insight.opportunities:
                    opportunity_lower = opportunity.lower().strip()
                    opportunity_counts[opportunity_lower] = opportunity_counts.get(opportunity_lower, 0) + 1
        
        # Sort by count and return top N
        sorted_opportunities = sorted(
            opportunity_counts.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]
        
        return [
            PainPoint(name=name.capitalize(), count=count)
            for name, count in sorted_opportunities
        ]
    
    def _get_churn_interest_quotes(
        self,
        gym_id: Optional[str] = None,
        churn_threshold: float = 0.75,
        limit: int = 5
    ) -> List[ChurnInterestQuote]:
        """
        Get quotes from high churn risk calls (excludes low confidence insights)
        Only includes calls with churn_score > threshold
        
        Args:
            gym_id: Optional gym filter
            churn_threshold: Minimum churn score to include (default 0.75)
            limit: Max number of quotes
        
        Returns:
            List of ChurnInterestQuote objects
        """
        # Filter out low confidence insights (confidence < 0.3) and apply churn threshold
        query = self.db.query(Insight, Call).join(
            Call, Insight.call_id == Call.call_id
        ).filter(
            Insight.churn_score.isnot(None),
            Insight.churn_score > churn_threshold,  # Only calls above threshold
            Insight.confidence >= 0.3,  # Only high confidence insights
            Call.raw_transcript.isnot(None)
        )
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        query = query.order_by(Insight.churn_score.desc(), Insight.confidence.desc()).limit(limit)
        
        results = query.all()
        
        quotes = []
        for insight, call in results:
            # Use the AI-extracted churn interest quote if available
            if insight.churn_interest_quote:
                quote_text = insight.churn_interest_quote
            else:
                # Fallback: use first 200 chars of transcript if quote not available
                transcript = call.raw_transcript or ""
                quote_text = transcript[:200] + "..." if len(transcript) > 200 else transcript
            
            quotes.append(
                ChurnInterestQuote(
                    quote=quote_text,
                    sentiment=insight.sentiment,
                    phone_number=call.phone_number,  # Full phone number
                    call_id=call.call_id
                )
            )
        
        return quotes
    
    def _get_high_interest_quotes(
        self,
        gym_id: Optional[str] = None,
        revenue_threshold: float = 0.75,
        limit: int = 5
    ) -> List[HighInterestQuote]:
        """
        Get quotes from high revenue interest calls (excludes low confidence insights)
        Only includes calls with revenue_interest_score > threshold
        
        Args:
            gym_id: Optional gym filter
            revenue_threshold: Minimum revenue interest score to include (default 0.75)
            limit: Max number of quotes
        
        Returns:
            List of HighInterestQuote objects
        """
        # Filter out low confidence insights (confidence < 0.3) and apply revenue threshold
        # Use >= to include threshold value (changed from >)
        query = self.db.query(Insight, Call).join(
            Call, Insight.call_id == Call.call_id
        ).filter(
            Insight.revenue_interest_score.isnot(None),
            Insight.revenue_interest_score >= revenue_threshold,  # Use >= to include threshold value
            Insight.confidence >= 0.3,  # Only high confidence insights
            Call.raw_transcript.isnot(None)
        )
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        # Order by score and get more results than needed, then filter in Python
        query = query.order_by(Insight.revenue_interest_score.desc(), Insight.confidence.desc()).limit(limit * 2)  # Get extra to account for filtering
        
        results = query.all()
        
        quotes = []
        for insight, call in results:
            # Check if quote exists and is not empty
            if not insight.revenue_interest_quote:
                continue
            
            quote_text = insight.revenue_interest_quote.strip()
            
            # Only add if quote is not empty after stripping
            if not quote_text:
                continue
            
            quotes.append(
                HighInterestQuote(
                    quote=quote_text,
                    sentiment=insight.sentiment,
                    phone_number=call.phone_number,  # Full phone number
                    call_id=call.call_id
                )
            )
            
            # Stop once we have enough quotes with valid text
            if len(quotes) >= limit:
                break
        
        return quotes
    
    def _fetch_churn_trend_data_from_db(
        self,
        gym_id: Optional[str] = None,
        days: int = 30,
        period: str = "day",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict]:
        """Internal method to fetch churn trend data from database"""
        if end_date is None:
            end_date = datetime.utcnow()
        if start_date is None:
            start_date = end_date - timedelta(days=days)
        
        # OPTIMIZED: Use SQL aggregation to calculate averages in database
        base_query = self.db.query(
            func.date(Call.created_at).label('date'),
            func.avg(Insight.churn_score).label('avg_score'),
            func.count(Insight.call_id).label('count'),
            func.max(Insight.churn_score).label('max_score')
        ).join(Call, Insight.call_id == Call.call_id).filter(
            Insight.churn_score.isnot(None),
            Insight.churn_score >= 0.0,
            Insight.confidence >= 0.3,
            Call.created_at >= start_date,
            Call.created_at <= end_date
        )
        
        if gym_id:
            base_query = base_query.filter(Call.gym_id == gym_id)
        
        # Group by date and aggregate
        aggregated_results = base_query.group_by(func.date(Call.created_at)).order_by(func.date(Call.created_at)).all()
        
        if len(aggregated_results) == 0:
            return []
        
        # Build trend data
        trend_data = []
        for date_row in aggregated_results:
            date_str = date_row.date.isoformat() if hasattr(date_row.date, 'isoformat') else str(date_row.date)
            avg_score = float(date_row.avg_score) if date_row.avg_score else 0.0
            count = int(date_row.count) if date_row.count else 0
            
            trend_data.append({
                "date": date_str,
                "value": round(avg_score, 1),
                "call_id": None,
                "count": count
            })
        
        return trend_data
    
    def get_churn_trend_data(
        self,
        gym_id: Optional[str] = None,
        days: int = 30,
        period: str = "day"
    ) -> List[Dict]:
        """Get churn score trend data over time - CACHED"""
        # Use simple full caching for better performance (cache entire result)
        return CacheService.get_trend_data(
            cache_type='churn',
            fetch_func=lambda **kwargs: self._fetch_churn_trend_data_from_db(**kwargs),
            gym_id=gym_id,
            days=days,
            period=period
        )
    
    def _fetch_revenue_trend_data_from_db(
        self,
        gym_id: Optional[str] = None,
        days: int = 30,
        period: str = "day",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict]:
        """Internal method to fetch revenue trend data from database"""
        if end_date is None:
            end_date = datetime.utcnow()
        if start_date is None:
            start_date = end_date - timedelta(days=days)
        
        # OPTIMIZED: Use SQL aggregation to calculate averages in database
        base_query = self.db.query(
            func.date(Call.created_at).label('date'),
            func.avg(Insight.revenue_interest_score).label('avg_score'),
            func.count(Insight.call_id).label('count')
        ).join(Call, Insight.call_id == Call.call_id).filter(
            Insight.revenue_interest_score.isnot(None),
            Insight.revenue_interest_score >= 0.0,
            Insight.confidence >= 0.3,
            Call.created_at >= start_date,
            Call.created_at <= end_date
        )
        
        if gym_id:
            base_query = base_query.filter(Call.gym_id == gym_id)
        
        # Group by date and aggregate
        aggregated_results = base_query.group_by(func.date(Call.created_at)).order_by(func.date(Call.created_at)).all()
        
        if len(aggregated_results) == 0:
            return []
        
        # Build trend data
        trend_data = []
        for date_row in aggregated_results:
            date_str = date_row.date.isoformat() if hasattr(date_row.date, 'isoformat') else str(date_row.date)
            avg_score = float(date_row.avg_score) if date_row.avg_score else 0.0
            count = int(date_row.count) if date_row.count else 0
            
            trend_data.append({
                "date": date_str,
                "value": round(avg_score, 1),
                "call_id": None,
                "count": count
            })
        
        return trend_data
    
    def get_revenue_trend_data(
        self,
        gym_id: Optional[str] = None,
        days: int = 30,
        period: str = "day"
    ) -> List[Dict]:
        """Get revenue interest score trend data over time - CACHED"""
        # Use simple full caching for better performance (cache entire result)
        return CacheService.get_trend_data(
            cache_type='revenue',
            fetch_func=lambda **kwargs: self._fetch_revenue_trend_data_from_db(**kwargs),
            gym_id=gym_id,
            days=days,
            period=period
        )
    
    def _fetch_sentiment_trend_data_from_db(
        self,
        gym_id: Optional[str] = None,
        days: int = 30,
        period: str = "day",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict]:
        """Internal method to fetch sentiment trend data from database"""
        if end_date is None:
            end_date = datetime.utcnow()
        if start_date is None:
            start_date = end_date - timedelta(days=days)
        
        # Base query
        query = self.db.query(
            Insight.sentiment,
            Insight.call_id,
            Call.created_at
        ).join(Call, Insight.call_id == Call.call_id).filter(
            Insight.sentiment.isnot(None),
            Insight.confidence >= 0.3,
            Call.created_at >= start_date,
            Call.created_at <= end_date
        )
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        results = query.order_by(Call.created_at).all()
        
        # Group by date and sentiment
        data_by_date = defaultdict(lambda: {"positive": [], "neutral": [], "negative": [], "call_ids": []})
        for sentiment, call_id, created_at in results:
            date_key = created_at.date().isoformat()
            if sentiment:
                sentiment_lower = sentiment.lower()
                if sentiment_lower in ["positive", "neutral", "negative"]:
                    data_by_date[date_key][sentiment_lower].append(call_id)
            data_by_date[date_key]["call_ids"].append(call_id)
        
        # Format for stacked area chart
        trend_data = []
        for date_str in sorted(data_by_date.keys()):
            date_data = data_by_date[date_str]
            total = len(date_data["call_ids"])
            if total > 0:
                # Get representative call_id (first one for this date)
                representative_call_id = date_data["call_ids"][0] if date_data["call_ids"] else None
                
                trend_data.append({
                    "date": date_str,
                    "positive": len(date_data["positive"]),
                    "neutral": len(date_data["neutral"]),
                    "negative": len(date_data["negative"]),
                    "call_id": representative_call_id,
                    "total": total
                })
            else:
                trend_data.append({
                    "date": date_str,
                    "positive": 0,
                    "neutral": 0,
                    "negative": 0,
                    "call_id": None,
                    "total": 0
                })
        
        return trend_data
    
    def get_sentiment_trend_data(
        self,
        gym_id: Optional[str] = None,
        days: int = 30,
        period: str = "day"
    ) -> Dict:
        """Get sentiment distribution trend data over time - CACHED"""
        # Use simple full caching for better performance (cache entire result)
        trend_data = CacheService.get_trend_data(
            cache_type='sentiment',
            fetch_func=lambda **kwargs: self._fetch_sentiment_trend_data_from_db(**kwargs),
            gym_id=gym_id,
            days=days,
            period=period
        )
        
        # Calculate date range for metadata
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        return {
            "data": trend_data,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    
    def queue_live_call_analysis(self, live_call: LiveCall, call_id: str) -> bool:
        """
        Queue a live call for sentiment analysis.
        Returns True immediately after queuing.
        
        Args:
            live_call: LiveCall model with conversation and current sentiment
            call_id: Unique call identifier
            
        Returns:
            True if successfully queued
        """
        if InsightService._live_call_queue is None:
            InsightService._live_call_queue = asyncio.Queue()
            # Start queue processor if not already running
            if InsightService._queue_processor_task is None or InsightService._queue_processor_task.done():
                InsightService._queue_processor_task = asyncio.create_task(
                    InsightService._process_live_call_queue()
                )
        
        try:
            InsightService._live_call_queue.put_nowait({
                "live_call": live_call,
                "call_id": call_id
            })
            print(f"✅ Queued live call analysis for {call_id}")
            return True
        except Exception as e:
            print(f"❌ Failed to queue live call analysis for {call_id}: {str(e)}")
            return False
    
    @staticmethod
    async def _process_live_call_queue():
        """
        Background processor for live call analysis queue.
        Processes items one by one in order.
        """
        print("🚀 Live call analysis queue processor started")
        
        while True:
            try:
                # Check if queue exists
                if InsightService._live_call_queue is None:
                    await asyncio.sleep(1)
                    continue
                
                # Wait for item from queue
                item = await InsightService._live_call_queue.get()
                live_call = item["live_call"]
                call_id = item["call_id"]
                
                # Check if call still exists in cache (call might have completed)
                cached_live_call = CacheService.get_live_call(call_id)
                if cached_live_call is None:
                    print(f"⚠️ Call {call_id} not found in cache (call completed), skipping analysis")
                    InsightService._live_call_queue.task_done()
                    continue
                
                print(f"📊 Processing live call analysis for {call_id}")
                
                # Extract only USER conversation turns
                user_conversation_turns = [
                    turn.speech for turn in live_call.conversation
                    if turn.speaker_type.upper() == "USER"
                ]
                
                if not user_conversation_turns:
                    print(f"⚠️ No user conversation found for {call_id}, skipping")
                    InsightService._live_call_queue.task_done()
                    continue
                
                # Combine user conversation into text
                user_conversation = "\n".join(user_conversation_turns)
                
                # Get previous analysis values from live call model
                # If values are None, this is the first analysis
                previous_sentiment = live_call.sentiment if live_call.sentiment else None
                previous_churn_score = live_call.churn_score if live_call.churn_score is not None else None
                previous_revenue_score = live_call.revenue_interest_score if live_call.revenue_interest_score is not None else None
                
                # Analyze using AI (no RAG, fast)
                ai_service = AIService()
                analysis_result = await ai_service.analyze_live_call(
                    user_conversation=user_conversation,
                    previous_sentiment=previous_sentiment,
                    previous_churn_score=previous_churn_score,
                    previous_revenue_score=previous_revenue_score
                )
                
                new_sentiment = analysis_result["sentiment"]
                new_churn_score = analysis_result["churn_score"]
                new_revenue_score = analysis_result["revenue_interest_score"]
                new_confidence = analysis_result["confidence"]
                
                print(f"✅ Analyzed for {call_id}: sentiment={new_sentiment}, churn={new_churn_score:.1f}, revenue={new_revenue_score:.1f}, confidence={new_confidence:.2f}")
                
                # Check again if call still exists in cache (call might have completed during analysis)
                cached_live_call_after = CacheService.get_live_call(call_id)
                if cached_live_call_after is None:
                    print(f"⚠️ Call {call_id} completed during analysis, skipping cache update")
                    InsightService._live_call_queue.task_done()
                    continue
                
                # Update the cached LiveCall model with new analysis results
                updated_live_call = cached_live_call_after.model_copy(update={
                    "sentiment": new_sentiment,
                    "churn_score": new_churn_score,
                    "revenue_interest_score": new_revenue_score,
                    "confidence": new_confidence
                })
                
                # Store/update in cache
                CacheService.set_live_call(call_id, updated_live_call)
                print(f"✅ Updated cache for {call_id} with all analysis fields")
                
                # Mark task as done
                InsightService._live_call_queue.task_done()
                
            except Exception as e:
                print(f"❌ Error processing live call analysis: {str(e)}")
                import traceback
                traceback.print_exc()
                # Mark task as done even on error to prevent queue blocking
                if InsightService._live_call_queue:
                    InsightService._live_call_queue.task_done()
                # Continue processing next item
                await asyncio.sleep(1)  # Brief pause before retrying
