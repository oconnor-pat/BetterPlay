/** Username rules match BE usernameService: 3–20 alphanumeric / underscore. */
const MENTION_TOKEN_RE = /(?:^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{3,20})\b/g;

export type MentionSegment =
  | {type: 'text'; value: string}
  | {type: 'mention'; value: string; username: string};

export type ActiveMention = {
  /** Index of the `@` in the full string. */
  start: number;
  /** Query after `@` (may be empty). */
  query: string;
};

/** Unique usernames mentioned in text (lowercased for matching). */
export function extractMentionUsernames(text: string): string[] {
  if (!text) {
    return [];
  }
  const found = new Set<string>();
  const re = new RegExp(MENTION_TOKEN_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    found.add(match[1].toLowerCase());
  }
  return [...found];
}

/** Split plain text into text + @mention segments for rich rendering. */
export function splitMentionSegments(text: string): MentionSegment[] {
  if (!text) {
    return [];
  }
  const segments: MentionSegment[] = [];
  const re = new RegExp(MENTION_TOKEN_RE.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const full = match[0];
    const username = match[1];
    const atIndex = match.index + (full.startsWith('@') ? 0 : 1);
    if (atIndex > lastIndex) {
      segments.push({type: 'text', value: text.slice(lastIndex, atIndex)});
    }
    segments.push({
      type: 'mention',
      value: `@${username}`,
      username,
    });
    lastIndex = atIndex + username.length + 1;
  }
  if (lastIndex < text.length) {
    segments.push({type: 'text', value: text.slice(lastIndex)});
  }
  return segments.length ? segments : [{type: 'text', value: text}];
}

/**
 * If the cursor sits in an @query token (e.g. "@al"), return that active
 * mention so the composer can show suggestions.
 */
export function getActiveMention(
  text: string,
  cursor: number,
): ActiveMention | null {
  const safeCursor = Math.max(0, Math.min(cursor, text.length));
  const before = text.slice(0, safeCursor);
  const match = before.match(/(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]{0,20})$/);
  if (!match) {
    return null;
  }
  const atOffset = match[0].startsWith('@') ? 0 : 1;
  const start = before.length - match[0].length + atOffset;
  return {start, query: match[2]};
}

/** Insert `@username ` replacing the active @query. */
export function applyMention(
  text: string,
  active: ActiveMention,
  username: string,
): {text: string; cursor: number} {
  const before = text.slice(0, active.start);
  const after = text.slice(active.start + 1 + active.query.length);
  const insertion = `@${username} `;
  const next = `${before}${insertion}${after}`;
  return {text: next, cursor: before.length + insertion.length};
}

export type MentionCandidate = {
  userId: string;
  username: string;
  name?: string;
  profilePicUrl?: string;
};

export function filterMentionCandidates(
  candidates: MentionCandidate[],
  query: string,
  excludeUserId?: string | null,
  limit = 6,
): MentionCandidate[] {
  const q = query.trim().toLowerCase();
  const seen = new Set<string>();
  const out: MentionCandidate[] = [];
  for (const c of candidates) {
    if (!c?.username || !c?.userId) {
      continue;
    }
    if (excludeUserId && c.userId === excludeUserId) {
      continue;
    }
    const key = c.userId;
    if (seen.has(key)) {
      continue;
    }
    const uname = c.username.toLowerCase();
    const name = (c.name || '').toLowerCase();
    if (q && !uname.startsWith(q) && !name.includes(q)) {
      continue;
    }
    seen.add(key);
    out.push(c);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
}
