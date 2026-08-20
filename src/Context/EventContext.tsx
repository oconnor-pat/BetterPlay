import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '../config/api';

export interface Event {
  _id: string;
  name: string;
  location: string;
  time: string;
  durationMinutes?: number;
  date: string;
  rosterSpotsFilled: number;
  totalSpots: number;
  eventType: string;
  createdBy: string;
  createdByUsername?: string;
  createdByProfilePicUrl?: string;
  latitude?: number;
  longitude?: number;
  isRecurring?: boolean;
  recurrenceGroupId?: string;
  recurrenceFrequency?: string;
  recurrenceOffsetsDays?: number[];
  waitlist?: Array<{userId: string; username: string; profilePicUrl?: string; joinedAt: string}>;
}

interface EventContextType {
  events: Event[];
  fetchEvents: () => Promise<void>;
  updateRosterSpots: (eventId: string, newRosterCount: number) => void;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const EventProvider = ({children}: {children: ReactNode}) => {
  const [events, setEvents] = useState<Event[]>([]);

  // Memoized so consumers can safely use it as an effect dependency (e.g. a
  // refetch-on-focus listener) without re-subscribing on every render.
  const fetchEvents = useCallback(async () => {
    try {
      // Send the JWT: `GET /events` is privacy-scoped server-side, so an
      // anonymous request silently drops the caller's private/invite-only
      // events and returns public ones redacted (empty roster). Anything
      // counting or listing "my events" from this array would be wrong.
      // There's no global axios interceptor in this codebase, so attach it
      // here the same way the other authed calls do.
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get(`${API_BASE_URL}/events`, {
        headers: token ? {Authorization: `Bearer ${token}`} : {},
      });
      setEvents(response.data);
      // Cache for faster startup
      AsyncStorage.setItem('cachedEvents', JSON.stringify(response.data));
    } catch (error) {
      // Optionally handle error (e.g., set error state)
    }
  }, []);

  // Load cached events immediately, fetch fresh in background
  useEffect(() => {
    const loadEvents = async () => {
      // Try to load cached events first for instant display
      try {
        const cached = await AsyncStorage.getItem('cachedEvents');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setEvents(parsed);
          }
        }
      } catch {
        // Ignore cache errors
      }
      // Always fetch fresh data in background
      fetchEvents();
    };
    loadEvents();
  }, [fetchEvents]);

  const updateRosterSpots = (eventId: string, newRosterCount: number) => {
    setEvents(prev =>
      prev.map(event =>
        event._id === eventId
          ? {...event, rosterSpotsFilled: newRosterCount}
          : event,
      ),
    );
  };

  return (
    <EventContext.Provider
      value={{events, fetchEvents, updateRosterSpots, setEvents}}>
      {children}
    </EventContext.Provider>
  );
};

export const useEventContext = () => {
  const ctx = useContext(EventContext);
  if (!ctx) {
    throw new Error('useEventContext must be used within EventProvider');
  }
  return ctx;
};
