import {Platform} from 'react-native';

// API Configuration
// Production API (Heroku)
const PRODUCTION_API_URL = 'https://omhl-be-9801a7de15ab.herokuapp.com';

// Local development URLs:
// - iOS Simulator: 'localhost' maps to host machine
// - Android Emulator: '10.0.2.2' maps to host machine
// - Physical device: use your Mac's LAN IP (find via: ipconfig getifaddr en0)
const LOCAL_API_URL_IOS_SIMULATOR = 'http://localhost:8001';
const LOCAL_API_URL_ANDROID_EMULATOR = 'http://10.0.2.2:8001';
const LOCAL_API_URL_DEVICE = 'http://192.168.1.37:8001';

// Toggle this to switch between production and local development
const USE_LOCAL_API = false;

// Set to true if testing on a physical device with local backend
// Only applies to iOS — Android emulator always uses 10.0.2.2
const IS_PHYSICAL_DEVICE = false;

// Automatically select the correct API URL
const getLocalApiUrl = (): string => {
  if (Platform.OS === 'android') {
    return LOCAL_API_URL_ANDROID_EMULATOR;
  }
  return IS_PHYSICAL_DEVICE
    ? LOCAL_API_URL_DEVICE
    : LOCAL_API_URL_IOS_SIMULATOR;
};

export const API_BASE_URL = USE_LOCAL_API
  ? getLocalApiUrl()
  : PRODUCTION_API_URL;
