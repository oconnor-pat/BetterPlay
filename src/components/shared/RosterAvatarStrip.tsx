import React, {useMemo} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import {useTheme} from '../ThemeContext/ThemeContext';

export interface AvatarStripMember {
  userId: string;
  username?: string;
  name?: string;
  profilePicUrl?: string;
}

interface Props {
  members: AvatarStripMember[];
  maxVisible?: number;
  size?: number;
  overlap?: number;
}

// Deterministic background color from a string seed. Same logic used in the
// EventList card avatars so user X always gets the same color.
const seededColor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = [
    '#4F8EF7',
    '#F77F4F',
    '#7BC67E',
    '#F76EA3',
    '#9E7AC9',
    '#F2C14E',
    '#5BBFB3',
    '#E26D5C',
  ];
  return palette[Math.abs(hash) % palette.length];
};

const initialsFor = (m: AvatarStripMember): string => {
  const source = m.name || m.username || '?';
  const parts = source.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const RosterAvatarStrip: React.FC<Props> = ({
  members,
  maxVisible = 5,
  size = 28,
  overlap = 8,
}) => {
  const {colors} = useTheme();
  const visible = members.slice(0, maxVisible);
  const overflow = Math.max(0, members.length - visible.length);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flexDirection: 'row',
          alignItems: 'center',
        },
        avatar: {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        avatarImg: {
          width: '100%',
          height: '100%',
        },
        initials: {
          color: '#FFFFFF',
          fontSize: Math.round(size * 0.38),
          fontWeight: '700',
        },
        overflowChip: {
          height: size,
          paddingHorizontal: 8,
          borderRadius: size / 2,
          borderWidth: 1.5,
          borderColor: colors.background,
          backgroundColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: -overlap,
        },
        overflowText: {
          color: colors.text,
          fontSize: 11,
          fontWeight: '700',
        },
        empty: {
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        emptyText: {
          color: colors.secondaryText,
          fontSize: 12,
          fontStyle: 'italic',
        },
      }),
    [colors, overlap, size],
  );

  if (members.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No one signed up yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {visible.map((m, i) => {
        const bg = seededColor(m.userId || m.username || String(i));
        return (
          <View
            key={m.userId || `${i}`}
            style={[
              styles.avatar,
              {backgroundColor: bg, marginLeft: i === 0 ? 0 : -overlap},
            ]}>
            {m.profilePicUrl ? (
              <Image source={{uri: m.profilePicUrl}} style={styles.avatarImg} />
            ) : (
              <Text style={styles.initials}>{initialsFor(m)}</Text>
            )}
          </View>
        );
      })}
      {overflow > 0 ? (
        <View style={styles.overflowChip}>
          <Text style={styles.overflowText}>+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
};

export default RosterAvatarStrip;
