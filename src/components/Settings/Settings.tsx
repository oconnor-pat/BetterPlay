import React, {useState, useMemo, useEffect, useContext} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, CommonActions} from '@react-navigation/native';
import {useTheme} from '../ThemeContext/ThemeContext';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faMoon,
  faSun,
  faLocationDot,
  faBell,
  faGlobe,
  faCircleInfo,
  faChevronRight,
  faCircleHalfStroke,
  faCheck,
  faXmark,
  faTrash,
  faExclamationTriangle,
  faEye,
  faUserGroup,
  faLock,
  faMapLocationDot,
} from '@fortawesome/free-solid-svg-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import {useTranslation} from 'react-i18next';
import axios from 'axios';
import {API_BASE_URL} from '../../config/api';
import locationService from '../../services/LocationService';
import {
  getDefaultMapApp,
  setDefaultMapApp,
  MapAppName,
} from '../../services/MapLauncher';
import UserContext, {UserContextType} from '../UserContext';
import {version as appVersion} from '../../../package.json';
import NotificationSettings from './NotificationSettings';

interface Language {
  code: string;
  name: string;
  nativeName: string;
}

const LANGUAGES: Language[] = [
  {code: 'en', name: 'English', nativeName: 'English'},
  {code: 'es', name: 'Spanish', nativeName: 'Español'},
  {code: 'fr', name: 'French', nativeName: 'Français'},
  {code: 'de', name: 'German', nativeName: 'Deutsch'},
  {code: 'it', name: 'Italian', nativeName: 'Italiano'},
  {code: 'pt', name: 'Portuguese', nativeName: 'Português'},
  {code: 'zh', name: 'Chinese', nativeName: '中文'},
  {code: 'ja', name: 'Japanese', nativeName: '日本語'},
  {code: 'ko', name: 'Korean', nativeName: '한국어'},
  {code: 'ar', name: 'Arabic', nativeName: 'العربية'},
  {code: 'hi', name: 'Hindi', nativeName: 'हिन्दी'},
  {code: 'ru', name: 'Russian', nativeName: 'Русский'},
];

const LANGUAGE_STORAGE_KEY = '@app_language';

type ProximityVisibility = 'public' | 'friends' | 'private';

const VISIBILITY_OPTIONS: {
  value: ProximityVisibility;
  icon: typeof faEye;
  labelKey: string;
  descKey: string;
}[] = [
  {
    value: 'public',
    icon: faEye,
    labelKey: 'settings.visibilityPublic',
    descKey: 'settings.visibilityPublicDesc',
  },
  {
    value: 'friends',
    icon: faUserGroup,
    labelKey: 'settings.visibilityFriends',
    descKey: 'settings.visibilityFriendsDesc',
  },
  {
    value: 'private',
    icon: faLock,
    labelKey: 'settings.visibilityPrivate',
    descKey: 'settings.visibilityPrivateDesc',
  },
];

