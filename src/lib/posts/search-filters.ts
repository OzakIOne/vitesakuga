export type NumericSearchField =
  | "height"
  | "likes"
  | "score"
  | "video_height"
  | "video_width"
  | "width";

export type NumericSearchFilter = {
  field: NumericSearchField;
  operator: ">" | "<" | "=";
  value: number;
};

const NUMERIC_FILTER_PATTERN =
  /^(width|height|likes|score|video_width|video_height):(>|<|=)(\d+)$/;

export type ParsedSearchQuery = {
  filters: NumericSearchFilter[];
  text: string;
};

export const parseSearchQuery = (query: string): ParsedSearchQuery => {
  const filters: NumericSearchFilter[] = [];
  const text: string[] = [];

  for (const token of query.trim().split(/\s+/)) {
    if (!token) continue;
    const match = NUMERIC_FILTER_PATTERN.exec(token.toLowerCase());
    if (!match) {
      text.push(token);
      continue;
    }
    const [, field, operator, rawValue] = match;
    // SAFETY: NUMERIC_FILTER_PATTERN restricts field and operator to supported values.
    filters.push({
      field: field as NumericSearchField,
      operator: operator as NumericSearchFilter["operator"],
      value: Number(rawValue),
    });
  }

  return { filters, text: text.join(" ") };
};
