import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

let toastId = 0;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  addToast: (type, message, duration = 4000) => {
    const id = `toast-${++toastId}`;
    const toast: Toast = { id, type, message, duration };

    set({ toasts: [...get().toasts, toast] });

    // Auto-remove after duration
    setTimeout(() => {
      get().removeToast(id);
    }, duration);
  },

  removeToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

// Convenience helpers for use outside React components
export const toast = {
  success: (msg: string) => useToastStore.getState().addToast('success', msg),
  error: (msg: string) => useToastStore.getState().addToast('error', msg, 6000),
  info: (msg: string) => useToastStore.getState().addToast('info', msg),
  warning: (msg: string) => useToastStore.getState().addToast('warning', msg, 5000),
};
