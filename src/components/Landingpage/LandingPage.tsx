import React, {useState, useRef, useEffect, useContext, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import UserContext from '../UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '../../config/api';
import notificationService from '../../services/NotificationService';
import {useTheme} from '../ThemeContext/ThemeContext';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faUser,
  faLock,
  faEnvelope,
  faIdCard,
  faArrowRight,
  faUserPlus,
  faSignInAlt,
  faKey,
  faTimes,
  faCheckCircle,
  faEye,
  faEyeSlash,
} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';

// Interfaces
type RootStackParamList = {
  EventList: {username: string};
  BottomNavigator: {
    screen: string;
    params: {
      Profile: {_id: string; username: string; email: string};
    };
  };
};

function LandingPage() {
  // User context
  const userContext = useContext(UserContext);
  if (!userContext) {
    throw new Error('LandingPage must be used within a UserProvider');
  }
  const {userData, setUserData} = userContext;

  // Theme
  const {colors} = useTheme();

  // Translation
  const {t} = useTranslation();

  // Tab state: 'login' or 'register'
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: {
          flex: 1,
          backgroundColor: colors.background,
        },
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        scrollContent: {
          flexGrow: 1,
          justifyContent: 'center',
          padding: 24,
        },
        // Hero Section
        heroSection: {
          alignItems: 'center',
          marginBottom: 40,
        },
        logoContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        },
        logoEmoji: {
          fontSize: 48,
          marginHorizontal: 6,
        },
        appName: {
          fontSize: 36,
          fontWeight: '800',
          color: colors.primary,
          letterSpacing: 1,
          marginBottom: 8,
        },
        tagline: {
          fontSize: 16,
          color: colors.placeholder,
          textAlign: 'center',
          lineHeight: 22,
        },
        // Form Card
        formCard: {
          backgroundColor: colors.card,
          borderRadius: 24,
          padding: 24,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 4},
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 5,
        },
        // Tabs
        tabContainer: {
          flexDirection: 'row',
          backgroundColor: colors.background,
          borderRadius: 16,
          padding: 4,
          marginBottom: 24,
        },
        tab: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: 'center',
          flexDirection: 'row',
          justifyContent: 'center',
        },
        tabActive: {
          backgroundColor: colors.primary,
        },
        tabText: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.placeholder,
          marginLeft: 8,
        },
        tabTextActive: {
          color: colors.buttonText,
        },
        // Form Title
        formTitle: {
          fontSize: 24,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 8,
          textAlign: 'center',
        },
        formSubtitle: {
          fontSize: 14,
          color: colors.placeholder,
          marginBottom: 24,
          textAlign: 'center',
        },
        // Input Group
        inputGroup: {
          marginBottom: 16,
        },
        inputLabel: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.text,
          marginBottom: 8,
        },
        inputContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBackground,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 16,
        },
        inputContainerFocused: {
          borderColor: colors.primary,
          borderWidth: 2,
        },
        inputIcon: {
          marginRight: 12,
        },
        input: {
          flex: 1,
          height: 52,
          fontSize: 16,
          color: colors.text,
        },
        // Primary Button
        primaryButton: {
          backgroundColor: colors.primary,
          borderRadius: 14,
          paddingVertical: 16,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          marginTop: 8,
          shadowColor: colors.primary,
          shadowOffset: {width: 0, height: 4},
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 4,
        },
        primaryButtonText: {
          color: colors.buttonText,
          fontSize: 17,
          fontWeight: '700',
          marginRight: 8,
        },
        // Messages
        errorContainer: {
          backgroundColor: colors.error + '15',
          borderRadius: 12,
          padding: 14,
          marginTop: 16,
          flexDirection: 'row',
          alignItems: 'center',
        },
        errorText: {
          color: colors.error,
          fontSize: 14,
          flex: 1,
          marginLeft: 10,
        },
        successContainer: {
          backgroundColor: '#4CAF50' + '15',
          borderRadius: 12,
          padding: 14,
          marginTop: 16,
          flexDirection: 'row',
          alignItems: 'center',
        },
        successText: {
          color: '#4CAF50',
          fontSize: 14,
          flex: 1,
          marginLeft: 10,
        },
        // Footer
        footer: {
          marginTop: 32,
          alignItems: 'center',
        },
        footerText: {
          fontSize: 13,
          color: colors.placeholder,
        },
        footerEmojis: {
          fontSize: 20,
          marginTop: 8,
        },
        // Forgot Password
        forgotPasswordLink: {
          alignItems: 'center',
          marginTop: 16,
        },
        forgotPasswordText: {
          color: colors.primary,
          fontSize: 14,
          fontWeight: '600',
        },
        // Modal styles
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        },
        modalContent: {
          backgroundColor: colors.card,
          borderRadius: 20,
          padding: 24,
          width: '100%',
          maxWidth: 400,
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 4},
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 8,
        },
        modalHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        },
        modalTitle: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.text,
        },
        modalCloseButton: {
          padding: 4,
        },
        modalSubtitle: {
          fontSize: 14,
          color: colors.placeholder,
          marginBottom: 24,
          lineHeight: 20,
        },
        modalSuccessContainer: {
          alignItems: 'center',
          paddingVertical: 20,
        },
        modalSuccessText: {
          fontSize: 16,
          color: colors.text,
          textAlign: 'center',
          marginTop: 16,
          lineHeight: 22,
        },
        modalSuccessButton: {
          marginTop: 24,
        },
        failedAttemptsWarning: {
          backgroundColor: colors.error + '15',
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
        },
        failedAttemptsText: {
          color: colors.error,
          fontSize: 13,
          flex: 1,
          marginLeft: 8,
        },
      }),
    [colors],
  );

  const [registrationData, setRegistrationData] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
  });
  const [loginData, setLoginData] = useState({
    username: '',
    password: '',
  });

  // Focus states
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Password visibility states
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  // Error messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Forgot password states
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false);
  const [forgotPasswordError, setForgotPasswordError] = useState<string | null>(
    null,
  );

  const loginUsernameInputRef = useRef<TextInput>(null);
  const loginPasswordInputRef = useRef<TextInput>(null);
  const forgotPasswordEmailRef = useRef<TextInput>(null);

  const registerNameInputRef = useRef<TextInput>(null);
  const registerEmailInputRef = useRef<TextInput>(null);
  const registerUsernameInputRef = useRef<TextInput>(null);
  const registerPasswordInputRef = useRef<TextInput>(null);

  // Process login and registration
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  // Reset form states when navigating away from this screen
  useEffect(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [navigation]);

  // Clear messages when switching tabs
  useEffect(() => {
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [activeTab]);

  const handleRegistration = async () => {
    Keyboard.dismiss();
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(registrationData),
      });
      const responseData = await response.json();
      if (responseData.success) {
        await AsyncStorage.setItem('userToken', responseData.token);
        // Cache user data for faster app startup
        await AsyncStorage.setItem(
          'cachedUserData',
          JSON.stringify(responseData.user),
        );

        // Register device for push notifications now that user is logged in
        await notificationService.ensureTokenRegistered();

        setSuccessMessage('Account created successfully!');
        setErrorMessage(null);
        setUserData(responseData.user);
        navigation.navigate('BottomNavigator', {
          screen: 'Profile',
          params: {
            Profile: {
              _id: responseData.user._id,
              username: responseData.user.username,
              email: responseData.user.email,
            },
          },
        });
      } else {
        if (responseData.message?.includes('Email already in use')) {
          setErrorMessage('Email already in use. Please use another email.');
        } else {
          setErrorMessage(responseData.message || 'Registration failed.');
        }
        setSuccessMessage(null);
      }
    } catch (error) {
      console.error('Error during registration:', error as Error);
      setErrorMessage('Failed to create account. Please try again.');
      setSuccessMessage(null);
    }
    setUserData({
      ...userData,
      username: registrationData.username,
      email: registrationData.email,
      _id: '',
    });
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(loginData),
      });
      const responseData = await response.json();

      if (responseData.success) {
        setFailedAttempts(0); // Reset on successful login
        setUserData(responseData.user);
        if (!responseData.token) {
          console.error('No token in response', responseData);
          return;
        }
        await AsyncStorage.setItem('userToken', responseData.token);
        // Cache user data for faster app startup
        await AsyncStorage.setItem(
          'cachedUserData',
          JSON.stringify(responseData.user),
        );

        // Register device for push notifications now that user is logged in
        await notificationService.ensureTokenRegistered();

        setSuccessMessage('Welcome back!');
        setErrorMessage(null);

        navigation.navigate('BottomNavigator', {
          screen: 'EventList',
          params: {
            Profile: {
              _id: responseData.user._id,
              username: loginData.username,
              email: responseData.user.email,
            },
          },
        });
      } else {
        const newFailedAttempts = failedAttempts + 1;
        setFailedAttempts(newFailedAttempts);
        setErrorMessage(
          responseData.message || 'Invalid username or password.',
        );
        setSuccessMessage(null);

        // Show forgot password modal after 3 failed attempts
        if (newFailedAttempts >= 3) {
          setTimeout(() => {
            setShowForgotPassword(true);
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error during login:', error);
      setErrorMessage('Failed to log in. Please try again.');
      setSuccessMessage(null);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail.trim()) {
      setForgotPasswordError(t('forgotPassword.enterEmail'));
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail)) {
      setForgotPasswordError(t('forgotPassword.invalidEmail'));
      return;
    }

    setForgotPasswordLoading(true);
    setForgotPasswordError(null);

    try {
      // Call backend to send password reset email
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email: forgotPasswordEmail}),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }

      const data = await response.json();

      if (data.success) {
        setForgotPasswordSuccess(true);
      } else {
        setForgotPasswordError(
          data.message || t('forgotPassword.requestFailed'),
        );
      }
    } catch (error: any) {
      console.error('Error requesting password reset:', error);
      setForgotPasswordError(t('forgotPassword.requestFailed'));
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPassword(false);
    setForgotPasswordEmail('');
    setForgotPasswordError(null);
    setForgotPasswordSuccess(false);
    setForgotPasswordLoading(false);
  };

  const renderForgotPasswordModal = () => (
    <Modal
      visible={showForgotPassword}
      transparent
      animationType="fade"
      onRequestClose={closeForgotPasswordModal}>
      <TouchableOpacity
        style={themedStyles.modalOverlay}
        activeOpacity={1}
        onPress={closeForgotPasswordModal}>
        <TouchableOpacity
          activeOpacity={1}
          style={themedStyles.modalContent}
          onPress={e => e.stopPropagation()}>
          <View style={themedStyles.modalHeader}>
            <Text style={themedStyles.modalTitle}>
              {t('forgotPassword.title')}
            </Text>
            <TouchableOpacity
              style={themedStyles.modalCloseButton}
              onPress={closeForgotPasswordModal}>
              <FontAwesomeIcon
                icon={faTimes}
                size={20}
                color={colors.placeholder}
              />
            </TouchableOpacity>
          </View>

          {forgotPasswordSuccess ? (
            <View style={themedStyles.modalSuccessContainer}>
              <FontAwesomeIcon icon={faCheckCircle} size={48} color="#4CAF50" />
              <Text style={themedStyles.modalSuccessText}>
                {t('forgotPassword.successMessage')}
              </Text>
              <TouchableOpacity
                style={[
                  themedStyles.primaryButton,
                  themedStyles.modalSuccessButton,
                ]}
                onPress={closeForgotPasswordModal}>
                <Text style={themedStyles.primaryButtonText}>
                  {t('common.done')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={themedStyles.modalSubtitle}>
                {t('forgotPassword.subtitle')}
              </Text>

              {failedAttempts >= 3 && (
                <View style={themedStyles.failedAttemptsWarning}>
                  <FontAwesomeIcon
                    icon={faLock}
                    size={16}
                    color={colors.error}
                  />
                  <Text style={themedStyles.failedAttemptsText}>
                    {t('forgotPassword.multipleAttempts', {
                      count: failedAttempts,
                    })}
                  </Text>
                </View>
              )}

              <View style={themedStyles.inputGroup}>
                <Text style={themedStyles.inputLabel}>{t('auth.email')}</Text>
                <View
                  style={[
                    themedStyles.inputContainer,
                    focusedField === 'forgotEmail' &&
                      themedStyles.inputContainerFocused,
                  ]}>
                  <FontAwesomeIcon
                    icon={faEnvelope}
                    size={18}
                    color={
                      focusedField === 'forgotEmail'
                        ? colors.primary
                        : colors.placeholder
                    }
                    style={themedStyles.inputIcon}
                  />
                  <TextInput
                    style={themedStyles.input}
                    placeholder={t('landing.enterEmail')}
                    placeholderTextColor={colors.placeholder}
                    value={forgotPasswordEmail}
                    onChangeText={setForgotPasswordEmail}
                    ref={forgotPasswordEmailRef}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    onFocus={() => setFocusedField('forgotEmail')}
                    onBlur={() => setFocusedField(null)}
                    returnKeyType="send"
                    onSubmitEditing={handleForgotPassword}
                  />
                </View>
              </View>

              {forgotPasswordError && (
                <View style={themedStyles.errorContainer}>
                  <Text style={themedStyles.errorText}>
                    ⚠️ {forgotPasswordError}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={themedStyles.primaryButton}
                onPress={handleForgotPassword}
                disabled={forgotPasswordLoading}>
                {forgotPasswordLoading ? (
                  <ActivityIndicator color={colors.buttonText} />
                ) : (
                  <>
                    <Text style={themedStyles.primaryButtonText}>
                      {t('forgotPassword.sendReset')}
                    </Text>
                    <FontAwesomeIcon
                      icon={faKey}
                      size={18}
                      color={colors.buttonText}
                    />
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  const renderLoginForm = () => (
    <>
      <Text style={themedStyles.formTitle}>{t('auth.welcomeBack')}</Text>
      <Text style={themedStyles.formSubtitle}>
        {t('landing.signInToContinue')}
      </Text>

      {/* Username */}
      <View style={themedStyles.inputGroup}>
        <Text style={themedStyles.inputLabel}>{t('auth.username')}</Text>
        <View
          style={[
            themedStyles.inputContainer,
            focusedField === 'loginUsername' &&
              themedStyles.inputContainerFocused,
          ]}>
          <FontAwesomeIcon
            icon={faUser}
            size={18}
            color={
              focusedField === 'loginUsername'
                ? colors.primary
                : colors.placeholder
            }
            style={themedStyles.inputIcon}
          />
          <TextInput
            style={themedStyles.input}
            placeholder={t('landing.enterUsername')}
            placeholderTextColor={colors.placeholder}
            value={loginData.username}
            onChangeText={text => setLoginData({...loginData, username: text})}
            ref={loginUsernameInputRef}
            autoCapitalize="none"
            onFocus={() => setFocusedField('loginUsername')}
            onBlur={() => setFocusedField(null)}
            returnKeyType="next"
            onSubmitEditing={() => loginPasswordInputRef.current?.focus()}
          />
        </View>
      </View>

      {/* Password */}
      <View style={themedStyles.inputGroup}>
        <Text style={themedStyles.inputLabel}>{t('auth.password')}</Text>
        <View
          style={[
            themedStyles.inputContainer,
            focusedField === 'loginPassword' &&
              themedStyles.inputContainerFocused,
          ]}>
          <FontAwesomeIcon
            icon={faLock}
            size={18}
            color={
              focusedField === 'loginPassword'
                ? colors.primary
                : colors.placeholder
            }
            style={themedStyles.inputIcon}
          />
          <TextInput
            style={themedStyles.input}
            placeholder={t('landing.enterPassword')}
            placeholderTextColor={colors.placeholder}
            secureTextEntry={!showLoginPassword}
            value={loginData.password}
            onChangeText={text => setLoginData({...loginData, password: text})}
            ref={loginPasswordInputRef}
            autoCapitalize="none"
            onFocus={() => setFocusedField('loginPassword')}
            onBlur={() => setFocusedField(null)}
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />
          <TouchableOpacity
            onPress={() => setShowLoginPassword(!showLoginPassword)}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <FontAwesomeIcon
              icon={showLoginPassword ? faEyeSlash : faEye}
              size={18}
              color={colors.placeholder}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Login Button */}
      <TouchableOpacity
        style={themedStyles.primaryButton}
        onPress={handleLogin}>
        <Text style={themedStyles.primaryButtonText}>
          {t('landing.signIn')}
        </Text>
        <FontAwesomeIcon
          icon={faArrowRight}
          size={18}
          color={colors.buttonText}
        />
      </TouchableOpacity>

      {/* Forgot Password Link */}
      <TouchableOpacity
        style={themedStyles.forgotPasswordLink}
        onPress={() => setShowForgotPassword(true)}>
        <Text style={themedStyles.forgotPasswordText}>
          {t('auth.forgotPassword')}
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderRegisterForm = () => (
    <>
      <Text style={themedStyles.formTitle}>{t('auth.createAccount')}</Text>
      <Text style={themedStyles.formSubtitle}>
        {t('landing.joinBetterPlay')}
      </Text>

      {/* Name */}
      <View style={themedStyles.inputGroup}>
        <Text style={themedStyles.inputLabel}>{t('landing.fullName')}</Text>
        <View
          style={[
            themedStyles.inputContainer,
            focusedField === 'registerName' &&
              themedStyles.inputContainerFocused,
          ]}>
          <FontAwesomeIcon
            icon={faIdCard}
            size={18}
            color={
              focusedField === 'registerName'
                ? colors.primary
                : colors.placeholder
            }
            style={themedStyles.inputIcon}
          />
          <TextInput
            style={themedStyles.input}
            placeholder={t('landing.enterFullName')}
            placeholderTextColor={colors.placeholder}
            value={registrationData.name}
            onChangeText={text =>
              setRegistrationData({...registrationData, name: text})
            }
            ref={registerNameInputRef}
            autoCapitalize="words"
            onFocus={() => setFocusedField('registerName')}
            onBlur={() => setFocusedField(null)}
            returnKeyType="next"
            onSubmitEditing={() => registerEmailInputRef.current?.focus()}
          />
        </View>
      </View>

      {/* Email */}
      <View style={themedStyles.inputGroup}>
        <Text style={themedStyles.inputLabel}>{t('auth.email')}</Text>
        <View
          style={[
            themedStyles.inputContainer,
            focusedField === 'registerEmail' &&
              themedStyles.inputContainerFocused,
          ]}>
          <FontAwesomeIcon
            icon={faEnvelope}
            size={18}
            color={
              focusedField === 'registerEmail'
                ? colors.primary
                : colors.placeholder
            }
            style={themedStyles.inputIcon}
          />
          <TextInput
            style={themedStyles.input}
            placeholder={t('landing.enterEmail')}
            placeholderTextColor={colors.placeholder}
            value={registrationData.email}
            onChangeText={text =>
              setRegistrationData({...registrationData, email: text})
            }
            ref={registerEmailInputRef}
            autoCapitalize="none"
            keyboardType="email-address"
            onFocus={() => setFocusedField('registerEmail')}
            onBlur={() => setFocusedField(null)}
            returnKeyType="next"
            onSubmitEditing={() => registerUsernameInputRef.current?.focus()}
          />
        </View>
      </View>

      {/* Username */}
      <View style={themedStyles.inputGroup}>
        <Text style={themedStyles.inputLabel}>{t('auth.username')}</Text>
        <View
          style={[
            themedStyles.inputContainer,
            focusedField === 'registerUsername' &&
              themedStyles.inputContainerFocused,
          ]}>
          <FontAwesomeIcon
            icon={faUser}
            size={18}
            color={
              focusedField === 'registerUsername'
                ? colors.primary
                : colors.placeholder
            }
            style={themedStyles.inputIcon}
          />
          <TextInput
            style={themedStyles.input}
            placeholder={t('landing.chooseUsername')}
            placeholderTextColor={colors.placeholder}
            value={registrationData.username}
            onChangeText={text =>
              setRegistrationData({...registrationData, username: text})
            }
            ref={registerUsernameInputRef}
            autoCapitalize="none"
            onFocus={() => setFocusedField('registerUsername')}
            onBlur={() => setFocusedField(null)}
            returnKeyType="next"
            onSubmitEditing={() => registerPasswordInputRef.current?.focus()}
          />
        </View>
      </View>

      {/* Password */}
      <View style={themedStyles.inputGroup}>
        <Text style={themedStyles.inputLabel}>{t('auth.password')}</Text>
        <View
          style={[
            themedStyles.inputContainer,
            focusedField === 'registerPassword' &&
              themedStyles.inputContainerFocused,
          ]}>
          <FontAwesomeIcon
            icon={faLock}
            size={18}
            color={
              focusedField === 'registerPassword'
                ? colors.primary
                : colors.placeholder
            }
            style={themedStyles.inputIcon}
          />
          <TextInput
            style={themedStyles.input}
            placeholder={t('landing.createPassword')}
            placeholderTextColor={colors.placeholder}
            secureTextEntry={!showRegisterPassword}
            value={registrationData.password}
            onChangeText={text =>
              setRegistrationData({...registrationData, password: text})
            }
            ref={registerPasswordInputRef}
            autoCapitalize="none"
            onFocus={() => setFocusedField('registerPassword')}
            onBlur={() => setFocusedField(null)}
            returnKeyType="go"
            onSubmitEditing={handleRegistration}
          />
          <TouchableOpacity
            onPress={() => setShowRegisterPassword(!showRegisterPassword)}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <FontAwesomeIcon
              icon={showRegisterPassword ? faEyeSlash : faEye}
              size={18}
              color={colors.placeholder}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Register Button */}
      <TouchableOpacity
        style={themedStyles.primaryButton}
        onPress={handleRegistration}>
        <Text style={themedStyles.primaryButtonText}>
          {t('auth.createAccount')}
        </Text>
        <FontAwesomeIcon
          icon={faArrowRight}
          size={18}
          color={colors.buttonText}
        />
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={themedStyles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={themedStyles.container}>
        <ScrollView
          contentContainerStyle={themedStyles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Hero Section */}
          <View style={themedStyles.heroSection}>
            <View style={themedStyles.logoContainer}>
              <Text style={themedStyles.logoEmoji}>�</Text>
              <Text style={themedStyles.logoEmoji}>🤝</Text>
              <Text style={themedStyles.logoEmoji}>🎉</Text>
            </View>
            <Text style={themedStyles.appName}>BetterPlay</Text>
            <Text style={themedStyles.tagline}>
              {t('landing.taglineMultiline')}
            </Text>
          </View>

          {/* Form Card */}
          <View style={themedStyles.formCard}>
            {/* Tab Switcher */}
            <View style={themedStyles.tabContainer}>
              <TouchableOpacity
                style={[
                  themedStyles.tab,
                  activeTab === 'login' && themedStyles.tabActive,
                ]}
                onPress={() => setActiveTab('login')}>
                <FontAwesomeIcon
                  icon={faSignInAlt}
                  size={16}
                  color={
                    activeTab === 'login'
                      ? colors.buttonText
                      : colors.placeholder
                  }
                />
                <Text
                  style={[
                    themedStyles.tabText,
                    activeTab === 'login' && themedStyles.tabTextActive,
                  ]}>
                  {t('landing.signIn')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  themedStyles.tab,
                  activeTab === 'register' && themedStyles.tabActive,
                ]}
                onPress={() => setActiveTab('register')}>
                <FontAwesomeIcon
                  icon={faUserPlus}
                  size={16}
                  color={
                    activeTab === 'register'
                      ? colors.buttonText
                      : colors.placeholder
                  }
                />
                <Text
                  style={[
                    themedStyles.tabText,
                    activeTab === 'register' && themedStyles.tabTextActive,
                  ]}>
                  {t('auth.register')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Content */}
            {activeTab === 'login' ? renderLoginForm() : renderRegisterForm()}

            {/* Error Message */}
            {errorMessage && (
              <View style={themedStyles.errorContainer}>
                <Text style={themedStyles.errorText}>⚠️ {errorMessage}</Text>
              </View>
            )}

            {/* Success Message */}
            {successMessage && (
              <View style={themedStyles.successContainer}>
                <Text style={themedStyles.successText}>✓ {successMessage}</Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={themedStyles.footer}>
            <Text style={themedStyles.footerText}>
              {t('landing.footerText')}
            </Text>
            <Text style={themedStyles.footerEmojis}>🎯 🏆 🤝</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      {renderForgotPasswordModal()}
    </SafeAreaView>
  );
}

export default LandingPage;
