import React, {useState, useEffect, useRef} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTheme, ThemeColors} from '../ThemeContext/ThemeContext';

interface CountdownTimerProps {
  eventDate: string;
  eventTime: string;
}

const parseEventDateTime = (
  eventDate: string,
  eventTime: string,
): Date | null => {
  let cleanDate = eventDate.replace(/^[A-Za-z]{3}\s+/, '');
  let eventDateTime: Date | null = null;

  const monthDayYearMatch = cleanDate.match(
    /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/,
  );
  if (monthDayYearMatch) {
    const [, month, day, year] = monthDayYearMatch;
    eventDateTime = new Date(`${month} ${day}, ${year}`);
  }

  if (!eventDateTime || isNaN(eventDateTime.getTime())) {
    eventDateTime = new Date(cleanDate);
  }

  if (!eventDateTime || isNaN(eventDateTime.getTime())) {
    eventDateTime = new Date(eventDate);
  }

  if (!eventDateTime || isNaN(eventDateTime.getTime())) {
    return null;
  }

  let hours = 0;
  let minutes = 0;
  const timeMatch = eventTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3]?.toUpperCase();
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
  }

  eventDateTime.setHours(hours, minutes, 0, 0);
  return eventDateTime;
};

type CountdownState =
  | {status: 'upcoming'; days: number; hours: number; minutes: number; seconds: number; urgent: boolean}
  | {status: 'live'}
  | {status: 'past'}
  | {status: 'invalid'};

const getCountdown = (eventDate: string, eventTime: string): CountdownState => {
  const target = parseEventDateTime(eventDate, eventTime);
  if (!target) {
    return {status: 'invalid'};
  }

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs < 0) {
    const hoursPast = Math.abs(diffMs) / (1000 * 60 * 60);
    if (hoursPast < 3) {
      return {status: 'live'};
    }
    return {status: 'past'};
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const urgent = days === 0 && hours < 2;

  return {status: 'upcoming', days, hours, minutes, seconds, urgent};
};

const CountdownTimer: React.FC<CountdownTimerProps> = ({
  eventDate,
  eventTime,
}) => {
  const {colors} = useTheme();
  const styles = themedStyles(colors);
  const [countdown, setCountdown] = useState<CountdownState>(() =>
    getCountdown(eventDate, eventTime),
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setCountdown(getCountdown(eventDate, eventTime));

    intervalRef.current = setInterval(() => {
      const next = getCountdown(eventDate, eventTime);
      setCountdown(next);
      if (next.status === 'past') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [eventDate, eventTime]);

  if (countdown.status === 'invalid' || countdown.status === 'past') {
    return null;
  }

  if (countdown.status === 'live') {
    return (
      <View style={[styles.container, styles.liveContainer]}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>Happening Now</Text>
      </View>
    );
  }

  const {days, hours, minutes, seconds, urgent} = countdown;

  const formatUnit = (value: number): string =>
    value.toString().padStart(2, '0');

  let label: string;
  if (days > 0) {
    label =
      days === 1
        ? `1 day ${formatUnit(hours)}h ${formatUnit(minutes)}m`
        : `${days} days ${formatUnit(hours)}h ${formatUnit(minutes)}m`;
  } else {
    label = `${formatUnit(hours)}:${formatUnit(minutes)}:${formatUnit(seconds)}`;
  }

  return (
    <View
      style={[
        styles.container,
        urgent ? styles.urgentContainer : styles.normalContainer,
      ]}>
      <Text style={styles.timerIcon}>⏱️</Text>
      <Text
        style={[styles.timerText, urgent && styles.urgentText]}
        numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
};

const themedStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      alignSelf: 'flex-start',
      marginTop: 4,
      marginBottom: 2,
    },
    normalContainer: {
      backgroundColor: colors.primary + '18',
    },
    urgentContainer: {
      backgroundColor: colors.error + '18',
    },
    liveContainer: {
      backgroundColor: colors.success + '18',
    },
    timerIcon: {
      fontSize: 14,
      marginRight: 6,
    },
    timerText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
      fontVariant: ['tabular-nums'],
      letterSpacing: 0.3,
    },
    urgentText: {
      color: colors.error,
    },
    liveText: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.success,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.success,
      marginRight: 6,
    },
  });

export {parseEventDateTime};
export default CountdownTimer;
