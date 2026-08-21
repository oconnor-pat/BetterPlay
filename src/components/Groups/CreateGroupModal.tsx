// Modal for creating a new Group. Collects a name, privacy setting, and
// an initial set of members searched/picked by username. Submits to
// POST /groups; on success calls onCreated with the new group so the
// parent can navigate or refresh its list.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faTimes,
  faSearch,
  faGlobe,
  faLock,
  faUserPlus,
  faUsers,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';
import {createGroup} from '../../services/GroupsService';
import {Group, GroupPrivacy} from '../../types/group';

interface PickableUser {
  _id: string;
  username: string;
  name?: string;
  profilePicUrl?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (group: Group) => void;
  currentUserId: string;
}

const SEARCH_DEBOUNCE_MS = 300;

const CreateGroupModal: React.FC<Props> = ({
  visible,
  onClose,
  onCreated,
  currentUserId,
}) => {
  const {colors, darkMode} = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [privacy, setPrivacy] = useState<GroupPrivacy>('private');
  const [selected, setSelected] = useState<PickableUser[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickableUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, e => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [visible]);

  // Reset all transient state whenever the modal closes/reopens so a
  // fresh create flow doesn't inherit prior input.
  useEffect(() => {
    if (!visible) {
      setName('');
      setPrivacy('private');
      setSelected([]);
      setQuery('');
      setResults([]);
      setSearching(false);
      setSubmitting(false);
      setKeyboardHeight(0);
    }
  }, [visible]);

  // Keyboard height already clears the home indicator; don't double-count
  // the SafeArea bottom inset or the form will jump too far.
  const keyboardPad =
    keyboardHeight > 0
      ? Math.max(0, keyboardHeight - insets.bottom) + 8
      : 0;

  // Debounced user search. Hits GET /users?search=... — same endpoint the
  // UserSearch screen uses, no new BE work needed.
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const res = await axios.get(`${API_BASE_URL}/users`, {
          params: {search: trimmed},
          headers: token ? {Authorization: `Bearer ${token}`} : {},
        });
        const list: PickableUser[] = (res.data?.users || [])
          .filter((u: any) => u && u._id && u._id !== currentUserId)
          .map((u: any) => ({
            _id: String(u._id),
            username: u.username,
            name: u.name,
            profilePicUrl: u.profilePicUrl,
          }));
        setResults(list);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [query, currentUserId]);

  const selectedIds = useMemo(
    () => new Set(selected.map(u => u._id)),
    [selected],
  );

  const togglePick = useCallback((user: PickableUser) => {
    setSelected(prev => {
      const exists = prev.some(p => p._id === user._id);
      if (exists) {
        return prev.filter(p => p._id !== user._id);
      }
      return [...prev, user];
    });
  }, []);

  const canCreate = name.trim().length > 0 && !submitting;

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Give your group a name first.');
      return;
    }
    setSubmitting(true);
    try {
      const group = await createGroup({
        name: trimmed,
        privacy,
        memberIds: selected.map(s => s._id),
      });
      onCreated(group);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || 'Could not create group';
      Alert.alert("Couldn't create group", message);
    } finally {
      setSubmitting(false);
    }
  }, [name, privacy, selected, onCreated]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
        headerSide: {
          width: 40,
          alignItems: 'flex-start',
        },
        headerTitle: {
          flex: 1,
          textAlign: 'center',
          fontSize: 17,
          fontWeight: '800',
          color: colors.text,
        },
        body: {
          flex: 1,
        },
        bodyContent: {
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: 20,
        },
        introCard: {
          borderRadius: 18,
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 18,
          marginBottom: 18,
          overflow: 'hidden',
        },
        introGlow: {
          position: 'absolute',
          width: 140,
          height: 140,
          borderRadius: 70,
          top: -50,
          right: -36,
          backgroundColor: colors.primary + '22',
        },
        introIcon: {
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary + '18',
          marginBottom: 12,
        },
        introTitle: {
          fontSize: 20,
          fontWeight: '800',
          color: colors.text,
          letterSpacing: -0.2,
          marginBottom: 6,
        },
        introSubtitle: {
          fontSize: 13,
          lineHeight: 19,
          color: colors.secondaryText,
          fontWeight: '500',
        },
        panel: {
          borderRadius: 16,
          backgroundColor: colors.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 14,
          marginBottom: 14,
        },
        label: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 10,
        },
        nameInput: {
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.04)',
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 13,
          color: colors.text,
          fontSize: 17,
          fontWeight: '700',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        privacyRow: {
          flexDirection: 'row',
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.04)',
          borderRadius: 14,
          padding: 4,
        },
        privacyOption: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 11,
          borderRadius: 11,
          gap: 6,
        },
        privacyOptionActive: {
          backgroundColor: colors.primary,
        },
        privacyText: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        privacyTextActive: {
          color: '#FFFFFF',
        },
        privacyHint: {
          marginTop: 10,
          fontSize: 12,
          lineHeight: 17,
          color: colors.secondaryText,
        },
        chipsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 12,
        },
        chip: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: colors.primary + '22',
          borderRadius: 16,
          paddingHorizontal: 10,
          paddingVertical: 6,
        },
        chipText: {
          color: colors.primary,
          fontWeight: '700',
          fontSize: 13,
        },
        searchBar: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(0,0,0,0.04)',
          borderRadius: 22,
          paddingHorizontal: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        searchInput: {
          flex: 1,
          paddingVertical: 11,
          color: colors.text,
          fontSize: 15,
        },
        resultRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          paddingHorizontal: 4,
          marginTop: 4,
          borderRadius: 12,
        },
        avatar: {
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        avatarImage: {width: 42, height: 42},
        avatarInitials: {
          color: colors.text,
          fontWeight: '700',
          fontSize: 14,
        },
        resultBody: {flex: 1},
        resultName: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
        },
        resultUsername: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 2,
        },
        addButton: {
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary + '22',
        },
        addButtonActive: {
          backgroundColor: colors.primary,
        },
        emptyHint: {
          textAlign: 'center',
          color: colors.secondaryText,
          fontSize: 13,
          lineHeight: 18,
          paddingVertical: 16,
          paddingHorizontal: 8,
        },
        footer: {
          paddingHorizontal: 16,
          paddingTop: 18,
          marginTop: 4,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        },
        createBtn: {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          borderRadius: 16,
          paddingVertical: 15,
          minHeight: 52,
        },
        createBtnDisabled: {
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
        },
        createBtnText: {
          color: '#FFFFFF',
          fontSize: 16,
          fontWeight: '800',
        },
        createBtnTextDisabled: {
          color: colors.secondaryText,
        },
        flex: {flex: 1},
      }),
    [colors, darkMode],
  );

  const renderUser = ({item}: {item: PickableUser}) => {
    const picked = selectedIds.has(item._id);
    return (
      <TouchableOpacity
        style={styles.resultRow}
        activeOpacity={0.7}
        onPress={() => togglePick(item)}>
        <View style={styles.avatar}>
          {item.profilePicUrl ? (
            <Image
              source={{uri: item.profilePicUrl}}
              style={styles.avatarImage}
            />
          ) : (
            <Text style={styles.avatarInitials}>
              {(item.username || '?').slice(0, 2).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.resultBody}>
          <Text style={styles.resultName} numberOfLines={1}>
            {item.name || item.username}
          </Text>
          <Text style={styles.resultUsername} numberOfLines={1}>
            @{item.username}
          </Text>
        </View>
        <View style={[styles.addButton, picked && styles.addButtonActive]}>
          <FontAwesomeIcon
            icon={picked ? faXmark : faUserPlus}
            size={14}
            color={picked ? '#FFFFFF' : colors.primary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const privacyHint =
    privacy === 'private'
      ? 'Only people you add can see this group and its chat.'
      : 'Anyone can find this group. You still control who joins.';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <TouchableOpacity onPress={onClose} disabled={submitting}>
              <FontAwesomeIcon icon={faTimes} size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>New group</Text>
          <View style={styles.headerSide} />
        </View>

        <View style={[styles.flex, {paddingBottom: keyboardPad}]}>
          <ScrollView
            ref={scrollRef}
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets={false}
            showsVerticalScrollIndicator={false}>
            <View style={styles.introCard}>
              <View style={styles.introGlow} pointerEvents="none" />
              <View style={styles.introIcon}>
                <FontAwesomeIcon
                  icon={faUsers}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.introTitle}>Build your crew</Text>
              <Text style={styles.introSubtitle}>
                Name the group, set privacy, and invite people — friends
                optional.
              </Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.label}>Group name</Text>
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="The Trivia Crew"
                placeholderTextColor={colors.secondaryText}
                maxLength={60}
                autoFocus
                returnKeyType="next"
                onFocus={() => {
                  requestAnimationFrame(() => {
                    scrollRef.current?.scrollTo({y: 120, animated: true});
                  });
                }}
              />
            </View>

            <View style={styles.panel}>
              <Text style={styles.label}>Privacy</Text>
              <View style={styles.privacyRow}>
                <TouchableOpacity
                  style={[
                    styles.privacyOption,
                    privacy === 'private' && styles.privacyOptionActive,
                  ]}
                  onPress={() => setPrivacy('private')}
                  activeOpacity={0.85}>
                  <FontAwesomeIcon
                    icon={faLock}
                    size={12}
                    color={
                      privacy === 'private' ? '#FFFFFF' : colors.secondaryText
                    }
                  />
                  <Text
                    style={[
                      styles.privacyText,
                      privacy === 'private' && styles.privacyTextActive,
                    ]}>
                    Private
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.privacyOption,
                    privacy === 'public' && styles.privacyOptionActive,
                  ]}
                  onPress={() => setPrivacy('public')}
                  activeOpacity={0.85}>
                  <FontAwesomeIcon
                    icon={faGlobe}
                    size={12}
                    color={
                      privacy === 'public' ? '#FFFFFF' : colors.secondaryText
                    }
                  />
                  <Text
                    style={[
                      styles.privacyText,
                      privacy === 'public' && styles.privacyTextActive,
                    ]}>
                    Public
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.privacyHint}>{privacyHint}</Text>
            </View>

            <View style={styles.panel}>
              <Text style={styles.label}>
                Members{selected.length > 0 ? ` (${selected.length})` : ''}
              </Text>
              {selected.length > 0 ? (
                <View style={styles.chipsRow}>
                  {selected.map(u => (
                    <TouchableOpacity
                      key={u._id}
                      style={styles.chip}
                      onPress={() => togglePick(u)}>
                      <Text style={styles.chipText}>@{u.username}</Text>
                      <FontAwesomeIcon
                        icon={faXmark}
                        size={11}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <View style={styles.searchBar}>
                <FontAwesomeIcon
                  icon={faSearch}
                  size={16}
                  color={colors.secondaryText}
                />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search by name or username"
                  placeholderTextColor={colors.secondaryText}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollRef.current?.scrollToEnd({animated: true});
                    }, 100);
                  }}
                />
                {searching ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : null}
              </View>

              <FlatList
                data={results}
                keyExtractor={item => item._id}
                renderItem={renderUser}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={false}
                ListEmptyComponent={
                  query.trim().length >= 2 && !searching ? (
                    <Text style={styles.emptyHint}>No users found.</Text>
                  ) : query.trim().length > 0 && query.trim().length < 2 ? (
                    <Text style={styles.emptyHint}>Keep typing…</Text>
                  ) : (
                    <Text style={styles.emptyHint}>
                      You can add anyone with an account — they don't have to be
                      your friend.
                    </Text>
                  )
                }
              />
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              {paddingBottom: Math.max(20, insets.bottom + 8)},
            ]}>
            <TouchableOpacity
              style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canCreate}
              activeOpacity={0.85}>
              {submitting ? (
                <ActivityIndicator
                  size="small"
                  color={canCreate ? '#FFFFFF' : colors.secondaryText}
                />
              ) : (
                <Text
                  style={[
                    styles.createBtnText,
                    !canCreate && styles.createBtnTextDisabled,
                  ]}>
                  Create group
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default CreateGroupModal;
