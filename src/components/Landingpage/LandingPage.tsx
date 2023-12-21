import React, {useState, useRef} from 'react';
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

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#02131D',
  },
  formContainer: {
    width: '50%',
    padding: 20,
    borderWidth: 1,
    borderRadius: 5,
    backgroundColor: '#f2f2f2',
  },
  title: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 100,
    color: '#447bbe',
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
    backgroundColor: '#447bbe',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerButton: {
    height: 35,
    width: 100,
    borderRadius: 10,
    backgroundColor: '#b11313',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#fff',
  },
});

function LandingPage() {
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

  const loginInputRef = useRef<TextInput>(null);

  const registerNameInputRef = useRef<TextInput>(null);
  const registerEmailInputRef = useRef<TextInput>(null);
  const registerUsernameInputRef = useRef<TextInput>(null);
  const registerPasswordInputRef = useRef<TextInput>(null);

  const handleRegistration = async () => {
    // Implement registration logic for React Native
  };

  const handleLogin = async () => {
    // Implement login logic for React Native
  };

  // Dismiss keyboard when user taps outside of a TextInput
  const dismissForms = () => {
    setShowLoginForm(false);
    setShowRegisterForm(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <TouchableWithoutFeedback onPress={dismissForms}>
        <View style={styles.container}>
          <Text style={styles.title}>Welcome to Old Man Hockey!</Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => {
                setShowLoginForm(true);
                setShowRegisterForm(false);
                if (loginInputRef.current) {
                  loginInputRef.current.focus();
                }
              }}>
              <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => {
                setShowLoginForm(false);
                setShowRegisterForm(true);
                if (registerNameInputRef.current) {
                  registerNameInputRef.current.focus();
                }
              }}>
              <Text style={styles.buttonText}>Register</Text>
            </TouchableOpacity>
          </View>

          {showLoginForm && (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Username"
                value={loginData.username}
                onChangeText={text =>
                  setLoginData({...loginData, username: text})
                }
                ref={loginInputRef}
                autoFocus={true}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry
                value={loginData.password}
                onChangeText={text =>
                  setLoginData({...loginData, password: text})
                }
                ref={loginInputRef}
              />
              <TouchableOpacity
                style={styles.loginButton}
                onPress={() => {
                  handleLogin();
                }}>
                <Text style={styles.buttonText}>Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {showRegisterForm && (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Name"
                value={registrationData.name}
                onChangeText={text =>
                  setRegistrationData({...registrationData, name: text})
                }
                ref={registerNameInputRef}
                autoFocus={true}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={registrationData.email}
                onChangeText={text =>
                  setRegistrationData({...registrationData, email: text})
                }
                ref={registerEmailInputRef}
              />
              <TextInput
                style={styles.input}
                placeholder="Username"
                value={registrationData.username}
                onChangeText={text =>
                  setRegistrationData({...registrationData, username: text})
                }
                ref={registerUsernameInputRef}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry
                value={registrationData.password}
                onChangeText={text =>
                  setRegistrationData({...registrationData, password: text})
                }
                ref={registerPasswordInputRef}
              />
              <TouchableOpacity
                style={styles.registerButton}
                onPress={() => {
                  handleRegistration();
                }}>
                <Text style={styles.buttonText}>Register</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

export default LandingPage;
