import React, {useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faStar} from '@fortawesome/free-solid-svg-icons';
import {useTheme} from '../ThemeContext/ThemeContext';
import RatingsDetailModal, {RatingKind} from './RatingsDetailModal';

type Props = {
  userId: string;
  username?: string | null;
  hostAverage: number | null;
  hostCount: number;
  playerAverage: number | null;
  playerCount: number;
};

const RatingChip = ({
  label,
  average,
  count,
  color,
  onPress,
}: {
  label: string;
  average: number;
  count: number;
  color: string;
  onPress: () => void;
}) => {
  const {colors} = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`View ${label} ratings`}
      style={[
        styles.chip,
        {backgroundColor: colors.card, borderColor: colors.border},
      ]}>
      <Text style={[styles.chipLabel, {color: colors.secondaryText}]}>
        {label}
      </Text>
      <FontAwesomeIcon icon={faStar} size={13} color={color} />
      <Text style={[styles.chipValue, {color: colors.text}]}>
        {average.toFixed(1)}
      </Text>
      <Text style={[styles.chipCount, {color: colors.secondaryText}]}>
        ({count})
      </Text>
    </TouchableOpacity>
  );
};

/** Host + player averages shown under a profile avatar. Tappable for details. */
const ProfileRatingBadges: React.FC<Props> = ({
  userId,
  username,
  hostAverage,
  hostCount,
  playerAverage,
  playerCount,
}) => {
  const [detailKind, setDetailKind] = useState<RatingKind | null>(null);

  const showHost = hostCount > 0 && hostAverage != null;
  const showPlayer = playerCount > 0 && playerAverage != null;
  if (!showHost && !showPlayer) {
    return null;
  }

  return (
    <>
      <View style={styles.row}>
        {showHost && (
          <RatingChip
            label="Host"
            average={hostAverage!}
            count={hostCount}
            color="#F5A623"
            onPress={() => setDetailKind('host')}
          />
        )}
        {showPlayer && (
          <RatingChip
            label="Player"
            average={playerAverage!}
            count={playerCount}
            color="#4FC3F7"
            onPress={() => setDetailKind('player')}
          />
        )}
      </View>

      <RatingsDetailModal
        visible={detailKind != null}
        userId={userId}
        kind={detailKind}
        username={username}
        onClose={() => setDetailKind(null)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 0,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  chipValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  chipCount: {
    fontSize: 13,
    fontWeight: '500',
  },
});

export default ProfileRatingBadges;
