import React, {useState, useContext, useMemo, useEffect} from 'react';
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
} from 'react-native';
import MapView, {Marker} from 'react-native-maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Picker} from '@react-native-picker/picker';
import {GooglePlacesAutocomplete} from 'react-native-google-places-autocomplete';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faPlus, faTrash, faCog} from '@fortawesome/free-solid-svg-icons';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import UserContext, {UserContextType} from '../UserContext';
import {useTheme} from '../ThemeContext/ThemeContext';
import axios from 'axios';
import {API_BASE_URL} from '../../config/api';

export type RootStackParamList = {
  EventList: undefined;
  EventRoster: {
    eventId: string;
    eventName: string;
    eventType: string;
    date: string;
    time: string;
    location: string;
    totalSpots: number;
    roster: any[];
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
}

// Google Places API configuration
const GOOGLE_PLACES_API_KEY = 'AIzaSyB2whAJQnbVtkVlHp98SSGIO-FB_dcK6qY';

// Check if API key is configured
const isApiKeyConfigured = true;

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

const getEventTypeEmoji = (eventType: string) => {
  const found = activityOptions.find(
    opt => opt.label.toLowerCase() === eventType.toLowerCase(),
  );
  return found ? found.emoji : '🎯';
};

// Prefer Google Maps; fall back to Waze, then Apple (iOS) or geo (Android)
const openMapsForEvent = async (event: Partial<Event>) => {
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
    Alert.alert('Unable to open maps', 'Please install a maps app.');
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
          backgroundColor: colors.background,
          zIndex: 1,
        },
        title: {
          fontSize: 25,
          color: colors.text,
          textAlign: 'center',
          flex: 1,
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
          backgroundColor: colors.background,
          borderRadius: 8,
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: colors.primary,
          marginRight: 8,
        },
        joinButton: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        actionButtonText: {
          marginLeft: 6,
          fontWeight: 'bold',
          color: colors.primary,
        },
        joinButtonText: {
          color: colors.buttonText || '#fff',
        },
        iconContainer: {
          flexDirection: 'row',
          justifyContent: 'flex-end',
          marginTop: 10,
        },
        iconButton: {
          marginLeft: 10,
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
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newEvent, setNewEvent] = useState(() => createEmptyEvent());

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

  const navigation = useNavigation<NavigationProp<any>>();

  // Fetch events from backend
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/events`);
      setEventData(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch events.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNewEvent = async () => {
    if (
      newEvent.name &&
      newEvent.location &&
      newEvent.time &&
      newEvent.date &&
      newEvent.totalSpots &&
      newEvent.eventType
    ) {
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
            },
          );
          setEventData(prevData =>
            prevData.map(event =>
              event._id === editingEventId ? response.data : event,
            ),
          );
        } catch (error) {
          Alert.alert('Error', 'Failed to update event.');
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
          });
          setEventData(prevData => [...prevData, response.data]);
        } catch (error) {
          Alert.alert('Error', 'Failed to create event.');
        }
      }
      setModalVisible(false);
      setNewEvent(createEmptyEvent());
      setTempRosterSize('');
      setTempEventType('');
      setIsEditing(false);
      setEditingEventId(null);
    } else {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
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
    });
  };

  const handleDeleteEvent = (event: Event) => {
    if (event.createdBy !== (userData?._id || '')) {
      Alert.alert('Not Authorized', 'You can only delete events you created.');
      return;
    }
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`${API_BASE_URL}/events/${event._id}`);
              setEventData(prevData =>
                prevData.filter(e => e._id !== event._id),
              );
            } catch (error) {
              Alert.alert('Error', 'Failed to delete event.');
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
    });
    setModalVisible(true);
    setTempRosterSize(event.totalSpots.toString());
    setTempEventType(event.eventType);
    setIsEditing(true);
    setEditingEventId(event._id);
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

  const renderEventCard = ({item}: {item: Event}) => (
    <View style={themedStyles.card}>
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
            Created by {item.createdByUsername}
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
          {item.rosterSpotsFilled} / {item.totalSpots} players joined
        </Text>
      </View>

      {/* Spacer */}
      <View style={themedStyles.cardSpacer} />

      {/* Interactive Map View */}
      <TouchableOpacity
        style={themedStyles.mapBox}
        onPress={() => openMapsForEvent(item)}
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
          <Text style={themedStyles.mapSubtext}>Tap to open in Maps</Text>
        </View>
      </TouchableOpacity>

      {/* Spacer */}
      <View style={themedStyles.cardSpacer} />

      {/* Action Buttons */}
      <View style={themedStyles.actionRow}>
        <TouchableOpacity
          style={themedStyles.actionButton}
          onPress={() => openMapsForEvent(item)}>
          <Text style={themedStyles.cardEmoji}>🧭</Text>
          <Text style={themedStyles.actionButtonText}>Get Directions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[themedStyles.actionButton, themedStyles.joinButton]}
          onPress={() => handleEventPress(item)}>
          <Text style={themedStyles.cardEmoji}>📲</Text>
          <Text
            style={[
              themedStyles.actionButtonText,
              themedStyles.joinButtonText,
            ]}>
            Join Event
          </Text>
        </TouchableOpacity>
      </View>

      {/* Edit/Delete Icons - only show delete for events created by current user */}
      <View style={themedStyles.iconContainer}>
        <TouchableOpacity
          style={themedStyles.iconButton}
          onPress={() => handleEditEvent(item)}>
          <FontAwesomeIcon icon={faCog} size={20} color={colors.text} />
        </TouchableOpacity>
        {userData?._id === item.createdBy && (
          <TouchableOpacity
            style={themedStyles.iconButton}
            onPress={() => handleDeleteEvent(item)}>
            <FontAwesomeIcon icon={faTrash} size={20} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={themedStyles.container} edges={['top']}>
      {/* Header */}
      <View style={themedStyles.header}>
        <HamburgerMenu />
        <Text style={themedStyles.title}>Event List</Text>
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

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={eventData}
          renderItem={renderEventCard}
          keyExtractor={item => item._id}
          refreshing={loading}
          onRefresh={fetchEvents}
        />
      )}

      <Modal animationType="fade" transparent={true} visible={modalVisible}>
        <View style={themedStyles.modalOverlay}>
          <View style={themedStyles.modalView}>
            <Text style={themedStyles.modalHeader}>
              {isEditing ? '✏️ Edit Event' : '🎉 Create New Event'}
            </Text>

            <TextInput
              style={themedStyles.modalInput}
              placeholder="Event Name"
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
                  placeholder="Location/Facility"
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
                {newEvent.date ? newEvent.date : 'Select Event Date'}
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
                  <Text style={themedStyles.confirmButton}>Confirm Date</Text>
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
                {newEvent.time ? newEvent.time : 'Select Event Time'}
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
                  <Text style={themedStyles.confirmButton}>Confirm Time</Text>
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
                  color: newEvent.totalSpots ? colors.text : colors.placeholder,
                }}>
                {newEvent.totalSpots
                  ? newEvent.totalSpots
                  : 'Select Roster Size'}
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
                    Confirm Roster Size
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
                  color: newEvent.eventType ? colors.text : colors.placeholder,
                }}>
                {newEvent.eventType ? newEvent.eventType : 'Select Event Type'}
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
                    setNewEvent({...newEvent, eventType: tempEventType});
                    setShowEventTypePicker(false);
                  }}>
                  <Text style={themedStyles.confirmButton}>
                    Confirm Event Type
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={themedStyles.buttonContainer}>
              <TouchableOpacity
                style={themedStyles.saveButton}
                onPress={handleSaveNewEvent}>
                <Text style={themedStyles.buttonText}>
                  {isEditing ? 'Save Changes' : 'Create Event'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[themedStyles.saveButton, themedStyles.cancelButton]}
                onPress={handleCancelModal}>
                <Text
                  style={[
                    themedStyles.buttonText,
                    themedStyles.cancelButtonText,
                  ]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default EventList;
