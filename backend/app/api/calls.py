from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas.schemas import (
    CallInitiate,
    CallInitiateResponse,
    CallDetail,
    InsightResponse,
    DashboardSummary
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
            gym_id=gym_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate calls: {str(e)}")


@router.get("", response_model=List[CallDetail])
async def list_calls(
    gym_id: Optional[str] = Query(None, description="Filter by gym ID"),
    status: Optional[str] = Query(None, description="Filter by call status"),
    sentiment: Optional[str] = Query(None, description="Filter by sentiment (positive, neutral, negative)"),
    pain_point: Optional[str] = Query(None, description="Filter by specific pain point"),
    revenue_interest: Optional[bool] = Query(None, description="Filter by revenue interest"),
    limit: int = Query(50, ge=1, le=100, description="Number of calls to return"),
    skip: int = Query(0, ge=0, description="Number of calls to skip"),
    db: Session = Depends(get_db)
):
    """
    List all calls with optional filtering
    
    - **gym_id**: Filter calls by gym
    - **status**: Filter by call status
    - **sentiment**: Filter by sentiment (positive, neutral, negative)
    - **pain_point**: Filter by specific pain point
    - **revenue_interest**: Filter by revenue interest (true/false)
    - **limit**: Max number of results (1-100)
    - **skip**: Pagination offset
    """
    call_service = CallService(db)
    try:
        calls = call_service.get_calls(
            gym_id=gym_id,
            status=status,
            sentiment=sentiment,
            pain_point=pain_point,
            revenue_interest=revenue_interest,
            limit=limit,
            skip=skip
        )
        return calls
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve calls: {str(e)}")


@router.get("/search")
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
    db: Session = Depends(get_db)
):
    """
    Get dashboard summary with sentiment distribution and insights
    
    - **gym_id**: Optional gym filter
    """
    insight_service = InsightService(db)
    try:
        summary = insight_service.get_dashboard_summary(gym_id=gym_id)
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
