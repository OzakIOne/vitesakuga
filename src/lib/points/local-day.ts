import { DateTime } from "effect";

/**
 * Calendar-day boundaries for daily-cap windows.
 *
 * The boundaries are resolved through the zone's own rules: wall-clock
 * midnight is constructed in the IANA zone and converted back to an instant
 * by the zone, so a DST transition day (23 or 25 hours) yields the true local
 * midnight instead of drifting by the offset change — which is what the
 * equivalent "instant minus wall-clock fields" arithmetic produces.
 */

/**
 * The epoch instant of local midnight for the calendar day containing
 * `instant`, in `zone` (the server's local zone by default).
 */
export const startOfLocalDay = (
  instant: number,
  zone: DateTime.TimeZone = DateTime.zoneMakeLocal(),
): number => {
  const parts = DateTime.toParts(
    DateTime.makeZonedUnsafe(instant, { timeZone: zone }),
  );
  return DateTime.toEpochMillis(
    DateTime.makeZonedUnsafe(
      {
        day: parts.day,
        hour: 0,
        millisecond: 0,
        minute: 0,
        month: parts.month,
        second: 0,
        year: parts.year,
      },
      { adjustForTimeZone: true, timeZone: zone },
    ),
  );
};

/**
 * The epoch instant of the local midnight that follows the calendar day
 * containing `instant`, in `zone` (the server's local zone by default). The
 * day span is calendar-aware, so it is 23, 24 or 25 hours long depending on
 * the zone's DST rules.
 */
export const nextLocalMidnight = (
  instant: number,
  zone: DateTime.TimeZone = DateTime.zoneMakeLocal(),
): number => {
  const startOfDay = DateTime.makeZonedUnsafe(startOfLocalDay(instant, zone), {
    timeZone: zone,
  });
  return DateTime.toEpochMillis(DateTime.add(startOfDay, { days: 1 }));
};
