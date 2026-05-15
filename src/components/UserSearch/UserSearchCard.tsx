import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faUserPlus,
  faUserCheck,
  faUserClock,
  faCalendarCheck,
  faCalendarPlus,
  faLocationArrow,
} from '@fortawesome/free-solid-svg-icons';
import {useTheme} from '../ThemeContext/ThemeContext';

export type FriendStatus =
  | 'none'
  | 'friends'
  | 'pending'
  | 'incoming'
  | 'loading';

interface UserSearchCardProps {
  user: {
    _id: string;
    username: string;
    name?: string;
    profilePicUrl?: string;
    favoriteActivities?: string[];
    eventsCreated?: number;
    eventsJoined?: number;
  };
  onPress: () => void;
  friendStatus?: FriendStatus;
  onFriendAction?: () => void;
  distance?: number; // miles, shown when proximity filter is active
}

// Interest emoji mapping (all 30 activities)
const interestEmojis: Record<string, string> = {
  basketball: '🏀',
  hockey: '🏒',
  soccer: '⚽',
  'figure-skating': '⛸️',
  tennis: '🎾',
  golf: '⛳',
  football: '🏈',
  rugby: '🏉',
  baseball: '⚾',
  softball: '🥎',
  lacrosse: '🥍',
  volleyball: '🏐',
  trivia: '🧠',
  'game-nights': '🎲',
  karaoke: '🎤',
  'open-mic': '🎙️',
  'watch-party': '📺',
  'live-music': '🎵',
  brewery: '🍻',
  wine: '🍷',
  coffee: '☕',
  'sports-bar': '📺',
  hiking: '🥾',
  cycling: '🚴',
  running: '🏃',
  yoga: '🧘',
  swimming: '🏊',
  bowling: '🎳',
  arcade: '🕹️',
  gaming: '🎮',
  dance: '💃',
  fishing: '🎣',
  camping: '🏕️',
  'book-club': '📚',
  workshops: '🛠️',
  meetup: '🤝',
  cooking: '🍲',
  volunteering: '💚',
  other: '🎯',
};

const UserSearchCard: React.FC<UserSearchCardProps> = ({
  user,
  onPress,
  friendStatus = 'none',
  onFriendAction,
  distance,
}) => {
  const {colors} = useTheme();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0]?.toUpperCase())
      .join('')
      .slice(0, 2);
  };

  const getFriendButtonConfig = () => {
    switch (friendStatus) {
      case 'friends':
        return {
          icon: faUserCheck,
          color: '#4CAF50',
          bgColor: '#4CAF5020',
          label: 'Friends',
        };
      case 'pending':
        return {
          icon: faUserClock,
          color: '#FF9800',
          bgColor: '#FF980020',
          label: 'Pending',
        };
      case 'incoming':
        return {
          icon: faUserClock,
          color: '#2196F3',
          bgColor: '#2196F320',
          label: 'Respond',
        };
      default:
        return {
          icon: faUserPlus,
          color: colors.primary,
          bgColor: colors.primary + '20',
          label: 'Add',
        };
    }
  };

  const buttonConfig = getFriendButtonConfig();

  const styles = StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    avatarContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
      overflow: 'hidden',
    },
    avatarImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    avatarText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
    },
    infoContainer: {
      flex: 1,
    },
    username: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    sportsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    sportEmoji: {
      fontSize: 13,
      marginRight: 4,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 14,
    },
    statText: {
      fontSize: 12,
      color: colors.secondaryText,
      marginLeft: 4,
    },
    friendButton: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      marginLeft: 8,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: 'transparent',
    },
    friendButtonLabel: {
      fontSize: 12,
      fontWeight: '700',
      marginLeft: 6,
    },
    distanceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary + '12',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.primary + '40',
      alignSelf: 'flex-start',
      marginBottom: 4,
    },
    distanceText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '700',
      marginLeft: 4,
    },
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatarContainer}>
        {user.profilePicUrl ? (
          <Image
            source={{uri: user.profilePicUrl}}
            style={styles.avatarImage}
          />
        ) : (
          <Text style={styles.avatarText}>{getInitials(user.username)}</Text>
        )}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.username}>{user.username}</Text>

        {distance != null && (
          <View style={styles.distanceBadge}>
            <FontAwesomeIcon
              icon={faLocationArrow}
              size={10}
              color={colors.primary}
            />
            <Text style={styles.distanceText}>
              {distance < 1 ? '< 1 mi' : `${Math.round(distance)} mi`}
            </Text>
          </View>
        )}

        {user.favoriteActivities && user.favoriteActivities.length > 0 && (
          <View style={styles.sportsRow}>
            {user.favoriteActivities.slice(0, 4).map((activity, index) => (
              <Text key={index} style={styles.sportEmoji}>
                {interestEmojis[activity.toLowerCase()] || '🎯'}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <FontAwesomeIcon
              icon={faCalendarPlus}
              size={12}
              color={colors.primary}
            />
            <Text style={styles.statText}>
              {user.eventsCreated || 0} created
            </Text>
          </View>
          <View style={styles.stat}>
            <FontAwesomeIcon
              icon={faCalendarCheck}
              size={12}
              color={colors.primary}
            />
            <Text style={styles.statText}>{user.eventsJoined || 0} joined</Text>
          </View>
        </View>
      </View>

      {onFriendAction && (
        <TouchableOpacity
          style={[
            styles.friendButton,
            {
              borderColor: buttonConfig.color + '66',
              backgroundColor: buttonConfig.color + '12',
            },
          ]}
          onPress={e => {
            e.stopPropagation();
            onFriendAction();
          }}
          disabled={friendStatus === 'loading'}>
          {friendStatus === 'loading' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <FontAwesomeIcon
                icon={buttonConfig.icon}
                size={12}
                color={buttonConfig.color}
              />
              <Text
                style={[styles.friendButtonLabel, {color: buttonConfig.color}]}>
                {buttonConfig.label}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

export default UserSearchCard;
