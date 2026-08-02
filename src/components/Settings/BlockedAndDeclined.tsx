/**
 * BlockedAndDeclined.tsx
 *
 * The one place to reverse a moderation decision. Two lists in one
 * screen because they answer the same question — "who did I shut out,
 * and how do I undo it?" — even though they're different mechanisms.
 *
 * Declined requests especially need a home here: a declined thread is
 * hidden from the inbox and from Requests, so without this screen the
 * decision would be permanent in practice, with no surface anywhere to
 * change your mind from.
 *
 * Rendered inside a modal from Settings, matching NotificationSettings.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faUserSlash, faInbox} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../ThemeContext/ThemeContext';
import {fetchBlockedUsers, unblockUser} from '../../services/ModerationService';
import {
  acceptConversation,
  fetchDeclinedConversations,
} from '../../services/DirectMessageService';
import {BlockedUser} from '../../types/moderation';
import {Conversation} from '../../types/dm';

type Segment = 'blocked' | 'declined';

const BlockedAndDeclined: React.FC = () => {
  const {colors} = useTheme();
  const {t} = useTranslation();

  const [segment, setSegment] = useState<Segment>('blocked');
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [declined, setDeclined] = useState<Conversation[]>([]);
  // Ids with a request in flight, so a row can disable just itself
  // rather than locking the whole list.
  const [pending, setPending] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const [b, d] = await Promise.all([
        fetchBlockedUsers(),
        fetchDeclinedConversations(),
      ]);
      setBlocked(b);
      setDeclined(d);
    } catch (err) {
      console.error('Failed to load blocked/declined:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setRowPending = (id: string, on: boolean) =>
    setPending(prev => {
      const next = new Set(prev);
      if (on) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });

  const handleUnblock = (user: BlockedUser) => {
    Alert.alert(
      t('moderation.unblockTitle', {username: user.username}),
      t('moderation.unblockBody'),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('moderation.unblock'),
          onPress: async () => {
            setRowPending(user.userId, true);
            // Drop the row first so the list feels immediate, and put it
            // back if the call fails — the alternative is a spinner on a
            // one-line action that almost always succeeds.
            setBlocked(prev => prev.filter(b => b.userId !== user.userId));
            try {
              await unblockUser(user.userId);
            } catch (err) {
              console.error('Failed to unblock:', err);
              setBlocked(prev => [user, ...prev]);
              Alert.alert(t('moderation.unblockFailed'));
            } finally {
              setRowPending(user.userId, false);
            }
          },
        },
      ],
    );
  };

  const handleUndoDecline = async (conv: Conversation) => {
    const id = conv._id;
    setRowPending(id, true);
    setDeclined(prev => prev.filter(c => c._id !== id));
    try {
      await acceptConversation(id);
    } catch (err) {
      console.error('Failed to undo decline:', err);
      setDeclined(prev => [conv, ...prev]);
      Alert.alert(t('moderation.undoDeclineFailed'));
    } finally {
      setRowPending(id, false);
    }
  };

  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        segmentRow: {
          flexDirection: 'row',
          backgroundColor: colors.inputBackground,
          borderRadius: 10,
          padding: 3,
          marginBottom: 16,
        },
        segmentButton: {
          flex: 1,
          paddingVertical: 8,
          borderRadius: 8,
          alignItems: 'center',
        },
        segmentButtonActive: {backgroundColor: colors.card},
        segmentText: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.secondaryText,
        },
        segmentTextActive: {color: colors.text},
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        avatar: {width: 40, height: 40, borderRadius: 20},
        avatarFallback: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.inputBackground,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarInitial: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        rowBody: {flex: 1, marginLeft: 12},
        rowTitle: {fontSize: 15, fontWeight: '600', color: colors.text},
        rowSubtitle: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 2,
        },
        actionButton: {
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.primary,
        },
        actionButtonText: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.primary,
        },
        empty: {alignItems: 'center', paddingVertical: 40},
        emptyTitle: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.text,
          marginTop: 12,
        },
        emptyBody: {
          fontSize: 13,
          color: colors.secondaryText,
          marginTop: 4,
          textAlign: 'center',
          paddingHorizontal: 24,
        },
        loading: {paddingVertical: 40},
      }),
    [colors],
  );

  const renderAvatar = (username?: string, profilePicUrl?: string) =>
    profilePicUrl ? (
      <Image source={{uri: profilePicUrl}} style={themedStyles.avatar} />
    ) : (
      <View style={themedStyles.avatarFallback}>
        <Text style={themedStyles.avatarInitial}>
          {(username || '?').charAt(0).toUpperCase()}
        </Text>
      </View>
    );

  const renderEmpty = (
    icon: typeof faUserSlash,
    title: string,
    body: string,
  ) => (
    <View style={themedStyles.empty}>
      <FontAwesomeIcon icon={icon} size={28} color={colors.secondaryText} />
      <Text style={themedStyles.emptyTitle}>{title}</Text>
      <Text style={themedStyles.emptyBody}>{body}</Text>
    </View>
  );

  if (loading) {
    return (
      <ActivityIndicator style={themedStyles.loading} color={colors.primary} />
    );
  }

  return (
    <View>
      <View style={themedStyles.segmentRow}>
        {(['blocked', 'declined'] as Segment[]).map(seg => (
          <TouchableOpacity
            key={seg}
            style={[
              themedStyles.segmentButton,
              segment === seg && themedStyles.segmentButtonActive,
            ]}
            onPress={() => setSegment(seg)}
            activeOpacity={0.8}>
            <Text
              style={[
                themedStyles.segmentText,
                segment === seg && themedStyles.segmentTextActive,
              ]}>
              {seg === 'blocked'
                ? t('moderation.blockedCount', {count: blocked.length})
                : t('moderation.declinedCount', {count: declined.length})}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {segment === 'blocked' &&
        (blocked.length === 0
          ? renderEmpty(
              faUserSlash,
              t('moderation.noBlockedTitle'),
              t('moderation.noBlockedBody'),
            )
          : blocked.map(user => (
              <View key={user.userId} style={themedStyles.row}>
                {renderAvatar(user.username, user.profilePicUrl)}
                <View style={themedStyles.rowBody}>
                  <Text style={themedStyles.rowTitle}>{user.username}</Text>
                  <Text style={themedStyles.rowSubtitle}>
                    {t('moderation.blockedRowSubtitle')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={themedStyles.actionButton}
                  disabled={pending.has(user.userId)}
                  onPress={() => handleUnblock(user)}>
                  <Text style={themedStyles.actionButtonText}>
                    {t('moderation.unblock')}
                  </Text>
                </TouchableOpacity>
              </View>
            )))}

      {segment === 'declined' &&
        (declined.length === 0
          ? renderEmpty(
              faInbox,
              t('moderation.noDeclinedTitle'),
              t('moderation.noDeclinedBody'),
            )
          : declined.map(conv => (
              <View key={conv._id} style={themedStyles.row}>
                {renderAvatar(
                  conv.otherUser?.username,
                  conv.otherUser?.profilePicUrl,
                )}
                <View style={themedStyles.rowBody}>
                  <Text style={themedStyles.rowTitle}>
                    {conv.otherUser?.username}
                  </Text>
                  <Text style={themedStyles.rowSubtitle} numberOfLines={1}>
                    {conv.lastMessage?.text ||
                      t('moderation.declinedRowSubtitle')}
                  </Text>
                </View>
                <TouchableOpacity
                  style={themedStyles.actionButton}
                  disabled={pending.has(conv._id)}
                  onPress={() => handleUndoDecline(conv)}>
                  <Text style={themedStyles.actionButtonText}>
                    {t('moderation.undoDecline')}
                  </Text>
                </TouchableOpacity>
              </View>
            )))}
    </View>
  );
};

export default BlockedAndDeclined;
