// API Configuration
// Production API (Heroku)
const PRODUCTION_API_URL = 'https://omhl-be-9801a7de15ab.herokuapp.com';

// Local development URLs:
// - Use 'localhost' for iOS Simulator
// - Use your Mac's IP address for physical iPhone (find it via: ipconfig getifaddr en0)
// - Example: 'http://192.168.1.100:8001'
const LOCAL_API_URL_SIMULATOR = 'http://localhost:8001';
const LOCAL_API_URL_DEVICE = 'http://192.168.1.42:8001'; // Replace YOUR_MAC_IP with your Mac's local IP

// Toggle this to switch between production and local development
const USE_LOCAL_API = false;

// Set to true if testing on physical device with local backend
const IS_PHYSICAL_DEVICE = false;

// Automatically select the correct API URL
export const API_BASE_URL = USE_LOCAL_API
  ? IS_PHYSICAL_DEVICE
    ? LOCAL_API_URL_DEVICE
    : LOCAL_API_URL_SIMULATOR
  : PRODUCTION_API_URL;
