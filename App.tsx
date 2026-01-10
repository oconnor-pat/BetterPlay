import React, {useState, useEffect} from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  LinkingOptions,
} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import LandingPage from './src/components/Landingpage/LandingPage';
import BottomNavigator from './src/components/BottomNavigator/BottomNavigator';
import Settings from './src/components/Settings/Settings';
import ResetPassword from './src/components/ResetPassword/ResetPassword';
import {
  PrivacyPolicy,
  TermsOfService,
  YourData,
} from './src/components/LegalDocument';
import {StatusBar, ActivityIndicator, View, StyleSheet} from 'react-native';
import UserContext from './src/components/UserContext';
import {
  ThemeProvider,
  useTheme,
} from './src/components/ThemeContext/ThemeContext';
import {EventProvider} from './src/Context/EventContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from './src/config/api';

// Import i18n configuration
import './src/i18n';

// Types
type UserData = {
  _id: string;
  username: string;
  email: string;
};

type RootStackParamList = {
  LandingPage: undefined;
  BottomNavigator: undefined;
  Settings: undefined;
  ResetPassword: {token: string};
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  YourData: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

// Deep linking configuration
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['betterplay://'],
  config: {
    screens: {
      ResetPassword: {
        path: 'reset-password',
        parse: {
          token: (token: string) => token,
        },
      },
      LandingPage: 'login',
      BottomNavigator: 'home',
      Settings: 'settings',
    },
  },
};

const AppContent = () => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialRouteChecked, setInitialRouteChecked] = useState(false);
  const {darkMode, colors} = useTheme();

  // Check for existing session on app startup - FAST PATH
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Read all needed data in parallel for fastest possible startup
        const [token, cachedUserData] = await Promise.all([
          AsyncStorage.getItem('userToken'),
          AsyncStorage.getItem('cachedUserData'),
        ]);

        // FAST PATH: If we have cached data, show immediately
        if (token && cachedUserData) {
          try {
            const parsedUser = JSON.parse(cachedUserData);
            setUserData(parsedUser);
            setInitialRouteChecked(true);
            setIsLoading(false);

            // Validate token in background (completely non-blocking)
            setTimeout(() => validateTokenInBackground(token, parsedUser), 100);
            return;
          } catch {
            // Invalid cached data, fall through
          }
        }

        // NO CACHE PATH: If we have token but no cache, validate quickly
        if (token) {
          // Try quick validation with short timeout
          const validated = await validateAndSetUser(token);
          if (!validated) {
            // Token invalid or network failed
            setUserData(null);
          }
        }

        setInitialRouteChecked(true);
      } catch (error) {
        console.error('Error restoring session:', error);
        await AsyncStorage.multiRemove(['userToken', 'cachedUserData']);
        setInitialRouteChecked(true);
      } finally {
        setIsLoading(false);
      }
    };

    const validateTokenInBackground = async (
      token: string,
      cachedUser: UserData,
    ) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${API_BASE_URL}/auth/validate`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType?.includes('application/json')) {
          // Token invalid - log user out
          await AsyncStorage.multiRemove(['userToken', 'cachedUserData']);
          setUserData(null);
          return;
        }

        const data = await response.json();

        if (data.success && data.user) {
          // Update with fresh data if different
          if (JSON.stringify(data.user) !== JSON.stringify(cachedUser)) {
            setUserData(data.user);
            await AsyncStorage.setItem(
              'cachedUserData',
              JSON.stringify(data.user),
            );
          }
        } else {
          // Token invalid
          await AsyncStorage.multiRemove(['userToken', 'cachedUserData']);
          setUserData(null);
        }
      } catch (error) {
        // Network error - keep using cached data (offline support)
        console.log('Background validation failed, using cached data');
      }
    };

    const validateAndSetUser = async (token: string): Promise<boolean> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout for initial load

        const response = await fetch(`${API_BASE_URL}/auth/validate`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType?.includes('application/json')) {
          console.warn('Invalid response from server, clearing token');
          await AsyncStorage.multiRemove(['userToken', 'cachedUserData']);
          return false;
        }

        const data = await response.json();

        if (data.success && data.user) {
          setUserData(data.user);
          // Cache user data for next launch
          AsyncStorage.setItem('cachedUserData', JSON.stringify(data.user));
          return true;
        } else {
          await AsyncStorage.multiRemove(['userToken', 'cachedUserData']);
          return false;
        }
      } catch (error) {
        console.error('Token validation failed:', error);
        // On network failure, don't clear token - let them try again
        return false;
      }
    };

    restoreSession();
  }, []);

  const loadingBackgroundStyle = darkMode
    ? styles.darkBackground
    : styles.lightBackground;

  // Show loading screen while checking session
  if (isLoading) {
    return (
      <View style={[styles.centeredView, loadingBackgroundStyle]}>
        <ActivityIndicator size="large" color={colors?.primary || '#007AFF'} />
      </View>
    );
  }

  const backgroundStyle = darkMode
    ? styles.darkBackground
    : styles.lightBackground;

  return (
    <>
      <StatusBar
        backgroundColor={darkMode ? '#000' : '#02131D'}
        barStyle={darkMode ? 'light-content' : 'dark-content'}
      />
      <UserContext.Provider value={{userData, setUserData}}>
        <EventProvider>
          <NavigationContainer
            theme={darkMode ? DarkTheme : DefaultTheme}
            linking={linking}
            fallback={
              <View style={[styles.centeredView, backgroundStyle]}>
                <ActivityIndicator
                  size="large"
                  color={colors?.primary || '#007AFF'}
                />
              </View>
            }>
            <Stack.Navigator
              initialRouteName={userData ? 'BottomNavigator' : 'LandingPage'}
              screenOptions={{
                headerStyle: {
                  backgroundColor: darkMode ? '#000' : '#02131D',
                },
                headerTintColor: '#fff',
                headerTitleAlign: 'center',
                headerBackTitleVisible: false,
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              }}>
              <Stack.Screen
                name="LandingPage"
                component={LandingPage}
                options={{headerShown: false}}
              />
              <Stack.Screen
                name="BottomNavigator"
                component={BottomNavigator}
                options={{headerShown: false, gestureEnabled: false}}
              />
              <Stack.Screen
                name="Settings"
                component={Settings}
                options={{
                  headerShown: true,
                  title: 'Settings',
                }}
              />
              <Stack.Screen
                name="ResetPassword"
                component={ResetPassword}
                options={{
                  headerShown: true,
                  title: 'Reset Password',
                }}
              />
              <Stack.Screen
                name="PrivacyPolicy"
                component={PrivacyPolicy}
                options={{headerShown: false}}
              />
              <Stack.Screen
                name="TermsOfService"
                component={TermsOfService}
                options={{headerShown: false}}
              />
              <Stack.Screen
                name="YourData"
                component={YourData}
                options={{headerShown: false}}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </EventProvider>
      </UserContext.Provider>
    </>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkBackground: {
    backgroundColor: '#000',
  },
  lightBackground: {
    backgroundColor: '#02131D',
  },
});

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
