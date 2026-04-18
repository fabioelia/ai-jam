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
            <div className="text-center max-w-sm px-6 animate-in fade-in duration-500">
              <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-in scale-in duration-300">
                <svg className="w-8 h-8 text-gray-600 animate-in fade-in duration-500 delay-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-white font-medium mb-2 animate-in fade-in duration-300 delay-200">Start planning your feature</h3>
              <p className="text-gray-500 text-sm animate-in fade-in duration-300 delay-300">
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
            className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-indigo-500/20 active:scale-95"
          >
            {sendMessage.isPending ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending...
              </>
            ) : (
              <>
                Send
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
