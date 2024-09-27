import React, {useState} from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faPlus} from '@fortawesome/free-solid-svg-icons';
import {useNavigation, NavigationProp} from '@react-navigation/native';

export type RootStackParamList = {
  EventList: undefined;
  EventRoster: {
    eventId: string;
    eventType: string;
    updateRoster: (eventId: string, playerAdded: boolean) => void;
  };
  Profile: {_id: string};
};

interface Event {
  id: string;
  name: string;
  location: string;
  time: string;
  date: string;
  rosterSpotsFilled: number;
  totalSpots: number;
  eventType: string;
}

const initialEventData: Event[] = [
  {
    id: '1',
    name: 'Open Hockey Session',
    location: 'Sportscare Arena',
    time: '1:30-2:30pm',
    date: '09/15/2024',
    rosterSpotsFilled: 0,
    totalSpots: 20,
    eventType: 'Hockey',
  },
  {
    id: '2',
    name: 'Skating Practice',
    location: 'Main Rink',
    time: '3:00-4:00pm',
    date: '09/16/2024',
    rosterSpotsFilled: 0,
    totalSpots: 15,
    eventType: 'Figure Skating',
  },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#02131D',
  },
  title: {
    fontSize: 25,
    marginBottom: 20,
    color: '#fff',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  cardText: {
    color: '#fff',
    marginBottom: 8,
  },
  addButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
  },
  modalView: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#02131D',
  },
  modalInput: {
    backgroundColor: '#fff',
    padding: 8,
    marginBottom: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  saveButton: {
    backgroundColor: '#b11313',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
  },
  modalHeader: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 16,
  },
});

const EventList: React.FC = () => {
  const [eventData, setEventData] = useState(initialEventData);
  const [modalVisible, setModalVisible] = useState(false);
  const [newEvent, setNewEvent] = useState({
    name: '',
    location: '',
    time: '',
    date: '',
    totalSpots: '',
    eventType: '',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState<Date | undefined>(new Date());

  const navigation = useNavigation<NavigationProp<any>>();

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
      setNewEvent({...newEvent, date: selectedDate.toDateString()});
    }
  };

  const onTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const roundedTime = new Date(
        Math.ceil(selectedTime.getTime() / 15 / 1000) * 15 * 1000,
      );
      setTime(roundedTime);
      setNewEvent({
        ...newEvent,
        time: roundedTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    }
  };

  const handleSaveNewEvent = () => {
    if (
      newEvent.name &&
      newEvent.location &&
      newEvent.time &&
      newEvent.date &&
      newEvent.totalSpots &&
      newEvent.eventType
    ) {
      const id = (eventData.length + 1).toString();
      setEventData(prevData => [
        ...prevData,
        {
          id,
          name: newEvent.name,
          location: newEvent.location,
          time: newEvent.time,
          date: newEvent.date,
          totalSpots: parseInt(newEvent.totalSpots, 10),
          rosterSpotsFilled: 0,
          eventType: newEvent.eventType,
        },
      ]);

      setModalVisible(false);
      setNewEvent({
        name: '',
        location: '',
        time: '',
        date: '',
        totalSpots: '',
        eventType: '',
      });
    } else {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
    }
  };

  const handleEventPress = (eventId: string, eventType: string) => {
    navigation.navigate('EventRoster', {eventId, eventType, updateRoster});
  };

  const updateRoster = (eventId: string, playerAdded: boolean) => {
    setEventData(prevData =>
      prevData.map(event =>
        event.id === eventId
          ? {
              ...event,
              rosterSpotsFilled:
                event.rosterSpotsFilled + (playerAdded ? 1 : -1),
            }
          : event,
      ),
    );
  };

  const renderEventCard = ({item}: {item: Event}) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => handleEventPress(item.id, item.eventType)}>
      <Text style={styles.cardText}>{item.name}</Text>
      <Text style={styles.cardText}>{item.location}</Text>
      <Text style={styles.cardText}>{item.time}</Text>
      <Text style={styles.cardText}>{item.date}</Text>
      <Text style={styles.cardText}>
        {item.rosterSpotsFilled}/{item.totalSpots} roster spots filled
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Event List</Text>

      <FlatList
        data={eventData}
        renderItem={renderEventCard}
        keyExtractor={item => item.id}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}>
        <FontAwesomeIcon icon={faPlus} size={20} color="#fff" />
      </TouchableOpacity>

      <Modal animationType="slide" transparent={true} visible={modalVisible}>
        <View style={styles.modalView}>
          <Text style={styles.modalHeader}>Create New Event</Text>

          <TextInput
            style={styles.modalInput}
            placeholder="Event Name"
            value={newEvent.name}
            onChangeText={text => setNewEvent({...newEvent, name: text})}
          />
          <TextInput
            style={styles.modalInput}
            placeholder="Location/Facility"
            value={newEvent.location}
            onChangeText={text => setNewEvent({...newEvent, location: text})}
          />

          <TouchableOpacity
            style={styles.modalInput}
            onPress={() => setShowDatePicker(true)}>
            <Text>{newEvent.date ? newEvent.date : 'Select Event Date'}</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={date || new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onDateChange}
            />
          )}

          <TouchableOpacity
            style={styles.modalInput}
            onPress={() => setShowTimePicker(true)}>
            <Text>{newEvent.time ? newEvent.time : 'Select Event Time'}</Text>
          </TouchableOpacity>
          {showTimePicker && (
            <DateTimePicker
              value={time || new Date()}
              mode="time"
              minuteInterval={15}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onTimeChange}
            />
          )}

          <TextInput
            style={styles.modalInput}
            placeholder="Roster Size"
            keyboardType="numeric"
            value={newEvent.totalSpots}
            onChangeText={text => setNewEvent({...newEvent, totalSpots: text})}
          />
          <TextInput
            style={styles.modalInput}
            placeholder="Event Type"
            value={newEvent.eventType}
            onChangeText={text => setNewEvent({...newEvent, eventType: text})}
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveNewEvent}>
            <Text style={styles.buttonText}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => setModalVisible(false)}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default EventList;
