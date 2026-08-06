import { Effect, Schema, SchemaGetter } from "effect";

export const fetchUserInputSchema = Schema.Struct({
  page: Schema.Number.pipe(
    Schema.check(Schema.isGreaterThanOrEqualTo(0)),
    Schema.withDecodingDefault(Effect.succeed(0)),
  ),
  q: Schema.String.pipe(
    Schema.decode({
      decode: SchemaGetter.transform((val) => val.trim()),
      encode: SchemaGetter.transform((val) => val),
    }),
    Schema.withDecodingDefault(Effect.succeed("")),
  ),
  tags: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed([])),
  ),
  userId: Schema.String,
});

export type FetchUserInput = Schema.Schema.Type<typeof fetchUserInputSchema>;
