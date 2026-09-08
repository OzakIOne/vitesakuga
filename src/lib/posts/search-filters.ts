type NumericSearchField =
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
const EXCLUDED_TAG_PATTERN = /^-(\S+)$/;

export type ParsedSearchQuery = {
  excludedTags: string[];
  filters: NumericSearchFilter[];
  text: string;
};

export const parseSearchQuery = (query: string): ParsedSearchQuery => {
  const excludedTags: string[] = [];
  const filters: NumericSearchFilter[] = [];
  const text: string[] = [];

  for (const token of query.trim().split(/\s+/)) {
    if (!token) continue;
    const match = NUMERIC_FILTER_PATTERN.exec(token.toLowerCase());
    if (match) {
      const [, field, operator, rawValue] = match;
      // SAFETY: NUMERIC_FILTER_PATTERN restricts field and operator to supported values.
      filters.push({
        field: field as NumericSearchField,
        operator: operator as NumericSearchFilter["operator"],
        value: Number(rawValue),
      });
      continue;
    }

    const excludedTagMatch = EXCLUDED_TAG_PATTERN.exec(token);
    if (excludedTagMatch) {
      const excludedTag = excludedTagMatch[1];
      if (excludedTag !== undefined) excludedTags.push(excludedTag);
      continue;
    }

    text.push(token);
  }

  return { excludedTags, filters, text: text.join(" ") };
};
