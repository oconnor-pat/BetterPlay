import React, {useContext} from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Roster from '../Roster/Roster';
import Profile from '../Profile/Profile';
import CommunityNotes from '../Communitynotes/CommunityNotes';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faUsers,
  faUser,
  faStickyNote,
  faQuestion,
} from '@fortawesome/free-solid-svg-icons';
import {UserContextType} from '../UserContext';
import UserContext from '../UserContext';
import {IconDefinition} from '@fortawesome/fontawesome-svg-core';

// Tab Navigator
const Tab = createBottomTabNavigator();

// Icon Mapping
const iconMap: Record<string, IconDefinition> = {
  Roster: faUsers,
  Profile: faUser,
  CommunityNotes: faStickyNote,
};

// Tab Icon Component
const TabBarIcon = (props: {
  icon: IconDefinition;
  color: string;
  size: number;
}) => {
  const {icon, color, size} = props;
  return <FontAwesomeIcon icon={icon} size={size} color={color} />;
};

// Screen Options for Tab Navigator
const screenOptions = ({route}: {route: any}) => ({
  headerShown: false,
  tabBarLabel: () => null,
  tabBarStyle: {
    backgroundColor: '#02131D',
    borderTopColor: '#fff',
    paddingBottom: 10,
    paddingTop: 10,
  },
  tabBarIcon: (props: {color: string; size: number}) => {
    const icon = iconMap[route.name] || faQuestion;
    return <TabBarIcon icon={icon} color={props.color} size={props.size} />;
  },
});

// Bottom Tab Navigator Component
const BottomNavigator: React.FC = () => {
  // Destructure user data from UserContext
  const {userData} = useContext(UserContext) as UserContextType;

  if (!userData) {
    throw new Error('BottomNavigator must be used within a UserProvider');
  }

  const userId = userData?._id;

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Roster" component={Roster} />
      <Tab.Screen
        name="Profile"
        component={Profile}
        initialParams={{_id: userId}}
      />
      <Tab.Screen name="CommunityNotes" component={CommunityNotes} />
    </Tab.Navigator>
  );
};

export default BottomNavigator;
