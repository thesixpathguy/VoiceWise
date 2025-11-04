from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas.schemas import (
    CallInitiate,
    CallInitiateResponse,
    CallDetail,
    InsightResponse,
    DashboardSummary,
    SearchResponse,
    PaginatedCallsResponse
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
    order_by: Optional[str] = Query(None, description="Order results: 'churn_score_desc', 'revenue_score_desc', 'created_at_desc' (default)"),
    limit: int = Query(50, ge=1, le=100, description="Number of calls to return"),
    skip: int = Query(0, ge=0, description="Number of calls to skip"),
    db: Session = Depends(get_db)
):
    """
    List all calls with optional filtering and drill-down support
    
    - **gym_id**: Filter calls by gym
    - **status**: Filter by call status
    - **sentiment**: Filter by sentiment (positive, neutral, negative)
    - **pain_point**: Filter by specific pain point (for drill-down from dashboard)
    - **opportunity**: Filter by specific opportunity (for drill-down from dashboard)
    - **revenue_interest**: Filter by revenue interest (true/false)
    - **churn_min_score**: Filter by minimum churn score (for drill-down from churn section)
    - **revenue_min_score**: Filter by minimum revenue interest score (for drill-down from revenue section)
    - **order_by**: Order results by score or date (for drill-down to show highest scores first)
    - **limit**: Max number of results (1-100)
    - **skip**: Pagination offset
    
    Returns paginated response with total count
    """
    call_service = CallService(db)
    try:
        calls, total_count = call_service.get_calls(
            gym_id=gym_id,
            status=status,
            sentiment=sentiment,
            pain_point=pain_point,
            opportunity=opportunity,
            revenue_interest=revenue_interest,
            churn_min_score=churn_min_score,
            revenue_min_score=revenue_min_score,
            order_by=order_by,
            limit=limit,
            skip=skip
        )
        return PaginatedCallsResponse(
            calls=[CallDetail.model_validate(call) for call in calls],
            total=total_count,
            limit=limit,
            skip=skip
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve calls: {str(e)}")


@router.get("/search", response_model=SearchResponse)
async def search_calls(
    query: str = Query(..., description="Search query"),
    search_type: str = Query("nlp", description="Search type: phone, status, sentiment, nlp"),
    gym_id: Optional[str] = Query(None, description="Filter by gym ID"),
    limit: int = Query(50, ge=1, le=100, description="Number of results to return"),
    skip: int = Query(0, ge=0, description="Number of results to skip"),
    db: Session = Depends(get_db)
):
    """
    Hybrid search for calls
    
    - **query**: Search query (phone number, status, sentiment value, or NLP query)
    - **search_type**: Type of search
        - `phone`: Search by phone number (exact or partial match)
        - `status`: Filter by call status (completed, initiated, failed)
        - `sentiment`: Filter by sentiment (positive, neutral, negative)
        - `nlp`: Semantic search using NLP (e.g., "need trainer", "equipment issues")
    - **gym_id**: Optional gym filter
    - **limit**: Max number of results (1-100)
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
            similarity_threshold=0.77  # Fixed threshold: balanced relevance
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
