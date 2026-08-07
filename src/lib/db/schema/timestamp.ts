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
