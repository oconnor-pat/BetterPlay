import React, {useState, useMemo, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '../ThemeContext/ThemeContext';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faMoon,
  faSun,
  faLocationDot,
  faBell,
  faGlobe,
  faShield,
  faCircleInfo,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';

const Settings: React.FC = () => {
  const {darkMode, toggleDarkMode, colors} = useTheme();
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  // Load saved preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const savedLocationPref = await AsyncStorage.getItem('locationEnabled');
      const savedNotificationsPref = await AsyncStorage.getItem(
        'notificationsEnabled',
      );

      if (savedLocationPref !== null) {
        setLocationEnabled(JSON.parse(savedLocationPref));
      }
      if (savedNotificationsPref !== null) {
        setNotificationsEnabled(JSON.parse(savedNotificationsPref));
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationToggle = async () => {
    const newValue = !locationEnabled;
    setLocationEnabled(newValue);

    try {
      await AsyncStorage.setItem('locationEnabled', JSON.stringify(newValue));

      if (newValue) {
        // Request location permission
        Geolocation.requestAuthorization(
          () => {
            Alert.alert('Success', 'Location services enabled');
          },
          error => {
            console.error('Location permission denied:', error);
            Alert.alert(
              'Permission Denied',
              'Please enable location services in your device settings.',
            );
            setLocationEnabled(false);
            AsyncStorage.setItem('locationEnabled', JSON.stringify(false));
          },
        );
      } else {
        Alert.alert('Location services disabled');
      }
    } catch (error) {
      console.error('Error saving location preference:', error);
    }
  };

  const handleNotificationsToggle = async () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);

    try {
      await AsyncStorage.setItem(
        'notificationsEnabled',
        JSON.stringify(newValue),
      );
    } catch (error) {
      console.error('Error saving notification preference:', error);
    }
  };

  const handleThemeToggle = () => {
    toggleDarkMode();
  };

  // Themed styles
  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        scrollContent: {
          padding: 16,
        },
        header: {
          marginBottom: 24,
        },
        title: {
          fontSize: 28,
          fontWeight: 'bold',
          color: colors.text,
          marginBottom: 8,
        },
        subtitle: {
          fontSize: 14,
          color: colors.placeholder,
        },
        section: {
          marginBottom: 24,
        },
        sectionTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.placeholder,
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        settingCard: {
          backgroundColor: colors.card,
          borderRadius: 12,
          marginBottom: 12,
          overflow: 'hidden',
        },
        settingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        settingRowLast: {
          borderBottomWidth: 0,
        },
        iconContainer: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.primary + '20',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        settingContent: {
          flex: 1,
        },
        settingTitle: {
          fontSize: 16,
          fontWeight: '500',
          color: colors.text,
          marginBottom: 2,
        },
        settingDescription: {
          fontSize: 13,
          color: colors.placeholder,
        },
        settingAction: {
          marginLeft: 8,
        },
        chevronContainer: {
          padding: 4,
        },
        button: {
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        },
        buttonText: {
          fontSize: 16,
          fontWeight: '500',
          color: colors.primary,
          marginLeft: 8,
        },
        version: {
          textAlign: 'center',
          color: colors.placeholder,
          fontSize: 12,
          marginTop: 24,
          marginBottom: 8,
        },
      }),
    [colors],
  );

  if (loading) {
    return (
      <SafeAreaView style={themedStyles.container}>
        <View style={themedStyles.container}>
          <Text style={[themedStyles.title, {textAlign: 'center'}]}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={themedStyles.container}>
      <ScrollView style={themedStyles.container}>
        <View style={themedStyles.scrollContent}>
          {/* Header */}
          <View style={themedStyles.header}>
            <Text style={themedStyles.title}>Settings</Text>
            <Text style={themedStyles.subtitle}>
              Manage your app preferences
            </Text>
          </View>

          {/* Appearance Section */}
          <View style={themedStyles.section}>
            <Text style={themedStyles.sectionTitle}>Appearance</Text>
            <View style={themedStyles.settingCard}>
              <TouchableOpacity
                style={[themedStyles.settingRow, themedStyles.settingRowLast]}
                onPress={handleThemeToggle}
                activeOpacity={0.7}>
                <View style={themedStyles.iconContainer}>
                  <FontAwesomeIcon
                    icon={darkMode ? faMoon : faSun}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={themedStyles.settingContent}>
                  <Text style={themedStyles.settingTitle}>Dark Mode</Text>
                  <Text style={themedStyles.settingDescription}>
                    {darkMode ? 'Dark theme enabled' : 'Light theme enabled'}
                  </Text>
                </View>
                <View style={themedStyles.settingAction}>
                  <Switch
                    value={darkMode}
                    onValueChange={handleThemeToggle}
                    trackColor={{false: colors.border, true: colors.primary}}
                    thumbColor={colors.buttonText}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Privacy & Permissions Section */}
          <View style={themedStyles.section}>
            <Text style={themedStyles.sectionTitle}>Privacy & Permissions</Text>
            <View style={themedStyles.settingCard}>
              <TouchableOpacity
                style={themedStyles.settingRow}
                onPress={handleLocationToggle}
                activeOpacity={0.7}>
                <View style={themedStyles.iconContainer}>
                  <FontAwesomeIcon
                    icon={faLocationDot}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={themedStyles.settingContent}>
                  <Text style={themedStyles.settingTitle}>
                    Location Services
                  </Text>
                  <Text style={themedStyles.settingDescription}>
                    Allow app to access your location
                  </Text>
                </View>
                <View style={themedStyles.settingAction}>
                  <Switch
                    value={locationEnabled}
                    onValueChange={handleLocationToggle}
                    trackColor={{false: colors.border, true: colors.primary}}
                    thumbColor={colors.buttonText}
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[themedStyles.settingRow, themedStyles.settingRowLast]}
                onPress={handleNotificationsToggle}
                activeOpacity={0.7}>
                <View style={themedStyles.iconContainer}>
                  <FontAwesomeIcon
                    icon={faBell}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={themedStyles.settingContent}>
                  <Text style={themedStyles.settingTitle}>Notifications</Text>
                  <Text style={themedStyles.settingDescription}>
                    Receive push notifications
                  </Text>
                </View>
                <View style={themedStyles.settingAction}>
                  <Switch
                    value={notificationsEnabled}
                    onValueChange={handleNotificationsToggle}
                    trackColor={{false: colors.border, true: colors.primary}}
                    thumbColor={colors.buttonText}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* More Options Section */}
          <View style={themedStyles.section}>
            <Text style={themedStyles.sectionTitle}>More</Text>
            <View style={themedStyles.settingCard}>
              <TouchableOpacity
                style={themedStyles.settingRow}
                activeOpacity={0.7}
                onPress={() =>
                  Alert.alert('Language', 'Coming soon: Language selection')
                }>
                <View style={themedStyles.iconContainer}>
                  <FontAwesomeIcon
                    icon={faGlobe}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={themedStyles.settingContent}>
                  <Text style={themedStyles.settingTitle}>Language</Text>
                  <Text style={themedStyles.settingDescription}>English</Text>
                </View>
                <View style={themedStyles.chevronContainer}>
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    size={16}
                    color={colors.placeholder}
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={themedStyles.settingRow}
                activeOpacity={0.7}
                onPress={() =>
                  Alert.alert('Privacy Policy', 'Coming soon: Privacy policy')
                }>
                <View style={themedStyles.iconContainer}>
                  <FontAwesomeIcon
                    icon={faShield}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={themedStyles.settingContent}>
                  <Text style={themedStyles.settingTitle}>Privacy Policy</Text>
                  <Text style={themedStyles.settingDescription}>
                    View our privacy policy
                  </Text>
                </View>
                <View style={themedStyles.chevronContainer}>
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    size={16}
                    color={colors.placeholder}
                  />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[themedStyles.settingRow, themedStyles.settingRowLast]}
                activeOpacity={0.7}
                onPress={() =>
                  Alert.alert(
                    'About',
                    'BetterPlay\nVersion 0.0.1\n\nA community event management app.',
                  )
                }>
                <View style={themedStyles.iconContainer}>
                  <FontAwesomeIcon
                    icon={faCircleInfo}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={themedStyles.settingContent}>
                  <Text style={themedStyles.settingTitle}>About</Text>
                  <Text style={themedStyles.settingDescription}>
                    App information
                  </Text>
                </View>
                <View style={themedStyles.chevronContainer}>
                  <FontAwesomeIcon
                    icon={faChevronRight}
                    size={16}
                    color={colors.placeholder}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* App Version */}
          <Text style={themedStyles.version}>BetterPlay v0.0.1</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Settings;
