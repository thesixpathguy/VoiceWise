import { useState, useEffect } from 'react';
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
  const [activeChurnTab, setActiveChurnTab] = useState(false);
  const [activeRevenueTab, setActiveRevenueTab] = useState(false);
  const [selectedChurnCall, setSelectedChurnCall] = useState(null);
  const [selectedRevenueCall, setSelectedRevenueCall] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Auto-load churn users when summary is available
  useEffect(() => {
    if (summary?.churn_interest && !churnUsers) {
      const loadChurnUsers = async () => {
        try {
          const threshold = summary.churn_interest.churn_threshold || 0.8;
          const data = await callsAPI.getTopChurnUsers(null, threshold, 100);
          setChurnUsers(data);
        } catch (err) {
          console.error('Failed to load churn users:', err);
        }
      };
      loadChurnUsers();
    }
  }, [summary, churnUsers]);

  // Auto-load revenue users when summary is available
  useEffect(() => {
    if (summary?.revenue_interest && !revenueUsers) {
      const loadRevenueUsers = async () => {
        try {
          const threshold = summary.revenue_interest.revenue_threshold || 0.8;
          const data = await callsAPI.getTopRevenueUsers(null, threshold, 100);
          setRevenueUsers(data);
        } catch (err) {
          console.error('Failed to load revenue users:', err);
        }
      };
      loadRevenueUsers();
    }
  }, [summary, revenueUsers]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await callsAPI.getDashboardSummary();
      setSummary(data);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
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
      {/* ===== SECTION 1: GENERIC SECTION ===== */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
          <span>📊</span>
          Generic Section
        </h2>
        
        {/* Compact Layout: Stats + Chart in one row, Pain Points + Opportunities below */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Stats Grid - Compact 3x3 Grid */}
          <div className="grid grid-cols-3 gap-2 lg:col-span-1">
            {/* Total Calls - Purple, Clickable */}
            <div 
              onClick={() => setCurrentPage('calls')}
              className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-2 cursor-pointer hover:bg-purple-500/20 transition-all flex flex-col items-center justify-center"
            >
              <span className="text-gray-400 text-xs mb-0.5">Call Total</span>
              <p className="text-lg font-bold text-purple-400">{generic.total_calls || 0}</p>
            </div>

            {/* Positive Sentiment - Green, Clickable */}
            <div 
              onClick={() => openFilterModal('sentiment', 'positive', `Positive Sentiment Calls (${generic.positive_sentiment || 0})`)}
              className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 cursor-pointer hover:bg-green-500/20 transition-all flex flex-col items-center justify-center"
            >
              <span className="text-gray-400 text-xs mb-0.5">Call Positive</span>
              <p className="text-lg font-bold text-green-400">{generic.positive_sentiment || 0}</p>
            </div>

            {/* Negative Sentiment - Red, Clickable */}
            <div 
              onClick={() => openFilterModal('sentiment', 'negative', `Negative Sentiment Calls (${generic.negative_sentiment || 0})`)}
              className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 cursor-pointer hover:bg-red-500/20 transition-all flex flex-col items-center justify-center"
            >
              <span className="text-gray-400 text-xs mb-0.5">Call Negative</span>
              <p className="text-lg font-bold text-red-400">{generic.negative_sentiment || 0}</p>
            </div>

            {/* Average Confidence - Gray, Non-clickable */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 flex flex-col items-center justify-center">
              <span className="text-gray-400 text-xs mb-0.5">Avg Confidence</span>
              <p className="text-lg font-bold text-white">
                {generic.average_confidence !== null && generic.average_confidence !== undefined 
                  ? generic.average_confidence.toFixed(2)
                  : 'N/A'}
              </p>
            </div>

            {/* Total Duration - Gray, Non-clickable */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 flex flex-col items-center justify-center">
              <span className="text-gray-400 text-xs mb-0.5">Total Duration</span>
              <p className="text-lg font-bold text-white">
                {generic.total_duration_seconds !== null && generic.total_duration_seconds !== undefined 
                  ? `${Math.floor(generic.total_duration_seconds / 60)}m`
                  : 'N/A'}
              </p>
            </div>

            {/* Average Duration - Gray, Non-clickable */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 flex flex-col items-center justify-center">
              <span className="text-gray-400 text-xs mb-0.5">Avg Duration</span>
              <p className="text-lg font-bold text-white">
                {generic.average_duration_seconds !== null && generic.average_duration_seconds !== undefined 
                  ? `${Math.floor(generic.average_duration_seconds)}s`
                  : 'N/A'}
              </p>
            </div>

            {/* Call Pick Up Rate - Gray, Non-clickable */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 flex flex-col items-center justify-center">
              <span className="text-gray-400 text-xs mb-0.5">Call Pick Up Rate</span>
              <p className="text-lg font-bold text-white">
                {generic.call_pickup_rate !== null && generic.call_pickup_rate !== undefined 
                  ? `${generic.call_pickup_rate}%`
                  : 'N/A'}
              </p>
            </div>

            {/* Block 1 - Gray, Non-clickable */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 flex flex-col items-center justify-center">
              <span className="text-gray-400 text-xs mb-0.5">Block 1</span>
              <p className="text-lg font-bold text-white">
                {generic.block_1 !== null && generic.block_1 !== undefined 
                  ? generic.block_1.toFixed(1)
                  : 'N/A'}
              </p>
            </div>

            {/* Block 2 - Gray, Non-clickable */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-2 flex flex-col items-center justify-center">
              <span className="text-gray-400 text-xs mb-0.5">Block 2</span>
              <p className="text-lg font-bold text-white">
                {generic.block_2 !== null && generic.block_2 !== undefined 
                  ? generic.block_2.toFixed(1)
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Sentiment Trend Chart - Wider and Higher */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 lg:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-2">Sentiment Trend</h3>
            <div style={{ height: '280px' }}>
              <TrendCharts
                type="sentiment"
                gymId={null}
                days={30}
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

      {/* ===== SECTION 2: CHURN INTEREST SECTION ===== */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
          <span>⚠️</span>
          Churn Interest
          <span className="text-xs font-normal text-gray-400 ml-2">
            (Threshold: {churn.churn_threshold || 0.8})
          </span>
        </h2>

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
                  <span className="text-gray-400 text-xs">Churn Calls</span>
                </div>
                <p className="text-xl font-bold text-orange-400">{churn.total_calls || 0}</p>
              </div>
              
              {/* Average Gym Rating for Churn Calls */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400 text-xs">Avg Rating</span>
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
                          const call = await callsAPI.getLatestCallByPhone(user.phone_number);
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
            <h3 className="text-sm font-semibold text-white mb-2">Churn Risk Trend</h3>
            <div style={{ height: '280px' }}>
              <TrendCharts
                type="churn"
                gymId={null}
                days={30}
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
              Top Pain Points (Churn)
            </h3>
            {churn.top_pain_points && churn.top_pain_points.length > 0 ? (
              <div className="space-y-2">
                {churn.top_pain_points.slice(0, 5).map((point, index) => (
                  <div 
                    key={index} 
                    onClick={() => {
                      const threshold = churn.churn_threshold || 0.8;
                      openFilterModal('pain_point_churn', `${point.name}|${threshold}`, `Pain Point: ${point.name} (${point.count} calls) - Churn Section`);
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
              Top Churn Quotes
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

      {/* ===== SECTION 3: REVENUE INTEREST SECTION ===== */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
          <span>💰</span>
          Revenue Interest
          <span className="text-xs font-normal text-gray-400 ml-2">
            (Threshold: {revenue.revenue_threshold || 0.8})
          </span>
        </h2>

        {/* Compact Layout: Stats + Chart + Lists in optimized grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
          {/* Left Column: Stats and User Segment */}
          <div className="lg:col-span-1 space-y-3">
            {/* Total Revenue Calls and Rating - Compact */}
            <div className="grid grid-cols-2 gap-3">
              <div 
                onClick={() => openFilterModal('revenue_min_score', revenue.revenue_threshold || 0.8, `Revenue Interest Calls (${revenue.total_calls || 0})`)}
                className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3 cursor-pointer hover:bg-primary-500/20 transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400 text-xs">Revenue Calls</span>
                </div>
                <p className="text-xl font-bold text-primary-400">{revenue.total_calls || 0}</p>
              </div>
              
              {/* Average Gym Rating for Revenue Calls */}
              <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-gray-400 text-xs">Avg Rating</span>
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
                      <span className="font-bold text-white text-sm">Top Revenue Users</span>
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
                          const call = await callsAPI.getLatestCallByPhone(user.phone_number);
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
            <h3 className="text-sm font-semibold text-white mb-2">Revenue Opportunity Trend</h3>
            <div style={{ height: '280px' }}>
              <TrendCharts
                type="revenue"
                gymId={null}
                days={30}
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
              Top Opportunities (Revenue)
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
              Top Revenue Quotes
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
