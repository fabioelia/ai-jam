import { create } from 'zustand';
import type { AttentionItem } from '@ai-jam/shared';

interface AttentionStore {
  items: AttentionItem[];
  isDrawerOpen: boolean;
  setItems: (items: AttentionItem[]) => void;
  addItem: (item: AttentionItem) => void;
  removeItem: (id: string) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

export const useAttentionStore = create<AttentionStore>((set, get) => ({
  items: [],
  isDrawerOpen: false,

  setItems: (items) => set({ items }),

  addItem: (item) => {
    const existing = get().items;
    if (existing.some((i) => i.id === item.id)) return;
    set({ items: [item, ...existing] });
  },

  removeItem: (id) => {
    set({ items: get().items.filter((i) => i.id !== id) });
  },

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleDrawer: () => set({ isDrawerOpen: !get().isDrawerOpen }),
}));
