import { useState, useRef, useEffect } from 'react';

export default function CompactDateSelector({ startDate, endDate, onDateRangeChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
  }, [startDate, endDate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setTempStartDate(startDate);
        setTempEndDate(endDate);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [startDate, endDate]);

  // Format date for display (DD/MM/YYYY to more readable format)
  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [day, month, year] = dateStr.split('/');
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch (error) {
      return dateStr;
    }
  };

  // Convert DD/MM/YYYY to YYYY-MM-DD for input
  const formatForInput = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [day, month, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } catch (error) {
      return '';
    }
  };

  // Convert YYYY-MM-DD to DD/MM/YYYY
  const formatFromInput = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    } catch (error) {
      return '';
    }
  };

  const handleApply = () => {
    onDateRangeChange(tempStartDate, tempEndDate);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setIsOpen(false);
  };

  const displayText = `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-gray-900/70 border border-gray-700/80 shadow-inner shadow-black/40 hover:bg-gray-800/70 transition-colors text-sm text-gray-200 backdrop-blur"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500/30 to-primary-500/10 border border-primary-400/40 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-primary-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs text-gray-400 uppercase tracking-[0.2em]">Date Range</span>
          <span className="text-sm font-medium text-gray-100">{displayText}</span>
        </div>
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-3 w-[22rem] rounded-2xl border border-gray-700/70 bg-gray-900/95 backdrop-blur shadow-2xl shadow-primary-500/30 z-50 overflow-hidden">
          <div className="bg-gradient-to-r from-primary-500/10 via-transparent to-blue-500/10 px-5 py-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Select Reporting Window</h3>
          </div>

          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-[0.2em]">
                From
              </label>
                <div className="relative">
              <input
                type="date"
                value={formatForInput(tempStartDate)}
                onChange={(e) => setTempStartDate(formatFromInput(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-950/80 border border-gray-700/70 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/60 focus:border-transparent"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-primary-400">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
            </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-[0.2em]">
                To
              </label>
                <div className="relative">
              <input
                type="date"
                value={formatForInput(tempEndDate)}
                onChange={(e) => setTempEndDate(formatFromInput(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg bg-gray-950/80 border border-gray-700/70 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/60 focus:border-transparent"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-primary-400">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-800 bg-gray-900/80">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-primary-500 to-blue-500 text-white text-sm font-semibold shadow-lg shadow-primary-500/30 hover:from-primary-400 hover:to-blue-400 transition-all"
            >
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
