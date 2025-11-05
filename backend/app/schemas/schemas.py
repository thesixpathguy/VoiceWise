from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


# Call Schemas

# Client -> API
class CallInitiate(BaseModel):
    """Request schema for initiating calls"""
    phone_numbers: List[str] = Field(..., min_items=1, description="List of phone numbers to call")
    custom_instructions: Optional[List[str]] = Field(None, description="Optional custom instruction points to include in the call script")


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
    custom_instructions: Optional[List[str]] = None  # Custom instructions for this call
    
    class Config:
        from_attributes = True


# Paginated response for calls
class PaginatedCallsResponse(BaseModel):
    """Paginated calls response with total count"""
    calls: List[CallDetail]
    total: int
    limit: int
    skip: int


# Time-series data point
class TimeSeriesDataPoint(BaseModel):
    """Single data point in time series"""
    date: str  # ISO format date string
    value: Optional[float] = None  # Score or count value
    call_id: Optional[str] = None  # Call ID for click handling
    count: Optional[int] = None  # Number of calls for this date
    positive: Optional[int] = None  # For sentiment data
    neutral: Optional[int] = None  # For sentiment data
    negative: Optional[int] = None  # For sentiment data
    total: Optional[int] = None  # For sentiment data


# Time-series response
class TimeSeriesResponse(BaseModel):
    """Time-series data for charts"""
    data: List[TimeSeriesDataPoint]
    period: str  # "day", "week", "month"
    start_date: str
    end_date: str


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
    gym_rating: Optional[int] = Field(None, ge=1, le=10, description="Gym rating 1-10 if mentioned")
    pain_points: List[str] = Field(default_factory=list)  # For churn segment
    opportunities: List[str] = Field(default_factory=list)  # For revenue segment
    churn_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Churn risk score 0.0-1.0 (1 decimal)")
    churn_interest_quote: Optional[str] = None  # Exact quote showing churn interest
    revenue_interest_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Revenue interest score 0.0-1.0 (1 decimal)")
    revenue_interest_quote: Optional[str] = None  # Exact quote showing revenue interest
    confidence: float = 0.0
    custom_instruction_answers: Optional[Dict[str, Any]] = None  # Map of instruction -> {type: "question"/"instruction", answer: str (for questions), followed: bool, summary: str (for instructions)}


# Service -> API -> Client
class InsightResponse(BaseModel):
    """Insight response with call info"""
    call_id: str
    topics: List[str]
    sentiment: str
    gym_rating: Optional[int] = Field(None, ge=1, le=10, description="Gym rating 1-10 if mentioned")
    pain_points: List[str]  # For churn segment
    opportunities: List[str]  # For revenue segment
    churn_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Churn risk score 0.0-1.0 (1 decimal)")
    churn_interest_quote: Optional[str] = None  # Exact quote showing churn interest
    revenue_interest_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Revenue interest score 0.0-1.0 (1 decimal)")
    revenue_interest_quote: Optional[str] = None  # Exact quote showing revenue interest
    confidence: float
    anomaly_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Statistical anomaly score 0.0-1.0")
    custom_instruction_answers: Optional[Dict[str, Any]] = None  # Map of instruction -> {type: "question"/"instruction", answer: str (for questions), followed: bool, summary: str (for instructions)}
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
    """Quote from high revenue interest call"""
    quote: str
    sentiment: str
    phone_number: str
    call_id: str


# Service -> API -> Client (part of DashboardSummary)
class ChurnInterestQuote(BaseModel):
    """Quote from high churn risk call"""
    quote: str
    sentiment: str
    phone_number: str
    call_id: str


# Service -> API -> Client (part of DashboardSummary)
class GenericSection(BaseModel):
    """Generic section for all calls"""
    total_calls: int
    positive_sentiment: int
    negative_sentiment: int
    average_confidence: Optional[float] = None
    total_duration_seconds: Optional[int] = None
    average_duration_seconds: Optional[float] = None
    call_pickup_rate: Optional[float] = None  # Percentage of completed calls (completed / total)
    block_1: Optional[float] = None  # Placeholder metric 1
    block_2: Optional[float] = None  # Placeholder metric 2
    top_pain_points: List[PainPoint] = Field(default_factory=list)  # Top pain points from all calls
    top_opportunities: List[PainPoint] = Field(default_factory=list)  # Top opportunities from all calls (using PainPoint schema for consistency)


