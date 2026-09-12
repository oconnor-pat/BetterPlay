/** Prefer venue Place name, then profile name, then username. */
export function authorDisplayName(author: {
  accountType?: 'user' | 'venue' | string;
  name?: string | null;
  username?: string | null;
}): string {
  const name = (author.name || '').trim();
  const username = (author.username || '').trim();
  if (author.accountType === 'venue') {
    return name || username || 'Venue';
  }
  return name || username || 'Someone';
}

export function isVenueAuthor(author: {
  accountType?: 'user' | 'venue' | string;
}): boolean {
  return author.accountType === 'venue';
}
