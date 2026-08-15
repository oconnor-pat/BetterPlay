// Unread count for the Groups tab badge.
//
// Counts *groups* with unread messages (not total message volume), matching
// the DM badge's "threads needing attention" semantics so both tabs read
// the same way.
//
// Refetches on group activity / read / foreground rather than mirroring
// counts locally — DM traffic pattern, same tradeoff.

import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, AppStateStatus} from 'react-native';
import {useSocket} from '../Context/SocketContext';
import {fetchGroupUnreadCounts} from '../services/GroupsService';

export const useGroupBadge = (enabled: boolean = true): number => {
  const {subscribe} = useSocket();
  const [count, setCount] = useState(0);
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
        const counts = await fetchGroupUnreadCounts();
        setCount(counts.unreadGroups);
      } catch {
        // Keep last known value rather than flashing to zero.
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
      subscribe('group:activity', refresh),
      subscribe('group:read', refresh),
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

export default useGroupBadge;
