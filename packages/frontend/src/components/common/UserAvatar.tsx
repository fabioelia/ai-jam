import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store.js';
import { useCurrentUser } from '../../api/queries.js';
import { getClientErrorMessage } from '../../api/client.js';
import { toast } from '../../stores/toast-store.js';

interface UserAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  showDropdown?: boolean;
  className?: string;
}

export default function UserAvatar({ size = 'md', showDropdown = true, className = '' }: UserAvatarProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: currentUser, refetch } = useCurrentUser();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard: Escape to close, Enter/Space to toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const avatarUrl = currentUser?.avatarUrl || user?.avatarUrl;
  const userName = currentUser?.name || user?.name;
  const initials = userName
    ? userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error('File type must be JPEG, PNG, WebP, or GIF');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/users/me/avatar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload avatar');
      }

      const updatedUser = await response.json();
      useAuthStore.getState().setAuth(updatedUser, useAuthStore.getState().accessToken!, useAuthStore.getState().refreshToken!);
      await refetch();
      toast.success('Avatar updated successfully');
      setIsOpen(false);
    } catch (error) {
      toast.error(`Failed to upload avatar: ${getClientErrorMessage(error)}`);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemoveAvatar() {
    try {
      const response = await fetch('/api/users/me/avatar', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove avatar');
      }

      const updatedUser = await response.json();
      useAuthStore.getState().setAuth(updatedUser, useAuthStore.getState().accessToken!, useAuthStore.getState().refreshToken!);
      await refetch();
      toast.success('Avatar removed successfully');
      setIsOpen(false);
    } catch (error) {
      toast.error(`Failed to remove avatar: ${getClientErrorMessage(error)}`);
    }
  }

  function handleLogout() {
    useAuthStore.getState().logout();
    navigate('/login');
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => showDropdown && setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-full transition-all duration-200 hover:ring-2 hover:ring-indigo-500/50 hover:ring-offset-2 hover:ring-offset-gray-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-gray-950 ${
          size === 'sm' ? 'p-1' : 'p-1.5'
        }`}
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={userName || 'User avatar'}
            className={`${sizeClasses[size]} rounded-full object-cover border-2 border-gray-700`}
          />
        ) : (
          <div className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-semibold text-white border-2 border-gray-700`}>
            {initials}
          </div>
        )}
        {showDropdown && (
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {showDropdown && isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200">
          {/* User info header */}
          <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
            <p className="text-sm font-medium text-white">{userName || 'User'}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>

          {/* Avatar upload section */}
          <div className="px-4 py-3 border-b border-gray-800">
            <label className="block text-xs font-medium text-gray-400 mb-2">Profile Picture</label>
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Current avatar"
                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-700"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-semibold text-white">
                  {initials}
                </div>
              )}
              <div className="flex-1 space-y-2">
                <label className="block">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleAvatarUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                  <span className="inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </span>
                </label>
                {avatarUrl && (
                  <button
                    onClick={handleRemoveAvatar}
                    className="block text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-all duration-200 active:bg-red-500/20 active:scale-95"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <button
              onClick={() => { navigate('/settings'); setIsOpen(false); }}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-all duration-200 flex items-center gap-3 hover:shadow-sm active:bg-gray-700 active:scale-[0.995]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Profile Settings
            </button>
            <button
              onClick={() => { navigate('/notifications'); setIsOpen(false); }}
              className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-all duration-200 flex items-center gap-3 hover:shadow-sm active:bg-gray-700 active:scale-[0.995]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Notifications
            </button>
          </div>

          {/* Logout */}
          <div className="px-4 py-2 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all duration-200 flex items-center gap-2 hover:shadow-lg hover:shadow-red-500/20 active:bg-red-500/20 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
