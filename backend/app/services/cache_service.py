"""
Cache service for caching expensive database queries
Uses cachetools for free, lightweight in-memory caching with TTL support
"""
from typing import Optional, Any, Dict, List
from datetime import datetime, timedelta
from cachetools import TTLCache
import json
import hashlib
from app.schemas.schemas import LiveCall


class CacheService:
    """Service for caching dashboard and trend data"""
    
    # Shared cache instances for different data types
    # Reduced TTLs for faster updates while still providing caching benefits
    _trend_cache: TTLCache = TTLCache(maxsize=1000, ttl=300)  # 5 min TTL - shorter for fresher data
    _dashboard_cache: TTLCache = TTLCache(maxsize=100, ttl=180)  # 3 min TTL
    _bulk_insights_cache: TTLCache = TTLCache(maxsize=500, ttl=600)  # 10 min TTL for bulk insights
    _chart_calls_cache: TTLCache = TTLCache(maxsize=200, ttl=300)  # 5 min TTL for chart-related calls list
    
    @staticmethod
    def _generate_cache_key(
        cache_type: str,
        gym_id: Optional[str] = None,
        days: Optional[int] = None,
        period: Optional[str] = None,
        threshold: Optional[float] = None,
        **kwargs
    ) -> str:
        """Generate a unique cache key from parameters"""
        key_parts = [cache_type]
        if gym_id:
            key_parts.append(f"gym:{gym_id}")
        if days is not None:
            key_parts.append(f"days:{days}")
        if period:
            key_parts.append(f"period:{period}")
        if threshold is not None:
            key_parts.append(f"threshold:{threshold}")
        
        # Add any additional kwargs
        for k, v in sorted(kwargs.items()):
            if v is not None:
                key_parts.append(f"{k}:{v}")
        
        key_string = "|".join(key_parts)
        # Hash for shorter keys if needed
        return hashlib.md5(key_string.encode()).hexdigest()
    
    @staticmethod
    def _get_yesterday_end() -> datetime:
        """Get end of yesterday (for caching historical data)"""
        today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        return today - timedelta(seconds=1)
    
    @staticmethod
    def get_trend_data(
        cache_type: str,  # 'churn', 'revenue', 'sentiment'
        fetch_func,
        gym_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        period: str = "day",
        **kwargs
    ) -> List[Dict]:
        """
        Get trend data with caching strategy using date ranges:
        - Cache data up to end of yesterday
        - Fetch today's data fresh from DB
        - Merge cached historical data with fresh today's data
        
        Args:
            cache_type: Type of trend ('churn', 'revenue', 'sentiment')
            fetch_func: Function to fetch data from DB (should accept start_date, end_date, gym_id, period, etc.)
            gym_id: Optional gym ID filter
            start_date: Start date for data range
            end_date: End date for data range
            period: Period type ('day', 'week', 'month' - for future support)
            **kwargs: Additional parameters to pass to fetch_func
        
        Returns:
            List of trend data points
        """
        # Convert datetime to string for cache key generation
        start_str = start_date.isoformat() if start_date else None
        end_str = end_date.isoformat() if end_date else None
        
        cache_key = CacheService._generate_cache_key(
            f"trend:{cache_type}",
            gym_id=gym_id,
            start_date=start_str,
            end_date=end_str,
            period=period,
            **kwargs
        )
        
        # Try to get cached data
        cached_data = CacheService._trend_cache.get(cache_key)
        
        if cached_data is not None:
            # Cache hit - return cached data
            return cached_data
        
        # Cache miss - fetch from database
        # For now, fetch all data (we'll optimize to fetch only today later)
        data = fetch_func(gym_id=gym_id, start_date=start_date, end_date=end_date, period=period, **kwargs)
        
        # Cache the data
        CacheService._trend_cache[cache_key] = data
        
        return data
    
    @staticmethod
    def get_trend_data_smart(
        cache_type: str,
        fetch_func,
        gym_id: Optional[str] = None,
        days: int = 30,
        period: str = "day",
        **kwargs
    ) -> List[Dict]:
        """
        Smart caching: Cache data up to yesterday, fetch today fresh
        
        Strategy:
        1. Check cache for historical data (up to yesterday)
        2. Fetch today's data from DB
        3. Merge and return
        
        Args:
            cache_type: Type of trend ('churn', 'revenue', 'sentiment')
            fetch_func: Function to fetch data from DB (should accept start_date, end_date as datetime)
            gym_id: Optional gym ID filter
            days: Number of days to fetch
            period: Period type ('day', 'week', 'month')
            **kwargs: Additional parameters
        
        Returns:
            List of trend data points
        """
        today = datetime.utcnow()
        today_start = today.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_end = today_start - timedelta(seconds=1)
        
        # Cache key for historical data (up to yesterday)
        historical_key = CacheService._generate_cache_key(
            f"trend:{cache_type}:historical",
            gym_id=gym_id,
            days=days,
            period=period,
            **kwargs
        )
        
        # Get cached historical data
        cached_historical = CacheService._trend_cache.get(historical_key)
        
        # Fetch today's data fresh from DB
        today_data = fetch_func(
            gym_id=gym_id,
            days=1,
            period=period,
            start_date=today_start,
            end_date=today,
            **kwargs
        )
        
        if cached_historical is not None:
            # Merge cached historical with fresh today's data
            # Remove today from cached data if it exists (to avoid duplicates)
            today_str = today.date().isoformat()
            filtered_historical = [
                item for item in cached_historical 
                if item.get('date') != today_str
            ]
            return filtered_historical + today_data
        else:
            # No cache - fetch all data
            all_data = fetch_func(gym_id=gym_id, days=days, period=period, **kwargs)
            
            # Separate historical (up to yesterday) and today
            today_str = today.date().isoformat()
            historical_data = [item for item in all_data if item.get('date') != today_str]
            today_only = [item for item in all_data if item.get('date') == today_str]
            
            # Cache historical data (up to yesterday)
            CacheService._trend_cache[historical_key] = historical_data
            
            return all_data
    
    @staticmethod
    def get_dashboard_summary(
        fetch_func,
        gym_id: Optional[str] = None,
        churn_threshold: float = 0.8,
        revenue_threshold: float = 0.8,
        **kwargs
    ) -> Dict:
        """
        Get dashboard summary with caching
        
        Args:
            fetch_func: Function to fetch dashboard summary from DB
            gym_id: Optional gym ID filter
            churn_threshold: Churn threshold
            revenue_threshold: Revenue threshold
            **kwargs: Additional parameters
        
        Returns:
            Dashboard summary dictionary
        """
        cache_key = CacheService._generate_cache_key(
            "dashboard:summary",
            gym_id=gym_id,
            threshold=churn_threshold,
            revenue_threshold=revenue_threshold,
            **kwargs
        )
        
        # Try cache
        cached = CacheService._dashboard_cache.get(cache_key)
        if cached is not None:
            return cached
        
        # Fetch from DB
        data = fetch_func(
            gym_id=gym_id,
            churn_threshold=churn_threshold,
            revenue_threshold=revenue_threshold,
            **kwargs
        )
        
        # Cache it
        CacheService._dashboard_cache[cache_key] = data
        
        return data
    
    @staticmethod
    def invalidate_trend_cache(
        cache_type: Optional[str] = None,
        gym_id: Optional[str] = None
    ):
        """
        Invalidate trend cache entries
        
        Args:
            cache_type: Specific cache type to invalidate ('churn', 'revenue', 'sentiment')
                       If None, invalidates all trend caches
            gym_id: Specific gym ID to invalidate. If None, invalidates all gyms
        """
        keys_to_remove = []
        
        for key in CacheService._trend_cache.keys():
            key_str = str(key)
            should_invalidate = False
            
            if cache_type is None:
                should_invalidate = True
            elif cache_type in key_str:
                should_invalidate = True
            
            if gym_id and f"gym:{gym_id}" not in key_str:
                should_invalidate = False
            
            if should_invalidate:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            CacheService._trend_cache.pop(key, None)
    
    @staticmethod
    def invalidate_dashboard_cache(gym_id: Optional[str] = None):
        """
        Invalidate dashboard cache entries
        
        Args:
            gym_id: Specific gym ID to invalidate. If None, invalidates all
        """
        keys_to_remove = []
        
        for key in CacheService._dashboard_cache.keys():
            key_str = str(key)
            should_invalidate = True
            
            if gym_id and f"gym:{gym_id}" not in key_str:
                should_invalidate = False
            
            if should_invalidate:
                keys_to_remove.append(key)
        
        for key in keys_to_remove:
            CacheService._dashboard_cache.pop(key, None)
    
    @staticmethod
    def get_bulk_insights(
        call_ids: List[str],
        fetch_func
    ) -> Dict:
        """
        Get bulk insights with caching
        
        Args:
            call_ids: List of call IDs to fetch insights for
            fetch_func: Function to fetch insights from DB
        
        Returns:
            Dictionary mapping call_id to insights
        """
        # Sort call_ids to ensure consistent cache key
        sorted_ids = sorted(call_ids)
        cache_key = hashlib.md5(
            f"bulk_insights:{','.join(sorted_ids)}".encode()
        ).hexdigest()
        
        # Try cache
        cached = CacheService._bulk_insights_cache.get(cache_key)
        if cached is not None:
            return cached
        
        # Fetch from DB
        data = fetch_func(call_ids)
        
        # Cache it
        CacheService._bulk_insights_cache[cache_key] = data
        
        return data
    
    @staticmethod
    def get_chart_calls(
        fetch_func,
        gym_id: Optional[str] = None,
        status: Optional[str] = None,
        sentiment: Optional[str] = None,
        pain_point: Optional[str] = None,
        opportunity: Optional[str] = None,
        revenue_interest: Optional[bool] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        churn_min_score: Optional[float] = None,
        revenue_min_score: Optional[float] = None,
        order_by: Optional[str] = None,
        fields: Optional[List[str]] = None,
        limit: int = 100,
        **kwargs
    ):
        """
        Get calls list for charts with caching (only for chart-related queries)
        
        This is specifically for scatter plot data fetching, not general pagination.
        Only caches queries with date filters and score filters (chart-specific).
        Can return either a dict with {"calls": [...], "total": count} or just a list of calls.
        
        Args:
            fetch_func: Function to fetch calls from DB (can return dict or list)
            gym_id: Optional gym ID filter
            start_date: Start date filter (ISO format)
            end_date: End date filter (ISO format)
            churn_min_score: Minimum churn score filter
            revenue_min_score: Minimum revenue score filter
            order_by: Order by parameter
            fields: List of fields to return (field projection)
            limit: Limit (should be <= 200 for chart queries)
            **kwargs: Additional parameters
        
        Returns:
            Either dict with {"calls": [...], "total": count} or list of calls (matches fetch_func return type)
        """
        # Only cache if it's a chart-related query (has date filters and reasonable limit)
        is_chart_query = (
            start_date is not None and 
            end_date is not None and 
            limit <= 200  # Only cache reasonable limits for charts
        )
        
        if not is_chart_query:
            # Not a chart query, fetch directly without caching
            return fetch_func(
                gym_id=gym_id,
                status=status,
                sentiment=sentiment,
                pain_point=pain_point,
                opportunity=opportunity,
                revenue_interest=revenue_interest,
                start_date=start_date,
                end_date=end_date,
                churn_min_score=churn_min_score,
                revenue_min_score=revenue_min_score,
                order_by=order_by,
                fields=fields,
                limit=limit,
                **kwargs
            )
        
        # Generate cache key for chart queries
        # Convert fields list to string for cache key generation
        fields_str = ','.join(sorted(fields)) if fields else None
        
        cache_key = CacheService._generate_cache_key(
            "chart:calls",
            gym_id=gym_id,
            status=status,
            sentiment=sentiment,
            pain_point=pain_point,
            opportunity=opportunity,
            revenue_interest=revenue_interest,
            start_date=start_date,
            end_date=end_date,
            churn_min_score=churn_min_score,
            revenue_min_score=revenue_min_score,
            order_by=order_by,
            fields=fields_str,
            limit=limit,
            **kwargs
        )
        
        # Try cache
        cached = CacheService._chart_calls_cache.get(cache_key)
        if cached is not None:
            return cached
        
        # Fetch from DB
        data = fetch_func(
            gym_id=gym_id,
            status=status,
            sentiment=sentiment,
            pain_point=pain_point,
            opportunity=opportunity,
            revenue_interest=revenue_interest,
            start_date=start_date,
            end_date=end_date,
            churn_min_score=churn_min_score,
            revenue_min_score=revenue_min_score,
            order_by=order_by,
            fields=fields,
            limit=limit,
            **kwargs
        )
        
        # Cache it
        CacheService._chart_calls_cache[cache_key] = data
        
        return data
    
    @staticmethod
    def invalidate_bulk_insights_cache(call_ids: Optional[List[str]] = None):
        """
        Invalidate bulk insights cache
        
        Args:
            call_ids: Specific call IDs to invalidate. If None, invalidates all
        """
        if call_ids is None:
            CacheService._bulk_insights_cache.clear()
        else:
            # Invalidate specific cache entries
            sorted_ids = sorted(call_ids)
            cache_key = hashlib.md5(
                f"bulk_insights:{','.join(sorted_ids)}".encode()
            ).hexdigest()
            CacheService._bulk_insights_cache.pop(cache_key, None)
    
    @staticmethod
    def invalidate_chart_calls_cache(gym_id: Optional[str] = None):
        """
        Invalidate chart calls cache
        
        Args:
            gym_id: Specific gym ID to invalidate. If None, invalidates all
        """
        if gym_id is None:
            CacheService._chart_calls_cache.clear()
        else:
            # Remove all entries for this gym_id
            keys_to_remove = []
            for key in CacheService._chart_calls_cache.keys():
                key_str = str(key)
                if f"gym:{gym_id}" in key_str:
                    keys_to_remove.append(key)
            
            for key in keys_to_remove:
                CacheService._chart_calls_cache.pop(key, None)
    
    @staticmethod
    def clear_all():
        """Clear all caches (useful for testing or manual refresh)"""
        CacheService._trend_cache.clear()
        CacheService._dashboard_cache.clear()
        CacheService._bulk_insights_cache.clear()
        CacheService._chart_calls_cache.clear()
        CacheService._live_call_cache.clear()
    
    # Live call cache (separate from other caches for faster access)
    _live_call_cache: TTLCache = TTLCache(maxsize=1000, ttl=3600)  # 1 hour TTL for live calls
    
    @staticmethod
    def get_live_call(call_id: str) -> Optional[LiveCall]:
        """
        Get live call data from cache
        
        Args:
            call_id: Call identifier
            
        Returns:
            LiveCall Pydantic model or None
        """
        return CacheService._live_call_cache.get(f"live_call_{call_id}")
    
    @staticmethod
    def set_live_call(call_id: str, live_call: LiveCall) -> None:
        """
        Store live call data in cache
        
        Args:
            call_id: Call identifier
            live_call: LiveCall Pydantic model
        """
        CacheService._live_call_cache[f"live_call_{call_id}"] = live_call
    
    @staticmethod
    def get_all_live_calls() -> List[LiveCall]:
        """
        Get all live calls from cache efficiently.
        Returns all entries with prefix "live_call_"
        
        Optimized for low latency - direct in-memory cache access with minimal overhead.
        No database queries, no external calls - pure in-memory operation.
        
        Returns:
            List of LiveCall Pydantic models
        """
        prefix = "live_call_"
        live_calls = []
        
        # Direct iteration through cache keys - very fast for in-memory cache
        for key in CacheService._live_call_cache.keys():
            if isinstance(key, str) and key.startswith(prefix):
                live_call = CacheService._live_call_cache.get(key)
                if live_call is not None:
                    live_calls.append(live_call)
        
        return live_calls

    @staticmethod
    def invalidate_live_call_cache(call_id: str) -> None:
        """
        Invalidate live call cache
        
        Args:
            call_id: Call identifier
        """
        CacheService._live_call_cache.pop(f"live_call_{call_id}", None)