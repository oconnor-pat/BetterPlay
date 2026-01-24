import React, {useState, useContext, useMemo, useEffect, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  Linking,
  ScrollView,
  Share,
  KeyboardAvoidingView,
} from 'react-native';
import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, {Marker} from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Picker} from '@react-native-picker/picker';
import {GooglePlacesAutocomplete} from 'react-native-google-places-autocomplete';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {EventListSkeleton} from '../Skeleton';
import {
  faPlus,
  faTrash,
  faCog,
  faSearch,
  faTimes,
  faFilter,
  faShareAlt,
  faLocationArrow,
  faArrowRightToBracket,
  faComments,
} from '@fortawesome/free-solid-svg-icons';
import {
  useNavigation,
  NavigationProp,
  CommonActions,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import UserContext, {UserContextType} from '../UserContext';
import {useTheme} from '../ThemeContext/ThemeContext';
import axios from 'axios';
import {API_BASE_URL} from '../../config/api';
import {useTranslation} from 'react-i18next';

export type RootStackParamList = {
  EventList: {highlightEventId?: string} | undefined;
  EventRoster: {
    eventId: string;
    eventName: string;
    eventType: string;
    date: string;
    time: string;
    location: string;
    totalSpots: number;
    roster: any[];
    jerseyColors?: string[];
  };
  Profile: {_id: string};
};

interface Event {
  _id: string;
  name: string;
  location: string; // human-readable address
  time: string;
  date: string;
  rosterSpotsFilled: number;
  totalSpots: number;
  eventType: string;
  createdBy: string;
  createdByUsername?: string;
  // Support for coordinates (if available from backend)
  latitude?: number;
  longitude?: number;
  // Jersey colors for team-based events (exactly 2 colors)
  jerseyColors?: string[];
}

// Google Places API configuration from environment variable
const GOOGLE_PLACES_API_KEY = Config.GOOGLE_PLACES_API_KEY || '';

// Check if API key is configured
const isApiKeyConfigured = !!GOOGLE_PLACES_API_KEY;

// Helper function to create empty event object
const createEmptyEvent = () => ({
  name: '',
  location: '',
  time: '',
  date: '',
  totalSpots: '',
  eventType: '',
  latitude: undefined as number | undefined,
  longitude: undefined as number | undefined,
  jerseyColors: [] as string[],
});

const rosterSizeOptions: string[] = Array.from({length: 30}, (_, i) =>
  (i + 1).toString(),
);

const activityOptions = [
  {label: 'Basketball', emoji: '🏀'},
  {label: 'Hockey', emoji: '🏒'},
  {label: 'Soccer', emoji: '⚽'},
  {label: 'Figure Skating', emoji: '⛸️'},
  {label: 'Tennis', emoji: '🎾'},
  {label: 'Golf', emoji: '⛳'},
  {label: 'Football', emoji: '🏈'},
  {label: 'Rugby', emoji: '🏉'},
  {label: 'Baseball', emoji: '⚾'},
  {label: 'Softball', emoji: '🥎'},
  {label: 'Lacrosse', emoji: '🥍'},
  {label: 'Volleyball', emoji: '🏐'},
];

// Team-based sports that benefit from jersey color selection
const teamSports = [
  'Basketball',
  'Hockey',
  'Soccer',
  'Football',
  'Rugby',
  'Lacrosse',
  'Volleyball',
];

// Available jersey colors for team selection
const jerseyColorOptions: {label: string; color: string}[] = [
  {label: 'Red', color: '#E53935'},
  {label: 'Blue', color: '#1E88E5'},
  {label: 'Green', color: '#43A047'},
  {label: 'White', color: '#FAFAFA'},
  {label: 'Black', color: '#212121'},
];

const isTeamSport = (eventType: string) =>
  teamSports.some(sport => sport.toLowerCase() === eventType.toLowerCase());

// Helper function to check if an event date/time has passed
const isEventPast = (eventDate: string, eventTime: string): boolean => {
  const now = new Date();

  // Parse the date - handle formats like "Fri Jan 23 2026" or "Jan 23, 2026"
  // Remove day name if present (e.g., "Fri ", "Mon ", etc.)
  let cleanDate = eventDate.replace(/^[A-Za-z]{3}\s+/, '');

  // Try to parse the date with multiple approaches
  let eventDateTime: Date | null = null;

  // Approach 1: Parse "Jan 23 2026" or "Jan 23, 2026" format
  const monthDayYearMatch = cleanDate.match(
    /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/,
  );
  if (monthDayYearMatch) {
    const [, month, day, year] = monthDayYearMatch;
    eventDateTime = new Date(`${month} ${day}, ${year}`);
  }

  // Approach 2: If first approach failed, try direct parsing
  if (!eventDateTime || isNaN(eventDateTime.getTime())) {
    eventDateTime = new Date(cleanDate);
  }

  // Approach 3: Try the original date string
  if (!eventDateTime || isNaN(eventDateTime.getTime())) {
    eventDateTime = new Date(eventDate);
  }

  // If we still don't have a valid date, return false (treat as not past)
  if (!eventDateTime || isNaN(eventDateTime.getTime())) {
    return false;
  }

  // Parse time - handle formats like "6:30 PM" or "18:30"
  let hours = 0;
  let minutes = 0;
  const timeMatch = eventTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3]?.toUpperCase();
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
  }

  eventDateTime.setHours(hours, minutes, 0, 0);
  return eventDateTime < now;
};

const dateFilterOptions = [
  {label: 'All Dates', value: 'all'},
  {label: 'Today', value: 'today'},
  {label: 'Tomorrow', value: 'tomorrow'},
  {label: 'This Week', value: 'thisWeek'},
  {label: 'This Month', value: 'thisMonth'},
];

// App Store Links - Update these with your actual app store URLs when published
const APP_STORE_LINKS = {
  ios: 'https://apps.apple.com/app/betterplay/id000000000', // Replace with your iOS App Store link
  android: 'https://play.google.com/store/apps/details?id=com.betterplay', // Replace with your Google Play link
  fallback: 'https://betterplay.app', // Replace with your website/landing page
};

const getEventTypeEmoji = (eventType: string) => {
  const found = activityOptions.find(
    opt => opt.label.toLowerCase() === eventType.toLowerCase(),
  );
  return found ? found.emoji : '🎯';
};

