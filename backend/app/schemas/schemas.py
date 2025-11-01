from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


# Call Schemas
class CallInitiate(BaseModel):
    """Request schema for initiating calls"""
    phone_numbers: List[str] = Field(..., min_items=1, description="List of phone numbers to call")


class CallResponse(BaseModel):
    """Response schema for single call"""
    phone_number: str
    call_id: str
    status: str


class CallInitiateResponse(BaseModel):
    """Response schema for batch call initiation"""
    calls_initiated: List[CallResponse]
    total: int


class CallDetail(BaseModel):
    """Detailed call information"""
    call_id: str
    phone_number: str
    status: str
    duration_seconds: Optional[int] = None
    created_at: datetime
    raw_transcript: Optional[str] = None
    
    class Config:
        from_attributes = True


# Webhook Schemas
class WebhookPayload(BaseModel):
    """Bland AI webhook payload - flexible to handle various payload structures"""
    call_id: Optional[str] = Field(None, description="Unique call identifier from Bland AI")
    to: Optional[str] = Field(None, description="Phone number called (with country code)")
    call_length: Optional[float] = Field(None, description="Call duration in minutes")
    status: Optional[str] = Field(None, description="Call status (completed, failed, etc)")
    concatenated_transcript: Optional[str] = Field(None, description="Full transcript as a single string")
    
    class Config:
        extra = "ignore"  # Allow extra fields from Bland AI


# Insight Schemas
class InsightData(BaseModel):
    """Extracted insights data"""
    main_topics: List[str] = Field(default_factory=list)
    sentiment: str = "neutral"
    pain_points: List[str] = Field(default_factory=list)
    opportunities: List[str] = Field(default_factory=list)
    capital_interest: bool = False
    confidence: float = 0.0


class InsightResponse(BaseModel):
    """Insight response with call info"""
    call_id: str
    topics: List[str]
    sentiment: str
    pain_points: List[str]
    opportunities: List[str]
    revenue_interest: bool
    confidence: float
    extracted_at: datetime
    
    class Config:
        from_attributes = True


# Dashboard Schemas
class SentimentDistribution(BaseModel):
    """Sentiment distribution for dashboard"""
    positive: int = 0
    neutral: int = 0
    negative: int = 0


class PainPoint(BaseModel):
    """Pain point with count"""
    name: str
    count: int


class HighInterestQuote(BaseModel):
    """Quote from high-interest call"""
    quote: str
    sentiment: str
    phone_number: str


class DashboardSummary(BaseModel):
    """Dashboard summary response"""
    total_calls: int
    sentiment: SentimentDistribution
    top_pain_points: List[PainPoint] = Field(default_factory=list)
    high_interest_quotes: List[HighInterestQuote] = Field(default_factory=list)
    revenue_opportunities: int = 0


# Health Check
class HealthCheck(BaseModel):
    """Health check response"""
    status: str
    environment: str
    database: str
    timestamp: datetime
