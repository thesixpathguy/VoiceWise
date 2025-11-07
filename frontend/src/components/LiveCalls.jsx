import { useState, useEffect, useRef, useCallback } from 'react';
import { callsAPI } from '../api/api';
import audioService from '../services/audioService';

export default function LiveCalls() {
  const [liveCalls, setLiveCalls] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [conversations, setConversations] = useState({});
  const [loading, setLoading] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioStatus, setAudioStatus] = useState('idle');
  const messagesEndRefs = useRef({});
  const activeTabRef = useRef(null);
  
  // Retry tracking
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef(null);
  
  // Track which calls disappeared between polls
  const previousCallIdsRef = useRef(new Set());

  // Keep activeTabRef in sync with activeTab state
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Transform API response to component format
  const transformLiveCall = (apiCall) => {
    // Generate a unique ID from phone number and timestamp
    const callId = `${apiCall.phone_number}_${apiCall.call_initiated_timestamp}`;
    
    // Calculate duration from timestamp (will be recalculated on each poll)
    const startTime = new Date(apiCall.call_initiated_timestamp);
    const now = new Date();
    const durationSeconds = Math.floor((now - startTime) / 1000);
    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Transform conversation turns from API format (USER/AGENT) to component format (customer/agent)
    const conversation = (apiCall.conversation || []).map((turn, idx) => {
      const speaker = turn.speaker_type === 'USER' ? 'customer' : 'agent';
      return {
        speaker: speaker,
        name: speaker === 'agent' ? 'Agent' : 'Customer',
        text: turn.speech,
        timestamp: new Date(startTime.getTime() + idx * 1000) // Approximate timestamp
      };
    });
    
    return {
      id: callId,
      blandCallId: apiCall.call_id, // Preserve the actual Bland AI call ID
      apiKeyIndex: apiCall.api_key_index !== undefined ? apiCall.api_key_index : 0, // NEW: Track which API key was used (0 or 1)
      phoneNumber: apiCall.phone_number,
      startTime: startTime,
      duration: duration,
      sentiment: apiCall.sentiment || 'neutral', // Default to neutral if null
      churnScore: apiCall.churn_score !== null && apiCall.churn_score !== undefined ? apiCall.churn_score : null,
      revenueScore: apiCall.revenue_interest_score !== null && apiCall.revenue_interest_score !== undefined ? apiCall.revenue_interest_score : null,
      aiConfidence: apiCall.confidence !== null && apiCall.confidence !== undefined ? apiCall.confidence : 0.5, // Default to 50% if null
      conversation: conversation
    };
  };

  // Fetch live calls from API with exponential backoff retry
  const fetchLiveCalls = useCallback(async () => {
    try {
      const apiCalls = await callsAPI.getLiveCalls();
      
      if (!apiCalls || apiCalls.length === 0) {
        console.log('📞 No live calls from API');
        setLiveCalls([]);
        setActiveTab(null);
        setConversations({});
        setLoading(false);
        // Reset retry count on successful fetch
        if (retryCount > 0) {
          setRetryCount(0);
        }
        return;
      }
      
      console.log(`📞 Got ${apiCalls.length} live calls from API`);
      
      // Transform API calls to component format
      const transformedCalls = apiCalls.map(transformLiveCall);
      
      // Sort calls by start time (newest first) for stable ordering
      const sortedCalls = transformedCalls.sort((a, b) => 
        b.startTime.getTime() - a.startTime.getTime()
      );
      
      // Identify calls that were in state but are no longer in API response
      const currentCallIds = new Set(sortedCalls.map(c => c.id));
      const disappearedCallIds = [...previousCallIdsRef.current].filter(id => !currentCallIds.has(id));
      
      // Log calls that disappeared
      if (disappearedCallIds.length > 0) {
        disappearedCallIds.forEach(id => {
          console.log(`📴 Call ${id} disappeared from API response (call ended)`);
        });
      }
      
      // Update ref with current call IDs for next poll
      previousCallIdsRef.current = currentCallIds;
      
      // Remove conversations for calls that are gone
      if (activeTabRef.current && !currentCallIds.has(activeTabRef.current)) {
        console.log(`❌ Active call ${activeTabRef.current} is no longer available`);
      }
      
      // Update conversations state - keep only conversations for calls that still exist
      const newConversations = {};
      sortedCalls.forEach(call => {
        newConversations[call.id] = call.conversation || [];
      });
      
      setConversations(newConversations);
      
      // Update live calls with sorted order
      setLiveCalls(sortedCalls);
      
      // Always set first call as active if available and no active tab is set
      if (sortedCalls.length > 0 && !activeTabRef.current) {
        setActiveTab(sortedCalls[0].id);
      }
      
      // If active tab no longer exists, set first call as active
      if (activeTabRef.current && !sortedCalls.find(c => c.id === activeTabRef.current)) {
        setActiveTab(sortedCalls[0]?.id || null);
      }
      
      setLoading(false);
      // Reset retry count on successful fetch
      if (retryCount > 0) {
        setRetryCount(0);
        console.log('✅ API recovered - retry count reset');
      }
    } catch (error) {
      console.error('Failed to fetch live calls:', error);
      setLoading(false);
      
      // Implement exponential backoff retry strategy
      const maxRetries = 3; // Max 3 retries (2s, 4s, 8s)
      const baseDelay = 2000; // Start with 2 seconds
      const newRetryCount = retryCount + 1;
      
      if (newRetryCount <= maxRetries) {
        // Calculate delay with exponential backoff: 2s, 4s, 8s, 16s, 32s
        const delay = baseDelay * Math.pow(2, Math.min(newRetryCount - 1, 3));
        const delaySeconds = Math.round(delay / 1000);
        
        console.warn(
          `⚠️ API Error: Retry ${newRetryCount}/${maxRetries} in ${delaySeconds}s...`,
          error.message
        );
        
        setRetryCount(newRetryCount);
        
        // Clear any pending retry timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        
        // Schedule retry with exponential backoff
        retryTimeoutRef.current = setTimeout(() => {
          console.log(`🔄 Retrying API call (attempt ${newRetryCount}/${maxRetries})...`);
          fetchLiveCalls();
        }, delay);
      } else {
        console.error('❌ Max retries exceeded. Clearing ONLY failed calls.');
        
        // On max retries, we can't determine which calls are still live
        // Clear all state to be safe - but log this clearly
        console.warn('ℹ️ Unable to verify call status after retries - clearing to prevent stale data');
        setLiveCalls([]);
        setActiveTab(null);
        setConversations({});
        setRetryCount(0); // Reset for next batch
      }
    }
  }, [retryCount]);

  // Poll API every 2 seconds (when no retries are pending)
  useEffect(() => {
    // Initial fetch
    fetchLiveCalls();
    
    // Only set up polling if we're not in a retry backoff state
    if (retryCount === 0) {
      const interval = setInterval(() => {
        fetchLiveCalls();
      }, 2000); // Poll every 2 seconds
      
      return () => clearInterval(interval);
    }
    
    // Cleanup on unmount or when retry count changes
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [fetchLiveCalls, retryCount]);

  // Don't update activeTab on liveCalls change - keep user's selection
  // activeTab should only change if the selected call ends

  const handleTabClick = (callId) => {
    setActiveTab(callId);
    stopAudio(); // Stop audio when switching calls
  };

  const handlePlayAudio = async () => {
    try {
      setAudioStatus('connecting');
      setIsPlayingAudio(true);

      const activeCall = liveCalls.find(c => c.id === activeTab);
      if (!activeCall) {
        throw new Error('No active call selected');
      }

      // Get API keys from env and select by index
      const apiKeysStr = import.meta.env.VITE_BLAND_AI_API_KEYS;
      const apiKeys = apiKeysStr.split(',').map(key => key.trim());
      const blandApiKey = apiKeys[activeCall.apiKeyIndex] || apiKeys[0];

      if (!blandApiKey) {
        throw new Error('Bland AI API key not configured');
      }

      // Use the actual Bland AI call_id
      const blandCallId = activeCall.blandCallId;
      if (!blandCallId) {
        throw new Error('Call ID not available from Bland AI');
      }

      console.log(`[Audio] Using API key index ${activeCall.apiKeyIndex} for call:`, blandCallId);

      const listenResponse = await callsAPI.getLiveCallAudio(blandCallId, blandApiKey);
      const wsUrl = listenResponse?.data?.url;

      if (!wsUrl) {
        throw new Error('No WebSocket URL received from Bland AI');
      }

      console.log('[Audio] Got WebSocket URL, starting playback');

      await audioService.startAudioPlayback(
        wsUrl,
        (status) => setAudioStatus(status),
        (error) => {
          console.error('[Audio] Playback error:', error);
          setIsPlayingAudio(false);
          setAudioStatus('error');
        }
      );
    } catch (error) {
      console.error('Error playing audio:', error);
      setAudioStatus('error');
      setIsPlayingAudio(false);
    }
  };

  const stopAudio = () => {
    audioService.stopAudioPlayback();
    setIsPlayingAudio(false);
    setAudioStatus('idle');
  };

  // Auto-scroll to bottom when conversation updates
  useEffect(() => {
    if (activeTab && messagesEndRefs.current[activeTab]) {
      messagesEndRefs.current[activeTab]?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversations, activeTab]);

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-400';
      case 'negative':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getSentimentBg = (sentiment) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-500/20 border-green-500/30';
      case 'negative':
        return 'bg-red-500/20 border-red-500/30';
      default:
        return 'bg-gray-500/20 border-gray-500/30';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <span className="relative">
                <span className="text-4xl">📞</span>
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-gray-900"></span>
              </span>
              Live Calls
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-400 font-medium text-sm">
                {liveCalls.length} Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Live Calls Layout */}
      {loading && liveCalls.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
          <span className="text-6xl mb-4 block animate-pulse">📞</span>
          <p className="text-gray-400 text-lg">Loading live calls...</p>
        </div>
      ) : liveCalls.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
          <span className="text-6xl mb-4 block">📞</span>
          <p className="text-gray-400 text-lg">No active calls</p>
          <p className="text-gray-500 text-sm mt-2">Live calls will appear here when they start</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Left Side - Live Calls List */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>📞</span>
                Active Calls ({liveCalls.length})
              </h3>
              <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto">
                {liveCalls.map((call) => (
                  <button
                    key={call.id}
                    onClick={() => handleTabClick(call.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${
                      activeTab === call.id
                        ? 'bg-primary-500/20 border-2 border-primary-500/50 shadow-lg shadow-primary-500/10'
                        : 'bg-gray-900/50 border-2 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {/* Live Indicator */}
                    <div className="relative flex-shrink-0">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75"></div>
                    </div>
                    
                    {/* Call Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium text-sm truncate">{call.phoneNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${getSentimentBg(call.sentiment)} ${getSentimentColor(call.sentiment)}`}>
                          {call.sentiment}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs">{call.duration}</span>
                        {call.churnScore !== null && call.churnScore >= 0.8 && (
                          <>
                            <span className="text-gray-500">•</span>
                            <span className="text-orange-400 text-xs">⚠️ {call.churnScore.toFixed(1)}</span>
                          </>
                        )}
                        {call.revenueScore !== null && call.revenueScore >= 0.8 && (
                          <>
                            <span className="text-gray-500">•</span>
                            <span className="text-primary-400 text-xs">💰 {call.revenueScore.toFixed(1)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - Selected Call Details */}
          {activeTab && (() => {
            const activeCall = liveCalls.find(c => c.id === activeTab);
            if (!activeCall) return null;
            const activeConversation = conversations[activeTab] || [];

            return (
              <div className="flex-1 flex flex-col min-w-0">
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden flex flex-col h-full">
                  {/* Audio Player Section - Prominent */}
                  <div className="border-b border-gray-700 p-4 bg-gradient-to-r from-primary-500/10 to-primary-500/5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">🔊</span>
                        <div>
                          <h4 className="text-sm font-semibold text-white">Listen to Call</h4>
                          <p className="text-xs text-gray-400 mt-0.5">Stream live audio from Bland AI</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isPlayingAudio ? (
                          <button
                            onClick={handlePlayAudio}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-500/30 border border-primary-500/50 rounded-lg hover:bg-primary-500/40 transition-colors text-primary-300 font-medium"
                            title="Play live audio"
                          >
                            <span>▶️</span>
                            <span>Play Audio</span>
                          </button>
                        ) : (
                          <button
                            onClick={stopAudio}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/30 border border-red-500/50 rounded-lg hover:bg-red-500/40 transition-colors text-red-300 font-medium"
                            title="Stop audio"
                          >
                            <span>⏹️</span>
                            <span>Stop</span>
                          </button>
                        )}
                        
                        {/* Status Indicator */}
                        {isPlayingAudio && (
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <div className="flex gap-0.5">
                              <div className="w-1 h-2 bg-primary-500 rounded-full animate-pulse"></div>
                              <div className="w-1 h-3 bg-primary-500 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                              <div className="w-1 h-2 bg-primary-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                            </div>
                            <span>
                              {audioStatus === 'connecting' ? 'Connecting...' : audioStatus === 'playing' ? 'Playing' : audioStatus}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* AI Analytics Section - Top */}
                  <div className="border-b border-gray-700 p-4 bg-gray-800/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Sentiment Analysis */}
                      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                          <span>😊</span>
                          Sentiment
                        </h4>
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSentimentBg(activeCall.sentiment)} ${getSentimentColor(activeCall.sentiment)}`}>
                            {activeCall.sentiment.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Revenue Score */}
                      {activeCall.revenueScore !== null && activeCall.revenueScore >= 0.8 && (
                        <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3">
                          <h4 className="text-xs font-semibold text-primary-400 mb-2 flex items-center gap-2">
                            <span>💰</span>
                            Revenue Interest
                          </h4>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-primary-400 text-base font-bold">
                                {activeCall.revenueScore.toFixed(2)}
                              </span>
                            </div>
                            <div className="bg-gray-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full bg-primary-500 transition-all"
                                style={{ width: `${activeCall.revenueScore * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Churn Score */}
                      {activeCall.churnScore !== null && activeCall.churnScore >= 0.8 && (
                        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                          <h4 className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-2">
                            <span>⚠️</span>
                            Churn Risk
                          </h4>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-orange-400 text-base font-bold">
                                {activeCall.churnScore.toFixed(2)}
                              </span>
                            </div>
                            <div className="bg-gray-800 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-full bg-orange-500 transition-all"
                                style={{ width: `${activeCall.churnScore * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* AI Confidence */}
                      <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                          <span>🎯</span>
                          AI Confidence
                        </h4>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-white text-sm font-medium">
                              {(activeCall.aiConfidence * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="bg-gray-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-primary-500 transition-all"
                              style={{ width: `${activeCall.aiConfidence * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Conversation Panel - Bottom */}
                  <div className="overflow-y-auto p-4" style={{ maxHeight: '450px' }}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <span>💬</span>
                        Conversation
                      </h3>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-gray-400">Live</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {activeConversation.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-3 ${
                            msg.speaker === 'agent' ? 'flex-row' : 'flex-row-reverse'
                          }`}
                        >
                          {/* Avatar */}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            msg.speaker === 'agent'
                              ? 'bg-primary-500/20 border border-primary-500/30'
                              : 'bg-green-500/20 border border-green-500/30'
                          }`}>
                            <span className="text-lg">
                              {msg.speaker === 'agent' ? '🤖' : '👤'}
                            </span>
                          </div>

                          {/* Message Content */}
                          <div className={`flex-1 ${
                            msg.speaker === 'customer' ? 'text-right' : ''
                          }`}>
                            <div className={`inline-block max-w-[80%] rounded-lg p-3 ${
                              msg.speaker === 'agent'
                                ? 'bg-gray-800/50 border border-gray-700'
                                : 'bg-primary-500/20 border border-primary-500/30'
                            }`}>
                              <p className="text-xs text-gray-400 mb-1 font-medium">
                                {msg.speaker === 'agent' ? 'Agent' : 'Customer'}
                              </p>
                              <p className={`text-sm leading-relaxed ${
                                msg.speaker === 'agent' ? 'text-gray-200' : 'text-white'
                              }`}>
                                {msg.text}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={el => messagesEndRefs.current[activeTab] = el} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
}

