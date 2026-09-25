import React, {useContext, useEffect, useState} from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createStackNavigator} from '@react-navigation/stack';
import EventList from '../EventList/EventList';
import EventRoster from '../EventRoster/EventRoster';
import EventWrapUp from '../EventWrapUp/EventWrapUp';
import Profile from '../Profile/Profile';
import PublicProfile from '../Profile/PublicProfile';
import {VenueList, VenuePlaceDetail, VenueWebView} from '../Venues';
import {UserSearch} from '../UserSearch';
import {FriendsList, FriendRequests} from '../Friends';
import {Notifications} from '../Notifications';
import GroupDetail from '../Groups/GroupDetail';
import GroupsList from '../Groups/GroupsList';
import {MessagesList, DmThread} from '../Messages';
import OnboardingModal from '../Onboarding/OnboardingModal';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faCalendarAlt,
  faComment,
  faUser,
  faUserGroup,
  faQuestion,
  faBuilding,
} from '@fortawesome/free-solid-svg-icons';
import {UserContextType} from '../UserContext';
import UserContext from '../UserContext';
import {IconDefinition} from '@fortawesome/fontawesome-svg-core';
import {useTheme} from '../ThemeContext/ThemeContext';
import {useDmBadge} from '../../hooks/useDmBadge';
import {useGroupBadge} from '../../hooks/useGroupBadge';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TabBarIconPill = ({
  icon,
  color,
  focused,
  pillColor,
}: {
  icon: IconDefinition;
  color: string;
  focused: boolean;
  pillColor: string;
}) => {
  return (
    <View style={[styles.iconPill, focused && {backgroundColor: pillColor}]}>
      <FontAwesomeIcon icon={icon} size={18} color={color} />
    </View>
  );
};

function createTabBarIcon(
  colors: {primary: string; secondaryText: string},
  isVenueHost: boolean,
) {
  return function tabBarIcon({
    route,
    focused,
  }: {
    route: {name: string};
    focused: boolean;
  }) {
    const iconMap: Record<string, IconDefinition> = {
      Events: faCalendarAlt,
      Groups: faUserGroup,
      Messages: faComment,
      Profile: isVenueHost ? faBuilding : faUser,
    };
    const icon = iconMap[route.name] || faQuestion;
    const iconColor = focused ? colors.primary : colors.secondaryText;
    return (
      <TabBarIconPill
        icon={icon}
        color={iconColor}
        focused={focused}
        pillColor={colors.primary + '14'}
      />
    );
  };
}

const styles = StyleSheet.create({
  iconPill: {
    width: 56,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Stack Navigator for Local Events screens
const LocalEventsStack = () => {
  const {colors} = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.card},
        headerTintColor: colors.text,
      }}>
      <Stack.Screen
        name="EventList"
        component={EventList}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="EventRoster"
        component={EventRoster}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="EventWrapUp"
        component={EventWrapUp}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="PublicProfile"
        component={PublicProfile}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="UserSearch"
        component={UserSearch}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={Notifications}
        options={{
          headerShown: false,
        }}
      />
      {/* Venue discovery now lives inside the Events flow (Vision A): the
          venue browser is reached via the "Find a place" entry on the Events
          screen, and "Plan event" from a venue navigates back to EventList
          with the venue prefilled — all within this same stack. */}
      <Stack.Screen
        name="VenueList"
        component={VenueList}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="VenuePlaceDetail"
        component={VenuePlaceDetail}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="VenueWebView"
        component={VenueWebView}
        options={{headerShown: false}}
      />
    </Stack.Navigator>
  );
};

// Stack Navigator for Groups screens. GroupDetail is also registered in
// ProfileStack (the Profile "My Groups" section still links into it), so
// it lives in both stacks — each tab navigates within its own stack.
// EventWrapUp + PublicProfile live here too so chat → concluded-event
// wrap-up stays in the Groups tab (back returns to the thread).
const GroupsStack = () => {
  const {colors} = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.card},
        headerTintColor: colors.text,
      }}>
      <Stack.Screen
        name="GroupsList"
        component={GroupsList}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="GroupDetail"
        component={GroupDetail}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="EventWrapUp"
        component={EventWrapUp}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="PublicProfile"
        component={PublicProfile}
        options={{headerShown: false}}
      />
    </Stack.Navigator>
  );
};

// Stack Navigator for direct messages. UserSearch and PublicProfile are
// registered here as well as in the Events/Profile stacks so the "start a
// new conversation" path (search → profile → Message) stays inside this
// tab instead of throwing the user into another one mid-flow.
const MessagesStack = () => {
  const {colors} = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.card},
        headerTintColor: colors.text,
      }}>
      <Stack.Screen
        name="MessagesList"
        component={MessagesList}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="DmThread"
        component={DmThread}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="UserSearch"
        component={UserSearch}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="PublicProfile"
        component={PublicProfile}
        options={{headerShown: false}}
      />
    </Stack.Navigator>
  );
};

