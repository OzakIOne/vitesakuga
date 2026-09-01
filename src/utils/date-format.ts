/**
 * Shared UTC date formatter.
 *
 * Fixed locale + fixed time zone keep server and client output identical
 * (no hydration mismatch).
 *
 * Accepts anything `new Date()` understands because timestamps that travel
 * through JSON (server-function payloads, react-query cache) arrive as ISO
 * strings, not `Date` instances. Invalid or missing values render as an
 * empty string instead of throwing "Invalid time value" from `Intl.format`.
 */
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

export function formatDateUtc(
  date: Date | string | number | null | undefined,
): string {
  // oxlint-disable-next-line effecttsgo/global-date -- JSON payloads deliver timestamps as strings, not Dates
  const value = date instanceof Date ? date : new Date(date ?? "");
  if (Number.isNaN(value.getTime())) {
    return "";
  }
  return DATE_FORMATTER.format(value);
}
