import { useCallback, useRef } from 'react';

const STORAGE_KEY = 'ai-jam:session-last-seen';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type LastSeenMap = Record<string, string>; // sessionId -> ISO timestamp

function readMap(): LastSeenMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeMap(map: LastSeenMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function cleanupOldEntries(map: LastSeenMap): LastSeenMap {
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const cleaned: LastSeenMap = {};
  for (const [id, ts] of Object.entries(map)) {
    if (new Date(ts).getTime() > cutoff) {
      cleaned[id] = ts;
    }
  }
  return cleaned;
}

/**
 * Tracks which sessions the user has viewed via localStorage.
 * Returns helpers to check unread state and mark sessions as seen.
 */
export function useSessionLastSeen() {
  const cleanedRef = useRef(false);

  // Run cleanup once per mount
  if (!cleanedRef.current) {
    cleanedRef.current = true;
    const map = readMap();
    const cleaned = cleanupOldEntries(map);
    if (Object.keys(cleaned).length !== Object.keys(map).length) {
      writeMap(cleaned);
    }
  }

  const isUnread = useCallback((sessionId: string, lastActivityAt: string | undefined | null): boolean => {
    if (!lastActivityAt) return false;
    const map = readMap();
    const lastSeen = map[sessionId];
    if (!lastSeen) return true; // never viewed = unread
    return new Date(lastActivityAt) > new Date(lastSeen);
  }, []);

  const markSeen = useCallback((sessionId: string) => {
    const map = readMap();
    map[sessionId] = new Date().toISOString();
    writeMap(map);
  }, []);

  return { isUnread, markSeen };
}
