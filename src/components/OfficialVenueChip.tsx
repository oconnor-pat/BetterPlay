import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faBuilding} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';
import {useTheme} from './ThemeContext/ThemeContext';

type Props = {
  compact?: boolean;
  /** Center the chip in its parent (e.g. public venue profile hero). */
  centered?: boolean;
};

/** Small Official venue marker — reuse in cards, comments, DMs, roster. */
const OfficialVenueChip: React.FC<Props> = ({
  compact = false,
  centered = false,
}) => {
  const {colors} = useTheme();
  const {t} = useTranslation();
  const styles = StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: compact ? 3 : 5,
      alignSelf: centered ? 'center' : 'flex-start',
      paddingHorizontal: compact ? 6 : 8,
      paddingVertical: compact ? 2 : 3,
      borderRadius: 10,
      backgroundColor: colors.primary + '22',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary + '88',
    },
    text: {
      color: colors.primary,
      fontSize: compact ? 10 : 11,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  });

  return (
    <View style={styles.chip}>
      <FontAwesomeIcon
        icon={faBuilding}
        size={compact ? 8 : 10}
        color={colors.primary}
      />
      <Text style={styles.text}>
        {t('events.venueOfficialBadge') || 'Official venue'}
      </Text>
    </View>
  );
};

export default OfficialVenueChip;