// Prefer Google Maps; fall back to Waze, then Apple (iOS) or geo (Android)
const openMapsForEvent = async (
  event: Partial<Event>,
  t: (key: string) => string,
) => {
  const name = event?.name || 'Destination';
  const address = event?.location || '';

  // Use exact coordinates if available, otherwise use location lookup
  const coords =
    event?.latitude && event?.longitude
      ? {latitude: event.latitude, longitude: event.longitude}
      : getCoordinatesFromLocation(address);

  const lat = coords.latitude;
  const lng = coords.longitude;
  const hasCoords = true; // We always have coordinates now

  const encodedQuery = encodeURIComponent(
    hasCoords ? `${lat},${lng}` : address || name,
  );
  const encodedLabel = encodeURIComponent(name);

  try {
    if (Platform.OS === 'ios') {
      // 1) Google Maps if installed
      const googleScheme = 'comgooglemaps://';
      if (await Linking.canOpenURL(googleScheme)) {
        const url = hasCoords
          ? `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`
          : `comgooglemaps://?q=${encodedQuery}`;
        await Linking.openURL(url);
        return;
      }
      // 2) Waze if installed
      const wazeScheme = 'waze://';
      if (await Linking.canOpenURL(wazeScheme)) {
        const url = hasCoords
          ? `waze://?ll=${lat},${lng}&navigate=yes`
          : `waze://?q=${encodedQuery}&navigate=yes`;
        await Linking.openURL(url);
        return;
      }
      // 3) Apple Maps fallback
      const appleUrl = hasCoords
        ? `http://maps.apple.com/?daddr=${lat},${lng}&q=${encodedLabel}`
        : `http://maps.apple.com/?q=${encodedQuery}`;
      await Linking.openURL(appleUrl);
      return;
    } else {
      // Android
      // 1) Google navigation (if available)
      const googleNavUrl = hasCoords
        ? `google.navigation:q=${lat},${lng}`
        : `google.navigation:q=${encodedQuery}`;
      if (await Linking.canOpenURL(googleNavUrl)) {
        await Linking.openURL(googleNavUrl);
        return;
      }
      // 2) Waze if installed
      const wazeScheme = 'waze://';
      if (await Linking.canOpenURL(wazeScheme)) {
        const wazeUrl = hasCoords
          ? `waze://?ll=${lat},${lng}&navigate=yes`
          : `waze://?q=${encodedQuery}&navigate=yes`;
        await Linking.openURL(wazeUrl);
        return;
      }
      // 3) Generic geo: fallback
      const geoUrl = hasCoords
        ? `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`
        : `geo:0,0?q=${encodedQuery}`;
      await Linking.openURL(geoUrl);
    }
  } catch (e) {
    console.error('Failed to open maps:', e);
    Alert.alert(t('events.mapsError'), t('events.mapsErrorMessage'));
  }
};

// Helper function to get approximate coordinates from common locations
const getCoordinatesFromLocation = (
  location: string,
): {latitude: number; longitude: number} => {
  const normalizedLocation = location.toLowerCase().trim();

  // Common location coordinates - you can expand this based on your needs
  const locationMap: {[key: string]: {latitude: number; longitude: number}} = {
    // Sports venues and common locations
    'madison square garden': {latitude: 40.7505, longitude: -73.9934},
    'yankee stadium': {latitude: 40.8296, longitude: -73.9262},
    'central park': {latitude: 40.7829, longitude: -73.9654},
    'golden gate park': {latitude: 37.7694, longitude: -122.4862},
    'griffith observatory': {latitude: 34.1184, longitude: -118.3004},
    'millennium park': {latitude: 41.8826, longitude: -87.6226},

    // Default city centers
    'san francisco': {latitude: 37.7749, longitude: -122.4194},
    'new york': {latitude: 40.7128, longitude: -74.006},
    'los angeles': {latitude: 34.0522, longitude: -118.2437},
    chicago: {latitude: 41.8781, longitude: -87.6298},
    boston: {latitude: 42.3601, longitude: -71.0589},
    seattle: {latitude: 47.6062, longitude: -122.3321},
  };

  // Check for exact matches first
  if (locationMap[normalizedLocation]) {
    return locationMap[normalizedLocation];
  }

  // Check for partial matches (city names within addresses)
  for (const [key, coords] of Object.entries(locationMap)) {
    if (normalizedLocation.includes(key)) {
      return coords;
    }
  }

  // Default to San Francisco if no match found
  return {latitude: 37.7749, longitude: -122.4194};
};

