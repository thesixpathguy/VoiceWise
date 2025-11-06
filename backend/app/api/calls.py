from fastapi import APIRouter, HTTPException, Depends, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta
from app.core.database import get_db
from app.schemas.schemas import (
    CallInitiate,
    CallInitiateResponse,
    CallDetail,
    InsightResponse,
    DashboardSummary,
    SearchResponse,
    PaginatedCallsResponse,
    TimeSeriesResponse,
    TimeSeriesDataPoint,
    CallPickupRateResponse
)
from app.services.call_service import CallService
from app.services.insight_service import InsightService
from app.services.search_service import SearchService

router = APIRouter(prefix="/calls", tags=["Calls"])


@router.post("/initiate", response_model=CallInitiateResponse)
async def initiate_calls(
    call_request: CallInitiate,
    gym_id: str = Query(..., description="Gym ID for tracking"),
    db: Session = Depends(get_db)
):
    """
    Initiate automated feedback calls to gym members using Bland AI
    
    - **phone_numbers**: List of member phone numbers to call
    - **gym_id**: Gym identifier for tracking calls
    """
    call_service = CallService(db)
    try:
        result = await call_service.initiate_batch_calls(
            phone_numbers=call_request.phone_numbers,
            gym_id=gym_id,
            custom_instructions=call_request.custom_instructions
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate calls: {str(e)}")


@router.get("", response_model=PaginatedCallsResponse)
async def list_calls(
    gym_id: Optional[str] = Query(None, description="Filter by gym ID"),
    status: Optional[str] = Query(None, description="Filter by call status"),
    sentiment: Optional[str] = Query(None, description="Filter by sentiment (positive, neutral, negative)"),
    pain_point: Optional[str] = Query(None, description="Filter by specific pain point (for drill-down)"),
    opportunity: Optional[str] = Query(None, description="Filter by specific opportunity (for drill-down)"),
    revenue_interest: Optional[bool] = Query(None, description="Filter by revenue interest (true/false)"),
    churn_min_score: Optional[float] = Query(None, ge=0.0, le=1.0, description="Filter by minimum churn score (for drill-down)"),
    revenue_min_score: Optional[float] = Query(None, ge=0.0, le=1.0, description="Filter by minimum revenue interest score (for drill-down)"),
    start_date: Optional[str] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="Filter by end date (ISO format)"),
    order_by: Optional[str] = Query(None, description="Order results: 'churn_score_desc', 'revenue_score_desc', 'created_at_desc' (default)"),
    limit: int = Query(50, ge=1, le=200, description="Number of calls to return"),
    skip: int = Query(0, ge=0, description="Number of calls to skip"),
    db: Session = Depends(get_db)
):
    """
    List all calls with optional filtering and drill-down support (CACHED for chart queries)
    
    - **gym_id**: Filter calls by gym
    - **status**: Filter by call status
    - **sentiment**: Filter by sentiment (positive, neutral, negative)
    - **pain_point**: Filter by specific pain point (for drill-down from dashboard)
    - **opportunity**: Filter by specific opportunity (for drill-down from dashboard)
    - **revenue_interest**: Filter by revenue interest (true/false)
    - **churn_min_score**: Filter by minimum churn score (for drill-down from churn section)
    - **revenue_min_score**: Filter by minimum revenue interest score (for drill-down from revenue section)
    - **order_by**: Order results by score or date (for drill-down to show highest scores first)
    - **limit**: Max number of results (1-200)
    - **skip**: Pagination offset
    
    Returns paginated response with total count
    Note: Only chart-related queries (with date filters and limit <= 200) are cached
    """
    from app.services.cache_service import CacheService
    
    call_service = CallService(db)
    
    def fetch_calls_from_db(**kwargs):
        """Internal function to fetch calls from database"""
        calls, total_count = call_service.get_calls(**kwargs)
        return calls, total_count
    
    # Use cache for chart queries (date filters + reasonable limit)
    # Skip cache for pagination queries (skip > 0) or queries without date filters
    is_chart_query = (
        start_date is not None and 
        end_date is not None and 
        skip == 0 and  # No pagination for chart queries
        limit <= 200
    )
    
    if is_chart_query:
        # Use cache service for chart queries
        # OPTIMIZED: Cache both calls and count together
        def fetch_chart_data(**kwargs):
            """Fetch both calls and count for chart queries"""
            calls, total_count = fetch_calls_from_db(**kwargs)
            return {"calls": calls, "total": total_count}
        
        cached_result = CacheService.get_chart_calls(
            fetch_func=fetch_chart_data,
            gym_id=gym_id,
            start_date=start_date,
            end_date=end_date,
            churn_min_score=churn_min_score,
            revenue_min_score=revenue_min_score,
            order_by=order_by,
            limit=limit
        )
        
        # Extract calls and count from cached result
        if isinstance(cached_result, dict):
            calls = cached_result.get("calls", [])
            total_count = cached_result.get("total", len(calls))
        else:
            # Fallback for old cache format
            calls = cached_result
            # Get count separately if not in cache (only if cache miss)
            _, total_count = fetch_calls_from_db(
                gym_id=gym_id,
                start_date=start_date,
                end_date=end_date,
                churn_min_score=churn_min_score,
                revenue_min_score=revenue_min_score,
                order_by=order_by,
                limit=limit,
                skip=0
            )
    else:
        # Not a chart query, fetch directly (no cache)
        try:
            calls, total_count = fetch_calls_from_db(
                gym_id=gym_id,
                status=status,
                sentiment=sentiment,
                pain_point=pain_point,
                opportunity=opportunity,
                revenue_interest=revenue_interest,
                churn_min_score=churn_min_score,
                revenue_min_score=revenue_min_score,
                start_date=start_date,
                end_date=end_date,
                order_by=order_by,
                limit=limit,
                skip=skip
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch calls: {str(e)}")
    
    return PaginatedCallsResponse(
        calls=[CallDetail.model_validate(call) for call in calls],
        total=total_count,
        limit=limit,
        skip=skip
    )


@router.get("/search", response_model=SearchResponse)
async def search_calls(
    query: str = Query(..., description="Search query"),
    search_type: str = Query("nlp", description="Search type: phone, sentiment, nlp"),
    gym_id: Optional[str] = Query(None, description="Filter by gym ID"),
    limit: int = Query(30, ge=1, le=30, description="Number of results to return (max 30)"),
    skip: int = Query(0, ge=0, description="Number of results to skip"),
    db: Session = Depends(get_db)
):
    """
    Hybrid search for calls
    
    - **query**: Search query (phone number, sentiment value, or NLP query)
    - **search_type**: Type of search
        - `phone`: Search by phone number (exact or partial match), sorted by confidence descending
        - `sentiment`: Filter by sentiment (positive, neutral, negative)
            - Positive: sorted by revenue_interest_score descending
            - Negative: sorted by churn_score descending
            - Neutral: sorted by confidence descending
        - `nlp`: Semantic search using NLP (e.g., "need trainer", "equipment issues"), sorted by cosine distance (closest first)
    - **gym_id**: Optional gym filter
    - **limit**: Max number of results (1-50, default 50)
    - **skip**: Pagination offset
    
    Returns aggregated insights and individual call results
    """
    search_service = SearchService(db)
    
    try:
        results = search_service.search_calls(
            query=query,
            search_type=search_type,
            gym_id=gym_id,
            limit=limit,
            skip=skip,
            similarity_threshold=0.54  # Fixed threshold: balanced relevance
        )
        return results
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"❌ Search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/{call_id}", response_model=CallDetail)
async def get_call(call_id: str, db: Session = Depends(get_db)):
    """
    Get detailed information about a specific call
    
    - **call_id**: Unique call identifier
    """
    call_service = CallService(db)
    call = call_service.get_call_by_id(call_id)
    
    if not call:
        raise HTTPException(status_code=404, detail=f"Call {call_id} not found")
    
    return call


