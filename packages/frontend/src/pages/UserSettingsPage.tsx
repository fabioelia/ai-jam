import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store.js';
import { useCurrentUser } from '../api/queries.js';
import UserAvatar from '../components/common/UserAvatar.js';
import { getClientErrorMessage } from '../api/client.js';
import { toast } from '../stores/toast-store.js';

type Tab = 'profile' | 'preferences' | 'account';

export default function UserSettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data: currentUser, refetch } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [isSaving, setIsSaving] = useState(false);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { key: 'preferences', label: 'Preferences', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
    { key: 'account', label: 'Account', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  ];

  const userName = currentUser?.name || user?.name;
  const userEmail = currentUser?.email || user?.email;
  const avatarUrl = currentUser?.avatarUrl || user?.avatarUrl;
  const preferences = currentUser?.preferences || user?.preferences || {};

  async function handleSaveProfile(data: { name?: string; avatarUrl?: string | null; preferences?: Record<string, unknown> }) {
    setIsSaving(true);
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      const updatedUser = await response.json();
      useAuthStore.getState().setAuth(updatedUser, useAuthStore.getState().accessToken!, useAuthStore.getState().refreshToken!);
      await refetch();
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error(`Failed to save settings: ${getClientErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white text-sm flex items-center gap-1.5 transition-colors hover:bg-gray-800 px-2.5 py-1.5 rounded-lg"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Dashboard
            </button>
            <span className="text-gray-700">/</span>
            <h1 className="text-xl font-bold text-white">Settings</h1>
          </div>
          <UserAvatar size="md" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 shrink-0">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.key
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                  </svg>
                  {tab.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 max-w-2xl">
            {activeTab === 'profile' && (
              <ProfileTab
                userName={userName}
                userEmail={userEmail}
                avatarUrl={avatarUrl}
                preferences={preferences}
                onSave={handleSaveProfile}
                isSaving={isSaving}
                refetch={refetch}
              />
            )}
            {activeTab === 'preferences' && (
              <PreferencesTab
                preferences={preferences}
                onSave={handleSaveProfile}
                isSaving={isSaving}
              />
            )}
            {activeTab === 'account' && (
              <AccountTab
                userEmail={userEmail}
                userName={userName}
                createdAt={currentUser?.createdAt || user?.createdAt}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ---- Profile Tab ----

function ProfileTab({
  userName,
  userEmail,
  avatarUrl,
  preferences,
  onSave,
  isSaving,
  refetch,
}: {
  userName: string | undefined;
  userEmail: string | undefined;
  avatarUrl: string | null | undefined;
  preferences: Record<string, unknown>;
  onSave: (data: { name?: string; avatarUrl?: string | null; preferences?: Record<string, unknown> }) => Promise<void>;
  isSaving: boolean;
  refetch: () => void;
}) {
  const [name, setName] = useState(userName || '');
  const [isUploading, setIsUploading] = useState(false);

  const initials = name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

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
    } catch (error) {
      toast.error(`Failed to remove avatar: ${getClientErrorMessage(error)}`);
    }
  }

  async function handleSave() {
    await onSave({ name });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Profile</h2>
        <p className="text-sm text-gray-500">Manage your profile information and avatar.</p>
      </div>

      {/* Avatar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-medium mb-4">Profile Picture</h3>
        <div className="flex items-start gap-6">
          <div className="shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile avatar"
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-700"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-semibold text-white text-2xl border-2 border-gray-700">
                {initials}
              </div>
            )}
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <label className="block">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleAvatarUpload}
                  disabled={isUploading}
                  className="hidden"
                />
                <span className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {isUploading ? 'Uploading...' : 'Upload New Picture'}
                </span>
              </label>
              <p className="text-xs text-gray-500 mt-1">JPEG, PNG, WebP, or GIF. Max 5MB.</p>
            </div>
            {avatarUrl && (
              <button
                onClick={handleRemoveAvatar}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                Remove current picture
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Name */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-medium mb-4">Basic Information</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
              placeholder="Your name"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
            <input
              id="email"
              type="email"
              value={userEmail || ''}
              disabled
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2.5 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-600 mt-1">Contact support to change your email address.</p>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving || name === userName}
          className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ---- Preferences Tab ----

function PreferencesTab({
  preferences,
  onSave,
  isSaving,
}: {
  preferences: Record<string, unknown>;
  onSave: (data: { preferences?: Record<string, unknown> }) => Promise<void>;
  isSaving: boolean;
}) {
  const [theme, setTheme] = useState((preferences.theme as string) || 'dark');
  const [density, setDensity] = useState((preferences.density as string) || 'comfortable');
  const [emailNotifications, setEmailNotifications] = useState((preferences.emailNotifications as boolean) !== false);

  async function handleSave() {
    await onSave({
      preferences: {
        ...preferences,
        theme,
        density,
        emailNotifications,
      },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Preferences</h2>
        <p className="text-sm text-gray-500">Customize your experience and notification settings.</p>
      </div>

      {/* Appearance */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-medium mb-4">Appearance</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Theme</label>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setTheme('dark')}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  theme === 'dark'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                }`}
              >
                Dark
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  theme === 'light'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                }`}
              >
                Light
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  theme === 'system'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                }`}
              >
                System
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">UI Density</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDensity('comfortable')}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  density === 'comfortable'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                }`}
              >
                Comfortable
              </button>
              <button
                onClick={() => setDensity('compact')}
                className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${
                  density === 'compact'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                }`}
              >
                Compact
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-medium mb-4">Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-white font-medium">Email Notifications</p>
              <p className="text-xs text-gray-500 mt-0.5">Receive email updates about your projects</p>
            </div>
            <button
              onClick={() => setEmailNotifications(!emailNotifications)}
              disabled={isSaving}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 hover:opacity-90 ${
                emailNotifications ? 'bg-indigo-600' : 'bg-gray-700'
              }`}
              role="switch"
              aria-checked={emailNotifications}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                  emailNotifications ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ---- Account Tab ----

function AccountTab({
  userEmail,
  userName,
  createdAt,
}: {
  userEmail: string | undefined;
  userName: string | undefined;
  createdAt: string | undefined;
}) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white mb-1">Account</h2>
        <p className="text-sm text-gray-500">Manage your account settings and security.</p>
      </div>

      {/* Account info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-medium mb-4">Account Information</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-800">
            <span className="text-sm text-gray-500">Name</span>
            <span className="text-sm text-white">{userName || '-'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-800">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm text-white">{userEmail || '-'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-800">
            <span className="text-sm text-gray-500">Member Since</span>
            <span className="text-sm text-white">{createdAt ? new Date(createdAt).toLocaleDateString() : '-'}</span>
          </div>
        </div>
      </div>

      {/* Account actions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-medium mb-4">Account Actions</h3>
        <div className="space-y-3">
          <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <div className="text-left">
                <p className="text-sm text-white font-medium">Change Password</p>
                <p className="text-xs text-gray-500">Update your password to keep your account secure</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-left">
                <p className="text-sm text-white font-medium">Export Data</p>
                <p className="text-xs text-gray-500">Download your account data</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-gray-900 border border-red-900/50 rounded-xl p-6">
        <h3 className="text-red-400 font-medium mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-500 mb-4">These actions are irreversible. Please be certain.</p>
        <div className="flex gap-3">
          <button
            onClick={logout}
            className="text-red-400 hover:text-red-300 text-sm px-4 py-2 border border-red-900 rounded-lg hover:border-red-700 hover:bg-red-500/10 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
