import { Effect, Schema } from "effect";

export const MAX_PAGE_NUMBER = 10_000;

export const PageNumberSchema = Schema.Number.pipe(
  Schema.check(Schema.isInt()),
  Schema.check(Schema.isGreaterThanOrEqualTo(0)),
  Schema.check(
    Schema.isLessThanOrEqualTo(MAX_PAGE_NUMBER, {
      message: `Page number must not exceed ${MAX_PAGE_NUMBER}`,
    }),
  ),
);

export const PageNumberWithDefaultSchema = PageNumberSchema.pipe(
  Schema.withDecodingDefault(Effect.succeed(0)),
);
