import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

interface EnhancedToastProps {
  toast: Toast;
  onClose: (id: string) => void;
  position?: ToastPosition;
}

const icons: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

const colors: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    icon: 'text-green-400',
  },
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-400',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
  },
  info: {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    icon: 'text-indigo-400',
  },
};

export default function EnhancedToast({ toast, onClose, position = 'top-right' }: EnhancedToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => Math.min(100, prev + 2));
    }, (toast.duration || 4000) / 50);

    return () => clearInterval(interval);
  }, [toast.duration]);

  useEffect(() => {
    const duration = toast.duration || 4000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose(toast.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast.duration, toast.id, onClose]);

  const positionClasses = {
    'top-right': 'right-0 top-0',
    'top-left': 'left-0 top-0',
    'bottom-right': 'right-0 bottom-0',
    'bottom-left': 'left-0 bottom-0',
  };

  return (
    <div
      className={`fixed ${positionClasses[position]} z-50 p-3 animate-in slide-in-from-top-${position.includes('right') ? 'right' : 'left'} duration-300 ${
        isExiting ? 'animate-out fade-out duration-300' : ''
      }`}
    >
      <div
        className={`
          relative bg-gray-900 border rounded-xl shadow-2xl max-w-sm overflow-hidden
          ${colors[toast.type].bg} ${colors[toast.type].border}
          transition-all duration-300
        `}
      >
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-1 bg-gray-800">
          <div
            className={`h-full ${colors[toast.type].icon.replace('text', 'bg')} transition-all duration-75`}
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Glow effect */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${
            toast.type === 'success'
              ? 'from-green-500/5 to-emerald-500/5'
              : toast.type === 'error'
              ? 'from-red-500/5 to-rose-500/5'
              : toast.type === 'warning'
              ? 'from-amber-500/5 to-orange-500/5'
              : 'from-indigo-500/5 to-purple-500/5'
          } rounded-xl blur-md -z-10 pointer-events-none`}
        />

        {/* Content */}
        <div className="relative flex items-start gap-3 p-4">
          {/* Icon */}
          <div className={`flex-shrink-0 ${colors[toast.type].icon} text-xl animate-in zoom-in-95 duration-200`}>
            {icons[toast.type]}
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-semibold text-sm mb-1">{toast.title}</h4>
            {toast.message && (
              <p className="text-gray-400 text-xs leading-relaxed">{toast.message}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {toast.action && (
              <button
                onClick={toast.action.onClick}
                className="text-indigo-400 hover:text-indigo-300 text-xs font-medium px-2 py-1 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 transition-all active:scale-95"
              >
                {toast.action.label}
              </button>
            )}
            {toast.dismissible !== false && (
              <button
                onClick={() => {
                  setIsExiting(true);
                  setTimeout(() => onClose(toast.id), 300);
                }}
                className="text-gray-500 hover:text-gray-400 p-1 rounded-lg hover:bg-gray-800/50 transition-all active:scale-95"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Toast container for managing multiple toasts
interface ToastContainerProps {
  toasts: Toast[];
  onClose: (id: string) => void;
  position?: ToastPosition;
  maxToasts?: number;
}

export function ToastContainer({
  toasts,
  onClose,
  position = 'top-right',
  maxToasts = 5,
}: ToastContainerProps) {
  const visibleToasts = toasts.slice(0, maxToasts);

  return (
    <div className={`fixed ${position === 'top-right' ? 'right-4 top-4' : position === 'top-left' ? 'left-4 top-4' : position === 'bottom-right' ? 'right-4 bottom-4' : 'left-4 bottom-4'} z-50 flex flex-col gap-2`}>
      {visibleToasts.map((toast) => (
        <EnhancedToast key={toast.id} toast={toast} onClose={onClose} position={position} />
      ))}
    </div>
  );
}

// Hook for managing toasts
interface UseToastsReturn {
  toasts: Toast[];
  success: (title: string, message?: string, action?: Toast['action']) => void;
  error: (title: string, message?: string, action?: Toast['action']) => void;
  warning: (title: string, message?: string, action?: Toast['action']) => void;
  info: (title: string, message?: string, action?: Toast['action']) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export function useToasts(): UseToastsReturn {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (type: ToastType, title: string, message?: string, action?: Toast['action']) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, message, action, dismissible: true }]);

    // Auto-dismiss after duration
    const duration = 4000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  return {
    toasts,
    success: (title, message, action) => addToast('success', title, message, action),
    error: (title, message, action) => addToast('error', title, message, action),
    warning: (title, message, action) => addToast('warning', title, message, action),
    info: (title, message, action) => addToast('info', title, message, action),
    dismiss: (id) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    dismissAll: () => setToasts([]),
  };
}
