import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform, PermissionsAndroid} from 'react-native';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const LOCATION_CACHE_KEY = 'cachedUserLocation';
const LOCATION_TIMESTAMP_KEY = 'cachedUserLocationTimestamp';
const CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

class LocationService {
  private lastKnownLocation: Coordinates | null = null;

  async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    return new Promise(resolve => {
      Geolocation.requestAuthorization(
        () => resolve(true),
        () => resolve(false),
      );
    });
  }

  getCurrentPosition(): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        position => {
          const coords: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          this.lastKnownLocation = coords;
          this.cacheLocation(coords);
          resolve(coords);
        },
        error => reject(error),
        {enableHighAccuracy: false, timeout: 15000, maximumAge: 60000},
      );
    });
  }

  private async cacheLocation(coords: Coordinates): Promise<void> {
    try {
      await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(coords));
      await AsyncStorage.setItem(
        LOCATION_TIMESTAMP_KEY,
        Date.now().toString(),
      );
    } catch {}
  }

  async getCachedLocation(): Promise<Coordinates | null> {
    try {
      const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
      const timestamp = await AsyncStorage.getItem(LOCATION_TIMESTAMP_KEY);
      if (!cached || !timestamp) {
        return null;
      }
      const age = Date.now() - parseInt(timestamp, 10);
      if (age > CACHE_MAX_AGE_MS) {
        return null;
      }
      return JSON.parse(cached) as Coordinates;
    } catch {
      return null;
    }
  }

  async getLocation(): Promise<Coordinates | null> {
    if (this.lastKnownLocation) {
      return this.lastKnownLocation;
    }

    const cached = await this.getCachedLocation();
    if (cached) {
      this.lastKnownLocation = cached;
      return cached;
    }

    try {
      return await this.getCurrentPosition();
    } catch {
      return null;
    }
  }

  async clearLocation(): Promise<void> {
    this.lastKnownLocation = null;
    await AsyncStorage.multiRemove([LOCATION_CACHE_KEY, LOCATION_TIMESTAMP_KEY]);
  }

  haversineDistance(
    coord1: Coordinates,
    coord2: Coordinates,
    unit: 'km' | 'mi' = 'mi',
  ): number {
    const R = unit === 'km' ? 6371 : 3959;
    const dLat = this.toRad(coord2.latitude - coord1.latitude);
    const dLon = this.toRad(coord2.longitude - coord1.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(coord1.latitude)) *
        Math.cos(this.toRad(coord2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

const locationService = new LocationService();
export default locationService;
