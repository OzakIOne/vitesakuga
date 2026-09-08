The search box accepts numeric qualifiers and tag exclusions alongside free text. Operators are strictly `>`, `<`, and `=` — `>=` and `<=` are not supported.

## Numeric qualifiers

| Qualifier                      | Target                                    | Example                   |
| ------------------------------ | ----------------------------------------- | ------------------------- |
| `width` / `height`             | Attached image dimensions, in pixels      | `width:>1000 height:<800` |
| `likes` / `score`              | Positive vote count (`score` is an alias) | `likes:>10`               |
| `video_width` / `video_height` | Video track dimensions, in pixels         | `video_width:=1920`       |

## Excluding tags

A `-tag` token excludes every post carrying that tag:

```text
action -movies
```

## Combining qualifiers

Qualifiers combine with each other and with free text. For example:

```text
action width:>1000 likes:>5 -parody
```

Notes:

- Image dimensions are captured at upload time; posts uploaded before dimensions were recorded do not match `width`/`height` filters.
- Qualifiers are parsed on the server and translated into SQL predicates before counting and pagination, so counts and pages always agree with the filters you typed.
