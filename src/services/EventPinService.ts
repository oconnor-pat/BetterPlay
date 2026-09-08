import AsyncStorage from '@react-native-async-storage/async-storage';

const PINNED_EVENTS_KEY = 'pinnedEventIds';

/** Client-side pin: floats selected event cards to the top of the Events list. */
class EventPinService {
  async getPinnedIds(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(PINNED_EVENTS_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  async isPinned(eventId: string): Promise<boolean> {
    const ids = await this.getPinnedIds();
    return ids.includes(String(eventId));
  }

  async pinEvent(eventId: string): Promise<string[]> {
    const id = String(eventId);
    const ids = await this.getPinnedIds();
    if (ids.includes(id)) {
      return ids;
    }
    const next = [id, ...ids];
    await AsyncStorage.setItem(PINNED_EVENTS_KEY, JSON.stringify(next));
    return next;
  }

  async unpinEvent(eventId: string): Promise<string[]> {
    const id = String(eventId);
    const next = (await this.getPinnedIds()).filter(x => x !== id);
    await AsyncStorage.setItem(PINNED_EVENTS_KEY, JSON.stringify(next));
    return next;
  }

  async togglePin(eventId: string): Promise<{pinned: boolean; ids: string[]}> {
    const id = String(eventId);
    const ids = await this.getPinnedIds();
    if (ids.includes(id)) {
      const next = await this.unpinEvent(id);
      return {pinned: false, ids: next};
    }
    const next = await this.pinEvent(id);
    return {pinned: true, ids: next};
  }
}

export default new EventPinService();
