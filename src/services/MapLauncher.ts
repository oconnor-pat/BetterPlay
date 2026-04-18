import {Alert, Linking, Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAP_PREFERENCE_KEY = '@default_map_app';

export type MapAppName = 'Apple Maps' | 'Google Maps' | 'Waze';

export type AvailableMapApp = {
  name: MapAppName;
  open: () => Promise<void>;
};

export type MapPickerPresenter = (
  apps: AvailableMapApp[],
  onCancel: () => void,
) => void;

type MapApp = {
  name: MapAppName;
  scheme: string;
  getUrl: (params: {
    name: string;
    address: string;
    lat?: number;
    lng?: number;
  }) => string;
};

const iosMapApps: MapApp[] = [
  {
    name: 'Apple Maps',
    scheme: 'maps://',
    getUrl: ({address, name, lat, lng}) => {
      if (lat && lng) {
        const label = encodeURIComponent(name || address);
        return `http://maps.apple.com/?daddr=${lat},${lng}&q=${label}`;
      }
      return `http://maps.apple.com/?daddr=${encodeURIComponent(address)}`;
    },
  },
  {
    name: 'Google Maps',
    scheme: 'comgooglemaps://',
    getUrl: ({address, lat, lng}) => {
      // Prefer address so Google shows a proper label
      if (address) {
        return `comgooglemaps://?daddr=${encodeURIComponent(
          address,
        )}&directionsmode=driving`;
      }
      if (lat && lng) {
        return `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`;
      }
      return `comgooglemaps://?daddr=${encodeURIComponent(
        address,
      )}&directionsmode=driving`;
    },
  },
  {
    name: 'Waze',
    scheme: 'waze://',
    getUrl: ({address, lat, lng}) => {
      // Prefer address so Waze shows a proper label
      if (address) {
        return `waze://?q=${encodeURIComponent(address)}&navigate=yes`;
      }
      if (lat && lng) {
        return `waze://?ll=${lat},${lng}&navigate=yes`;
      }
      return `waze://?q=${encodeURIComponent(address)}&navigate=yes`;
    },
  },
];

const androidMapApps: MapApp[] = [
  {
    name: 'Google Maps',
    scheme: 'google.navigation:',
    getUrl: ({address, lat, lng}) => {
      if (address) {
        return `google.navigation:q=${encodeURIComponent(address)}`;
      }
      if (lat && lng) {
        return `google.navigation:q=${lat},${lng}`;
      }
      return `google.navigation:q=${encodeURIComponent(address)}`;
    },
  },
  {
    name: 'Waze',
    scheme: 'waze://',
    getUrl: ({address, lat, lng}) => {
      if (address) {
        return `waze://?q=${encodeURIComponent(address)}&navigate=yes`;
      }
      if (lat && lng) {
        return `waze://?ll=${lat},${lng}&navigate=yes`;
      }
      return `waze://?q=${encodeURIComponent(address)}&navigate=yes`;
    },
  },
];

/** Get the user's saved default map app preference. */
export const getDefaultMapApp = async (): Promise<MapAppName | null> => {
  try {
    const saved = await AsyncStorage.getItem(MAP_PREFERENCE_KEY);
    return saved as MapAppName | null;
  } catch {
    return null;
  }
};

/** Save the user's default map app preference. null = always ask. */
export const setDefaultMapApp = async (
  appName: MapAppName | null,
): Promise<void> => {
  try {
    if (appName) {
      await AsyncStorage.setItem(MAP_PREFERENCE_KEY, appName);
    } else {
      await AsyncStorage.removeItem(MAP_PREFERENCE_KEY);
    }
  } catch {
    // Silently fail — preference is non-critical
  }
};

/**
 * Opens directions in the user's chosen map app.
 * If a default is saved and available, opens it directly.
 * Otherwise prompts the user to choose from installed apps.
 */
export const openDirections = async (
  destination: {
    name?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  },
  t: (key: string) => string,
  presentPicker?: MapPickerPresenter,
) => {
  const {name, address, latitude, longitude} = destination;
  const rawName = name || '';
  const rawAddress = address || '';
  const params = {
    name: rawName,
    address: rawAddress,
    lat: latitude,
    lng: longitude,
  };

  const appList = Platform.OS === 'ios' ? iosMapApps : androidMapApps;

  // Check which map apps are available
  const available: MapApp[] = [];
  for (const app of appList) {
    try {
      if (Platform.OS === 'ios' && app.name === 'Apple Maps') {
        available.push(app);
        continue;
      }
      const canOpen = await Linking.canOpenURL(app.scheme);
      if (canOpen) {
        available.push(app);
      }
    } catch {
      // Skip unavailable apps
    }
  }

  // Android fallback: geo: URI if nothing else is available
  if (available.length === 0 && Platform.OS === 'android') {
    const label = name || address || '';
    const encodedLabel = encodeURIComponent(label);
    const geoUrl =
      latitude && longitude
        ? `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`
        : `geo:0,0?q=${encodeURIComponent(rawAddress)}`;
    try {
      await Linking.openURL(geoUrl);
    } catch {
      Alert.alert(t('events.mapsError'), t('events.mapsErrorMessage'));
    }
    return;
  }

  if (available.length === 0) {
    Alert.alert(t('events.mapsError'), t('events.mapsErrorMessage'));
    return;
  }

  // If only one app is available, open it directly
  if (available.length === 1) {
    try {
      await Linking.openURL(available[0].getUrl(params));
    } catch {
      Alert.alert(t('events.mapsError'), t('events.mapsErrorMessage'));
    }
    return;
  }

  // Check if user has a saved default
  const defaultApp = await getDefaultMapApp();
  if (defaultApp) {
    const preferred = available.find(a => a.name === defaultApp);
    if (preferred) {
      try {
        await Linking.openURL(preferred.getUrl(params));
        return;
      } catch {
        // Fall through to prompt if default fails
      }
    }
  }

  // Multiple apps available — let the user choose
  const openWithApp = async (app: MapApp) => {
    try {
      await Linking.openURL(app.getUrl(params));
    } catch {
      Alert.alert(t('events.mapsError'), t('events.mapsErrorMessage'));
    }
  };

  // Prefer the caller-supplied themed picker when provided
  if (presentPicker) {
    const availableForPicker: AvailableMapApp[] = available.map(app => ({
      name: app.name,
      open: () => openWithApp(app),
    }));
    presentPicker(availableForPicker, () => {});
    return;
  }

  const buttons: {text: string; onPress: () => void}[] = available.map(app => ({
    text: app.name as string,
    onPress: () => openWithApp(app),
  }));
  buttons.push({text: t('common.cancel'), onPress: () => {}});

  Alert.alert(t('events.chooseMapApp'), undefined, buttons);
};
