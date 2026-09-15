/**
 * Returns the current date in Canada Eastern Time (America/Toronto)
 * Format: YYYY-MM-DD
 * This ensures that dates are consistent across the app, regardless of the user's local timezone.
 */
export function getTorontoDateString(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
}