# Service -> API -> Client (part of DashboardSummary)
class ChurnInterestSection(BaseModel):
    """Churn interest section - calls with churn_score > threshold"""
    total_calls: int  # Count of calls with churn_score > threshold
    average_gym_rating: Optional[float] = None  # Average gym rating for churn calls
    top_pain_points: List[PainPoint] = Field(default_factory=list)  # Top 5 pain points from churn calls
    top_churn_quotes: List[ChurnInterestQuote] = Field(default_factory=list)  # Top 5 churn interest quotes (highest scores)
    churn_threshold: float = 0.75  # Threshold used for filtering (for frontend reference)


# Service -> API -> Client (part of DashboardSummary)
class RevenueInterestSection(BaseModel):
    """Revenue interest section - calls with revenue_interest_score > threshold"""
    total_calls: int  # Count of calls with revenue_interest_score > threshold
    average_gym_rating: Optional[float] = None  # Average gym rating for revenue calls
    top_opportunities: List[PainPoint] = Field(default_factory=list)  # Top 5 opportunities from revenue calls
    top_revenue_quotes: List[HighInterestQuote] = Field(default_factory=list)  # Top 5 revenue interest quotes (highest scores)
    revenue_threshold: float = 0.75  # Threshold used for filtering (for frontend reference)


# Service -> API -> Client
class DashboardSummary(BaseModel):
    """Dashboard summary response with three distinct sections"""
    generic: GenericSection
    churn_interest: ChurnInterestSection
    revenue_interest: RevenueInterestSection


# Health Check

# API -> Client
class HealthCheck(BaseModel):
    """Health check response"""
    status: str
    environment: str
    database: str
    timestamp: datetime


# Search Schemas

# Service -> API -> Client (part of SearchResponse)
class SearchSentimentDistribution(BaseModel):
    """Sentiment distribution in search results"""
    positive: int = 0
    neutral: int = 0
    negative: int = 0


# Service -> API -> Client (part of SearchResponse)
class SearchTopic(BaseModel):
    """Topic with count in search results"""
    name: str
    count: int


# Service -> API -> Client (part of SearchResponse)
class SearchPainPoint(BaseModel):
    """Pain point with count in search results"""
    name: str
    count: int


# Service -> API -> Client (part of SearchResponse)
class SearchAggregatedInsights(BaseModel):
    """Aggregated insights from search results"""
    total_calls: int
    sentiment_distribution: SearchSentimentDistribution
    top_topics: List[SearchTopic] = Field(default_factory=list)
    top_pain_points: List[SearchPainPoint] = Field(default_factory=list)
    churn_interest_count: int = 0  # Count of calls with churn_score > 0.75
    revenue_interest_count: int = 0  # Count of calls with revenue_interest_score > 0.75
    average_confidence: float = 0.0
    total_duration_seconds: int = 0


# Service -> API -> Client (part of SearchResponse)
class SearchCallInsights(BaseModel):
    """Insights for a call in search results"""
    sentiment: Optional[str] = None
    topics: List[str] = Field(default_factory=list)
    gym_rating: Optional[int] = None
    pain_points: List[str] = Field(default_factory=list)  # For churn segment
    opportunities: List[str] = Field(default_factory=list)  # For revenue segment
    churn_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Churn risk score 0.0-1.0 (1 decimal)")
    churn_interest_quote: Optional[str] = None  # Exact quote showing churn interest
    revenue_interest_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Revenue interest score 0.0-1.0 (1 decimal)")
    revenue_interest_quote: Optional[str] = None  # Exact quote showing revenue interest
    confidence: float = 0.0
    anomaly_score: Optional[float] = Field(None, ge=0.0, le=1.0, description="Statistical anomaly score 0.0-1.0")
    extracted_at: Optional[str] = None  # ISO format string


# Service -> API -> Client (part of SearchResponse)
class SearchCallResult(BaseModel):
    """Call result in search response"""
    call_id: str
    phone_number: str
    status: str
    created_at: str  # ISO format string
    duration_seconds: Optional[int] = None
    raw_transcript: Optional[str] = None
    gym_id: Optional[str] = None
    insights: Optional[SearchCallInsights] = None


# Service -> API -> Client
class SearchResponse(BaseModel):
    """Search response with aggregated insights and call results"""
    query: str
    search_type: str
    total_results: int
    aggregated_insights: SearchAggregatedInsights
    calls: List[SearchCallResult] = Field(default_factory=list)
