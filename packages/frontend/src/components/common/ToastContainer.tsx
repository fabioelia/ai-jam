import { useToastStore, type ToastType, type Toast } from '../../stores/toast-store.js';
import { useEffect, useRef } from 'react';

const TYPE_STYLES: Record<ToastType, { bg: string; border: string; icon: string; iconColor: string }> = {
  success: { bg: 'bg-green-900/95', border: 'border-green-700', icon: '\u2713', iconColor: 'text-green-400' },
  error: { bg: 'bg-red-900/95', border: 'border-red-700', icon: '\u2717', iconColor: 'text-red-400' },
  info: { bg: 'bg-blue-900/95', border: 'border-blue-700', icon: '\u2139', iconColor: 'text-blue-400' },
  warning: { bg: 'bg-yellow-900/95', border: 'border-yellow-700', icon: '\u26A0', iconColor: 'text-yellow-400' },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const style = TYPE_STYLES[toast.type];
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (progressRef.current) {
      // Force reflow to restart animation
      progressRef.current.style.animation = 'none';
      progressRef.current.offsetHeight; // Trigger reflow
      progressRef.current.style.animation = `toast-progress ${toast.duration}ms linear forwards`;
    }
  }, [toast.duration]);

  return (
    <div className="relative overflow-hidden rounded-lg shadow-xl backdrop-blur-sm animate-in slide-in-from-right duration-300 hover:scale-[1.02] transition-transform duration-200">
      <div className={`${style.bg} ${style.border} border rounded-lg px-4 py-3 flex items-start gap-3`}>
        <span className={`text-base shrink-0 mt-0.5 ${style.iconColor} font-bold`}>{style.icon}</span>
        <p className="text-sm text-white flex-1 leading-relaxed">{toast.message}</p>
        <button
          onClick={() => onRemove(toast.id)}
          className="text-gray-400 hover:text-white text-base shrink-0 ml-2 transition-colors p-0.5 rounded hover:bg-white/10"
          aria-label="Dismiss notification"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 h-0.5 bg-white/20">
        <div
          ref={progressRef}
          className="h-full bg-white/40"
          style={{
            animation: `toast-progress ${toast.duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}
