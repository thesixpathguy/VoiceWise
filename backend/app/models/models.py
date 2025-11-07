from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, Boolean, Float, ForeignKey, ARRAY, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from app.core.database import Base
from sqlalchemy import Enum as SAEnum
import enum


class Call(Base):
    """Call model representing a phone call to a gym member"""
    
    __tablename__ = "calls"
    
    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(String(255), unique=True, nullable=False, index=True)
    phone_number = Column(String(20), nullable=False, index=True)
    raw_transcript = Column(Text, nullable=True)
    transcript_embedding = Column(Vector(384), nullable=True)  # all-MiniLM-L6-v2 dimension
    duration_seconds = Column(Integer, nullable=True)
    status = Column(String(50), nullable=True)  # initiated, completed, failed, etc.
    gym_id = Column(String(255), nullable=False, index=True)
    custom_instructions = Column(ARRAY(Text), nullable=True)  # Custom instructions provided for this call
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    class AnsweredByEnum(str, enum.Enum):
        human = "human"
        voicemail = "voicemail"
        unknown = "unknown"
        no_answer = "no-answer"

    # Stored as a string in the DB (native_enum=False) to avoid DB-level enum migrations.
    answered_by = Column(SAEnum(AnsweredByEnum, name="answered_by_enum", native_enum=False), nullable=True, index=True)
    api_key_index = Column(Integer, nullable=False, default=0)  # Which API key was used (0 or 1) for round-robin
    
    # Relationship to insights
    insights = relationship("Insight", back_populates="call", cascade="all, delete-orphan")
    
    # Composite indexes for common query patterns
    __table_args__ = (
        # Index for date filtering with gym_id (common in chart queries)
        Index('idx_calls_gym_id_created_at', 'gym_id', 'created_at'),
        # Index for status filtering
        Index('idx_calls_status', 'status'),
    )
    
    def __repr__(self):
        return f"<Call(call_id={self.call_id}, phone_number={self.phone_number}, status={self.status})>"


class Insight(Base):
    """Insight model representing AI-extracted insights from a call"""
    
    __tablename__ = "insights"
    
    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(String(255), ForeignKey("calls.call_id"), nullable=False, unique=True)
    topics = Column(ARRAY(Text), nullable=True)  # Main topics discussed
    sentiment = Column(String(20), nullable=True, index=True)  # positive, neutral, negative
    pain_points = Column(ARRAY(Text), nullable=True)  # Customer complaints/issues (for churn segment)
    opportunities = Column(ARRAY(Text), nullable=True)  # Upsell opportunities (for revenue segment)
    churn_score = Column(Float, nullable=True, index=True)  # Churn risk score 0.0-1.0 (1 decimal place)
    churn_interest_quote = Column(Text, nullable=True)  # Exact quote showing churn interest
    revenue_interest_score = Column(Float, nullable=True, index=True)  # Revenue interest score 0.0-1.0 (1 decimal place)
    revenue_interest_quote = Column(Text, nullable=True)  # Exact quote showing revenue interest
    gym_rating = Column(Integer, nullable=True, index=True)  # Gym rating 1-10 from member
    confidence = Column(Float, nullable=True, index=True)  # AI confidence score (0.0-1.0) - CRITICAL for filtering
    anomaly_score = Column(Float, nullable=True, index=True)  # Anomaly score 0.0-1.0 (statistical analysis)
    custom_instruction_answers = Column(JSON, nullable=True)  # Map of custom instruction -> extracted answer
    extracted_at = Column(TIMESTAMP, server_default=func.now(), index=True)
    
    # Relationship to call
    call = relationship("Call", back_populates="insights")
    
    # Composite indexes for optimized queries
    __table_args__ = (
        # Index for joins + churn score ordering (common in chart queries)
        Index('idx_insights_call_id_churn_score', 'call_id', 'churn_score'),
        # Index for joins + revenue score ordering
        Index('idx_insights_call_id_revenue_score', 'call_id', 'revenue_interest_score'),
        # Index for confidence filtering + churn score ordering
        Index('idx_insights_confidence_churn_score', 'confidence', 'churn_score'),
        # Index for confidence filtering + revenue score ordering
        Index('idx_insights_confidence_revenue_score', 'confidence', 'revenue_interest_score'),
        # Index for date-based trend queries with confidence
        Index('idx_insights_extracted_at_confidence', 'extracted_at', 'confidence'),
    )
    
    def __repr__(self):
        return f"<Insight(call_id={self.call_id}, sentiment={self.sentiment}, confidence={self.confidence})>"

