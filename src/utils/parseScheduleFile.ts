import * as XLSX from 'xlsx';

// Keep these in sync with CATEGORY_OPTIONS / AGE_RESTRICTION_OPTIONS in
// src/components/Venues/SpaceDetail.tsx. The parser does case-insensitive +
// punctuation-insensitive matching so admins don't have to type the canonical
// casing exactly.
const CATEGORY_OPTIONS = [
  'Hockey',
  'Figure Skating',
  'Open Skate',
  'Freestyle',
  'Learn to Skate',
  'Broomball',
  'Curling',
  'Private Event',
];

const AGE_RESTRICTION_OPTIONS = [
  'All Ages',
  '18+',
  '21+',
  'Youth Only',
  'Seniors (55+)',
  'Adults Only',
];

// Header aliases we accept from the spreadsheet. Match is case-insensitive and
// strips spaces/underscores/hyphens.
const HEADER_ALIASES: Record<string, string[]> = {
  date: ['date', 'day', 'eventdate'],
  startTime: ['starttime', 'start', 'from', 'begin', 'begintime'],
  endTime: ['endtime', 'end', 'to', 'finish', 'finishtime'],
  name: ['name', 'slotname', 'title', 'event', 'eventname'],
  category: ['category', 'type', 'activity'],
  ageRestriction: ['agerestriction', 'age', 'agegroup', 'agelimit'],
  price: ['price', 'cost', 'rate', 'fee'],
  maxCapacity: ['maxcapacity', 'capacity', 'max', 'limit', 'spots'],
  description: ['description', 'notes', 'note', 'details', 'comment'],
};

const REQUIRED_HEADERS: Array<keyof typeof HEADER_ALIASES> = [
  'date',
  'startTime',
  'endTime',
];

export interface ParsedSlotRow {
  rowNumber: number;
  date: string; // YYYY-MM-DD (normalized)
  startTime: string; // HH:MM (normalized, 24h)
  endTime: string; // HH:MM (normalized, 24h)
  name?: string;
  category?: string;
  ageRestriction?: string;
  price?: number;
  maxCapacity?: number;
  description?: string;
  status: 'valid' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
  raw: Record<string, string>;
}

export interface ParseResult {
  rows: ParsedSlotRow[];
  fatalError?: string;
  detectedFormat: 'csv' | 'xlsx' | 'unknown';
}

const normalizeHeader = (s: string): string =>
  s.toLowerCase().replace(/[\s_-]+/g, '');

const stripPunct = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[\s_+()-]+/g, '')
    .trim();

const matchOption = (value: string, options: string[]): string | undefined => {
  if (!value) {
    return undefined;
  }
  const target = stripPunct(value);
  return options.find(opt => stripPunct(opt) === target);
};

const detectFormat = (filename: string): 'csv' | 'xlsx' | 'unknown' => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.csv')) {
    return 'csv';
  }
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return 'xlsx';
  }
  return 'unknown';
};

// Normalize a date cell. Accepts:
//   - YYYY-MM-DD (preferred)
//   - YYYY/MM/DD
//   - MM/DD/YYYY (US)
//   - Date objects (xlsx returns these for date-typed cells)
//   - Excel serial numbers when cellDates: false (we set true so this is rare)
const normalizeDate = (raw: unknown): {value?: string; error?: string} => {
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) {
      return {error: 'Invalid date'};
    }
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return {value: `${y}-${m}-${d}`};
  }

  const s = String(raw ?? '').trim();
  if (!s) {
    return {error: 'Date is required'};
  }

  // YYYY-MM-DD or YYYY/MM/DD
  let match = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    const [, y, m, d] = match;
    const mi = parseInt(m, 10);
    const di = parseInt(d, 10);
    if (mi < 1 || mi > 12 || di < 1 || di > 31) {
      return {error: `Invalid date: ${s}`};
    }
    return {
      value: `${y}-${String(mi).padStart(2, '0')}-${String(di).padStart(
        2,
        '0',
      )}`,
    };
  }

  // MM/DD/YYYY
  match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, m, d, y] = match;
    const mi = parseInt(m, 10);
    const di = parseInt(d, 10);
    if (mi < 1 || mi > 12 || di < 1 || di > 31) {
      return {error: `Invalid date: ${s}`};
    }
    return {
      value: `${y}-${String(mi).padStart(2, '0')}-${String(di).padStart(
        2,
        '0',
      )}`,
    };
  }

  return {error: `Unrecognized date format: "${s}" (use YYYY-MM-DD)`};
};

