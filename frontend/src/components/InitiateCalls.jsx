import { useState } from 'react';
import { callsAPI } from '../api/api';

export default function InitiateCalls() {
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [gymId, setGymId] = useState('gym_001');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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
      
      const response = await callsAPI.initiateCalls(numbers, gymId);
      setResult(response);
      
      // Clear form on success
      setPhoneNumbers('');
    } catch (err) {
      setError('Failed to initiate calls: ' + err.message);
      console.error(err);
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

      {/* Form */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Gym ID */}
          <div>
            <label htmlFor="gymId" className="block text-sm font-medium text-gray-300 mb-2">
              Gym ID
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
              Identifier for tracking calls to this gym
            </p>
          </div>

          {/* Phone Numbers */}
          <div>
            <label htmlFor="phoneNumbers" className="block text-sm font-medium text-gray-300 mb-2">
              Member Phone Numbers
            </label>
            <textarea
              id="phoneNumbers"
              value={phoneNumbers}
              onChange={(e) => setPhoneNumbers(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
              placeholder="+1234567890&#10;+1987654321&#10;+1555555555"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter one member phone number per line (with country code)
            </p>
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
    </div>
  );
}
