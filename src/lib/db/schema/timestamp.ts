import { Schema } from "effect";

/**
 * DB drivers return `timestamp` columns differently:
 * - node-postgres (local) returns `Date` instances
 * - Neon serverless and other drivers return `timestamp` strings
 *
 * Accept both so row validation works regardless of the driver.
 */
export const TimestampSchema = Schema.Union([
  Schema.Date,
  Schema.DateFromString,
]);

/**
 * Normalize a driver-dependent timestamp value into an ISO string for the
 * JSON server-function transport.
 *
 * Accepts both shapes because the DB driver decides at runtime:
 * node-postgres (local) yields `Date` instances, Neon serverless yields
 * strings — mirroring `TimestampSchema`.
 */
export function toIsoTimestamp(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  // oxlint-disable-next-line effecttsgo/global-date -- normalizing driver-dependent row values requires a Date round-trip
  return new Date(value).toISOString();
}
