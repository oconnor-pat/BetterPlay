import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import axios from 'axios';

export interface Event {
  _id: string;
  name: string;
  location: string;
  time: string;
  date: string;
  rosterSpotsFilled: number;
  totalSpots: number;
  eventType: string;
  createdBy: string;
  createdByUsername?: string;
  latitude?: number;
  longitude?: number;
}

interface EventContextType {
  events: Event[];
  fetchEvents: () => Promise<void>;
  updateRosterSpots: (eventId: string, newRosterCount: number) => void;
  setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

const API_BASE_URL = 'http://localhost:8001';

export const EventProvider = ({children}: {children: ReactNode}) => {
  const [events, setEvents] = useState<Event[]>([]);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/events`);
      setEvents(response.data);
    } catch (error) {
      // Optionally handle error (e.g., set error state)
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

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
