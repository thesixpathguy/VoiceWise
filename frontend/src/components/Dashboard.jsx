import { useState, useEffect, useCallback } from 'react';
import { callsAPI } from '../api/api';
import FilteredCallsModal from './FilteredCallsModal';
import TrendCharts from './TrendCharts';

export default function Dashboard({ setCurrentPage }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterModal, setFilterModal] = useState({
    isOpen: false,
    type: null,
    value: null,
    label: '',
    callId: null
  });
  const [churnUsers, setChurnUsers] = useState(null);
  const [revenueUsers, setRevenueUsers] = useState(null);
  const [selectedChurnCall, setSelectedChurnCall] = useState(null);
  const [selectedRevenueCall, setSelectedRevenueCall] = useState(null);
  const [sentimentChartType, setSentimentChartType] = useState('area'); // 'area', 'line', 'stackedBar', 'radar'
  const [churnChartType, setChurnChartType] = useState('avgLine'); // 'avgLine', 'scatter'
  const [revenueChartType, setRevenueChartType] = useState('avgLine'); // 'avgLine', 'scatter'
  
  // Date range state
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      startDate: thirtyDaysAgo.toLocaleDateString('en-GB'), // DD/MM/YYYY format
      endDate: today.toLocaleDateString('en-GB')
    };
  });

  // Helper function to format date for API (DD-MM-YYYY)
  const formatDateForAPI = (dateStr) => {
    // Convert DD/MM/YYYY to DD-MM-YYYY
    return dateStr.replace(/\//g, '-');
  };

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const startDate = formatDateForAPI(dateRange.startDate);
      const endDate = formatDateForAPI(dateRange.endDate);
      const data = await callsAPI.getDashboardSummary(startDate, endDate);
      setSummary(data);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]); // Reload when date range changes

  // Auto-load churn users when summary is available or date range changes
  useEffect(() => {
    if (summary?.churn_interest) {
      const loadChurnUsers = async () => {
        try {
          const threshold = summary.churn_interest.churn_threshold || 0.8;
          const startDate = formatDateForAPI(dateRange.startDate);
          const endDate = formatDateForAPI(dateRange.endDate);
          const data = await callsAPI.getTopChurnUsers(null, startDate, endDate, threshold, 100);
          setChurnUsers(data);
        } catch (err) {
          console.error('Failed to load churn users:', err);
        }
      };
      loadChurnUsers();
    }
  }, [summary, dateRange]);

  // Auto-load revenue users when summary is available or date range changes
  useEffect(() => {
    if (summary?.revenue_interest) {
      const loadRevenueUsers = async () => {
        try {
          const threshold = summary.revenue_interest.revenue_threshold || 0.8;
          const startDate = formatDateForAPI(dateRange.startDate);
          const endDate = formatDateForAPI(dateRange.endDate);
          const data = await callsAPI.getTopRevenueUsers(null, startDate, endDate, threshold, 100);
          setRevenueUsers(data);
        } catch (err) {
          console.error('Failed to load revenue users:', err);
        }
      };
      loadRevenueUsers();
    }
  }, [summary, dateRange]);

  // Handle date range change
  const handleDateRangeChange = (newStartDate, newEndDate) => {
    setDateRange({
      startDate: newStartDate,
      endDate: newEndDate
    });
    // Clear user data to force reload
    setChurnUsers(null);
    setRevenueUsers(null);
    setSelectedChurnCall(null);
    setSelectedRevenueCall(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
          <p className="text-red-400 text-lg">{error}</p>
          <button
            onClick={loadDashboard}
            className="mt-4 px-6 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const openFilterModal = (type, value, label, callId = null) => {
    setFilterModal({ isOpen: true, type, value, label, callId });
  };

  const closeFilterModal = () => {
    setFilterModal({ isOpen: false, type: null, value: null, label: '', callId: null });
  };

  const generic = summary.generic || {};
  const churn = summary.churn_interest || {};
  const revenue = summary.revenue_interest || {};

  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      {/* Date Range Selector */}
      <div className="mb-6 bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <h3 className="text-lg font-semibold text-white">Date Range Filter</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">From:</label>
              <input
                type="date"
                value={dateRange.startDate.split('/').reverse().join('-')} // Convert DD/MM/YYYY to YYYY-MM-DD for input
                onChange={(e) => {
                  const newDate = new Date(e.target.value).toLocaleDateString('en-GB');
                  handleDateRangeChange(newDate, dateRange.endDate);
                }}
                className="bg-gray-900 border border-gray-600 rounded px-3 py-1 text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">To:</label>
              <input
                type="date"
                value={dateRange.endDate.split('/').reverse().join('-')} // Convert DD/MM/YYYY to YYYY-MM-DD for input
                onChange={(e) => {
                  const newDate = new Date(e.target.value).toLocaleDateString('en-GB');
                  handleDateRangeChange(dateRange.startDate, newDate);
                }}
                className="bg-gray-900 border border-gray-600 rounded px-3 py-1 text-white text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div className="text-sm text-gray-400">
              ({dateRange.startDate} - {dateRange.endDate})
            </div>
          </div>
        </div>
      </div>

      {/* Aesthetic Divider for Business Health Analysis Section */}
      <div className="mb-8 relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
        </div>
        <div className="relative flex justify-center">
          <div className="bg-gray-900 px-5 py-2.5 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-base text-gray-400 font-medium">Business Health Analysis</span>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== SECTION 1: BUSINESS HEALTH ANALYSIS SECTION ===== */}
      <div className="mb-6">
        {/* Compact Layout: Stats + Chart in one row, Pain Points + Opportunities below */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Stats Grid - Compact 3x3 Grid */}
          <div className="grid grid-cols-3 gap-2 lg:col-span-1">
            {/* Total Calls - Purple, Clickable */}
            <div 
              onClick={() => setCurrentPage('calls')}
              className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-2 cursor-pointer hover:bg-purple-500/20 transition-all flex flex-col items-center justify-center"
            >
              <span className="text-gray-400 text-sm mb-0.5">Total Calls</span>
              <p className="text-xl font-bold text-purple-400">{generic.total_calls || 0}</p>
            </div>

            {/* Positive Sentiment - Green, Clickable */}
            <div 
              onClick={() => openFilterModal('sentiment', 'positive', `Positive Sentiment Calls (${generic.positive_sentiment || 0})`)}
              className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 cursor-pointer hover:bg-green-500/20 transition-all flex flex-col items-center justify-center"
            >
              <span className="text-gray-400 text-sm mb-0.5">Positive Calls</span>
              <p className="text-xl font-bold text-green-400">{generic.positive_sentiment || 0}</p>
            </div>

            {/* Negative Sentiment - Red, Clickable */}
            <div 
              onClick={() => openFilterModal('sentiment', 'negative', `Negative Sentiment Calls (${generic.negative_sentiment || 0})`)}
              className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 cursor-pointer hover:bg-red-500/20 transition-all flex flex-col items-center justify-center"
            >
              <span className="text-gray-400 text-sm mb-0.5">Negative Calls</span>
              <p className="text-xl font-bold text-red-400">{generic.negative_sentiment || 0}</p>
            </div>

            {/* Additional Metrics Row */}
            <div className="grid grid-cols-3 gap-2 col-span-3">
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 flex flex-col items-center justify-center">
                <span className="text-gray-400 text-sm mb-0.5">Avg Rating</span>
                <p className="text-xl font-bold text-white">
                  {generic.average_gym_rating !== null && generic.average_gym_rating !== undefined
                    ? `${generic.average_gym_rating}/10`
                    : 'N/A'}
                </p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 flex flex-col items-center justify-center">
                <span className="text-gray-400 text-sm mb-0.5">Placeholder Metric</span>
                <p className="text-xl font-bold text-white">NA</p>
              </div>
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 flex flex-col items-center justify-center">
                <span className="text-gray-400 text-sm mb-0.5">Placeholder Metric</span>
                <p className="text-xl font-bold text-white">NA</p>
              </div>
            </div>
          </div>

          {/* Sentiment Trend Chart - Wider and Higher */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">Sentiment Trend</h3>
              {/* Chart Type Selector */}
              <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-700 rounded-lg p-1 flex-wrap">
                <button
                  onClick={() => setSentimentChartType('area')}
                  className={`px-2 py-1 text-xs rounded transition-all ${
                    sentimentChartType === 'area'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  title="Area Chart"
                >
                  Area
                </button>
                <button
                  onClick={() => setSentimentChartType('line')}
                  className={`px-2 py-1 text-xs rounded transition-all ${
                    sentimentChartType === 'line'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  title="Line Chart"
                >
                  Line
                </button>
                <button
                  onClick={() => setSentimentChartType('stackedBar')}
                  className={`px-2 py-1 text-xs rounded transition-all ${
                    sentimentChartType === 'stackedBar'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  title="Stacked Bar Chart"
                >
                  Stacked
                </button>
                <button
                  onClick={() => setSentimentChartType('radar')}
                  className={`px-2 py-1 text-xs rounded transition-all ${
                    sentimentChartType === 'radar'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  title="Radar Chart"
                >
                  Radar
                </button>
              </div>
            </div>
            <div style={{ height: '280px' }}>
              <TrendCharts
                type="sentiment"
                chartType={sentimentChartType}
                gymId={null}
                startDate={formatDateForAPI(dateRange.startDate)}
                endDate={formatDateForAPI(dateRange.endDate)}
                onPointClick={(callId, dateRange, dateStr) => {
                  if (dateRange) {
                    const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Selected Day';
                    openFilterModal('date_range', dateRange, `Calls on ${formattedDate}`);
                  } else if (callId) {
                    openFilterModal('call_id', callId, `Call Details`, callId);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Top Pain Points and Opportunities - Compact */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Pain Points */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span>🎯</span>
              Top Pain Points
            </h3>
            {generic.top_pain_points && generic.top_pain_points.length > 0 ? (
              <div className="space-y-2">
                {generic.top_pain_points.slice(0, 5).map((point, index) => (
                  <div 
                    key={index} 
                    onClick={() => openFilterModal('pain_point', point.name, `Pain Point: ${point.name} (${point.count} calls)`)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-all"
                  >
                    <span className="text-gray-300 text-sm">{point.name}</span>
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
                      {point.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4 text-sm">No pain points detected yet</p>
            )}
          </div>

          {/* Top Opportunities */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span>💰</span>
              Top Opportunities
            </h3>
            {generic.top_opportunities && generic.top_opportunities.length > 0 ? (
              <div className="space-y-2">
                {generic.top_opportunities.slice(0, 5).map((opportunity, index) => (
                  <div 
                    key={index} 
                    onClick={() => openFilterModal('opportunity', opportunity.name, `Opportunity: ${opportunity.name} (${opportunity.count} calls)`)}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-all"
                  >
                    <span className="text-gray-300 text-sm">{opportunity.name}</span>
                    <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded-full text-xs font-medium">
                      {opportunity.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4 text-sm">No opportunities detected yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Aesthetic Divider between Generic and Churn Sections */}
      <div className="my-8 relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
        </div>
        <div className="relative flex justify-center">
          <div className="bg-gray-900 px-5 py-2.5 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></div>
              <span className="text-base text-gray-400 font-medium">Churn Analysis</span>
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== SECTION 2: CHURN INTEREST SECTION ===== */}
      <div className="mb-6">

        {/* Compact Layout: Stats + Chart + Lists in optimized grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
          {/* Left Column: Stats and User Segment */}
          <div className="lg:col-span-1 space-y-3">
            {/* Total Churn Calls and Rating - Compact */}
            <div className="grid grid-cols-2 gap-3">
              <div 
                onClick={() => openFilterModal('churn_min_score', churn.churn_threshold || 0.8, `Churn Interest Calls (${churn.total_calls || 0})`)}
                className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 cursor-pointer hover:bg-orange-500/20 transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400 text-xs">Top Churn Calls</span>
                </div>
                <p className="text-xl font-bold text-orange-400">{churn.total_calls || 0}</p>
              </div>
              
              {/* Average Gym Rating for Churn Calls */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400 text-xs">Avg Review Rating</span>
                </div>
                <p className="text-xl font-bold text-white">
                  {churn.average_gym_rating !== null && churn.average_gym_rating !== undefined 
                    ? churn.average_gym_rating.toFixed(1)
                    : 'N/A'}
                </p>
              </div>
            </div>
          
            {/* Top Churn User Segment Tab - Always Open */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
              {/* Tab Header with Call Button */}
              <div className="px-4 py-3 bg-orange-500/10 border-b border-orange-500/20 rounded-t-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-orange-500/20 rounded-lg">
                    <span className="text-lg">👥</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">Top Churn Users</span>
                      {churnUsers && churnUsers.phone_numbers && churnUsers.phone_numbers.length > 0 && (
                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-xs font-semibold">
                          {churnUsers.phone_numbers.length}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">High-risk members</span>
                  </div>
                </div>
                {churnUsers && churnUsers.phone_numbers && churnUsers.phone_numbers.length > 0 && (
                  <button
                    onClick={() => {
                      const phoneNumbers = churnUsers.phone_numbers.map(u => u.phone_number).join('\n');
                      localStorage.setItem('initiateCalls_phoneNumbers', phoneNumbers);
                      setCurrentPage('initiate');
                    }}
                    className="p-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors shadow-lg"
                    title={`Call All ${churnUsers.phone_numbers.length} users`}
                  >
                    <span className="text-lg">📞</span>
                  </button>
                )}
              </div>
              
              {/* User List - Always Visible */}
              <div className="p-2 max-h-48 overflow-y-auto">
                {churnUsers && churnUsers.phone_numbers && churnUsers.phone_numbers.length > 0 ? (
                  <div className="space-y-1">
                    {churnUsers.phone_numbers.map((user, index) => (
                    <div
                      key={index}
                      onClick={async () => {
                        try {
                          const startDate = formatDateForAPI(dateRange.startDate);
                          const endDate = formatDateForAPI(dateRange.endDate);
                          const call = await callsAPI.getLatestCallByPhone(user.phone_number, null, startDate, endDate);
                          if (call && call.call_id) {
                            setSelectedChurnCall({ call, phoneNumber: user.phone_number, score: user.churn_score });
                          } else {
                            console.error('Invalid call data:', call);
                          }
                        } catch (err) {
                          console.error('Failed to load call:', err);
                          alert(`Failed to load call: ${err.message || err}`);
                        }
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all text-xs ${
                        selectedChurnCall?.phoneNumber === user.phone_number
                          ? 'bg-orange-500/20 border border-orange-500/30'
                          : 'bg-gray-900/50 border border-gray-700 hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-orange-400 font-medium">#{index + 1}</span>
                        <span className="text-white text-xs">{user.phone_number}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">
                        {user.churn_score?.toFixed(1) || 'N/A'}
                      </span>
                    </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4 text-xs">No churn users found</p>
                )}
              </div>
              
              {/* Selected Phone Call Details - Compact */}
              {selectedChurnCall && (
                <div className="border-t border-gray-700 p-2 bg-gray-900/30">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-white">Call: {selectedChurnCall.phoneNumber}</h4>
                    <button
                      onClick={() => setSelectedChurnCall(null)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <div
                    onClick={() => {
                      if (selectedChurnCall?.call?.call_id) {
                        openFilterModal('call_id', selectedChurnCall.call.call_id, `Call: ${selectedChurnCall.phoneNumber}`, selectedChurnCall.call.call_id);
                      } else {
                        console.error('Invalid call data:', selectedChurnCall);
                      }
                    }}
                    className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 cursor-pointer hover:bg-gray-800 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-300">{selectedChurnCall.call.call_id}</span>
                      <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">
                        {selectedChurnCall.score?.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Middle Column: Chart - Wider and Higher */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 lg:col-span-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">Churn Risk Trend</h3>
              {/* Chart Type Selector */}
              <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setChurnChartType('avgLine')}
                  className={`px-2 py-1 text-xs rounded transition-all ${
                    churnChartType === 'avgLine'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  title="Average Line Chart"
                >
                  Avg Line
                </button>
                <button
                  onClick={() => setChurnChartType('scatter')}
                  className={`px-2 py-1 text-xs rounded transition-all ${
                    churnChartType === 'scatter'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  title="Scatter Plot"
                >
                  Scatter
                </button>
              </div>
            </div>
            <div style={{ height: '280px' }}>
              <TrendCharts
                type="churn"
                chartType={churnChartType}
                gymId={null}
                startDate={formatDateForAPI(dateRange.startDate)}
                endDate={formatDateForAPI(dateRange.endDate)}
                threshold={churn.churn_threshold || 0.8}
                onPointClick={(callId, dateRange, dateStr) => {
                  if (dateRange) {
                    const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Selected Day';
                    openFilterModal('date_range', dateRange, `Churn Calls on ${formattedDate}`);
                  } else if (callId) {
                    openFilterModal('call_id', callId, `Call Details`, callId);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Top Pain Points and Churn Quotes - Compact */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Pain Points from Churn Calls */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span>🎯</span>
              Top Improvement Levers
            </h3>
            {churn.top_pain_points && churn.top_pain_points.length > 0 ? (
              <div className="space-y-2">
                {churn.top_pain_points.slice(0, 5).map((point, index) => (
                  <div 
                    key={index} 
                    onClick={() => {
                      const threshold = churn.churn_threshold || 0.8;
                      openFilterModal('pain_point_churn', `${point.name}|${threshold}`, `Improvement Lever: ${point.name} (${point.count} calls)`);
                    }}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-all"
                  >
                    <span className="text-gray-300 text-sm">{point.name}</span>
                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full text-xs font-medium">
                      {point.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4 text-sm">No pain points detected in churn calls</p>
            )}
          </div>

          {/* Top Churn Interest Quotes - Compact */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span>💬</span>
              Member Disinterests Expressed
            </h3>
            {churn.top_churn_quotes && churn.top_churn_quotes.length > 0 ? (
              <div className="space-y-2">
                {churn.top_churn_quotes.slice(0, 3).map((quote, index) => (
                  <div 
                    key={index} 
                    onClick={() => openFilterModal('call_id', quote.call_id, `Churn Quote: ${quote.phone_number}`, quote.call_id)}
                    className="bg-gray-900/50 border border-gray-700 rounded-lg p-2 cursor-pointer hover:bg-gray-800/50 transition-all"
                  >
                    <p className="text-gray-300 text-xs mb-1 italic line-clamp-2">"{quote.quote}"</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        quote.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                        quote.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {quote.sentiment}
                      </span>
                      <span className="text-xs text-gray-500">{quote.phone_number}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4 text-sm">No churn quotes available yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Aesthetic Divider between Churn and Revenue Sections */}
      <div className="my-8 relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
        </div>
        <div className="relative flex justify-center">
          <div className="bg-gray-900 px-5 py-2.5 rounded-full border border-gray-700 shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse"></div>
              <span className="text-base text-gray-400 font-medium">Revenue Opportunities Analysis</span>
              <div className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== SECTION 3: REVENUE INTEREST SECTION ===== */}
      <div className="mb-6">

        {/* Compact Layout: Stats + Chart + Lists in optimized grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
          {/* Left Column: Stats and User Segment */}
          <div className="lg:col-span-1 space-y-3">
            {/* Total Revenue Calls and Rating - Compact */}
            <div className="grid grid-cols-2 gap-3">
              <div 
                onClick={() => openFilterModal('revenue_min_score', revenue.revenue_threshold || 0.8, `Lead Interest Calls (${revenue.total_calls || 0})`)}
                className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3 cursor-pointer hover:bg-primary-500/20 transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400 text-xs">Lead Interest Calls</span>
                </div>
                <p className="text-xl font-bold text-primary-400">{revenue.total_calls || 0}</p>
              </div>
              
              {/* Average Gym Rating for Revenue Calls */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400 text-xs">Avg Review Rating</span>
                </div>
                <p className="text-xl font-bold text-white">
                  {revenue.average_gym_rating !== null && revenue.average_gym_rating !== undefined 
                    ? revenue.average_gym_rating.toFixed(1)
                    : 'N/A'}
                </p>
              </div>
            </div>
          
            {/* Top Revenue User Segment Tab - Always Open */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg">
              {/* Tab Header with Call Button */}
              <div className="px-4 py-3 bg-primary-500/10 border-b border-primary-500/20 rounded-t-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-primary-500/20 rounded-lg">
                    <span className="text-lg">👥</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">Top Revenue Levers</span>
                      {revenueUsers && revenueUsers.phone_numbers && revenueUsers.phone_numbers.length > 0 && (
                        <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded-full text-xs font-semibold">
                          {revenueUsers.phone_numbers.length}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">High-value opportunities</span>
                  </div>
                </div>
                {revenueUsers && revenueUsers.phone_numbers && revenueUsers.phone_numbers.length > 0 && (
                  <button
                    onClick={() => {
                      const phoneNumbers = revenueUsers.phone_numbers.map(u => u.phone_number).join('\n');
                      localStorage.setItem('initiateCalls_phoneNumbers', phoneNumbers);
                      setCurrentPage('initiate');
                    }}
                    className="p-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors shadow-lg"
                    title={`Call All ${revenueUsers.phone_numbers.length} users`}
                  >
                    <span className="text-lg">📞</span>
                  </button>
                )}
              </div>
              
              {/* User List - Always Visible */}
              <div className="p-2 max-h-48 overflow-y-auto">
                {revenueUsers && revenueUsers.phone_numbers && revenueUsers.phone_numbers.length > 0 ? (
                  <div className="space-y-1">
                    {revenueUsers.phone_numbers.map((user, index) => (
                    <div
                      key={index}
                      onClick={async () => {
                        try {
                          const startDate = formatDateForAPI(dateRange.startDate);
                          const endDate = formatDateForAPI(dateRange.endDate);
                          const call = await callsAPI.getLatestCallByPhone(user.phone_number, null, startDate, endDate);
                          if (call && call.call_id) {
                            setSelectedRevenueCall({ call, phoneNumber: user.phone_number, score: user.revenue_interest_score });
                          } else {
                            console.error('Invalid call data:', call);
                          }
                        } catch (err) {
                          console.error('Failed to load call:', err);
                          alert(`Failed to load call: ${err.message || err}`);
                        }
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all text-xs ${
                        selectedRevenueCall?.phoneNumber === user.phone_number
                          ? 'bg-primary-500/20 border border-primary-500/30'
                          : 'bg-gray-900/50 border border-gray-700 hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-primary-400 font-medium">#{index + 1}</span>
                        <span className="text-white text-xs">{user.phone_number}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded text-xs font-medium">
                        {user.revenue_interest_score?.toFixed(1) || 'N/A'}
                      </span>
                    </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4 text-xs">No revenue users found</p>
                )}
              </div>
              
              {/* Selected Phone Call Details - Compact */}
              {selectedRevenueCall && (
                <div className="border-t border-gray-700 p-2 bg-gray-900/30">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-white">Call: {selectedRevenueCall.phoneNumber}</h4>
                    <button
                      onClick={() => setSelectedRevenueCall(null)}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <div
                    onClick={() => {
                      if (selectedRevenueCall?.call?.call_id) {
                        openFilterModal('call_id', selectedRevenueCall.call.call_id, `Call: ${selectedRevenueCall.phoneNumber}`, selectedRevenueCall.call.call_id);
                      } else {
                        console.error('Invalid call data:', selectedRevenueCall);
                      }
                    }}
                    className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 cursor-pointer hover:bg-gray-800 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-300">{selectedRevenueCall.call.call_id}</span>
                      <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded text-xs">
                        {selectedRevenueCall.score?.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Middle Column: Chart - Wider and Higher */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 lg:col-span-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">Revenue Opportunity Trend</h3>
              {/* Chart Type Selector */}
              <div className="flex items-center gap-1 bg-gray-900/50 border border-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setRevenueChartType('avgLine')}
                  className={`px-2 py-1 text-xs rounded transition-all ${
                    revenueChartType === 'avgLine'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  title="Average Line Chart"
                >
                  Avg Line
                </button>
                <button
                  onClick={() => setRevenueChartType('scatter')}
                  className={`px-2 py-1 text-xs rounded transition-all ${
                    revenueChartType === 'scatter'
                      ? 'bg-primary-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  title="Scatter Plot"
                >
                  Scatter
                </button>
              </div>
            </div>
            <div style={{ height: '280px' }}>
              <TrendCharts
                type="revenue"
                chartType={revenueChartType}
                gymId={null}
                startDate={formatDateForAPI(dateRange.startDate)}
                endDate={formatDateForAPI(dateRange.endDate)}
                threshold={revenue.revenue_threshold || 0.8}
                onPointClick={(callId, dateRange, dateStr) => {
                  if (dateRange) {
                    const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Selected Day';
                    openFilterModal('date_range', dateRange, `Revenue Calls on ${formattedDate}`);
                  } else if (callId) {
                    openFilterModal('call_id', callId, `Call Details`, callId);
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Top Opportunities and Revenue Quotes - Compact */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Opportunities from Revenue Calls */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span>💰</span>
              Top Revenue Opportunity
            </h3>
            {revenue.top_opportunities && revenue.top_opportunities.length > 0 ? (
              <div className="space-y-2">
                {revenue.top_opportunities.slice(0, 5).map((opportunity, index) => (
                  <div 
                    key={index} 
                    onClick={() => {
                      const threshold = revenue.revenue_threshold || 0.8;
                      openFilterModal('opportunity_revenue', `${opportunity.name}|${threshold}`, `Opportunity: ${opportunity.name} (${opportunity.count} calls) - Revenue Section`);
                    }}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-all"
                  >
                    <span className="text-gray-300 text-sm">{opportunity.name}</span>
                    <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 rounded-full text-xs font-medium">
                      {opportunity.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4 text-sm">No opportunities detected in revenue calls</p>
            )}
          </div>

          {/* Top Revenue Interest Quotes - Compact */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span>💬</span>
              Member Interests Expressed
            </h3>
            {revenue.top_revenue_quotes && revenue.top_revenue_quotes.length > 0 ? (
              <div className="space-y-2">
                {revenue.top_revenue_quotes.slice(0, 3).map((quote, index) => (
                  <div 
                    key={index} 
                    onClick={() => openFilterModal('call_id', quote.call_id, `Revenue Quote: ${quote.phone_number}`, quote.call_id)}
                    className="bg-gray-900/50 border border-gray-700 rounded-lg p-2 cursor-pointer hover:bg-gray-800/50 transition-all"
                  >
                    <p className="text-gray-300 text-xs mb-1 italic line-clamp-2">"{quote.quote}"</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        quote.sentiment === 'positive' ? 'bg-green-500/20 text-green-400' :
                        quote.sentiment === 'negative' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {quote.sentiment}
                      </span>
                      <span className="text-xs text-gray-500">{quote.phone_number}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4 text-sm">No revenue quotes available yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Filtered Calls Modal */}
      <FilteredCallsModal
        isOpen={filterModal.isOpen}
        onClose={closeFilterModal}
        filterType={filterModal.type}
        filterValue={filterModal.value}
        filterLabel={filterModal.label}
        specificCallId={filterModal.callId}
      />
    </div>
  );
}
