import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {FontAwesomeIcon} from '@fortawesome/react-native-fontawesome';
import {
  faCheckCircle,
  faCircleExclamation,
  faCircleInfo,
  faClipboard,
  faFileCsv,
  faFileExcel,
  faFileLines,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import DocumentPicker, {
  DocumentPickerResponse,
  isCancel,
  types as documentPickerTypes,
} from 'react-native-document-picker';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../../ThemeContext/ThemeContext';
import {API_BASE_URL} from '../../../config/api';
import {
  buildScheduleTemplateCsv,
  flagOverlapsWithExisting,
  parseScheduleFile,
  ParsedSlotRow,
  ParseResult,
  ExistingSlotIndex,
} from '../../../utils/parseScheduleFile';

type Stage = 'picker' | 'parsing' | 'preview' | 'uploading' | 'done';
type RowFilter = 'all' | 'valid' | 'warning' | 'error';

interface UploadResultSummary {
  created: number;
  failed: number;
  errors: Array<{rowNumber: number; reason: string}>;
}

interface Props {
  visible: boolean;
  venueId: string;
  spaceId: string;
  existingSlots: ExistingSlotIndex;
  onClose: () => void;
  onUploadComplete: () => void;
}

const ABSOLUTE_MAX_ROWS = 500;

const CsvScheduleUpload: React.FC<Props> = ({
  visible,
  venueId,
  spaceId,
  existingSlots,
  onClose,
  onUploadComplete,
}) => {
  const {colors} = useTheme();
  const {t} = useTranslation();

  const [stage, setStage] = useState<Stage>('picker');
  const [pickedFileName, setPickedFileName] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [rowFilter, setRowFilter] = useState<RowFilter>('all');
  const [uploadProgress, setUploadProgress] = useState({done: 0, total: 0});
  const [uploadSummary, setUploadSummary] =
    useState<UploadResultSummary | null>(null);

  const resetState = useCallback(() => {
    setStage('picker');
    setPickedFileName('');
    setParseResult(null);
    setRowFilter('all');
    setUploadProgress({done: 0, total: 0});
    setUploadSummary(null);
  }, []);

  const handleClose = useCallback(() => {
    if (stage === 'uploading') {
      // Don't allow closing mid-upload to avoid orphan slots from sequential
      // fallback path.
      return;
    }
    onClose();
    // Slight delay so the modal animates out before content resets.
    setTimeout(resetState, 300);
  }, [onClose, resetState, stage]);

  const validRows = useMemo(
    () => parseResult?.rows.filter(r => r.status !== 'error') ?? [],
    [parseResult],
  );

  const errorCount = useMemo(
    () => parseResult?.rows.filter(r => r.status === 'error').length ?? 0,
    [parseResult],
  );

  const warningCount = useMemo(
    () => parseResult?.rows.filter(r => r.status === 'warning').length ?? 0,
    [parseResult],
  );

  const validCount = useMemo(
    () => parseResult?.rows.filter(r => r.status === 'valid').length ?? 0,
    [parseResult],
  );

  const filteredRows = useMemo(() => {
    if (!parseResult) {
      return [];
    }
    if (rowFilter === 'all') {
      return parseResult.rows;
    }
    return parseResult.rows.filter(r => r.status === rowFilter);
  }, [parseResult, rowFilter]);

  // === FILE PICK + PARSE ===
  const handlePickFile = useCallback(async () => {
    try {
      const picked: DocumentPickerResponse = await DocumentPicker.pickSingle({
        type: [
          documentPickerTypes.csv,
          documentPickerTypes.xlsx,
          documentPickerTypes.xls,
          // Some Android devices report Excel files as plain octet-stream;
          // also allow allFiles fallback path users can override.
        ],
        copyTo: 'cachesDirectory',
      });

      const localUri = picked.fileCopyUri || picked.uri;
      const filename = picked.name || 'schedule.csv';
      setPickedFileName(filename);
      setStage('parsing');

      const response = await fetch(localUri);
      const buffer = await response.arrayBuffer();
      const result = await parseScheduleFile(buffer, filename);

      // Annotate with overlaps against existing slots already on the calendar.
      flagOverlapsWithExisting(result.rows, existingSlots);

      // Hard cap on rows to keep the preview UI manageable.
      if (result.rows.length > ABSOLUTE_MAX_ROWS) {
        result.fatalError = `File contains ${result.rows.length} rows. Max ${ABSOLUTE_MAX_ROWS} per upload.`;
        result.rows = [];
      }

      setParseResult(result);
      setStage('preview');
    } catch (err: unknown) {
      if (isCancel(err)) {
        return;
      }
      Alert.alert(
        t('venues.uploadSchedule.pickError') || 'Could not open file',
        err instanceof Error ? err.message : 'Unknown error',
      );
      setStage('picker');
    }
  }, [existingSlots, t]);

  const handleCopyTemplate = useCallback(() => {
    const csv = buildScheduleTemplateCsv();
    Clipboard.setString(csv);
    Alert.alert(
      t('venues.uploadSchedule.templateCopied') || 'Template copied',
      t('venues.uploadSchedule.templateCopiedDesc') ||
        'Paste this into a spreadsheet app, edit it, then save as .csv or .xlsx and upload.',
    );
  }, [t]);

  // === UPLOAD ===
  // Tries POST /slots/bulk first. Falls back to N sequential POSTs if the
  // backend doesn't have the bulk endpoint yet (404).
  const handleUpload = useCallback(async () => {
    if (validRows.length === 0) {
      return;
    }

    setStage('uploading');
    setUploadProgress({done: 0, total: validRows.length});

    const token = await AsyncStorage.getItem('userToken');
    const authHeaders = token ? {Authorization: `Bearer ${token}`} : undefined;

    const slotsPayload = validRows.map(row => ({
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      name: row.name,
      description: row.description,
      category: row.category,
      ageRestriction: row.ageRestriction,
      price: row.price ?? 150,
      maxCapacity: row.maxCapacity,
    }));

    let summary: UploadResultSummary = {created: 0, failed: 0, errors: []};

    try {
      const bulkResponse = await axios.post(
        `${API_BASE_URL}/api/venues/${venueId}/spaces/${spaceId}/slots/bulk`,
        {slots: slotsPayload},
        {headers: authHeaders},
      );
      const data = bulkResponse.data || {};
      summary = {
        created: data.created ?? slotsPayload.length,
        failed: Array.isArray(data.skipped) ? data.skipped.length : 0,
        errors: Array.isArray(data.skipped)
          ? data.skipped.map((s: any, idx: number) => ({
              rowNumber:
                typeof s.rowIndex === 'number'
                  ? validRows[s.rowIndex]?.rowNumber ?? idx + 2
                  : idx + 2,
              reason: s.reason || 'Unknown',
            }))
          : [],
      };
      setUploadProgress({
        done: slotsPayload.length,
        total: slotsPayload.length,
      });
    } catch (bulkErr: any) {
      const status = bulkErr?.response?.status;
      // Fallback path: backend hasn't implemented /slots/bulk yet (404) OR
      // returned 405 method-not-allowed. Anything else, surface the error.
      if (status === 404 || status === 405) {
        for (let i = 0; i < slotsPayload.length; i++) {
          try {
            await axios.post(
              `${API_BASE_URL}/api/venues/${venueId}/spaces/${spaceId}/slots`,
              slotsPayload[i],
              {headers: authHeaders},
            );
            summary.created += 1;
          } catch (singleErr: any) {
            summary.failed += 1;
            summary.errors.push({
              rowNumber: validRows[i].rowNumber,
              reason:
                singleErr?.response?.data?.message ||
                singleErr?.message ||
                'Server error',
            });
          }
          setUploadProgress({done: i + 1, total: slotsPayload.length});
        }
      } else {
        Alert.alert(
          t('venues.uploadSchedule.uploadFailed') || 'Upload failed',
          bulkErr?.response?.data?.message ||
            bulkErr?.message ||
            'Could not reach the server',
        );
        setStage('preview');
        return;
      }
    }

    setUploadSummary(summary);
    setStage('done');
    if (summary.created > 0) {
      onUploadComplete();
    }
  }, [onUploadComplete, spaceId, t, validRows, venueId]);

  // === STYLES ===
  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: colors.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 32 : 20,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          maxHeight: '92%',
          minHeight: '50%',
        },
        handle: {
          alignSelf: 'center',
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          marginBottom: 8,
        },
        headerBlock: {
          paddingHorizontal: 16,
          paddingBottom: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
        },
        headerText: {
          flex: 1,
        },
        title: {
          color: colors.text,
          fontSize: 17,
          fontWeight: '700',
        },
        subtitle: {
          color: colors.secondaryText,
          fontSize: 12,
          marginTop: 2,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        },
        closeButton: {
          padding: 6,
        },
        // Picker stage
        pickerBody: {
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 8,
          alignItems: 'center',
        },
        bigIconWrap: {
          width: 72,
          height: 72,
          borderRadius: 20,
          backgroundColor: colors.primary + '14',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.primary + '30',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        },
        pickerTitle: {
          color: colors.text,
          fontSize: 18,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: 6,
        },
        pickerDescription: {
          color: colors.secondaryText,
          fontSize: 13,
          lineHeight: 18,
          textAlign: 'center',
          marginBottom: 20,
          maxWidth: 320,
        },
        primaryButton: {
          backgroundColor: colors.primary,
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderRadius: 24,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
          minWidth: 220,
          justifyContent: 'center',
        },
        primaryButtonText: {
          color: colors.buttonText,
          fontSize: 15,
          fontWeight: '700',
        },
        secondaryButton: {
          paddingHorizontal: 18,
          paddingVertical: 10,
          borderRadius: 22,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        },
        secondaryButtonText: {
          color: colors.secondaryText,
          fontSize: 13,
          fontWeight: '700',
        },
        formatBlock: {
          marginTop: 8,
          paddingHorizontal: 18,
          paddingVertical: 14,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.inputBackground || colors.background,
          alignSelf: 'stretch',
        },
        formatTitle: {
          color: colors.text,
          fontSize: 13,
          fontWeight: '700',
          marginBottom: 8,
        },
        formatLine: {
          color: colors.secondaryText,
          fontSize: 12,
          lineHeight: 18,
        },
        formatRequired: {
          color: colors.text,
          fontWeight: '700',
        },
        // Parsing stage
        parsingBody: {
          paddingVertical: 60,
          alignItems: 'center',
        },
        parsingText: {
          color: colors.secondaryText,
          fontSize: 14,
          marginTop: 14,
        },
        // Preview stage
        previewSummary: {
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        summaryChip: {
          flex: 1,
          alignItems: 'center',
          paddingVertical: 8,
          paddingHorizontal: 6,
          borderRadius: 10,
          borderWidth: StyleSheet.hairlineWidth,
        },
        summaryCount: {
          fontSize: 18,
          fontWeight: '700',
        },
        summaryLabel: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          marginTop: 2,
        },
        filterRow: {
          flexDirection: 'row',
          gap: 6,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        filterPill: {
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: 'transparent',
        },
        filterPillActive: {
          backgroundColor: colors.primary + '14',
          borderColor: colors.primary,
        },
        filterPillText: {
          fontSize: 12,
          fontWeight: '700',
          color: colors.secondaryText,
        },
        filterPillTextActive: {
          color: colors.primary,
        },
        rowItem: {
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
          flexDirection: 'row',
          gap: 10,
        },
        rowStatusIcon: {
          width: 22,
          alignItems: 'center',
          paddingTop: 2,
        },
        rowMain: {
          flex: 1,
        },
        rowTopLine: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        rowDate: {
          color: colors.text,
          fontSize: 14,
          fontWeight: '700',
        },
        rowTime: {
          color: colors.secondaryText,
          fontSize: 13,
          fontWeight: '600',
        },
        rowMeta: {
          color: colors.secondaryText,
          fontSize: 12,
          marginTop: 2,
        },
        rowMessage: {
          fontSize: 12,
          marginTop: 4,
          lineHeight: 16,
        },
        rowMessageError: {
          color: colors.error,
        },
        rowMessageWarn: {
          color: '#E89712',
        },
        // Footer
        footer: {
          paddingHorizontal: 16,
          paddingTop: 12,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          flexDirection: 'row',
          gap: 10,
          alignItems: 'center',
        },
        cancelButton: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 24,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignItems: 'center',
        },
        cancelButtonText: {
          color: colors.secondaryText,
          fontSize: 14,
          fontWeight: '700',
        },
        submitButton: {
          flex: 2,
          paddingVertical: 12,
          borderRadius: 24,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
        submitButtonDisabled: {
          backgroundColor: colors.border,
        },
        submitButtonText: {
          color: colors.buttonText,
          fontSize: 14,
          fontWeight: '700',
        },
        // Fatal error block
        fatalErrorWrap: {
          marginHorizontal: 16,
          marginTop: 16,
          padding: 14,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.error + '40',
          backgroundColor: colors.error + '0D',
          flexDirection: 'row',
          gap: 10,
        },
        fatalErrorText: {
          color: colors.error,
          fontSize: 13,
          flex: 1,
          lineHeight: 18,
        },
        // Uploading stage
        uploadingBody: {
          paddingVertical: 50,
          paddingHorizontal: 24,
          alignItems: 'center',
        },
        progressTrack: {
          width: '100%',
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.border,
          overflow: 'hidden',
          marginTop: 20,
        },
        progressFill: {
          height: '100%',
          backgroundColor: colors.primary,
          borderRadius: 3,
        },
        uploadingText: {
          color: colors.text,
          fontSize: 16,
          fontWeight: '700',
          marginTop: 18,
        },
        uploadingSub: {
          color: colors.secondaryText,
          fontSize: 13,
          marginTop: 4,
        },
        // Done stage
        doneBody: {
          paddingHorizontal: 24,
          paddingTop: 32,
          paddingBottom: 16,
          alignItems: 'center',
        },
        doneIcon: {
          width: 72,
          height: 72,
          borderRadius: 36,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        },
        doneTitle: {
          color: colors.text,
          fontSize: 20,
          fontWeight: '700',
          textAlign: 'center',
        },
        doneSubtitle: {
          color: colors.secondaryText,
          fontSize: 14,
          marginTop: 6,
          textAlign: 'center',
        },
        doneErrorList: {
          marginTop: 18,
          alignSelf: 'stretch',
          maxHeight: 200,
        },
        doneErrorItem: {
          flexDirection: 'row',
          gap: 8,
          paddingVertical: 8,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        doneErrorRow: {
          color: colors.text,
          fontSize: 13,
          fontWeight: '700',
        },
        doneErrorReason: {
          color: colors.secondaryText,
          fontSize: 12,
          flex: 1,
        },
      }),
    [colors],
  );

  // === RENDER HELPERS ===
  const statusIcon = (status: ParsedSlotRow['status']) => {
    if (status === 'error') {
      return (
        <FontAwesomeIcon
          icon={faCircleExclamation}
          size={16}
          color={colors.error}
        />
      );
    }
    if (status === 'warning') {
      return (
        <FontAwesomeIcon
          icon={faTriangleExclamation}
          size={16}
          color="#E89712"
        />
      );
    }
    return (
      <FontAwesomeIcon
        icon={faCheckCircle}
        size={16}
        color={colors.success || '#4CAF50'}
      />
    );
  };

  const renderRow = ({item}: {item: ParsedSlotRow}) => {
    const dateLabel = item.date || '—';
    const timeLabel =
      item.startTime && item.endTime
        ? `${item.startTime} – ${item.endTime}`
        : '—';
    const meta = [item.name, item.category, item.ageRestriction]
      .filter(Boolean)
      .join(' · ');

    return (
      <View style={styles.rowItem}>
        <View style={styles.rowStatusIcon}>{statusIcon(item.status)}</View>
        <View style={styles.rowMain}>
          <View style={styles.rowTopLine}>
            <Text style={styles.rowDate}>{dateLabel}</Text>
            <Text style={styles.rowTime}>{timeLabel}</Text>
          </View>
          {meta ? <Text style={styles.rowMeta}>{meta}</Text> : null}
          {item.errors.map((e, i) => (
            <Text
              key={`e-${i}`}
              style={[styles.rowMessage, styles.rowMessageError]}>
              • {e}
            </Text>
          ))}
          {item.warnings.map((w, i) => (
            <Text
              key={`w-${i}`}
              style={[styles.rowMessage, styles.rowMessageWarn]}>
              • {w}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  // === STAGE RENDERING ===
  const renderPickerStage = () => (
    <ScrollView contentContainerStyle={styles.pickerBody}>
      <View style={styles.bigIconWrap}>
        <FontAwesomeIcon icon={faFileLines} size={32} color={colors.primary} />
      </View>
      <Text style={styles.pickerTitle}>
        {t('venues.uploadSchedule.pickerTitle') || 'Bulk-create time slots'}
      </Text>
      <Text style={styles.pickerDescription}>
        {t('venues.uploadSchedule.pickerDescription') ||
          'Upload a CSV or Excel file to create up to 500 time slots at once. The file will be validated before anything is saved.'}
      </Text>

      <TouchableOpacity style={styles.primaryButton} onPress={handlePickFile}>
        <FontAwesomeIcon icon={faFileCsv} size={16} color={colors.buttonText} />
        <Text style={styles.primaryButtonText}>
          {t('venues.uploadSchedule.chooseFile') || 'Choose CSV or Excel File'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={handleCopyTemplate}>
        <FontAwesomeIcon
          icon={faClipboard}
          size={13}
          color={colors.secondaryText}
        />
        <Text style={styles.secondaryButtonText}>
          {t('venues.uploadSchedule.copyTemplate') || 'Copy CSV Template'}
        </Text>
      </TouchableOpacity>

      <View style={styles.formatBlock}>
        <Text style={styles.formatTitle}>
          {t('venues.uploadSchedule.formatTitle') || 'Expected columns'}
        </Text>
        <Text style={styles.formatLine}>
          <Text style={styles.formatRequired}>Date</Text> (YYYY-MM-DD),{' '}
          <Text style={styles.formatRequired}>Start Time</Text> (HH:MM),{' '}
          <Text style={styles.formatRequired}>End Time</Text> (HH:MM)
        </Text>
        <Text style={[styles.formatLine, {marginTop: 6}]}>
          {t('venues.uploadSchedule.formatOptional') || 'Optional:'} Name,
          Category, Age Restriction, Price, Max Capacity, Description
        </Text>
      </View>
    </ScrollView>
  );

  const renderParsingStage = () => (
    <View style={styles.parsingBody}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.parsingText}>
        {t('venues.uploadSchedule.parsing') || 'Reading file...'}
      </Text>
    </View>
  );

  const renderFatalError = () =>
    parseResult?.fatalError ? (
      <View style={styles.fatalErrorWrap}>
        <FontAwesomeIcon icon={faCircleInfo} size={16} color={colors.error} />
        <Text style={styles.fatalErrorText}>{parseResult.fatalError}</Text>
      </View>
    ) : null;

  const renderPreviewStage = () => {
    if (parseResult?.fatalError) {
      return (
        <ScrollView>
          {renderFatalError()}
          <View style={{padding: 16}}>
            <TouchableOpacity style={styles.cancelButton} onPress={resetState}>
              <Text style={styles.cancelButtonText}>
                {t('venues.uploadSchedule.tryAgain') || 'Try a different file'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    return (
      <View style={{flex: 1}}>
        <View style={styles.previewSummary}>
          <View
            style={[
              styles.summaryChip,
              {
                backgroundColor: (colors.success || '#4CAF50') + '14',
                borderColor: (colors.success || '#4CAF50') + '40',
              },
            ]}>
            <Text
              style={[
                styles.summaryCount,
                {color: colors.success || '#4CAF50'},
              ]}>
              {validCount}
            </Text>
            <Text
              style={[
                styles.summaryLabel,
                {color: colors.success || '#4CAF50'},
              ]}>
              {t('venues.uploadSchedule.valid') || 'Valid'}
            </Text>
          </View>
          <View
            style={[
              styles.summaryChip,
              {
                backgroundColor: '#E89712' + '14',
                borderColor: '#E89712' + '40',
              },
            ]}>
            <Text style={[styles.summaryCount, {color: '#E89712'}]}>
              {warningCount}
            </Text>
            <Text style={[styles.summaryLabel, {color: '#E89712'}]}>
              {t('venues.uploadSchedule.warnings') || 'Warnings'}
            </Text>
          </View>
          <View
            style={[
              styles.summaryChip,
              {
                backgroundColor: colors.error + '14',
                borderColor: colors.error + '40',
              },
            ]}>
            <Text style={[styles.summaryCount, {color: colors.error}]}>
              {errorCount}
            </Text>
            <Text style={[styles.summaryLabel, {color: colors.error}]}>
              {t('venues.uploadSchedule.errors') || 'Errors'}
            </Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {(['all', 'valid', 'warning', 'error'] as RowFilter[]).map(f => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterPill,
                rowFilter === f && styles.filterPillActive,
              ]}
              onPress={() => setRowFilter(f)}>
              <Text
                style={[
                  styles.filterPillText,
                  rowFilter === f && styles.filterPillTextActive,
                ]}>
                {f === 'all'
                  ? t('common.all') || 'All'
                  : f === 'valid'
                  ? t('venues.uploadSchedule.valid') || 'Valid'
                  : f === 'warning'
                  ? t('venues.uploadSchedule.warnings') || 'Warnings'
                  : t('venues.uploadSchedule.errors') || 'Errors'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <FlatList
          data={filteredRows}
          keyExtractor={item => `row-${item.rowNumber}`}
          renderItem={renderRow}
          ListEmptyComponent={
            <View style={{padding: 24, alignItems: 'center'}}>
              <Text style={{color: colors.secondaryText, fontSize: 13}}>
                {t('venues.uploadSchedule.noRowsForFilter') ||
                  'No rows match this filter'}
              </Text>
            </View>
          }
        />

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={resetState}>
            <Text style={styles.cancelButtonText}>
              {t('common.cancel') || 'Cancel'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.submitButton,
              validRows.length === 0 && styles.submitButtonDisabled,
            ]}
            onPress={handleUpload}
            disabled={validRows.length === 0}>
            <Text style={styles.submitButtonText}>
              {validRows.length === 0
                ? t('venues.uploadSchedule.fixErrorsFirst') ||
                  'Fix errors to continue'
                : (t('venues.uploadSchedule.createCount', {
                    count: validRows.length,
                  }) as string) || `Create ${validRows.length} Slots`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderUploadingStage = () => {
    const pct =
      uploadProgress.total === 0
        ? 0
        : Math.round((uploadProgress.done / uploadProgress.total) * 100);
    return (
      <View style={styles.uploadingBody}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.uploadingText}>
          {t('venues.uploadSchedule.uploading') || 'Creating slots...'}
        </Text>
        <Text style={styles.uploadingSub}>
          {uploadProgress.done} / {uploadProgress.total}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, {width: `${pct}%`}]} />
        </View>
      </View>
    );
  };

  const renderDoneStage = () => {
    if (!uploadSummary) {
      return null;
    }
    const allFailed = uploadSummary.created === 0 && uploadSummary.failed > 0;
    const partial = uploadSummary.failed > 0 && uploadSummary.created > 0;

    return (
      <ScrollView>
        <View style={styles.doneBody}>
          <View
            style={[
              styles.doneIcon,
              {
                backgroundColor: allFailed
                  ? colors.error + '15'
                  : (colors.success || '#4CAF50') + '15',
              },
            ]}>
            <FontAwesomeIcon
              icon={allFailed ? faCircleExclamation : faCheckCircle}
              size={36}
              color={allFailed ? colors.error : colors.success || '#4CAF50'}
            />
          </View>
          <Text style={styles.doneTitle}>
            {allFailed
              ? t('venues.uploadSchedule.uploadFailed') || 'Upload failed'
              : (t('venues.uploadSchedule.createdCount', {
                  count: uploadSummary.created,
                }) as string) || `Created ${uploadSummary.created} slots`}
          </Text>
          {partial ? (
            <Text style={styles.doneSubtitle}>
              {(t('venues.uploadSchedule.skippedCount', {
                count: uploadSummary.failed,
              }) as string) || `${uploadSummary.failed} skipped`}
            </Text>
          ) : null}

          {uploadSummary.errors.length > 0 ? (
            <ScrollView style={styles.doneErrorList} nestedScrollEnabled>
              {uploadSummary.errors.map((e, i) => (
                <View key={`done-err-${i}`} style={styles.doneErrorItem}>
                  <Text style={styles.doneErrorRow}>Row {e.rowNumber}:</Text>
                  <Text style={styles.doneErrorReason}>{e.reason}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, {marginTop: 22}]}
            onPress={handleClose}>
            <Text style={styles.primaryButtonText}>
              {t('common.done') || 'Done'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderStage = () => {
    switch (stage) {
      case 'picker':
        return renderPickerStage();
      case 'parsing':
        return renderParsingStage();
      case 'preview':
        return renderPreviewStage();
      case 'uploading':
        return renderUploadingStage();
      case 'done':
        return renderDoneStage();
    }
  };

  const headerSubtitle =
    stage === 'picker' || stage === 'parsing'
      ? t('venues.uploadSchedule.headerStep1') || 'Upload Schedule'
      : stage === 'preview'
      ? pickedFileName ||
        t('venues.uploadSchedule.headerStep2') ||
        'Review Rows'
      : stage === 'uploading'
      ? t('venues.uploadSchedule.headerStep3') || 'Uploading'
      : t('venues.uploadSchedule.headerStep4') || 'Done';

  const fileIcon =
    parseResult?.detectedFormat === 'xlsx' ? faFileExcel : faFileCsv;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerBlock}>
            {stage === 'preview' || stage === 'done' ? (
              <FontAwesomeIcon
                icon={fileIcon}
                size={20}
                color={colors.primary}
                style={{marginRight: 10}}
              />
            ) : null}
            <View style={styles.headerText}>
              <Text style={styles.title}>
                {t('venues.uploadSchedule.title') || 'Upload Schedule'}
              </Text>
              <Text style={styles.subtitle}>{headerSubtitle}</Text>
            </View>
            {stage !== 'uploading' ? (
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}>
                <FontAwesomeIcon
                  icon={faXmark}
                  size={18}
                  color={colors.secondaryText}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          {renderStage()}
        </View>
      </View>
    </Modal>
  );
};

export default CsvScheduleUpload;
