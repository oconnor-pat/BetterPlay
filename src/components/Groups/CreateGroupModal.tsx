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
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faTimes,
  faSearch,
  faGlobe,
  faLock,
  faUserPlus,
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

  const [name, setName] = useState('');
  const [privacy, setPrivacy] = useState<GroupPrivacy>('private');
  const [selected, setSelected] = useState<PickableUser[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickableUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    }
  }, [visible]);

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

  const selectedIds = useMemo(() => new Set(selected.map(u => u._id)), [selected]);

  const togglePick = useCallback((user: PickableUser) => {
    setSelected(prev => {
      const exists = prev.some(p => p._id === user._id);
      if (exists) {
        return prev.filter(p => p._id !== user._id);
      }
      return [...prev, user];
    });
  }, []);

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
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        headerTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: colors.text,
        },
        headerAction: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.primary,
        },
        headerActionDisabled: {
          color: colors.secondaryText,
        },
        body: {
          flex: 1,
        },
        bodyContent: {
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 24,
        },
        label: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          marginBottom: 8,
        },
        nameInput: {
          backgroundColor: colors.inputBackground,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: colors.text,
          fontSize: 17,
          fontWeight: '600',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        section: {
          marginTop: 22,
        },
        privacyRow: {
          flexDirection: 'row',
          backgroundColor: colors.inputBackground,
          borderRadius: 12,
          padding: 4,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        privacyOption: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
          borderRadius: 9,
          gap: 6,
        },
        privacyOptionActive: {
          backgroundColor: colors.card,
        },
        privacyText: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        privacyTextActive: {
          color: colors.text,
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
          backgroundColor: colors.inputBackground,
          borderRadius: 20,
          paddingHorizontal: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        searchInput: {
          flex: 1,
          paddingVertical: 10,
          color: colors.text,
          fontSize: 15,
        },
        resultRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 10,
          paddingHorizontal: 4,
        },
        avatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: darkMode
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        avatarImage: {width: 40, height: 40},
        avatarInitials: {
          color: colors.text,
          fontWeight: '700',
          fontSize: 14,
        },
        resultBody: {flex: 1},
        resultName: {
          fontSize: 15,
          fontWeight: '600',
          color: colors.text,
        },
        resultUsername: {
          fontSize: 12,
          color: colors.secondaryText,
          marginTop: 2,
        },
        addButton: {
          width: 32,
          height: 32,
          borderRadius: 16,
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
          paddingVertical: 16,
        },
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
            <Image source={{uri: item.profilePicUrl}} style={styles.avatarImage} />
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={submitting}>
            <FontAwesomeIcon icon={faTimes} size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New group</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.headerAction,
                  (!name.trim() || submitting) && styles.headerActionDisabled,
                ]}>
                Create
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled">
          <View>
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
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Privacy</Text>
            <View style={styles.privacyRow}>
              <TouchableOpacity
                style={[
                  styles.privacyOption,
                  privacy === 'private' && styles.privacyOptionActive,
                ]}
                onPress={() => setPrivacy('private')}>
                <FontAwesomeIcon
                  icon={faLock}
                  size={12}
                  color={privacy === 'private' ? colors.text : colors.secondaryText}
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
                onPress={() => setPrivacy('public')}>
                <FontAwesomeIcon
                  icon={faGlobe}
                  size={12}
                  color={privacy === 'public' ? colors.text : colors.secondaryText}
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
          </View>

          <View style={styles.section}>
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
                    <FontAwesomeIcon icon={faXmark} size={11} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            <View style={styles.searchBar}>
              <FontAwesomeIcon icon={faSearch} size={16} color={colors.secondaryText} />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search by username"
                placeholderTextColor={colors.secondaryText}
                autoCapitalize="none"
                autoCorrect={false}
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
                    You can add anyone with an account — they don't have to be your friend.
                  </Text>
                )
              }
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default CreateGroupModal;
