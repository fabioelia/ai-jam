import { useState } from 'react';
import type { DateRange, DateRangePreset } from '../../types/analytics';
import { getDateRangeForPreset, format } from '../../utils/analytics-utils';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: DateRangePreset[];
}

const DEFAULT_PRESETS: DateRangePreset[] = ['today', 'week', 'month', 'quarter', 'year'];

export default function DateRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePresetClick = (preset: DateRangePreset) => {
    onChange(getDateRangeForPreset(preset));
    setIsOpen(false);
  };

  const handleCustomRange = (startDate: Date, endDate: Date) => {
    onChange({
      startDate,
      endDate,
      preset: 'custom'
    });
    setIsOpen(false);
  };

  const formatRange = (range: DateRange): string => {
    if (range.preset === 'custom') {
      return `${format(range.startDate, 'MMM d')} - ${format(range.endDate, 'MMM d')}`;
    }
    return format(range.endDate, 'MMM d');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-gray-900 border border-gray-800 hover:border-gray-700 px-4 py-2 rounded-lg text-white text-sm transition-all duration-200 min-w-[200px]"
      >
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 0 002 2z" />
        </svg>
        <span>{formatRange(value)}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-4">
            <div className="mb-4">
              <p className="text-white font-semibold mb-3">Quick Select</p>
              <div className="grid grid-cols-3 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetClick(preset)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                      value.preset === preset
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                  >
                    {preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <p className="text-white font-semibold mb-3">Custom Range</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-gray-400 text-xs mb-1">Start Date</label>
                  <input
                    type="date"
                    value={format(value.startDate, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const newStartDate = new Date(e.target.value);
                      if (newStartDate <= value.endDate) {
                        handleCustomRange(newStartDate, value.endDate);
                      }
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 text-xs mb-1">End Date</label>
                  <input
                    type="date"
                    value={format(value.endDate, 'yyyy-MM-dd')}
                    onChange={(e) => {
                      const newEndDate = new Date(e.target.value);
                      if (newEndDate >= value.startDate) {
                        handleCustomRange(value.startDate, newEndDate);
                      }
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
