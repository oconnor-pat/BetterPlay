import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
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
      updateRoster: (eventId: string, playerAdded: boolean) => void;
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
  rosterItem: {
    backgroundColor: '#333',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  rosterText: {
    color: '#fff',
  },
  deleteButton: {
    backgroundColor: 'red',
    padding: 5,
    borderRadius: 5,
    marginTop: 5,
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

interface Player {
  username: string;
  paidStatus: string;
  jerseyColor: string;
  position: string;
}

const EventRoster: React.FC = () => {
  const route = useRoute<EventRosterRouteProp>();
  const {eventId, eventType, updateRoster} = route.params;

  const [username, setUsername] = useState('');
  const [paidStatus, setPaidStatus] = useState('');
  const [jerseyColor, setJerseyColor] = useState('');
  const [position, setPosition] = useState('');
  const [roster, setRoster] = useState<Player[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const [paidStatusModalVisible, setPaidStatusModalVisible] = useState(false);
  const [jerseyColorModalVisible, setJerseyColorModalVisible] = useState(false);
  const [positionModalVisible, setPositionModalVisible] = useState(false);

  const handleSave = () => {
    if (!username || !paidStatus || !jerseyColor || !position) {
      setErrorMessage('Please fill out all fields.');
      return;
    }

    const newPlayer = {username, paidStatus, jerseyColor, position};
    setRoster([...roster, newPlayer]);
    updateRoster(eventId, true); // Increment roster spots filled
    setUsername('');
    setPaidStatus('');
    setJerseyColor('');
    setPosition('');
    setErrorMessage('');
  };

  const handleDelete = (index: number) => {
    Alert.alert(
      'Delete Player',
      'Are you sure you want to remove this player?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedRoster = roster.filter((_, i) => i !== index);
            setRoster(updatedRoster);
            updateRoster(eventId, false); // Decrement roster spots filled
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.customText}>Event ID: {eventId}</Text>

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

      <Button title="Save" onPress={handleSave} />

      <FlatList
        data={roster}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({item, index}) => (
          <View style={styles.rosterItem}>
            <Text style={styles.rosterText}>
              Name: {item.username} | Paid: {item.paidStatus} | Jersey:{' '}
              {item.jerseyColor} | Position: {item.position}
            </Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(index)}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
};

export default EventRoster;
