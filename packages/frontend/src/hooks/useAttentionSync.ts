import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../api/socket.js';
import { useAttentionStore } from '../stores/attention-store.js';

export function useAttentionSync(projectId: string) {
  const addItem = useAttentionStore((s) => s.addItem);
  const removeItem = useAttentionStore((s) => s.removeItem);
  const qc = useQueryClient();

  useEffect(() => {
    if (!projectId) return;

    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    socket.on('attention:created', (data) => {
      // Backend sends { item } per typed events
      const item = 'item' in data ? data.item : (data as never);
      addItem(item);
      qc.invalidateQueries({ queryKey: ['attention-count'] });
    });

    socket.on('attention:resolved', (data) => {
      // Backend broadcasts full item or { itemId, status }
      const id = 'itemId' in data ? data.itemId : (data as { id: string }).id;
      removeItem(id);
      qc.invalidateQueries({ queryKey: ['attention', projectId] });
      qc.invalidateQueries({ queryKey: ['attention-count'] });
    });

    // attention:dismissed not in typed events, but backend emits it
    // Handle via the same channel pattern
    (socket as unknown as { on: (event: string, cb: (data: unknown) => void) => void }).on(
      'attention:dismissed',
      (data: unknown) => {
        const d = data as { id?: string; itemId?: string };
        const id = d.itemId ?? d.id;
        if (id) removeItem(id);
        qc.invalidateQueries({ queryKey: ['attention', projectId] });
        qc.invalidateQueries({ queryKey: ['attention-count'] });
      },
    );

    return () => {
      socket.off('attention:created');
      socket.off('attention:resolved');
      (socket as unknown as { off: (event: string) => void }).off('attention:dismissed');
    };
  }, [projectId, addItem, removeItem, qc]);
}
