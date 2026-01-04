import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import {useTranslation} from 'react-i18next';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faEye, faEyeSlash} from '@fortawesome/free-solid-svg-icons';

interface ResetPasswordProps {
  route: {
    params: {
      token: string;
    };
  };
  navigation: any;
}

const ResetPassword: React.FC<ResetPasswordProps> = ({route, navigation}) => {
  const token = route?.params?.token || '';
  const {colors} = useTheme();
  const {t} = useTranslation();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validatePassword = (): boolean => {
    if (newPassword.length < 8) {
      Alert.alert(
        t('resetPassword.error'),
        t('resetPassword.passwordTooShort'),
      );
      return false;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(
        t('resetPassword.error'),
        t('resetPassword.passwordMismatch'),
      );
      return false;
    }
    return true;
  };

  const handleResetPassword = async () => {
    if (!validatePassword()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setIsSuccess(true);
        Alert.alert(
          t('resetPassword.success'),
          t('resetPassword.successMessage'),
          [
            {
              text: t('common.ok'),
              onPress: () => navigation.navigate('LandingPage'),
            },
          ],
        );
      } else {
        Alert.alert(
          t('resetPassword.error'),
          data.message || t('resetPassword.genericError'),
        );
      }
    } catch (error) {
      console.error('Reset password error:', error);
      Alert.alert(t('resetPassword.error'), t('resetPassword.networkError'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, {backgroundColor: colors?.background}]}>
      <View style={styles.content}>
        <Text style={[styles.title, {color: colors?.text}]}>
          {t('resetPassword.title')}
        </Text>
        <Text style={[styles.subtitle, {color: colors?.placeholder}]}>
          {t('resetPassword.subtitle')}
        </Text>

        <View style={[styles.inputContainer, {borderColor: colors?.border}]}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors?.inputBackground,
                color: colors?.text,
              },
            ]}
            placeholder={t('resetPassword.newPassword')}
            placeholderTextColor={colors?.placeholder}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
            editable={!isSuccess}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowNewPassword(!showNewPassword)}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <FontAwesomeIcon
              icon={showNewPassword ? faEyeSlash : faEye}
              size={18}
              color={colors?.placeholder}
            />
          </TouchableOpacity>
        </View>

        <View style={[styles.inputContainer, {borderColor: colors?.border}]}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors?.inputBackground,
                color: colors?.text,
              },
            ]}
            placeholder={t('resetPassword.confirmPassword')}
            placeholderTextColor={colors?.placeholder}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            editable={!isSuccess}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <FontAwesomeIcon
              icon={showConfirmPassword ? faEyeSlash : faEye}
              size={18}
              color={colors?.placeholder}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            {backgroundColor: colors?.primary},
            (isLoading || isSuccess) && styles.buttonDisabled,
          ]}
          onPress={handleResetPassword}
          disabled={isLoading || isSuccess}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isSuccess
                ? t('resetPassword.passwordReset')
                : t('resetPassword.resetButton')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('LandingPage')}>
          <Text style={[styles.backButtonText, {color: colors?.primary}]}>
            {t('resetPassword.backToLogin')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: 'transparent',
  },
  eyeButton: {
    paddingHorizontal: 15,
    height: 50,
    justifyContent: 'center',
  },
  button: {
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
  },
});

export default ResetPassword;
