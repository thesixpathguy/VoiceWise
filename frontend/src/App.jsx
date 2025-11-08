import { useState } from 'react'
import './App.css'
import Dashboard from './components/Dashboard'
import CallsList from './components/CallsList'
import InitiateCalls from './components/InitiateCalls'
import SearchPage from './components/SearchPage'
import LiveCalls from './components/LiveCalls'

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
      case 'live':
        return <LiveCalls />
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
                onClick={() => setCurrentPage('initiate')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'initiate'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                Initiate Calls
              </button>
              <button
                onClick={() => setCurrentPage('calls')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  currentPage === 'calls'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                Feedbacks
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
              <button
                onClick={() => setCurrentPage('live')}
                className={`px-4 py-2 rounded-lg transition-colors relative ${
                  currentPage === 'live'
                    ? 'bg-primary-500 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  Live Calls
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                </span>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* Automated Calls Using AI */}
        <div className="bg-primary-500/10 border border-primary-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-lg bg-primary-500/20 flex items-center justify-center">
              <span className="text-2xl">📞</span>
            </div>
            <h3 className="text-lg font-semibold text-primary-400">
              Automated Calls Using AI
            </h3>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            AI agent calls your members to gather genuine feedback through natural conversations. Monitor active calls in real-time with live conversation tracking and instant sentiment analysis
          </p>
        </div>

        {/* AI Analysis & Actionable Insights */}
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
            <h3 className="text-lg font-semibold text-purple-400">
              AI Analysis & Actionable Insights
            </h3>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Automatic transcription, sentiment analysis, and AI-powered insights to identify pain points, opportunities, and churn risks
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

      {/* Perspectives Section */}
      <section className="mb-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">Ground-Level Perspectives</h2>
          <p className="text-gray-400 max-w-3xl mx-auto text-sm md:text-base">
            VoiceWise blends live call intelligence with operational benchmarks so your team knows where to focus now—not next quarter.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-gray-900/70 via-gray-900/40 to-gray-900/70 border border-gray-800/70 rounded-2xl p-6 shadow-lg shadow-black/30">
            <p className="text-gray-300 text-sm leading-relaxed">
              Companies that route conversational insights back to product and operations teams <span className="text-white font-semibold">ship fixes 2.4× faster</span> than competitors relying on static surveys alone.
            </p>
          </div>

          <div className="bg-gradient-to-br from-gray-900/70 via-gray-900/40 to-gray-900/70 border border-gray-800/70 rounded-2xl p-6 shadow-lg shadow-black/30">
            <p className="text-gray-300 text-sm leading-relaxed">
              <span className="text-white font-semibold">77% of members stay longer</span> when brands acknowledge feedback during follow-up conversations powered by AI and route it into measurable workflows.
            </p>
          </div>

          <div className="bg-gradient-to-br from-gray-900/70 via-gray-900/40 to-gray-900/70 border border-gray-800/70 rounded-2xl p-6 shadow-lg shadow-black/30">
            <p className="text-gray-300 text-sm leading-relaxed">
              Teams that correlate VoiceWise call signals with CRM data <span className="text-white font-semibold">recover 25% more at-risk revenue</span> through targeted coaching and timely outreach.
            </p>
          </div>
        </div>
      </section>

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
                  Get insights as calls complete while live conversations stream with sentiment
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
