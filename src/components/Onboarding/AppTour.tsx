import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faCalendarAlt,
  faBuilding,
  faUserGroup,
  faComments,
  faPlus,
  faClipboardList,
} from '@fortawesome/free-solid-svg-icons';
import {useTheme} from '../ThemeContext/ThemeContext';
import {useTranslation} from 'react-i18next';
import analyticsService from '../../services/AnalyticsService';

export const APP_TOUR_VERSION = '1';
export const APP_TOUR_STORAGE_KEY = `hasSeenAppTour_v${APP_TOUR_VERSION}`;

type Props = {
  visible: boolean;
  onDone: () => void;
  /** Lighter host-focused steps when posting as a venue. */
  variant?: 'consumer' | 'venue';
};

type TourStep = {
  id: string;
  icon: typeof faCalendarAlt;
  titleKey: string;
  bodyKey: string;
  titleFallback: string;
  bodyFallback: string;
};

const CONSUMER_STEPS: TourStep[] = [
  {
    id: 'events',
    icon: faCalendarAlt,
    titleKey: 'tour.eventsTitle',
    bodyKey: 'tour.eventsBody',
    titleFallback: 'Events feed',
    bodyFallback:
      'Browse nearby hangs and official venue nights. Filter, watch, and jump into a roster.',
  },
  {
    id: 'venues',
    icon: faBuilding,
    titleKey: 'tour.venuesTitle',
    bodyKey: 'tour.venuesBody',
    titleFallback: 'Venues',
    bodyFallback:
      'Discover places around you and plan a night at a real spot — or join an official venue post.',
  },
  {
    id: 'groups',
    icon: faUserGroup,
    titleKey: 'tour.groupsTitle',
    bodyKey: 'tour.groupsBody',
    titleFallback: 'Groups',
    bodyFallback:
      'Keep a crew together with group chat and invite the whole group to an event in one tap.',
  },
  {
    id: 'messages',
    icon: faComments,
    titleKey: 'tour.messagesTitle',
    bodyKey: 'tour.messagesBody',
    titleFallback: 'Messages',
    bodyFallback: 'DM hosts and friends when you need details before you show up.',
  },
  {
    id: 'create',
    icon: faPlus,
    titleKey: 'tour.createTitle',
    bodyKey: 'tour.createBody',
    titleFallback: 'Create a plan',
    bodyFallback:
      'Tap + to post a hang: place, time, spots, privacy, and optional group invite.',
  },
  {
    id: 'roster',
    icon: faClipboardList,
    titleKey: 'tour.rosterTitle',
    bodyKey: 'tour.rosterBody',
    titleFallback: 'Rosters',
    bodyFallback:
      'See who’s going, request to join, and manage roles when you’re the host.',
  },
];

const VENUE_STEPS: TourStep[] = [
  {
    id: 'venue-nights',
    icon: faBuilding,
    titleKey: 'tour.venueNightsTitle',
    bodyKey: 'tour.venueNightsBody',
    titleFallback: 'Post official nights',
    bodyFallback:
      'Your posts show as Official venue nights in the Events feed for locals to discover.',
  },
  {
    id: 'venue-admins',
    icon: faUserGroup,
    titleKey: 'tour.venueAdminsTitle',
    bodyKey: 'tour.venueAdminsBody',
    titleFallback: 'Invite staff',
    bodyFallback:
      'Add managers from Venue staff so they post with their own logins — as your brand.',
  },
  {
    id: 'venue-roster',
    icon: faClipboardList,
    titleKey: 'tour.venueRosterTitle',
    bodyKey: 'tour.venueRosterBody',
    titleFallback: 'Run the night',
    bodyFallback:
      'Open a night’s roster to approve joins, message guests, and keep the room full.',
  },
];

const {width: SCREEN_W} = Dimensions.get('window');

/**
 * Replayable product tour — step cards with light motion.
 * Separate from permission OnboardingModal.
 */
const AppTour: React.FC<Props> = ({visible, onDone, variant = 'consumer'}) => {
  const {colors} = useTheme();
  const {t} = useTranslation();
  const steps = variant === 'venue' ? VENUE_STEPS : CONSUMER_STEPS;
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setIndex(0);
      analyticsService.trackOnboardingStep(`tour_${variant}_start`).catch(() => {});
    }
  }, [visible, variant]);

  const step = steps[index];

  const animateTo = (next: number) => {
    Animated.parallel([
      Animated.timing(fade, {toValue: 0, duration: 120, useNativeDriver: true}),
      Animated.timing(slide, {
        toValue: -24,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIndex(next);
      slide.setValue(24);
      Animated.parallel([
        Animated.timing(fade, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const finish = () => {
    analyticsService.trackOnboardingStep(`tour_${variant}_complete`).catch(() => {});
    analyticsService.trackOnboardingComplete().catch(() => {});
    onDone();
  };

  const goNext = () => {
    analyticsService.trackOnboardingStep(`tour_${step.id}`).catch(() => {});
    if (index >= steps.length - 1) {
      finish();
      return;
    }
    animateTo(index + 1);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: colors.card || colors.background,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingHorizontal: 22,
          paddingTop: 16,
          paddingBottom: 28,
          minHeight: 340,
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
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: colors.inputBackground,
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
          marginBottom: 20,
        },
        dots: {
          flexDirection: 'row',
          gap: 6,
          marginBottom: 18,
        },
        dot: {
          width: 7,
          height: 7,
          borderRadius: 4,
          backgroundColor: colors.border,
        },
        dotActive: {
          backgroundColor: colors.primary,
          width: 18,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        },
        secondary: {
          flex: 1,
          paddingVertical: 14,
          alignItems: 'center',
        },
        secondaryText: {
          color: colors.secondaryText,
          fontWeight: '600',
          fontSize: 15,
        },
        primary: {
          flex: 1.4,
          backgroundColor: colors.primary,
          borderRadius: 24,
          paddingVertical: 14,
          alignItems: 'center',
        },
        primaryText: {
          color: colors.buttonText || '#fff',
          fontWeight: '700',
          fontSize: 16,
        },
        card: {
          width: SCREEN_W - 44,
        },
      }),
    [colors],
  );

  if (!step) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={finish}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <Animated.View
              style={[
                styles.card,
                {opacity: fade, transform: [{translateX: slide}]},
              ]}>
              <View style={styles.iconWrap}>
                <FontAwesomeIcon
                  icon={step.icon}
                  size={22}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.title}>
                {t(step.titleKey, {defaultValue: step.titleFallback})}
              </Text>
              <Text style={styles.body}>
                {t(step.bodyKey, {defaultValue: step.bodyFallback})}
              </Text>
            </Animated.View>
          </ScrollView>
          <View style={styles.dots}>
            {steps.map((s, i) => (
              <View
                key={s.id}
                style={[styles.dot, i === index && styles.dotActive]}
              />
            ))}
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.secondary} onPress={finish}>
              <Text style={styles.secondaryText}>
                {t('tour.skip', {defaultValue: 'Skip'})}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primary} onPress={goNext}>
              <Text style={styles.primaryText}>
                {index >= steps.length - 1
                  ? t('tour.done', {defaultValue: 'Got it'})
                  : t('tour.next', {defaultValue: 'Next'})}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default AppTour;