@router.get("/{call_id}/insights", response_model=InsightResponse)
async def get_call_insights(call_id: str, db: Session = Depends(get_db)):
    """
    Get AI-extracted insights for a specific call
    
    - **call_id**: Unique call identifier
    """
    insight_service = InsightService(db)
    insights = insight_service.get_insights_by_call_id(call_id)
    
    if not insights:
        raise HTTPException(status_code=404, detail=f"No insights found for call {call_id}")
    
    return insights


@router.post("/insights/bulk")
async def get_bulk_insights(
    call_ids: List[str] = Body(..., description="List of call IDs to fetch insights for"),
    db: Session = Depends(get_db)
):
    """
    Get AI-extracted insights for multiple calls in a single request (CACHED)
    
    - **call_ids**: List of call IDs to fetch insights for
    """
    from app.models.models import Insight
    from app.services.cache_service import CacheService
    
    if not call_ids or len(call_ids) == 0:
        return {"insights": {}}
    
    # Limit to prevent abuse
    if len(call_ids) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 call IDs allowed per request")
    
    def fetch_insights_from_db(call_ids: List[str]):
        """Internal function to fetch insights from database"""
        # Fetch all insights in one query
        insights_query = db.query(Insight).filter(Insight.call_id.in_(call_ids))
        insights_list = insights_query.all()
        
        # Create a map of call_id -> insights
        insights_map = {}
        for insight in insights_list:
            insights_map[insight.call_id] = InsightResponse.model_validate(insight)
        
        return {"insights": insights_map}
    
    # Use cache service
    result = CacheService.get_bulk_insights(call_ids, fetch_insights_from_db)
    return result



