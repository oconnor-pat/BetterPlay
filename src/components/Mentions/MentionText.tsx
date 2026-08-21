import React from 'react';
import {Text, StyleSheet, TextStyle, StyleProp} from 'react-native';
import {splitMentionSegments} from '../../utils/mentions';
import {useTheme} from '../ThemeContext/ThemeContext';

type Props = {
  text: string;
  style?: StyleProp<TextStyle>;
  mentionStyle?: StyleProp<TextStyle>;
  /**
   * Use on green / primary-filled bubbles where `colors.primary` text
   * would disappear (especially iOS). Mentions stay white + underlined.
   */
  onAccent?: boolean;
  onPressMention?: (username: string) => void;
};

/**
 * Renders plain message text with tappable @username highlights.
 * Storage stays plain text — no HTML/markdown required.
 */
export default function MentionText({
  text,
  style,
  mentionStyle,
  onAccent = false,
  onPressMention,
}: Props) {
  const {colors} = useTheme();
  const segments = splitMentionSegments(text || '');

  const mentionColor = onAccent ? '#FFFFFF' : colors.primary;

  return (
    <Text style={style}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return (
            <Text key={`t-${index}`} style={style}>
              {segment.value}
            </Text>
          );
        }
        return (
          <Text
            key={`m-${index}-${segment.username}`}
            style={[
              style,
              styles.mention,
              onAccent ? styles.mentionOnAccent : null,
              {color: mentionColor},
              mentionStyle,
            ]}
            onPress={
              onPressMention
                ? () => onPressMention(segment.username)
                : undefined
            }>
            {segment.value}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  mention: {
    fontWeight: '700',
  },
  // Extra signal when we can't use brand-green text on a green bubble.
  mentionOnAccent: {
    textDecorationLine: 'underline',
  },
});
