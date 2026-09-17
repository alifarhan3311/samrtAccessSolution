/**
 * Returns the current date in Canada Eastern Time (America/Toronto)
 * Format: YYYY-MM-DD
 * This ensures that dates are consistent across the app, regardless of the user's local timezone.
 */
export function getTorontoDateString(val) {
  const d = val ? new Date(val) : new Date();
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' });
}

export function getTorontoDateMedium(val) {
  const d = val ? new Date(val) : new Date();
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium' });
}

export function getTorontoDateTime(val) {
  const d = val ? new Date(val) : new Date();
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }) + 'T' + d.toLocaleTimeString('en-CA', { timeZone: 'America/Toronto', hour12: false, hour: '2-digit', minute: '2-digit' });
}

export function isOlderThan3Days(val) {
  if (!val) return true; // If no date provided, treat it as outdated (red)
  const d = new Date(val);
  if (isNaN(d.getTime())) return true; // Treat "N/A" or invalid dates as outdated (red)
  const nowCanadaStr = new Date().toLocaleString('en-US', { timeZone: 'America/Toronto' });
  const nowCanada = new Date(nowCanadaStr);
  const diffHours = (nowCanada.getTime() - d.getTime()) / (1000 * 60 * 60);
  return diffHours > 72;
}
