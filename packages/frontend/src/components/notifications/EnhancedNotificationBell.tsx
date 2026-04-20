import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../../stores/notification-store.js';

export default function EnhancedNotificationBell({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const prevCountRef = useRef(unreadCount);
  const [pulse, setPulse] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [notificationStack, setNotificationStack] = useState<number[]>([]);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Trigger enhanced pulse when unread count increases
  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 1500);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  // Add new notification to stack for stacking animation
  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setNotificationStack((prev) => [...prev, Date.now()]);
      const timer = setTimeout(() => {
        setNotificationStack((prev) => prev.slice(1));
      }, 2000);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  // Update ref after pulse ends
  useEffect(() => {
    if (!pulse) {
      prevCountRef.current = unreadCount;
    }
  }, [pulse, unreadCount]);

  // Close panel when clicking outside
  useEffect(() => {
    if (!showPanel) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPanel]);

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={() => setShowPanel(!showPanel)}
        className={`relative text-sm px-3 py-2 rounded-lg border bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-700 hover:border-gray-600 active:bg-gray-700 active:border-gray-600 transition-all duration-300 hover:shadow-lg hover:shadow-gray-900/10 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 ${
          pulse ? 'animate-notification-glow ring-2 ring-indigo-500/30' : ''
        }`}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        {/* Bell icon */}
        <svg
          className={`w-4 h-4 transition-transform duration-300 ${pulse ? 'animate-bell-ring' : ''} ${
            showPanel ? 'rotate-12' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <>
            <span
              className={`absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg shadow-red-500/30 transition-all duration-300 ${
                pulse ? 'animate-badge-pulse scale-110' : ''
              }`}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>

            {/* Pulse ring */}
            {pulse && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 rounded-full animate-pulse-ring" />
            )}

            {/* Stacking notifications animation */}
            {notificationStack.map((id) => (
              <span
                key={id}
                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500/30 rounded-full animate-pulse-ring pointer-events-none"
                style={{ animationDelay: `${(notificationStack.indexOf(id) * 0.3)}s` }}
              />
            ))}
          </>
        )}
      </button>

      {/* Quick action menu */}
      {showPanel && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-notification-slide-in">
          <button
            onClick={() => {
              navigate('/notifications');
              setShowPanel(false);
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-all duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            View all notifications
          </button>
          <button
            onClick={() => {
              // Navigate to preferences
              setShowPanel(false);
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-all duration-200 flex items-center gap-2 border-t border-gray-800"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Notification settings
          </button>
        </div>
      )}
    </div>
  );
}
