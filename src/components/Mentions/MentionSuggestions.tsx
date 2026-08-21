import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faUser} from '@fortawesome/free-solid-svg-icons';
import {useTheme} from '../ThemeContext/ThemeContext';
import {MentionCandidate} from '../../utils/mentions';

type Props = {
  candidates: MentionCandidate[];
  onSelect: (candidate: MentionCandidate) => void;
};

/** Compact suggestion strip shown above a composer while typing @query. */
export default function MentionSuggestions({candidates, onSelect}: Props) {
  const {colors} = useTheme();

  if (!candidates.length) {
    return null;
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        nestedScrollEnabled>
        {candidates.map(item => (
          <TouchableOpacity
            key={item.userId}
            style={styles.row}
            onPress={() => onSelect(item)}
            activeOpacity={0.7}>
            {item.profilePicUrl ? (
              <Image
                source={{uri: item.profilePicUrl}}
                style={styles.avatar}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarFallback,
                  {backgroundColor: colors.primary + '22'},
                ]}>
                <FontAwesomeIcon
                  icon={faUser}
                  size={12}
                  color={colors.primary}
                />
              </View>
            )}
            <View style={styles.meta}>
              <Text style={[styles.username, {color: colors.text}]} numberOfLines={1}>
                @{item.username}
              </Text>
              {!!item.name && (
                <Text
                  style={[styles.name, {color: colors.secondaryText}]}
                  numberOfLines={1}>
                  {item.name}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    maxHeight: 168,
    marginBottom: 8,
    overflow: 'hidden',
  },
  scroll: {
    maxHeight: 168,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  username: {
    fontSize: 14,
    fontWeight: '700',
  },
  name: {
    fontSize: 12,
    marginTop: 1,
  },
});