// Normalize a time cell to 24-hour HH:MM. Accepts:
//   - HH:MM (24h)
//   - H:MM AM/PM, H AM/PM
//   - Excel time fractions (handled when xlsx returns Date)
const normalizeTime = (raw: unknown): {value?: string; error?: string} => {
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) {
      return {error: 'Invalid time'};
    }
    const h = String(raw.getHours()).padStart(2, '0');
    const m = String(raw.getMinutes()).padStart(2, '0');
    return {value: `${h}:${m}`};
  }

  const s = String(raw ?? '').trim();
  if (!s) {
    return {error: 'Time is required'};
  }

  // 12-hour with AM/PM
  let match = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)$/);
  if (match) {
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2] || '0', 10);
    const isPm = match[3].toLowerCase() === 'pm';
    if (h < 1 || h > 12 || m < 0 || m > 59) {
      return {error: `Invalid time: ${s}`};
    }
    if (h === 12) {
      h = 0;
    }
    if (isPm) {
      h += 12;
    }
    return {
      value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    };
  }

  // 24-hour
  match = s.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      return {error: `Invalid time: ${s}`};
    }
    return {
      value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    };
  }

  return {error: `Unrecognized time format: "${s}"`};
};

const isOnHalfHourGrid = (hhmm: string): boolean => {
  const m = parseInt(hhmm.split(':')[1], 10);
  return m === 0 || m === 30;
};

const validateRow = (
  row: Record<string, unknown>,
  rowNumber: number,
  headerMap: Record<keyof typeof HEADER_ALIASES, string | undefined>,
): ParsedSlotRow => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const raw: Record<string, string> = {};

  const get = (key: keyof typeof HEADER_ALIASES): unknown => {
    const colName = headerMap[key];
    if (!colName) {
      return undefined;
    }
    const v = row[colName];
    if (v !== undefined && v !== null && v !== '') {
      raw[key] = v instanceof Date ? v.toISOString() : String(v);
    }
    return v;
  };

  const dateResult = normalizeDate(get('date'));
  if (dateResult.error) {
    errors.push(dateResult.error);
  }

  const startResult = normalizeTime(get('startTime'));
  if (startResult.error) {
    errors.push(`Start time: ${startResult.error}`);
  } else if (startResult.value && !isOnHalfHourGrid(startResult.value)) {
    warnings.push('Start time is not on the :00/:30 grid');
  }

  const endResult = normalizeTime(get('endTime'));
  if (endResult.error) {
    errors.push(`End time: ${endResult.error}`);
  } else if (endResult.value && !isOnHalfHourGrid(endResult.value)) {
    warnings.push('End time is not on the :00/:30 grid');
  }

  if (
    startResult.value &&
    endResult.value &&
    startResult.value >= endResult.value
  ) {
    errors.push('Start time must be before end time');
  }

  const nameRaw = get('name');
  const name = nameRaw ? String(nameRaw).trim() : undefined;

  const categoryRaw = get('category');
  let category: string | undefined;
  if (categoryRaw) {
    const matched = matchOption(String(categoryRaw), CATEGORY_OPTIONS);
    if (matched) {
      category = matched;
    } else {
      warnings.push(
        `Category "${String(categoryRaw)}" doesn't match a known option`,
      );
      category = String(categoryRaw).trim();
    }
  }

  const ageRaw = get('ageRestriction');
  let ageRestriction: string | undefined;
  if (ageRaw) {
    const matched = matchOption(String(ageRaw), AGE_RESTRICTION_OPTIONS);
    if (matched) {
      ageRestriction = matched;
    } else {
      warnings.push(
        `Age restriction "${String(ageRaw)}" doesn't match a known option`,
      );
      ageRestriction = String(ageRaw).trim();
    }
  }

  const priceRaw = get('price');
  let price: number | undefined;
  if (priceRaw !== undefined && priceRaw !== '') {
    const parsed = parseFloat(String(priceRaw).replace(/[$,]/g, ''));
    if (isNaN(parsed) || parsed < 0) {
      errors.push(`Invalid price: "${String(priceRaw)}"`);
    } else {
      price = parsed;
    }
  }

  const capRaw = get('maxCapacity');
  let maxCapacity: number | undefined;
  if (capRaw !== undefined && capRaw !== '') {
    const parsed = parseInt(String(capRaw), 10);
    if (isNaN(parsed) || parsed < 1) {
      errors.push(`Invalid max capacity: "${String(capRaw)}"`);
    } else {
      maxCapacity = parsed;
    }
  }

  const descRaw = get('description');
  const description = descRaw ? String(descRaw).trim() : undefined;

  const status: ParsedSlotRow['status'] =
    errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';

  return {
    rowNumber,
    date: dateResult.value || '',
    startTime: startResult.value || '',
    endTime: endResult.value || '',
    name,
    category,
    ageRestriction,
    price,
    maxCapacity,
    description,
    status,
    errors,
    warnings,
    raw,
  };
};

// Build a map from canonical field name -> the actual header string in the file
const buildHeaderMap = (
  actualHeaders: string[],
): {
  headerMap: Record<keyof typeof HEADER_ALIASES, string | undefined>;
  missingRequired: string[];
} => {
  const normalizedActuals = actualHeaders.map(h => ({
    raw: h,
    norm: normalizeHeader(h),
  }));

  const headerMap = {} as Record<
    keyof typeof HEADER_ALIASES,
    string | undefined
  >;

  (Object.keys(HEADER_ALIASES) as Array<keyof typeof HEADER_ALIASES>).forEach(
    key => {
      const aliases = HEADER_ALIASES[key];
      const found = normalizedActuals.find(a => aliases.includes(a.norm));
      headerMap[key] = found?.raw;
    },
  );

  const missingRequired = REQUIRED_HEADERS.filter(k => !headerMap[k]).map(
    k => k as string,
  );

  return {headerMap, missingRequired};
};

