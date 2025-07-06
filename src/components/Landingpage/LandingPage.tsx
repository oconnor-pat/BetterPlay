import React, {useState, useRef, useEffect, useContext} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import {NavigationProp, useNavigation} from '@react-navigation/native';
import UserContext from '../UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {API_BASE_URL} from '../../config/api';
import {useTheme} from '../ThemeContext/ThemeContext';

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

  // Theme context
  const {colors} = useTheme();

  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
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

  //Error messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loginUsernameInputRef = useRef<TextInput>(null);
  const loginPasswordInputRef = useRef<TextInput>(null);

  const registerNameInputRef = useRef<TextInput>(null);
  const registerEmailInputRef = useRef<TextInput>(null);
  const registerUsernameInputRef = useRef<TextInput>(null);
  const registerPasswordInputRef = useRef<TextInput>(null);

  // Process login and registration
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  // Reset form states when navigating away from this screen
  useEffect(() => {
    setShowLoginForm(false);
    setShowRegisterForm(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, [navigation]);

  useEffect(() => {
    if (showLoginForm) {
      if (loginUsernameInputRef.current) {
        loginUsernameInputRef.current.focus();
      }
    }
    if (showRegisterForm) {
      if (registerNameInputRef.current) {
        registerNameInputRef.current.focus();
      }
    }
  }, [showLoginForm, showRegisterForm]);

  const handleRegistration = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const responseData = await response.json();

      if (responseData.success) {
        await AsyncStorage.setItem('userToken', responseData.token);

        setSuccessMessage('User created successfully!');
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
        if (responseData.message.includes('Email already in use')) {
          setErrorMessage('Email already in use. Please use another email.');
        } else {
          setErrorMessage(responseData.message);
        }
        setSuccessMessage(null);
      }
    } catch (error) {
      setErrorMessage('Failed to create new user. Please try again.');
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
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData),
      });

      const responseData = await response.json();

      if (responseData.success) {
        setUserData(responseData.user);
        if (!responseData.token) {
          return;
        }
        await AsyncStorage.setItem('userToken', responseData.token);

        setSuccessMessage('User logged in successfully!');
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
        setErrorMessage(
          responseData.message || 'Failed to log in. Please try again.',
        );
        setSuccessMessage(null);
      }
    } catch (error) {
      setErrorMessage('Failed to log in. Please try again.');
      setSuccessMessage(null);
    }
  };

  const dismissForms = () => {
    setShowLoginForm(false);
    setShowRegisterForm(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const cancelForm = () => {
    setShowLoginForm(false);
    setShowRegisterForm(false);
    setLoginData({username: '', password: ''});
    setRegistrationData({name: '', email: '', username: '', password: ''});
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Themed styles using theme context colors
  const themedStyles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    card: {
      width: '98%',
      maxWidth: 600,
      minWidth: 320,
      paddingHorizontal: 40,
      paddingVertical: 24,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      shadowColor: colors.text,
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
      marginVertical: 16,
      alignSelf: 'center',
    },
    cardTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.primary,
      marginBottom: 18,
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    input: {
      height: 44,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      marginBottom: 14,
      paddingHorizontal: 12,
      backgroundColor: colors.inputBackground || '#A9A9A9',
      color: colors.text,
      fontSize: 16,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'center', // Center the buttons
      alignItems: 'center',
      marginTop: 10,
      marginBottom: 4,
    },
    button: {
      height: 44,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 16, // Add horizontal margin for spacing
      backgroundColor: colors.primary,
      minWidth: 120,
      maxWidth: 200,
      paddingHorizontal: 24, // Ensure button is wide enough
    },
    buttonAlt: {
      backgroundColor: colors.error || '#b11313',
    },
    buttonText: {
      color: colors.buttonText || '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      marginTop: 12,
    },
    switchButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 8,
      marginHorizontal: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    switchButtonActive: {
      backgroundColor: colors.primary,
    },
    switchButtonText: {
      color: colors.primary,
      fontWeight: 'bold',
      fontSize: 16,
    },
    switchButtonTextActive: {
      color: colors.buttonText || '#fff',
    },
    errorMessage: {
      color: colors.error || '#b11313',
      marginTop: 10,
      textAlign: 'center',
    },
    successMessage: {
      color: colors.primary,
      marginTop: 10,
      textAlign: 'center',
    },
    title: {
      textAlign: 'center',
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 12,
      marginTop: 60,
      color: colors.primary,
      letterSpacing: 1,
    },
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 130 : 0}
      style={themedStyles.container}>
      <TouchableWithoutFeedback onPress={dismissForms}>
        <View style={themedStyles.container}>
          <Text style={themedStyles.title}>Welcome!</Text>
          <View style={themedStyles.switchRow}>
            <TouchableOpacity
              style={[
                themedStyles.switchButton,
                showLoginForm && themedStyles.switchButtonActive,
              ]}
              onPress={() => {
                setShowLoginForm(true);
                setShowRegisterForm(false);
              }}>
              <Text
                style={[
                  themedStyles.switchButtonText,
                  showLoginForm && themedStyles.switchButtonTextActive,
                ]}>
                Login
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                themedStyles.switchButton,
                showRegisterForm && themedStyles.switchButtonActive,
              ]}
              onPress={() => {
                setShowLoginForm(false);
                setShowRegisterForm(true);
              }}>
              <Text
                style={[
                  themedStyles.switchButtonText,
                  showRegisterForm && themedStyles.switchButtonTextActive,
                ]}>
                Register
              </Text>
            </TouchableOpacity>
          </View>

          {showLoginForm && (
            <View style={themedStyles.card}>
              <Text style={themedStyles.cardTitle}>Login</Text>
              <TextInput
                style={themedStyles.input}
                placeholder="Username"
                placeholderTextColor={colors.placeholder || '#888'}
                value={loginData.username}
                onChangeText={text =>
                  setLoginData({...loginData, username: text})
                }
                ref={loginUsernameInputRef}
                autoCapitalize="none"
              />
              <TextInput
                style={themedStyles.input}
                placeholder="Password"
                placeholderTextColor={colors.placeholder || '#888'}
                secureTextEntry
                value={loginData.password}
                onChangeText={text =>
                  setLoginData({...loginData, password: text})
                }
                ref={loginPasswordInputRef}
                autoCapitalize="none"
              />
              <View style={themedStyles.buttonRow}>
                <TouchableOpacity
                  style={themedStyles.button}
                  onPress={handleLogin}>
                  <Text style={themedStyles.buttonText}>Login</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[themedStyles.button, themedStyles.buttonAlt]}
                  onPress={cancelForm}>
                  <Text style={themedStyles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {showRegisterForm && (
            <View style={themedStyles.card}>
              <Text style={themedStyles.cardTitle}>Register</Text>
              <TextInput
                style={themedStyles.input}
                placeholder="Name"
                placeholderTextColor={colors.placeholder || '#888'}
                value={registrationData.name}
                onChangeText={text =>
                  setRegistrationData({...registrationData, name: text})
                }
                ref={registerNameInputRef}
                autoCapitalize="none"
              />
              <TextInput
                style={themedStyles.input}
                placeholder="Email"
                placeholderTextColor={colors.placeholder || '#888'}
                value={registrationData.email}
                onChangeText={text =>
                  setRegistrationData({...registrationData, email: text})
                }
                ref={registerEmailInputRef}
                autoCapitalize="none"
              />
              <TextInput
                style={themedStyles.input}
                placeholder="Username"
                placeholderTextColor={colors.placeholder || '#888'}
                value={registrationData.username}
                onChangeText={text =>
                  setRegistrationData({...registrationData, username: text})
                }
                ref={registerUsernameInputRef}
                autoCapitalize="none"
              />
              <TextInput
                style={themedStyles.input}
                placeholder="Password"
                placeholderTextColor={colors.placeholder || '#888'}
                secureTextEntry
                value={registrationData.password}
                onChangeText={text =>
                  setRegistrationData({...registrationData, password: text})
                }
                ref={registerPasswordInputRef}
                autoCapitalize="none"
              />
              <View style={themedStyles.buttonRow}>
                <TouchableOpacity
                  style={themedStyles.button}
                  onPress={handleRegistration}>
                  <Text style={themedStyles.buttonText}>Register</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[themedStyles.button, themedStyles.buttonAlt]}
                  onPress={cancelForm}>
                  <Text style={themedStyles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          {errorMessage && (
            <Text style={themedStyles.errorMessage}>{errorMessage}</Text>
          )}
          {successMessage && (
            <Text style={themedStyles.successMessage}>{successMessage}</Text>
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

export default LandingPage;
