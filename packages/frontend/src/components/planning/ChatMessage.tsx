import type { ChatMessage as ChatMessageType } from '@ai-jam/shared';

interface ChatMessageProps {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <p className="text-xs text-gray-500 italic bg-gray-800/50 px-3 py-1.5 rounded-full">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom duration-200`}>
      <div
        className={`max-w-[85%] rounded-xl px-4 py-3 transition-all ${
          isUser
            ? 'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 hover:shadow-md hover:shadow-indigo-500/20 active:scale-95'
            : 'bg-gray-800 border border-gray-700 text-gray-200 hover:border-gray-600 hover:shadow-md hover:shadow-gray-900/10 active:scale-95'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-medium ${isUser ? 'text-indigo-200' : 'text-gray-400'}`}>
            {isUser ? 'You' : 'Claude'}
          </span>
          <span className={`text-xs ${isUser ? 'text-indigo-300' : 'text-gray-600'}`}>
            {new Date(message.createdAt).toLocaleTimeString()}
          </span>
        </div>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</div>
      </div>
    </div>
  );
}
