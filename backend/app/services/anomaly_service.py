"""
Anomaly Detection Service
Calculates anomaly scores using statistical methods (Z-score, IQR) for insights
"""
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func
import numpy as np

from app.models.models import Call, Insight
from app.services.rag_service import RAGContext


class AnomalyService:
    """Service for detecting and scoring anomalies in call insights"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_anomaly_score(
        self,
        extracted_insights: Dict[str, Any],
        rag_context: RAGContext,
        gym_id: str
    ) -> float:
        """
        Calculate anomaly score (0.0-1.0) based on statistical analysis
        
        Args:
            extracted_insights: Insights extracted from LLM
            rag_context: RAG context with similar calls and historical stats
            gym_id: Gym identifier
            
        Returns:
            Anomaly score normalized to 0.0-1.0
        """
        anomaly_factors = []
        
        # Factor 1: Rating anomaly (Z-score based)
        rating_anomaly = self._calculate_rating_anomaly(
            extracted_insights.get('gym_rating'),
            rag_context.historical_stats,
            rag_context.similar_calls
        )
        if rating_anomaly is not None:
            anomaly_factors.append(('rating', rating_anomaly, 0.2))
        
        # Factor 2: Sentiment-rating conflict
        sentiment_conflict = self._calculate_sentiment_conflict(
            extracted_insights.get('gym_rating'),
            extracted_insights.get('sentiment'),
            rag_context.similar_calls
        )
        if sentiment_conflict is not None:
            anomaly_factors.append(('sentiment_conflict', sentiment_conflict, 0.2))
        
        # Factor 3: Pattern deviation (against similar calls)
        pattern_deviation = self._calculate_pattern_deviation(
            extracted_insights,
            rag_context.similar_calls
        )
        if pattern_deviation is not None:
            anomaly_factors.append(('pattern_deviation', pattern_deviation, 0.1))
        
        # Factor 4: Confidence anomaly
        confidence_anomaly = self._calculate_confidence_anomaly(
            extracted_insights.get('confidence'),
            rag_context.historical_stats,
            rag_context.similar_calls
        )
        if confidence_anomaly is not None:
            anomaly_factors.append(('confidence', confidence_anomaly, 0.1))
        
        # Factor 5: Churn score anomaly (very high churn scores could be anomalous)
        churn_anomaly = self._calculate_churn_score_anomaly(
            extracted_insights.get('churn_score'),
            rag_context.historical_stats,
            rag_context.similar_calls
        )
        if churn_anomaly is not None:
            anomaly_factors.append(('churn_score', churn_anomaly, 0.2))
        
        # Factor 6: Revenue interest score anomaly (very high revenue scores could be anomalous)
        revenue_anomaly = self._calculate_revenue_score_anomaly(
            extracted_insights.get('revenue_interest_score'),
            rag_context.historical_stats,
            rag_context.similar_calls
        )
        if revenue_anomaly is not None:
            anomaly_factors.append(('revenue_score', revenue_anomaly, 0.2))
        
        # Weighted average of anomaly factors
        if not anomaly_factors:
            return 0.0  # No anomaly if no factors available
        
        total_weight = sum(weight for _, _, weight in anomaly_factors)
        weighted_sum = sum(score * weight for _, score, weight in anomaly_factors)
        
        anomaly_score = weighted_sum / total_weight if total_weight > 0 else 0.0
        
        # Normalize to 0.0-1.0 range (clamp)
        return max(0.0, min(1.0, anomaly_score))
    
    def _calculate_rating_anomaly(
        self,
        rating: Optional[int],
        historical_stats: Dict[str, Any],
        similar_calls: List[Dict]
    ) -> Optional[float]:
        """Calculate rating anomaly using Z-score method"""
        if rating is None:
            return None
        
        # Strategy: Use same dataset for both mean and std (statistically consistent)
        # Priority 1: Similar calls (more contextually relevant, but need enough samples)
        # Priority 2: Historical stats (larger sample, more stable baseline)
        # Never mix: avoid using mean from one dataset and std from another
        
        # Try similar calls first (most contextually relevant if we have enough)
        if similar_calls:
            similar_ratings = [c.get('rating') for c in similar_calls if c.get('rating') is not None and isinstance(c.get('rating'), (int, float))]
            if len(similar_ratings) >= 3:  # Need at least 3 for meaningful std
                try:
                    avg_similar = sum(similar_ratings) / len(similar_ratings)
                    std_similar = np.std(similar_ratings)
                    if std_similar > 0:
                        z_score = abs((rating - avg_similar) / std_similar)
                        # Slightly lower threshold for similar calls (1.35 vs 2.0) since smaller sample
                        anomaly = 1 / (1 + np.exp(-max(0, z_score - 1.35)))
                        return float(anomaly)
                except (ValueError, TypeError, ZeroDivisionError) as e:
                    print(f"⚠️ Error calculating rating anomaly with similar calls: {str(e)}")
        
        # Fallback: Use historical stats (larger sample, gym-wide baseline)
        avg_rating = historical_stats.get('avg_rating')
        std_rating = historical_stats.get('std_rating')
        if (avg_rating is not None and isinstance(avg_rating, (int, float)) and 
            std_rating is not None and isinstance(std_rating, (int, float)) and std_rating > 0):
            try:
                z_score = abs((rating - avg_rating) / std_rating)
                # Higher threshold (2.0) for historical stats since larger, more stable sample
                anomaly = 1 / (1 + np.exp(-max(0, z_score - 2.0)))
                return float(anomaly)
            except (ValueError, TypeError, ZeroDivisionError) as e:
                print(f"⚠️ Error calculating rating anomaly with historical stats: {str(e)}")
        
        return None
    
    def _calculate_sentiment_conflict(
        self,
        rating: Optional[int],
        sentiment: Optional[str],
        similar_calls: List[Dict]
    ) -> Optional[float]:
        """Calculate sentiment-rating conflict score"""
        if rating is None or sentiment is None:
            return None
        
        # Expected sentiment based on rating
        if rating >= 8:
            expected_sentiment = "positive"
        elif rating <= 4:
            expected_sentiment = "negative"
        else:
            expected_sentiment = "neutral"
        
        # Check if conflict exists
        if sentiment != expected_sentiment:
            # Check how unusual this is based on similar calls
            if similar_calls and len(similar_calls) > 0:
                conflicts_in_similar = sum(
                    1 for c in similar_calls
                    if (c.get('rating') is not None 
                        and isinstance(c.get('rating'), (int, float))
                        and c.get('sentiment') 
                        and isinstance(c.get('sentiment'), str)
                        and self._has_rating_sentiment_conflict(
                            c.get('rating'), c.get('sentiment')
                        ))
                )
                conflict_rate = conflicts_in_similar / len(similar_calls) if len(similar_calls) > 0 else 0.0
                
                # If this pattern is common in similar calls, lower anomaly
                # If this pattern is rare, higher anomaly
                if conflict_rate < 0.2:
                    # Rare conflict → high anomaly
                    return 0.7
                elif conflict_rate < 0.5:
                    # Moderate conflict → medium anomaly
                    return 0.4
                else:
                    # Common conflict → low anomaly
                    return 0.2
            else:
                # No similar calls for comparison → medium anomaly
                return 0.5
        
        return 0.0  # No conflict
    
    def _has_rating_sentiment_conflict(self, rating: int, sentiment: str) -> bool:
        """Check if rating and sentiment conflict"""
        if rating >= 8:
            return sentiment != "positive"
        elif rating <= 4:
            return sentiment != "negative"
        else:
            return sentiment not in ["neutral", "positive"]  # Neutral ratings can be positive
    
    def _calculate_pattern_deviation(
        self,
        extracted_insights: Dict[str, Any],
        similar_calls: List[Dict]
    ) -> Optional[float]:
        """
        Calculate deviation from similar calls pattern (sentiment and pain points).
        Only flags actual deviations - more targeted for anomaly detection.
        """
        if not similar_calls or len(similar_calls) < 2:
            return None
        
        deviations = []
        
        # Sentiment deviation: only if different from most common in similar calls
        extracted_sentiment = extracted_insights.get('sentiment')
        if extracted_sentiment and isinstance(extracted_sentiment, str):
            similar_sentiments = [
                c.get('sentiment') for c in similar_calls 
                if c.get('sentiment') and isinstance(c.get('sentiment'), str)
            ]
            if similar_sentiments:
                try:
                    most_common_sentiment = max(set(similar_sentiments), key=similar_sentiments.count)
                    if extracted_sentiment != most_common_sentiment:
                        # Calculate how unusual this sentiment is (rarity-based)
                        sentiment_frequency = similar_sentiments.count(extracted_sentiment) / len(similar_sentiments)
                        deviation = 1 - sentiment_frequency  # Higher if less common
                        deviations.append(deviation)
                except (ValueError, TypeError) as e:
                    print(f"⚠️ Error calculating sentiment deviation: {str(e)}")
        
        # Pain points deviation: proportion of unique/unusual pain points
        extracted_pain_points_list = extracted_insights.get('pain_points')
        if extracted_pain_points_list and isinstance(extracted_pain_points_list, list) and len(extracted_pain_points_list) > 0:
            try:
                extracted_pain_points = set([
                    str(p).lower().strip() for p in extracted_pain_points_list if p
                ])
                
                all_similar_pain_points = set()
                for c in similar_calls:
                    similar_pain_points = c.get('pain_points')
                    if similar_pain_points and isinstance(similar_pain_points, list):
                        all_similar_pain_points.update([
                            str(p).lower().strip() for p in similar_pain_points if p
                        ])
                
                if all_similar_pain_points and len(extracted_pain_points) > 0:
                    # Check how many pain points are new/unusual
                    new_pain_points = extracted_pain_points - all_similar_pain_points
                    deviation_rate = len(new_pain_points) / len(extracted_pain_points)
                    deviations.append(deviation_rate)
            except (AttributeError, TypeError) as e:
                print(f"⚠️ Error calculating pain points deviation: {str(e)}")
        
        # Opportunities deviation: proportion of unique/unusual opportunities
        extracted_opportunities_list = extracted_insights.get('opportunities')
        if extracted_opportunities_list and isinstance(extracted_opportunities_list, list) and len(extracted_opportunities_list) > 0:
            try:
                extracted_opportunities = set([
                    str(o).lower().strip() for o in extracted_opportunities_list if o
                ])
                
                all_similar_opportunities = set()
                for c in similar_calls:
                    similar_opportunities = c.get('opportunities')
                    if similar_opportunities and isinstance(similar_opportunities, list):
                        all_similar_opportunities.update([
                            str(o).lower().strip() for o in similar_opportunities if o
                        ])
                
                if all_similar_opportunities and len(extracted_opportunities) > 0:
                    # Check how many opportunities are new/unusual
                    new_opportunities = extracted_opportunities - all_similar_opportunities
                    deviation_rate = len(new_opportunities) / len(extracted_opportunities)
                    deviations.append(deviation_rate)
            except (AttributeError, TypeError) as e:
                print(f"⚠️ Error calculating opportunities deviation: {str(e)}")
        
        # Return average deviation (only if we have actual deviations)
        if deviations:
            return sum(deviations) / len(deviations)
        
        return None
    
    def _calculate_confidence_anomaly(
        self,
        confidence: Optional[float],
        historical_stats: Dict[str, Any],
        similar_calls: List[Dict]
    ) -> Optional[float]:
        """Calculate confidence anomaly using Z-score"""
        if confidence is None:
            return None
        
        # Use similar calls for comparison
        if similar_calls:
            similar_confidences = [c.get('confidence') for c in similar_calls if c.get('confidence') is not None and isinstance(c.get('confidence'), (int, float))]
            if len(similar_confidences) >= 2:
                try:
                    avg_confidence = sum(similar_confidences) / len(similar_confidences)
                    std_confidence = np.std(similar_confidences)
                    
                    if std_confidence > 0:
                        z_score = abs((confidence - avg_confidence) / std_confidence)
                        # Confidence anomaly: too high or too low is anomalous
                        # Normalize: Z-score > 1.35 is highly anomalous since smaller sample
                        anomaly = 1 / (1 + np.exp(-max(0, z_score - 1.35)))
                        return float(anomaly)
                except (ValueError, TypeError, ZeroDivisionError) as e:
                    print(f"⚠️ Error calculating confidence anomaly with similar calls: {str(e)}")
        
        # Fallback: compare with historical average
        avg_conf = historical_stats.get('avg_confidence')
        if avg_conf is not None and isinstance(avg_conf, (int, float)):
            try:
                deviation = abs(confidence - avg_conf)
                # If deviation > 0.4, consider anomalous
                if deviation > 0.4:
                    anomaly = min(1.0, deviation / 0.5)  # Normalize to 0-1
                    return anomaly
            except (ValueError, TypeError) as e:
                print(f"⚠️ Error calculating confidence anomaly with historical stats: {str(e)}")
        
        return None
    
    def _calculate_churn_score_anomaly(
        self,
        churn_score: Optional[float],
        historical_stats: Dict[str, Any],
        similar_calls: List[Dict]
    ) -> Optional[float]:
        """Calculate churn score anomaly using Z-score"""
        if churn_score is None:
            return None
        
        # Use similar calls for comparison
        if similar_calls:
            similar_churn_scores = [
                c.get('churn_score') for c in similar_calls 
                if c.get('churn_score') is not None and isinstance(c.get('churn_score'), (int, float))
            ]
            if len(similar_churn_scores) >= 3:
                try:
                    avg_churn = sum(similar_churn_scores) / len(similar_churn_scores)
                    std_churn = np.std(similar_churn_scores)
                    
                    if std_churn > 0:
                        z_score = abs((churn_score - avg_churn) / std_churn)
                        # Very high churn scores (>0.8) or very low (<0.2) are more anomalous
                        # Normalize using sigmoid with threshold 1.35
                        anomaly = 1 / (1 + np.exp(-max(0, z_score - 1.35)))
                        return float(anomaly)
                except (ValueError, TypeError, ZeroDivisionError) as e:
                    print(f"⚠️ Error calculating churn score anomaly with similar calls: {str(e)}")
        
        # Fallback: compare with historical average
        avg_churn = historical_stats.get('avg_churn_score')
        if avg_churn is not None and isinstance(avg_churn, (int, float)):
            try:
                deviation = abs(churn_score - avg_churn)
                # If deviation > 0.3, consider anomalous (churn scores are 0-1 range)
                if deviation > 0.4:
                    anomaly = min(1.0, deviation / 0.5)  # Normalize to 0-1
                    return anomaly
            except (ValueError, TypeError) as e:
                print(f"⚠️ Error calculating churn score anomaly with historical stats: {str(e)}")
        
        return None
    
    def _calculate_revenue_score_anomaly(
        self,
        revenue_score: Optional[float],
        historical_stats: Dict[str, Any],
        similar_calls: List[Dict]
    ) -> Optional[float]:
        """Calculate revenue interest score anomaly using Z-score"""
        if revenue_score is None:
            return None
        
        # Use similar calls for comparison
        if similar_calls:
            similar_revenue_scores = [
                c.get('revenue_interest_score') for c in similar_calls 
                if c.get('revenue_interest_score') is not None and isinstance(c.get('revenue_interest_score'), (int, float))
            ]
            if len(similar_revenue_scores) >= 3:
                try:
                    avg_revenue = sum(similar_revenue_scores) / len(similar_revenue_scores)
                    std_revenue = np.std(similar_revenue_scores)
                    
                    if std_revenue > 0:
                        z_score = abs((revenue_score - avg_revenue) / std_revenue)
                        # Very high revenue scores (>0.8) or very low (<0.2) are more anomalous
                        # Normalize using sigmoid with threshold 1.35
                        anomaly = 1 / (1 + np.exp(-max(0, z_score - 1.35)))
                        return float(anomaly)
                except (ValueError, TypeError, ZeroDivisionError) as e:
                    print(f"⚠️ Error calculating revenue score anomaly with similar calls: {str(e)}")
        
        # Fallback: compare with historical average
        avg_revenue = historical_stats.get('avg_revenue_interest_score')
        if avg_revenue is not None and isinstance(avg_revenue, (int, float)):
            try:
                deviation = abs(revenue_score - avg_revenue)
                # If deviation > 0.3, consider anomalous (revenue scores are 0-1 range)
                if deviation > 0.4:
                    anomaly = min(1.0, deviation / 0.5)  # Normalize to 0-1
                    return anomaly
            except (ValueError, TypeError) as e:
                print(f"⚠️ Error calculating revenue score anomaly with historical stats: {str(e)}")
        
        return None

