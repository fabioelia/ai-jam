import { useState } from 'react';
import { NotificationType } from '@ai-jam/shared';
import type { Project, NotificationPreference } from '@ai-jam/shared';

const typeIcons: Record<NotificationType, { label: string; svg: string }> = {
  agent_completed: { label: 'Agent completed', svg: 'M5 13l4 4L19 7' },
  ticket_moved: { label: 'Ticket moved', svg: 'M13 7l5 5m0 0l-5 5m5-5H6' },
  gate_result: { label: 'Gate result', svg: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  comment_added: { label: 'Comment added', svg: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z' },
  proposal_created: { label: 'Proposal created', svg: 'M12 4v16m8-8H4' },
  proposal_resolved: { label: 'Proposal resolved', svg: 'M9 12l2 2 4-4' },
  scan_completed: { label: 'Scan completed', svg: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
};

interface NotificationPreferencesProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  preferences: NotificationPreference[];
  onSave: (preferences: NotificationPreference[]) => void;
}

type NotificationChannel = 'in_app' | 'email';

export default function NotificationPreferences({
  isOpen,
  onClose,
  projects,
  preferences,
  onSave,
}: NotificationPreferencesProps) {
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [channelPreferences, setChannelPreferences] = useState<Record<string, NotificationChannel[]>>({});
  const [typePreferences, setTypePreferences] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const notificationTypes = Object.entries(NotificationType).map(([, value]) => ({
    value,
    label: typeIcons[value]?.label ?? value,
    svg: typeIcons[value]?.svg ?? 'M12 4v16m8-8H4',
  }));

  const handleChannelToggle = (channel: NotificationChannel, type: string) => {
    setChannelPreferences((prev) => {
      const key = `${selectedProject || 'global'}-${type}`;
      const current = prev[key] || [];
      const updated = current.includes(channel)
        ? current.filter((c) => c !== channel)
        : [...current, channel];
      return { ...prev, [key]: updated };
    });
  };

  const handleTypeToggle = (type: string) => {
    setTypePreferences((prev) => ({
      ...prev,
      [`${selectedProject || 'global'}-${type}`]: !prev[`${selectedProject || 'global'}-${type}`],
    }));
  };

  const handleSave = () => {
    const updatedPreferences: NotificationPreference[] = notificationTypes.map((type) => {
      const key = `${selectedProject || 'global'}-${type.value}`;
      const enabled = typePreferences[key] !== false;
      const channels = channelPreferences[key] || ['in_app'];

      return {
        id: '',
        userId: '',
        projectId: selectedProject || null,
        notificationType: type.value,
        enabled: enabled ? 1 : 0,
      };
    });

    onSave(updatedPreferences);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden animate-zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Notification Preferences</h2>
            <p className="text-sm text-gray-500 mt-0.5">Customize how you receive notifications</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors duration-200 p-1 rounded-lg hover:bg-gray-800"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh]">
          {/* Project selector */}
          <div className="px-6 py-4 border-b border-gray-800">
            <label htmlFor="project-select" className="text-sm font-medium text-gray-300 block mb-2">
              Scope
            </label>
            <select
              id="project-select"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all duration-200"
            >
              <option value="">Global (all projects)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              {selectedProject
                ? 'Configure notifications for this specific project. Project settings override global settings.'
                : 'Configure default notification preferences for all projects.'}
            </p>
          </div>

          {/* Notification types */}
          <div className="px-6 py-4">
            <h3 className="text-sm font-medium text-gray-300 mb-4">Notification Types</h3>
            <div className="space-y-3">
              {notificationTypes.map((type) => {
                const key = `${selectedProject || 'global'}-${type.value}`;
                const isEnabled = typePreferences[key] !== false;
                const channels = channelPreferences[key] || ['in_app'];

                return (
                  <div
                    key={type.value}
                    className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 hover:border-gray-600/50 transition-all duration-200"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={type.svg} />
                          </svg>
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-white">{type.label}</p>
                            <button
                              onClick={() => handleTypeToggle(type.value)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                                isEnabled ? 'bg-indigo-600' : 'bg-gray-600'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                                  isEnabled ? 'translate-x-5' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {isEnabled ? 'Enabled' : 'Disabled'}
                          </p>
                        </div>
                      </div>

                      {/* Channel toggles */}
                      {isEnabled && (
                        <div className="flex items-center gap-3 animate-preference-toggle">
                          <button
                            onClick={() => handleChannelToggle('in_app', type.value)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                              channels.includes('in_app')
                                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                                : 'bg-gray-700/50 text-gray-500 border border-gray-600 hover:bg-gray-700'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                            </svg>
                            In-app
                          </button>
                          <button
                            onClick={() => handleChannelToggle('email', type.value)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                              channels.includes('email')
                                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                                : 'bg-gray-700/50 text-gray-500 border border-gray-600 hover:bg-gray-700'
                            }`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Email
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
