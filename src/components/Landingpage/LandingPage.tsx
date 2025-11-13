import React, {useState, useRef, useEffect, useContext, useMemo} from 'react';
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

  // Theme
  const {colors} = useTheme();
  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        },
        title: {
          textAlign: 'center',
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 20,
          marginTop: 100,
          color: colors.primary,
        },
        buttonContainer: {
          flexDirection: 'row',
          justifyContent: 'center',
          marginBottom: 20,
        },
        loginButton: {
          marginRight: 10,
          height: 35,
          width: 100,
          borderRadius: 10,
          backgroundColor: colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
        },
        registerButton: {
          height: 35,
          width: 100,
          borderRadius: 10,
          backgroundColor: colors.border,
          justifyContent: 'center',
          alignItems: 'center',
        },
        loginCancelButton: {
          height: 35,
          width: 100,
          justifyContent: 'center',
          alignItems: 'center',
        },
        registerCancelButton: {
          height: 35,
          width: 100,
          justifyContent: 'center',
          alignItems: 'center',
        },
        buttonText: {
          color: colors.text,
          fontSize: 16,
          fontWeight: 'bold',
        },
        input: {
          height: 40,
          borderColor: colors.border,
          borderWidth: 1,
          marginBottom: 10,
          padding: 10,
          backgroundColor: colors.card,
          color: colors.text,
        },
        errorMessage: {
          color: colors.text,
          marginTop: 10,
        },
        successMessage: {
          color: colors.primary,
          marginTop: 10,
        },
      }),
    [colors],
  );

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

  // Error messages
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
      loginUsernameInputRef.current?.focus();
    }
    if (showRegisterForm) {
      registerNameInputRef.current?.focus();
    }
  }, [showLoginForm, showRegisterForm]);

  const handleRegistration = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
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
        if (responseData.message?.includes('Email already in use')) {
          setErrorMessage('Email already in use. Please use another email.');
        } else {
          setErrorMessage(responseData.message);
        }
        setSuccessMessage(null);
      }
    } catch (error) {
      console.error('Error during registration:', error as Error);
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
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(loginData),
      });
      const responseData = await response.json();

      if (responseData.success) {
        setUserData(responseData.user);
        if (!responseData.token) {
          console.error('No token in response', responseData);
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
      console.error('Error during login:', error);
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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 130 : 0}
      style={themedStyles.container}>
      <TouchableWithoutFeedback onPress={dismissForms}>
        <View style={themedStyles.container}>
          <Text style={themedStyles.title}>Welcome!</Text>
          <View style={themedStyles.buttonContainer}>
            <TouchableOpacity
              style={themedStyles.loginButton}
              onPress={() => {
                setShowLoginForm(true);
                setShowRegisterForm(false);
              }}>
              <Text style={themedStyles.buttonText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={themedStyles.registerButton}
              onPress={() => {
                setShowLoginForm(false);
                setShowRegisterForm(true);
              }}>
              <Text style={themedStyles.buttonText}>Register</Text>
            </TouchableOpacity>
          </View>

          {showLoginForm && (
            <View>
              <TextInput
                style={themedStyles.input}
                placeholder="Username"
                placeholderTextColor={colors.text}
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
                placeholderTextColor={colors.text}
                secureTextEntry
                value={loginData.password}
                onChangeText={text =>
                  setLoginData({...loginData, password: text})
                }
                ref={loginPasswordInputRef}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={themedStyles.loginButton}
                onPress={handleLogin}>
                <Text style={themedStyles.buttonText}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={themedStyles.loginCancelButton}
                onPress={cancelForm}>
                <Text style={themedStyles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {showRegisterForm && (
            <View>
              <TextInput
                style={themedStyles.input}
                placeholder="Name"
                placeholderTextColor={colors.text}
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
                placeholderTextColor={colors.text}
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
                placeholderTextColor={colors.text}
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
                placeholderTextColor={colors.text}
                secureTextEntry
                value={registrationData.password}
                onChangeText={text =>
                  setRegistrationData({...registrationData, password: text})
                }
                ref={registerPasswordInputRef}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={themedStyles.registerButton}
                onPress={handleRegistration}>
                <Text style={themedStyles.buttonText}>Register</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={themedStyles.registerCancelButton}
                onPress={cancelForm}>
                <Text style={themedStyles.buttonText}>Cancel</Text>
              </TouchableOpacity>
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
