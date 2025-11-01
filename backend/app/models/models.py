from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, Boolean, Float, ForeignKey, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from app.core.database import Base


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
    created_at = Column(TIMESTAMP, server_default=func.now(), index=True)
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now())
    
    # Relationship to insights
    insights = relationship("Insight", back_populates="call", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Call(call_id={self.call_id}, phone_number={self.phone_number}, status={self.status})>"


class Insight(Base):
    """Insight model representing AI-extracted insights from a call"""
    
    __tablename__ = "insights"
    
    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(String(255), ForeignKey("calls.call_id"), nullable=False, unique=True)
    topics = Column(ARRAY(Text), nullable=True)  # Main topics discussed
    sentiment = Column(String(20), nullable=True, index=True)  # positive, neutral, negative
    pain_points = Column(ARRAY(Text), nullable=True)  # Customer complaints/issues
    opportunities = Column(ARRAY(Text), nullable=True)  # Upsell opportunities
    revenue_interest = Column(Boolean, nullable=True, index=True)  # Interest in premium services
    revenue_interest_quote = Column(Text, nullable=True)  # Exact quote showing revenue interest
    confidence = Column(Float, nullable=True)  # AI confidence score (0.0-1.0)
    extracted_at = Column(TIMESTAMP, server_default=func.now(), index=True)
    
    # Relationship to call
    call = relationship("Call", back_populates="insights")
    
    def __repr__(self):
        return f"<Insight(call_id={self.call_id}, sentiment={self.sentiment}, confidence={self.confidence})>"

