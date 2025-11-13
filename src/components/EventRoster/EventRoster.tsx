import React, {useState, useEffect, useMemo, useContext} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {RouteProp, useRoute} from '@react-navigation/native';
import {useTheme} from '../ThemeContext/ThemeContext';
import axios from 'axios';
import {useEventContext} from '../../Context/EventContext';
import UserContext, {UserContextType} from '../UserContext';

export interface Player {
  username: string;
  paidStatus: string;
  jerseyColor: string;
  position: string;
}

type EventRosterRouteProp = RouteProp<
  {
    EventRoster: {
      eventId: string;
      eventName: string;
      eventType: string;
      date?: string;
      time?: string;
      location?: string;
      roster?: Player[];
    };
  },
  'EventRoster'
>;

const positionOptions: Record<string, string[]> = {
  Basketball: ['Guard', 'Forward', 'Center'],
  Hockey: ['Forward', 'Defense', 'Goalie'],
  Soccer: ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'],
  Default: ['Player'],
};

const API_BASE_URL = 'http://localhost:8001'; // Change to your LAN IP if needed

const getInitials = (name: string) => {
  if (!name) {
    return '';
  }
  return name
    .split(' ')
    .map(part => part[0]?.toUpperCase())
    .join('');
};

const EventRoster: React.FC = () => {
  const route = useRoute<EventRosterRouteProp>();
  const {
    eventId,
    eventName,
    eventType,
    date,
    time,
    location,
    roster: initialRoster,
  } = route.params;
  const {colors} = useTheme();
  const {updateRosterSpots} = useEventContext();
  const {userData} = useContext(UserContext) as UserContextType;

  const [roster, setRoster] = useState<Player[]>(initialRoster || []);
  const [username, setUsername] = useState('');
  const [paidStatus, setPaidStatus] = useState('');
  const [jerseyColor, setJerseyColor] = useState('');
  const [position, setPosition] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [paidStatusModalVisible, setPaidStatusModalVisible] = useState(false);
  const [jerseyColorModalVisible, setJerseyColorModalVisible] = useState(false);
  const [positionModalVisible, setPositionModalVisible] = useState(false);

  const [loading, setLoading] = useState(false);

  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          padding: 16,
          backgroundColor: colors.background,
        },
        eventHeader: {
          fontSize: 26,
          fontWeight: 'bold',
          color: colors.primary,
          textAlign: 'center',
          marginBottom: 10,
          marginTop: 8,
        },
        eventCard: {
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 18,
          marginBottom: 20,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 2},
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2,
        },
        eventTypeSubtitle: {
          color: colors.primary,
          fontSize: 20,
          fontWeight: '700',
          marginBottom: 12,
          marginLeft: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        eventDetail: {
          color: colors.text,
          fontSize: 15,
          marginBottom: 2,
        },
        sectionTitle: {
          fontSize: 18,
          fontWeight: '600',
          color: colors.primary,
          marginBottom: 10,
          marginTop: 10,
        },
        input: {
          backgroundColor: colors.inputBackground,
          color: colors.text,
          padding: 10,
          marginBottom: 14,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: colors.border,
          fontSize: 16,
        },
        dropdown: {
          backgroundColor: colors.inputBackground,
          padding: 10,
          marginBottom: 14,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: colors.border,
          justifyContent: 'center',
        },
        saveButton: {
          backgroundColor: colors.primary,
          padding: 12,
          borderRadius: 8,
          marginBottom: 18,
          alignItems: 'center',
        },
        buttonText: {
          color: colors.buttonText,
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: 16,
        },
        customText: {
          color: colors.text,
          marginBottom: 14,
        },
        playerCard: {
          backgroundColor: colors.card,
          flexDirection: 'row',
          alignItems: 'center',
          padding: 14,
          marginBottom: 10,
          borderRadius: 10,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 1},
          shadowOpacity: 0.06,
          shadowRadius: 2,
          elevation: 1,
        },
        avatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        },
        avatarText: {
          color: colors.buttonText,
          fontWeight: 'bold',
          fontSize: 18,
        },
        playerInfo: {
          flex: 1,
        },
        playerText: {
          color: colors.text,
          fontSize: 15,
          marginBottom: 2,
        },
        deleteButton: {
          backgroundColor: colors.error,
          paddingVertical: 7,
          paddingHorizontal: 14,
          borderRadius: 6,
          marginLeft: 10,
        },
        deleteButtonText: {
          color: colors.buttonText,
          textAlign: 'center',
          fontWeight: 'bold',
        },
        modalContainer: {
          flex: 1,
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.25)',
        },
        modalContent: {
          backgroundColor: colors.card,
          margin: 24,
          padding: 22,
          borderRadius: 12,
        },
        modalOption: {
          padding: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          textAlign: 'center',
          color: colors.text,
          fontSize: 16,
        },
        modalClose: {
          marginTop: 12,
          padding: 12,
          backgroundColor: colors.primary,
          borderRadius: 7,
        },
        modalCloseText: {
          color: colors.buttonText,
          textAlign: 'center',
          fontWeight: 'bold',
        },
        errorMessage: {
          color: colors.error,
          marginBottom: 16,
          textAlign: 'center',
        },
        placeholderText: {
          color: colors.placeholder,
        },
        emptyState: {
          textAlign: 'center',
          color: colors.placeholder,
          fontSize: 16,
          marginTop: 30,
        },
      }),
    [colors],
  );

  // Fetch roster from backend on mount for freshness
  useEffect(() => {
    const fetchRoster = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/events/${eventId}`);
        setRoster(response.data.roster || []);
      } catch (error) {
        setRoster([]);
      }
      setLoading(false);
    };
    fetchRoster();
  }, [eventId]);

  // Persist roster to backend
  const persistRoster = async (updatedRoster: Player[]) => {
    try {
      await axios.put(`${API_BASE_URL}/events/${eventId}/roster`, {
        roster: updatedRoster,
      });
    } catch (error) {
      // handle error
    }
  };

  // Add player
  const handleSave = async () => {
    if (!username || !paidStatus || !jerseyColor || !position) {
      setErrorMessage('Please fill out all fields.');
      return;
    }
    const newPlayer: Player = {username, paidStatus, jerseyColor, position};
    const updatedRoster = [...roster, newPlayer];
    setRoster(updatedRoster);
    await persistRoster(updatedRoster);
    updateRosterSpots(eventId, updatedRoster.length);

    setUsername('');
    setPaidStatus('');
    setJerseyColor('');
    setPosition('');
    setErrorMessage('');
  };

  // Delete player (only allow logged-in user to remove themselves)
  const handleDelete = async (index: number) => {
    const playerToDelete = roster[index];
    if (!userData?.username || playerToDelete.username !== userData.username) {
      Alert.alert('Error', 'You can only remove yourself from the roster.');
      return;
    }
    Alert.alert(
      'Delete Player',
      'Are you sure you want to remove yourself from this event?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedRoster = roster.filter((_, i) => i !== index);
            setRoster(updatedRoster);
            await persistRoster(updatedRoster);
            updateRosterSpots(eventId, updatedRoster.length);
          },
        },
      ],
    );
  };

  const renderPlayerCard = ({item, index}: {item: Player; index: number}) => (
    <View style={themedStyles.playerCard}>
      <View style={themedStyles.avatar}>
        <Text style={themedStyles.avatarText}>
          {getInitials(item.username)}
        </Text>
      </View>
      <View style={themedStyles.playerInfo}>
        <Text style={themedStyles.playerText}>Name: {item.username}</Text>
        <Text style={themedStyles.playerText}>Paid: {item.paidStatus}</Text>
        <Text style={themedStyles.playerText}>Jersey: {item.jerseyColor}</Text>
        <Text style={themedStyles.playerText}>Position: {item.position}</Text>
      </View>
      {item.username === userData?.username && (
        <TouchableOpacity
          style={themedStyles.deleteButton}
          onPress={() => handleDelete(index)}>
          <Text style={themedStyles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={themedStyles.container}>
      {/* Event Name Header */}
      <Text style={themedStyles.eventHeader}>{eventName}</Text>

      {/* Event Details Card */}
      <View style={themedStyles.eventCard}>
        <Text style={themedStyles.eventTypeSubtitle}>{eventType}</Text>
        {date && <Text style={themedStyles.eventDetail}>Date: {date}</Text>}
        {time && <Text style={themedStyles.eventDetail}>Time: {time}</Text>}
        {location && (
          <Text style={themedStyles.eventDetail}>Location: {location}</Text>
        )}
      </View>

      {/* Add Player Section */}
      <Text style={themedStyles.sectionTitle}>Add Player</Text>
      {errorMessage ? (
        <Text style={themedStyles.errorMessage}>{errorMessage}</Text>
      ) : null}

      <TextInput
        style={themedStyles.input}
        placeholder="Enter your name"
        placeholderTextColor={colors.placeholder}
        value={username}
        onChangeText={setUsername}
      />

      {/* Paid Status Dropdown */}
      <TouchableOpacity
        style={themedStyles.dropdown}
        onPress={() => setPaidStatusModalVisible(true)}>
        <Text
          style={
            paidStatus ? themedStyles.customText : themedStyles.placeholderText
          }>
          {paidStatus ? paidStatus : 'Select Paid Status'}
        </Text>
      </TouchableOpacity>
      <Modal
        visible={paidStatusModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPaidStatusModalVisible(false)}>
        <View style={themedStyles.modalContainer}>
          <View style={themedStyles.modalContent}>
            {['Paid', 'Unpaid'].map(status => (
              <TouchableOpacity
                key={status}
                onPress={() => {
                  setPaidStatus(status);
                  setPaidStatusModalVisible(false);
                }}>
                <Text style={themedStyles.modalOption}>{status}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={themedStyles.modalClose}
              onPress={() => setPaidStatusModalVisible(false)}>
              <Text style={themedStyles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Jersey Color Dropdown */}
      <TouchableOpacity
        style={themedStyles.dropdown}
        onPress={() => setJerseyColorModalVisible(true)}>
        <Text
          style={
            jerseyColor ? themedStyles.customText : themedStyles.placeholderText
          }>
          {jerseyColor ? jerseyColor : 'Select Jersey Color'}
        </Text>
      </TouchableOpacity>
      <Modal
        visible={jerseyColorModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJerseyColorModalVisible(false)}>
        <View style={themedStyles.modalContainer}>
          <View style={themedStyles.modalContent}>
            {['Red', 'Blue', 'Green', 'White', 'Black', 'Yellow', 'Other'].map(
              color => (
                <TouchableOpacity
                  key={color}
                  onPress={() => {
                    setJerseyColor(color);
                    setJerseyColorModalVisible(false);
                  }}>
                  <Text style={themedStyles.modalOption}>{color}</Text>
                </TouchableOpacity>
              ),
            )}
            <TouchableOpacity
              style={themedStyles.modalClose}
              onPress={() => setJerseyColorModalVisible(false)}>
              <Text style={themedStyles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Position Dropdown */}
      <TouchableOpacity
        style={themedStyles.dropdown}
        onPress={() => setPositionModalVisible(true)}>
        <Text
          style={
            position ? themedStyles.customText : themedStyles.placeholderText
          }>
          {position ? position : 'Select Position'}
        </Text>
      </TouchableOpacity>
      <Modal
        visible={positionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPositionModalVisible(false)}>
        <View style={themedStyles.modalContainer}>
          <View style={themedStyles.modalContent}>
            {(positionOptions[eventType] || positionOptions.Default).map(
              pos => (
                <TouchableOpacity
                  key={pos}
                  onPress={() => {
                    setPosition(pos);
                    setPositionModalVisible(false);
                  }}>
                  <Text style={themedStyles.modalOption}>{pos}</Text>
                </TouchableOpacity>
              ),
            )}
            <TouchableOpacity
              style={themedStyles.modalClose}
              onPress={() => setPositionModalVisible(false)}>
              <Text style={themedStyles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={themedStyles.saveButton} onPress={handleSave}>
        <Text style={themedStyles.buttonText}>Add Player</Text>
      </TouchableOpacity>

      {/* Rostered Players Section */}
      <Text style={themedStyles.sectionTitle}>Rostered Players</Text>
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : roster.length === 0 ? (
        <Text style={themedStyles.emptyState}>
          No players have been rostered yet.
        </Text>
      ) : (
        <FlatList
          data={roster}
          renderItem={renderPlayerCard}
          keyExtractor={(_, idx) => idx.toString()}
        />
      )}
    </View>
  );
};

export default EventRoster;
