import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '../config/api';

const EVENT_WATCH_SETTINGS_KEY = 'eventWatchSettings';

export interface EventWatchPreferences {
  spotsAvailable: boolean;
  generalUpdates: boolean;
  rosterChanges: boolean;
  reminders: boolean;
}

export interface EventWatchConfig {
  eventId: string;
  eventName: string;
  eventDate?: string;
  eventTime?: string;
  preferences: EventWatchPreferences;
  updatedAt: string;
}

type WatchMap = Record<string, EventWatchConfig>;

const DEFAULT_WATCH_PREFERENCES: EventWatchPreferences = {
  spotsAvailable: true,
  generalUpdates: true,
  rosterChanges: false,
  reminders: false,
};

class EventWatchService {
  getDefaultPreferences(): EventWatchPreferences {
    return {...DEFAULT_WATCH_PREFERENCES};
  }

  async getAllWatches(): Promise<WatchMap> {
    try {
      const raw = await AsyncStorage.getItem(EVENT_WATCH_SETTINGS_KEY);
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return {};
      }

      return parsed as WatchMap;
    } catch (error) {
      console.error('Error loading watched events:', error);
      return {};
    }
  }

  async getWatch(eventId: string): Promise<EventWatchConfig | null> {
    const watches = await this.getAllWatches();
    return watches[eventId] || null;
  }

  async getWatchedEventIds(): Promise<string[]> {
    const watches = await this.getAllWatches();
    return Object.keys(watches);
  }

  async isWatching(eventId: string): Promise<boolean> {
    const watch = await this.getWatch(eventId);
    return !!watch;
  }

  async watchEvent(input: {
    eventId: string;
    eventName: string;
    eventDate?: string;
    eventTime?: string;
    preferences: EventWatchPreferences;
  }): Promise<void> {
    const watches = await this.getAllWatches();

    watches[input.eventId] = {
      eventId: input.eventId,
      eventName: input.eventName,
      eventDate: input.eventDate,
      eventTime: input.eventTime,
      preferences: {
        ...DEFAULT_WATCH_PREFERENCES,
        ...input.preferences,
      },
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(
      EVENT_WATCH_SETTINGS_KEY,
      JSON.stringify(watches),
    );
    await this.syncWatchWithBackend(watches[input.eventId], true);
  }

  async unwatchEvent(eventId: string): Promise<void> {
    const watches = await this.getAllWatches();
    const existing = watches[eventId];
    delete watches[eventId];

    await AsyncStorage.setItem(
      EVENT_WATCH_SETTINGS_KEY,
      JSON.stringify(watches),
    );

    if (existing) {
      await this.syncWatchWithBackend(existing, false);
    }
  }

  private async syncWatchWithBackend(
    watch: EventWatchConfig,
    watching: boolean,
  ): Promise<void> {
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      if (!userToken) {
        return;
      }

      const endpoint = `${API_BASE_URL}/api/events/${watch.eventId}/watch`;
      const response = await fetch(endpoint, {
        method: watching ? 'PUT' : 'DELETE',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': 'application/json',
        },
        body: watching
          ? JSON.stringify({
              eventName: watch.eventName,
              eventDate: watch.eventDate,
              eventTime: watch.eventTime,
              preferences: watch.preferences,
            })
          : undefined,
      });

      // Some environments may not have this endpoint yet.
      if (!response.ok && response.status !== 404) {
        console.log(
          `Watch sync failed for event ${watch.eventId} with status ${response.status}`,
        );
      }
    } catch (error) {
      // Keep local state as source of truth when offline/backend unavailable.
      console.log('Unable to sync watch preferences with backend:', error);
    }
  }
}

export const eventWatchService = new EventWatchService();
export default eventWatchService;