// Stack Navigator for Profile screens
const ProfileStack = ({userId}: {userId: string}) => {
  const {colors} = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: colors.card},
        headerTintColor: colors.text,
      }}>
      <Stack.Screen
        name="ProfileMain"
        component={Profile}
        options={{headerShown: false}}
        initialParams={{_id: userId}}
      />
      <Stack.Screen
        name="UserSearch"
        component={UserSearch}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="PublicProfile"
        component={PublicProfile}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="FriendsList"
        component={FriendsList}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="FriendRequests"
        component={FriendRequests}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="Notifications"
        component={Notifications}
        options={{headerShown: false}}
      />
      <Stack.Screen
        name="GroupDetail"
        component={GroupDetail}
        options={{headerShown: false}}
      />
    </Stack.Navigator>
  );
};

const BottomNavigator: React.FC = () => {
  const {userData} = useContext(UserContext) as UserContextType;
  const {colors} = useTheme();
  const {t} = useTranslation();
  const insets = useSafeAreaInsets();
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Counts threads waiting on the user (unread conversations + pending
  // message requests), so the tab can say how many people need a reply.
  const dmBadge = useDmBadge(!!userData);
  // Same idea for Groups: how many group chats have unread messages.
  const groupBadge = useGroupBadge(!!userData);

  // First-run coach marks live here (not on EventList) because new accounts
  // land on Profile after signup — they would never see an Events-only modal.
  useEffect(() => {
    if (!userData) {
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem('hasSeenOnboarding').then(seen => {
      if (cancelled) {
        return;
      }
      setShowOnboarding(!seen);
    });
    return () => {
      cancelled = true;
    };
  }, [userData?._id]);

  const dismissOnboarding = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

  if (!userData) {
    // Prevent crash during sign out navigation transition
    return null;
  }

  const userId = userData?._id;
  const isVenueHost =
    userData?.accountType === 'venue' && !!userData?.managedVenue?.placeId;

  const themedTabBarIcon = ({
    route,
    focused,
  }: {
    route: {name: string};
    focused: boolean;
  }) => createTabBarIcon(colors, isVenueHost)({route, focused});

  const tabLabels: Record<string, string> = {
    Events: isVenueHost
      ? t('venues.nightsTab') || 'Nights'
      : t('navigation.events') || 'Events',
    Groups: t('navigation.groups') || 'Groups',
    Messages: t('navigation.messages') || 'Messages',
    Profile: isVenueHost
      ? t('venues.hostProfileTitle') || 'Venue'
      : t('navigation.profile') || 'Profile',
  };

  const bottomInset = Platform.OS === 'ios' ? insets.bottom : 0;

  const screenOptions = ({route}: {route: any}) => ({
    headerShown: false,
    tabBarLabel: tabLabels[route.name] || route.name,
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '700' as const,
      letterSpacing: 0.3,
      marginTop: 2,
    },
    tabBarStyle: {
      backgroundColor: colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 8,
      paddingBottom: bottomInset > 0 ? bottomInset : 10,
      height: 64 + bottomInset,
      elevation: 0,
      shadowOpacity: 0,
    },
    tabBarItemStyle: {
      paddingVertical: 0,
    },
    tabBarIcon: (props: {color: string; size: number; focused: boolean}) =>
      themedTabBarIcon({route, focused: props.focused}),
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.secondaryText,
    tabBarBadge:
      route.name === 'Messages' && dmBadge > 0
        ? dmBadge > 99
          ? '99+'
          : dmBadge
        : route.name === 'Groups' && groupBadge > 0
          ? groupBadge > 99
            ? '99+'
            : groupBadge
          : undefined,
    tabBarBadgeStyle: {
      backgroundColor: '#FF3B30',
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700' as const,
      minWidth: 18,
      height: 18,
      lineHeight: 16,
      borderRadius: 9,
    },
  });

  return (
    <>
      <OnboardingModal
        visible={showOnboarding}
        onDone={dismissOnboarding}
      />
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen name="Events" component={LocalEventsStack} />
        <Tab.Screen
          name="Groups"
          component={GroupsStack}
          options={
            isVenueHost
              ? {
                  tabBarButton: () => null,
                  tabBarItemStyle: {display: 'none'},
                }
              : undefined
          }
        />
        <Tab.Screen name="Messages" component={MessagesStack} />
        <Tab.Screen name="Profile">
          {() => <ProfileStack userId={userId} />}
        </Tab.Screen>
      </Tab.Navigator>
    </>
  );
};

export default BottomNavigator;
