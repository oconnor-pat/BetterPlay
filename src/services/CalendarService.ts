import {Alert} from 'react-native';
import {addCalendarEventIntent} from 'react-native-add-calendar-event-intent';
import {
  ASSUMED_EVENT_DURATION_MS,
  getEventDateTime,
} from '../utils/eventDateTime';

export type CalendarEventInput = {
  title: string;
  date?: string;
  time?: string;
  durationMinutes?: number;
  location?: string;
  description?: string;
  eventType?: string;
};

/**
 * Opens the system "add calendar event" sheet with the event prefilled.
 * One-shot export — does not sync or write without the user confirming.
 */
export const addEventToCalendar = async (
  event: CalendarEventInput,
  t: (key: string, options?: {defaultValue?: string}) => string,
): Promise<void> => {
  const start = getEventDateTime(event.date, event.time);
  if (!start) {
    Alert.alert(
      t('events.calendarError', {defaultValue: "Couldn't add to calendar"}),
      t('events.calendarMissingDate', {
        defaultValue: 'This event is missing a valid date or time.',
      }),
    );
    return;
  }

  const durationMs =
    typeof event.durationMinutes === 'number' && event.durationMinutes > 0
      ? event.durationMinutes * 60 * 1000
      : ASSUMED_EVENT_DURATION_MS;
  const end = new Date(start.getTime() + durationMs);

  const descriptionParts = [
    event.eventType ? `${event.eventType}` : null,
    event.description?.trim() || null,
    'Added from BetterPlay',
  ].filter(Boolean);

  try {
    await addCalendarEventIntent({
      title: event.title,
      description: descriptionParts.join('\n\n'),
      location: event.location || undefined,
      startAt: start.getTime(),
      endAt: end.getTime(),
      allDay: false,
    });
  } catch {
    Alert.alert(
      t('events.calendarError', {defaultValue: "Couldn't add to calendar"}),
      t('events.calendarErrorMessage', {
        defaultValue:
          'Please make sure a calendar app is installed and try again.',
      }),
    );
  }
};
