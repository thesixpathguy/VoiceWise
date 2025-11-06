import { useState, useEffect } from 'react';
import { callsAPI } from '../api/api';

export default function InitiateCalls() {
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [gymId, setGymId] = useState('gym_001');
  const [customInstructions, setCustomInstructions] = useState(['']);
  const [showCustomInstructions, setShowCustomInstructions] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [searchSegment, setSearchSegment] = useState(null);
  
  // Custom filter modal state
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customFilters, setCustomFilters] = useState({
    ratingOperator: '',
    ratingValue: '',
    dateOperator: '',
    dateValue: ''
  });
  const [customModalError, setCustomModalError] = useState(null);
  
  // Prompt modal state
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [userPrompt, setUserPrompt] = useState('');
  const [promptModalError, setPromptModalError] = useState(null);

  // Check for phone numbers and search segment from localStorage on mount
  useEffect(() => {
    const savedPhoneNumbers = localStorage.getItem('initiateCalls_phoneNumbers');
    if (savedPhoneNumbers) {
      setPhoneNumbers(savedPhoneNumbers);
      // Clear it after reading
      localStorage.removeItem('initiateCalls_phoneNumbers');
    }
    
    const savedSearchSegment = localStorage.getItem('initiateCalls_searchSegment');
    if (savedSearchSegment) {
      try {
        const segment = JSON.parse(savedSearchSegment);
        setSearchSegment(segment);
        // Clear it after reading
        localStorage.removeItem('initiateCalls_searchSegment');
      } catch (e) {
        console.error('Failed to parse search segment:', e);
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Parse phone numbers (one per line)
    const numbers = phoneNumbers
      .split('\n')
      .map(num => num.trim())
      .filter(num => num.length > 0);

    if (numbers.length === 0) {
      setError('Please enter at least one phone number');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Filter out empty instructions
      const instructions = customInstructions.filter(inst => inst.trim().length > 0);
      
      const response = await callsAPI.initiateCalls(numbers, gymId, instructions.length > 0 ? instructions : undefined);
      setResult(response);
      
      // Clear form on success
      setPhoneNumbers('');
      setCustomInstructions(['']);
    } catch (err) {
      setError('Failed to initiate calls: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCustomFilters = async () => {
    // Validate that at least one filter is set
    const hasRatingFilter = customFilters.ratingOperator && customFilters.ratingValue;
    const hasDateFilter = customFilters.dateOperator && customFilters.dateValue;
    
    if (!hasRatingFilter && !hasDateFilter) {
      setCustomModalError('Please set at least one filter (rating or date)');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setCustomModalError(null);
      setResult(null);
      setShowCustomModal(false);
      
      const data = await callsAPI.getCustomFilteredUsers(gymId, customFilters, 100);
      if (data && data.phone_numbers && data.phone_numbers.length > 0) {
        const numbers = data.phone_numbers.map(u => u.phone_number).join('\n');
        setPhoneNumbers(prev => prev ? `${prev}\n${numbers}` : numbers);
      } else {
        setError('No users found matching the custom filters');
      }
    } catch (err) {
      setShowCustomModal(false);
      setError('Failed to load custom filtered numbers: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPrompt = async () => {
    if (!userPrompt.trim()) {
      setPromptModalError('Please enter a prompt');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setPromptModalError(null);
      setResult(null);
      setShowPromptModal(false);
      
      const data = await callsAPI.getPromptFilteredUsers(gymId, userPrompt.trim(), 100);
      if (data && data.phone_numbers && data.phone_numbers.length > 0) {
        const numbers = data.phone_numbers.map(u => u.phone_number).join('\n');
        setPhoneNumbers(prev => prev ? `${prev}\n${numbers}` : numbers);
      } else {
        setError('No users found matching the prompt');
      }
    } catch (err) {
      setShowPromptModal(false);
      setError('Failed to load prompt filtered numbers: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Initiate Calls</h1>
        <p className="text-gray-400">Start AI-powered voice feedback calls to your gym members</p>
      </div>

      {/* Search Segment Info */}
      {searchSegment && (
        <div className="mb-6 bg-primary-500/10 border border-primary-500/30 rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔍</span>
                <h3 className="text-lg font-semibold text-primary-400">Search Segment</h3>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Type:</span>
                  <span className="text-white font-medium capitalize">
                    {searchSegment.searchType === 'sentiment' ? 'Sentiment Search' : 'NLP Search'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Query:</span>
                  <span className="text-white font-medium">"{searchSegment.query}"</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">Members:</span>
                  <span className="text-primary-400 font-semibold">{searchSegment.resultCount} phone numbers</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSearchSegment(null)}
              className="text-gray-400 hover:text-white transition-colors"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User ID */}
          <div>
            <label htmlFor="gymId" className="block text-sm font-medium text-gray-300 mb-2">
              User ID
            </label>
            <input
              type="text"
              id="gymId"
              value={gymId}
              onChange={(e) => setGymId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="gym_001"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Identifier for tracking calls to this user
            </p>
          </div>

          {/* User Segments */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Segments
            </label>
            <div className="grid grid-cols-4 gap-4">
              <button
                type="button"
                onClick={async () => {
                  try {
                    setLoading(true);
                    setError(null);
                    setResult(null);
                    const data = await callsAPI.getTopChurnUsers(gymId, 0.8, 100);
                    if (data && data.phone_numbers && data.phone_numbers.length > 0) {
                      const numbers = data.phone_numbers.map(u => u.phone_number).join('\n');
                      setPhoneNumbers(prev => prev ? `${prev}\n${numbers}` : numbers);
                    } else {
                      setError('No churn interest numbers found');
                    }
                  } catch (err) {
                    setError('Failed to load churn numbers: ' + err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="py-2 px-3 bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title="Add high-risk users (churn score ≥ 0.8)"
              >
                <span className="text-lg">⚠️</span>
                <span className="text-xs font-medium">Churn</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCustomModal(true)}
                disabled={loading}
                className="py-2 px-3 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title="Add users with custom filters (rating/date)"
              >
                <span className="text-lg">🎯</span>
                <span className="text-xs font-medium">User</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setLoading(true);
                    setError(null);
                    setResult(null);
                    const data = await callsAPI.getTopRevenueUsers(gymId, 0.8, 100);
                    if (data && data.phone_numbers && data.phone_numbers.length > 0) {
                      const numbers = data.phone_numbers.map(u => u.phone_number).join('\n');
                      setPhoneNumbers(prev => prev ? `${prev}\n${numbers}` : numbers);
                    } else {
                      setError('No revenue interest numbers found');
                    }
                  } catch (err) {
                    setError('Failed to load revenue numbers: ' + err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="py-2 px-3 bg-primary-500/10 text-primary-400 border border-primary-500/30 rounded-lg hover:bg-primary-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title="Add high-value users (revenue score ≥ 0.8)"
              >
                <span className="text-lg">💰</span>
                <span className="text-xs font-medium">Revenue</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPromptModal(true)}
                disabled={loading}
                className="py-2 px-3 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                title="Find users using AI prompt"
              >
                <span className="text-lg">✨</span>
                <span className="text-xs font-medium">Prompt</span>
              </button>
            </div>
          </div>

          {/* Phone Numbers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="phoneNumbers" className="block text-sm font-medium text-gray-300">
                Member Phone Numbers
              </label>
              {phoneNumbers && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Clear all phone numbers?')) {
                      setPhoneNumbers('');
                    }
                  }}
                  className="px-2 py-1 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                  title="Clear all phone numbers"
                >
                  ✕ Clear
                </button>
              )}
            </div>
            <textarea
              id="phoneNumbers"
              value={phoneNumbers}
              onChange={(e) => setPhoneNumbers(e.target.value)}
              rows={5}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
              placeholder="+1234567890&#10;+1987654321&#10;+1555555555"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter one member phone number per line (with country code)
            </p>
          </div>

          {/* Custom Instructions Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Custom Instructions (Optional)
              </label>
              <button
                type="button"
                onClick={() => {
                  setShowCustomInstructions(!showCustomInstructions);
                  if (!showCustomInstructions && customInstructions.length === 0) {
                    setCustomInstructions(['']);
                  }
                }}
                className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
              >
                {showCustomInstructions ? 'Hide' : 'Show'} Instructions
              </button>
            </div>
            
            {showCustomInstructions && (
              <div className="bg-gray-900/30 border border-gray-600 rounded-lg p-4 space-y-3">
                <p className="text-xs text-gray-400 mb-3">
                  Add custom instruction points / questions that will be included in the call script. The AI agent will follow these additional guidelines during the conversation.
                </p>
                
                {customInstructions.map((instruction, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <input
                      type="text"
                      value={instruction}
                      onChange={(e) => {
                        const newInstructions = [...customInstructions];
                        newInstructions[index] = e.target.value;
                        setCustomInstructions(newInstructions);
                      }}
                      placeholder="e.g., Ask about their preferred workout times"
                      className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    {customInstructions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newInstructions = customInstructions.filter((_, i) => i !== index);
                          setCustomInstructions(newInstructions.length > 0 ? newInstructions : ['']);
                        }}
                        className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
                        title="Remove instruction"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={() => setCustomInstructions([...customInstructions, ''])}
                  className="w-full px-4 py-2 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <span>+</span>
                  Add Another Instruction
                </button>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-lg font-medium text-lg transition-all ${
              loading
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-primary-500 hover:bg-primary-600 hover:shadow-lg hover:shadow-primary-500/20'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Initiating Calls...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>📞</span>
                Initiate Calls
              </span>
            )}
          </button>
        </form>
      </div>

      {/* Result */}
      {result && (
        <div className="mt-8 bg-green-500/10 border border-green-500/30 rounded-xl p-6">
          <h2 className="text-xl font-bold text-green-400 mb-4 flex items-center gap-2">
            <span>✅</span>
            Calls Initiated Successfully
          </h2>
          
          <p className="text-gray-300 mb-4">
            Total calls initiated: <span className="font-bold text-white">{result.total}</span>
          </p>

          <div className="space-y-2">
            {result.calls_initiated.map((call, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  call.status === 'initiated'
                    ? 'bg-green-500/10 border border-green-500/20'
                    : 'bg-red-500/10 border border-red-500/20'
                }`}
              >
                <div>
                  <p className="text-white font-medium">{call.phone_number}</p>
                  <p className="text-xs text-gray-400">Call ID: {call.call_id}</p>
                </div>
                <span className={`text-sm px-3 py-1 rounded-full ${
                  call.status === 'initiated'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {call.status}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <p className="text-sm text-gray-400 mb-4">
              ℹ️ Calls are being processed. Members will receive calls shortly. Check status in the Calls page.
            </p>
            <button
              onClick={() => setResult(null)}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-sm"
            >
              Call More Members
            </button>
          </div>
        </div>
      )}

      {/* Info Card */}
      <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-400 mb-3">How It Works</h3>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-1">1.</span>
            <span>AI agent calls your gym members using Bland AI</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-1">2.</span>
            <span>Conducts friendly conversation gathering feedback about their gym experience</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-1">3.</span>
            <span>Call is recorded and automatically transcribed</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-1">4.</span>
            <span>AI extracts insights: member satisfaction, concerns, and upsell opportunities</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-1">5.</span>
            <span>View results in Dashboard and Calls pages to improve your gym</span>
          </li>
        </ul>
      </div>

       {/* Custom Filter Modal */}
       {showCustomModal && (
         <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
           <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-lg w-full p-6">
             <div className="flex items-center justify-between mb-6">
               <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                 <span>🎯</span>
                 Filters
               </h2>
               <button
                 onClick={() => {
                   setShowCustomModal(false);
                   setCustomModalError(null);
                 }}
                 className="text-gray-400 hover:text-white transition-colors"
               >
                 <span className="text-2xl">×</span>
               </button>
             </div>

             <div className="space-y-6">
              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Gym Rating Filter (1-10)
                </label>
                <div className="flex gap-3">
                  <select
                    value={customFilters.ratingOperator}
                    onChange={(e) => setCustomFilters({ ...customFilters, ratingOperator: e.target.value })}
                    className="pl-3 pr-10 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer [&>option]:bg-gray-900 [&>option]:text-white [&>option]:py-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEgMUw2IDZMMTEgMSIgc3Ryb2tlPSIjOUM5Qzk5IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg==')] bg-[center_right_0.75rem] bg-no-repeat"
                  >
                    <option value="" className="bg-gray-900 text-gray-400">Select</option>
                    <option value="gt" className="bg-gray-900 text-white">Greater than (&gt;)</option>
                    <option value="eq" className="bg-gray-900 text-white">Equal to (=)</option>
                    <option value="lt" className="bg-gray-900 text-white">Less than (&lt;)</option>
                  </select>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.1"
                    value={customFilters.ratingValue}
                    onChange={(e) => setCustomFilters({ ...customFilters, ratingValue: e.target.value })}
                    placeholder="e.g., 7.0"
                    className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Date Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Call Date Filter
                </label>
                <div className="flex gap-3">
                  <select
                    value={customFilters.dateOperator}
                    onChange={(e) => setCustomFilters({ ...customFilters, dateOperator: e.target.value })}
                    className="pl-3 pr-10 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer [&>option]:bg-gray-900 [&>option]:text-white [&>option]:py-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEgMUw2IDZMMTEgMSIgc3Ryb2tlPSIjOUM5Qzk5IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg==')] bg-[center_right_0.75rem] bg-no-repeat"
                  >
                    <option value="" className="bg-gray-900 text-gray-400">Select</option>
                    <option value="gt" className="bg-gray-900 text-white">After (&gt;)</option>
                    <option value="eq" className="bg-gray-900 text-white">On (=)</option>
                    <option value="lt" className="bg-gray-900 text-white">Before (&lt;)</option>
                  </select>
                  <input
                    type="date"
                    value={customFilters.dateValue}
                    onChange={(e) => setCustomFilters({ ...customFilters, dateValue: e.target.value })}
                    className="flex-1 px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

               {/* Info */}
               <p className="text-xs text-gray-400 bg-gray-900/30 rounded-lg p-3">
                 ℹ️ Set at least one filter (rating or date) to find matching users
               </p>

               {/* Error Message */}
               {customModalError && (
                 <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                   <p className="text-red-400 text-sm">{customModalError}</p>
                 </div>
               )}

               {/* Action Buttons */}
               <div className="flex gap-3 pt-2">
                 <button
                   onClick={() => {
                     setCustomFilters({
                       ratingOperator: '',
                       ratingValue: '',
                       dateOperator: '',
                       dateValue: ''
                     });
                     setCustomModalError(null);
                   }}
                   className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                 >
                   Clear
                 </button>
                <button
                  onClick={handleApplyCustomFilters}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Loading...' : 'Apply Filters'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

       {/* Prompt Modal */}
       {showPromptModal && (
         <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
           <div className="bg-gray-800 border border-gray-700 rounded-xl max-w-lg w-full p-6">
             <div className="flex items-center justify-between mb-6">
               <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                 <span>✨</span>
                 AI Prompt Search
               </h2>
               <button
                 onClick={() => {
                   setShowPromptModal(false);
                   setPromptModalError(null);
                 }}
                 className="text-gray-400 hover:text-white transition-colors"
               >
                 <span className="text-2xl">×</span>
               </button>
             </div>

             <div className="space-y-4">
              {/* Prompt Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Describe the users you want to find
                </label>
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="e.g., Find users who mentioned equipment issues in the last month&#10;&#10;or&#10;&#10;Users who gave a rating below 5 and complained about staff"
                  rows={5}
                  className="w-full px-3 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

               {/* Info */}
               <p className="text-xs text-gray-400 bg-gray-900/30 rounded-lg p-3">
                 ℹ️ Use natural language to describe the users you're looking for. The AI will search through call transcripts and insights to find matching users.
               </p>

               {/* Error Message */}
               {promptModalError && (
                 <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                   <p className="text-red-400 text-sm">{promptModalError}</p>
                 </div>
               )}

               {/* Action Buttons */}
               <div className="flex gap-3 pt-2">
                 <button
                   onClick={() => {
                     setUserPrompt('');
                     setPromptModalError(null);
                   }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={handleApplyPrompt}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Searching...' : 'Find Users'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
