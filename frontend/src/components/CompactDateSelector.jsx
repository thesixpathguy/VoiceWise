import { useState, useRef, useEffect } from 'react';

export default function CompactDateSelector({ startDate, endDate, onDateRangeChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        // Reset temp values if cancelled
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
      {/* Compact Date Display Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg hover:bg-gray-700/50 transition-colors text-sm"
      >
        {/* Clock Icon */}
        <div className="w-4 h-4 rounded-full border border-gray-400 flex items-center justify-center">
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
        </div>
        
        {/* Date Range Text */}
        <span className="text-gray-300 whitespace-nowrap">
          {displayText}
        </span>
        
        {/* Dropdown Arrow */}
        <svg 
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-700">
            <h3 className="text-sm font-medium text-white">Custom Date Range</h3>
          </div>

          {/* Date Inputs */}
          <div className="p-4 space-y-4">
            {/* Start Date */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                From
              </label>
              <input
                type="date"
                value={formatForInput(tempStartDate)}
                onChange={(e) => setTempStartDate(formatFromInput(e.target.value))}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.target.showPicker?.();
                }}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer select-none"
                style={{ userSelect: 'none' }}
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2">
                To
              </label>
              <input
                type="date"
                value={formatForInput(tempEndDate)}
                onChange={(e) => setTempEndDate(formatFromInput(e.target.value))}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.target.showPicker?.();
                }}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer select-none"
                style={{ userSelect: 'none' }}
              />
            </div>

          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-700">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
