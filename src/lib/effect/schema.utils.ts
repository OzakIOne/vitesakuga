import { Schema } from "effect";

export const parse =
  <S extends Schema.Decoder<unknown>>(schema: S) =>
  (input: unknown): S["Type"] =>
    Schema.decodeUnknownSync(schema)(input);

export const parseStrict =
  <S extends Schema.Decoder<unknown>>(schema: S) =>
  (input: unknown): S["Type"] =>
    Schema.decodeUnknownSync(schema)(input, { onExcessProperty: "error" });

export const safeParseStrict =
  <S extends Schema.Decoder<unknown>>(schema: S) =>
  (
    input: unknown,
  ):
    | { success: true; data: S["Type"] }
    | { success: false; message: string } => {
    const exit = Schema.decodeUnknownExit(schema)(input, {
      onExcessProperty: "error",
    });
    if (exit._tag === "Success") {
      return { success: true, data: exit.value };
    }
    const messages = exit.cause.reasons.flatMap((reason) =>
      reason._tag === "Fail" ? [reason.error.message] : [],
    );
    return { success: false, message: messages.join("; ") };
  };

export const toStandardSchemaV1Strict = <S extends Schema.Decoder<unknown>>(
  schema: S,
) =>
  Schema.toStandardSchemaV1(schema, {
    parseOptions: { onExcessProperty: "error" },
  });
