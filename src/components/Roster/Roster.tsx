import React, {useState, useEffect} from 'react';
import {View, Text, FlatList, StyleSheet, TouchableOpacity} from 'react-native';
import {useNavigation, NavigationProp} from '@react-navigation/native';

// Interfaces
interface RosterItem {
  id: string;
  name: string;
  attending: boolean;
  paid: boolean;
}

type RootStackParamList = {
  Profile: {userId: string};
  Roster: undefined;
};

// Mock data for testing
const rosterData: RosterItem[] = [
  {
    id: '1',
    name: 'John Doe',
    attending: true,
    paid: false,
  },
  {
    id: '2',
    name: 'Jane Doe',
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

  attendingText: {
    color: 'green',
  },

  notAttendingText: {
    color: 'red',
  },

  paidText: {
    color: 'green',
  },

  notPaidText: {
    color: 'red',
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
    // TODO: eventually set up to use real roster data from backend
    setRoster(rosterData);
  }, []);

  const renderItem = ({item}: {item: RosterItem}) => (
    <TouchableOpacity onPress={() => handleViewProfile(item.id)}>
      <View style={styles.row}>
        <Text style={styles.cell}>{item.name}</Text>
        {item.attending ? (
          <Text style={[styles.cell, styles.paidText]}>Attending</Text>
        ) : (
          <Text style={[styles.cell, styles.notPaidText]}>Not Attending</Text>
        )}
        {item.paid ? (
          <Text style={[styles.cell, styles.paidText]}>Paid</Text>
        ) : (
          <Text style={[styles.cell, styles.notPaidText]}>Not Paid</Text>
        )}
        <Text style={styles.cell}>MM/DD/YYYY</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.headerCell}>Name</Text>
        <Text style={styles.headerCell}>Attending</Text>
        <Text style={styles.headerCell}>Paid</Text>
        <Text style={styles.headerCell}>Next Session</Text>
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
