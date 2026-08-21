import AsyncStorage from '@react-native-async-storage/async-storage';
import {Alert} from 'react-native';
import axios from 'axios';
import locationService, {Coordinates} from '../services/LocationService';
import {API_BASE_URL} from '../config/api';

export type ProximityVisibility = 'public' | 'friends' | 'private';

async function syncCoordsToBackend(coords: Coordinates): Promise<void> {
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      return;
    }
    await axios.put(
      `${API_BASE_URL}/users/me/location`,
      {latitude: coords.latitude, longitude: coords.longitude},
      {headers: {Authorization: `Bearer ${token}`}},
    );
  } catch {
    // Non-fatal — local Nearby filtering can still work.
  }
}

async function persistVisibility(value: ProximityVisibility): Promise<void> {
  await AsyncStorage.setItem('proximityVisibility', value);
  try {
    const token = await AsyncStorage.getItem('userToken');
    if (!token) {
      return;
    }
    await axios.put(
      `${API_BASE_URL}/users/me/proximity-visibility`,
      {proximityVisibility: value},
      {headers: {Authorization: `Bearer ${token}`}},
    );
  } catch {
    // Local pref still updated.
  }
}

/**
 * Fresh GPS + backend sync for Nearby toggles.
 * Returns null if location can't be determined.
 */
export async function refreshLocationForNearby(): Promise<Coordinates | null> {
  const coords = await locationService.getLocation({forceRefresh: true});
  if (coords) {
    await syncCoordsToBackend(coords);
  }
  return coords;
}

/**
 * If the user is still `private`, prompt them to appear in Nearby.
 * Returns false if they cancel (Nearby should not enable for discovery
 * of *others* — they can still browse, but we want them to opt in).
 * For enabling the Nearby filter on lists, we still allow browsing even
 * if they stay private — they just won't be found. So this returns
 * whether they chose to become discoverable; callers can ignore the
 * boolean if browsing-only is fine.
 */
export function promptNearbyVisibilityIfPrivate(): Promise<{
  proceeded: boolean;
  visibility: ProximityVisibility;
}> {
  return (async () => {
    const saved =
      ((await AsyncStorage.getItem(
        'proximityVisibility',
      )) as ProximityVisibility | null) || 'private';

    if (saved !== 'private') {
      return {proceeded: true, visibility: saved};
    }

    return new Promise(resolve => {
      Alert.alert(
        'Appear in Nearby?',
        "You're hidden from other players right now. Choose who can find you nearby — you can change this anytime in Settings.",
        [
          {
            text: 'Stay hidden',
            style: 'cancel',
            onPress: () =>
              resolve({proceeded: true, visibility: 'private'}),
          },
          {
            text: 'Friends only',
            onPress: async () => {
              await persistVisibility('friends');
              resolve({proceeded: true, visibility: 'friends'});
            },
          },
          {
            text: 'Everyone',
            onPress: async () => {
              await persistVisibility('public');
              resolve({proceeded: true, visibility: 'public'});
            },
          },
        ],
      );
    });
  })();
}
