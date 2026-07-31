/**
 * Shared parsing for an event's stored date + time.
 *
 * Event dates are persisted in two shapes and both are still in the database:
 *   - "YYYY-MM-DD"        — recurring series, written server-side
 *   - "Fri Jul 24 2026"   — Date.toDateString(), written by the form's picker
 *
 * Times are similarly inconsistent: "6:30 PM", "10:31PM" (no space) or "18:30".
 *
 * The naive `new Date(\`${date} ${time}\`)` / `new Date(\`${date}T${time}\`)`
 * yields an Invalid Date for several of these combinations, which silently
 * poisons comparisons (NaN) and scrambles sorts. Route every date/time
 * comparison through these helpers instead.
 */

/**
 * Parse a stored event date into a *local* Date at midnight.
 *
 * `new Date("2026-07-17")` parses as UTC midnight, which rolls back a calendar
 * day in any negative-offset timezone (e.g. US Eastern) — so an event dated
 * tomorrow reads as today. Build from local components for that format.
 */
export const parseEventDateLocal = (dateString: string): Date => {
  const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, mo, d] = isoMatch;
    return new Date(Number(y), Number(mo) - 1, Number(d));
  }
  const parsed = new Date(dateString);
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

/**
 * Resolve an event's date + time into a single local Date, or null when the
 * stored values can't be parsed at all.
 */
export const getEventDateTime = (
  eventDate?: string,
  eventTime?: string,
): Date | null => {
  if (!eventDate) {
    return null;
  }

  // Strip a leading day name ("Fri ", "Mon ", ...) if present.
  const cleanDate = eventDate.replace(/^[A-Za-z]{3}\s+/, '');

  let eventDateTime: Date | null = null;

  // ISO calendar date, parsed in local time (see parseEventDateLocal).
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    eventDateTime = parseEventDateLocal(cleanDate);
  }

  // "Jan 23 2026" / "Jan 23, 2026"
  const monthDayYearMatch = cleanDate.match(
    /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/,
  );
  if ((!eventDateTime || isNaN(eventDateTime.getTime())) && monthDayYearMatch) {
    const [, month, day, year] = monthDayYearMatch;
    eventDateTime = new Date(`${month} ${day}, ${year}`);
  }

  // Fall back to letting the engine try, first without then with the day name.
  if (!eventDateTime || isNaN(eventDateTime.getTime())) {
    eventDateTime = new Date(cleanDate);
  }
  if (!eventDateTime || isNaN(eventDateTime.getTime())) {
    eventDateTime = new Date(eventDate);
  }
  if (!eventDateTime || isNaN(eventDateTime.getTime())) {
    return null;
  }

  // Time: "6:30 PM", "10:31PM" or "18:30". Missing/unparseable time means
  // midnight, which keeps day-level ordering sensible.
  let hours = 0;
  let minutes = 0;
  const timeMatch = eventTime?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (timeMatch) {
    hours = parseInt(timeMatch[1], 10);
    minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3]?.toUpperCase();
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
  }

  eventDateTime.setHours(hours, minutes, 0, 0);
  return eventDateTime;
};

/**
 * How long an event is assumed to run when it has no explicit end time. Used to
 * decide whether a started event is still "happening now" rather than over.
 */
export const ASSUMED_EVENT_DURATION_MS = 3 * 60 * 60 * 1000;

/**
 * True once an event's start time has passed. An unparseable date is treated as
 * not past so a malformed record never silently disappears from a list.
 */
export const isEventPast = (eventDate?: string, eventTime?: string): boolean => {
  const eventDateTime = getEventDateTime(eventDate, eventTime);
  return eventDateTime ? eventDateTime.getTime() < Date.now() : false;
};

/**
 * True while an event is underway — it has started but is still within its
 * assumed duration. Matches the "Happening Now" window used on event cards.
 */
export const isEventLive = (eventDate?: string, eventTime?: string): boolean => {
  const eventDateTime = getEventDateTime(eventDate, eventTime);
  if (!eventDateTime) {
    return false;
  }
  const elapsed = Date.now() - eventDateTime.getTime();
  return elapsed >= 0 && elapsed < ASSUMED_EVENT_DURATION_MS;
};

/**
 * True when an event is still relevant: either yet to start, or currently
 * underway. This is the test for "active / not expired".
 */
export const isEventActive = (
  eventDate?: string,
  eventTime?: string,
): boolean => {
  const eventDateTime = getEventDateTime(eventDate, eventTime);
  if (!eventDateTime) {
    return false;
  }
  return Date.now() - eventDateTime.getTime() < ASSUMED_EVENT_DURATION_MS;
};
