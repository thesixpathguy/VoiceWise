import { useState } from 'react'
import './App.css'
import Dashboard from './components/Dashboard'
import CallsList from './components/CallsList'
import InitiateCalls from './components/InitiateCalls'
import SearchPage from './components/SearchPage'

function App() {
  const [currentPage, setCurrentPage] = useState('home')

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard setCurrentPage={setCurrentPage} />
      case 'calls':
        return <CallsList />
      case 'initiate':
        return <InitiateCalls />
      case 'search':
        return <SearchPage setCurrentPage={setCurrentPage} />
      default:
        return <HomePage setCurrentPage={setCurrentPage} />
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="border-b-2 border-primary-500/20">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center gap-4 cursor-pointer"
              onClick={() => setCurrentPage('home')}
            >
              <span className="text-4xl">🎙️</span>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
                VoiceWise
              </h1>
            </div>
            
            {/* Navigation */}
            <nav className="flex items-center gap-4">
              <button
                onClick={() => setCurrentPage('home')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'home'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => setCurrentPage('dashboard')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'dashboard'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentPage('calls')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'calls'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                Calls
              </button>
              <button
                onClick={() => setCurrentPage('initiate')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'initiate'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                Initiate
              </button>
              <button
                onClick={() => setCurrentPage('search')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'search'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                Search
              </button>
            </nav>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-1">
        {renderPage()}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© 2025 VoiceWise - AI Voice Feedback Analysis</p>
        </div>
      </footer>
    </div>
  )
}

function HomePage({ setCurrentPage }) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-500/10 border border-primary-500/30 mb-6">
          <span className="text-4xl">🎙️</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          VoiceWise
        </h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-2">
          AI-Powered Voice Feedback System
        </p>
        <p className="text-gray-400 max-w-2xl mx-auto mb-8">
          Automate member feedback calls and transform responses into actionable insights
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setCurrentPage('initiate')}
            className="px-8 py-3 bg-primary-500 hover:bg-primary-600 rounded-lg font-medium text-lg transition-all hover:shadow-lg hover:shadow-primary-500/20"
          >
            🚀 Start Calling Members
          </button>
          <button
            onClick={() => setCurrentPage('dashboard')}
            className="px-8 py-3 bg-gray-800/50 border border-gray-700 hover:bg-gray-800 rounded-lg font-medium text-lg transition-all text-white"
          >
            📊 View Dashboard
          </button>
        </div>
      </div>

      {/* Features Grid - Matching Dashboard Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Automated Calls */}
        <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <span className="text-2xl">📞</span>
            </div>
            <h3 className="text-lg font-semibold text-primary-400">
              Automated Calls
            </h3>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            AI agent calls your members to gather genuine feedback through natural conversations
          </p>
        </div>

        {/* AI Analysis */}
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-lg font-semibold text-purple-400">
              AI Analysis
            </h3>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Automatic transcription and sentiment analysis with advanced AI insights
          </p>
        </div>

        {/* Actionable Insights */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
              <span className="text-2xl">💡</span>
            </div>
            <h3 className="text-lg font-semibold text-green-400">
              Actionable Insights
            </h3>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Identify pain points, opportunities, and churn risks automatically
          </p>
        </div>

        {/* Analytics Dashboard */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <h3 className="text-lg font-semibold text-orange-400">
              Analytics Dashboard
            </h3>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Track member satisfaction, retention metrics, and revenue opportunities
          </p>
        </div>
      </div>

      {/* Sample Conversation Flow - Story */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-white mb-6 text-center">How It Works</h2>
        
        {/* Story Flow */}
        <div className="space-y-8">
          {/* Step 1: Call Conversation */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                <span className="text-xl">1</span>
              </div>
              <h3 className="text-lg font-semibold text-white">AI Agent Calls Member</h3>
            </div>
            
            {/* Sample Conversation */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">🤖</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1">Alex (AI Agent)</p>
                  <p className="text-gray-300 text-sm">Hi Sarah! This is Alex calling from VoiceWise Gym. I wanted to check in and see how your experience has been so far.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">👤</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1">Sarah (Member)</p>
                  <p className="text-gray-300 text-sm">Oh hi! Yeah, it's been pretty good actually. The equipment is nice and the trainers are helpful.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">🤖</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1">Alex (AI Agent)</p>
                  <p className="text-gray-300 text-sm">That's great to hear! On a scale of 1 to 10, how would you rate your overall experience?</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">👤</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1">Sarah (Member)</p>
                  <p className="text-gray-300 text-sm">I'd say about an 8. The only thing is it gets really crowded during peak hours. But I've been thinking about trying personal training to help me reach my goals faster.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">🤖</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1">Alex (AI Agent)</p>
                  <p className="text-gray-300 text-sm">That's wonderful feedback! I can definitely help you learn more about our personal training programs. Thank you so much for your time, Sarah!</p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: AI Processing */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <span className="text-xl">2</span>
              </div>
              <h3 className="text-lg font-semibold text-white">AI Extracts Insights</h3>
            </div>
            
            {/* Extraction Results */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <span>📊</span> Sentiment Analysis
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Sentiment:</span>
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">Positive</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Gym Rating:</span>
                    <span className="text-white font-semibold">8 / 10</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Confidence:</span>
                    <span className="text-white">0.92</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-orange-400 mb-3 flex items-center gap-2">
                  <span>⚠️</span> Risk Analysis
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Churn Risk:</span>
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">Low (0.2)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Pain Points:</span>
                    <span className="text-white text-xs">Crowded during peak hours</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-primary-400 mb-3 flex items-center gap-2">
                  <span>💰</span> Revenue Opportunity
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Interest Score:</span>
                    <span className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs font-medium">High (0.8)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 text-xs">Quote:</span>
                    <span className="text-white text-xs italic flex-1">"I've been thinking about trying personal training to help me reach my goals faster"</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <span>💡</span> Topics Identified
                </h4>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs">Equipment Quality</span>
                  <span className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs">Staff Satisfaction</span>
                  <span className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs">Personal Training</span>
                  <span className="px-2 py-1 bg-primary-500/20 text-primary-400 rounded text-xs">Crowding Issues</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3: Dashboard Display */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <span className="text-xl">3</span>
              </div>
              <h3 className="text-lg font-semibold text-white">Insights Appear in Dashboard</h3>
            </div>
            
            {/* Sample Dashboard Preview */}
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                  <p className="text-gray-400 text-xs mb-1">Sentiment</p>
                  <p className="text-green-400 font-bold">Positive</p>
                </div>
                <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-3 text-center">
                  <p className="text-gray-400 text-xs mb-1">Revenue Interest</p>
                  <p className="text-primary-400 font-bold">0.8</p>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-center">
                  <p className="text-gray-400 text-xs mb-1">Churn Risk</p>
                  <p className="text-orange-400 font-bold">0.2</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-2">💡 Opportunity</p>
                  <p className="text-white text-sm">Personal Training Interest</p>
                </div>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3">
                  <p className="text-gray-400 text-xs mb-2">⚠️ Pain Point</p>
                  <p className="text-white text-sm">Crowded during peak hours</p>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-700">
                <p className="text-gray-400 text-xs mb-1">💰 Revenue Quote</p>
                <p className="text-white text-xs italic">"I've been thinking about trying personal training to help me reach my goals faster"</p>
              </div>
            </div>
            
            <div className="mt-4 text-center">
              <button
                onClick={() => setCurrentPage('dashboard')}
                className="px-6 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg font-medium transition-all text-sm"
              >
                View Full Dashboard →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Key Features - Compact Cards */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Key Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <h3 className="text-white font-semibold mb-1">Real-time Analysis</h3>
                <p className="text-gray-400 text-sm">
                  Get instant insights as calls complete with automatic sentiment and risk scoring
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <h3 className="text-white font-semibold mb-1">Churn Detection</h3>
                <p className="text-gray-400 text-sm">
                  Identify at-risk members before they leave with AI-powered churn scoring
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <h3 className="text-white font-semibold mb-1">Revenue Opportunities</h3>
                <p className="text-gray-400 text-sm">
                  Discover upsell opportunities and members interested in additional services
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📈</span>
              <div>
                <h3 className="text-white font-semibold mb-1">Trend Analytics</h3>
                <p className="text-gray-400 text-sm">
                  Track sentiment, churn risk, and revenue interest trends over time
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