const EventList: React.FC = () => {
  const {userData} = useContext(UserContext) as UserContextType;
  const {colors} = useTheme();
  const {t} = useTranslation();

  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          padding: 16,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          paddingTop: 8,
          backgroundColor: colors.background,
          zIndex: 1,
        },
        title: {
          fontSize: 25,
          fontWeight: '700',
          color: colors.primary,
          textAlign: 'center',
          flex: 1,
          position: 'absolute',
          left: 0,
          right: 0,
          top: 8,
          zIndex: -1,
        },
        card: {
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 18,
          marginBottom: 18,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: colors.text,
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.08,
          shadowRadius: 6,
          elevation: 3,
        },
        pastEventCard: {
          opacity: 0.6,
          backgroundColor: colors.card,
        },
        pastEventBadge: {
          position: 'absolute' as const,
          top: 12,
          right: 12,
          backgroundColor: colors.placeholder || '#888',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          zIndex: 1,
        },
        pastEventBadgeText: {
          color: '#fff',
          fontSize: 11,
          fontWeight: '700',
          textTransform: 'uppercase' as const,
          letterSpacing: 0.5,
        },
        cardRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 6,
        },
        cardEmoji: {
          fontSize: 18,
          marginRight: 8,
        },
        cardTitle: {
          color: colors.text,
          fontWeight: 'bold',
          fontSize: 18,
          marginBottom: 2,
        },
        cardText: {
          color: colors.text,
          fontSize: 16,
        },
        cardSpacer: {
          height: 8,
        },
        mapBox: {
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.primary,
          backgroundColor: colors.inputBackground || '#eaeaea',
          marginVertical: 8,
          overflow: 'hidden',
          shadowColor: colors.text,
          shadowOffset: {width: 0, height: 1},
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 2,
        },
        mapView: {
          height: 120,
          width: '100%',
        },
        mapOverlay: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: 8,
          alignItems: 'center',
        },
        mapEmoji: {
          fontSize: 22,
          marginBottom: 4,
        },
        mapText: {
          color: '#fff',
          fontSize: 14,
          fontWeight: '600',
          textAlign: 'center',
        },
        mapSubtext: {
          color: '#fff',
          fontSize: 12,
          opacity: 0.8,
          textAlign: 'center',
        },
        actionRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 10,
        },
        actionButton: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
          borderRadius: 10,
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderWidth: 1.5,
          borderColor: colors.primary,
          flex: 1,
          marginRight: 10,
        },
        joinButton: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
          marginRight: 0,
        },
        actionButtonIcon: {
          marginRight: 8,
        },
        actionButtonText: {
          fontWeight: '600',
          fontSize: 15,
          color: colors.primary,
        },
        joinButtonText: {
          color: colors.buttonText || '#fff',
        },
        iconContainer: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 16,
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          gap: 24,
        },
        iconButton: {
          padding: 10,
          borderRadius: 20,
          backgroundColor: colors.inputBackground || colors.background,
        },
        addButton: {
          paddingHorizontal: 20,
          paddingVertical: 10,
          zIndex: 1,
          backgroundColor: colors.primary,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          padding: 16,
        },
        modalView: {
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 24,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 4},
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 8,
          maxHeight: '90%',
        },
        modalHeader: {
          color: colors.text,
          fontSize: 24,
          marginBottom: 24,
          textAlign: 'center',
          fontWeight: '700',
        },
        modalLabel: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
          marginBottom: 8,
          marginLeft: 4,
        },
        modalInput: {
          backgroundColor: colors.inputBackground || colors.background,
          color: colors.text,
          padding: 14,
          marginBottom: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          fontSize: 16,
        },
        autocompleteContainer: {
          marginBottom: 16,
          zIndex: 1000,
        },
        saveButton: {
          backgroundColor: colors.primary,
          padding: 16,
          borderRadius: 12,
          marginVertical: 5,
          flex: 1,
          alignItems: 'center',
          marginHorizontal: 6,
          minWidth: 100,
          shadowColor: colors.primary,
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.3,
          shadowRadius: 4,
          elevation: 3,
        },
        cancelButton: {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: colors.error || '#b11313',
          shadowOpacity: 0,
          elevation: 0,
        },
        buttonText: {
          color: colors.buttonText || '#fff',
          textAlign: 'center',
          fontWeight: '700',
          fontSize: 16,
        },
        cancelButtonText: {
          color: colors.error || '#b11313',
        },
        buttonContainer: {
          flexDirection: 'row',
          justifyContent: 'center',
          marginTop: 24,
          alignItems: 'center',
        },
        confirmButton: {
          color: colors.buttonText || '#fff',
          textAlign: 'center',
          marginTop: 12,
          marginBottom: 16,
          fontSize: 16,
          fontWeight: '600',
          backgroundColor: colors.primary,
          paddingVertical: 10,
          paddingHorizontal: 20,
          borderRadius: 8,
          overflow: 'hidden',
        },
        pickerContainer: {
          backgroundColor: colors.inputBackground || colors.background,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 8,
          overflow: 'hidden',
        },
        picker: {
          backgroundColor: 'transparent',
          color: colors.text,
        },
        eventUsername: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '600',
          marginLeft: 4,
        },
        creatorRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 8,
          paddingVertical: 4,
          paddingHorizontal: 8,
          backgroundColor: colors.inputBackground || 'rgba(0,0,0,0.05)',
          borderRadius: 12,
          alignSelf: 'flex-start',
        },
        searchContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBackground || colors.card,
          borderRadius: 12,
          paddingHorizontal: 12,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: colors.border,
        },
        searchInput: {
          flex: 1,
          paddingVertical: 12,
          paddingHorizontal: 8,
          fontSize: 16,
          color: colors.text,
        },
        searchIcon: {
          marginRight: 4,
        },
        clearButton: {
          padding: 4,
        },
        searchButton: {
          padding: 8,
          marginLeft: 8,
          zIndex: 1,
        },
        noResultsContainer: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 40,
        },
        noResultsText: {
          color: colors.text,
          fontSize: 16,
          opacity: 0.7,
          textAlign: 'center',
        },
        noResultsSubtext: {
          color: colors.text,
          fontSize: 14,
          opacity: 0.5,
          textAlign: 'center',
          marginTop: 8,
        },
        ctaButton: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 25,
          marginTop: 20,
          gap: 8,
        },
        ctaButtonText: {
          color: '#fff',
          fontSize: 16,
          fontWeight: '600',
        },
        filterButton: {
          padding: 8,
          marginLeft: 8,
          position: 'relative',
        },
        filterBadge: {
          position: 'absolute',
          top: 0,
          right: 0,
          backgroundColor: colors.error || '#e74c3c',
          borderRadius: 10,
          minWidth: 18,
          height: 18,
          justifyContent: 'center',
          alignItems: 'center',
        },
        filterBadgeText: {
          color: '#fff',
          fontSize: 11,
          fontWeight: 'bold',
        },
        filterModalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        },
        filterModalContent: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 20,
          paddingHorizontal: 20,
          paddingBottom: 40,
          maxHeight: '80%',
        },
        filterModalHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        },
        filterModalTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: colors.text,
        },
        filterSection: {
          marginBottom: 20,
        },
        filterSectionTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 12,
        },
        filterChipsContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
        },
        filterChip: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          marginRight: 8,
          marginBottom: 8,
        },
        filterChipSelected: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        filterChipText: {
          fontSize: 14,
          color: colors.text,
          marginLeft: 6,
        },
        filterChipTextSelected: {
          color: colors.buttonText || '#fff',
        },
        filterChipEmoji: {
          fontSize: 16,
        },
        dateFilterOption: {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          marginBottom: 8,
        },
        dateFilterOptionSelected: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        dateFilterOptionText: {
          fontSize: 15,
          color: colors.text,
        },
        dateFilterOptionTextSelected: {
          color: colors.buttonText || '#fff',
          fontWeight: '600',
        },
        toggleOption: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
        },
        toggleOptionSelected: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        toggleOptionText: {
          fontSize: 15,
          color: colors.text,
        },
        toggleOptionTextSelected: {
          color: colors.buttonText || '#fff',
          fontWeight: '600',
        },
        filterButtonsRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 20,
          gap: 12,
        },
        clearFiltersButton: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 12,
          borderWidth: 2,
          borderColor: colors.error || '#e74c3c',
          alignItems: 'center',
        },
        clearFiltersText: {
          color: colors.error || '#e74c3c',
          fontWeight: '600',
          fontSize: 16,
        },
        applyFiltersButton: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: 'center',
        },
        applyFiltersText: {
          color: colors.buttonText || '#fff',
          fontWeight: '600',
          fontSize: 16,
        },
        noResultsIcon: {
          marginBottom: 16,
        },
        disabledOpacity: {
          opacity: 0.7,
        },
        keyboardAvoidingView: {
          flex: 1,
        },
        // Jersey color picker styles
        jerseyColorPickerContainer: {
          backgroundColor: colors.inputBackground || colors.background,
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        },
        jerseyColorTitle: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '600',
          marginBottom: 12,
          textAlign: 'center',
        },
        jerseyColorGrid: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
        },
        jerseyColorOption: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.card,
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.border,
          minWidth: 100,
        },
        jerseyColorOptionSelected: {
          borderColor: colors.primary,
          borderWidth: 2,
          backgroundColor: colors.primary + '15',
        },
        jerseyColorSwatch: {
          width: 20,
          height: 20,
          borderRadius: 10,
          marginRight: 8,
        },
        jerseyColorSwatchLight: {
          borderWidth: 1,
          borderColor: colors.border,
        },
        jerseyColorLabel: {
          color: colors.text,
          fontSize: 14,
        },
        jerseyColorCheck: {
          color: colors.primary,
          fontSize: 16,
          fontWeight: 'bold',
          marginLeft: 'auto',
        },
        activeFiltersContainer: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          marginBottom: 12,
          gap: 8,
        },
        activeFilterTag: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.primary + '20',
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 16,
          marginRight: 8,
          marginBottom: 4,
        },
        activeFilterTagText: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '500',
          marginRight: 6,
        },
        searchFilterRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 12,
        },
        searchContainerInRow: {
          flex: 1,
          marginBottom: 0,
        },
      }),
    [colors],
  );

  // Memoize GooglePlacesAutocomplete styles to prevent infinite loop
  const autocompleteStyles = useMemo(
    () => ({
      container: {
        flex: 0,
      },
      textInputContainer: {
        backgroundColor: 'transparent',
      },
      textInput: {
        backgroundColor: colors.inputBackground || '#fff',
        color: colors.text,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        fontSize: 16,
      },
      listView: {
        backgroundColor: colors.card || '#fff',
        borderColor: colors.border,
        borderWidth: 1,
        borderTopWidth: 0,
        borderRadius: 8,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        maxHeight: 200,
      },
      row: {
        backgroundColor: colors.card || '#fff',
        padding: 13,
        minHeight: 44,
        flexDirection: 'row' as const,
      },
      separator: {
        height: 0.5,
        backgroundColor: colors.border,
      },
      description: {
        color: colors.text,
      },
    }),
    [colors],
  );

  const [eventData, setEventData] = useState<Event[]>([]);
  const [loading, setLoading] = useState<boolean>(true); // Start true to show skeleton
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newEvent, setNewEvent] = useState(() => createEmptyEvent());

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Filter state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
  const [selectedDateFilter, setSelectedDateFilter] = useState('all');
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [hidePastEvents, setHidePastEvents] = useState(true);

  // Location autocomplete state - removed manual toggle, now seamless

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState<Date | undefined>(new Date());

  const [showRosterSizePicker, setShowRosterSizePicker] = useState(false);
  const [tempRosterSize, setTempRosterSize] = useState(
    newEvent.totalSpots || '',
  );
  const [showEventTypePicker, setShowEventTypePicker] = useState(false);
  const [tempEventType, setTempEventType] = useState(newEvent.eventType || '');

  // Jersey color picker state for team sports
  const [showJerseyColorPicker, setShowJerseyColorPicker] = useState(false);

  // Loading state for save operations
  const [savingEvent, setSavingEvent] = useState(false);
  const [_deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // First-time user onboarding state
  const [showFirstTimeHint, setShowFirstTimeHint] = useState(false);

  // Ref for scrolling to specific events
  const flatListRef = useRef<FlatList<Event> | null>(null);

  const navigation = useNavigation<NavigationProp<any>>();
  const route = useRoute<RouteProp<RootStackParamList, 'EventList'>>();

  const fetchEvents = React.useCallback(async () => {
    if (initialLoadDone) {
      // For pull-to-refresh, don't show full loading state
    } else {
      setLoading(true);
    }
    try {
      const response = await axios.get(`${API_BASE_URL}/events`);
      setEventData(response.data);
      // Cache events for faster startup
      AsyncStorage.setItem('cachedEvents', JSON.stringify(response.data));
    } catch (error) {
      if (!initialLoadDone) {
        Alert.alert(t('common.error'), t('events.fetchError'));
      }
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  }, [initialLoadDone, t]);

  // Check if user has seen the events onboarding - non-blocking
  useEffect(() => {
    AsyncStorage.getItem('hasSeenEventsHint').then(hasSeenHint => {
      if (!hasSeenHint) {
        setShowFirstTimeHint(true);
      }
    });
  }, [fetchEvents]);

  // Dismiss hint and save to storage
  const dismissFirstTimeHint = async () => {
    await AsyncStorage.setItem('hasSeenEventsHint', 'true');
    setShowFirstTimeHint(false);
  };

  // Fetch events from backend - OPTIMIZED with caching
  useEffect(() => {
    const loadEvents = async () => {
      // FAST PATH: Load cached events immediately
      try {
        const cachedEvents = await AsyncStorage.getItem('cachedEvents');
        if (cachedEvents) {
          const parsed = JSON.parse(cachedEvents);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setEventData(parsed);
            setLoading(false);
            setInitialLoadDone(true);
            // Fetch fresh data in background
            fetchEventsInBackground();
            return;
          }
        }
      } catch {
        // Invalid cache, fall through
      }

      // NO CACHE: Fetch from server
      await fetchEvents();
    };

    const fetchEventsInBackground = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/events`);
        if (Array.isArray(response.data)) {
          setEventData(response.data);
          // Cache for next launch (fire and forget)
          AsyncStorage.setItem('cachedEvents', JSON.stringify(response.data));
        }
      } catch (error) {
        console.log('Background events fetch failed:', error);
      }
    };

    loadEvents();
  }, [fetchEvents]);

  // Filter events based on search query and filters
  const filteredEvents = useMemo(() => {
    let filtered = eventData;

    // Text search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(event => {
        const nameMatch = event.name.toLowerCase().includes(query);
        const locationMatch = event.location.toLowerCase().includes(query);
        const dateMatch = event.date.toLowerCase().includes(query);
        const typeMatch = event.eventType.toLowerCase().includes(query);
        const creatorMatch = event.createdByUsername
          ?.toLowerCase()
          .includes(query);
        return (
          nameMatch || locationMatch || dateMatch || typeMatch || creatorMatch
        );
      });
    }

    // Event type filter
    if (selectedEventTypes.length > 0) {
      filtered = filtered.filter(event =>
        selectedEventTypes.some(
          type => type.toLowerCase() === event.eventType.toLowerCase(),
        ),
      );
    }

    // Date filter
    if (selectedDateFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      filtered = filtered.filter(event => {
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0);

        switch (selectedDateFilter) {
          case 'today':
            return eventDate.getTime() === today.getTime();
          case 'tomorrow':
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return eventDate.getTime() === tomorrow.getTime();
          case 'thisWeek':
            const weekEnd = new Date(today);
            weekEnd.setDate(weekEnd.getDate() + 7);
            return eventDate >= today && eventDate <= weekEnd;
          case 'thisMonth':
            const monthEnd = new Date(today);
            monthEnd.setMonth(monthEnd.getMonth() + 1);
            return eventDate >= today && eventDate <= monthEnd;
          default:
            return true;
        }
      });
    }

    // Available spots filter
    if (showAvailableOnly) {
      filtered = filtered.filter(
        event => event.rosterSpotsFilled < event.totalSpots,
      );
    }

    // Hide past events filter
    if (hidePastEvents) {
      filtered = filtered.filter(event => !isEventPast(event.date, event.time));
    }

    // Sort by date (soonest first) so new events appear in chronological order
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`);
      const dateB = new Date(`${b.date} ${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });

    return filtered;
  }, [
    eventData,
    searchQuery,
    selectedEventTypes,
    selectedDateFilter,
    showAvailableOnly,
    hidePastEvents,
  ]);

  // Scroll to highlighted event when navigating from Community Notes
  useEffect(() => {
    if (route.params?.highlightEventId && filteredEvents.length > 0) {
      const eventIndex = filteredEvents.findIndex(
        e => e._id === route.params?.highlightEventId,
      );
      if (eventIndex !== -1) {
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index: eventIndex,
            animated: true,
            viewPosition: 0.3,
          });
        }, 300);
      }
    }
  }, [route.params?.highlightEventId, filteredEvents]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedEventTypes.length > 0) {
      count++;
    }
    if (selectedDateFilter !== 'all') {
      count++;
    }
    if (showAvailableOnly) {
      count++;
    }
    return count;
  }, [selectedEventTypes, selectedDateFilter, showAvailableOnly]);

  // Toggle event type selection
  const toggleEventType = (type: string) => {
    setSelectedEventTypes(prev =>
      prev.includes(type)
        ? prev.filter(eventType => eventType !== type)
        : [...prev, type],
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedEventTypes([]);
    setSelectedDateFilter('all');
    setShowAvailableOnly(false);
    setHidePastEvents(true);
  };

  const handleSaveNewEvent = async () => {
    // Validate jersey colors for team sports
    if (isTeamSport(newEvent.eventType) && newEvent.jerseyColors.length !== 2) {
      Alert.alert(
        t('events.missingFields'),
        t('events.selectTwoJerseyColors') ||
          'Please select exactly 2 jersey colors for team sports.',
      );
      return;
    }

    if (
      newEvent.name &&
      newEvent.location &&
      newEvent.time &&
      newEvent.date &&
      newEvent.totalSpots &&
      newEvent.eventType
    ) {
      setSavingEvent(true);
      if (isEditing && editingEventId) {
        try {
          const response = await axios.put(
            `${API_BASE_URL}/events/${editingEventId}`,
            {
              name: newEvent.name,
              location: newEvent.location,
              time: newEvent.time,
              date: newEvent.date,
              totalSpots: parseInt(newEvent.totalSpots, 10),
              eventType: newEvent.eventType,
              createdByUsername: userData?.username || '',
              latitude: newEvent.latitude,
              longitude: newEvent.longitude,
              jerseyColors: isTeamSport(newEvent.eventType)
                ? newEvent.jerseyColors
                : undefined,
            },
          );
          setEventData(prevData =>
            prevData.map(event =>
              event._id === editingEventId ? response.data : event,
            ),
          );
        } catch (error) {
          Alert.alert(t('common.error'), t('events.updateError'));
          setSavingEvent(false);
          return;
        }
      } else {
        try {
          const response = await axios.post(`${API_BASE_URL}/events`, {
            name: newEvent.name,
            location: newEvent.location,
            time: newEvent.time,
            date: newEvent.date,
            totalSpots: parseInt(newEvent.totalSpots, 10),
            eventType: newEvent.eventType,
            createdBy: userData?._id || '',
            createdByUsername: userData?.username || '',
            latitude: newEvent.latitude,
            longitude: newEvent.longitude,
            jerseyColors: isTeamSport(newEvent.eventType)
              ? newEvent.jerseyColors
              : undefined,
          });
          setEventData(prevData => [response.data, ...prevData]);
        } catch (error) {
          Alert.alert(t('common.error'), t('events.createError'));
          setSavingEvent(false);
          return;
        }
      }
      setSavingEvent(false);
      setModalVisible(false);
      setNewEvent(createEmptyEvent());
      setTempRosterSize('');
      setTempEventType('');
      setIsEditing(false);
      setEditingEventId(null);
    } else {
      Alert.alert(t('events.missingFields'), t('events.missingFieldsMessage'));
    }
  };

  const handleEventPress = (event: Event) => {
    navigation.navigate('EventRoster', {
      eventId: event._id,
      eventName: event.name,
      eventType: event.eventType,
      date: event.date,
      time: event.time,
      location: event.location,
      totalSpots: event.totalSpots,
      roster: [],
      jerseyColors: event.jerseyColors,
    });
  };

  const handleDeleteEvent = (event: Event) => {
    if (event.createdBy !== (userData?._id || '')) {
      Alert.alert(t('events.notAuthorized'), t('events.notAuthorizedDelete'));
      return;
    }
    Alert.alert(
      t('events.deleteConfirm'),
      t('events.deleteConfirmMessage'),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeletingEventId(event._id);
            try {
              await axios.delete(`${API_BASE_URL}/events/${event._id}`);
              setEventData(prevData =>
                prevData.filter(e => e._id !== event._id),
              );
            } catch (error) {
              Alert.alert(t('common.error'), t('events.deleteError'));
            } finally {
              setDeletingEventId(null);
            }
          },
        },
      ],
      {cancelable: true},
    );
  };

  const handleEditEvent = (event: Event) => {
    setNewEvent({
      name: event.name,
      location: event.location,
      time: event.time,
      date: event.date,
      totalSpots: event.totalSpots.toString(),
      eventType: event.eventType,
      latitude: event.latitude,
      longitude: event.longitude,
      jerseyColors: event.jerseyColors || [],
    });
    setModalVisible(true);
    setTempRosterSize(event.totalSpots.toString());
    setTempEventType(event.eventType);
    setIsEditing(true);
    setEditingEventId(event._id);
  };

  const handleShareEvent = async (event: Event) => {
    const emoji = getEventTypeEmoji(event.eventType);
    const spotsAvailable = event.totalSpots - event.rosterSpotsFilled;
    const appLink =
      Platform.OS === 'ios' ? APP_STORE_LINKS.ios : APP_STORE_LINKS.android;

    const shareMessage =
      `${emoji} Join me for ${event.name}!\n\n` +
      `🏷️ ${event.eventType}\n` +
      `📅 ${event.date} @ ${event.time}\n` +
      `📍 ${event.location}\n` +
      `👥 ${spotsAvailable} spot${
        spotsAvailable !== 1 ? 's' : ''
      } available\n\n` +
      `Download BetterPlay to join:\n${appLink}`;

    try {
      const result = await Share.share({
        message: shareMessage,
        title: `Join ${event.name} on BetterPlay`,
      });

      if (result.action === Share.sharedAction) {
        // Shared successfully
        if (result.activityType) {
          // Shared with activity type of result.activityType (iOS only)
          console.log('Shared via:', result.activityType);
        }
      }
    } catch (error) {
      Alert.alert(
        t('common.error'),
        t('events.shareError') || 'Failed to share event',
      );
    }
  };

  // Navigate to Community Notes - either to existing post or to create new one
  const handleDiscussEvent = async (event: Event) => {
    try {
      // Check if a post already exists for this event
      const response = await axios.get(
        `${API_BASE_URL}/community-notes/event/${event._id}`,
      );

      if (response.data && response.data._id) {
        // Post exists - navigate to it
        navigation.dispatch(
          CommonActions.navigate({
            name: 'CommunityNotes',
            params: {
              screen: 'CommunityNotesList',
              params: {
                scrollToEventId: event._id,
              },
            },
          }),
        );
      } else {
        // No post exists - navigate to create one
        navigation.dispatch(
          CommonActions.navigate({
            name: 'CommunityNotes',
            params: {
              screen: 'CommunityNotesList',
              params: {
                eventLink: {
                  eventId: event._id,
                  eventName: event.name,
                  eventType: event.eventType,
                },
              },
            },
          }),
        );
      }
    } catch {
      // If error (likely 404 - no post found), navigate to create one
      navigation.dispatch(
        CommonActions.navigate({
          name: 'CommunityNotes',
          params: {
            screen: 'CommunityNotesList',
            params: {
              eventLink: {
                eventId: event._id,
                eventName: event.name,
                eventType: event.eventType,
              },
            },
          },
        }),
      );
    }
  };

  const handleCancelModal = () => {
    setModalVisible(false);
    setNewEvent(createEmptyEvent());
    setTempRosterSize('');
    setTempEventType('');
    setIsEditing(false);
    setEditingEventId(null);
  };

  const onDateChange = (evt: any, selectedDate?: Date) => {
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const onTimeChange = (evt: any, selectedTime?: Date) => {
    if (selectedTime) {
      const roundedTime = new Date(
        Math.ceil(selectedTime.getTime() / (15 * 1000)) * 15 * 1000,
      );
      setTime(roundedTime);
    }
  };

  const renderEventCard = ({item}: {item: Event}) => {
    const isPast = isEventPast(item.date, item.time);

    return (
      <TouchableOpacity
        style={[themedStyles.card, isPast && themedStyles.pastEventCard]}
        onPress={() => handleEventPress(item)}
        activeOpacity={0.9}>
        {/* Past Event Badge */}
        {isPast && (
          <View style={themedStyles.pastEventBadge}>
            <Text style={themedStyles.pastEventBadgeText}>
              {t('events.past') || 'Past'}
            </Text>
          </View>
        )}
        {/* Event Name */}
        <View style={themedStyles.cardRow}>
          <Text style={themedStyles.cardEmoji}>
            {getEventTypeEmoji(item.eventType)}
          </Text>
          <Text style={themedStyles.cardTitle}>{item.name}</Text>
        </View>
        {/* Username of event creator */}
        {item.createdByUsername && (
          <View style={themedStyles.creatorRow}>
            <Text style={themedStyles.cardEmoji}>👤</Text>
            <Text style={themedStyles.eventUsername}>
              {t('events.createdBy')} {item.createdByUsername}
            </Text>
          </View>
        )}
        {/* Location */}
        <View style={themedStyles.cardRow}>
          <Text style={themedStyles.cardEmoji}>📍</Text>
          <Text style={themedStyles.cardText}>{item.location}</Text>
        </View>
        {/* Date and Time */}
        <View style={themedStyles.cardRow}>
          <Text style={themedStyles.cardEmoji}>🗓️</Text>
          <Text style={themedStyles.cardText}>
            {item.date} @ {item.time}
          </Text>
        </View>
        {/* Roster */}
        <View style={themedStyles.cardRow}>
          <Text style={themedStyles.cardEmoji}>👥</Text>
          <Text style={themedStyles.cardText}>
            {item.rosterSpotsFilled} / {item.totalSpots}{' '}
            {t('events.playersJoined')}
          </Text>
        </View>

        {/* Spacer */}
        <View style={themedStyles.cardSpacer} />

        {/* Interactive Map View */}
        <TouchableOpacity
          style={themedStyles.mapBox}
          onPress={() => openMapsForEvent(item, t)}
          activeOpacity={0.7}>
          {(() => {
            // Use exact coordinates if available, otherwise use location lookup
            const coords =
              item.latitude && item.longitude
                ? {latitude: item.latitude, longitude: item.longitude}
                : getCoordinatesFromLocation(item.location);

            return (
              <MapView
                style={themedStyles.mapView}
                initialRegion={{
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}>
                <Marker
                  coordinate={coords}
                  title={item.name}
                  description={item.location}
                />
              </MapView>
            );
          })()}
          <View style={themedStyles.mapOverlay}>
            <Text style={themedStyles.mapText}>📍 {item.location}</Text>
            <Text style={themedStyles.mapSubtext}>
              {t('events.tapToOpenMaps')}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Spacer */}
        <View style={themedStyles.cardSpacer} />

        {/* Action Buttons */}
        <View style={themedStyles.actionRow}>
          <TouchableOpacity
            style={[themedStyles.actionButton, themedStyles.joinButton]}
            onPress={() => openMapsForEvent(item, t)}>
            <FontAwesomeIcon
              icon={faLocationArrow}
              size={16}
              color={colors.buttonText || '#fff'}
              style={themedStyles.actionButtonIcon}
            />
            <Text
              style={[
                themedStyles.actionButtonText,
                themedStyles.joinButtonText,
              ]}>
              {t('events.getDirections')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Share/Discuss/Settings/Delete Icons */}
        <View style={themedStyles.iconContainer}>
          <TouchableOpacity
            style={themedStyles.iconButton}
            onPress={() => handleShareEvent(item)}>
            <FontAwesomeIcon
              icon={faShareAlt}
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={themedStyles.iconButton}
            onPress={() => handleDiscussEvent(item)}>
            <FontAwesomeIcon
              icon={faComments}
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
          {userData?._id === item.createdBy && (
            <TouchableOpacity
              style={themedStyles.iconButton}
              onPress={() => handleEditEvent(item)}>
              <FontAwesomeIcon icon={faCog} size={18} color={colors.text} />
            </TouchableOpacity>
          )}
          {userData?._id === item.createdBy && (
            <TouchableOpacity
              style={themedStyles.iconButton}
              onPress={() => handleDeleteEvent(item)}>
              <FontAwesomeIcon
                icon={faTrash}
                size={18}
                color={colors.error || '#e74c3c'}
              />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={themedStyles.container} edges={['top']}>
      {/* Header */}
      <View style={themedStyles.header}>
        <HamburgerMenu />
        <Text style={themedStyles.title}>{t('events.title')}</Text>
        <TouchableOpacity
          style={themedStyles.addButton}
          onPress={() => {
            setModalVisible(true);
            setIsEditing(false);
            setEditingEventId(null);
            setNewEvent(createEmptyEvent());
            setTempRosterSize('');
            setTempEventType('');
          }}>
          <FontAwesomeIcon
            icon={faPlus}
            size={20}
            color={colors.buttonText || '#fff'}
          />
        </TouchableOpacity>
      </View>

      {/* Search Bar with Filter Button */}
      <View style={themedStyles.searchFilterRow}>
        <View
          style={[
            themedStyles.searchContainer,
            themedStyles.searchContainerInRow,
          ]}>
          <FontAwesomeIcon
            icon={faSearch}
            size={18}
            color={colors.placeholder || '#888'}
            style={themedStyles.searchIcon}
          />
          <TextInput
            style={themedStyles.searchInput}
            placeholder={t('events.searchPlaceholder') || 'Search events...'}
            placeholderTextColor={colors.placeholder || '#888'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              style={themedStyles.clearButton}
              onPress={() => setSearchQuery('')}>
              <FontAwesomeIcon
                icon={faTimes}
                size={18}
                color={colors.placeholder || '#888'}
              />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={themedStyles.filterButton}
          onPress={() => setShowFilterModal(true)}>
          <FontAwesomeIcon
            icon={faFilter}
            size={20}
            color={activeFilterCount > 0 ? colors.primary : colors.text}
          />
          {activeFilterCount > 0 && (
            <View style={themedStyles.filterBadge}>
              <Text style={themedStyles.filterBadgeText}>
                {activeFilterCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <View style={themedStyles.activeFiltersContainer}>
          {selectedEventTypes.map(type => (
            <TouchableOpacity
              key={type}
              style={themedStyles.activeFilterTag}
              onPress={() => toggleEventType(type)}>
              <Text style={themedStyles.activeFilterTagText}>
                {getEventTypeEmoji(type)} {type}
              </Text>
              <FontAwesomeIcon
                icon={faTimes}
                size={12}
                color={colors.primary}
              />
            </TouchableOpacity>
          ))}
          {selectedDateFilter !== 'all' && (
            <TouchableOpacity
              style={themedStyles.activeFilterTag}
              onPress={() => setSelectedDateFilter('all')}>
              <Text style={themedStyles.activeFilterTagText}>
                📅{' '}
                {
                  dateFilterOptions.find(d => d.value === selectedDateFilter)
                    ?.label
                }
              </Text>
              <FontAwesomeIcon
                icon={faTimes}
                size={12}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}
          {showAvailableOnly && (
            <TouchableOpacity
              style={themedStyles.activeFilterTag}
              onPress={() => setShowAvailableOnly(false)}>
              <Text style={themedStyles.activeFilterTagText}>
                ✅ {t('events.availableOnly') || 'Available spots'}
              </Text>
              <FontAwesomeIcon
                icon={faTimes}
                size={12}
                color={colors.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <EventListSkeleton count={4} />
      ) : filteredEvents.length === 0 ? (
        <View style={themedStyles.noResultsContainer}>
          <FontAwesomeIcon
            icon={faPlus}
            size={48}
            color={colors.border}
            style={themedStyles.noResultsIcon}
          />
          <Text style={themedStyles.noResultsText}>
            {searchQuery ? t('common.noResults') : t('events.noEvents')}
          </Text>
          {searchQuery ? (
            <Text style={themedStyles.noResultsSubtext}>
              {t('events.tryDifferentSearch') || 'Try a different search term'}
            </Text>
          ) : showFirstTimeHint ? (
            <>
              <Text style={themedStyles.noResultsSubtext}>
                {t('events.noEventsSubtext') ||
                  'Create your first event and invite others to play!'}
              </Text>
              <TouchableOpacity
                style={themedStyles.ctaButton}
                onPress={() => {
                  dismissFirstTimeHint();
                  setModalVisible(true);
                }}>
                <FontAwesomeIcon icon={faPlus} size={16} color="#fff" />
                <Text style={themedStyles.ctaButtonText}>
                  {t('events.createFirstEvent') || 'Create Your First Event'}
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredEvents}
          renderItem={renderEventCard}
          keyExtractor={item => item._id}
          refreshing={loading}
          onRefresh={fetchEvents}
          onScrollToIndexFailed={info => {
            // Handle scroll failure gracefully
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
              });
            }, 100);
          }}
        />
      )}

      <Modal animationType="fade" transparent={true} visible={modalVisible}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={themedStyles.keyboardAvoidingView}>
          <View style={themedStyles.modalOverlay}>
            <View style={themedStyles.modalView}>
              <Text style={themedStyles.modalHeader}>
                {isEditing
                  ? `✏️ ${t('events.editEvent')}`
                  : `🎉 ${t('events.createEvent')}`}
              </Text>

              <TextInput
                style={themedStyles.modalInput}
                placeholder={t('events.eventName')}
                placeholderTextColor={colors.placeholder || '#888'}
                value={newEvent.name}
                onChangeText={text => setNewEvent({...newEvent, name: text})}
              />
              {/* Location Input with Autocomplete */}
              <View style={themedStyles.autocompleteContainer}>
                {isApiKeyConfigured ? (
                  <GooglePlacesAutocomplete
                    placeholder="Location/Facility"
                    onPress={(data, details = null) => {
                      console.log('Selected place:', data, details);
                      const location =
                        data.description ||
                        data.structured_formatting?.main_text ||
                        '';
                      const coords = details?.geometry?.location;

                      setNewEvent({
                        ...newEvent,
                        location: location,
                        latitude: coords?.lat,
                        longitude: coords?.lng,
                      });
                    }}
                    query={{
                      key: GOOGLE_PLACES_API_KEY,
                      language: 'en',
                      types: 'establishment|geocode',
                    }}
                    fetchDetails={true}
                    disableScroll={true}
                    listViewDisplayed="auto"
                    styles={autocompleteStyles}
                    onFail={error => {
                      console.warn('GooglePlacesAutocomplete error:', error);
                    }}
                    textInputProps={{
                      placeholderTextColor: colors.placeholder || '#888',
                    }}
                    enablePoweredByContainer={false}
                    debounce={200}
                  />
                ) : (
                  <TextInput
                    style={themedStyles.modalInput}
                    placeholder={t('events.eventLocation')}
                    placeholderTextColor={colors.placeholder || '#888'}
                    value={newEvent.location}
                    onChangeText={text =>
                      setNewEvent({...newEvent, location: text})
                    }
                  />
                )}
              </View>

              {/* Event Date selector */}
              <TouchableOpacity
                style={themedStyles.modalInput}
                onPress={() => setShowDatePicker(true)}>
                <Text
                  style={{
                    color: newEvent.date ? colors.text : colors.placeholder,
                  }}>
                  {newEvent.date ? newEvent.date : t('events.selectEventDate')}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <View>
                  <DateTimePicker
                    value={date || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                    textColor={colors.text}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setNewEvent({...newEvent, date: date?.toDateString()});
                      setShowDatePicker(false);
                    }}>
                    <Text style={themedStyles.confirmButton}>
                      {t('events.confirmDate')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Event Time selector */}
              <TouchableOpacity
                style={themedStyles.modalInput}
                onPress={() => setShowTimePicker(true)}>
                <Text
                  style={{
                    color: newEvent.time ? colors.text : colors.placeholder,
                  }}>
                  {newEvent.time ? newEvent.time : t('events.selectEventTime')}
                </Text>
              </TouchableOpacity>
              {showTimePicker && (
                <View>
                  <DateTimePicker
                    value={time || new Date()}
                    mode="time"
                    minuteInterval={15}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onTimeChange}
                    textColor={colors.text}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      setNewEvent({
                        ...newEvent,
                        time: time?.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                      });
                      setShowTimePicker(false);
                    }}>
                    <Text style={themedStyles.confirmButton}>
                      {t('events.confirmTime')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Roster Size selector */}
              <TouchableOpacity
                style={themedStyles.modalInput}
                onPress={() => {
                  setShowRosterSizePicker(true);
                  setTempRosterSize(newEvent.totalSpots || '');
                }}>
                <Text
                  style={{
                    color: newEvent.totalSpots
                      ? colors.text
                      : colors.placeholder,
                  }}>
                  {newEvent.totalSpots
                    ? newEvent.totalSpots
                    : t('events.selectRosterSize')}
                </Text>
              </TouchableOpacity>
              {showRosterSizePicker && (
                <View>
                  <View style={themedStyles.pickerContainer}>
                    <Picker
                      selectedValue={tempRosterSize}
                      onValueChange={itemValue => setTempRosterSize(itemValue)}
                      style={themedStyles.picker}
                      dropdownIconColor={colors.text}>
                      {rosterSizeOptions.map(value => (
                        <Picker.Item
                          key={value}
                          label={value}
                          value={value}
                          color={colors.text}
                        />
                      ))}
                    </Picker>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setNewEvent({...newEvent, totalSpots: tempRosterSize});
                      setShowRosterSizePicker(false);
                    }}>
                    <Text style={themedStyles.confirmButton}>
                      {t('events.confirmRosterSize')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Event Type selector */}
              <TouchableOpacity
                style={themedStyles.modalInput}
                onPress={() => {
                  setShowEventTypePicker(true);
                  setTempEventType(newEvent.eventType || '');
                }}>
                <Text
                  style={{
                    color: newEvent.eventType
                      ? colors.text
                      : colors.placeholder,
                  }}>
                  {newEvent.eventType
                    ? newEvent.eventType
                    : t('events.selectEventType')}
                </Text>
              </TouchableOpacity>
              {showEventTypePicker && (
                <View>
                  <View style={themedStyles.pickerContainer}>
                    <Picker
                      selectedValue={tempEventType}
                      onValueChange={itemValue => setTempEventType(itemValue)}
                      style={themedStyles.picker}
                      dropdownIconColor={colors.text}>
                      {activityOptions.map(opt => (
                        <Picker.Item
                          key={opt.label}
                          label={`${opt.emoji} ${opt.label}`}
                          value={opt.label}
                          color={colors.text}
                        />
                      ))}
                    </Picker>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      // Reset jersey colors when changing event type
                      setNewEvent({
                        ...newEvent,
                        eventType: tempEventType,
                        jerseyColors: [],
                      });
                      setShowEventTypePicker(false);
                    }}>
                    <Text style={themedStyles.confirmButton}>
                      {t('events.confirmEventType')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Jersey Color Selector - only for team sports */}
              {isTeamSport(newEvent.eventType) && (
                <>
                  <TouchableOpacity
                    style={themedStyles.modalInput}
                    onPress={() => setShowJerseyColorPicker(true)}>
                    <Text
                      style={{
                        color:
                          newEvent.jerseyColors.length === 2
                            ? colors.text
                            : colors.placeholder,
                      }}>
                      {newEvent.jerseyColors.length === 2
                        ? `Team Colors: ${newEvent.jerseyColors.join(' vs ')}`
                        : t('events.selectJerseyColors') ||
                          'Select 2 Jersey Colors'}
                    </Text>
                  </TouchableOpacity>
                  {showJerseyColorPicker && (
                    <View style={themedStyles.jerseyColorPickerContainer}>
                      <Text style={themedStyles.jerseyColorTitle}>
                        {t('events.selectTwoColors') ||
                          'Select 2 team jersey colors:'}
                      </Text>
                      <View style={themedStyles.jerseyColorGrid}>
                        {jerseyColorOptions.map(colorOpt => {
                          const isSelected = newEvent.jerseyColors.includes(
                            colorOpt.label,
                          );
                          const isLight =
                            colorOpt.label === 'White' ||
                            colorOpt.label === 'Yellow';
                          return (
                            <TouchableOpacity
                              key={colorOpt.label}
                              style={[
                                themedStyles.jerseyColorOption,
                                isSelected &&
                                  themedStyles.jerseyColorOptionSelected,
                              ]}
                              onPress={() => {
                                let updatedColors = [...newEvent.jerseyColors];
                                if (isSelected) {
                                  // Remove if already selected
                                  updatedColors = updatedColors.filter(
                                    c => c !== colorOpt.label,
                                  );
                                } else if (updatedColors.length < 2) {
                                  // Add if less than 2 selected
                                  updatedColors.push(colorOpt.label);
                                }
                                setNewEvent({
                                  ...newEvent,
                                  jerseyColors: updatedColors,
                                });
                              }}>
                              <View
                                style={[
                                  themedStyles.jerseyColorSwatch,
                                  {backgroundColor: colorOpt.color},
                                  isLight &&
                                    themedStyles.jerseyColorSwatchLight,
                                ]}
                              />
                              <Text style={themedStyles.jerseyColorLabel}>
                                {colorOpt.label}
                              </Text>
                              {isSelected && (
                                <Text style={themedStyles.jerseyColorCheck}>
                                  ✓
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <TouchableOpacity
                        onPress={() => setShowJerseyColorPicker(false)}>
                        <Text style={themedStyles.confirmButton}>
                          {t('common.done') || 'Done'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              <View style={themedStyles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    themedStyles.saveButton,
                    savingEvent && themedStyles.disabledOpacity,
                  ]}
                  onPress={handleSaveNewEvent}
                  disabled={savingEvent}>
                  {savingEvent ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={themedStyles.buttonText}>
                      {isEditing
                        ? t('events.saveChanges')
                        : t('events.createEvent')}
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[themedStyles.saveButton, themedStyles.cancelButton]}
                  onPress={handleCancelModal}
                  disabled={savingEvent}>
                  <Text
                    style={[
                      themedStyles.buttonText,
                      themedStyles.cancelButtonText,
                    ]}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={showFilterModal}
        onRequestClose={() => setShowFilterModal(false)}>
        <TouchableOpacity
          style={themedStyles.filterModalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilterModal(false)}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={e => e.stopPropagation()}
            style={themedStyles.filterModalContent}>
            <View style={themedStyles.filterModalHeader}>
              <Text style={themedStyles.filterModalTitle}>
                {t('events.filterEvents') || 'Filter Events'}
              </Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <FontAwesomeIcon icon={faTimes} size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Event Type Filter */}
              <View style={themedStyles.filterSection}>
                <Text style={themedStyles.filterSectionTitle}>
                  {t('events.eventType') || 'Event Type'}
                </Text>
                <View style={themedStyles.filterChipsContainer}>
                  {activityOptions.map(option => (
                    <TouchableOpacity
                      key={option.label}
                      style={[
                        themedStyles.filterChip,
                        selectedEventTypes.includes(option.label) &&
                          themedStyles.filterChipSelected,
                      ]}
                      onPress={() => toggleEventType(option.label)}>
                      <Text style={themedStyles.filterChipEmoji}>
                        {option.emoji}
                      </Text>
                      <Text
                        style={[
                          themedStyles.filterChipText,
                          selectedEventTypes.includes(option.label) &&
                            themedStyles.filterChipTextSelected,
                        ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Date Filter */}
              <View style={themedStyles.filterSection}>
                <Text style={themedStyles.filterSectionTitle}>
                  {t('events.dateRange') || 'Date'}
                </Text>
                {dateFilterOptions.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      themedStyles.dateFilterOption,
                      selectedDateFilter === option.value &&
                        themedStyles.dateFilterOptionSelected,
                    ]}
                    onPress={() => setSelectedDateFilter(option.value)}>
                    <Text
                      style={[
                        themedStyles.dateFilterOptionText,
                        selectedDateFilter === option.value &&
                          themedStyles.dateFilterOptionTextSelected,
                      ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Available Spots Filter */}
              <View style={themedStyles.filterSection}>
                <Text style={themedStyles.filterSectionTitle}>
                  {t('events.availability') || 'Availability'}
                </Text>
                <TouchableOpacity
                  style={[
                    themedStyles.toggleOption,
                    showAvailableOnly && themedStyles.toggleOptionSelected,
                  ]}
                  onPress={() => setShowAvailableOnly(!showAvailableOnly)}>
                  <Text
                    style={[
                      themedStyles.toggleOptionText,
                      showAvailableOnly &&
                        themedStyles.toggleOptionTextSelected,
                    ]}>
                    {t('events.availableOnly') ||
                      'Show only events with available spots'}
                  </Text>
                  {showAvailableOnly && (
                    <Text style={{color: colors.buttonText || '#fff'}}>✓</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Past Events Filter */}
              <View style={themedStyles.filterSection}>
                <Text style={themedStyles.filterSectionTitle}>
                  {t('events.pastEvents') || 'Past Events'}
                </Text>
                <TouchableOpacity
                  style={[
                    themedStyles.toggleOption,
                    !hidePastEvents && themedStyles.toggleOptionSelected,
                  ]}
                  onPress={() => setHidePastEvents(!hidePastEvents)}>
                  <Text
                    style={[
                      themedStyles.toggleOptionText,
                      !hidePastEvents && themedStyles.toggleOptionTextSelected,
                    ]}>
                    {t('events.showPastEvents') || 'Show past events'}
                  </Text>
                  {!hidePastEvents && (
                    <Text style={{color: colors.buttonText || '#fff'}}>✓</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={themedStyles.filterButtonsRow}>
              <TouchableOpacity
                style={themedStyles.clearFiltersButton}
                onPress={clearFilters}>
                <Text style={themedStyles.clearFiltersText}>
                  {t('events.clearFilters') || 'Clear All'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={themedStyles.applyFiltersButton}
                onPress={() => setShowFilterModal(false)}>
                <Text style={themedStyles.applyFiltersText}>
                  {t('events.applyFilters') || 'Apply Filters'}
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default EventList;
