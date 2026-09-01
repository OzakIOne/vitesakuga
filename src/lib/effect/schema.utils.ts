import { Schema, SchemaIssue } from "effect";

export const parse =
  <S extends Schema.Decoder<unknown>>(schema: S) =>
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- parse() is the sanctioned I/O boundary; it must accept raw unknown input.
  (input: unknown): S["Type"] =>
    Schema.decodeUnknownSync(schema)(input);

export const parseStrict =
  <S extends Schema.Decoder<unknown>>(schema: S) =>
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- parseStrict() is the sanctioned strict I/O boundary; it must accept raw unknown input.
  (input: unknown): S["Type"] =>
    Schema.decodeUnknownSync(schema)(input, { onExcessProperty: "error" });

export const safeParseStrict =
  <S extends Schema.Decoder<unknown>>(schema: S) =>
  (
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- safeParseStrict() is a boundary decoder returning a tagged result; callers hold raw unknown.
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

/** A single schema failure located at a property path. */
export type SchemaFieldIssue = {
  path: ReadonlyArray<string>;
  message: string;
};

export type SafeParseIssuesResult<S extends Schema.Decoder<unknown>> =
  | { success: true; data: S["Type"] }
  | { success: false; issues: SchemaFieldIssue[]; message: string };

// Schema issue paths are property names or array indices (Standard Schema V1
// also allows `{ key }` segment objects); symbol keys only occur in internal
// schemas and render as their description (or "?").
const formatPathSegment = (
  part: PropertyKey | { readonly key: PropertyKey },
): string => {
  const key: PropertyKey =
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- PropertyKey is a built-in TS union, not unvalidated input; typeof is the only discrimination for { key } segments.
    typeof part === "object" && "key" in part ? part.key : part;
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- same built-in union discrimination as above.
  return typeof key === "symbol" ? (key.description ?? "?") : String(key);
};

/**
 * Like `safeParseStrict`, but also returns each failure as a
 * `{ path, message }` pair (via the Standard Schema V1 formatter) so callers
 * can route errors back to the individual form fields they belong to.
 */
export const safeParseStrictIssues =
  <S extends Schema.Decoder<unknown>>(schema: S) =>
  (
    // oxlint-disable-next-line anti-slop/no-unknown-parameters -- safeParseStrictIssues() is a boundary decoder returning a tagged result; callers hold raw unknown.
    input: unknown,
  ): SafeParseIssuesResult<S> => {
    const exit = Schema.decodeUnknownExit(schema)(input, {
      // Collect every failure so all offending fields can be flagged at once.
      errors: "all",
      onExcessProperty: "error",
    });
    if (exit._tag === "Success") {
      return { success: true, data: exit.value };
    }
    const format = SchemaIssue.makeFormatterStandardSchemaV1();
    const issues: SchemaFieldIssue[] = [];
    const messages: string[] = [];
    for (const reason of exit.cause.reasons) {
      if (reason._tag !== "Fail") continue;
      const { issues: formatted } = format(reason.error.issue);
      for (const item of formatted) {
        const path = (item.path ?? []).map(formatPathSegment);
        issues.push({ message: item.message, path });
        messages.push(
          path.length > 0
            ? `${item.message} at [${path.map((segment) => JSON.stringify(segment)).join(", ")}]`
            : item.message,
        );
      }
    }
    return { issues, message: messages.join("; "), success: false };
  };

export const toStandardSchemaV1Strict = <S extends Schema.Decoder<unknown>>(
  schema: S,
) =>
  Schema.toStandardSchemaV1(schema, {
    parseOptions: { onExcessProperty: "error" },
  });
