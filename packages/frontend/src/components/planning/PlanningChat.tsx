import { useState, useRef, useEffect } from 'react';
import { useChatSession } from '../../api/queries.js';
import { useSendChatMessage } from '../../api/mutations.js';
import { getSocket } from '../../api/socket.js';
import ChatMessage from './ChatMessage.js';
import type { ChatMessage as ChatMessageType } from '@ai-jam/shared';

interface PlanningChatProps {
  sessionId: string;
  featureId: string;
}

export default function PlanningChat({ sessionId, featureId }: PlanningChatProps) {
  const { data: session } = useChatSession(sessionId);
  const sendMessage = useSendChatMessage(sessionId);
  const [input, setInput] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [localMessages, setLocalMessages] = useState<ChatMessageType[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync server messages
  useEffect(() => {
    if (session?.messages) {
      setLocalMessages(session.messages);
    }
  }, [session?.messages]);

  // Subscribe to real-time chat events
  useEffect(() => {
    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    const onMessage = (data: { sessionId: string; role: string; content: string }) => {
      if (data.sessionId !== sessionId) return;

      if (data.role === 'assistant_stream') {
        // Streaming chunk
        setStreamingContent((prev) => prev + data.content);
      } else if (data.role === 'assistant') {
        // Complete message — replace streaming content
        setStreamingContent('');
        setLocalMessages((prev) => {
          // Avoid duplicates
          const exists = prev.some(
            (m) => m.role === 'assistant' && m.content === data.content
          );
          if (exists) return prev;
          return [
            ...prev,
            {
              id: `live-${Date.now()}`,
              chatSessionId: sessionId,
              role: 'assistant' as const,
              content: data.content,
              structuredActions: null,
              createdAt: new Date().toISOString(),
            },
          ];
        });
      }
    };

    socket.on('chat:message', onMessage);
    return () => {
      socket.off('chat:message', onMessage);
    };
  }, [sessionId]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [localMessages, streamingContent]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sendMessage.isPending) return;

    const content = input.trim();
    setInput('');

    // Optimistic: add user message locally
    setLocalMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        chatSessionId: sessionId,
        role: 'user',
        content,
        structuredActions: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    await sendMessage.mutateAsync(content);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {localMessages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Streaming indicator */}
        {streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-xl px-4 py-3 bg-gray-800 border border-gray-700 text-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-400">Claude</span>
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              </div>
              <div className="text-sm whitespace-pre-wrap">{streamingContent}</div>
            </div>
          </div>
        )}

        {localMessages.length === 0 && !streamingContent && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-2">Start planning your feature</p>
              <p className="text-gray-600 text-xs">
                Describe what you want to build and Claude will help you break it into tickets.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-4">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your feature or ask Claude to plan..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
            disabled={sendMessage.isPending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sendMessage.isPending}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 shrink-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
