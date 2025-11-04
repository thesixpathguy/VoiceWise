import { useState, useEffect } from 'react';
import { callsAPI } from '../api/api';
import FilteredCallsModal from './FilteredCallsModal';

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
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Member feedback insights and analytics</p>
      </div>

      {/* ===== SECTION 1: GENERIC SECTION ===== */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <span>📊</span>
          Generic Section
        </h2>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Total Calls */}
          <div 
            onClick={() => setCurrentPage('calls')}
            className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 cursor-pointer hover:bg-gray-800 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Total Calls</span>
              <span className="text-2xl">📞</span>
            </div>
            <p className="text-3xl font-bold text-white">{generic.total_calls || 0}</p>
          </div>

          {/* Positive Sentiment */}
          <div 
            onClick={() => openFilterModal('sentiment', 'positive', `Positive Sentiment Calls (${generic.positive_sentiment || 0})`)}
            className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 cursor-pointer hover:bg-green-500/20 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Positive Sentiment</span>
              <span className="text-2xl">😊</span>
            </div>
            <p className="text-3xl font-bold text-green-400">{generic.positive_sentiment || 0}</p>
          </div>

          {/* Negative Sentiment */}
          <div 
            onClick={() => openFilterModal('sentiment', 'negative', `Negative Sentiment Calls (${generic.negative_sentiment || 0})`)}
            className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 cursor-pointer hover:bg-red-500/20 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Negative Sentiment</span>
              <span className="text-2xl">😞</span>
            </div>
            <p className="text-3xl font-bold text-red-400">{generic.negative_sentiment || 0}</p>
          </div>
        </div>

        {/* Top Pain Points and Opportunities */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Pain Points */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>🎯</span>
              Top Pain Points
            </h3>
            {generic.top_pain_points && generic.top_pain_points.length > 0 ? (
              <div className="space-y-3">
                {generic.top_pain_points.map((point, index) => (
                  <div 
                    key={index} 
                    onClick={() => openFilterModal('pain_point', point.name, `Pain Point: ${point.name} (${point.count} calls)`)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-all"
                  >
                    <span className="text-gray-300">{point.name}</span>
                    <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
                      {point.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No pain points detected yet</p>
            )}
          </div>

          {/* Top Opportunities */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>💰</span>
              Top Opportunities
            </h3>
            {generic.top_opportunities && generic.top_opportunities.length > 0 ? (
              <div className="space-y-3">
                {generic.top_opportunities.map((opportunity, index) => (
                  <div 
                    key={index} 
                    onClick={() => openFilterModal('opportunity', opportunity.name, `Opportunity: ${opportunity.name} (${opportunity.count} calls)`)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-all"
                  >
                    <span className="text-gray-300">{opportunity.name}</span>
                    <span className="px-3 py-1 bg-primary-500/20 text-primary-400 rounded-full text-sm font-medium">
                      {opportunity.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No opportunities detected yet</p>
            )}
          </div>
        </div>
      </div>

      {/* ===== SECTION 2: CHURN INTEREST SECTION ===== */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <span>⚠️</span>
          Churn Interest Section
          <span className="text-sm font-normal text-gray-400 ml-2">
            (Threshold: {churn.churn_threshold || 0.8})
          </span>
        </h2>

        {/* Total Churn Calls and User Segment Tab */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center gap-4">
            <div 
              onClick={() => openFilterModal('churn_min_score', churn.churn_threshold || 0.8, `Churn Interest Calls (${churn.total_calls || 0})`)}
              className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-6 cursor-pointer hover:bg-orange-500/20 transition-all flex-1"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Total Churn Interest Calls</span>
                <span className="text-2xl">⚠️</span>
              </div>
              <p className="text-3xl font-bold text-orange-400">{churn.total_calls || 0}</p>
              <p className="text-xs text-gray-400 mt-2">Click to view calls (ordered by churn score descending)</p>
            </div>
            
            {/* Average Gym Rating for Churn Calls */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Avg Gym Rating</span>
                <span className="text-2xl">⭐</span>
              </div>
              <p className="text-3xl font-bold text-white">
                {churn.average_gym_rating !== null && churn.average_gym_rating !== undefined 
                  ? churn.average_gym_rating.toFixed(1)
                  : 'N/A'}
              </p>
              <p className="text-xs text-gray-400 mt-2">From churn interest calls</p>
            </div>
          </div>
          
          {/* Top Churn User Segment Tab */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl">
            <button
              onClick={async () => {
                if (!churnUsers && !activeChurnTab) {
                  try {
                    const threshold = churn.churn_threshold || 0.8;
                    const data = await callsAPI.getTopChurnUsers(null, threshold, 100);
                    setChurnUsers(data);
                  } catch (err) {
                    console.error('Failed to load churn users:', err);
                  }
                }
                setActiveChurnTab(!activeChurnTab);
                setSelectedChurnCall(null);
              }}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-700/50 transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">👥</span>
                <span className="text-lg font-semibold text-white">Top Churn User Segment</span>
                <span className="text-xs text-gray-400">
                  ({churnUsers?.total_count || 0} users)
                </span>
              </div>
              <span className="text-gray-400">{activeChurnTab ? '▼' : '▶'}</span>
            </button>
            
            {activeChurnTab && (
              <div className="border-t border-gray-700">
                {/* Call Button */}
                {churnUsers && churnUsers.phone_numbers && churnUsers.phone_numbers.length > 0 && (
                  <div className="p-4 border-b border-gray-700">
                    <button
                      onClick={() => {
                        const phoneNumbers = churnUsers.phone_numbers.map(u => u.phone_number).join('\n');
                        localStorage.setItem('initiateCalls_phoneNumbers', phoneNumbers);
                        setCurrentPage('initiate');
                      }}
                      className="w-full px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <span>📞</span>
                      <span>Call All {churnUsers.phone_numbers.length} Numbers</span>
                    </button>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                      Phone numbers will be copied to the initiate calls form
                    </p>
                  </div>
                )}
                
                <div className="p-4 max-h-96 overflow-y-auto">
                  {churnUsers && churnUsers.phone_numbers && churnUsers.phone_numbers.length > 0 ? (
                    <div className="space-y-2">
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
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                          selectedChurnCall?.phoneNumber === user.phone_number
                            ? 'bg-orange-500/20 border border-orange-500/30'
                            : 'bg-gray-900/50 border border-gray-700 hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-orange-400 font-medium">#{index + 1}</span>
                          <span className="text-white">{user.phone_number}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">
                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                          </span>
                          <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">
                            Churn: {user.churn_score?.toFixed(1) || 'N/A'}
                          </span>
                        </div>
                      </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No churn users found</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Selected Phone Call Details */}
            {selectedChurnCall && activeChurnTab && (
              <div className="border-t border-gray-700 p-4 bg-gray-900/30">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">Latest Call for {selectedChurnCall.phoneNumber}</h4>
                  <button
                    onClick={() => setSelectedChurnCall(null)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    ✕ Close
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
                  className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-800 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">Call ID: {selectedChurnCall.call.call_id}</span>
                    <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs">
                      Churn: {selectedChurnCall.score?.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {selectedChurnCall.call.created_at ? new Date(selectedChurnCall.call.created_at).toLocaleString() : 'N/A'}
                  </p>
                  <p className="text-xs text-primary-400 mt-2">Click to view full call details →</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Pain Points and Churn Quotes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Pain Points from Churn Calls */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>🎯</span>
              Top Pain Points (Churn Calls)
            </h3>
            {churn.top_pain_points && churn.top_pain_points.length > 0 ? (
              <div className="space-y-3">
                {churn.top_pain_points.map((point, index) => (
                  <div 
                    key={index} 
                    onClick={() => {
                      // For churn section pain points, we need to filter by both pain_point AND churn threshold
                      // We'll pass both filters by using a combined approach
                      const threshold = churn.churn_threshold || 0.8;
                      openFilterModal('pain_point_churn', `${point.name}|${threshold}`, `Pain Point: ${point.name} (${point.count} calls) - Churn Section`);
                    }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-all"
                  >
                    <span className="text-gray-300">{point.name}</span>
                    <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-sm font-medium">
                      {point.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No pain points detected in churn calls</p>
            )}
          </div>

          {/* Top Churn Interest Quotes */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>💬</span>
              Top Churn Interest Quotes
            </h3>
            {churn.top_churn_quotes && churn.top_churn_quotes.length > 0 ? (
              <div className="space-y-4">
                {churn.top_churn_quotes.map((quote, index) => (
                  <div 
                    key={index} 
                    onClick={() => openFilterModal('call_id', quote.call_id, `Churn Quote: ${quote.phone_number}`, quote.call_id)}
                    className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-800/50 transition-all"
                  >
                    <p className="text-gray-300 text-sm mb-2 italic">"{quote.quote}"</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded ${
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
              <p className="text-gray-500 text-center py-8">No churn quotes available yet</p>
            )}
          </div>
        </div>
      </div>

      {/* ===== SECTION 3: REVENUE INTEREST SECTION ===== */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <span>💰</span>
          Revenue Interest Section
          <span className="text-sm font-normal text-gray-400 ml-2">
            (Threshold: {revenue.revenue_threshold || 0.8})
          </span>
        </h2>

        {/* Total Revenue Calls and User Segment Tab */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center gap-4">
            <div 
              onClick={() => openFilterModal('revenue_min_score', revenue.revenue_threshold || 0.8, `Revenue Interest Calls (${revenue.total_calls || 0})`)}
              className="bg-primary-500/10 border border-primary-500/30 rounded-xl p-6 cursor-pointer hover:bg-primary-500/20 transition-all flex-1"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Total Revenue Interest Calls</span>
                <span className="text-2xl">💰</span>
              </div>
              <p className="text-3xl font-bold text-primary-400">{revenue.total_calls || 0}</p>
              <p className="text-xs text-gray-400 mt-2">Click to view calls (ordered by revenue score descending)</p>
            </div>
            
            {/* Average Gym Rating for Revenue Calls */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Avg Gym Rating</span>
                <span className="text-2xl">⭐</span>
              </div>
              <p className="text-3xl font-bold text-white">
                {revenue.average_gym_rating !== null && revenue.average_gym_rating !== undefined 
                  ? revenue.average_gym_rating.toFixed(1)
                  : 'N/A'}
              </p>
              <p className="text-xs text-gray-400 mt-2">From revenue interest calls</p>
            </div>
          </div>
          
          {/* Top Revenue User Segment Tab */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl">
            <button
              onClick={async () => {
                if (!revenueUsers && !activeRevenueTab) {
                  try {
                    const threshold = revenue.revenue_threshold || 0.8;
                    const data = await callsAPI.getTopRevenueUsers(null, threshold, 100);
                    setRevenueUsers(data);
                  } catch (err) {
                    console.error('Failed to load revenue users:', err);
                  }
                }
                setActiveRevenueTab(!activeRevenueTab);
                setSelectedRevenueCall(null);
              }}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-700/50 transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">👥</span>
                <span className="text-lg font-semibold text-white">Top Revenue User Segment</span>
                <span className="text-xs text-gray-400">
                  ({revenueUsers?.total_count || 0} users)
                </span>
              </div>
              <span className="text-gray-400">{activeRevenueTab ? '▼' : '▶'}</span>
            </button>
            
            {activeRevenueTab && (
              <div className="border-t border-gray-700">
                {/* Call Button */}
                {revenueUsers && revenueUsers.phone_numbers && revenueUsers.phone_numbers.length > 0 && (
                  <div className="p-4 border-b border-gray-700">
                    <button
                      onClick={() => {
                        const phoneNumbers = revenueUsers.phone_numbers.map(u => u.phone_number).join('\n');
                        localStorage.setItem('initiateCalls_phoneNumbers', phoneNumbers);
                        setCurrentPage('initiate');
                      }}
                      className="w-full px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <span>📞</span>
                      <span>Call All {revenueUsers.phone_numbers.length} Numbers</span>
                    </button>
                    <p className="text-xs text-gray-400 mt-2 text-center">
                      Phone numbers will be copied to the initiate calls form
                    </p>
                  </div>
                )}
                
                <div className="p-4 max-h-96 overflow-y-auto">
                  {revenueUsers && revenueUsers.phone_numbers && revenueUsers.phone_numbers.length > 0 ? (
                    <div className="space-y-2">
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
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                          selectedRevenueCall?.phoneNumber === user.phone_number
                            ? 'bg-primary-500/20 border border-primary-500/30'
                            : 'bg-gray-900/50 border border-gray-700 hover:bg-gray-700/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-primary-400 font-medium">#{index + 1}</span>
                          <span className="text-white">{user.phone_number}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">
                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                          </span>
                          <span className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs font-medium">
                            Revenue: {user.revenue_interest_score?.toFixed(1) || 'N/A'}
                          </span>
                        </div>
                      </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No revenue users found</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Selected Phone Call Details */}
            {selectedRevenueCall && activeRevenueTab && (
              <div className="border-t border-gray-700 p-4 bg-gray-900/30">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">Latest Call for {selectedRevenueCall.phoneNumber}</h4>
                  <button
                    onClick={() => setSelectedRevenueCall(null)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    ✕ Close
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
                  className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-800 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">Call ID: {selectedRevenueCall.call.call_id}</span>
                    <span className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs">
                      Revenue: {selectedRevenueCall.score?.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {selectedRevenueCall.call.created_at ? new Date(selectedRevenueCall.call.created_at).toLocaleString() : 'N/A'}
                  </p>
                  <p className="text-xs text-primary-400 mt-2">Click to view full call details →</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Opportunities and Revenue Quotes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Opportunities from Revenue Calls */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>💰</span>
              Top Opportunities (Revenue Calls)
            </h3>
            {revenue.top_opportunities && revenue.top_opportunities.length > 0 ? (
              <div className="space-y-3">
                {revenue.top_opportunities.map((opportunity, index) => (
                  <div 
                    key={index} 
                    onClick={() => {
                      // For revenue section opportunities, we need to filter by both opportunity AND revenue threshold
                      const threshold = revenue.revenue_threshold || 0.8;
                      openFilterModal('opportunity_revenue', `${opportunity.name}|${threshold}`, `Opportunity: ${opportunity.name} (${opportunity.count} calls) - Revenue Section`);
                    }}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-all"
                  >
                    <span className="text-gray-300">{opportunity.name}</span>
                    <span className="px-3 py-1 bg-primary-500/20 text-primary-400 rounded-full text-sm font-medium">
                      {opportunity.count}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">No opportunities detected in revenue calls</p>
            )}
          </div>

          {/* Top Revenue Interest Quotes */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span>💬</span>
              Top Revenue Interest Quotes
            </h3>
            {revenue.top_revenue_quotes && revenue.top_revenue_quotes.length > 0 ? (
              <div className="space-y-4">
                {revenue.top_revenue_quotes.map((quote, index) => (
                  <div 
                    key={index} 
                    onClick={() => openFilterModal('call_id', quote.call_id, `Revenue Quote: ${quote.phone_number}`, quote.call_id)}
                    className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-800/50 transition-all"
                  >
                    <p className="text-gray-300 text-sm mb-2 italic">"{quote.quote}"</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs px-2 py-1 rounded ${
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
              <p className="text-gray-500 text-center py-8">No revenue quotes available yet</p>
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
