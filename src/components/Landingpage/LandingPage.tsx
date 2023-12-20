import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
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
    Keyboard.dismiss();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <Text style={styles.title}>Welcome to Old Man Hockey!</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.loginButton}
          onPress={() => {
            setShowLoginForm(true);
            setShowRegisterForm(false);
            Keyboard.dismiss();
          }}>
          <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => {
            setShowLoginForm(false);
            setShowRegisterForm(true);
            Keyboard.dismiss();
          }}>
          <Text style={styles.buttonText}>Register</Text>
        </TouchableOpacity>
      </View>

      {showLoginForm && (
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={loginData.username}
            onChangeText={text => setLoginData({...loginData, username: text})}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={loginData.password}
            onChangeText={text => setLoginData({...loginData, password: text})}
          />
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => {
              handleLogin();
              dismissForms();
            }}>
            <Text style={styles.buttonText}>Login</Text>
          </TouchableOpacity>
        </View>
      )}

      {showRegisterForm && (
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Name"
            value={registrationData.name}
            onChangeText={text =>
              setRegistrationData({...registrationData, name: text})
            }
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={registrationData.email}
            onChangeText={text =>
              setRegistrationData({...registrationData, email: text})
            }
          />
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={registrationData.username}
            onChangeText={text =>
              setRegistrationData({...registrationData, username: text})
            }
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={registrationData.password}
            onChangeText={text =>
              setRegistrationData({...registrationData, password: text})
            }
          />
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => {
              handleRegistration();
              dismissForms();
            }}>
            <Text style={styles.buttonText}>Register</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

export default LandingPage;
