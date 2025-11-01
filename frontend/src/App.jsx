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
        return <SearchPage />
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Welcome to VoiceWise
        </h2>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto mb-8">
          Automate member feedback calls and transform responses into actionable insights with AI.
        </p>
        <button
          onClick={() => setCurrentPage('initiate')}
          className="px-8 py-4 bg-primary-500 hover:bg-primary-600 rounded-lg font-medium text-lg transition-all hover:shadow-lg hover:shadow-primary-500/20"
        >
          🚀 Start Calling Members
        </button>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
        <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary-500/20">
          <span className="text-5xl block mb-4">📞</span>
          <h3 className="text-xl font-semibold text-primary-400 mb-2">
            Automated Calls
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            AI agent calls your members to gather genuine feedback
          </p>
        </div>

        <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary-500/20">
          <span className="text-5xl block mb-4">🤖</span>
          <h3 className="text-xl font-semibold text-primary-400 mb-2">
            AI Analysis
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Automatic transcription and sentiment analysis of member feedback
          </p>
        </div>

        <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary-500/20">
          <span className="text-5xl block mb-4">💡</span>
          <h3 className="text-xl font-semibold text-primary-400 mb-2">
            Actionable Insights
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Identify pain points and upsell opportunities automatically
          </p>
        </div>

        <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary-500/20">
          <span className="text-5xl block mb-4">📊</span>
          <h3 className="text-xl font-semibold text-primary-400 mb-2">
            Member Dashboard
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            Track member satisfaction and retention metrics
          </p>
        </div>
      </div>

      {/* Status Section */}
      <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-8 text-center">
        <h3 className="text-2xl font-semibold text-primary-400 mb-4">
          System Status
        </h3>
        <div className="space-y-2 text-lg">
          <p className="text-gray-300">✅ Frontend: Running on Vite + React + Tailwind CSS</p>
          <p className="text-gray-300">⚙️ Backend: FastAPI ready to serve</p>
          <p className="text-gray-300">🗄️ Database: Supabase configured</p>
        </div>
      </div>
    </div>
  )
}

export default App
