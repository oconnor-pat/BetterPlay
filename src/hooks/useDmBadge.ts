// Unread count for the Messages tab badge.
//
// The badge counts *threads* needing attention (unread conversations plus
// pending requests) rather than individual messages: "3" should mean
// three people are waiting on you, not that one person sent three lines.
//
// Rather than mirror the server's arithmetic locally, this refetches the
// count whenever DM state changes on the socket. The endpoint is a couple
// of bounded counts and DM traffic is low, so the simplicity is worth
// more than the saved request — and it can't drift out of sync.

import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {useSocket} from '../Context/SocketContext';
import {fetchDmUnreadCounts} from '../services/DirectMessageService';

export const useDmBadge = (enabled: boolean = true): number => {
  const {subscribe} = useSocket();
  const [count, setCount] = useState(0);
  // Coalesce the burst of events a single send produces into one request.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    if (!enabled) {
      return;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(async () => {
      try {
        const counts = await fetchDmUnreadCounts();
        setCount(counts.unreadThreads + counts.requests);
      } catch {
        // Leave the last known value rather than flashing to zero.
      }
    }, 250);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    refresh();
    const unsubs = [
      subscribe('dm:activity', refresh),
      subscribe('dm:read', refresh),
      subscribe('dm:conversation:updated', refresh),
      subscribe('dm:conversation:cleared', refresh),
    ];
    const appState = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (next === 'active') {
          refresh();
        }
      },
    );
    return () => {
      unsubs.forEach(u => u());
      appState.remove();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [enabled, refresh, subscribe]);

  return count;
};

export default useDmBadge;
