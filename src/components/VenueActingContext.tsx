import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '../config/api';
import UserContext, {ManagedVenue, UserContextType} from './UserContext';

export type VenueActingAs = {
  venueUserId: string;
  username: string;
  name: string;
  profilePicUrl?: string;
  managedVenue: ManagedVenue;
  role: 'owner' | 'admin';
};

type VenueActingContextType = {
  actingAs: VenueActingAs[];
  pendingInvites: VenueActingAs[];
  activeVenueUserId: string | null;
  activeVenue: VenueActingAs | null;
  setActiveVenueUserId: (id: string | null) => void;
  refreshMemberships: () => Promise<void>;
  acceptInvite: (venueUserId: string) => Promise<void>;
  declineInvite: (venueUserId: string) => Promise<void>;
};

const VenueActingContext = createContext<VenueActingContextType | undefined>(
  undefined,
);

const ACTIVE_VENUE_KEY = 'activeVenueUserId';

export const VenueActingProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const {userData} = useContext(UserContext) as UserContextType;
  const [actingAs, setActingAs] = useState<VenueActingAs[]>([]);
  const [pendingInvites, setPendingInvites] = useState<VenueActingAs[]>([]);
  const [activeVenueUserId, setActiveVenueUserIdState] = useState<string | null>(
    null,
  );

  const setActiveVenueUserId = useCallback(async (id: string | null) => {
    setActiveVenueUserIdState(id);
    if (id) {
      await AsyncStorage.setItem(ACTIVE_VENUE_KEY, id);
    } else {
      await AsyncStorage.removeItem(ACTIVE_VENUE_KEY);
    }
  }, []);

  const refreshMemberships = useCallback(async () => {
    if (!userData?._id) {
      setActingAs([]);
      setPendingInvites([]);
      return;
    }
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        return;
      }
      const res = await fetch(`${API_BASE_URL}/venues/memberships`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const list: VenueActingAs[] = Array.isArray(data.actingAs)
        ? data.actingAs
        : [];
      const pending: VenueActingAs[] = Array.isArray(data.pendingInvites)
        ? data.pendingInvites.map((p: any) => ({
            ...p,
            role: 'admin' as const,
          }))
        : [];
      setActingAs(list);
      setPendingInvites(pending);

      const stored = await AsyncStorage.getItem(ACTIVE_VENUE_KEY);
      if (stored && list.some(v => v.venueUserId === stored)) {
        setActiveVenueUserIdState(stored);
      } else if (list.length === 1) {
        setActiveVenueUserIdState(list[0].venueUserId);
        await AsyncStorage.setItem(ACTIVE_VENUE_KEY, list[0].venueUserId);
      } else if (stored && !list.some(v => v.venueUserId === stored)) {
        setActiveVenueUserIdState(null);
        await AsyncStorage.removeItem(ACTIVE_VENUE_KEY);
      }
    } catch {
      // non-fatal
    }
  }, [userData?._id]);

  useEffect(() => {
    refreshMemberships().catch(() => {});
  }, [refreshMemberships]);

  const acceptInvite = useCallback(
    async (venueUserId: string) => {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        return;
      }
      await fetch(`${API_BASE_URL}/venues/${venueUserId}/admins/accept`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`},
      });
      await refreshMemberships();
    },
    [refreshMemberships],
  );

  const declineInvite = useCallback(
    async (venueUserId: string) => {
      const token = await AsyncStorage.getItem('userToken');
      if (!token) {
        return;
      }
      await fetch(`${API_BASE_URL}/venues/${venueUserId}/admins/decline`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`},
      });
      await refreshMemberships();
    },
    [refreshMemberships],
  );

  const activeVenue = useMemo(
    () => actingAs.find(v => v.venueUserId === activeVenueUserId) || null,
    [actingAs, activeVenueUserId],
  );

  const value = useMemo(
    () => ({
      actingAs,
      pendingInvites,
      activeVenueUserId,
      activeVenue,
      setActiveVenueUserId,
      refreshMemberships,
      acceptInvite,
      declineInvite,
    }),
    [
      actingAs,
      pendingInvites,
      activeVenueUserId,
      activeVenue,
      setActiveVenueUserId,
      refreshMemberships,
      acceptInvite,
      declineInvite,
    ],
  );

  return (
    <VenueActingContext.Provider value={value}>
      {children}
    </VenueActingContext.Provider>
  );
};

export function useVenueActing(): VenueActingContextType {
  const ctx = useContext(VenueActingContext);
  if (!ctx) {
    throw new Error('useVenueActing must be used within VenueActingProvider');
  }
  return ctx;
}

export default VenueActingContext;
