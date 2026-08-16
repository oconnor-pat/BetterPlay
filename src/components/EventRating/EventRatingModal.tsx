import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faStar, faTimes} from '@fortawesome/free-solid-svg-icons';
import {useTheme} from '../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../config/api';

export type PendingRating = {
  eventId: string;
  eventName: string;
  hostId: string;
  hostUsername?: string | null;
};

type Props = {
  visible: boolean;
  pending: PendingRating | null;
  onClose: () => void;
  onSubmitted?: (eventId: string) => void;
};

const StarRow = ({
  value,
  onChange,
  color,
}: {
  value: number;
  onChange: (n: number) => void;
  color: string;
}) => (
  <View style={styles.starRow}>
    {[1, 2, 3, 4, 5].map(n => (
      <TouchableOpacity
        key={n}
        onPress={() => {
          Keyboard.dismiss();
          onChange(n);
        }}
        hitSlop={{top: 8, bottom: 8, left: 4, right: 4}}
        accessibilityRole="button"
        accessibilityLabel={`${n} stars`}>
        <FontAwesomeIcon
          icon={faStar}
          size={28}
          color={n <= value ? color : '#9E9E9E'}
          style={n <= value ? undefined : {opacity: 0.35}}
        />
      </TouchableOpacity>
    ))}
  </View>
);

const EventRatingModal: React.FC<Props> = ({
  visible,
  pending,
  onClose,
  onSubmitted,
}) => {
  const {colors} = useTheme();
  const [eventScore, setEventScore] = useState(0);
  const [hostScore, setHostScore] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setEventScore(0);
      setHostScore(0);
      setComment('');
      setSubmitting(false);
    }
  }, [visible, pending?.eventId]);

  const canSubmit = eventScore >= 1 && hostScore >= 1 && !submitting;

  const submit = async () => {
    if (!pending || !canSubmit) {
      return;
    }
    Keyboard.dismiss();
    try {
      setSubmitting(true);
      const token = await AsyncStorage.getItem('userToken');
      await axios.post(
        `${API_BASE_URL}/events/${pending.eventId}/ratings`,
        {
          eventScore,
          hostScore,
          comment: comment.trim() || undefined,
        },
        {headers: token ? {Authorization: `Bearer ${token}`} : {}},
      );
      onSubmitted?.(pending.eventId);
      onClose();
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        'Could not submit your rating. Please try again.';
      Alert.alert('Rating', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.backdrop}>
            <View
              style={[
                styles.card,
                {backgroundColor: colors.card, borderColor: colors.border},
              ]}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                  <Text style={[styles.title, {color: colors.text}]}>
                    How was it?
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      onClose();
                    }}
                    hitSlop={12}>
                    <FontAwesomeIcon
                      icon={faTimes}
                      size={18}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.subtitle, {color: colors.secondaryText}]}>
                  {pending?.eventName
                    ? `Rate "${pending.eventName}"`
                    : 'Rate this event'}
                </Text>

                <Text style={[styles.label, {color: colors.text}]}>
                  The event
                </Text>
                <StarRow
                  value={eventScore}
                  onChange={setEventScore}
                  color={colors.primary}
                />

                <Text style={[styles.label, {color: colors.text}]}>
                  {pending?.hostUsername
                    ? `Host (${pending.hostUsername})`
                    : 'The host'}
                </Text>
                <StarRow
                  value={hostScore}
                  onChange={setHostScore}
                  color="#F5A623"
                />

                <TextInput
                  style={[
                    styles.comment,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                    },
                  ]}
                  placeholder="Optional comment"
                  placeholderTextColor={colors.secondaryText}
                  value={comment}
                  onChangeText={setComment}
                  maxLength={500}
                  multiline
                  blurOnSubmit
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />

                <TouchableOpacity
                  style={[
                    styles.submit,
                    {
                      backgroundColor: canSubmit
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                  disabled={!canSubmit}
                  onPress={submit}>
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>Submit rating</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
  },
  label: {
    marginTop: 12,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  starRow: {
    flexDirection: 'row',
    gap: 10,
  },
  comment: {
    marginTop: 16,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  submit: {
    marginTop: 18,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

export default EventRatingModal;
