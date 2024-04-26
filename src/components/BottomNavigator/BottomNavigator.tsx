import React from 'react';
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
import {useContext} from 'react';
import UserContext from '../UserContext';

const Tab = createBottomTabNavigator();

const iconMap: Record<string, any> = {
  Roster: faUsers,
  Profile: faUser,
  CommunityNotes: faStickyNote,
};

const TabBarIcon = (props: {icon: any; color: string; size: number}) => {
  const {icon, color, size} = props;
  return <FontAwesomeIcon icon={icon} size={size} color={color} />;
};

const TabBarIconComponent = ({
  route,
  color,
  size,
}: {
  route: any;
  color: string;
  size: number;
}) => {
  const icon = iconMap[route.name] || faQuestion;
  return <TabBarIcon icon={icon} color={color} size={size} />;
};

const screenOptions = ({route}: {route: any}) => ({
  headerShown: false,
  tabBarLabel: () => null,
  tabBarStyle: {
    backgroundColor: '#02131D',
    borderTopColor: '#fff',
    paddingBottom: 10,
    paddingTop: 10,
  },
  tabBarIcon: (props: {color: string; size: number}) => (
    <TabBarIconComponent route={route} {...props} />
  ),
});

const BottomNavigator: React.FC = () => {
  const userId = useContext(UserContext);

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
