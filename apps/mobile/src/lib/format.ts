/**
 * Nara Formatting Utilities
 * Shared date/time formatting for the Feed and Note Detail screens.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Returns a human-readable relative date label.
 * "Today", "Yesterday", or "Monday Jun 16"
 */
export function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (startOfDate.getTime() === startOfToday.getTime()) return 'Today';
  if (startOfDate.getTime() === startOfYesterday.getTime()) return 'Yesterday';

  // "Monday Jun 16"
  const dayName = DAYS[date.getDay()];
  const monthName = MONTHS_SHORT[date.getMonth()];
  return `${dayName} ${monthName} ${date.getDate()}`;
}

/**
 * Returns a compact timestamp for note cards.
 * "Mon · 8:47 AM"
 */
export function formatTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  const dayShort = DAYS_SHORT[date.getDay()];

  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  const displayMin = minutes < 10 ? `0${minutes}` : `${minutes}`;

  return `${dayShort} · ${displayHour}:${displayMin} ${ampm}`;
}

/**
 * Returns the section key used for grouping notes by day.
 * "Today", "Yesterday", or "Monday Jun 16"
 * Identical to formatRelativeDate — aliased for clarity.
 */
export function formatSectionDate(isoDate: string): string {
  return formatRelativeDate(isoDate);
}
