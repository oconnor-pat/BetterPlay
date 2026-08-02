/**
 * ReportSheet.tsx
 *
 * Shared report form, used from profiles, DM threads and group chat.
 * Shared rather than reimplemented per surface because the reason list
 * is the part that must stay consistent: the categories are what make
 * reports countable in the admin queue, so they can't drift between
 * entry points.
 *
 * Reporting deliberately doesn't hide anything by itself — a report is
 * an accusation and acting on it is a judgement someone else makes. So
 * the sheet offers to block on the way out, which is the part that
 * protects the reporter immediately.
 */

import React, {useMemo, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {faCheck, faXmark} from '@fortawesome/free-solid-svg-icons';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../ThemeContext/ThemeContext';
import {submitReport} from '../../services/ModerationService';
import {
  REPORT_REASONS,
  ReportReason,
  ReportTarget,
} from '../../types/moderation';

interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  reportedUserId: string;
  username?: string;
  target: ReportTarget;
  contentId?: string;
  // Offered after a successful report. Omit to skip the follow-up
  // prompt, e.g. when the person is already blocked.
  onBlockRequested?: () => void;
}

const ReportSheet: React.FC<ReportSheetProps> = ({
  visible,
  onClose,
  reportedUserId,
  username,
  target,
  contentId,
  onBlockRequested,
}) => {
  const {colors} = useTheme();
  const {t} = useTranslation();

  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setReason(null);
    setDetails('');
    setSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await submitReport({
        reportedUserId,
        target,
        contentId,
        reason,
        details: details.trim() || undefined,
      });
      handleClose();

      // The confirmation doubles as the block prompt. Reporting alone
      // changes nothing the reporter can see, so without this the action
      // would feel like it did nothing at all.
      if (onBlockRequested) {
        Alert.alert(
          t('moderation.reportThanksTitle'),
          t('moderation.reportThanksBlockBody', {
            username: username || t('moderation.thisPerson'),
          }),
          [
            {text: t('moderation.notNow'), style: 'cancel'},
            {
              text: t('moderation.block'),
              style: 'destructive',
              onPress: onBlockRequested,
            },
          ],
        );
      } else {
        Alert.alert(
          t('moderation.reportThanksTitle'),
          t('moderation.reportThanksBody'),
        );
      }
    } catch (err) {
      console.error('Failed to submit report:', err);
      setSubmitting(false);
      Alert.alert(t('moderation.reportFailed'));
    }
  };

  const themedStyles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {flex: 1, justifyContent: 'flex-end'},
        backdrop: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.5)',
        },
        sheet: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 34 : 20,
          maxHeight: '85%',
        },
        handle: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          alignSelf: 'center',
          marginBottom: 12,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        },
        title: {fontSize: 17, fontWeight: '700', color: colors.text},
        closeButton: {padding: 6},
        subtitle: {
          fontSize: 13,
          color: colors.secondaryText,
          marginBottom: 16,
        },
        reasonRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 13,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        reasonText: {fontSize: 15, color: colors.text},
        reasonTextActive: {color: colors.primary, fontWeight: '600'},
        detailsLabel: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.secondaryText,
          marginTop: 18,
          marginBottom: 8,
        },
        detailsInput: {
          backgroundColor: colors.inputBackground,
          borderRadius: 10,
          padding: 12,
          fontSize: 14,
          color: colors.text,
          minHeight: 80,
          textAlignVertical: 'top',
        },
        submitButton: {
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
          marginTop: 20,
        },
        submitButtonDisabled: {opacity: 0.4},
        submitButtonText: {fontSize: 15, fontWeight: '700', color: '#fff'},
      }),
    [colors],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={themedStyles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity
          style={themedStyles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={themedStyles.sheet}>
          <View style={themedStyles.handle} />
          <View style={themedStyles.header}>
            <Text style={themedStyles.title}>
              {t('moderation.reportTitle')}
            </Text>
            <TouchableOpacity
              style={themedStyles.closeButton}
              onPress={handleClose}>
              <FontAwesomeIcon icon={faXmark} size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={themedStyles.subtitle}>
            {t('moderation.reportSubtitle')}
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            {REPORT_REASONS.map(r => (
              <TouchableOpacity
                key={r}
                style={themedStyles.reasonRow}
                onPress={() => setReason(r)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    themedStyles.reasonText,
                    reason === r && themedStyles.reasonTextActive,
                  ]}>
                  {t(`moderation.reason.${r}`)}
                </Text>
                {reason === r && (
                  <FontAwesomeIcon
                    icon={faCheck}
                    size={14}
                    color={colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}

            <Text style={themedStyles.detailsLabel}>
              {t('moderation.reportDetailsLabel')}
            </Text>
            <TextInput
              style={themedStyles.detailsInput}
              value={details}
              onChangeText={setDetails}
              placeholder={t('moderation.reportDetailsPlaceholder')}
              placeholderTextColor={colors.secondaryText}
              multiline
              maxLength={1000}
            />

            <TouchableOpacity
              style={[
                themedStyles.submitButton,
                (!reason || submitting) && themedStyles.submitButtonDisabled,
              ]}
              disabled={!reason || submitting}
              onPress={handleSubmit}>
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={themedStyles.submitButtonText}>
                  {t('moderation.submitReport')}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ReportSheet;
