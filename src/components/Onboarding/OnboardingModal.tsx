import React, {useState} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faMapMarkerAlt,
  faBell,
  faCalendarPlus,
} from '@fortawesome/free-solid-svg-icons';
import {useTheme} from '../ThemeContext/ThemeContext';
import {useTranslation} from 'react-i18next';
import locationService from '../../services/LocationService';
import analyticsService from '../../services/AnalyticsService';
import {API_BASE_URL} from '../../config/api';
import {useNotifications} from '../../Context/NotificationContext';

type Props = {
  visible: boolean;
  onDone: () => void;
};

const STEPS = ['welcome', 'location', 'notifications'] as const;

/**
 * One-time first-run coach marks: welcome → location → notifications.
 * Kept lightweight so beta/store users learn the app without a long tutorial.
 */
const OnboardingModal: React.FC<Props> = ({visible, onDone}) => {
  const {colors} = useTheme();
  const {t} = useTranslation();
  const {requestPermission, checkPermission} = useNotifications();
  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const step = STEPS[stepIndex];

  const finish = async () => {
    analyticsService.trackOnboardingComplete().catch(() => {});
    onDone();
    setStepIndex(0);
  };

  const goNext = () => {
    if (stepIndex >= STEPS.length - 1) {
      finish();
      return;
    }
    setStepIndex(i => i + 1);
  };

  const requestLocation = async () => {
    setBusy(true);
    try {
      const granted = await locationService.requestPermission();
      analyticsService.trackOnboardingStep('location').catch(() => {});
      if (granted) {
        // Settings / Nearby gate on this app preference separately from the
        // OS permission dialog — keep them in sync after onboarding.
        await AsyncStorage.setItem('locationEnabled', JSON.stringify(true));
        try {
          const coords = await locationService.getCurrentPosition();
          const token = await AsyncStorage.getItem('userToken');
          if (token && coords) {
            await fetch(`${API_BASE_URL}/users/me/location`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                latitude: coords.latitude,
                longitude: coords.longitude,
              }),
            });
          }
        } catch {
          // Permission alone is enough for the Settings toggle; sync is best-effort.
        }
      }
    } catch {
      // Permission denial is fine — discovery still works with search.
    } finally {
      setBusy(false);
      goNext();
    }
  };

  const requestNotifications = async () => {
    setBusy(true);
    try {
      // Go through NotificationContext so Settings status updates immediately.
      await requestPermission();
      analyticsService.trackOnboardingStep('notifications').catch(() => {});
    } catch {
      // Optional
    } finally {
      await checkPermission().catch(() => {});
      setBusy(false);
      finish();
    }
  };

  const copy =
    step === 'welcome'
      ? {
          icon: faCalendarPlus,
          title:
            t('onboarding.welcomeTitle') || 'Welcome to BetterPlay',
          body:
            t('onboarding.welcomeBody') ||
            'Find local nights, rally your crew, and show up. Here’s a quick setup.',
          primary: t('common.continue') || 'Continue',
          secondary: null as string | null,
          onPrimary: () => {
            analyticsService.trackOnboardingStep('welcome').catch(() => {});
            goNext();
          },
        }
      : step === 'location'
        ? {
            icon: faMapMarkerAlt,
            title:
              t('onboarding.locationTitle') || 'Find things near you',
            body:
              t('onboarding.locationBody') ||
              'Allow location so we can suggest nearby venues and events. You can change this anytime in Settings.',
            primary: t('onboarding.enableLocation') || 'Enable location',
            secondary: t('onboarding.notNow') || 'Not now',
            onPrimary: requestLocation,
          }
        : {
            icon: faBell,
            title:
              t('onboarding.notificationsTitle') || 'Stay in the loop',
            body:
              t('onboarding.notificationsBody') ||
              'Get notified when friends invite you, spots open up, or a night is about to start.',
            primary:
              t('onboarding.enableNotifications') || 'Enable notifications',
            secondary: t('onboarding.notNow') || 'Not now',
            onPrimary: requestNotifications,
          };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.card || colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 18,
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      backgroundColor: colors.primary + '22',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.secondaryText,
      marginBottom: 22,
    },
    dots: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 18,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
    },
    dotActive: {
      backgroundColor: colors.primary,
      width: 18,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      opacity: busy ? 0.7 : 1,
    },
    primaryText: {
      color: colors.buttonText || '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
    secondaryBtn: {
      marginTop: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    secondaryText: {
      color: colors.secondaryText,
      fontWeight: '600',
      fontSize: 15,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={finish}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={STEPS[i]}
                style={[styles.dot, i === stepIndex && styles.dotActive]}
              />
            ))}
          </View>
          <View style={styles.iconWrap}>
            <FontAwesomeIcon
              icon={copy.icon}
              size={22}
              color={colors.primary}
            />
          </View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            disabled={busy}
            onPress={copy.onPrimary}
            activeOpacity={0.85}>
            <Text style={styles.primaryText}>{copy.primary}</Text>
          </TouchableOpacity>
          {copy.secondary ? (
            <TouchableOpacity
              style={styles.secondaryBtn}
              disabled={busy}
              onPress={step === 'location' ? goNext : finish}>
              <Text style={styles.secondaryText}>{copy.secondary}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

export default OnboardingModal;