@router.post("/{call_id}/analyze")
async def analyze_call(call_id: str, db: Session = Depends(get_db)):
    """
    Manually trigger AI analysis for a call and store in Database
    
    - **call_id**: Unique call identifier
    """
    insight_service = InsightService(db)
    call_service = CallService(db)
    
    call = call_service.get_call_by_id(call_id)
    
    if not call:
        raise HTTPException(status_code=404, detail=f"Call {call_id} not found")
    
    if not call.raw_transcript:
        raise HTTPException(status_code=400, detail="No transcript available. Transcript is received from Bland AI webhook.")
    
    try:
        insights = await insight_service.analyze_and_store_insights(call_id, call.raw_transcript)
        return {
            "call_id": call_id,
            "status": "analysis_completed",
            "insights": insights
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    gym_id: Optional[str] = Query(None, description="Filter by gym ID"),
    churn_threshold: float = Query(0.8, ge=0.0, le=1.0, description="Threshold for churn interest filtering (0.0-1.0)"),
    revenue_threshold: float = Query(0.8, ge=0.0, le=1.0, description="Threshold for revenue interest filtering (0.0-1.0)"),
    db: Session = Depends(get_db)
):
    """
    Get dashboard summary with three distinct sections:
    1. Generic section: All calls with sentiment, pain points, opportunities
    2. Churn interest section: Calls with churn_score > threshold
    3. Revenue interest section: Calls with revenue_interest_score > threshold
    
    - **gym_id**: Optional gym filter
    - **churn_threshold**: Minimum churn score to include in churn section (default 0.5)
    - **revenue_threshold**: Minimum revenue score to include in revenue section (default 0.5)
    """
    insight_service = InsightService(db)
    try:
        summary = insight_service.get_dashboard_summary(
            gym_id=gym_id,
            churn_threshold=churn_threshold,
            revenue_threshold=revenue_threshold
        )
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate dashboard: {str(e)}")


