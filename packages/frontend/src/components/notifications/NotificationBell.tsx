import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../../stores/notification-store.js';

export default function NotificationBell({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const prevCountRef = useRef(unreadCount);
  const [pulse, setPulse] = useState(false);

  // Trigger pulse when unread count increases (new notification arrived)
  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 1000);
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

  return (
    <button
      onClick={() => navigate('/notifications')}
      className="relative text-sm px-2.5 py-1 rounded-lg border bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300 hover:bg-gray-700 hover:border-gray-600 transition-all duration-200"
      aria-label="Notifications"
    >
      {/* Bell icon */}
      <svg
        className={`w-4 h-4 ${pulse ? 'animate-bell-ring' : ''}`}
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
      {unreadCount > 0 && (
        <span
          className={`absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg shadow-red-500/30 ${
            pulse ? 'animate-badge-pulse' : ''
          }`}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
