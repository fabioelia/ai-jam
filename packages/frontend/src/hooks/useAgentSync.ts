import { useEffect } from 'react';
import { getSocket } from '../api/socket.js';
import { useAgentStore } from '../stores/agent-store.js';

/**
 * Subscribes to Socket.IO agent events and updates the agent store.
 */
export function useAgentSync(projectId: string) {
  const sessionStarted = useAgentStore((s) => s.sessionStarted);
  const sessionActivity = useAgentStore((s) => s.sessionActivity);
  const sessionOutput = useAgentStore((s) => s.sessionOutput);
  const sessionCompleted = useAgentStore((s) => s.sessionCompleted);

  useEffect(() => {
    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    const onStarted = (data: { sessionId: string; ticketId: string | null; personaType: string }) => {
      sessionStarted(data.sessionId, data.ticketId, data.personaType);
    };

    const onActivity = (data: { sessionId: string; activity: 'busy' | 'waiting' | 'idle' }) => {
      sessionActivity(data.sessionId, data.activity);
    };

    const onOutput = (data: { sessionId: string; chunk: string }) => {
      sessionOutput(data.sessionId, data.chunk);
    };

    const onCompleted = (data: { sessionId: string; summary: string | null; failed?: boolean }) => {
      sessionCompleted(data.sessionId, data.summary, data.failed);
    };

    socket.on('agent:session:started', onStarted);
    socket.on('agent:session:activity', onActivity);
    socket.on('agent:session:output', onOutput);
    socket.on('agent:session:completed', onCompleted);

    return () => {
      socket.off('agent:session:started', onStarted);
      socket.off('agent:session:activity', onActivity);
      socket.off('agent:session:output', onOutput);
      socket.off('agent:session:completed', onCompleted);
    };
  }, [projectId, sessionStarted, sessionActivity, sessionOutput, sessionCompleted]);
}
