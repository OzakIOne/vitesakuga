// PostgreSQL's LIKE/ILIKE default escape character is a backslash. Escaping
// `%`, `_` and the escape char itself turns user input into a literal match
// instead of a wildcard, so a query like `%` or `___` can't widen a search
// into a full-table scan (security audit M5).
export const escapeLikePattern = (value: string): string =>
  value.replace(/[\\%_]/g, (char) => `\\${char}`);
