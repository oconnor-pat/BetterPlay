import React, {useState, useEffect} from 'react';
import {View, Text, FlatList, StyleSheet, TouchableOpacity} from 'react-native';
import {useNavigation, NavigationProp} from '@react-navigation/native';

// Interfaces
interface RosterItem {
  id: string;
  name: string;
  email: string;
  attending: boolean;
  paid: boolean;
}

type RootStackParamList = {
  Profile: {userId: string}; // Add other screens here
  Roster: undefined;
};

// Mock data for testing
const rosterData = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    attending: true,
    paid: false,
  },
  {
    id: '2',
    name: 'Jane Doe',
    email: 'jane@example.com',
    attending: false,
    paid: true,
  },
  // Add more data as needed
];

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#02131D',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#447bbe',
    paddingVertical: 8,
    marginBottom: 8,
  },
  headerCell: {
    flex: 1,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#ccc',
    paddingVertical: 8,
  },
  cell: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
  },
  viewProfileButton: {
    backgroundColor: '#b11313',
    borderRadius: 5,
    padding: 8,
  },
  buttonText: {
    color: '#fff',
  },
});

const Roster: React.FC = () => {
  // Initialize roster state with empty array of RosterItem
  const [roster, setRoster] = useState<RosterItem[]>([]);

  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const handleViewProfile = (userId: string) => {
    // Navigate to the profile component with the user ID
    navigation.navigate('Profile', {userId});
  };

  useEffect(() => {
    // In a real app, you would fetch roster data from your backend
    setRoster(rosterData);
  }, []);

  const renderItem = ({item}: {item: RosterItem}) => (
    <View style={styles.row}>
      <Text style={styles.cell}>{item.name}</Text>
      <Text style={styles.cell}>{item.email}</Text>
      <Text style={styles.cell}>
        {item.attending ? 'Attending' : 'Not Attending'}
      </Text>
      <Text style={styles.cell}>{item.paid ? 'Paid' : 'Not Paid'}</Text>
      <TouchableOpacity
        style={styles.viewProfileButton}
        onPress={() => handleViewProfile(item.id)}>
        <Text style={styles.buttonText}>View Profile</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.headerCell}>Name</Text>
        <Text style={styles.headerCell}>Email</Text>
        <Text style={styles.headerCell}>Attending</Text>
        <Text style={styles.headerCell}>Paid</Text>
      </View>

      {/* Roster data */}
      <FlatList
        data={roster}
        renderItem={renderItem}
        keyExtractor={item => item.id}
      />
    </View>
  );
};

export default Roster;
