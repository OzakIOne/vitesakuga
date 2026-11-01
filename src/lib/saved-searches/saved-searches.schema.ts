import { Schema, SchemaGetter } from "effect";

import { sanitize } from "../sanitize";
import {
  MAX_SEARCH_QUERY_LENGTH,
  MAX_SEARCH_TAGS_COUNT,
  MAX_TAG_NAME_LENGTH,
} from "../search/search-limits";

const SavedSearchName = Schema.String.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) => sanitize(value.trim())),
    encode: SchemaGetter.transform((value) => value),
  }),
  Schema.check(Schema.isMinLength(1, { message: "A name is required" })),
  Schema.check(Schema.isMaxLength(100, { message: "Name is too long" })),
);

const SearchQuery = Schema.String.pipe(
  Schema.decodeTo(Schema.String, {
    decode: SchemaGetter.transform((value) => value.trim()),
    encode: SchemaGetter.transform((value) => value),
  }),
  Schema.check(
    Schema.isMaxLength(MAX_SEARCH_QUERY_LENGTH, {
      message: `Search query must not exceed ${MAX_SEARCH_QUERY_LENGTH} characters`,
    }),
  ),
);

const SearchTags = Schema.Array(
  Schema.String.pipe(
    Schema.check(
      Schema.isMaxLength(MAX_TAG_NAME_LENGTH, {
        message: `Tag names must not exceed ${MAX_TAG_NAME_LENGTH} characters`,
      }),
    ),
  ),
).pipe(
  Schema.check(
    Schema.isMaxLength(MAX_SEARCH_TAGS_COUNT, {
      message: `Select at most ${MAX_SEARCH_TAGS_COUNT} tags`,
    }),
  ),
);

export const savedSearchDateRangeSchema = Schema.Literals([
  "all",
  "today",
  "week",
  "month",
]);

export type SavedSearchDateRange = typeof savedSearchDateRangeSchema.Type;

export const savedSearchSortBySchema = Schema.Literals(["newest", "oldest"]);

export type SavedSearchSortBy = typeof savedSearchSortBySchema.Type;

export const saveSearchInputSchema = Schema.Struct({
  dateRange: savedSearchDateRangeSchema,
  name: SavedSearchName,
  q: SearchQuery,
  sortBy: savedSearchSortBySchema,
  tags: SearchTags,
});

export const deleteSavedSearchInputSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
});

export type SaveSearchInput = Schema.Schema.Type<typeof saveSearchInputSchema>;

export type SavedSearch = {
  created_at: string;
  date_range: SavedSearchDateRange;
  id: number;
  name: string;
  q: string;
  sort_by: SavedSearchSortBy;
  tags: readonly string[];
};
