import React, {useState, useEffect} from 'react';
import axios from 'axios';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import {RouteProp, useRoute} from '@react-navigation/native';

// Define the route params from the stack navigator
type EventRosterRouteProp = RouteProp<
  {
    EventRoster: {
      eventId: string;
      eventType: string;
      roster?: Player[];
      updateRoster: (eventId: string, newRoster: Player[]) => void;
    };
  },
  'EventRoster'
>;

// Define positions for different event types
const positionOptions = {
  Hockey: ['Center', 'Winger', 'Defenseman', 'Goalie'],
  'Figure Skating': ['Skater', 'Coach', 'Judge'],
  Football: [
    'Quarterback',
    'Running Back',
    'Full Back',
    'Tight End',
    'Wide Receiver',
    'Center',
    'Offensive Guard',
    'Offensive Tackle',
    'Defensive End',
    'Linebacker',
    'Cornerback',
    'Safety',
  ],
  Default: ['Participant'],
};

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#02131D',
  },
  input: {
    backgroundColor: '#fff',
    padding: 8,
    marginBottom: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  dropdown: {
    backgroundColor: '#fff',
    padding: 8,
    marginBottom: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#b11313',
    padding: 8,
    borderRadius: 5,
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
  },
  customText: {
    color: '#fff',
    marginBottom: 16,
  },
  headerText: {
    color: '#fff',
    fontSize: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  playerCard: {
    backgroundColor: '#333',
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
  },
  playerText: {
    color: '#fff',
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: 'red',
    marginTop: 8,
    paddingVertical: 5,
    borderRadius: 5,
  },
  deleteButtonText: {
    color: '#fff',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 10,
  },
  modalOption: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    textAlign: 'center',
  },
  modalClose: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#b11313',
    borderRadius: 5,
  },
  modalCloseText: {
    color: '#fff',
    textAlign: 'center',
  },
  errorMessage: {
    color: 'red',
    marginBottom: 16,
    textAlign: 'center',
  },
});

export interface Player {
  username: string;
  paidStatus: string;
  jerseyColor: string;
  position: string;
}

const EventRoster: React.FC = () => {
  const route = useRoute<EventRosterRouteProp>();
  const {eventId, eventType, updateRoster} = route.params;

  // Persist the roster in local state. Initially, it is empty until fetched from the API.
  const [roster, setRoster] = useState<Player[]>([]);
  const [username, setUsername] = useState('');
  const [paidStatus, setPaidStatus] = useState('');
  const [jerseyColor, setJerseyColor] = useState('');
  const [position, setPosition] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [paidStatusModalVisible, setPaidStatusModalVisible] = useState(false);
  const [jerseyColorModalVisible, setJerseyColorModalVisible] = useState(false);
  const [positionModalVisible, setPositionModalVisible] = useState(false);

  // Fetch persisted roster data when the component mounts.
  useEffect(() => {
    const fetchRoster = async () => {
      try {
        // Replace with your backend URL and endpoint.
        const response = await axios.get(
          `https://your-backend.com/events/${eventId}/roster`,
        );
        setRoster(response.data.roster || []);
      } catch (error) {
        console.error('Error fetching roster:', error);
      }
    };
    fetchRoster();
  }, [eventId]);

  // Persist the updated roster to the backend.
  const persistRoster = async (updatedRoster: Player[]) => {
    try {
      // Replace with your backend URL and endpoint.
      await axios.put(`https://your-backend.com/events/${eventId}/roster`, {
        roster: updatedRoster,
      });
    } catch (error) {
      console.error('Error updating roster in database:', error);
    }
  };

  const handleSave = async () => {
    if (!username || !paidStatus || !jerseyColor || !position) {
      setErrorMessage('Please fill out all fields.');
      return;
    }
    const newPlayer: Player = {username, paidStatus, jerseyColor, position};
    const updatedRoster = [...roster, newPlayer];
    setRoster(updatedRoster);
    updateRoster(eventId, updatedRoster);
    await persistRoster(updatedRoster);
    setUsername('');
    setPaidStatus('');
    setJerseyColor('');
    setPosition('');
    setErrorMessage('');
  };

  const handleDelete = async (index: number) => {
    Alert.alert(
      'Delete Player',
      'Are you sure you want to remove this player?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedRoster = roster.filter((_, i) => i !== index);
            setRoster(updatedRoster);
            updateRoster(eventId, updatedRoster);
            await persistRoster(updatedRoster);
          },
        },
      ],
    );
  };

  const renderPlayerCard = ({item, index}: {item: Player; index: number}) => (
    <View style={styles.playerCard}>
      <Text style={styles.playerText}>
        Name: {item.username} {'\n'}
        Paid: {item.paidStatus} {'\n'}
        Jersey: {item.jerseyColor} {'\n'}
        Position: {item.position}
      </Text>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(index)}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Event ID: {eventId}</Text>

      {errorMessage ? (
        <Text style={styles.errorMessage}>{errorMessage}</Text>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        value={username}
        onChangeText={setUsername}
      />

      {/* Paid Status Dropdown */}
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setPaidStatusModalVisible(true)}>
        <Text>{paidStatus ? paidStatus : 'Select Paid Status'}</Text>
      </TouchableOpacity>
      <Modal visible={paidStatusModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              onPress={() => {
                setPaidStatus('Yes');
                setPaidStatusModalVisible(false);
              }}>
              <Text style={styles.modalOption}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setPaidStatus('No');
                setPaidStatusModalVisible(false);
              }}>
              <Text style={styles.modalOption}>No</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setPaidStatusModalVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Jersey Color Dropdown */}
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setJerseyColorModalVisible(true)}>
        <Text>{jerseyColor ? jerseyColor : 'Select Jersey Color'}</Text>
      </TouchableOpacity>
      <Modal
        visible={jerseyColorModalVisible}
        transparent
        animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              onPress={() => {
                setJerseyColor('Dark');
                setJerseyColorModalVisible(false);
              }}>
              <Text style={styles.modalOption}>Dark</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setJerseyColor('White');
                setJerseyColorModalVisible(false);
              }}>
              <Text style={styles.modalOption}>White</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setJerseyColorModalVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Position Dropdown */}
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setPositionModalVisible(true)}>
        <Text>{position ? position : 'Select Position'}</Text>
      </TouchableOpacity>
      <Modal visible={positionModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {(positionOptions[eventType] || positionOptions.Default).map(
              option => (
                <TouchableOpacity
                  key={option}
                  onPress={() => {
                    setPosition(option);
                    setPositionModalVisible(false);
                  }}>
                  <Text style={styles.modalOption}>{option}</Text>
                </TouchableOpacity>
              ),
            )}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setPositionModalVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.buttonText}>Add Player</Text>
      </TouchableOpacity>

      <FlatList
        data={roster}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderPlayerCard}
      />
    </View>
  );
};

export default EventRoster;