// Detect duplicate rows within the upload (same date + same start/end window).
const flagInternalDuplicates = (rows: ParsedSlotRow[]): void => {
  const seen = new Map<string, number>();
  rows.forEach(row => {
    if (row.status === 'error' || !row.date || !row.startTime) {
      return;
    }
    const key = `${row.date}|${row.startTime}|${row.endTime}`;
    const firstIdx = seen.get(key);
    if (firstIdx !== undefined) {
      row.warnings.push(
        `Duplicate of row ${rows[firstIdx].rowNumber} (same date + time)`,
      );
      if (row.status === 'valid') {
        row.status = 'warning';
      }
    } else {
      seen.set(key, rows.indexOf(row));
    }
  });
};

const parseWorkbook = (workbook: XLSX.WorkBook): ParseResult => {
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {rows: [], fatalError: 'File has no sheets', detectedFormat: 'xlsx'};
  }
  const sheet = workbook.Sheets[firstSheetName];
  // raw: false converts everything to formatted strings/numbers we can parse;
  // dateNF preserves how dates render. We rely on cellDates (set in XLSX.read)
  // to give us actual Date objects for date/time cells.
  const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    raw: true,
    defval: '',
  });

  if (json.length === 0) {
    return {
      rows: [],
      fatalError: 'File contains no data rows',
      detectedFormat: 'xlsx',
    };
  }

  const headers = Object.keys(json[0]);
  const {headerMap, missingRequired} = buildHeaderMap(headers);

  if (missingRequired.length > 0) {
    return {
      rows: [],
      fatalError: `Missing required column(s): ${missingRequired.join(
        ', ',
      )}. Found columns: ${headers.join(', ')}`,
      detectedFormat: 'xlsx',
    };
  }

  const rows = json.map((row, idx) => validateRow(row, idx + 2, headerMap));
  flagInternalDuplicates(rows);

  return {rows, detectedFormat: 'xlsx'};
};

export const parseScheduleFile = async (
  fileBuffer: ArrayBuffer,
  filename: string,
): Promise<ParseResult> => {
  const format = detectFormat(filename);

  try {
    // SheetJS auto-detects CSV vs XLSX from the raw bytes when given a typed
    // array, so a single code path works for both formats. Avoids depending
    // on a global TextDecoder (not guaranteed across all RN/Hermes versions).
    const workbook = XLSX.read(new Uint8Array(fileBuffer), {
      type: 'array',
      cellDates: true,
    });

    return {...parseWorkbook(workbook), detectedFormat: format};
  } catch (err: unknown) {
    return {
      rows: [],
      fatalError: `Couldn't parse file: ${
        err instanceof Error ? err.message : 'unknown error'
      }`,
      detectedFormat: format,
    };
  }
};

// Generate a CSV template string for the "Download Template" button.
export const buildScheduleTemplateCsv = (): string => {
  const header = [
    'Date',
    'Start Time',
    'End Time',
    'Name',
    'Category',
    'Age Restriction',
    'Price',
    'Max Capacity',
    'Description',
  ].join(',');

  const today = new Date();
  const fmt = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const sample1 = [
    fmt(today),
    '18:00',
    '19:30',
    'Adult Pickup Hockey',
    'Hockey',
    '18+',
    '200',
    '30',
    'Bring goalie if available',
  ].join(',');

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const sample2 = [
    fmt(tomorrow),
    '06:00',
    '07:00',
    'Public Skate',
    'Open Skate',
    'All Ages',
    '12',
    '',
    '',
  ].join(',');

  return [header, sample1, sample2, ''].join('\n');
};

// Detect rows that overlap any existing time slot already in the database.
// Pass in the existing slots for the *date range* covered by the upload.
export interface ExistingSlotIndex {
  // Map of date (YYYY-MM-DD) -> array of {startTime, endTime} on that date
  [date: string]: Array<{startTime: string; endTime: string}>;
}

export const flagOverlapsWithExisting = (
  rows: ParsedSlotRow[],
  existing: ExistingSlotIndex,
): void => {
  rows.forEach(row => {
    if (row.status === 'error' || !row.date || !row.startTime || !row.endTime) {
      return;
    }
    const onDay = existing[row.date];
    if (!onDay || onDay.length === 0) {
      return;
    }
    const overlapping = onDay.find(
      slot => row.startTime < slot.endTime && row.endTime > slot.startTime,
    );
    if (overlapping) {
      row.warnings.push(
        `Overlaps existing slot ${overlapping.startTime}–${overlapping.endTime}`,
      );
      if (row.status === 'valid') {
        row.status = 'warning';
      }
    }
  });
};
