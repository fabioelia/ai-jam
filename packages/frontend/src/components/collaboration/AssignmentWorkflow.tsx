import { useState, useCallback, useMemo } from 'react';
import type { Ticket, User, ProjectMember } from '@ai-jam/shared';
import { useAuthStore } from '../../stores/auth-store.js';
import { toast } from '../../stores/toast-store.js';
import Button from '../common/Button.js';
import EmptyState from '../common/EmptyState.js';

interface AssignmentWorkflowProps {
  ticket: Ticket;
  users?: User[];
  projectMembers?: ProjectMember[];
  onAssign: (ticketId: string, userId: string | null, persona: string | null) => Promise<void>;
  onReassign: (ticketId: string, fromUserId: string, toUserId: string | null, persona: string | null) => Promise<void>;
  onUnassign: (ticketId: string, userId: string) => Promise<void>;
  currentUser: User;
  isAssigning?: boolean;
  isReassigning?: boolean;
  isUnassigning?: boolean;
}

type AssignmentMode = 'user' | 'persona' | 'both';

export default function AssignmentWorkflow({
  ticket,
  users = [],
  projectMembers = [],
  onAssign,
  onReassign,
  onUnassign,
  currentUser,
  isAssigning = false,
  isReassigning = false,
  isUnassigning = false,
}: AssignmentWorkflowProps) {
  const [mode, setMode] = useState<AssignmentMode>('both');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(ticket.assignedUserId);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(ticket.assignedPersona);
  const [assignmentReason, setAssignmentReason] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const PERSONA_OPTIONS = [
    { value: 'orchestrator', label: 'Orchestrator', icon: '🎯' },
    { value: 'implementer', label: 'Implementer', icon: '🔧' },
    { value: 'reviewer', label: 'Reviewer', icon: '👁️' },
    { value: 'qa_tester', label: 'QA Tester', icon: '🔍' },
    { value: 'acceptance_validator', label: 'Acceptance Validator', icon: '✅' },
    { value: 'planner', label: 'Planner', icon: '📋' },
    { value: 'developer', label: 'Developer', icon: '💻' },
    { value: 'product', label: 'Product', icon: '📱' },
    { value: 'business_rules', label: 'Business Rules', icon: '📊' },
    { value: 'qa', label: 'QA', icon: '✨' },
    { value: 'researcher', label: 'Researcher', icon: '🔬' },
  ];

  // Get available users for assignment
  const availableUsers = useMemo(() => {
    const memberUsers = projectMembers
      .map((member) => {
        const user = users.find((u) => u.id === member.userId);
        return user ? { ...user, role: member.role } : null;
      })
      .filter(Boolean) as Array<User & { role: string }>;

    // Include current user if not in members
    if (currentUser && !memberUsers.find((u) => u.id === currentUser.id)) {
      memberUsers.push({ ...currentUser, role: 'owner' });
    }

    return memberUsers;
  }, [projectMembers, users, currentUser]);

  // Get current assignment info
  const currentAssignment = useMemo(() => {
    if (!ticket.assignedUserId && !ticket.assignedPersona) {
      return null;
    }

    const user = users.find((u) => u.id === ticket.assignedUserId);
    const persona = PERSONA_OPTIONS.find((p) => p.value === ticket.assignedPersona);

    return {
      user,
      persona,
      assignedAt: new Date().toISOString(), // In real implementation, this would come from the ticket
    };
  }, [ticket.assignedUserId, ticket.assignedPersona, users]);

  // Handle assignment
  const handleAssign = useCallback(async () => {
    try {
      await onAssign(ticket.id, selectedUserId, selectedPersona);

      const assignedTo = [];
      if (selectedUserId) {
        const user = users.find((u) => u.id === selectedUserId);
        if (user) assignedTo.push(user.name);
      }
      if (selectedPersona) {
        assignedTo.push(selectedPersona.replace(/_/g, ' '));
      }

      toast.success(`Ticket assigned to ${assignedTo.join(' and ')}`);
      setShowAssignDialog(false);
      setAssignmentReason('');
    } catch (err) {
      toast.error('Failed to assign ticket');
      console.error('Assignment error:', err);
    }
  }, [ticket.id, selectedUserId, selectedPersona, onAssign, users]);

  // Handle reassignment
  const handleReassign = useCallback(async () => {
    if (!ticket.assignedUserId) {
      toast.error('No user assigned to reassign');
      return;
    }

    try {
      await onReassign(ticket.id, ticket.assignedUserId, selectedUserId, selectedPersona);
      toast.success('Ticket reassigned successfully');
      setShowReassignDialog(false);
      setAssignmentReason('');
    } catch (err) {
      toast.error('Failed to reassign ticket');
      console.error('Reassignment error:', err);
    }
  }, [ticket.id, ticket.assignedUserId, selectedUserId, selectedPersona, onReassign]);

  // Handle unassignment
  const handleUnassign = useCallback(async () => {
    if (!ticket.assignedUserId) {
      toast.error('No user assigned to unassign');
      return;
    }

    try {
      await onUnassign(ticket.id, ticket.assignedUserId);
      toast.success('Ticket unassigned successfully');
      setShowReassignDialog(false);
    } catch (err) {
      toast.error('Failed to unassign ticket');
      console.error('Unassignment error:', err);
    }
  }, [ticket.id, ticket.assignedUserId, onUnassign]);

  const canAssign = useMemo(() => {
    // In real implementation, check permissions
    return true;
  }, [currentUser]);

  const canReassign = useMemo(() => {
    // In real implementation, check permissions
    return ticket.assignedUserId !== null;
  }, [ticket.assignedUserId, currentUser]);

  const isCurrentUserAssigned = ticket.assignedUserId === currentUser.id;

  if (!canAssign) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Current Assignment */}
      <div className="bg-gray-800/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Assignment
        </h3>

        {currentAssignment ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              {currentAssignment.user && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-medium text-white">
                    {currentAssignment.user.avatarUrl ? (
                      <img
                        src={currentAssignment.user.avatarUrl}
                        alt={currentAssignment.user.name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      currentAssignment.user.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{currentAssignment.user.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{currentAssignment.user.id === currentUser.id ? 'You' : 'Team Member'}</p>
                  </div>
                </div>
              )}

              {currentAssignment.persona && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-sm">
                    {currentAssignment.persona.icon}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{currentAssignment.persona.label}</p>
                    <p className="text-xs text-gray-500">AI Agent</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              {canReassign && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReassignDialog(true)}
                  className="text-xs"
                >
                  Reassign
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs"
              >
                History
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            context="ticket-assignment"
            size="sm"
            illustration="static"
            variant="minimal"
            actionLabel="Assign Ticket"
            onAction={() => setShowAssignDialog(true)}
          />
        )}
      </div>

      {/* Assignment History */}
      {showHistory && (
        <div className="bg-gray-800/30 rounded-lg p-4 animate-in fade-in duration-200">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Assignment History</h4>
          <div className="text-sm text-gray-500">
            {/* In real implementation, this would show the full assignment history */}
            <p className="text-gray-600 italic">No assignment history available</p>
          </div>
        </div>
      )}

      {/* Assign Dialog */}
      {showAssignDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-150 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md animate-in zoom-in-95 duration-150 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Assign Ticket</h3>
              <button
                onClick={() => setShowAssignDialog(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Assignment Type</label>
                <div className="flex gap-2">
                  {(['user', 'persona', 'both'] as AssignmentMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`
                        px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-1
                        ${mode === m
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:text-gray-300 hover:bg-gray-700'
                        }
                      `}
                    >
                      {m === 'user' ? 'User' : m === 'persona' ? 'AI Agent' : 'Both'}
                    </button>
                  ))}
                </div>
              </div>

              {/* User Selection */}
              {(mode === 'user' || mode === 'both') && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Assign to User</label>
                  <select
                    value={selectedUserId || ''}
                    onChange={(e) => setSelectedUserId(e.target.value || null)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  >
                    <option value="">No user</option>
                    {availableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} {user.id === currentUser.id ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Persona Selection */}
              {(mode === 'persona' || mode === 'both') && (
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Assign to AI Agent</label>
                  <select
                    value={selectedPersona || ''}
                    onChange={(e) => setSelectedPersona(e.target.value || null)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  >
                    <option value="">No agent</option>
                    {PERSONA_OPTIONS.map((persona) => (
                      <option key={persona.value} value={persona.value}>
                        {persona.icon} {persona.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Assignment Reason */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Reason (optional)</label>
                <textarea
                  value={assignmentReason}
                  onChange={(e) => setAssignmentReason(e.target.value)}
                  placeholder="Why are you assigning this ticket?"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all"
                  rows={2}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowAssignDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAssign}
                  disabled={!selectedUserId && !selectedPersona || isAssigning}
                  className="flex-1"
                >
                  {isAssigning ? 'Assigning...' : 'Assign'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Dialog */}
      {showReassignDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-150 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md animate-in zoom-in-95 duration-150 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">Reassign Ticket</h3>
              <button
                onClick={() => setShowReassignDialog(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Currently assigned to{' '}
                {currentAssignment?.user?.name || currentAssignment?.persona?.label || 'unknown'}
              </p>

              {/* New User Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Reassign to User</label>
                <select
                  value={selectedUserId || ''}
                  onChange={(e) => setSelectedUserId(e.target.value || null)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option value="">No user</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} {user.id === currentUser.id ? '(You)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* New Persona Selection */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">Reassign to AI Agent</label>
                <select
                  value={selectedPersona || ''}
                  onChange={(e) => setSelectedPersona(e.target.value || null)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                >
                  <option value="">No agent</option>
                  {PERSONA_OPTIONS.map((persona) => (
                    <option key={persona.value} value={persona.value}>
                      {persona.icon} {persona.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowReassignDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleUnassign}
                  disabled={isUnassigning}
                  className="flex-1"
                >
                  {isUnassigning ? 'Unassigning...' : 'Unassign'}
                </Button>
                <Button
                  onClick={handleReassign}
                  disabled={!selectedUserId && !selectedPersona || isReassigning}
                  className="flex-1"
                >
                  {isReassigning ? 'Reassigning...' : 'Reassign'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
