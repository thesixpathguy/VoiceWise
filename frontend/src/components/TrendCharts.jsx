import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LineChart, Line, AreaChart, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Scatter } from 'recharts';
import { callsAPI } from '../api/api';

export default function TrendCharts({ type, gymId, days, onPointClick, threshold = 0.8 }) {
  const [data, setData] = useState([]);
  const [scatterData, setScatterData] = useState([]); // Individual points above threshold
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadingScatterRef = useRef(false);
  const scatterCacheRef = useRef(null); // Cache scatter data by key

  const loadScatterData = useCallback(async (chartType, trendData = []) => {
    // Skip if not churn or revenue
    if (chartType !== 'churn' && chartType !== 'revenue') {
      return;
    }

    // Prevent multiple simultaneous scatter data loads
    if (loadingScatterRef.current) {
      return;
    }
    
    // Normalize date helper function (shared across the function)
    const normalizeDate = (dateStr) => {
      if (!dateStr) return '';
      // If already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
      // Otherwise parse and format
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    };
    
    // Create cache key
    const cacheKey = `${chartType}-${threshold}-${days}`;
    
    // Return cached data if available
    if (scatterCacheRef.current?.key === cacheKey && scatterCacheRef.current?.data) {
      const cachedData = scatterCacheRef.current.data;
      if (chartType === 'churn' || chartType === 'revenue') {
        // Create a map of dates to average values for the line (normalize dates)
        const averageMap = new Map();
        trendData.forEach(item => {
          const normalizedDate = normalizeDate(item.date);
          averageMap.set(normalizedDate, item.value);
        });
        
        // OPTIMIZED: Single pass data transformation with pre-indexed maps
        const averagePoints = [];
        for (const item of trendData) {
          const normalizedDate = normalizeDate(item.date);
          const dateTimestamp = new Date(normalizedDate + 'T00:00:00Z').getTime();
          averagePoints.push({
            date: normalizedDate,
            dateString: normalizedDate,
            dateTimestamp,
            value: item.value,
            averageValue: item.value,
            count: item.count || 0,
            isAverage: true
          });
        }
        
        // Pre-index individual points by date for O(1) lookup
        const individualPointsByDate = new Map();
        for (const point of cachedData.scatterPoints) {
          const normalizedDate = normalizeDate(point.date);
          const dateTimestamp = new Date(normalizedDate + 'T00:00:00Z').getTime();
          const avgValue = averageMap.get(normalizedDate) || null;
          
          if (!individualPointsByDate.has(normalizedDate)) {
            individualPointsByDate.set(normalizedDate, []);
          }
          
          individualPointsByDate.get(normalizedDate).push({
            date: normalizedDate,
            dateString: normalizedDate,
            dateTimestamp,
            value: point.value,
            averageValue: avgValue,
            call_id: point.call_id,
            count: point.count || 0,
            isAverage: false
          });
        }
        
        // Sort individual points by value (descending) for each date
        for (const points of individualPointsByDate.values()) {
          points.sort((a, b) => b.value - a.value);
        }
        
        // Collect all unique dates and sort by timestamp - optimized
        const dateTimestampMap = new Map();
        for (const point of averagePoints) {
          dateTimestampMap.set(point.date, point.dateTimestamp);
        }
        for (const [date, points] of individualPointsByDate.entries()) {
          if (!dateTimestampMap.has(date) && points.length > 0) {
            dateTimestampMap.set(date, points[0].dateTimestamp);
          }
        }
        
        const dateSet = new Set([...averagePoints.map(p => p.date), ...individualPointsByDate.keys()]);
        const sortedDates = Array.from(dateSet).sort((a, b) => {
          return (dateTimestampMap.get(a) || 0) - (dateTimestampMap.get(b) || 0);
        });
        
        // Pre-index average points by date for O(1) lookup
        const averagePointsByDate = new Map();
        for (const point of averagePoints) {
          averagePointsByDate.set(point.date, point);
        }
        
        // Build final array in chronological order
        const allPoints = [];
        for (const date of sortedDates) {
          // Add average point first if exists
          const avgPoint = averagePointsByDate.get(date);
          if (avgPoint) {
            allPoints.push(avgPoint);
          }
          // Add all individual points for this date
          const individualForDate = individualPointsByDate.get(date) || [];
          allPoints.push(...individualForDate);
        }
        
        setData(allPoints);
        setScatterData(cachedData.scatterPoints);
      }
      return;
    }
    
    try {
      loadingScatterRef.current = true;
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Fetch calls - optimized: limit to 100 for better performance
      // We can still show all calls but with a smaller dataset for faster rendering
      const params = {
        limit: 100, // Reduced from 200 to 100 for better performance
        skip: 0,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      };
      
      // Order by score descending to show highest scores first
      if (chartType === 'churn') {
        params.order_by = 'churn_score_desc';
      } else if (chartType === 'revenue') {
        params.order_by = 'revenue_score_desc';
      }
      
      // Fetch calls - single request, optimized query
      const response = await callsAPI.listCalls(params);
      const calls = Array.isArray(response) ? response : (response.calls || []);
      
      // Process only fetched calls
      const callsToProcess = calls;
      const callIds = callsToProcess.map(call => call.call_id);
      
      if (callIds.length === 0) {
        setScatterData([]);
        loadingScatterRef.current = false;
        return;
      }
      
      let insightsMap = {};
      try {
        const bulkInsightsResponse = await callsAPI.getBulkInsights(callIds);
        insightsMap = bulkInsightsResponse.insights || {};
      } catch (err) {
        console.error('Error fetching bulk insights:', err);
        // Fallback: return empty map
        insightsMap = {};
      }
      
      // Create a map of dates to counts from trend data (accurate backend counts)
      // Normalize trend data dates first
      const trendDateCountMap = new Map();
      trendData.forEach(item => {
        const normalizedDate = normalizeDate(item.date);
        trendDateCountMap.set(normalizedDate, item.count || 0);
      });
      
      // Process insights and create scatter points - optimized single pass
      // Pre-create date count map for O(1) lookups
      const scatterPoints = [];
      for (const call of callsToProcess) {
        if (!call.created_at) continue;
        
        const insights = insightsMap[call.call_id];
        if (!insights) continue; // Skip if no insights
        
        const score = chartType === 'churn' 
          ? insights.churn_score 
          : insights.revenue_interest_score;
        
        // Skip if score is null/undefined (now should be 0.0 instead of null)
        if (score == null) continue;
        
        // Normalize date once
        const callDate = new Date(call.created_at);
        const dateStr = normalizeDate(callDate.toISOString().split('T')[0]);
        
        // Use count from trend data (accurate backend count)
        const accurateCount = trendDateCountMap.get(dateStr) || 0;
        
        scatterPoints.push({
          date: dateStr,
          dateString: dateStr,
          value: typeof score === 'number' ? score : parseFloat(score) || 0,
          call_id: call.call_id,
          count: accurateCount,
        });
      }
      
      // Scatter points formatted
      
      // Cache the scatter points
      scatterCacheRef.current = {
        key: cacheKey,
        data: { scatterPoints }
      };
      
      // For churn and revenue: combine trend data (averages) and scatter points
      // OPTIMIZED: Single pass data transformation with pre-indexed maps
      if (chartType === 'churn' || chartType === 'revenue') {
        // Create averageMap and averagePoints in one pass
        const averageMap = new Map();
        const averagePoints = [];
        for (const item of trendData) {
          const normalizedDate = normalizeDate(item.date);
          const dateTimestamp = new Date(normalizedDate + 'T00:00:00Z').getTime();
          averageMap.set(normalizedDate, item.value);
          averagePoints.push({
            date: normalizedDate,
            dateString: normalizedDate,
            dateTimestamp,
            value: item.value,
            averageValue: item.value,
            count: item.count || 0,
            isAverage: true
          });
        }
        
        // Pre-index individual points by date for O(1) lookup
        const individualPointsByDate = new Map();
        for (const point of scatterPoints) {
          const normalizedDate = point.date;
          const dateTimestamp = new Date(normalizedDate + 'T00:00:00Z').getTime();
          const avgValue = averageMap.get(normalizedDate) || null;
          
          if (!individualPointsByDate.has(normalizedDate)) {
            individualPointsByDate.set(normalizedDate, []);
          }
          
          individualPointsByDate.get(normalizedDate).push({
            date: normalizedDate,
            dateString: point.dateString || normalizedDate,
            dateTimestamp,
            value: point.value,
            averageValue: avgValue,
            call_id: point.call_id,
            count: point.count || 0,
            isAverage: false
          });
        }
        
        // Sort individual points by value (descending) for each date
        for (const points of individualPointsByDate.values()) {
          points.sort((a, b) => b.value - a.value);
        }
        
        // Collect all unique dates and sort by timestamp - optimized
        const dateTimestampMap = new Map();
        // Pre-populate timestamp map for O(1) lookup
        for (const point of averagePoints) {
          dateTimestampMap.set(point.date, point.dateTimestamp);
        }
        for (const [date, points] of individualPointsByDate.entries()) {
          if (!dateTimestampMap.has(date) && points.length > 0) {
            dateTimestampMap.set(date, points[0].dateTimestamp);
          }
        }
        
        const dateSet = new Set([...averagePoints.map(p => p.date), ...individualPointsByDate.keys()]);
        const sortedDates = Array.from(dateSet).sort((a, b) => {
          return (dateTimestampMap.get(a) || 0) - (dateTimestampMap.get(b) || 0);
        });
        
        // Pre-index average points by date for O(1) lookup
        const averagePointsByDate = new Map();
        for (const point of averagePoints) {
          averagePointsByDate.set(point.date, point);
        }
        
        // Build final array in chronological order
        const allPoints = [];
        for (const date of sortedDates) {
          // Add average point first if exists
          const avgPoint = averagePointsByDate.get(date);
          if (avgPoint) {
            allPoints.push(avgPoint);
          }
          // Add all individual points for this date
          const individualForDate = individualPointsByDate.get(date) || [];
          allPoints.push(...individualForDate);
        }
        
        setData(allPoints);
        setScatterData(scatterPoints);
      } else {
        setData(trendData);
        setScatterData(scatterPoints);
      }
    } catch (err) {
      console.error('Error loading scatter data:', err);
      setScatterData([]);
    } finally {
      loadingScatterRef.current = false;
    }
  }, [threshold, days]);

  const loadTrendData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      if (type === 'sentiment') {
        response = await callsAPI.getSentimentTrend(gymId, days, 'day');
        const formattedData = response.data.map(item => ({
          date: item.date,
          positive: item.positive || 0,
          negative: item.negative || 0,
          total: item.total || 0,
          call_id: item.call_id,
          dateString: item.date
        }));
        setData(formattedData);
      } else if (type === 'churn') {
        response = await callsAPI.getChurnTrend(gymId, days, 'day');
        // Normalize date helper (inline for this scope)
        const normalizeDateStr = (dateStr) => {
          if (!dateStr) return '';
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
          const date = new Date(dateStr);
          return date.toISOString().split('T')[0];
        };
        const formattedData = response.data.map(item => {
          const normalizedDate = normalizeDateStr(item.date);
          return {
            date: normalizedDate,
            dateString: normalizedDate,
            value: typeof item.value === 'number' ? item.value : parseFloat(item.value) || 0,
            call_id: item.call_id,
            count: item.count || 0,
          };
        });
        // Sort trend data by date to ensure chronological order
        formattedData.sort((a, b) => {
          const dateA = new Date(a.date + 'T00:00:00Z').getTime();
          const dateB = new Date(b.date + 'T00:00:00Z').getTime();
          return dateA - dateB;
        });
        setData(formattedData);
        // Defer scatter data loading to improve initial render performance
        // Load scatter data after a short delay so trend chart appears first
        setTimeout(() => {
          loadScatterData('churn', formattedData).catch(err => {
            console.error('Error loading scatter data:', err);
          });
        }, 100);
      } else if (type === 'revenue') {
        response = await callsAPI.getRevenueTrend(gymId, days, 'day');
        // Normalize date helper (inline for this scope)
        const normalizeDateStr = (dateStr) => {
          if (!dateStr) return '';
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
          const date = new Date(dateStr);
          return date.toISOString().split('T')[0];
        };
        const formattedData = response.data.map(item => {
          const normalizedDate = normalizeDateStr(item.date);
          return {
            date: normalizedDate,
            dateString: normalizedDate,
            value: typeof item.value === 'number' ? item.value : parseFloat(item.value) || 0,
            call_id: item.call_id,
            count: item.count || 0,
          };
        });
        // Sort trend data by date to ensure chronological order
        formattedData.sort((a, b) => {
          const dateA = new Date(a.date + 'T00:00:00Z').getTime();
          const dateB = new Date(b.date + 'T00:00:00Z').getTime();
          return dateA - dateB;
        });
        setData(formattedData);
        // Defer scatter data loading to improve initial render performance
        setTimeout(() => {
          loadScatterData('revenue', formattedData).catch(err => {
            console.error('Error loading scatter data:', err);
          });
        }, 100);
      }
    } catch (err) {
      console.error('Error loading trend data:', err);
      setError('Failed to load trend data');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [type, gymId, days, loadScatterData]);

  useEffect(() => {
    loadTrendData();
  }, [loadTrendData]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };


  const handleChartClick = (data) => {
    if (!data || !data.activePayload || !data.activePayload.length) return;
    
    const payload = data.activePayload[0].payload;
    
    // For all chart types, show all calls for that day
    // Pass date range: start of day to end of day
    const dateStr = payload.dateString || payload.date;
    if (dateStr) {
      // Create date range for the entire day (00:00:00 to 23:59:59)
      const startDate = `${dateStr}T00:00:00.000Z`;
      const endDate = `${dateStr}T23:59:59.999Z`;
      // Call onPointClick with date range format
      if (onPointClick) {
        onPointClick(null, `${startDate}|${endDate}`, dateStr);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-2"></div>
          <p className="text-gray-400 text-sm">Loading chart data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No data available for this period</p>
      </div>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
        <p className="text-gray-300 text-sm mb-2 font-medium">{formatDate(label)}</p>
        {type === 'sentiment' ? (
          <div className="space-y-1">
            <p className="text-green-400 text-xs">Positive: {payload.find(p => p.dataKey === 'positive')?.value || 0}</p>
            <p className="text-red-400 text-xs">Negative: {payload.find(p => p.dataKey === 'negative')?.value || 0}</p>
            <p className="text-gray-500 text-xs mt-2">Total: {payload[0]?.payload?.total || 0} calls</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-white text-xs font-medium">
              {type === 'churn' ? 'Churn Score' : 'Revenue Score'}: {payload[0]?.value?.toFixed(2) || '0.00'}
            </p>
            <p className="text-gray-500 text-xs">
              Calls: {payload[0]?.payload?.isAverage 
                ? (payload[0]?.payload?.count || 0)
                : (payload[0]?.payload?.count || data.filter(d => !d.isAverage && d.date === label).length || 0)}
            </p>
            {payload[0]?.payload?.isAverage && (
              <p className="text-gray-400 text-xs italic">(Average)</p>
            )}
            {!payload[0]?.payload?.isAverage && payload[0]?.payload?.call_id && (
              <p className="text-gray-400 text-xs italic">(Individual call)</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === 'sentiment' ? (
          <AreaChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            onClick={handleChartClick}
            style={{ cursor: 'pointer' }}
          >
            <defs>
              <linearGradient id="colorPositive" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorNegative" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
            />
            <YAxis
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }}
              iconType="square"
            />
            <Area
              type="monotone"
              dataKey="positive"
              stackId="1"
              stroke="#10b981"
              fill="url(#colorPositive)"
              name="Positive"
            />
            <Area
              type="monotone"
              dataKey="negative"
              stackId="1"
              stroke="#ef4444"
              fill="url(#colorNegative)"
              name="Negative"
            />
          </AreaChart>
        ) : (
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            onClick={handleChartClick}
            style={{ cursor: 'pointer' }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="dateTimestamp"
              tickFormatter={(timestamp) => {
                // Convert timestamp back to date string for formatting
                if (!timestamp) return '';
                const date = new Date(timestamp);
                const dateStr = date.toISOString().split('T')[0];
                return formatDate(dateStr);
              }}
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.2, 0.4, 0.6, 0.8, 1.0]}
              stroke="#9ca3af"
              style={{ fontSize: '12px' }}
              allowDataOverflow={false}
              padding={{ top: 0, bottom: 0 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ color: '#9ca3af', fontSize: '12px' }}
            />
            <ReferenceLine
              y={threshold}
              stroke={type === 'churn' ? '#f97316' : '#3b82f6'}
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{ 
                value: `Threshold: ${threshold}`, 
                position: 'right', 
                fill: type === 'churn' ? '#f97316' : '#3b82f6', 
                style: { fontSize: '12px' },
                offset: 10
              }}
              ifOverflow="visible"
            />
            {/* Line connecting average points */}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 8 }}
              connectNulls={false}
              data={data.filter(d => d.isAverage).sort((a, b) => (a.dateTimestamp || 0) - (b.dateTimestamp || 0))}
              name={`Average ${type === 'churn' ? 'Churn' : 'Revenue'} Trend`}
              isAnimationActive={true}
            />
            {/* Scatter plot: Individual calls */}
            <Scatter
              data={data.filter(d => !d.isAverage)}
              dataKey="value"
              fill={type === 'churn' ? '#f97316' : '#3b82f6'}
              fillOpacity={0.6}
              name={`Individual Calls (${data.filter(d => !d.isAverage).length})`}
              shape={(props) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null || !payload) return null;
                
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={5}
                    fill={type === 'churn' ? '#f97316' : '#3b82f6'}
                    fillOpacity={0.6}
                    stroke="#fff"
                    strokeWidth={1}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (payload.call_id && onPointClick) {
                        onPointClick(payload.call_id);
                      }
                    }}
                  />
                );
              }}
            />
            {/* Average points in red */}
            <Scatter
              data={data.filter(d => d.isAverage)}
              dataKey="value"
              fill="#ef4444"
              fillOpacity={1}
              name={`Average ${type === 'churn' ? 'Churn' : 'Revenue'} Score`}
              shape={(props) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null || !payload) return null;
                
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={8}
                    fill="#ef4444"
                    fillOpacity={1}
                    stroke="#fff"
                    strokeWidth={2}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (payload.dateString && onPointClick) {
                        // Show all calls for that date
                        const date = new Date(payload.dateString);
                        const startOfDay = new Date(date);
                        startOfDay.setHours(0, 0, 0, 0);
                        const endOfDay = new Date(date);
                        endOfDay.setHours(23, 59, 59, 999);
                        onPointClick(null, `${startOfDay.toISOString()}|${endOfDay.toISOString()}`, payload.dateString);
                      }
                    }}
                  />
                );
              }}
            />
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
