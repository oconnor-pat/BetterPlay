// Shared event-type → role/position helpers for join + RSVP flows.

export const TEAM_SPORTS = [
  'Basketball',
  'Hockey',
  'Soccer',
  'Football',
  'Rugby',
  'Baseball',
  'Softball',
  'Lacrosse',
  'Volleyball',
];

export const POSITION_OPTIONS: Record<string, string[]> = {
  Basketball: ['Guard', 'Forward', 'Center'],
  Hockey: ['Forward', 'Defense', 'Goalie'],
  Soccer: ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'],
  'Figure Skating': ['Singles', 'Pairs', 'Ice Dance'],
  Tennis: ['Singles', 'Doubles'],
  Golf: ['Player'],
  Football: [
    'Quarterback',
    'Running Back',
    'Wide Receiver',
    'Lineman',
    'Defense',
  ],
  Rugby: ['Forward', 'Back'],
  Baseball: ['Pitcher', 'Catcher', 'Infield', 'Outfield'],
  Softball: ['Pitcher', 'Catcher', 'Infield', 'Outfield'],
  Lacrosse: ['Attack', 'Midfield', 'Defense', 'Goalie'],
  Volleyball: ['Setter', 'Outside Hitter', 'Middle Blocker', 'Libero'],
  'Trivia Night': ['Player', 'Team Captain', 'Host'],
  'Game Night': ['Player', 'Host'],
  Karaoke: ['Singer', 'Audience'],
  'Open Mic': ['Performer', 'Audience'],
  'Watch Party': ['Attendee', 'Host'],
  'Live Music': ['Attendee'],
  Hiking: ['Hiker', 'Guide'],
  Cycling: ['Cyclist', 'Guide'],
  Running: ['Runner', 'Pacer'],
  Yoga: ['Participant', 'Instructor'],
  Fishing: ['Angler'],
  Camping: ['Camper', 'Organizer'],
  'Book Club': ['Reader', 'Discussion Leader'],
  Workshop: ['Participant', 'Instructor'],
  Meetup: ['Attendee', 'Organizer'],
  Potluck: ['Guest', 'Host'],
  Volunteer: ['Volunteer', 'Coordinator'],
  Other: ['Participant'],
  Default: ['Participant'],
};

export const isTeamSportType = (eventType?: string | null): boolean =>
  !!eventType &&
  TEAM_SPORTS.some(s => s.toLowerCase() === String(eventType).toLowerCase());

export const positionsForEventType = (eventType?: string | null): string[] => {
  if (!eventType) {
    return POSITION_OPTIONS.Default;
  }
  return POSITION_OPTIONS[eventType] || POSITION_OPTIONS.Default;
};

export type JoinDetails = {
  position: string;
  jerseyColor: string;
  paidStatus: string;
};

/** Silent defaults when the event has no meaningful choices to prompt for. */
export const defaultJoinDetails = (event: {
  eventType?: string;
  jerseyColors?: string[];
  trackPayment?: boolean;
}): JoinDetails => {
  const positions = positionsForEventType(event.eventType);
  const team = isTeamSportType(event.eventType);
  const jerseys = (event.jerseyColors || []).filter(Boolean);
  return {
    position: positions[0] || 'Participant',
    jerseyColor: team ? jerseys[0] || 'N/A' : 'N/A',
    paidStatus: team && event.trackPayment ? 'Unpaid' : 'N/A',
  };
};

/**
 * Prompt when the user has a real choice: multiple roles, team jersey, or
 * payment tracking. Single-role non-team events join as Participant quietly.
 */
export const needsJoinDetailsPrompt = (event: {
  eventType?: string;
  jerseyColors?: string[];
  trackPayment?: boolean;
}): boolean => {
  const positions = positionsForEventType(event.eventType);
  if (positions.length > 1) {
    return true;
  }
  if (isTeamSportType(event.eventType) && (event.jerseyColors || []).length >= 2) {
    return true;
  }
  if (isTeamSportType(event.eventType) && event.trackPayment) {
    return true;
  }
  return false;
};
