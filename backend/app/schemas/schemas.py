from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


# Call Schemas

# Client -> API
class CallInitiate(BaseModel):
    """Request schema for initiating calls"""
    phone_numbers: List[str] = Field(..., min_items=1, description="List of phone numbers to call")


# API -> Client (part of CallInitiateResponse)
class CallResponse(BaseModel):
    """Response schema for single call"""
    phone_number: str
    call_id: str
    status: str


# API -> Client
class CallInitiateResponse(BaseModel):
    """Response schema for batch call initiation"""
    calls_initiated: List[CallResponse]
    total: int


# Service -> API -> Client
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

# External (Bland AI) -> API
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

# Inter-service (AI Service -> Insight Service)
class InsightData(BaseModel):
    """Extracted insights data"""
    main_topics: List[str] = Field(default_factory=list)
    sentiment: str = "neutral"
    pain_points: List[str] = Field(default_factory=list)
    opportunities: List[str] = Field(default_factory=list)
    capital_interest: bool = False
    revenue_interest_quote: Optional[str] = None
    confidence: float = 0.0


# Service -> API -> Client
class InsightResponse(BaseModel):
    """Insight response with call info"""
    call_id: str
    topics: List[str]
    sentiment: str
    pain_points: List[str]
    opportunities: List[str]
    revenue_interest: bool
    revenue_interest_quote: Optional[str] = None
    confidence: float
    extracted_at: datetime
    
    class Config:
        from_attributes = True


# Dashboard Schemas

# Service -> API -> Client (part of DashboardSummary)
class SentimentDistribution(BaseModel):
    """Sentiment distribution for dashboard"""
    positive: int = 0
    neutral: int = 0
    negative: int = 0


# Service -> API -> Client (part of DashboardSummary)
class PainPoint(BaseModel):
    """Pain point with count"""
    name: str
    count: int


# Service -> API -> Client (part of DashboardSummary)
class HighInterestQuote(BaseModel):
    """Quote from high-interest call"""
    quote: str
    sentiment: str
    phone_number: str
    call_id: str


# Service -> API -> Client
class DashboardSummary(BaseModel):
    """Dashboard summary response"""
    total_calls: int
    sentiment: SentimentDistribution
    top_pain_points: List[PainPoint] = Field(default_factory=list)
    high_interest_quotes: List[HighInterestQuote] = Field(default_factory=list)
    revenue_opportunities: int = 0


# Health Check

# API -> Client
class HealthCheck(BaseModel):
    """Health check response"""
    status: str
    environment: str
    database: str
    timestamp: datetime
