import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import type {StackScreenProps} from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import {useTranslation} from 'react-i18next';
import analyticsService from '../../services/AnalyticsService';
import UserContext from '../UserContext';

type VerifyEmailProps = StackScreenProps<
  {VerifyEmail: {token: string}},
  'VerifyEmail'
>;

const VerifyEmail: React.FC<VerifyEmailProps> = ({route, navigation}) => {
  const token = route?.params?.token || '';
  const {colors} = useTheme();
  const {t} = useTranslation();
  const userContext = React.useContext(UserContext);

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      if (!token) {
        setStatus('error');
        setMessage(
          t('auth.verifyMissingToken') ||
            'This verification link is missing a token.',
        );
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({token}),
        });
        const data = await response.json();
        if (cancelled) {
          return;
        }
        if (data.success) {
          setStatus('success');
          setMessage(
            t('auth.verifySuccess') || 'Your email is verified. You’re all set.',
          );
          analyticsService.trackEmailVerified().catch(() => {});
          if (data.user) {
            const cached = await AsyncStorage.getItem('cachedUserData');
            const merged = {
              ...(cached ? JSON.parse(cached) : {}),
              ...data.user,
              emailVerified: true,
            };
            await AsyncStorage.setItem(
              'cachedUserData',
              JSON.stringify(merged),
            );
            userContext?.setUserData(prev =>
              prev ? {...prev, emailVerified: true} : prev,
            );
          }
        } else {
          setStatus('error');
          setMessage(
            data.message ||
              t('auth.verifyFailed') ||
              'Could not verify this email link.',
          );
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage(
            t('auth.verifyNetworkError') ||
              'Network error. Please try again later.',
          );
        }
      }
    };
    verify();
    return () => {
      cancelled = true;
    };
  }, [token, t, userContext]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    body: {
      fontSize: 15,
      color: colors.secondaryText,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 24,
    },
    button: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 12,
    },
    buttonText: {
      color: colors.buttonText || '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
  });

  return (
    <View style={styles.container}>
      {status === 'loading' ? (
        <>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.body, {marginTop: 16}]}>
            {t('auth.verifyingEmail') || 'Verifying your email…'}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.title}>
            {status === 'success'
              ? t('auth.emailVerifiedTitle') || 'Email verified'
              : t('auth.verifyFailedTitle') || 'Verification failed'}
          </Text>
          <Text style={styles.body}>{message}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('LandingPage' as never);
              }
            }}>
            <Text style={styles.buttonText}>
              {t('common.continue') || 'Continue'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

export default VerifyEmail;
