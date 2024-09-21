import React, {useState} from 'react';
import {View, Text, TextInput, Button, StyleSheet} from 'react-native';
import {RouteProp, useRoute} from '@react-navigation/native';
import {RootStackParamList} from '../Event-list/EventList';

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
  },
  saveButton: {
    backgroundColor: '#b11313',
    padding: 8,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
  },
  customText: {
    color: '#fff',
    marginBottom: 16,
  },
});

const EventRoster: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'EventRoster'>>();
  const {eventId} = route.params;

  const [username, setUsername] = useState('');
  const [paidStatus, setPaidStatus] = useState('');

  const handleSave = () => {
    // Logic to save user data to the roster for this event
    console.log('User added to event:', eventId, username, paidStatus);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.customText}>Event ID: {eventId}</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your username"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Enter Paid Status (Yes/No)"
        value={paidStatus}
        onChangeText={setPaidStatus}
      />
      <Button title="Save" onPress={handleSave} />
    </View>
  );
};

export default EventRoster;
