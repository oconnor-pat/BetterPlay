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
import analyticsService from '../../services/AnalyticsService';
import {
  isGoogleSignInConfigured,
  signInWithApple,
  signInWithGoogle,
  SocialProvider,
} from '../../services/SocialAuthService';
import LinkAccountModal from './LinkAccountModal';
import EditProfileModal from '../Profile/EditProfileModal';
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
  faKey,
  faTimes,
  faCheckCircle,
  faEye,
  faEyeSlash,
  faExclamationTriangle,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import {faApple, faGoogle} from '@fortawesome/free-brands-svg-icons';
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
  const {setUserData} = userContext;

  const {colors} = useTheme();
  const {t} = useTranslation();

  // Branding gate first; form opens from Sign In / Create account.
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  const openAuthForm = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setShowAuthForm(true);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

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
          paddingHorizontal: 24,
          paddingVertical: 20,
        },
        scrollContentGate: {
          flexGrow: 1,
          justifyContent: 'space-between',
          paddingHorizontal: 24,
          paddingTop: 36,
          paddingBottom: 20,
        },
        heroSection: {
          alignItems: 'center',
          marginBottom: 20,
        },
        heroSectionGate: {
          alignItems: 'center',
          flex: 1,
          justifyContent: 'center',
          paddingBottom: 12,
        },
        brandRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        },
        brandRowCompact: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
        },
        brandMark: {
          width: 44,
          height: 44,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
        },
        brandMarkCompact: {
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
        },
        brandMarkText: {
          color: colors.buttonText,
          fontWeight: '700',
          fontSize: 15,
          letterSpacing: 0.2,
        },
        brandName: {
          fontSize: 28,
          fontWeight: '700',
          color: colors.text,
          fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
          letterSpacing: 0.2,
        },
        brandNameCompact: {
          fontSize: 22,
          fontWeight: '700',
          color: colors.text,
          fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        },
        appName: {
          fontSize: 32,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
          lineHeight: 40,
          fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
          marginBottom: 12,
        },
        tagline: {
          fontSize: 15,
          color: colors.secondaryText,
          textAlign: 'center',
          lineHeight: 22,
          maxWidth: 320,
        },
        gateActions: {
          width: '100%',
          gap: 12,
          marginBottom: 16,
        },
        gateSecondaryButton: {
          backgroundColor: 'transparent',
          borderRadius: 24,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        gateSecondaryButtonText: {
          color: colors.text,
          fontSize: 16,
          fontWeight: '700',
        },
        backToBrand: {
          paddingVertical: 8,
          paddingHorizontal: 4,
          minWidth: 36,
        },
        backToBrandText: {
          color: colors.primary,
          fontSize: 22,
          fontWeight: '500',
          lineHeight: 26,
        },
        authHeader: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 16,
        },
        authHeaderBrand: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        },
        authHeaderSpacer: {
          minWidth: 36,
        },
        // Form Card — flat, hairline-bordered (no shadow)
        formCard: {
          backgroundColor: colors.card,
          borderRadius: 18,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: 18,
        },
        // Form Title
        formTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: colors.text,
          marginBottom: 4,
          textAlign: 'center',
        },
        formSubtitle: {
          fontSize: 13,
          color: colors.secondaryText,
          marginBottom: 16,
          textAlign: 'center',
        },
        // Input Group
        inputGroup: {
          marginBottom: 10,
        },
        inputLabel: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        inputContainer: {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.inputBackground,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingHorizontal: 14,
          minHeight: 48,
        },
        inputContainerFocused: {
          borderColor: colors.primary,
        },
        inputIcon: {
          marginRight: 10,
        },
        input: {
          flex: 1,
          height: 48,
          fontSize: 15,
          color: colors.text,
        },
        // Primary Button — pill, no shadow
        primaryButton: {
          backgroundColor: colors.primary,
          borderRadius: 24,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          marginTop: 8,
          gap: 8,
        },
        primaryButtonText: {
          color: colors.buttonText,
          fontSize: 16,
          fontWeight: '700',
        },
        // Messages — hairline-bordered tinted cards
        errorContainer: {
          backgroundColor: colors.error + '12',
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.error + '40',
          padding: 12,
          marginTop: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        errorText: {
          color: colors.error,
          fontSize: 13,
          flex: 1,
        },
        successContainer: {
          backgroundColor: '#4CAF50' + '12',
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '#4CAF50' + '40',
          padding: 12,
          marginTop: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        successText: {
          color: '#4CAF50',
          fontSize: 13,
          flex: 1,
        },
        // Footer
        footer: {
          marginTop: 28,
          alignItems: 'center',
        },
        footerText: {
          fontSize: 12,
          color: colors.secondaryText,
        },
        footerEmojis: {
          fontSize: 16,
          marginTop: 6,
          letterSpacing: 4,
        },
        // Forgot Password
        forgotPasswordLink: {
          alignItems: 'center',
          alignSelf: 'stretch',
          marginTop: 4,
          marginBottom: 4,
          paddingVertical: 4,
        },
        forgotPasswordText: {
          color: colors.primary,
          fontSize: 13,
          fontWeight: '700',
        },
        modeSwitch: {
          alignItems: 'center',
          marginTop: 16,
          paddingVertical: 4,
        },
        modeSwitchText: {
          fontSize: 13,
          color: colors.secondaryText,
          textAlign: 'center',
        },
        modeSwitchAction: {
          color: colors.primary,
          fontWeight: '700',
        },
        socialDividerRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 14,
          marginBottom: 4,
          gap: 10,
        },
        socialDividerAfterSocial: {
          marginTop: 14,
          marginBottom: 10,
        },
        socialButtonsLeading: {
          marginTop: 2,
        },
        socialDividerLine: {
          flex: 1,
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
        },
        socialDividerText: {
          fontSize: 12,
          fontWeight: '600',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
        },
        socialButtonsColumn: {
          marginTop: 10,
          gap: 10,
        },
        socialButton: {
          borderRadius: 24,
          paddingVertical: 13,
          paddingHorizontal: 16,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 10,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.card,
        },
        socialButtonDisabled: {
          opacity: 0.55,
        },
        socialButtonText: {
          color: colors.text,
          fontSize: 15,
          fontWeight: '700',
        },
        // Modal — bottom sheet pattern
        modalOverlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          justifyContent: 'flex-end',
        },
        modalContent: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 32 : 20,
        },
        modalHandle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: 'center',
          marginBottom: 8,
        },
        modalHeader: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingBottom: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        modalTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
          flex: 1,
          textAlign: 'center',
          marginLeft: 28,
        },
        modalCloseButton: {
          padding: 4,
          width: 28,
          alignItems: 'flex-end',
        },
        modalBody: {
          paddingHorizontal: 20,
          paddingTop: 16,
        },
        modalSubtitle: {
          fontSize: 13,
          color: colors.secondaryText,
          marginBottom: 16,
          lineHeight: 18,
          textAlign: 'center',
        },
        modalSuccessContainer: {
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 20,
        },
        modalSuccessIcon: {
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#4CAF50' + '15',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: '#4CAF50' + '40',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        },
        modalSuccessText: {
          fontSize: 14,
          color: colors.text,
          textAlign: 'center',
          lineHeight: 20,
          marginBottom: 20,
        },
        modalSuccessButton: {
          alignSelf: 'stretch',
        },
        failedAttemptsWarning: {
          backgroundColor: colors.error + '12',
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.error + '40',
          padding: 12,
          marginBottom: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        failedAttemptsText: {
          color: colors.error,
          fontSize: 12,
          flex: 1,
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

  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(
    null,
  );
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [pendingSocial, setPendingSocial] = useState<{
    user: any;
    token: string;
    provider: SocialProvider;
    isPrivateRelay?: boolean;
  } | null>(null);
  const [completeProfileVisible, setCompleteProfileVisible] = useState(false);
  const [pendingCompleteProfile, setPendingCompleteProfile] = useState<{
    user: any;
    token: string;
    provider: string;
  } | null>(null);

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

  const completeAuthSession = async (
    user: any,
    token: string,
    method: string,
    isNew: boolean,
  ) => {
    await AsyncStorage.setItem('userToken', token);
    await AsyncStorage.setItem('cachedUserData', JSON.stringify(user));
    await notificationService.requestPermission();
    await notificationService.ensureTokenRegistered();
    setUserData(user);
    if (isNew) {
      analyticsService.trackSignUp(method).catch(() => {});
    } else {
      analyticsService.trackLogin(method).catch(() => {});
    }
  };

  const finishAuthNavigation = (user: any, isNew: boolean) => {
    navigation.navigate('BottomNavigator', {
      screen: isNew ? 'Profile' : 'EventList',
      params: isNew
        ? {
            Profile: {
              _id: user._id,
              username: user.username,
              email: user.email,
            },
          }
        : {
            EventList: {
              username: user.username,
            },
          },
    } as any);
  };

  const handleSocialSignIn = async (provider: SocialProvider) => {
    Keyboard.dismiss();
    setSocialLoading(provider);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result =
        provider === 'apple'
          ? await signInWithApple()
          : await signInWithGoogle();
      if (!result.success) {
        if (!result.cancelled) {
          setErrorMessage(result.message);
        }
        return;
      }

      if (result.isNew || result.suggestLink) {
        setPendingSocial({
          user: result.user,
          token: result.token,
          provider,
          isPrivateRelay: result.isPrivateRelay,
        });
        setLinkModalVisible(true);
        return;
      }

      await completeAuthSession(
        result.user,
        result.token,
        provider,
        result.isNew,
      );
      setSuccessMessage('Welcome back!');
      finishAuthNavigation(result.user, false);
    } catch (error) {
      console.error('Social sign-in error:', error);
      setErrorMessage(
        t('auth.socialSignInError', {
          defaultValue: 'Social sign-in failed. Please try again.',
        }),
      );
    } finally {
      setSocialLoading(null);
    }
  };

  const handleKeepNewSocialAccount = async () => {
    if (!pendingSocial) {
      setLinkModalVisible(false);
      return;
    }
    const {user, token, provider} = pendingSocial;
    setLinkModalVisible(false);
    setPendingSocial(null);
    // Persist token first so the complete-profile save can authenticate.
    await AsyncStorage.setItem('userToken', token);
    await AsyncStorage.setItem('cachedUserData', JSON.stringify(user));
    setPendingCompleteProfile({user, token, provider});
    setCompleteProfileVisible(true);
  };

  const handleLinkedSocialAccount = async (user: any, token: string) => {
    const provider = pendingSocial?.provider || 'email';
    setLinkModalVisible(false);
    setPendingSocial(null);
    await completeAuthSession(user, token, provider, false);
    setSuccessMessage(
      t('auth.accountsLinked', {
        defaultValue: 'Accounts linked. Welcome back!',
      }),
    );
    finishAuthNavigation(user, false);
  };

  const finishCompleteProfile = async (user: any) => {
    const pending = pendingCompleteProfile;
    setCompleteProfileVisible(false);
    setPendingCompleteProfile(null);
    const token = pending?.token || (await AsyncStorage.getItem('userToken'));
    if (!token) {
      return;
    }
    await completeAuthSession(user, token, pending?.provider || 'email', true);
    setSuccessMessage('Account created successfully!');
    finishAuthNavigation(user, true);
  };

  const renderSocialButtons = (options?: {leading?: boolean}) => {
    const googleReady = isGoogleSignInConfigured();
    const dividerLabel = options?.leading
      ? t('auth.orUseEmail', {defaultValue: 'or use email'})
      : t('auth.orContinueWith', {defaultValue: 'or continue with'});

    const buttons = (
      <View
        style={[
          themedStyles.socialButtonsColumn,
          options?.leading && themedStyles.socialButtonsLeading,
        ]}>
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={[
              themedStyles.socialButton,
              socialLoading !== null && themedStyles.socialButtonDisabled,
            ]}
            disabled={socialLoading !== null}
            onPress={() => handleSocialSignIn('apple')}>
            {socialLoading === 'apple' ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <FontAwesomeIcon icon={faApple} size={18} color={colors.text} />
            )}
            <Text style={themedStyles.socialButtonText}>
              {t('auth.continueWithApple', {
                defaultValue: 'Continue with Apple',
              })}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            themedStyles.socialButton,
            (!googleReady || socialLoading !== null) &&
              themedStyles.socialButtonDisabled,
          ]}
          disabled={!googleReady || socialLoading !== null}
          onPress={() => {
            if (!googleReady) {
              setErrorMessage(
                t('auth.googleNotConfigured', {
                  defaultValue:
                    'Google Sign-In is not configured yet. Set GOOGLE_WEB_CLIENT_ID in .env and rebuild.',
                }),
              );
              return;
            }
            handleSocialSignIn('google');
          }}>
          {socialLoading === 'google' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <FontAwesomeIcon icon={faGoogle} size={16} color={colors.text} />
          )}
          <Text style={themedStyles.socialButtonText}>
            {t('auth.continueWithGoogle', {
              defaultValue: 'Continue with Google',
            })}
          </Text>
        </TouchableOpacity>
      </View>
    );

    const divider = (
      <View
        style={[
          themedStyles.socialDividerRow,
          options?.leading && themedStyles.socialDividerAfterSocial,
        ]}>
        <View style={themedStyles.socialDividerLine} />
        <Text style={themedStyles.socialDividerText}>{dividerLabel}</Text>
        <View style={themedStyles.socialDividerLine} />
      </View>
    );

    return options?.leading ? (
      <>
        {buttons}
        {divider}
      </>
    ) : (
      <>
        {divider}
        {buttons}
      </>
    );
  };

  const renderModeSwitch = () => (
    <TouchableOpacity
      style={themedStyles.modeSwitch}
      onPress={() => {
        setActiveTab(activeTab === 'login' ? 'register' : 'login');
        setErrorMessage(null);
        setSuccessMessage(null);
      }}
      activeOpacity={0.7}>
      <Text style={themedStyles.modeSwitchText}>
        {activeTab === 'login'
          ? t('auth.dontHaveAccount')
          : t('auth.alreadyHaveAccount')}{' '}
        <Text style={themedStyles.modeSwitchAction}>
          {activeTab === 'login'
            ? t('landing.createAccount')
            : t('landing.signIn')}
        </Text>
      </Text>
    </TouchableOpacity>
  );

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
        await completeAuthSession(
          responseData.user,
          responseData.token,
          'email',
          true,
        );
        setSuccessMessage('Account created successfully!');
        setErrorMessage(null);
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
        if (!responseData.token) {
          console.error('No token in response', responseData);
          return;
        }
        await completeAuthSession(
          responseData.user,
          responseData.token,
          'email',
          false,
        );
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
      animationType="slide"
      onRequestClose={closeForgotPasswordModal}>
      <TouchableOpacity
        style={themedStyles.modalOverlay}
        activeOpacity={1}
        onPress={closeForgotPasswordModal}>
        <TouchableOpacity
          activeOpacity={1}
          style={themedStyles.modalContent}
          onPress={e => e.stopPropagation()}>
          <View style={themedStyles.modalHandle} />
          <View style={themedStyles.modalHeader}>
            <Text style={themedStyles.modalTitle}>
              {t('forgotPassword.title')}
            </Text>
            <TouchableOpacity
              style={themedStyles.modalCloseButton}
              onPress={closeForgotPasswordModal}>
              <FontAwesomeIcon
                icon={faTimes}
                size={16}
                color={colors.secondaryText}
              />
            </TouchableOpacity>
          </View>

          {forgotPasswordSuccess ? (
            <View style={themedStyles.modalSuccessContainer}>
              <View style={themedStyles.modalSuccessIcon}>
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  size={28}
                  color="#4CAF50"
                />
              </View>
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
            <View style={themedStyles.modalBody}>
              <Text style={themedStyles.modalSubtitle}>
                {t('forgotPassword.subtitle')}
              </Text>

              {failedAttempts >= 3 && (
                <View style={themedStyles.failedAttemptsWarning}>
                  <FontAwesomeIcon
                    icon={faLock}
                    size={14}
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
                    size={16}
                    color={
                      focusedField === 'forgotEmail'
                        ? colors.primary
                        : colors.secondaryText
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
                  <FontAwesomeIcon
                    icon={faExclamationTriangle}
                    size={14}
                    color={colors.error}
                  />
                  <Text style={themedStyles.errorText}>
                    {forgotPasswordError}
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
                      size={16}
                      color={colors.buttonText}
                    />
                  </>
                )}
              </TouchableOpacity>
            </View>
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

      <View style={themedStyles.inputGroup}>
        <View
          style={[
            themedStyles.inputContainer,
            focusedField === 'loginUsername' &&
              themedStyles.inputContainerFocused,
          ]}>
          <FontAwesomeIcon
            icon={faUser}
            size={16}
            color={
              focusedField === 'loginUsername'
                ? colors.primary
                : colors.placeholder
            }
            style={themedStyles.inputIcon}
          />
          <TextInput
            style={themedStyles.input}
            placeholder={t('auth.username')}
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

      <View style={themedStyles.inputGroup}>
        <View
          style={[
            themedStyles.inputContainer,
            focusedField === 'loginPassword' &&
              themedStyles.inputContainerFocused,
          ]}>
          <FontAwesomeIcon
            icon={faLock}
            size={16}
            color={
              focusedField === 'loginPassword'
                ? colors.primary
                : colors.placeholder
            }
            style={themedStyles.inputIcon}
          />
          <TextInput
            style={themedStyles.input}
            placeholder={t('auth.password')}
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
              size={16}
              color={colors.placeholder}
            />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={themedStyles.forgotPasswordLink}
        onPress={() => setShowForgotPassword(true)}>
        <Text style={themedStyles.forgotPasswordText}>
          {t('auth.forgotPassword')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={themedStyles.primaryButton}
        onPress={handleLogin}>
        <Text style={themedStyles.primaryButtonText}>
          {t('landing.signIn')}
        </Text>
      </TouchableOpacity>

      {renderSocialButtons()}
      {renderModeSwitch()}
    </>
  );

  const renderRegisterForm = () => (
    <>
      <Text style={themedStyles.formTitle}>{t('auth.createAccount')}</Text>
      <Text style={themedStyles.formSubtitle}>
        {t('landing.joinBetterPlay')}
      </Text>

      {renderSocialButtons({leading: true})}

      <View style={themedStyles.inputGroup}>
        <View
          style={[
            themedStyles.inputContainer,
            focusedField === 'registerName' &&
              themedStyles.inputContainerFocused,
          ]}>
          <FontAwesomeIcon
            icon={faIdCard}
            size={16}
            color={
              focusedField === 'registerName'
                ? colors.primary
                : colors.placeholder
            }
            style={themedStyles.inputIcon}
          />
          <TextInput
            style={themedStyles.input}
            placeholder={t('landing.fullName')}
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

      <View style={themedStyles.inputGroup}>
        <View
          style={[
            themedStyles.inputContainer,
            focusedField === 'registerEmail' &&
              themedStyles.inputContainerFocused,
          ]}>
          <FontAwesomeIcon
            icon={faEnvelope}
            size={16}
            color={
              focusedField === 'registerEmail'
                ? colors.primary
                : colors.placeholder
            }
            style={themedStyles.inputIcon}
          />
          <TextInput
            style={themedStyles.input}
            placeholder={t('auth.email')}
            placeholderTextColor={colors.placeholder}
            value={registrationData.email}
            onChangeText={text =>
              setRegistrationData({...registrationData, email: text})
            }
            ref={registerEmailInputRef}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            secureTextEntry={false}
            onFocus={() => setFocusedField('registerEmail')}
            onBlur={() => setFocusedField(null)}
            returnKeyType="next"
            onSubmitEditing={() => registerUsernameInputRef.current?.focus()}
          />
        </View>
      </View>

      <View style={themedStyles.inputGroup}>
        <View
          style={[
            themedStyles.inputContainer,
            focusedField === 'registerUsername' &&
              themedStyles.inputContainerFocused,
          ]}>
          <FontAwesomeIcon
            icon={faUser}
            size={16}
            color={
              focusedField === 'registerUsername'
                ? colors.primary
                : colors.placeholder
            }
            style={themedStyles.inputIcon}
          />
          <TextInput
            style={themedStyles.input}
            placeholder={t('auth.username')}
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

      <View style={themedStyles.inputGroup}>
        <View
          style={[
            themedStyles.inputContainer,
            focusedField === 'registerPassword' &&
              themedStyles.inputContainerFocused,
          ]}>
          <FontAwesomeIcon
            icon={faLock}
            size={16}
            color={
              focusedField === 'registerPassword'
                ? colors.primary
                : colors.placeholder
            }
            style={themedStyles.inputIcon}
          />
          <TextInput
            style={themedStyles.input}
            placeholder={t('auth.password')}
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
              size={16}
              color={colors.placeholder}
            />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={themedStyles.primaryButton}
        onPress={handleRegistration}>
        <Text style={themedStyles.primaryButtonText}>
          {t('auth.createAccount')}
        </Text>
        <FontAwesomeIcon
          icon={faArrowRight}
          size={16}
          color={colors.buttonText}
        />
      </TouchableOpacity>

      {renderModeSwitch()}
    </>
  );

  return (
    <SafeAreaView style={themedStyles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={themedStyles.container}>
        <ScrollView
          contentContainerStyle={
            showAuthForm
              ? themedStyles.scrollContent
              : themedStyles.scrollContentGate
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {!showAuthForm ? (
            <>
              <View style={themedStyles.heroSectionGate}>
                <View style={themedStyles.brandRow}>
                  <View style={themedStyles.brandMark}>
                    <Text style={themedStyles.brandMarkText}>BP</Text>
                  </View>
                  <Text style={themedStyles.brandName}>BetterPlay</Text>
                </View>
                <Text style={themedStyles.appName}>
                  {t('landing.taglineMultiline')}
                </Text>
                <Text style={themedStyles.tagline}>
                  {t('landing.landingLede')}
                </Text>
              </View>

              <View>
                <View style={themedStyles.gateActions}>
                  <TouchableOpacity
                    style={themedStyles.primaryButton}
                    onPress={() => openAuthForm('login')}
                    activeOpacity={0.85}>
                    <Text style={themedStyles.primaryButtonText}>
                      {t('landing.signIn')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={themedStyles.gateSecondaryButton}
                    onPress={() => openAuthForm('register')}
                    activeOpacity={0.85}>
                    <FontAwesomeIcon
                      icon={faUserPlus}
                      size={15}
                      color={colors.text}
                    />
                    <Text style={themedStyles.gateSecondaryButtonText}>
                      {t('landing.createAccount')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={themedStyles.footer}>
                  <Text style={themedStyles.footerText}>
                    {t('landing.footerText')}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={themedStyles.authHeader}>
                <TouchableOpacity
                  style={themedStyles.backToBrand}
                  onPress={() => setShowAuthForm(false)}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                  <Text style={themedStyles.backToBrandText}>←</Text>
                </TouchableOpacity>
                <View style={themedStyles.authHeaderBrand}>
                  <View style={themedStyles.brandMarkCompact}>
                    <Text style={themedStyles.brandMarkText}>BP</Text>
                  </View>
                  <Text style={themedStyles.brandNameCompact}>BetterPlay</Text>
                </View>
                <View style={themedStyles.authHeaderSpacer} />
              </View>

              <View style={themedStyles.formCard}>
                {activeTab === 'login'
                  ? renderLoginForm()
                  : renderRegisterForm()}

                {errorMessage && (
                  <View style={themedStyles.errorContainer}>
                    <FontAwesomeIcon
                      icon={faExclamationTriangle}
                      size={14}
                      color={colors.error}
                    />
                    <Text style={themedStyles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {successMessage && (
                  <View style={themedStyles.successContainer}>
                    <FontAwesomeIcon
                      icon={faCheck}
                      size={14}
                      color={'#4CAF50'}
                    />
                    <Text style={themedStyles.successText}>
                      {successMessage}
                    </Text>
                  </View>
                )}
              </View>

              <View style={themedStyles.footer}>
                <Text style={themedStyles.footerText}>
                  {t('landing.footerText')}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      {renderForgotPasswordModal()}
      <LinkAccountModal
        visible={linkModalVisible}
        orphanToken={pendingSocial?.token || null}
        isPrivateRelay={pendingSocial?.isPrivateRelay}
        onCancel={() => {
          // Dismiss without keeping session — user can try again.
          setLinkModalVisible(false);
          setPendingSocial(null);
        }}
        onKeepNew={handleKeepNewSocialAccount}
        onLinked={handleLinkedSocialAccount}
      />
      <EditProfileModal
        visible={completeProfileVisible}
        required
        initialName={pendingCompleteProfile?.user?.name || ''}
        initialUsername={pendingCompleteProfile?.user?.username || ''}
        onCancel={() => {}}
        onSaved={finishCompleteProfile}
      />
    </SafeAreaView>
  );
}

export default LandingPage;