@router.get("/stats/pickup", response_model=CallPickupRateResponse)
async def get_pickup_stats(
    gym_id: Optional[str] = Query(None, description="Filter by gym ID"),
    db: Session = Depends(get_db)
):
    """
    Get pickup rate statistics for calls page
    
    Pickup rate = (calls answered by human) / total calls * 100
    
    - **gym_id**: Optional gym filter
    """
    from app.models.models import Call
    
    try:
        # Build query
        query = db.query(Call)
        
        if gym_id:
            query = query.filter(Call.gym_id == gym_id)
        
        # Get total calls and human pickups
        total_calls = query.count()
        human_pickups = query.filter(Call.answered_by == 'human').count()
        
        # Calculate pickup rate: (humans answered / total calls) * 100
        pickup_rate = round((human_pickups / total_calls * 100), 1) if total_calls > 0 else 0.0
        
        return CallPickupRateResponse(
            total_calls=total_calls,
            human_pickups=human_pickups,
            pickup_rate=pickup_rate,
            gym_id=gym_id
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate pickup stats: {str(e)}")



@router.delete("/{call_id}")
async def delete_call(call_id: str, db: Session = Depends(get_db)):
    """
    Delete a call and its associated insights
    
    - **call_id**: Unique call identifier
    """
    call_service = CallService(db)
    
    if not call_service.get_call_by_id(call_id):
        raise HTTPException(status_code=404, detail=f"Call {call_id} not found")
    
    try:
        call_service.delete_call(call_id)
        return {"message": f"Call {call_id} deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete call: {str(e)}")


@router.get("/user-segments/churn")
async def get_top_churn_users(
    gym_id: Optional[str] = Query(None, description="Filter by gym ID"),
    threshold: float = Query(0.8, ge=0.0, le=1.0, description="Minimum churn score threshold"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """
    Get top churn user segments (latest call per phone number, churn_score >= threshold)
    Returns phone numbers ordered by churn score descending
    
    - **gym_id**: Optional gym filter
    - **threshold**: Minimum churn score (default 0.7)
    - **limit**: Max results (default 100)
    """
    call_service = CallService(db)
    try:
        results = call_service.get_top_churn_phone_numbers(
            gym_id=gym_id,
            threshold=threshold,
            limit=limit
        )
        return {
            "threshold": threshold,
            "total_count": len(results),
            "phone_numbers": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get churn user segments: {str(e)}")


@router.get("/user-segments/revenue")
async def get_top_revenue_users(
    gym_id: Optional[str] = Query(None, description="Filter by gym ID"),
    threshold: float = Query(0.8, ge=0.0, le=1.0, description="Minimum revenue interest score threshold"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """
    Get top revenue user segments (latest call per phone number, revenue_interest_score >= threshold)
    Returns phone numbers ordered by revenue score descending
    
    - **gym_id**: Optional gym filter
    - **threshold**: Minimum revenue interest score (default 0.7)
    - **limit**: Max results (default 100)
    """
    call_service = CallService(db)
    try:
        results = call_service.get_top_revenue_phone_numbers(
            gym_id=gym_id,
            threshold=threshold,
            limit=limit
        )
        return {
            "threshold": threshold,
            "total_count": len(results),
            "phone_numbers": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get revenue user segments: {str(e)}")


@router.get("/phone/{phone_number}/latest", response_model=CallDetail)
async def get_latest_call_by_phone(
    phone_number: str,
    gym_id: Optional[str] = Query(None, description="Filter by gym ID"),
    db: Session = Depends(get_db)
):
    """
    Get the latest call for a specific phone number
    
    - **phone_number**: Phone number to search for
    - **gym_id**: Optional gym filter
    """
    call_service = CallService(db)
    call = call_service.get_latest_call_by_phone_number(phone_number, gym_id)
    
    if not call:
        raise HTTPException(status_code=404, detail=f"No calls found for phone number {phone_number}")
    
    # Convert ORM object to Pydantic schema
    return CallDetail(
        call_id=call.call_id,
        phone_number=call.phone_number,
        status=call.status,
        duration_seconds=call.duration_seconds,
        created_at=call.created_at,
        raw_transcript=call.raw_transcript,
        custom_instructions=call.custom_instructions
    )


@router.get("/trends/churn", response_model=TimeSeriesResponse)
async def get_churn_trend(
    gym_id: Optional[str] = Query(None, description="Filter by gym ID"),
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    period: str = Query("day", description="Period grouping: day, week, month"),
    db: Session = Depends(get_db)
):
    """Get churn score trend data over time"""
    insight_service = InsightService(db)
    data = insight_service.get_churn_trend_data(gym_id, days, period)
    
    if data and len(data) > 0:
        # Convert dicts to TimeSeriesDataPoint objects
        data_points = [TimeSeriesDataPoint(**item) for item in data]
        return TimeSeriesResponse(
            data=data_points,
            period=period,
            start_date=data[0]["date"],
            end_date=data[-1]["date"]
        )
    else:
        return TimeSeriesResponse(
            data=[],
            period=period,
            start_date=datetime.utcnow().isoformat(),
            end_date=datetime.utcnow().isoformat()
        )


@router.get("/trends/revenue", response_model=TimeSeriesResponse)
async def get_revenue_trend(
    gym_id: Optional[str] = Query(None, description="Filter by gym ID"),
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    period: str = Query("day", description="Period grouping: day, week, month"),
    db: Session = Depends(get_db)
):
    """Get revenue interest score trend data over time"""
    insight_service = InsightService(db)
    data = insight_service.get_revenue_trend_data(gym_id, days, period)
    
    if data and len(data) > 0:
        # Convert dicts to TimeSeriesDataPoint objects
        data_points = [TimeSeriesDataPoint(**item) for item in data]
        return TimeSeriesResponse(
            data=data_points,
            period=period,
            start_date=data[0]["date"],
            end_date=data[-1]["date"]
        )
    else:
        return TimeSeriesResponse(
            data=[],
            period=period,
            start_date=datetime.utcnow().isoformat(),
            end_date=datetime.utcnow().isoformat()
        )


@router.get("/trends/sentiment")
async def get_sentiment_trend(
    gym_id: Optional[str] = Query(None, description="Filter by gym ID"),
    days: int = Query(30, ge=1, le=365, description="Number of days to look back"),
    period: str = Query("day", description="Period grouping: day, week, month"),
    db: Session = Depends(get_db)
):
    """Get sentiment distribution trend data over time"""
    insight_service = InsightService(db)
    result = insight_service.get_sentiment_trend_data(gym_id, days, period)
    return result
