import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Roster from '../Roster/Roster';
import Profile from '../Profile/Profile';
import CommunityNotes from '../Communitynotes/CommunityNotes';
import Icon from 'react-native-vector-icons/FontAwesome';

const Tab = createBottomTabNavigator();

const iconMap: Record<string, string> = {
  Roster: 'team',
  Profile: 'user',
  CommunityNotes: 'sticky-note',
};

const TabBarIcon = (props: {name: string; color: string; size: number}) => {
  const {name, color, size} = props;
  const iconName = iconMap[name] || 'user';
  return <Icon name={iconName} size={size} color={color} />;
};

const TabBarIconWrapper = ({
  route,
  ...props
}: {
  route: any;
  color: string;
  size: number;
}) => {
  return <TabBarIcon name={route.name} {...props} />;
};

const screenOptions = (route: any) => ({
  headerShown: false,
  tabBarStyle: {
    backgroundColor: '#02131D',
    borderTopColor: '#fff',
    paddingBottom: 10,
    paddingTop: 10,
  },
  tabBarIcon: (props: any) => <TabBarIconWrapper route={route} {...props} />,
});

const BottomNavBar: React.FC = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Roster" component={Roster} options={screenOptions} />
      <Tab.Screen name="Profile" component={Profile} options={screenOptions} />
      <Tab.Screen
        name="CommunityNotes"
        component={CommunityNotes}
        options={screenOptions}
      />
    </Tab.Navigator>
  );
};

export default BottomNavBar;
