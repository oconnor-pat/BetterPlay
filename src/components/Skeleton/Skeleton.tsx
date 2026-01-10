import React, {useEffect, useRef} from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ViewStyle,
  DimensionValue,
} from 'react-native';
import {useTheme} from '../ThemeContext/ThemeContext';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const {colors} = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
};

// Event Card Skeleton
export const EventCardSkeleton: React.FC = () => {
  const {colors} = useTheme();

  return (
    <View
      style={[
        styles.eventCard,
        {backgroundColor: colors.card, borderColor: colors.border},
      ]}>
      {/* Header row */}
      <View style={styles.row}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={styles.headerText}>
          <Skeleton width="60%" height={18} style={styles.marginBottom6} />
          <Skeleton width="40%" height={14} />
        </View>
      </View>

      {/* Event type badge */}
      <View style={styles.badgeRow}>
        <Skeleton width={100} height={28} borderRadius={14} />
      </View>

      {/* Details */}
      <View style={styles.detailsContainer}>
        <Skeleton width="70%" height={16} style={styles.marginBottom8} />
        <Skeleton width="50%" height={16} style={styles.marginBottom8} />
        <Skeleton width="40%" height={16} />
      </View>

      {/* Map placeholder */}
      <Skeleton
        width="100%"
        height={120}
        borderRadius={12}
        style={styles.marginTop12}
      />

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <Skeleton width="45%" height={40} borderRadius={8} />
        <Skeleton width="45%" height={40} borderRadius={8} />
      </View>
    </View>
  );
};

// Post Card Skeleton for Community Notes
export const PostCardSkeleton: React.FC = () => {
  const {colors} = useTheme();

  return (
    <View
      style={[
        styles.postCard,
        {backgroundColor: colors.card, borderColor: colors.border},
      ]}>
      {/* Header with avatar */}
      <View style={styles.row}>
        <Skeleton width={44} height={44} borderRadius={22} />
        <View style={styles.headerText}>
          <Skeleton width={120} height={16} style={styles.marginBottom6} />
          <Skeleton width={80} height={12} />
        </View>
      </View>

      {/* Post content */}
      <View style={styles.marginTop12}>
        <Skeleton width="100%" height={16} style={styles.marginBottom6} />
        <Skeleton width="90%" height={16} style={styles.marginBottom6} />
        <Skeleton width="70%" height={16} />
      </View>

      {/* Action buttons */}
      <View style={styles.actionRowMarginTop}>
        <Skeleton width={60} height={24} borderRadius={12} />
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>
    </View>
  );
};

// Profile Stats Skeleton
export const ProfileStatsSkeleton: React.FC = () => {
  const {colors} = useTheme();

  return (
    <View
      style={[
        styles.statsCard,
        {backgroundColor: colors.card, borderColor: colors.border},
      ]}>
      <Skeleton width={100} height={20} style={styles.marginBottom16} />
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Skeleton width={50} height={50} borderRadius={25} />
          <Skeleton width={30} height={24} style={styles.marginTop8} />
          <Skeleton width={60} height={14} style={styles.marginTop4} />
        </View>
        <View style={styles.statItem}>
          <Skeleton width={50} height={50} borderRadius={25} />
          <Skeleton width={30} height={24} style={styles.marginTop8} />
          <Skeleton width={60} height={14} style={styles.marginTop4} />
        </View>
      </View>
    </View>
  );
};

// Roster Player Skeleton
export const RosterPlayerSkeleton: React.FC = () => {
  const {colors} = useTheme();

  return (
    <View
      style={[
        styles.playerCard,
        {backgroundColor: colors.card, borderColor: colors.border},
      ]}>
      <View style={styles.row}>
        <Skeleton width={44} height={44} borderRadius={22} />
        <View style={styles.headerText}>
          <Skeleton width={100} height={16} style={styles.marginBottom6} />
          <Skeleton width={80} height={12} />
        </View>
        <View style={styles.marginLeftAuto}>
          <Skeleton width={60} height={24} borderRadius={12} />
        </View>
      </View>
    </View>
  );
};

// Event List Skeleton (multiple cards)
export const EventListSkeleton: React.FC<{count?: number}> = ({count = 3}) => {
  return (
    <View style={styles.listContainer}>
      {Array.from({length: count}).map((_, index) => (
        <EventCardSkeleton key={index} />
      ))}
    </View>
  );
};

// Post List Skeleton (multiple cards)
export const PostListSkeleton: React.FC<{count?: number}> = ({count = 3}) => {
  return (
    <View style={styles.listContainer}>
      {Array.from({length: count}).map((_, index) => (
        <PostCardSkeleton key={index} />
      ))}
    </View>
  );
};

// Roster List Skeleton
export const RosterListSkeleton: React.FC<{count?: number}> = ({count = 5}) => {
  return (
    <View style={styles.listContainer}>
      {Array.from({length: count}).map((_, index) => (
        <RosterPlayerSkeleton key={index} />
      ))}
    </View>
  );
};

// Your Data Skeleton
export const YourDataSkeleton: React.FC = () => {
  const {colors} = useTheme();

  return (
    <View style={styles.listContainer}>
      {/* Profile section */}
      <View
        style={[
          styles.dataCard,
          {backgroundColor: colors.card, borderColor: colors.border},
        ]}>
        <View style={styles.row}>
          <Skeleton width={24} height={24} borderRadius={4} />
          <Skeleton width={100} height={20} style={styles.marginLeft12} />
        </View>
        <View style={styles.marginTop16}>
          <Skeleton width="60%" height={16} style={styles.marginBottom12} />
          <Skeleton width="80%" height={16} style={styles.marginBottom12} />
          <Skeleton width="50%" height={16} />
        </View>
      </View>

      {/* Events section */}
      <View
        style={[
          styles.dataCard,
          {backgroundColor: colors.card, borderColor: colors.border},
        ]}>
        <View style={styles.row}>
          <Skeleton width={24} height={24} borderRadius={4} />
          <Skeleton width={120} height={20} style={styles.marginLeft12} />
        </View>
        <View style={styles.marginTop16}>
          <Skeleton
            width="100%"
            height={60}
            borderRadius={8}
            style={styles.marginBottom8}
          />
          <Skeleton width="100%" height={60} borderRadius={8} />
        </View>
      </View>

      {/* Activity section */}
      <View
        style={[
          styles.dataCard,
          {backgroundColor: colors.card, borderColor: colors.border},
        ]}>
        <View style={styles.row}>
          <Skeleton width={24} height={24} borderRadius={4} />
          <Skeleton width={140} height={20} style={styles.marginLeft12} />
        </View>
        <View style={styles.marginTop16}>
          <Skeleton width="70%" height={16} style={styles.marginBottom12} />
          <Skeleton width="50%" height={16} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  eventCard: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  postCard: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  statsCard: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  playerCard: {
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  dataCard: {
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  badgeRow: {
    marginTop: 12,
  },
  detailsContainer: {
    marginTop: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  listContainer: {
    paddingTop: 8,
  },
  marginBottom6: {
    marginBottom: 6,
  },
  marginBottom8: {
    marginBottom: 8,
  },
  marginBottom12: {
    marginBottom: 12,
  },
  marginBottom16: {
    marginBottom: 16,
  },
  marginTop4: {
    marginTop: 4,
  },
  marginTop8: {
    marginTop: 8,
  },
  marginTop12: {
    marginTop: 12,
  },
  marginTop16: {
    marginTop: 16,
  },
  marginLeft12: {
    marginLeft: 12,
  },
  marginLeftAuto: {
    marginLeft: 'auto',
  },
  actionRowMarginTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
});

export default Skeleton;
