import { useToastStore, type ToastType } from '../../stores/toast-store.js';

const TYPE_STYLES: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'bg-green-900/90', border: 'border-green-700', icon: '\u2713' },
  error: { bg: 'bg-red-900/90', border: 'border-red-700', icon: '\u2717' },
  info: { bg: 'bg-blue-900/90', border: 'border-blue-700', icon: '\u2139' },
  warning: { bg: 'bg-yellow-900/90', border: 'border-yellow-700', icon: '\u26A0' },
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const style = TYPE_STYLES[toast.type];
        return (
          <div
            key={toast.id}
            className={`${style.bg} ${style.border} border rounded-lg px-4 py-3 shadow-lg flex items-start gap-2 animate-in slide-in-from-right`}
          >
            <span className="text-sm shrink-0 mt-0.5">{style.icon}</span>
            <p className="text-sm text-white flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-white text-sm shrink-0 ml-2"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}
