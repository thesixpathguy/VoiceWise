import { useState, useEffect, useRef } from 'react';

export default function LiveCalls() {
  // Mock data for live calls - will be replaced with real data later
  const [liveCalls] = useState([
    {
      id: 'call-1',
      phoneNumber: '+1 (555) 123-4567',
      agentName: 'Alex',
      customerName: 'Sarah',
      startTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      duration: '5:23',
      sentiment: 'positive',
      sentimentScore: 0.85,
      revenueScore: 0.92,
      churnScore: 0.15,
      aiConfidence: 0.88,
      conversation: [
        {
          speaker: 'agent',
          name: 'Alex',
          text: 'Hi Sarah! This is Alex calling from VoiceWise Gym. I wanted to check in and see how your experience has been so far.',
          timestamp: new Date(Date.now() - 5 * 60 * 1000)
        },
        {
          speaker: 'customer',
          name: 'Sarah',
          text: 'Oh hi! Yeah, it\'s been pretty good actually. The equipment is nice and the trainers are helpful.',
          timestamp: new Date(Date.now() - 4 * 45 * 1000)
        },
        {
          speaker: 'agent',
          name: 'Alex',
          text: 'That\'s great to hear! On a scale of 1 to 10, how would you rate your overall experience?',
          timestamp: new Date(Date.now() - 4 * 30 * 1000)
        },
        {
          speaker: 'customer',
          name: 'Sarah',
          text: 'I\'d say about an 8. The only thing is it gets really crowded during peak hours. But I\'ve been thinking about trying personal training to help me reach my goals faster.',
          timestamp: new Date(Date.now() - 3 * 50 * 1000)
        },
        {
          speaker: 'agent',
          name: 'Alex',
          text: 'That\'s wonderful feedback! I can definitely help you learn more about our personal training programs. What specific goals are you looking to achieve?',
          timestamp: new Date(Date.now() - 3 * 30 * 1000)
        },
        {
          speaker: 'customer',
          name: 'Sarah',
          text: 'I really want to build more strength and maybe lose a bit of weight. I\'ve heard great things about your trainers.',
          timestamp: new Date(Date.now() - 2 * 45 * 1000)
        }
      ]
    },
    {
      id: 'call-2',
      phoneNumber: '+1 (555) 987-6543',
      agentName: 'Alex',
      customerName: 'Mike',
      startTime: new Date(Date.now() - 12 * 60 * 1000), // 12 minutes ago
      duration: '12:45',
      sentiment: 'neutral',
      sentimentScore: 0.55,
      revenueScore: 0.35,
      churnScore: 0.85,
      aiConfidence: 0.82,
      conversation: [
        {
          speaker: 'agent',
          name: 'Alex',
          text: 'Hi Mike! This is Alex from VoiceWise Gym. How has your membership been going?',
          timestamp: new Date(Date.now() - 12 * 60 * 1000)
        },
        {
          speaker: 'customer',
          name: 'Mike',
          text: 'Honestly, I haven\'t been going as much as I should. It\'s been hard to find the motivation lately.',
          timestamp: new Date(Date.now() - 11 * 30 * 1000)
        },
        {
          speaker: 'agent',
          name: 'Alex',
          text: 'I understand. What would make it easier for you to come in more regularly?',
          timestamp: new Date(Date.now() - 11 * 10 * 1000)
        },
        {
          speaker: 'customer',
          name: 'Mike',
          text: 'I\'m not sure. Maybe if the hours were better, or if there were more classes that fit my schedule. I\'ve been thinking about canceling actually.',
          timestamp: new Date(Date.now() - 10 * 20 * 1000)
        },
        {
          speaker: 'agent',
          name: 'Alex',
          text: 'I\'d hate to see you go, Mike. Let me see what we can do to help make this work better for you. What times work best for your schedule?',
          timestamp: new Date(Date.now() - 9 * 50 * 1000)
        }
      ]
    },
    {
      id: 'call-3',
      phoneNumber: '+1 (555) 456-7890',
      agentName: 'Alex',
      customerName: 'Emily',
      startTime: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
      duration: '2:15',
      sentiment: 'positive',
      sentimentScore: 0.92,
      revenueScore: 0.78,
      churnScore: 0.10,
      aiConfidence: 0.91,
      conversation: [
        {
          speaker: 'agent',
          name: 'Alex',
          text: 'Hi Emily! This is Alex calling from VoiceWise Gym. I wanted to follow up on your recent visit.',
          timestamp: new Date(Date.now() - 2 * 60 * 1000)
        },
        {
          speaker: 'customer',
          name: 'Emily',
          text: 'Hi Alex! I had such a great time. The new yoga class was amazing!',
          timestamp: new Date(Date.now() - 1 * 45 * 1000)
        },
        {
          speaker: 'agent',
          name: 'Alex',
          text: 'That\'s fantastic! I\'m so glad you enjoyed it. Are you interested in trying any of our other classes?',
          timestamp: new Date(Date.now() - 1 * 30 * 1000)
        },
        {
          speaker: 'customer',
          name: 'Emily',
          text: 'Yes! I\'d love to try the pilates class. When is the next one?',
          timestamp: new Date(Date.now() - 1 * 10 * 1000)
        }
      ]
    }
  ]);

  const [activeTab, setActiveTab] = useState(liveCalls[0]?.id || null);
  const [conversations, setConversations] = useState(
    liveCalls.reduce((acc, call) => {
      acc[call.id] = call.conversation || [];
      return acc;
    }, {})
  );
  const messagesEndRefs = useRef({});

  const handleTabClick = (callId) => {
    setActiveTab(callId);
  };

  // Auto-scroll to bottom when conversation updates
  useEffect(() => {
    if (activeTab && messagesEndRefs.current[activeTab]) {
      messagesEndRefs.current[activeTab]?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversations, activeTab]);

  // Simulate live updates for active call
  useEffect(() => {
    if (!activeTab) return;

    const interval = setInterval(() => {
      const currentCall = liveCalls.find(c => c.id === activeTab);
      if (currentCall && Math.random() > 0.7 && conversations[activeTab]?.length < 15) {
        const newMessage = {
          speaker: Math.random() > 0.5 ? 'agent' : 'customer',
          name: Math.random() > 0.5 ? currentCall.agentName : currentCall.customerName,
          text: Math.random() > 0.5 
            ? 'That sounds great! Let me help you with that.'
            : 'I appreciate your help with this.',
          timestamp: new Date()
        };
        setConversations(prev => ({
          ...prev,
          [activeTab]: [...(prev[activeTab] || []), newMessage]
        }));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTab, conversations, liveCalls]);

  const formatTime = (date) => {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  };

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
      {liveCalls.length === 0 ? (
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
                        {call.churnScore >= 0.8 && (
                          <>
                            <span className="text-gray-500">•</span>
                            <span className="text-orange-400 text-xs">⚠️ {call.churnScore.toFixed(1)}</span>
                          </>
                        )}
                        {call.revenueScore >= 0.8 && (
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
                      {activeCall.revenueScore >= 0.8 && (
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
                      {activeCall.churnScore >= 0.8 && (
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

