import { useState, useEffect, useRef } from 'react';
import audioService from '../services/audioService';
import { callsAPI } from '../api/api';

export default function LiveCallModal({ call, isOpen, onClose }) {
  const [conversation, setConversation] = useState(call?.conversation || []);
  const [audioStatus, setAudioStatus] = useState('idle'); // idle, connecting, playing, stopped, error
  const [audioError, setAudioError] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  // Simulate live updates (in real implementation, this would come from WebSocket/SSE)
  useEffect(() => {
    if (!isOpen) return;

    // This is just for demo - in real app, messages would come from WebSocket
    const interval = setInterval(() => {
      // Simulate occasional new messages
      if (Math.random() > 0.7 && conversation.length < 10) {
        const newMessage = {
          speaker: Math.random() > 0.5 ? 'agent' : 'customer',
          name: Math.random() > 0.5 ? call.agentName : call.customerName,
          text: Math.random() > 0.5 
            ? 'That sounds great! Let me help you with that.'
            : 'I appreciate your help with this.',
          timestamp: new Date()
        };
        setConversation(prev => [...prev, newMessage]);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isOpen, conversation.length, call]);

  // Cleanup audio on modal close
  useEffect(() => {
    if (!isOpen) {
      stopAudio();
    }
  }, [isOpen]);

  const handlePlayAudio = async () => {
    try {
      setAudioError(null);
      setAudioStatus('connecting');
      setIsPlayingAudio(true);

      // Get Bland AI API key from environment or local storage
      // For POC: You'll need to set this in your .env file as VITE_BLAND_AI_API_KEY
      const blandApiKey = import.meta.env.VITE_BLAND_AI_API_KEY || 
                         localStorage.getItem('bland_api_key');

      if (!blandApiKey) {
        throw new Error('Bland AI API key not configured. Please set VITE_BLAND_AI_API_KEY in .env');
      }

      if (!call.call_id) {
        throw new Error('Call ID not available');
      }

      // Get the WebSocket URL from Bland AI
      const listenResponse = await callsAPI.getLiveCallAudio(call.call_id, blandApiKey);
      const wsUrl = listenResponse?.data?.url;

      if (!wsUrl) {
        throw new Error('No WebSocket URL received from Bland AI');
      }

      // Start audio playback
      await audioService.startAudioPlayback(
        wsUrl,
        (status) => setAudioStatus(status),
        (error) => {
          setAudioError(error);
          setIsPlayingAudio(false);
          setAudioStatus('error');
        }
      );
    } catch (error) {
      console.error('Error playing audio:', error);
      setAudioError(error.message);
      setAudioStatus('error');
      setIsPlayingAudio(false);
    }
  };

  const stopAudio = () => {
    audioService.stopAudioPlayback();
    setIsPlayingAudio(false);
    setAudioStatus('idle');
    setAudioError(null);
  };

  if (!isOpen || !call) return null;

  const formatTime = (date) => {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s ago`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m ago`;
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col m-auto shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-700 p-6 bg-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center">
                  <span className="text-2xl">📞</span>
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-gray-900"></div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  Live Call
                  <span className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400 font-medium">
                    LIVE
                  </span>
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {call.customerName} • {call.phoneNumber} • {call.duration}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Audio Player Button - Enhanced */}
              {!isPlayingAudio ? (
                <button
                  onClick={handlePlayAudio}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-500/40 border-2 border-primary-500/70 rounded-lg hover:bg-primary-500/50 transition-all text-primary-200 text-sm font-semibold shadow-lg shadow-primary-500/20"
                  title="Play live audio from Bland AI"
                >
                  <span className="text-xl">🔊</span>
                  <span>Play Audio</span>
                </button>
              ) : (
                <button
                  onClick={stopAudio}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/40 border-2 border-red-500/70 rounded-lg hover:bg-red-500/50 transition-all text-red-200 text-sm font-semibold shadow-lg shadow-red-500/20"
                  title="Stop audio"
                >
                  <span className="text-xl">⏹️</span>
                  <span>Stop</span>
                </button>
              )}
              
              {/* Status Indicator */}
              {isPlayingAudio && (
                <div className="flex items-center gap-1 text-xs text-gray-300">
                  <div className="flex gap-0.5">
                    <div className="w-1 h-2 bg-primary-400 rounded-full animate-pulse"></div>
                    <div className="w-1 h-3 bg-primary-400 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-1 h-2 bg-primary-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="ml-1">
                    {audioStatus === 'connecting' ? 'Connecting...' : 'Playing'}
                  </span>
                </div>
              )}

              {/* Error Display */}
              {audioError && (
                <div className="flex items-center gap-1 text-xs text-red-300 bg-red-500/10 px-3 py-1 rounded-lg">
                  <span>⚠️</span>
                  <span>{audioError}</span>
                </div>
              )}
              
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors text-2xl w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-800"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">Sentiment</p>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${getSentimentColor(call.sentiment)}`}>
                  {call.sentiment}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getSentimentBg(call.sentiment)} ${getSentimentColor(call.sentiment)}`}>
                  {call.sentimentScore.toFixed(2)}
                </span>
              </div>
            </div>

            {call.revenueScore >= 0.8 && (
              <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1">Revenue Score</p>
                <p className="text-primary-400 text-lg font-bold flex items-center gap-1">
                  💰 {call.revenueScore.toFixed(2)}
                </p>
              </div>
            )}

            {call.churnScore >= 0.8 && (
              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <p className="text-gray-400 text-xs mb-1">Churn Score</p>
                <p className="text-orange-400 text-lg font-bold flex items-center gap-1">
                  ⚠️ {call.churnScore.toFixed(2)}
                </p>
              </div>
            )}

            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-3">
              <p className="text-gray-400 text-xs mb-1">AI Confidence</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all"
                    style={{ width: `${call.aiConfidence * 100}%` }}
                  ></div>
                </div>
                <span className="text-white text-xs font-medium">
                  {(call.aiConfidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Conversation Panel */}
          <div className="flex-1 overflow-y-auto p-6 border-r border-gray-700">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>💬</span>
                Conversation
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-400">Live</span>
              </div>
            </div>

            <div className="space-y-4">
              {conversation.map((msg, idx) => (
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
                        {msg.name} {msg.speaker === 'agent' ? '(Agent)' : '(Customer)'}
                      </p>
                      <p className={`text-sm leading-relaxed ${
                        msg.speaker === 'agent' ? 'text-gray-200' : 'text-white'
                      }`}>
                        {msg.text}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Analytics Panel */}
          <div className="w-full md:w-80 bg-gray-800/30 p-6 overflow-y-auto border-t md:border-t-0 md:border-l border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span>📊</span>
              AI Analytics
            </h3>

            <div className="space-y-4">
              {/* Sentiment Analysis */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <span>😊</span>
                  Sentiment Analysis
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Sentiment:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSentimentBg(call.sentiment)} ${getSentimentColor(call.sentiment)}`}>
                      {call.sentiment.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Score:</span>
                    <span className="text-white text-sm font-medium">
                      {call.sentimentScore.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-2 bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        call.sentiment === 'positive' ? 'bg-green-500' :
                        call.sentiment === 'negative' ? 'bg-red-500' :
                        'bg-gray-500'
                      }`}
                      style={{ width: `${call.sentimentScore * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Revenue Score */}
              {call.revenueScore >= 0.8 && (
                <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-primary-400 mb-3 flex items-center gap-2">
                    <span>💰</span>
                    Revenue Interest
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">Score:</span>
                      <span className="text-primary-400 text-lg font-bold">
                        {call.revenueScore.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-primary-500 transition-all"
                        style={{ width: `${call.revenueScore * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      High interest detected in additional services or upgrades
                    </p>
                  </div>
                </div>
              )}

              {/* Churn Score */}
              {call.churnScore >= 0.8 && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-orange-400 mb-3 flex items-center gap-2">
                    <span>⚠️</span>
                    Churn Risk
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-xs">Score:</span>
                      <span className="text-orange-400 text-lg font-bold">
                        {call.churnScore.toFixed(2)}
                      </span>
                    </div>
                    <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-orange-500 transition-all"
                        style={{ width: `${call.churnScore * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      High risk of customer cancellation detected
                    </p>
                  </div>
                </div>
              )}

              {/* AI Confidence */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <span>🎯</span>
                  AI Confidence
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Confidence:</span>
                    <span className="text-white text-sm font-medium">
                      {(call.aiConfidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary-500 transition-all"
                      style={{ width: `${call.aiConfidence * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Confidence level of AI analysis accuracy
                  </p>
                </div>
              </div>

              {/* Call Info */}
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <span>ℹ️</span>
                  Call Information
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Duration:</span>
                    <span className="text-white">{call.duration}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Agent:</span>
                    <span className="text-white">{call.agentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Customer:</span>
                    <span className="text-white">{call.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Phone:</span>
                    <span className="text-white">{call.phoneNumber}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4 bg-gray-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

