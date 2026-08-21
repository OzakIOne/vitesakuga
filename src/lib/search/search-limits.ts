// Search inputs are attacker-controlled knobs (URL params, combobox values):
// unbounded `q` strings and `tags` arrays turn an indexed query into a cheap
// full-scan amplifier (security audit M5). Caps are shared by every search
// endpoint that accepts these fields.
export const MAX_SEARCH_QUERY_LENGTH = 100;
export const MAX_SEARCH_TAGS_COUNT = 20;
export const MAX_TAG_NAME_LENGTH = 50;
