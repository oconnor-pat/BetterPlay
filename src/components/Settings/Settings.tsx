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
} from '@fortawesome/free-solid-svg-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import {useTranslation} from 'react-i18next';
import axios from 'axios';
import {API_BASE_URL} from '../../config/api';
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

const Settings: React.FC = () => {
  const {t, i18n} = useTranslation();
  const {darkMode, themeMode, setThemeMode, colors} = useTheme();
  const {setUserData} = useContext(UserContext) as UserContextType;
  const navigation = useNavigation();
  const [locationEnabled, setLocationEnabled] = useState(false);
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

      if (savedLocationPref !== null) {
        setLocationEnabled(JSON.parse(savedLocationPref));
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
            Alert.alert(t('common.success'), t('settings.locationEnabled'));
          },
          error => {
            console.error('Location permission denied:', error);
            Alert.alert(
              t('settings.permissionDenied'),
              t('settings.enableLocationSettings'),
            );
            setLocationEnabled(false);
            AsyncStorage.setItem('locationEnabled', JSON.stringify(false));
          },
        );
      } else {
        Alert.alert(t('settings.locationDisabled'));
      }
    } catch (error) {
      console.error('Error saving location preference:', error);
    }
  };

  const _handleNotificationsToggle = async () => {
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
        loadingTitle: {
          textAlign: 'center',
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
        themePicker: {
          flexDirection: 'row',
          padding: 12,
          paddingTop: 0,
          gap: 8,
        },
        themeOption: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: colors.background,
          gap: 6,
        },
        themeOptionActive: {
          backgroundColor: colors.primary,
        },
        themeOptionText: {
          fontSize: 13,
          fontWeight: '500',
          color: colors.text,
        },
        themeOptionTextActive: {
          color: colors.buttonText,
        },
        // Keyboard Avoiding View
        keyboardAvoidingView: {
          flex: 1,
        },
        // Language Modal Styles
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        },
        modalContent: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: 40,
        },
        modalHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        modalTitle: {
          fontSize: 18,
          fontWeight: '600',
          color: colors.text,
        },
        modalCloseButton: {
          padding: 4,
        },
        languageList: {
          paddingHorizontal: 8,
        },
        languageOption: {
          flexDirection: 'row',
          alignItems: 'center',
          padding: 16,
          marginHorizontal: 8,
          marginVertical: 4,
          borderRadius: 12,
          backgroundColor: colors.background,
        },
        languageOptionSelected: {
          backgroundColor: colors.primary + '20',
          borderWidth: 1,
          borderColor: colors.primary,
        },
        languageInfo: {
          flex: 1,
        },
        languageName: {
          fontSize: 16,
          fontWeight: '500',
          color: colors.text,
        },
        languageNativeName: {
          fontSize: 14,
          color: colors.placeholder,
          marginTop: 2,
        },
        languageCheck: {
          marginLeft: 12,
        },
        // Delete Account Styles
        dangerSection: {
          marginTop: 8,
        },
        dangerSectionTitle: {
          fontSize: 16,
          fontWeight: '600',
          color: '#DC3545',
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        },
        deleteButton: {
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#DC3545',
        },
        deleteIconContainer: {
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: '#DC354520',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        },
        deleteButtonText: {
          flex: 1,
        },
        deleteButtonTitle: {
          fontSize: 16,
          fontWeight: '500',
          color: '#DC3545',
          marginBottom: 2,
        },
        deleteButtonDescription: {
          fontSize: 13,
          color: colors.placeholder,
        },
        deleteModalContent: {
          backgroundColor: colors.card,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingBottom: 34,
          paddingHorizontal: 20,
        },
        deleteModalHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 20,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        deleteModalIconContainer: {
          alignItems: 'center',
          marginBottom: 8,
        },
        deleteModalIcon: {
          marginBottom: 12,
        },
        deleteModalTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: '#DC3545',
          textAlign: 'center',
        },
        deleteModalBody: {
          paddingVertical: 20,
        },
        deleteWarningText: {
          fontSize: 15,
          color: colors.text,
          lineHeight: 22,
          marginBottom: 16,
          textAlign: 'center',
        },
        deleteWarningList: {
          backgroundColor: '#DC354510',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
        },
        deleteWarningItem: {
          fontSize: 14,
          color: colors.text,
          marginBottom: 8,
          paddingLeft: 8,
        },
        deleteWarningItemLast: {
          fontSize: 14,
          color: colors.text,
          marginBottom: 0,
          paddingLeft: 8,
        },
        deleteConfirmLabel: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 8,
        },
        deleteConfirmInput: {
          backgroundColor: colors.background,
          borderRadius: 12,
          padding: 16,
          fontSize: 16,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 20,
        },
        deleteModalButtons: {
          flexDirection: 'row',
          gap: 12,
        },
        cancelButton: {
          flex: 1,
          backgroundColor: colors.background,
          borderRadius: 12,
          padding: 16,
          alignItems: 'center',
        },
        cancelButtonText: {
          fontSize: 16,
          fontWeight: '600',
          color: colors.text,
        },
        confirmDeleteButton: {
          flex: 1,
          backgroundColor: '#DC3545',
          borderRadius: 12,
          padding: 16,
          alignItems: 'center',
        },
        confirmDeleteButtonDisabled: {
          backgroundColor: '#DC354550',
        },
        confirmDeleteButtonText: {
          fontSize: 16,
          fontWeight: '600',
          color: '#FFFFFF',
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
      <ScrollView style={themedStyles.container}>
        <View style={themedStyles.scrollContent}>
          {/* Header */}
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
              <View
                style={[themedStyles.settingRow, themedStyles.settingRowLast]}>
                <View style={themedStyles.iconContainer}>
                  <FontAwesomeIcon
                    icon={
                      themeMode === 'system'
                        ? faCircleHalfStroke
                        : darkMode
                        ? faMoon
                        : faSun
                    }
                    size={18}
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
                    size={16}
                    color={
                      themeMode === 'system' ? colors.buttonText : colors.text
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
                    size={16}
                    color={
                      themeMode === 'light' ? colors.buttonText : colors.text
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
                    size={16}
                    color={
                      themeMode === 'dark' ? colors.buttonText : colors.text
                    }
                  />
                  <Text
                    style={[
                      themedStyles.themeOptionText,
                      themeMode === 'dark' &&
                        themedStyles.themeOptionTextActive,
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
                    size={18}
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

              <TouchableOpacity
                style={[themedStyles.settingRow, themedStyles.settingRowLast]}
                onPress={() => setNotificationSettingsModalVisible(true)}
                activeOpacity={0.7}>
                <View style={themedStyles.iconContainer}>
                  <FontAwesomeIcon
                    icon={faBell}
                    size={18}
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
                    size={16}
                    color={colors.placeholder}
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
                    size={18}
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
                    t('settings.about'),
                    `BetterPlay\nVersion ${appVersion}\n\n© 2026 Patrick O'Connor\nAll rights reserved.`,
                    [
                      {
                        text:
                          t('settings.termsOfService') || 'Terms of Service',
                        onPress: () =>
                          navigation.navigate('TermsOfService' as never),
                      },
                      {
                        text: t('settings.privacyPolicy'),
                        onPress: () =>
                          navigation.navigate('PrivacyPolicy' as never),
                      },
                      {
                        text: t('settings.yourData') || 'Your Data',
                        onPress: () => navigation.navigate('YourData' as never),
                      },
                      {text: t('common.close') || 'Close', style: 'cancel'},
                    ],
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
                    size={16}
                    color={colors.placeholder}
                  />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Danger Zone - Delete Account */}
          <View style={[themedStyles.section, themedStyles.dangerSection]}>
            <Text style={themedStyles.dangerSectionTitle}>
              {t('settings.dangerZone')}
            </Text>
            <TouchableOpacity
              style={themedStyles.deleteButton}
              activeOpacity={0.7}
              onPress={() => setDeleteAccountModalVisible(true)}>
              <View style={themedStyles.deleteIconContainer}>
                <FontAwesomeIcon icon={faTrash} size={18} color="#DC3545" />
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
                  size={16}
                  color="#DC3545"
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* App Version */}
          <Text style={themedStyles.version}>BetterPlay v{appVersion}</Text>
        </View>
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
            <View style={themedStyles.modalHeader}>
              <Text style={themedStyles.modalTitle}>
                {t('settings.selectLanguage')}
              </Text>
              <TouchableOpacity
                style={themedStyles.modalCloseButton}
                onPress={() => setLanguageModalVisible(false)}>
                <FontAwesomeIcon icon={faXmark} size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={themedStyles.languageList}>
              {LANGUAGES.map(language => (
                <TouchableOpacity
                  key={language.code}
                  style={[
                    themedStyles.languageOption,
                    selectedLanguage.code === language.code &&
                      themedStyles.languageOptionSelected,
                  ]}
                  onPress={() => handleLanguageSelect(language)}
                  activeOpacity={0.7}>
                  <View style={themedStyles.languageInfo}>
                    <Text style={themedStyles.languageName}>
                      {language.name}
                    </Text>
                    <Text style={themedStyles.languageNativeName}>
                      {language.nativeName}
                    </Text>
                  </View>
                  {selectedLanguage.code === language.code && (
                    <View style={themedStyles.languageCheck}>
                      <FontAwesomeIcon
                        icon={faCheck}
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
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
              <View style={themedStyles.deleteModalHeader}>
                <View>
                  <View style={themedStyles.deleteModalIconContainer}>
                    <FontAwesomeIcon
                      icon={faExclamationTriangle}
                      size={40}
                      color="#DC3545"
                    />
                  </View>
                  <Text style={themedStyles.deleteModalTitle}>
                    {t('settings.deleteAccountTitle')}
                  </Text>
                </View>
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
            <View style={themedStyles.modalHeader}>
              <Text style={themedStyles.modalTitle}>
                {t('settings.notifications')}
              </Text>
              <TouchableOpacity
                style={themedStyles.modalCloseButton}
                onPress={() => setNotificationSettingsModalVisible(false)}>
                <FontAwesomeIcon icon={faXmark} size={22} color={colors.text} />
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
    </SafeAreaView>
  );
};

export default Settings;
