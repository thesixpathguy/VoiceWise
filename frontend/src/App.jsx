import './App.css'

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="text-center py-12 border-b-2 border-primary-500/20 mb-12">
        <div className="flex items-center justify-center gap-4 mb-2">
          <span className="text-6xl animate-pulse-slow">🎙️</span>
          <h1 className="text-6xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
            VoiceWise
          </h1>
        </div>
        <p className="text-xl text-gray-400 mt-2">
          Intelligent Voice Feedback Analysis
        </p>
      </header>
      
      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Welcome to VoiceWise
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Transform customer feedback calls into actionable insights using AI-powered analysis.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary-500/20">
            <span className="text-5xl block mb-4">🤖</span>
            <h3 className="text-xl font-semibold text-primary-400 mb-2">
              AI-Powered Analysis
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Automatic transcription and sentiment analysis of calls
            </p>
          </div>

          <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary-500/20">
            <span className="text-5xl block mb-4">☁️</span>
            <h3 className="text-xl font-semibold text-primary-400 mb-2">
              Cloud Database
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Powered by Supabase for reliable, scalable storage
            </p>
          </div>

          <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary-500/20">
            <span className="text-5xl block mb-4">⚡</span>
            <h3 className="text-xl font-semibold text-primary-400 mb-2">
              Real-time Processing
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Process and analyze feedback in real-time
            </p>
          </div>

          <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary-500/20">
            <span className="text-5xl block mb-4">📊</span>
            <h3 className="text-xl font-semibold text-primary-400 mb-2">
              Insights Dashboard
            </h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Comprehensive analytics and reporting
            </p>
          </div>
        </div>

        {/* Status Section */}
        <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-8 text-center mb-8">
          <h3 className="text-2xl font-semibold text-primary-400 mb-4">
            System Status
          </h3>
          <div className="space-y-2 text-lg">
            <p className="text-gray-300">✅ Frontend: Running on Vite + React + Tailwind CSS</p>
            <p className="text-gray-300">⚙️ Backend: FastAPI ready to serve</p>
            <p className="text-gray-300">🗄️ Database: Supabase configured</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 border-t-2 border-primary-500/20 mt-12">
        <p className="text-gray-400">
          Built with ❤️ for intelligent voice feedback analysis
        </p>
      </footer>
    </div>
  )
}

export default App
