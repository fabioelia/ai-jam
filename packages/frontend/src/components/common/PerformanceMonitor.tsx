/**
 * Performance Monitor Component
 *
 * Real-time performance monitoring dashboard for tracking FPS, memory usage,
 * render times, and long tasks across the application.
 */

import { useEffect, useState, useRef } from 'react';
import { usePerformanceMonitor } from '../utils/performanceHooks.js';

interface PerformanceMonitorProps {
  enabled?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  showFPS?: boolean;
  showMemory?: boolean;
  showRenderTime?: boolean;
  showLongTasks?: boolean;
}

export default function PerformanceMonitor({
  enabled = process.env.NODE_ENV === 'development',
  position = 'top-right',
  showFPS = true,
  showMemory = true,
  showRenderTime = true,
  showLongTasks = true,
}: PerformanceMonitorProps) {
  const { metrics, getAverage } = usePerformanceMonitor(enabled);
  const [isMinimized, setIsMinimized] = useState(true);
  const [averageStats, setAverageStats] = useState<any>(null);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const avg = getAverage(5000);
      setAverageStats(avg);
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, getAverage]);

  if (!enabled || !metrics) return null;

  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };

  const formatMemory = (bytes?: number) => {
    if (!bytes) return 'N/A';
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const getFPSColor = (fps: number) => {
    if (fps >= 50) return 'text-green-400';
    if (fps >= 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className={`fixed z-50 ${positionClasses[position]}`}>
      <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div
          className="bg-gray-800 px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-700 transition-colors"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <span className="text-xs font-semibold text-gray-300">Performance Monitor</span>
          <span className="text-gray-500">
            {isMinimized ? '▶' : '▼'}
          </span>
        </div>

        {/* Content */}
        {!isMinimized && (
          <div className="p-3 space-y-2">
            {/* Current Metrics */}
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-400 mb-2">Current</div>

              {showFPS && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">FPS</span>
                  <span className={`text-xs font-mono ${getFPSColor(metrics.fps)}`}>
                    {metrics.fps}
                  </span>
                </div>
              )}

              {showRenderTime && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Render Time</span>
                  <span className="text-xs font-mono text-gray-300">
                    {metrics.renderTime.toFixed(2)} ms
                  </span>
                </div>
              )}

              {showMemory && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Memory</span>
                  <span className="text-xs font-mono text-gray-300">
                    {formatMemory(metrics.memoryUsage)}
                  </span>
                </div>
              )}

              {showLongTasks && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Long Tasks</span>
                  <span className={`text-xs font-mono ${metrics.longTasks > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {metrics.longTasks}
                  </span>
                </div>
              )}
            </div>

            {/* Average Metrics */}
            {averageStats && (
              <div className="space-y-1 pt-2 border-t border-gray-700">
                <div className="text-xs font-medium text-gray-400 mb-2">Average (5s)</div>

                {showFPS && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">FPS</span>
                    <span className={`text-xs font-mono ${getFPSColor(averageStats.fps)}`}>
                      {averageStats.fps}
                    </span>
                  </div>
                )}

                {showRenderTime && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Render Time</span>
                    <span className="text-xs font-mono text-gray-300">
                      {averageStats.renderTime.toFixed(2)} ms
                    </span>
                  </div>
                )}

                {showMemory && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">Memory</span>
                    <span className="text-xs font-mono text-gray-300">
                      {formatMemory(averageStats.memoryUsage)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Web Vitals Monitoring
 */

interface WebVitals {
  LCP?: number; // Largest Contentful Paint
  FID?: number; // First Input Delay
  CLS?: number; // Cumulative Layout Shift
  FCP?: number; // First Contentful Paint
  TTFB?: number; // Time to First Byte
}

export function WebVitalsMonitor() {
  const [vitals, setVitals] = useState<WebVitals>({});

  useEffect(() => {
    if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

    const reportWebVital = (name: string, value: number) => {
      setVitals(prev => ({ ...prev, [name]: value }));

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Web Vitals] ${name}: ${value}`);
      }
    };

    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      reportWebVital('LCP', lastEntry.renderTime || lastEntry.loadTime);
    });
    try {
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      console.warn('LCP observation not supported');
    }

    // First Input Delay
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      for (const entry of entries) {
        reportWebVital('FID', (entry as any).processingStart - entry.startTime);
      }
    });
    try {
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      console.warn('FID observation not supported');
    }

    // Cumulative Layout Shift
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          reportWebVital('CLS', clsValue);
        }
      }
    });
    try {
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      console.warn('CLS observation not supported');
    }

    // First Contentful Paint
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        reportWebVital('FCP', fcpEntry.startTime);
      }
    });
    try {
      fcpObserver.observe({ entryTypes: ['paint'] });
    } catch (e) {
      console.warn('FCP observation not supported');
    }

    return () => {
      lcpObserver.disconnect();
      fidObserver.disconnect();
      clsObserver.disconnect();
      fcpObserver.disconnect();
    };
  }, []);

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-4 left-4 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl p-3 z-50">
      <div className="text-xs font-semibold text-gray-300 mb-2">Web Vitals</div>
      <div className="space-y-1">
        {vitals.LCP !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">LCP</span>
            <span className="text-xs font-mono text-gray-300">
              {vitals.LCP.toFixed(0)} ms
            </span>
          </div>
        )}
        {vitals.FID !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">FID</span>
            <span className="text-xs font-mono text-gray-300">
              {vitals.FID.toFixed(0)} ms
            </span>
          </div>
        )}
        {vitals.CLS !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">CLS</span>
            <span className={`text-xs font-mono ${vitals.CLS < 0.1 ? 'text-green-400' : vitals.CLS < 0.25 ? 'text-yellow-400' : 'text-red-400'}`}>
              {vitals.CLS.toFixed(3)}
            </span>
          </div>
        )}
        {vitals.FCP !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">FCP</span>
            <span className="text-xs font-mono text-gray-300">
              {vitals.FCP.toFixed(0)} ms
            </span>
          </div>
        )}
        {vitals.TTFB !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">TTFB</span>
            <span className="text-xs font-mono text-gray-300">
              {vitals.TTFB.toFixed(0)} ms
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * React DevTools Profiler Integration
 */

export function ReactProfiler({ name, children }: { name: string; children: React.ReactNode }) {
  return <React.Profiler id={name}>{children}</React.Profiler>;
}

/**
 * Performance Timeline Component
 */

interface PerformanceEvent {
  timestamp: number;
  type: 'render' | 'fetch' | 'mutation' | 'custom';
  name: string;
  duration: number;
  metadata?: Record<string, any>;
}

export function PerformanceTimeline() {
  const [events, setEvents] = useState<PerformanceEvent[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const eventsRef = useRef<PerformanceEvent[]>([]);

  const addEvent = (event: PerformanceEvent) => {
    const newEvent = {
      ...event,
      timestamp: Date.now(),
    };
    eventsRef.current.push(newEvent);
    setEvents([...eventsRef.current]);
  };

  const clearEvents = () => {
    eventsRef.current = [];
    setEvents([]);
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-2xl p-3 z-50 w-80">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-300">Performance Timeline</span>
        <div className="flex gap-2">
          <button
            onClick={toggleRecording}
            className={`text-xs px-2 py-1 rounded ${
              isRecording ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300'
            }`}
          >
            {isRecording ? '● Recording' : '○ Record'}
          </button>
          <button
            onClick={clearEvents}
            className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {events.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-4">
            No events recorded
          </div>
        ) : (
          events.slice(-20).map((event, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-gray-800/50 rounded text-xs"
            >
              <span className="text-gray-500 font-mono">
                {new Date(event.timestamp).toLocaleTimeString()}
              </span>
              <span className={`font-medium ${
                event.type === 'render' ? 'text-blue-400' :
                event.type === 'fetch' ? 'text-green-400' :
                event.type === 'mutation' ? 'text-purple-400' :
                'text-gray-400'
              }`}>
                {event.type}
              </span>
              <span className="text-gray-300 flex-1 truncate">
                {event.name}
              </span>
              <span className="text-gray-500 font-mono">
                {event.duration.toFixed(2)}ms
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