const Settings: React.FC = () => {
  const {t, i18n} = useTranslation();
  const {darkMode, themeMode, setThemeMode, colors} = useTheme();
  const {setUserData} = useContext(UserContext) as UserContextType;
  const navigation = useNavigation();
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [proximityVisibility, setProximityVisibility] =
    useState<ProximityVisibility>('private');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(
    LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0],
  );
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] =
    useState(false);
  const [
    notificationSettingsModalVisible,
    setNotificationSettingsModalVisible,
  ] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [defaultMapApp, setDefaultMapAppState] = useState<MapAppName | null>(
    null,
  );
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);

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
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);

      const savedVisibility = await AsyncStorage.getItem('proximityVisibility');

      if (savedLocationPref !== null) {
        setLocationEnabled(JSON.parse(savedLocationPref));
      }
      if (savedVisibility !== null) {
        setProximityVisibility(savedVisibility as ProximityVisibility);
      }
      if (savedNotificationsPref !== null) {
        setNotificationsEnabled(JSON.parse(savedNotificationsPref));
      }
      if (savedLanguage !== null) {
        const language = LANGUAGES.find(l => l.code === savedLanguage);
        if (language) {
          setSelectedLanguage(language);
        }
      }
      const savedMapApp = await getDefaultMapApp();
      setDefaultMapAppState(savedMapApp);
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
        const granted = await locationService.requestPermission();
        if (granted) {
          Alert.alert(t('common.success'), t('settings.locationEnabled'));
          // Send location to backend in the background
          locationService.getCurrentPosition().then(async coords => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              if (token && coords) {
                await axios.put(
                  `${API_BASE_URL}/users/me/location`,
                  {latitude: coords.latitude, longitude: coords.longitude},
                  {headers: {Authorization: `Bearer ${token}`}},
                );
              }
            } catch (err) {
              console.log('Failed to sync location to backend:', err);
            }
          });
        } else {
          Alert.alert(
            t('settings.permissionDenied'),
            t('settings.enableLocationSettings'),
          );
          setLocationEnabled(false);
          await AsyncStorage.setItem('locationEnabled', JSON.stringify(false));
        }
      } else {
        Alert.alert(t('settings.locationDisabled'));
        // Clear cached location and tell backend to remove it
        locationService.clearLocation();
        try {
          const token = await AsyncStorage.getItem('userToken');
          if (token) {
            await axios.put(
              `${API_BASE_URL}/users/me/location`,
              {latitude: null, longitude: null},
              {headers: {Authorization: `Bearer ${token}`}},
            );
          }
        } catch (err) {
          console.log('Failed to clear location on backend:', err);
        }
      }
    } catch (error) {
      console.error('Error saving location preference:', error);
    }
  };

  const handleVisibilityChange = async (value: ProximityVisibility) => {
    setProximityVisibility(value);
    try {
      await AsyncStorage.setItem('proximityVisibility', value);
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        await axios.put(
          `${API_BASE_URL}/users/me/proximity-visibility`,
          {proximityVisibility: value},
          {headers: {Authorization: `Bearer ${token}`}},
        );
      }
    } catch (error) {
      console.log('Failed to save proximity visibility:', error);
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

  const handleLanguageSelect = async (language: Language) => {
    setSelectedLanguage(language);
    setLanguageModalVisible(false);
    try {
      await i18n.changeLanguage(language.code);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language.code);
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
  };

  const MAP_OPTIONS: {label: string; value: MapAppName | null}[] = [
    {label: t('settings.alwaysAsk'), value: null},
    ...(Platform.OS === 'ios'
      ? [{label: 'Apple Maps', value: 'Apple Maps' as MapAppName}]
      : []),
    {label: 'Google Maps', value: 'Google Maps' as MapAppName},
    {label: 'Waze', value: 'Waze' as MapAppName},
  ];

  const handleMapAppSelect = async (value: MapAppName | null) => {
    setDefaultMapAppState(value);
    setMapModalVisible(false);
    await setDefaultMapApp(value);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      Alert.alert(
        t('settings.deleteAccount'),
        t('settings.deleteConfirmError'),
      );
      return;
    }

    setIsDeleting(true);
    try {
      const token = await AsyncStorage.getItem('userToken');

      if (!token) {
        Alert.alert(t('common.error'), t('settings.sessionExpired'));
        setIsDeleting(false);
        return;
      }

      await axios.delete(`${API_BASE_URL}/auth/delete-account`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Close modal first and reset state
      setDeleteAccountModalVisible(false);
      setDeleteConfirmText('');
      setIsDeleting(false);

      // Clear all local data
      await AsyncStorage.clear();
      setUserData(null);

      // Show success message and navigate to landing page
      Alert.alert(
        t('settings.accountDeleted'),
        t('settings.accountDeletedMessage'),
        [
          {
            text: t('common.ok'),
            onPress: () => {
              // Reset navigation stack to landing page
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{name: 'LandingPage'}],
                }),
              );
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert(t('common.error'), t('settings.deleteAccountError'));
      setIsDeleting(false);
      setDeleteConfirmText('');
    }
  };

  // Themed styles (Bluesky-flat treatment)
  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        scrollContent: {
          paddingBottom: 24,
        },
        // ── Inline header ──
        header: {
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        title: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 2,
        },
        loadingTitle: {
          textAlign: 'center',
        },
        subtitle: {
          fontSize: 13,
          color: colors.secondaryText,
        },
        // ── Flat section ──
        section: {
          paddingTop: 16,
          paddingBottom: 4,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        sectionTitle: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          paddingHorizontal: 16,
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        // Card → flat group of rows (no rounded card / no background)
        settingCard: {
          backgroundColor: 'transparent',
        },
        settingRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        settingRowLast: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        iconContainer: {
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: colors.primary + '15',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        settingContent: {
          flex: 1,
        },
        settingTitle: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 2,
        },
        settingDescription: {
          fontSize: 12,
          color: colors.secondaryText,
        },
        settingAction: {
          marginLeft: 8,
        },
        // Visibility / segmented chips (outlined-then-tinted-primary pattern)
        visibilityOptions: {
          flexDirection: 'row',
          gap: 8,
          marginTop: 10,
        },
        visibilityOption: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 18,
          backgroundColor: 'transparent',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        visibilityOptionActive: {
          backgroundColor: colors.primary + '14',
          borderColor: colors.primary,
        },
        visibilityOptionText: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        visibilityOptionTextActive: {
          color: colors.primary,
        },
        chevronContainer: {
          padding: 4,
        },
        version: {
          textAlign: 'center',
          color: colors.secondaryText,
          fontSize: 12,
          marginTop: 24,
          marginBottom: 12,
        },
        // ── Theme picker (segmented pills) ──
        themePicker: {
          flexDirection: 'row',
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 12,
          gap: 8,
        },
        themeOption: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 20,
          backgroundColor: 'transparent',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          gap: 6,
        },
        themeOptionActive: {
          backgroundColor: colors.primary + '14',
          borderColor: colors.primary,
        },
        themeOptionText: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        themeOptionTextActive: {
          color: colors.primary,
        },
        // ── Bottom-sheet modal shell ──
        keyboardAvoidingView: {
          flex: 1,
        },
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        },
        modalContent: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingTop: 8,
          paddingBottom: 24,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        modalHandle: {
          alignSelf: 'center',
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          marginBottom: 8,
        },
        modalHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        modalTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
        },
        modalCloseButton: {
          padding: 4,
        },
        // ── List options inside modals (language / map app) ──
        languageList: {
          paddingHorizontal: 0,
        },
        languageOption: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          backgroundColor: 'transparent',
        },
        languageOptionSelected: {
          backgroundColor: colors.primary + '0D',
        },
        languageInfo: {
          flex: 1,
        },
        languageName: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.text,
        },
        languageNameSelected: {
          color: colors.primary,
          fontWeight: '700',
        },
        languageNativeName: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 2,
        },
        languageCheck: {
          marginLeft: 12,
        },
        // ── Danger zone ──
        dangerSection: {
          paddingTop: 16,
          paddingBottom: 4,
          borderBottomWidth: 0,
        },
        dangerSectionTitle: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.error,
          paddingHorizontal: 16,
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        deleteButton: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          marginHorizontal: 16,
          backgroundColor: 'transparent',
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.error,
        },
        deleteIconContainer: {
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: colors.error + '15',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        deleteButtonText: {
          flex: 1,
        },
        deleteButtonTitle: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.error,
          marginBottom: 2,
        },
        deleteButtonDescription: {
          fontSize: 12,
          color: colors.secondaryText,
        },
        // ── Delete confirmation modal ──
        deleteModalContent: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingTop: 8,
          paddingBottom: 24,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        deleteModalHeader: {
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        deleteModalIconContainer: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.error + '15',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.error + '40',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        },
        deleteModalIcon: {
          marginBottom: 0,
        },
        deleteModalTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.error,
          textAlign: 'center',
        },
        deleteModalBody: {
          paddingHorizontal: 16,
          paddingTop: 16,
        },
        deleteWarningText: {
          fontSize: 14,
          color: colors.text,
          lineHeight: 20,
          marginBottom: 14,
          textAlign: 'center',
        },
        deleteWarningList: {
          backgroundColor: colors.error + '0D',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.error + '40',
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          marginBottom: 18,
        },
        deleteWarningItem: {
          fontSize: 13,
          color: colors.text,
          marginBottom: 6,
          paddingLeft: 4,
        },
        deleteWarningItemLast: {
          fontSize: 13,
          color: colors.text,
          marginBottom: 0,
          paddingLeft: 4,
        },
        deleteConfirmLabel: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 8,
        },
        deleteConfirmInput: {
          backgroundColor: colors.inputBackground,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15,
          color: colors.text,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          marginBottom: 18,
        },
        deleteModalButtons: {
          flexDirection: 'row',
          gap: 10,
        },
        cancelButton: {
          flex: 1,
          backgroundColor: 'transparent',
          borderRadius: 24,
          paddingVertical: 12,
          alignItems: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        cancelButtonText: {
          fontSize: 14,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        confirmDeleteButton: {
          flex: 1,
          backgroundColor: colors.error,
          borderRadius: 24,
          paddingVertical: 12,
          alignItems: 'center',
        },
        confirmDeleteButtonDisabled: {
          backgroundColor: colors.error + '55',
        },
        confirmDeleteButtonText: {
          fontSize: 14,
          fontWeight: '700',
          color: '#FFFFFF',
        },
        // ── About modal ──
        aboutBody: {
          paddingHorizontal: 16,
          paddingTop: 16,
        },
        aboutAppName: {
          fontSize: 18,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
          marginBottom: 4,
        },
        aboutVersion: {
          fontSize: 13,
          color: colors.secondaryText,
          textAlign: 'center',
          marginBottom: 14,
        },
        aboutCopyright: {
          fontSize: 12,
          color: colors.secondaryText,
          textAlign: 'center',
          lineHeight: 18,
          marginBottom: 18,
        },
        aboutLinkRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          marginHorizontal: -16,
        },
        aboutLinkLabel: {
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: colors.text,
        },
        aboutCloseButton: {
          marginTop: 16,
          marginHorizontal: 0,
          backgroundColor: 'transparent',
          borderRadius: 24,
          paddingVertical: 12,
          alignItems: 'center',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        aboutCloseButtonText: {
          fontSize: 14,
          fontWeight: '700',
          color: colors.secondaryText,
        },
      }),
    [colors],
  );

  if (loading) {
    return (
      <SafeAreaView style={themedStyles.container}>
        <View style={themedStyles.container}>
          <Text style={[themedStyles.title, themedStyles.loadingTitle]}>
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={themedStyles.container}>
      <ScrollView
        style={themedStyles.container}
        contentContainerStyle={themedStyles.scrollContent}>
        {/* Inline header */}
        <View style={themedStyles.header}>
          <Text style={themedStyles.title}>{t('settings.title')}</Text>
          <Text style={themedStyles.subtitle}>{t('settings.subtitle')}</Text>
        </View>

        {/* Appearance Section */}
        <View style={themedStyles.section}>
          <Text style={themedStyles.sectionTitle}>
            {t('settings.appearance')}
          </Text>
          <View style={themedStyles.settingCard}>
            <View style={themedStyles.settingRow}>
              <View style={themedStyles.iconContainer}>
                <FontAwesomeIcon
                  icon={
                    themeMode === 'system'
                      ? faCircleHalfStroke
                      : darkMode
                      ? faMoon
                      : faSun
                  }
                  size={14}
                  color={colors.primary}
                />
              </View>
              <View style={themedStyles.settingContent}>
                <Text style={themedStyles.settingTitle}>
                  {t('settings.theme')}
                </Text>
                <Text style={themedStyles.settingDescription}>
                  {themeMode === 'system'
                    ? `${t('settings.system')} (${
                        darkMode ? t('settings.dark') : t('settings.light')
                      })`
                    : themeMode === 'dark'
                    ? t('settings.dark')
                    : t('settings.light')}
                </Text>
              </View>
            </View>
            {/* Theme Picker */}
            <View style={themedStyles.themePicker}>
              <TouchableOpacity
                style={[
                  themedStyles.themeOption,
                  themeMode === 'system' && themedStyles.themeOptionActive,
                ]}
                onPress={() => setThemeMode('system')}
                activeOpacity={0.7}>
                <FontAwesomeIcon
                  icon={faCircleHalfStroke}
                  size={12}
                  color={
                    themeMode === 'system'
                      ? colors.primary
                      : colors.secondaryText
                  }
                />
                <Text
                  style={[
                    themedStyles.themeOptionText,
                    themeMode === 'system' &&
                      themedStyles.themeOptionTextActive,
                  ]}>
                  {t('settings.system')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  themedStyles.themeOption,
                  themeMode === 'light' && themedStyles.themeOptionActive,
                ]}
                onPress={() => setThemeMode('light')}
                activeOpacity={0.7}>
                <FontAwesomeIcon
                  icon={faSun}
                  size={12}
                  color={
                    themeMode === 'light'
                      ? colors.primary
                      : colors.secondaryText
                  }
                />
                <Text
                  style={[
                    themedStyles.themeOptionText,
                    themeMode === 'light' &&
                      themedStyles.themeOptionTextActive,
                  ]}>
                  {t('settings.light')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  themedStyles.themeOption,
                  themeMode === 'dark' && themedStyles.themeOptionActive,
                ]}
                onPress={() => setThemeMode('dark')}
                activeOpacity={0.7}>
                <FontAwesomeIcon
                  icon={faMoon}
                  size={12}
                  color={
                    themeMode === 'dark'
                      ? colors.primary
                      : colors.secondaryText
                  }
                />
                <Text
                  style={[
                    themedStyles.themeOptionText,
                    themeMode === 'dark' && themedStyles.themeOptionTextActive,
                  ]}>
                  {t('settings.dark')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Privacy & Permissions Section */}
        <View style={themedStyles.section}>
          <Text style={themedStyles.sectionTitle}>
            {t('settings.privacyPermissions')}
          </Text>
          <View style={themedStyles.settingCard}>
            <TouchableOpacity
              style={themedStyles.settingRow}
              onPress={handleLocationToggle}
              activeOpacity={0.7}>
              <View style={themedStyles.iconContainer}>
                <FontAwesomeIcon
                  icon={faLocationDot}
                  size={14}
                  color={colors.primary}
                />
              </View>
              <View style={themedStyles.settingContent}>
                <Text style={themedStyles.settingTitle}>
                  {t('settings.locationServices')}
                </Text>
                <Text style={themedStyles.settingDescription}>
                  {t('settings.locationDescription')}
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

            {locationEnabled && (
              <View style={themedStyles.settingRow}>
                <View style={themedStyles.iconContainer}>
                  <FontAwesomeIcon
                    icon={
                      proximityVisibility === 'public'
                        ? faEye
                        : proximityVisibility === 'friends'
                        ? faUserGroup
                        : faLock
                    }
                    size={14}
                    color={colors.primary}
                  />
                </View>
                <View style={themedStyles.settingContent}>
                  <Text style={themedStyles.settingTitle}>
                    {t('settings.proximityVisibility')}
                  </Text>
                  <Text style={themedStyles.settingDescription}>
                    {t('settings.proximityVisibilityDesc')}
                  </Text>
                  <View style={themedStyles.visibilityOptions}>
                    {VISIBILITY_OPTIONS.map(option => {
                      const isActive = proximityVisibility === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            themedStyles.visibilityOption,
                            isActive && themedStyles.visibilityOptionActive,
                          ]}
                          onPress={() => handleVisibilityChange(option.value)}
                          activeOpacity={0.7}>
                          <FontAwesomeIcon
                            icon={option.icon}
                            size={11}
                            color={
                              isActive ? colors.primary : colors.secondaryText
                            }
                          />
                          <Text
                            style={[
                              themedStyles.visibilityOptionText,
                              isActive &&
                                themedStyles.visibilityOptionTextActive,
                            ]}>
                            {t(option.labelKey)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={themedStyles.settingRow}
              onPress={() => setNotificationSettingsModalVisible(true)}
              activeOpacity={0.7}>
              <View style={themedStyles.iconContainer}>
                <FontAwesomeIcon
                  icon={faBell}
                  size={14}
                  color={colors.primary}
                />
              </View>
              <View style={themedStyles.settingContent}>
                <Text style={themedStyles.settingTitle}>
                  {t('settings.notifications')}
                </Text>
                <Text style={themedStyles.settingDescription}>
                  {t('settings.notificationsDescription')}
                </Text>
              </View>
              <View style={themedStyles.settingAction}>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  size={13}
                  color={colors.secondaryText}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* More Options Section */}
        <View style={themedStyles.section}>
          <Text style={themedStyles.sectionTitle}>{t('settings.more')}</Text>
          <View style={themedStyles.settingCard}>
            <TouchableOpacity
              style={themedStyles.settingRow}
              activeOpacity={0.7}
              onPress={() => setLanguageModalVisible(true)}>
              <View style={themedStyles.iconContainer}>
                <FontAwesomeIcon
                  icon={faGlobe}
                  size={14}
                  color={colors.primary}
                />
              </View>
              <View style={themedStyles.settingContent}>
                <Text style={themedStyles.settingTitle}>
                  {t('settings.language')}
                </Text>
                <Text style={themedStyles.settingDescription}>
                  {selectedLanguage.name} ({selectedLanguage.nativeName})
                </Text>
              </View>
              <View style={themedStyles.chevronContainer}>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  size={13}
                  color={colors.secondaryText}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={themedStyles.settingRow}
              activeOpacity={0.7}
              onPress={() => setMapModalVisible(true)}>
              <View style={themedStyles.iconContainer}>
                <FontAwesomeIcon
                  icon={faMapLocationDot}
                  size={14}
                  color={colors.primary}
                />
              </View>
              <View style={themedStyles.settingContent}>
                <Text style={themedStyles.settingTitle}>
                  {t('settings.defaultMapApp')}
                </Text>
                <Text style={themedStyles.settingDescription}>
                  {defaultMapApp || t('settings.alwaysAsk')}
                </Text>
              </View>
              <View style={themedStyles.chevronContainer}>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  size={13}
                  color={colors.secondaryText}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={themedStyles.settingRow}
              activeOpacity={0.7}
              onPress={() => setAboutModalVisible(true)}>
              <View style={themedStyles.iconContainer}>
                <FontAwesomeIcon
                  icon={faCircleInfo}
                  size={14}
                  color={colors.primary}
                />
              </View>
              <View style={themedStyles.settingContent}>
                <Text style={themedStyles.settingTitle}>
                  {t('settings.about')}
                </Text>
                <Text style={themedStyles.settingDescription}>
                  {t('settings.aboutDescription')}
                </Text>
              </View>
              <View style={themedStyles.chevronContainer}>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  size={13}
                  color={colors.secondaryText}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Danger Zone - Delete Account */}
        <View style={themedStyles.dangerSection}>
          <Text style={themedStyles.dangerSectionTitle}>
            {t('settings.dangerZone')}
          </Text>
          <TouchableOpacity
            style={themedStyles.deleteButton}
            activeOpacity={0.7}
            onPress={() => setDeleteAccountModalVisible(true)}>
            <View style={themedStyles.deleteIconContainer}>
              <FontAwesomeIcon icon={faTrash} size={14} color={colors.error} />
            </View>
            <View style={themedStyles.deleteButtonText}>
              <Text style={themedStyles.deleteButtonTitle}>
                {t('settings.deleteAccount')}
              </Text>
              <Text style={themedStyles.deleteButtonDescription}>
                {t('settings.deleteAccountDescription')}
              </Text>
            </View>
            <View style={themedStyles.chevronContainer}>
              <FontAwesomeIcon
                icon={faChevronRight}
                size={13}
                color={colors.error}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <Text style={themedStyles.version}>BetterPlay v{appVersion}</Text>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLanguageModalVisible(false)}>
        <TouchableOpacity
          style={themedStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLanguageModalVisible(false)}>
          <View
            style={themedStyles.modalContent}
            onStartShouldSetResponder={() => true}>
            <View style={themedStyles.modalHandle} />
            <View style={themedStyles.modalHeader}>
              <Text style={themedStyles.modalTitle}>
                {t('settings.selectLanguage')}
              </Text>
              <TouchableOpacity
                style={themedStyles.modalCloseButton}
                onPress={() => setLanguageModalVisible(false)}>
                <FontAwesomeIcon icon={faXmark} size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={themedStyles.languageList}>
              {LANGUAGES.map(language => {
                const isSelected = selectedLanguage.code === language.code;
                return (
                  <TouchableOpacity
                    key={language.code}
                    style={[
                      themedStyles.languageOption,
                      isSelected && themedStyles.languageOptionSelected,
                    ]}
                    onPress={() => handleLanguageSelect(language)}
                    activeOpacity={0.7}>
                    <View style={themedStyles.languageInfo}>
                      <Text
                        style={[
                          themedStyles.languageName,
                          isSelected && themedStyles.languageNameSelected,
                        ]}>
                        {language.name}
                      </Text>
                      <Text style={themedStyles.languageNativeName}>
                        {language.nativeName}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={themedStyles.languageCheck}>
                        <FontAwesomeIcon
                          icon={faCheck}
                          size={14}
                          color={colors.primary}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Default Map App Modal */}
      <Modal
        visible={mapModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMapModalVisible(false)}>
        <TouchableOpacity
          style={themedStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMapModalVisible(false)}>
          <View
            style={themedStyles.modalContent}
            onStartShouldSetResponder={() => true}>
            <View style={themedStyles.modalHandle} />
            <View style={themedStyles.modalHeader}>
              <Text style={themedStyles.modalTitle}>
                {t('settings.defaultMapApp')}
              </Text>
              <TouchableOpacity
                style={themedStyles.modalCloseButton}
                onPress={() => setMapModalVisible(false)}>
                <FontAwesomeIcon icon={faXmark} size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={themedStyles.languageList}>
              {MAP_OPTIONS.map(option => {
                const isSelected = defaultMapApp === option.value;
                return (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      themedStyles.languageOption,
                      isSelected && themedStyles.languageOptionSelected,
                    ]}
                    onPress={() => handleMapAppSelect(option.value)}
                    activeOpacity={0.7}>
                    <View style={themedStyles.languageInfo}>
                      <Text
                        style={[
                          themedStyles.languageName,
                          isSelected && themedStyles.languageNameSelected,
                        ]}>
                        {option.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={themedStyles.languageCheck}>
                        <FontAwesomeIcon
                          icon={faCheck}
                          size={14}
                          color={colors.primary}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={deleteAccountModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDeleteAccountModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={themedStyles.keyboardAvoidingView}>
          <TouchableOpacity
            style={themedStyles.modalOverlay}
            activeOpacity={1}
            onPress={() => setDeleteAccountModalVisible(false)}>
            <View
              style={themedStyles.deleteModalContent}
              onStartShouldSetResponder={() => true}>
              <View style={themedStyles.modalHandle} />
              <View style={themedStyles.deleteModalHeader}>
                <View style={themedStyles.deleteModalIconContainer}>
                  <FontAwesomeIcon
                    icon={faExclamationTriangle}
                    size={26}
                    color={colors.error}
                  />
                </View>
                <Text style={themedStyles.deleteModalTitle}>
                  {t('settings.deleteAccountTitle')}
                </Text>
              </View>
              <View style={themedStyles.deleteModalBody}>
                <Text style={themedStyles.deleteWarningText}>
                  {t('settings.deleteAccountWarning')}
                </Text>
                <View style={themedStyles.deleteWarningList}>
                  <Text style={themedStyles.deleteWarningItem}>
                    • {t('settings.deleteWarning1')}
                  </Text>
                  <Text style={themedStyles.deleteWarningItem}>
                    • {t('settings.deleteWarning2')}
                  </Text>
                  <Text style={themedStyles.deleteWarningItem}>
                    • {t('settings.deleteWarning3')}
                  </Text>
                  <Text style={themedStyles.deleteWarningItemLast}>
                    • {t('settings.deleteWarning4')}
                  </Text>
                </View>
                <Text style={themedStyles.deleteConfirmLabel}>
                  {t('settings.typeDeleteToConfirm')}
                </Text>
                <TextInput
                  style={themedStyles.deleteConfirmInput}
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  placeholder="DELETE"
                  placeholderTextColor={colors.placeholder}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <View style={themedStyles.deleteModalButtons}>
                  <TouchableOpacity
                    style={themedStyles.cancelButton}
                    onPress={() => {
                      setDeleteAccountModalVisible(false);
                      setDeleteConfirmText('');
                    }}>
                    <Text style={themedStyles.cancelButtonText}>
                      {t('common.cancel')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      themedStyles.confirmDeleteButton,
                      deleteConfirmText !== 'DELETE' &&
                        themedStyles.confirmDeleteButtonDisabled,
                    ]}
                    onPress={handleDeleteAccount}
                    disabled={isDeleting || deleteConfirmText !== 'DELETE'}>
                    {isDeleting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={themedStyles.confirmDeleteButtonText}>
                        {t('settings.confirmDelete')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Notification Settings Modal */}
      <Modal
        visible={notificationSettingsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNotificationSettingsModalVisible(false)}>
        <TouchableOpacity
          style={themedStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setNotificationSettingsModalVisible(false)}>
          <View
            style={[themedStyles.modalContent, {maxHeight: '85%'}]}
            onStartShouldSetResponder={() => true}>
            <View style={themedStyles.modalHandle} />
            <View style={themedStyles.modalHeader}>
              <Text style={themedStyles.modalTitle}>
                {t('settings.notifications')}
              </Text>
              <TouchableOpacity
                style={themedStyles.modalCloseButton}
                onPress={() => setNotificationSettingsModalVisible(false)}>
                <FontAwesomeIcon icon={faXmark} size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} bounces={true}>
              <NotificationSettings
                onClose={() => setNotificationSettingsModalVisible(false)}
              />
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* About Modal */}
      <Modal
        visible={aboutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAboutModalVisible(false)}>
        <TouchableOpacity
          style={themedStyles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAboutModalVisible(false)}>
          <View
            style={themedStyles.modalContent}
            onStartShouldSetResponder={() => true}>
            <View style={themedStyles.modalHandle} />
            <View style={themedStyles.modalHeader}>
              <Text style={themedStyles.modalTitle}>{t('settings.about')}</Text>
              <TouchableOpacity
                style={themedStyles.modalCloseButton}
                onPress={() => setAboutModalVisible(false)}>
                <FontAwesomeIcon icon={faXmark} size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={themedStyles.aboutBody}>
              <Text style={themedStyles.aboutAppName}>BetterPlay</Text>
              <Text style={themedStyles.aboutVersion}>
                Version {appVersion}
              </Text>
              <Text style={themedStyles.aboutCopyright}>
                © 2026 Patrick O'Connor{'\n'}All rights reserved.
              </Text>

              <TouchableOpacity
                style={themedStyles.aboutLinkRow}
                onPress={() => {
                  setAboutModalVisible(false);
                  navigation.navigate('TermsOfService' as never);
                }}>
                <Text style={themedStyles.aboutLinkLabel}>
                  {t('settings.termsOfService') || 'Terms of Service'}
                </Text>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  size={13}
                  color={colors.secondaryText}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={themedStyles.aboutLinkRow}
                onPress={() => {
                  setAboutModalVisible(false);
                  navigation.navigate('PrivacyPolicy' as never);
                }}>
                <Text style={themedStyles.aboutLinkLabel}>
                  {t('settings.privacyPolicy')}
                </Text>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  size={13}
                  color={colors.secondaryText}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={themedStyles.aboutLinkRow}
                onPress={() => {
                  setAboutModalVisible(false);
                  navigation.navigate('YourData' as never);
                }}>
                <Text style={themedStyles.aboutLinkLabel}>
                  {t('settings.yourData') || 'Your Data'}
                </Text>
                <FontAwesomeIcon
                  icon={faChevronRight}
                  size={13}
                  color={colors.secondaryText}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={themedStyles.aboutCloseButton}
                onPress={() => setAboutModalVisible(false)}>
                <Text style={themedStyles.aboutCloseButtonText}>
                  {t('common.close') || 'Close'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default Settings;
