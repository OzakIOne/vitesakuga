# Frontend design & UX review — ViteSakuga

Review of the frontend design, layout, accessibility, and feature surfaces.
This document is the register for improvements found during that review: it
records what was observed, where it lives in the source, and what the fix is.
It is a living list — update it as items land rather than opening a new review
each time.

**Method.** Source review of `src/routes`, `src/components`, and the design-system
primitives in `src/components/ui`, cross-checked against the rendered HTML and
status codes of the running dev server (`/`, `/posts`, `/login`, `/users`,
`/news`, `/help`, and browse URLs carrying filters or foreign query
parameters), the generated stylesheet, and a browser smoke check across the
responsive navigation, homepage, and editorial pages. Contrast ratios are
computed from the _oklch()_ tokens in that stylesheet with the WCAG
relative-luminance formula.

**Scope.** Presentation and interaction only. Product-backlog items live in
`docs/ideas.md`; behavioural contracts live in `docs/features.md`. See
[Cross-references](#cross-references) for how the three relate.

## Resolution status — 2026-09-11

The review was re-checked against the implementation rather than applied as a
blind checklist. The current working tree resolves the concrete correctness,
accessibility, routing, SSR, feedback, and dark-mode defects in items **1–4,
6–11, 15–22, 24–29, 31–48, 51–58, 60–78, and 80–86**. Findings **5**, **13**,
**49**, **50**, and **79** are also resolved by the updates described below.

All findings **1–86** are now resolved in the current working tree. Finding
**49** remains resolved for destructive actions: reject/discard decisions
require confirmation, while explicit reversible approve/promote actions remain
immediate.

**Update (2026-09-11).** Finding **50** is resolved: edit suggestions persist a
complete `previous_payload` snapshot, and the history view renders a Before
suggestion / Suggested comparison.

**Update (2026-09-11).** Finding **79** is now resolved for `/users`: the
contributor directory loads its public user list through the server loader and
renders the list in SSR. The unused browser-only user collection was removed;
the TanStack DB tag collection remains for tag autocomplete.

**Update (2026-09-11).** Finding **5** is resolved: every route family now has
appropriate metadata, private/authenticated surfaces are marked `noindex`, and
public post, playlist, and contributor pages derive useful titles and
descriptions from loader data. Finding **13** is resolved by the shared,
size-aware `EmptyState`, including the final account-playlist detail surface.

**Update (2026-09-11).** Findings **12**, **14**, **23**, **30**, and **59** are
resolved: route-specific card/list skeletons cover data-heavy pages and admin
queues; palette variants share one typed token module; the homepage now has
explicit archive positioning and hero copy; admin panels have a coherent
dashboard header, headings, retry/error states, controls, and shared approval
threshold; and news, wiki, and help use the shared editorial shell on index and
article pages.

Verification for this pass: `nub exec vitest run` (662 tests in 67 files),
`nub run lint:check`, `nub run build:dev`, public-route SSR/status checks, and the
Playwright suite (55 passed in the full run; the 7-test auth/passkey subset then
passed after three stale accessible-name assertions were aligned). A final
in-app browser pass verified the responsive dark-theme `/users`, `/posts`, and
filtered empty-search layouts, their accessibility trees, and the absence of
browser console errors or warnings.

**Priority.** `P0` user-visible correctness bug that undermines a shared
primitive. `P1` significant UX/SEO/a11y gap that affects many pages. `P2`
consistency, performance, or polish with a clear win. `P3` exploratory or
cosmetic. **Effort** is `S` (an afternoon), `M` (a day), `L` (multi-day).

**Numbering.** Item numbers are stable identifiers assigned in the order findings
were recorded — they are never re-used or shifted, so a reference from a PR or an
issue keeps pointing at the same finding. The section an item sits in carries its
priority, not the number.

---

## P0 — Correctness

### 1. `Heading` never applies its `size` — every heading renders at body size — `S`

**Observed.** Headings are visually indistinguishable from body copy. They are
bold, but not larger.

**Root cause.** A double prefix in the style-prop pipeline.

- `src/components/ui/typography.tsx:49` passes `fontSize: classToken(HEADING_SIZES, size, "xl")`,
  and `HEADING_SIZES` (`typography.tsx:17-26`) already holds prefixed Tailwind
  tokens (`"2xl": "text-2xl"`).
- `src/components/ui/ui-utils.ts:660-662` handles `fontSize` by prefixing again:
  `text-${v}`.

The pipeline therefore emits `text-text-2xl` / `text-text-base`, which do not
exist in the generated stylesheet.

**Evidence.** Rendered markup from the dev server:

```html
<!-- / (home) — saved only because index.tsx supplies its own text-2xl -->
<h1 class="text-balance mb-4 text-2xl text-text-2xl font-bold"></h1>

<!-- / (Popular Tags, sidebar) — no valid font-size class survives -->
<h2 class="text-balance mb-3 text-text-base font-bold"></h2>
```

`text-text-2xl` does not appear in `/tmp/app-dev.css`, and the bare scale tokens
the fix needs (`text-4xl`…`text-xs`) are all already emitted by other call sites,
so no safelist change is required.

**Blast radius.** 34 `size`/default usages of `Heading` across 23 files. Only
`src/routes/index.tsx:25` supplies its own `text-2xl` escape hatch, so ~33
headings silently lost their size — including page titles, sidebar section
headers, and card titles (`PostCard`, `SeriesHub`, `PopularTagsSection`,
`PostsPageLayout`, `PostsResultsState`).

**Fix.** Make the two layers agree on one convention. Either store bare tokens in
`HEADING_SIZES` (`"2xl": "2xl"`) and let `useChakraProps` prefix them once, or
bypass the prop and merge into the element class:
`className={cn("text-balance", classToken(HEADING_SIZES, size, "xl"), className)}`.
The second option is more local and keeps `fontWeight` on the style-prop path.

**Related.** `src/components/ui/ui-utils.ts:693-696` gives `textStyle` the same
`text-${v}` treatment, so it is also a font-size token, not a Chakra text style.
`src/components/User.tsx:25` relies on that (`textStyle="sm"` → `text-sm`) — it
works only by coincidence and should be `fontSize="sm"`.

---

## P1 — High impact

### 2. Selecting or removing a tag filter never reaches the URL — `S`

**Observed.** The tag combobox on `/posts` renders like any other filter, but
picking a tag — or clearing one with the chip's × — leaves the result list
unchanged. Only the query field applies: its Enter/Search path and its 500 ms
debouncer both navigate.

**Root cause.** `src/components/SearchBox.tsx` keeps tags in a draft state that is
written to the URL only by `applyDraftToUrl` (`:108-121`). The two handlers that
exist for direct tag interaction never touch it:

- `handleTagChange` (`:100-102`) → `setDraftTags([...details.value])`
- `handleRemoveTag` (`:104-106`) → `setDraftTags(draftTags.filter(...))`

Neither calls `navigate` nor arms the debouncer, so the change stays in component
state. Every other write path in the same file does navigate (`applyImmediately`
→ `applyDraftToUrl`, and the saved-search Apply at `:189-197`).

**Why the tests miss it.** `src/components/SearchBox.test.tsx` covers only the read
direction — "shows the applied query and tags from the URL" (`:87`) and "snaps the
tag chips back to the applied tags on Back/Forward navigation" (`:116`). Nothing
drives `onValueChange` or the × button. `rg 'tags=' e2e/` finds no end-to-end
coverage of tag filtering either.

**Fix.** Funnel both handlers through `applyDraftToUrl` with the freshly computed
array — `setDraftTags` is async, so reading `draftTags` back would be one render
stale. Cancel the pending debouncer first, as `applyImmediately` already does, so
a tag pick cannot race an in-flight query navigation.

### 3. Debounced search pushes a history entry per typing pause — `S`

**Observed.** After typing a query on `/posts`, Back walks backwards through the
query's intermediate values instead of leaving the page.

**Root cause.** Both `navigate` calls in `SearchBox.tsx` (`:111-119` and
`:189-197`) omit `replace: true`. Because the query debouncer (`:123-131`) fires
`applyDraftToUrl` after every 500 ms pause, each pause adds a history entry. The
file's own test — "B1: snaps the field back to the applied query on Back/Forward
navigation" (`src/components/SearchBox.test.tsx:94`) — exercises exactly this
surface.

The codebase already has the idiom: `replace: true` is used at
`src/routes/playlists.index.tsx:43` and `src/lib/posts/posts.hooks.ts:137`.

**Fix.** Add `replace: true` to the derived navigations (debounced query, tag
application). If an explicit submit is meant to be Back-able, keep a push there;
otherwise replace uniformly.

### 4. `twitter:creator` / `twitter:site` credit a TanStack starter author — `S`

`src/utils/seo.ts:18-19` hardcodes `@tannerlinsley` for both tags. Every page
that uses `seo()` (`__root`, `news.*`, `wiki.*`, `help`) advertises the wrong
account in link previews and social cards. `og:url`, `og:site_name`, and
`og:locale` are also absent, and there is no default `og:image`.

### 5. Almost no route sets its own page metadata — `M`

Only `__root`, `news.index`, `news.$slug`, `wiki.index`, `wiki.$slug`, and `help`
declare `head:`. Everything else — home, `posts/*`, `posts/tags/$tag`,
`users/*`, `playlists/*`, `account*`, `upload`, `convert`, `notifications`,
`series/$seriesTitle`, `two-factor`, and the auth routes — inherits the generic
`Vitesakuga` title and `"Sakugabooru clone made with tanstack."` description.

Impact: browser tabs, history, share previews, and search results are
indistinguishable across the whole archive. The detail routes are the worst
offenders, since they have real per-post titles available in `loaderData`.

### 6. Navigation is an absolutely positioned flex row with no chrome or wrapping — `M`

`src/routes/__root.tsx:210-494`. The site header is not a `<header>`/`<nav>`; it
is a `Center` (flex, `align-items: center`, `justify-content: center`,
**no `flex-wrap`**) pinned with `position="absolute" top={0}`. `<main>`
compensates with a fixed `className="pt-16"` (`__root.tsx:496`).

Consequences:

- At `md`–`lg` widths the row carries 12+ links plus the account controls. With
  no wrapping and no overflow handling it will run past the viewport instead of
  wrapping, and `pt-16` cannot absorb a taller nav.
- The nav has no background or border, so content scrolls _under_ it and becomes
  legible-through — there is no visual separation between chrome and page.
- The link list is duplicated: a desktop list (`__root.tsx:221-330`) plus a
  parallel mobile `Menu` list (`__root.tsx:411-494`). Any nav change has to be
  made twice, and the two lists already differ in order and content.
- The `[&>a]:hidden md:[&>a]:inline-flex [&>a:first-child]:inline-flex` selector
  makes "which links are visible" a function of DOM position, not intent.
- `Dev Tools` (Otelite / Opencode / SigNoz, `__root.tsx:328-371`) ships in the
  product navigation, and the mobile menu links straight at `localhost`.

**Fix direction.** Promote the nav to a real `<header>` with a `<nav>` landmark
and a single link source rendered twice via CSS (not two hand-maintained JSX
lists), give it a background/border and a sticky or block-flow position instead
of the `pt-16` fudge, and gate the developer links behind the dev environment.

### 7. The active-navigation `link` class is never defined — `S`

Twelve links in `src/routes/__root.tsx` are given
`activeProps={{ className: "link" }}` to mark the current page. The `link` class
has **no definition anywhere** — not in `src/styles/app.css` (116 lines, with no
`@utility`/`@theme`/`@layer` block), not in any other stylesheet, and not in the
generated CSS (`grep -c '.link' /tmp/app-dev.css` → `0`).

There are 17 uses of the class in total: the 12 active-state props above, three
base-style props on the account cluster links (`__root.tsx:370,379,382`), and two
in the admin queues (`admin/ReportsPanel.tsx:44`, `admin/SuggestionsPanel.tsx:73`).
The last two are the most visible symptom: Tailwind's preflight resets anchors to
`color: inherit; text-decoration: inherit`, so without a `link` definition the
post titles in the moderation queues render as ordinary text with no cue that
they are clickable.

Nothing styles `data-status="active"` either, which TanStack Router also sets. The
net effect is that the active navigation item has **no visual state at all** for
sighted users — colour, weight, and underline are identical to every other link.
This compounds item 6, where the nav additionally has no chrome separating it from
page content.

**Fix.** Define `link` (or `[data-status="active"]`) in `src/styles/app.css` — or
better, drop the magic class name and let the nav component own its active
styling, so the two cannot drift apart again.

Note: the missing class is a _visual_ gap only. TanStack Router applies
`aria-current="page"` to the active link independently of `activeProps`, so
assistive technology is already told which page is current — confirmed in the
rendered HTML.

### 8. There is no footer — `S`

No `<footer>` or `role="contentinfo"` anywhere in `src/`. Pages end mid-air
after the last card. Missing affordances: site-wide links (help, wiki, news,
about), license/attribution, and — relevant for an archive that ingests
user-submitted video — any policy or DMCA surface.

### 9. Dark mode: light surfaces survive, and one of them makes text unreadable — `S`

Confirmed pairs where a light utility is hardcoded and never inverted:

| File                                   | Line | Control                                                  |
| -------------------------------------- | ---- | -------------------------------------------------------- |
| `src/components/ui/overlay.tsx`        | 777  | `Slider.Thumb`                                           |
| `src/components/ui/field.tsx`          | 203  | `Checkbox.Control`                                       |
| `src/routes/convert.lazy.tsx`          | 39   | `SELECT_CLASS` (also `border-gray-300`, `text-gray-900`) |
| `src/routes/account.tsx`               | 333  | avatar preview panel                                     |
| `src/components/TwoFactorSection.tsx`  | 335  | QR code panel                                            |
| `src/components/ui/password-input.tsx` | 72   | reveal button (`text-gray-700`, `hover:bg-gray-100`)     |
| `src/components/ui/overlay.tsx`        | 868  | file-remove button (`hover:bg-gray-100`)                 |
| `src/components/ui/toaster.tsx`        | 78   | toast dismiss (`hover:bg-gray-100 hover:text-gray-700`)  |
| `src/routes/notifications.tsx`         | 96   | unread row (`bg="gray.50"`)                              |

The first five are surfaces — the two shared form primitives plus three one-off
panels — so the checkbox, slider, and select are visibly white-on-dark for every
user. `field.tsx:94` (`INPUT_BASE`) and `overlay.tsx:531` (tag input) already do
this correctly and can serve as the pattern.

The next three are hover/icon utilities on otherwise-correct controls: they look
right at rest, then flash a light background (or keep a dark icon colour) on
hover. `toaster.tsx:66` also paints its action link a raw `text-blue-600` with no
dark counterpart — ≈3.8:1 on `gray-950`, below AA — where the token path
(`TEXT_DARK_VARIANTS`) would give `text-blue-400`.

The last row is worse than a cosmetic mismatch. The `bg` prop is mapped by
`src/components/ui/ui-utils.ts:645-651` to a bare `bg-<token>` class with **no dark
variant** — unlike `color`, which goes through `mapColor` and
`TEXT_DARK_VARIANTS` (`ui-utils.ts:72-82`). `.bg-gray-50` is emitted in both the
dev and production stylesheets, and `app.css:28` paints the dark body `gray-950`
with `text-gray-100`, so an unread row is near-white background behind
light-gray text — ≈1.05:1. Unread notifications become **unreadable** in
dark mode, inverting the feature: the background plus bold weight
(`notifications.tsx:109`) is the only unread cue.

**Fix.** Give `bg` a dark-variant lookup the way `color` has one, or drop the raw
prop at the call site in favour of an explicit
`bg-gray-100 dark:bg-gray-800` pair.

The same gap is already being hand-patched: `upload.lazy.tsx:855-875` styles the
image-validation box with `bg="red.50"` plus a manual `className="dark:bg-red-950/30"`,
because there is no token variant to inherit. The box then mixes a dark-aware
`Text color="red.700"` (which resolves through `TEXT_DARK_VARIANTS` to
`text-red-300`) with a raw `<ul className="text-red-700">` in the same tree. Each
site that needs a dark surface currently re-invents one, which is how the
token maps started drifting in the first place (item 14).

**Update (2026-09-10).** The same gap covers section dividers: four components
draw a top rule with `border-t border-gray-200` and no dark counterpart —
`src/routes/account.tsx:387`, `src/routes/account.tsx:479`,
`src/components/PasskeysSection.tsx:53`,
`src/components/TwoFactorSection.tsx:229`. `app.css:73-75` already pairs
`border-gray-200` with `dark:border-gray-800` for `.markdown-prose hr`, so
the convention exists; these are the only hardcoded light borders left on the
account page, and on `gray-950` they read as bright rules.

**Update (2026-09-10), primitives pass.** Seven shared-primitive utilities keep a
light-mode colour with no dark counterpart, so they stay dim on the dark
surfaces they sit on — or, for the two tracks, too bright:

| Site                                                        | Class           | Dark backing             |
| ----------------------------------------------------------- | --------------- | ------------------------ |
| `overlay.tsx:748` `Slider.Track`                            | `bg-gray-200`   | page `gray-950`          |
| `overlay.tsx:721` `Slider.ValueText`                        | `text-gray-500` | page `gray-950`          |
| `overlay.tsx:415` `Combobox.ClearTrigger`, `:426` `Trigger` | `text-gray-500` | `gray-800` (`LIST_BASE`) |
| `overlay.tsx:511` `Combobox.ItemIndicator`                  | `text-blue-600` | `gray-800` (`Content`)   |
| `overlay.tsx:620` `TagsInput.ItemDeleteTrigger`, `:675`     | `text-gray-500` | `gray-800` (`TAGS_…`)    |
| `overlay.tsx:876` `FileUpload.ClearTrigger`                 | `text-blue-600` | `Dialog` `gray-900`      |
| `feedback.tsx:170` `Progress.Track`                         | `bg-gray-200`   | page `gray-950`          |
| `password-input.tsx:156` `PasswordStrengthMeter` segment    | `bg-gray-200`   | page `gray-950`          |

Measured locally, `gray-500` on `gray-800` is ≈2.7:1 and `blue-600` on
`gray-800` is ≈2.7:1 — under the 3:1 minimum for non-text UI (WCAG 1.4.11) and
well under 4.5:1 where the element is text. `Slider.ValueText` on the page
background is ≈4.3:1, which misses AA for text by a hair. `Slider.Track` is
worse than a miss: `bg-gray-200` against `gray-950` is ≈13:1 while the
`bg-blue-600` range on top of it is ≈4.2:1, so the _unfilled_ part of the
slider is the high-contrast one and the track reads backwards. Slider and
Combobox are both live (`convert.lazy.tsx:284`, `upload.lazy.tsx:421-429`), and
the converter's progress track (`convert.lazy.tsx:64`) has the same inversion
(item 68). The password meter inverts too: its unfilled segments are
`bg-gray-200`, so the empty part of the meter is the brightest element in the
control while the `bg-green-500` / `bg-orange-500` / `bg-red-500` fill is barely
brighter than the dark card behind it (`signup.tsx:259`).

### 10. `PostCard` links to the same post three times — `S`

`src/components/PostCard.tsx` wraps the thumbnail (`:129`), the title (`:160`),
and the entire metadata block (`:181`) in three independent `Link`s to the same
`/posts/$postId`. For mouse users the hit areas are inconsistent and the card
looks clickable via `cursor: pointer` on the outer `VStack` but is not; for
screen-reader and keyboard users the card is three separate stops with three
different accessible names for one destination (the third being a concatenation
of description, date, and vote counts).

**Fix direction.** One link for the whole card with a single accessible name,
and the `PostCardMenu` trigger kept outside it (it already is a sibling, so
hoisting the link to the card root is mostly CSS work).

### 27. The text-contrast token table is incomplete and, for muted text, backwards — `S`

**Observed.** De-emphasized copy is hard to read in light mode, and several
accent colours are hard to read in dark mode, even though `TEXT_DARK_VARIANTS`
(`ui-utils.ts:72-82`) exists to prevent exactly that. The table covers nine
tokens; the app uses more, and two of the covered ones are wrong.

- `fg.muted` → `text-neutral-400 dark:text-neutral-500` (`ui-utils.ts:54`)
  is the light/dark pair **inverted**: `neutral-400` on white is ≈2.5:1 and
  `neutral-500` on `gray-950` is ≈4.2:1, so the token misses WCAG AA (4.5:1)
  in both themes. It is used 14 times, including every discovery and filter
  hint — `PostFilters.tsx:75`, `DiscoveryViewSelector.tsx:32,78`,
  `SearchBox.tsx:201`, `PostsResultsState.tsx:36,92,114`. `fg.subtle`
  (`ui-utils.ts:53`) has the correct ordering (`neutral-500` / `neutral-400`)
  and is the pattern to copy.
- `gray.400` used as a raw token (`account.tsx:231`, `two-factor.tsx:160`) is
  ≈2.6:1 on white, and has no `TEXT_DARK_VARIANTS` entry to correct it in dark
  mode either.

Shades that are simply absent from the table keep their light value on
`gray-950` and so land below AA in dark mode: `orange.700`
(`SeriesHub.tsx:136,206`, ≈3.7:1) and `green.700`
(`TwoFactorSection.tsx:275`, ≈3.8:1). `mapColor` documents the miss behaviour
as deliberate ("tokens without a dark counterpart keep the base class"), so
these fail silently.

**Fix.** Correct the `fg.muted` pair, add the shades actually in use
(`gray.400`, `orange.700`, `green.700`, …) to `TEXT_DARK_VARIANTS`, and prefer
the semantic `fg.*` tokens over raw shades so there is one place to get right.
Pair with item 29 so the table cannot silently drift back.

**Update (2026-09-10).** Two call sites already hand-patch the table — but
redundantly. `src/routes/account.tsx:483-491` adds
`className="dark:text-gray-400"` on top of `color="gray.500"`, and
`:493-496` adds `className="dark:text-red-300"` on top of
`color="red.700"`; `TEXT_DARK_VARIANTS` (`ui-utils.ts:72-82`) already
emits exactly those two dark classes for those two tokens (`gray.500` →
`text-gray-400`, `red.700` → `text-red-300`). The duplication is harmless
in the stylesheet and telling about the system: the call site cannot see that
the token already handles dark mode, so it patches anyway. The panel those
`Text`s sit in (`:492`) is a raw Tailwind pair
(`border-red-100 bg-red-50 … dark:border-red-900 dark:bg-red-950/40`) and is
correct as written.

### 34. `Heading` defaults to `h2`, so several routes never render an `h1` — `S`

**Observed.** The `Heading` primitive defaults to `h2`
(`src/components/ui/typography.tsx:42`), and most pages call it without an `as`
override, so the page title is an `h2` and the document contains no `h1` at all.

Routes whose only page title is an implicit `h2`:

- `src/routes/notifications.tsx:72` — the only heading on the page.
- `src/routes/convert.lazy.tsx:195` — the page title; `:234` is a real `h2`.
- `src/routes/account.tsx:226` — the profile name, followed by genuine `h2`s at
  `:240`, `:253`, `:388`, and `:480`.
- `src/routes/two-factor.tsx:82`.

Two more routes render no heading element at all: `src/routes/users.index.tsx`
(a card grid plus a spinner) and `src/routes/upload.lazy.tsx` (no `Heading` and
no raw `h1`–`h6`).

The section labels that stay at `h2` — `SearchBox.tsx:149`,
`PopularTagsSection.tsx:19`, `PostsPageLayout.tsx:79,106,185`,
`PostsResultsState.tsx:91,113` — are legitimately sub-headings, so the default is
only wrong for page titles. The routes that get it right pass `as="h1"`
explicitly: `index.tsx:25`, `posts/index.tsx:75`, `posts/tags/$tag.tsx:55`,
`playlists.index.tsx:54`, the four playlist detail routes, `Post.tsx:51`,
`SeriesHub.tsx:67`, and `ContributorProfile.tsx:47`.

**Why it matters.** Screen-reader heading navigation and the document outline both
start one level too deep, and search engines read the page title as a
sub-section. `upload.lazy.tsx` is the weakest page in the set: it is a primary
flow with no heading and (item 5) no metadata.

**Fix.** Either default `Heading` to `h1` and make callers opt down, or require
`as` and fix the routes above. Defaulting matches the "page title is the default"
reading and touches no call sites; do it together with item 1, which is the same
primitive in the same pass.

### 39. Form labels point at ids no element has — `S`

**Observed.** The label above a field is not attached to it. The rendered home
page contains exactly one `<label>` — "Filter by Tags" — and it reads
`for="_R_1abl6_"`; no element in that document carries that id (the field root's
own id is `field::_R_1abl6_`). Clicking the label cannot focus anything, and the
control gets no accessible name from it.

**Root cause.** `Field.Label` is Ark's `FieldLabel`
(`src/components/ui/field.tsx:28-40`), which spreads the field machine's label
props — `mergeProps(field?.getLabelProps(), props)`
(`node_modules/@ark-ui/react/dist/components/field/field-label.js`). The `for`
comes from the machine's generated input id, and that id only reaches the DOM
through `ArkField.Input`. The app's `Input` and `Textarea` are plain elements
that spread their own props and never read the field context
(`src/components/ui/field.tsx:105-121`, `:126-138`).

Two conventions exist in the codebase, and only one of them works:

- `Field.Root id="email"` — the machine id becomes the literal `email`, which
  matches the control's own `id`. Used by `src/routes/(auth)/login.tsx:79,92` and
  `src/routes/(auth)/signup.tsx:110,198,221,244,288`. The rendered `/login`
  confirms it: `for="email"` beside `id="email"`, and the same for the password.
- `Field.Label htmlFor="…"` — overrides the machine value outright. Used 8 times:
  `account.tsx:109`, `SavedSearchDialogs.tsx:87`, `PostDetailDisplay.tsx:188,202`,
  `PostEditSuggestionDialog.tsx:155,167,179,202`.

29 of the 37 `Field.Label` uses in `src/` set no `htmlFor`; 7 of those inherit a
working id from `Field.Root` (the auth screens above), so 22 emit a `for` that
resolves to nothing:

- `src/routes/account.tsx:96,269,292,315,405,425` — six of the page's seven
  labels.
- `src/components/TwoFactorSection.tsx:310,374,513,609`.
- `src/routes/two-factor.tsx:92` and `src/components/PasskeysSection.tsx:209`.
- `src/routes/account_.playlists.$playlistId.tsx:257`.
- `src/routes/upload.lazy.tsx:407,568,582,614,718`, plus `:69`
  (`MetaNumberField`, four call sites) and the three fields built by
  `src/components/form/FieldText.tsx:29` (`upload.lazy.tsx:363,379,393`).
- `src/components/PostDetail/PostDetailDisplay.tsx:217` (Tags) and
  `src/components/SearchBox.tsx:207` (the rendered example above).

Two variants of the miss:

- Controls that also pass `id={field.name}` (`account.tsx:269`, `:405`) are
  named, but under a name no label references: the machine id is an unrelated
  generated string, so the field looks deliberately wired and is not.
- Controls with no `id` fall back to the placeholder for their accessible name
  (`account.tsx:315` "Enter your display name", `PasskeysSection.tsx:209`
  "e.g. MacBook Touch ID"), or to an `aria-label` that restates the visible label
  in different words (`TwoFactorSection.tsx:374` "6-digit code" against
  "6-digit verification code"). `account_.playlists.$playlistId.tsx:257` is the
  worst of these: the placeholder "e.g. 12, 45, 67" is a format hint, and it
  becomes the field's name.

**Fix.** Pick one convention: pass an explicit `id` to `Field.Root` (or drop the
Ark wrapper where it does not drive the control and use a plain
`<label htmlFor>`), and give the controls Ark does not own — comboboxes,
`TagInput`, `NumberInput`, `FileUpload`, the post-type button group — an
association the browser can resolve. The cheapest durable fix is in the
primitive: have `Field.Label` default `htmlFor` to an app-controlled prop rather
than the machine's id. Same pass as items 1, 21, and 34, which all want the field
id to line up.

**Note (2026-09-10), the missing control.** The `two-factor.tsx:92` label is
in the list above, but the control it belongs to is missing from the second one:
the code field (`:95-111`) carries neither `id` nor `name`, so nothing answers
the `for` and the accessible name comes from the placeholder — `000000` in TOTP
mode (`:108`), a format mask rather than a name. `login.tsx:79,92` is the one
convention that works: the same string on `Field.Root` and on the control.

---

### 51. Five playlist routes branch on a loading flag that can never be true — `S`

**Observed.** Five routes read `isLoading` from `useSuspenseQuery` and render a
centered `Spinner` under `{isLoading && …}`. The branch never runs: while the
query is unresolved those pages render _nothing_ — no spinner, no skeleton, no
text — so the first paint of each is an empty `<main>` and the content then
appears in one jump.

- `src/routes/account_.playlists.index.tsx:103` (branch `:118-122`)
- `src/routes/account_.playlists.liked.tsx:51` (branch `:71-75`)
- `src/routes/playlists.index.tsx:36` (branch `:58-62`)
- `src/routes/users.$id.playlists.index.tsx:37` (branch `:54-58`)
- `src/routes/users.$id.playlists.$playlistId.tsx:47` (branch `:69-73`)

Each of the five imports `Spinner` for that branch (`:4`, `:11`, `:6`, `:5`,
`:7` respectively), so the intent was clearly to show one.

**Root cause.** `useSuspenseQuery` is `useBaseQuery({ … suspense: true })`
(`node_modules/@tanstack/react-query/build/modern/useSuspenseQuery.js:8-19`),
and a pending suspense query throws instead of rendering:
`shouldSuspend = defaultedOptions?.suspense && result.isPending`
(`node_modules/@tanstack/react-query/build/modern/suspense.js:12`). The
component therefore never returns while the data is missing, and the
`isLoading` it branches on is `false` for every render that does happen — it
is `isPending && isFetching`, and `suspense: true` keeps `isPending` false
even during a background refetch.

**Consequence.** The pending UI is whatever the nearest `Suspense` boundary
supplies, and here that is nothing. None of the five routes sets a
`pendingComponent` — the only two in the app are `convert.lazy.tsx:29` and
`upload.lazy.tsx:50` — and `src/router.tsx:33` sets no
`defaultPendingComponent`, so the root fallback resolves to `null`:
`renderPending` returns `null` when neither is set, and the root boundary
renders it (`node_modules/@tanstack/react-router/dist/esm/Match.js:17-20` and
`:157-158`). All five routes are `ssr: "data-only"`, so the server ships no
HTML for the suspended subtree either, and only
`users.$id.playlists.index.tsx:22-27` warms the cache — with a
fire-and-forget prefetch.

**Fix.** Drop the unreachable branch and give each route a real pending UI: a
route `pendingComponent`, or one `defaultPendingComponent` on the router.
Item 12's skeleton grid is the natural content — note that item 12 lists
`playlists.index.tsx:60` and `account_.playlists.index.tsx:120` among the
spinner sites, and those two spinners are the dead ones. The pattern that does
work is `users.index.tsx:29-43` (an explicit `<Suspense fallback>`), and
`notifications.tsx:84-90` uses a plain `useQuery`, where `isPending` is a
real state.

`users.$id.tsx:49-50,85-86` uses `isFetchingNextPage`/`isFetchingPreviousPage`
from an infinite query; that is a live state and not this bug.

**Note (2026-09-10).** `src/routes/account_.playlists.$playlistId.tsx:86-87` has
the same shape one step further: it reads `useSuspenseInfiniteQuery` and has
neither a loading branch nor a `pendingComponent`, so the playlist management
page also paints an empty `<main>` first. It is not a sixth dead `isLoading`
branch — the branch was never written — so the same fix closes both.

**Note (2026-09-10), completeness of the set.** Four more routes have the same
shape as the one above — a suspending read, no loading branch, no
`pendingComponent` — and they include the two most important pages in the app:

- `src/routes/index.tsx:15` — the landing page. `Home` suspends on
  `tagsQueryGetPopularTags()` before it renders anything, so the `h1`, the
  `SearchBox`, and the news link are all held back and the first paint of `/`
  is an empty `<main>`. The `<Suspense>` at `:29` sits _below_ the suspending
  read, which is why item 23 finds its fallback unreachable.
- `src/routes/posts/$postId.tsx:37` — the post page, whose `<Suspense>` is
  likewise inside the suspended component (`:60-71`, item 61).
- `src/routes/series.$seriesTitle.tsx:14`.
- `src/routes/users.$id.tsx:99` (item 63).

That makes nine routes in the family, and `users.index.tsx:29-43` is still the
only page in the app with a pending state that renders.

**Correction (2026-09-10).** The `defaultPendingComponent` citation in the
**Consequence** paragraph above points at `src/router.tsx:33`, which is a
comment inside the SSR-integration call. The option is absent from the
`createTanStackRouter` config at `src/router.tsx:17-27` — the claim holds, at
`:17-27`.

**Note (2026-09-10), measured.** Those four routes are not alike once the dev
server is running. `/` and `/posts/$postId` resolve their suspense query during
SSR and ship their content: `/posts/1` serves a 22 965-byte `<main>`, and
`/` renders the `h1`, the `SearchBox` and `PopularTagsSection` (5 519 bytes)
with no `pendingComponent` ever appearing. Their empty first paint is a
client-side navigation on a cold cache, not the documented page.
`series.$seriesTitle.tsx` and `users.$id.tsx` are the two that ship nothing at
all, because they opt out of SSR entirely — see item 79.

### 79. The archive's browse routes ship no server-rendered HTML — `M`

Ten routes declare `ssr: "data-only"`, which makes TanStack Start run their
loaders on the server but skip rendering their components there:

- `posts/index.tsx:15` — `/posts`, the main browse grid
- `posts/tags/$tag.tsx:16`
- `series.$seriesTitle.tsx:9`
- `users.$id.tsx:28` — the public profile
- `users.$id.playlists.index.tsx:20` and
  `users.$id.playlists.$playlistId.tsx:34` — the public playlist pages
- `playlists.index.tsx:29`
- `account_.playlists.index.tsx:21`, `account_.playlists.liked.tsx:35` and
  `account_.playlists.$playlistId.tsx:32`

**Mechanism.** `@tanstack/react-router` classifies a match as `resolvedNoSsr`
when `match.ssr === false || match.ssr === "data-only"`
(`dist/esm/Match.js:42`, with `canWrapInSuspense` at `:24` treating the same
two values as no-SSR), and wraps the route's `MatchInner` in
`<ClientOnly fallback={pendingElement}>` for those matches (`:68-71`).
`ClientOnly` renders `fallback` until hydration (`ClientOnly.js`), and
`renderPending` returns `null` when neither the route nor the router supplies a
`pendingComponent` (`Match.js:17-20`). `src/router.tsx:17-27` sets no
`defaultPendingComponent` and none of these ten routes sets one, so the server
fallback is `null` and the route subtree renders as nothing at all.

**Observed (dev server).** The SSR `<main>` is the shell only — 771 bytes of
Suspense comment markers plus the scroll-restoration script — on `/posts`,
`/posts/tags/action`, `/series/naruto`, `/users/1` and `/playlists`. The same
measurement gives 22 965 bytes for `/posts/1` and 3 451 bytes for
`/wiki/search-operators`, both of which use the default `ssr`. The surfaces
that carry the archive — the browse grid, tag feeds, series hubs, profiles,
playlists — are therefore invisible to anything that does not execute the
bundle: crawlers that do not render JS, link previews, text browsers.

**Why it is not item 51.** Item 51's nine routes render nothing while their
suspense query is pending, and its fix is a pending UI. Here the server never
renders the component, so a `pendingComponent` would put a _skeleton_ in the
HTML instead of the content, and the emptiness is not a suspense symptom:
`/` and `/posts/$postId` both suspend and still ship their content, because
React resolves the boundary server-side.

**Fix.** Drop `ssr: "data-only"` from the routes whose content is public and
worth indexing — `/posts`, the tag feed, series hubs, profiles, and the public
playlist pages — so they render on the server the way `/posts/$postId` already
does, then give them a route `head` (item 5) so the rendered content and the
metadata agree. The `account_.*` routes are the only ones behind a session, so
if the opt-out is deliberate it belongs there; those three should still get an
item-5 title so the shell is identifiable.

**Note (2026-09-10), there is an eleventh surface and its mechanism differs.**
`/users` — the contributor directory — is absent from the list above because it
does not opt out of SSR: it renders its grid inside `<ClientOnly
fallback={<UsersLoading />}>` (`src/routes/users.index.tsx:32-34`), so the server
emits the fallback spinner rather than the cards. Measured on the dev server its
`<main>` is 1115 bytes whose only text is "Loading users...", against 2 606 for
`/news`, 4 940 for `/help` and 7 422 for `/wiki`, all of which server-render.
The directory reads a client-side collection (`usersCollection`,
`src/lib/db/collections.ts:21`), so making it indexable needs a server-side read
— the same decision as the ten routes above. Item 34 separately notes that this
route renders no heading.

---

### 80. A tracking parameter in a browse URL returns a 500 and a blank page — `S`

**Observed.** Four routes validate their query string with
`toStandardSchemaV1Strict` (`src/routes/posts/index.tsx:14`,
`src/routes/posts/$postId.tsx:27`, `src/routes/posts/tags/$tag.tsx:15`,
`src/routes/users.$id.tsx:27`), which is `Schema.toStandardSchemaV1(schema, {
parseOptions: { onExcessProperty: "error" } })`
(`src/lib/effect/schema.utils.ts:96-101`). `searchPostsBaseSchema`
(`src/lib/posts/posts.schema.ts:258-308`) is a closed `Schema.Struct`, so any
key it does not declare is a validation failure — including the ones that share
and advertising links append automatically.

**Measured (2026-09-10, dev server).** `GET /posts?fbclid=abc123` returns
**HTTP 500**, and the match serialized into the page is `s:"error"` with
`new Error('[{"path":["fbclid"],"message":"Expected no excess property"}]')`.
`/users/1?fbclid=abc123` and `/posts/1?fbclid=abc123` fail identically; the
fourth route above carries the same validator. The same key is harmless on a
route that validates without the option — `/playlists?fbclid=abc123` returns
200 (`playlists.index.tsx:28` uses plain `Schema.toStandardSchemaV1`) and
keeps the key in its redirect (`…?fbclid=abc123&page=0`), which confirms that
unknown keys are passed through rather than dropped.

**What the visitor sees.** The 500 body's `<main>` is 664 bytes — the
scroll-restoration script and Suspense markers, no content — so the first paint
is the site header over a blank region. `fbclid`, `gclid`, `utm_*`, and
`igshid` are added by the platforms people paste links into, so the failure
lands on exactly the links meant to bring visitors in, and on every crawler that
follows one, as a 500.

**Why it is not item 74.** Item 74 is a route _param_ that decodes to `NaN`;
this is search validation rejecting input the app never generates but the
outside world does.

**Fix.** Excess-property strictness belongs on the server-function boundary
(`parseStrict`), where an unexpected field is a client bug; a query string is
user- and third-party-controlled. Validate search with plain
`Schema.toStandardSchemaV1` — or drop unknown keys in a `searchMiddleware`
redirect — and leave `toStandardSchemaV1Strict` to the callers that want it.

---

## P2 — Consistency, performance, polish

### 11. Images never opt into lazy loading — `S`

`src/components/ui/media.tsx:17` renders a bare `<img>` with no `loading` or
`decoding` default, and `loading="lazy"` appears nowhere in `src/`. No caller
passes `width`/`height` either, so the decoded bitmap has no reserved space. Only
two call sites give the box an aspect ratio (`PostImageGallery.tsx:124`,
`upload.lazy.tsx:798`); everywhere else the element grows when the image arrives.
Virtualized feeds are protected by unmounting, but every non-virtualized surface
eagerly loads all thumbnails: playlist tables (`PlaylistPostsTable.tsx:188`), the
playlist index/liked pages, contributor profiles, and the upload preview strip.

**Fix.** Default `loading="lazy" decoding="async"` in `Image` and pass
`loading="eager"` at the few above-the-fold call sites. For the layout shift, give
the sized-but-unsized call sites `aspect-ratio` classes so the browser can reserve
the box before decode.

### 12. Loading states are centered spinners, not skeletons — `M`

`Skeleton` exists (`src/components/ui/feedback.tsx:122`) but is used in exactly
one place (`color-mode.tsx:83`). Every content route instead swaps in a centered
`Spinner` (`users.index.tsx:42`, `playlists.index.tsx:60`,
`account_.playlists.index.tsx:120`, `notifications.tsx:86`, …). For a
thumbnail grid this replaces a full page of content with a single spinner, so
the page visibly jumps when data lands.

**Fix.** Skeleton grids that mirror `PostCard`'s aspect ratio for the feed and
list routes; keep the spinner for short, non-layout-bearing waits.

**Note (2026-09-10).** Two of the four sites listed above are not loading states
at all: item 51 shows that the `useSuspenseQuery` routes' `isLoading` branch
never runs, so `playlists.index.tsx:60` and `account_.playlists.index.tsx:120`
render nothing. `users.index.tsx:42` (an explicit `<Suspense fallback>`) and
`notifications.tsx:86` (a plain `useQuery`) are the live ones.

**Resolved (2026-09-11).** `LoadingSkeletons.tsx` now provides card-grid and
list variants. Route pending components and live query states use the variant
that matches their content shape, including public/account playlists,
contributors, notifications, and admin queues.

### 13. Empty states are inconsistent — `S`

`PostsResultsState.tsx:113` renders a proper empty state (`Heading` + guidance)
for search. Three other surfaces fall back to a bare string: `No posts` appears
in `playlists.index.tsx:117`, `users.$id.playlists.index.tsx:111`, and
`account_.playlists.index.tsx:164`, while `account_.playlists.$playlistId.tsx:375`
and `users.$id.playlists.$playlistId.tsx:115` use `Text color="gray.500"`.

**Fix.** Extract one `EmptyState` (title, description, optional action) and use
it everywhere, so "No posts" also offers the next step.

### 14. Duplicated color-token class maps — `M`

`src/components/ui/button.tsx` and `src/components/ui/feedback.tsx` each define
their own `Palette` list and solid/subtle/outline `Record<Palette, string>` maps.
They have already drifted
(`button.tsx` uses `blue-600`/`neutral-900`; `feedback.tsx` uses `gray-900`).

The prop name drifted with them. `Button` accepts both `colorScheme` and
`colorPalette` (`button.tsx:76-77`) and prefers `colorPalette` (`:98`), while
`IconButton` in the same file prefers `colorScheme` (`:193`) — so passing both
resolves two ways inside one module. Call sites split the same way: 13 uses of
`colorScheme` across 6 files (`convert.lazy.tsx` 4, `SeriesHub.tsx` 3,
`Comments.tsx` 2, `PostsPageLayout.tsx` 2, `upload.lazy.tsx` 1,
`DiscoverySummary.tsx` 1) against 45 of `colorPalette`.

**Fix.** One shared palette module consumed by all three, matching the intent
already expressed by `TEXT_DARK_VARIANTS` in `ui-utils.ts`.

**Resolved (2026-09-11).** `src/components/ui/palette.ts` is the single source
for the typed palette and solid, outline, ghost, and subtle classes used by
buttons, icon buttons, and badges.

### 15. Reduced-motion coverage stops at toasts — `S`

`src/styles/app.css:112` disables toast transitions under
`prefers-reduced-motion: reduce`, but nothing else is guarded and `motion-reduce:`
is never used. Still animated for motion-sensitive users: `animate-pulse`
skeletons, `animate-spin` spinners, every `transition-*` emitted by
`ui-utils.ts:559-590`, the card hover brightness, and the sidebar collapse arrow
(`transition="transform 0.2s"`, `PostsPageLayout.tsx:53`).

**Fix.** A global `@media (prefers-reduced-motion: reduce)` rule that shortens
transitions/animations, rather than per-component opt-ins.

### 16. Filter groups are unlabelled button clusters — `S`

`src/components/PostFilters.tsx:84-116` and
`src/components/DiscoveryViewSelector.tsx:28-62` render a bold `Text` label above a
`Stack` of `aria-pressed` buttons. The label is not programmatically associated,
so the grouping is visual only.

**Fix.** `role="group"` with `aria-labelledby` pointing at the label (or a
`<fieldset>`/`<legend>`), per group.

### 17. Redundant `aria-label` overrides the visible label — `S`

`DiscoveryViewSelector.tsx:42` sets `aria-label={info.label}` while the button's
content _is_ `info.label`. The label only ever equals the text, except in the
`needsLogin` branch where it appends "(sign in required)" — a state that is also
communicated by `disabled`. Prefer visible text plus a described-by hint, or
drop the attribute for the common case.

### 18. Video player has theme-independent chrome and forced mute — `S`

`src/components/Video.tsx:118` hardcodes `muted` on the `<video>`, so audio can
never be enabled and the player has no unmute affordance. The frame-step buttons
at `:143` and `:154` use `border-white`, which is invisible against the light
theme.

### 19. `Post` action row can overflow — `S`

`src/components/Post.tsx:70` is a non-wrapping `<HStack gap={2}>` that can hold
five controls (`Edit Post` / `Suggest an edit`, vote pair, `Add to playlist`,
`Report`). In the narrow left column of `PostsPageLayout` this will push content
out rather than wrapping.

### 20. `sidebarCards` is rendered into the DOM twice — `S`

`src/components/PostsPageLayout.tsx:75` builds the sidebar subtree once and
injects it at both `:168` (mobile collapsible) and `:176` (desktop block). Both
are always mounted; `display: none` only hides one. This doubles the DOM for the
tallest part of the page, duplicates any ids/labels inside the subtree, and
means every interactive element is created twice.

**Fix.** Render once and switch layout with responsive CSS, or gate on a media
query so only one tree exists.

### 21. Form errors are never associated with their input — `S`

`src/components/form/FieldInfo.tsx:24` renders validation errors as a bare
`<p role="alert">` and is invoked as a _sibling_ of `Field.Root`
(`FieldText.tsx:57`, outside the root opened at `:28`; `signup.tsx:213`, `:234`,
`:268`, `:306`) even though the control already has `id={field.name}`
(`FieldText.tsx:34`, `:45`). The message therefore sits next to the control without
being attached to it: `aria-describedby` is set nowhere in `src/` (the only match
is a doc comment at `password-input.tsx:21`).

`aria-invalid` is covered only by accident of which primitive the form used.
`PasswordInput` forwards `invalid` to Ark (`password-input.tsx:34`, used at
`signup.tsx:295`), so those two controls report their state; the `Input` and
`Textarea` fields (`signup.tsx:198`, `:221`; `FieldText.tsx:44`) get neither the
attribute nor the message. `role="alert"` does announce the text when it first
appears, so this is not silent — what is missing is the durable association:
returning to the field later, or navigating the form in a screen reader's form
mode, gives no indication that the field is invalid or what the constraint was.
Ark's `Field.ErrorText` part already exists in the same module and wires this up.

The same element hardcodes `text-red-700` with no dark variant. On the dark
surface (`gray-950`) that is ≈3.1:1, below the 4.5:1 AA threshold for body text —
and `ui-utils.ts:80-81` already records `red.700 → text-red-300` in
`TEXT_DARK_VARIANTS`, so the token path knows this and the raw class bypasses it.

**Fix.** Move the error inside `Field.Root` (or pass an id and
`aria-describedby` from the input), and use the existing colour-token path
instead of a raw class so the dark variant comes along.

### 22. Mention popup mixes a `currentColor` border with hardcoded ids — `S`

`src/components/mentions/MentionTextarea.tsx:145` styles the suggestion popup with
`rounded border bg-white shadow-lg dark:bg-gray-900`. The background is themed but
the border is not: Tailwind v4's bare `border` utility inherits `currentColor`, so
the outline is near-black in light mode and near-white in dark mode instead of the
neutral token (`border-neutral-200`) the rest of the system uses — see
`mapBorderColor` in `ui-utils.ts:89-96`.

Two ids are hardcoded rather than instance-scoped: `listId = "mention-suggestions"`
(`:58`) and `id="comment-content"` (`:104`). `aria-controls` and
`aria-activedescendant` resolve through `listId`, so a second `MentionTextarea`
on the same page (a reply box or an edit form) would emit duplicate ids and have
assistive technology bind to the first composer's listbox instead of its own. Only
`src/components/Comments.tsx:296` renders the component today, so this is latent
rather than live — cheap to fix now and confusing to debug later.

**Fix.** Use `border-neutral-200 dark:border-neutral-700` (or the `borderColor`
prop), and derive both ids from `useId()`.

### 28. The playlist table's inline `display` styles contradict its own comment — `S`

`src/components/PlaylistPostsTable.tsx:456` reads "display:grid strips native
table semantics; explicit roles restore them", and the markup does override
display three times: `style={{ display: "grid" }}` on the `<table>` (`:460`), the
`<thead>` (`:465`), and the `<tbody>` (`:497`), with every row a `display: flex`
`position: absolute` `<tr>` (`:299-320`). But there is no `role="table"`,
`role="row"`, `role="cell"`, or `role="columnheader"` in the file — or anywhere
in `src/` — so the mitigation the comment promises was never written. The file
asserts a guarantee it does not provide, and because this is the app's only
`<table>` there is nothing else to compare it against. It has no `<caption>` and
no `aria-label` either, so even in the unchanged case it would be an unnamed
table.

**Fix.** Decide which half is true. If the roles are needed, add them to the
exact elements the virtualizer absolutely positions; if they are not, delete the
comment so the next reader does not trust it. Either way, give the table an
accessible name via `<caption>` or `aria-label`.

### 29. The primary navigation is not a landmark — `S`

Every top-level link in `src/routes/__root.tsx` sits inside a bare
`<Center position="absolute">` (`:210`) with no `<nav>` wrapper, no `aria-label`,
and no `<header>` anywhere in the document. The only two `<nav>` elements in the
app are the admin tab strip (`admin.tsx:51`) and the gallery thumbnail strip
(`PostImageGallery.tsx:105`). A screen-reader user therefore has no "navigation"
landmark for the site menu on any page — the landmark that makes an unfamiliar
site skimmable from a rotor or landmark list. The structure is already half-built:
`SkipToContentLink.tsx` supplies the `<main id="main-content">` shortcut and
`__root.tsx:495` renders the `<main>` it targets.

The same container hides its children with an arbitrary-variant class
(`[&>a]:hidden md:[&>a]:inline-flex [&>a:first-child]:inline-flex`, `:211`) on top
of per-link `hidden md:inline` on News/Wiki/Help — item 6 covers the layout side
of that trick.

**Fix.** Wrap the menu in `<nav aria-label="Main">` (and the whole bar in a
`<header>`), then style active state from the `data-status="active"` /
`aria-current="page"` that `Link` already renders instead of the undefined class
in item 7.

### 30. The admin and moderation surfaces read as an unfinished developer console — `M`

The staff-only panels are the least finished screens in the app. Each defect is
small; together they are why the surface reads as a debug view rather than an
interface.

- `src/components/admin/ReportsPanel.tsx:65-70` defines `ButtonRetry`, which
  returns _only_ a `<Text>`: "Post #123 — review the content and act via post
  tools." It is not a button, has no handler, and accepts a `postId` it does not
  otherwise use. The call site (`:58`) reads like an action; nothing is clickable.
- Errors and empty states are bare `<Text>` in every panel
  (`ReportsPanel.tsx:24`, `:29`; `SuggestionsPanel.tsx:37`, `:42`;
  `PromotionQueuePanel.tsx:35`, `:42`; `StorageGcPanel.tsx:40`), so a failed load
  and a successful empty queue get the same weight as a data row. Public pages
  already have `Heading`-based error and empty states
  (`PostsResultsState.tsx:91`) — items 12 and 13.
- `RolesPanel.tsx:68-78` hand-rolls its controls with raw `<input>`/`<select>` and
  an inline `style={{ border: "1px solid currentColor", borderRadius: 6, padding:
"4px 8px" }}`. `currentColor` is the same mistake as item 22: near-black on the
  light surface and near-white on the dark one, the only border in the app not
  taken from a token, and the `<select>` beside it is unstyled entirely.
- The approval threshold is written twice. `REQUIRED_VOTES = 2`
  (`SuggestionsPanel.tsx:14`, displayed at `:80-81`) and the literal "/2" in
  `PostEditHistory.tsx:136` ("uploader approvals") are the same rule with no
  shared source, even though the service already builds the `approvals` array
  (`post-edits.service.ts:491-504`). Changing the rule means finding both.
- No panel has a heading of its own, so the document outline for `/admin/*` is the
  tab strip alone and heading-based navigation lands on nothing.

**Fix.** Delete `ButtonRetry` (implement the action or link to the post); use
`Heading` plus the shared error/empty states; swap in `Input`/`Select`; and move
the threshold into one constant the service and both components import.

**Resolved (2026-09-11).** Reports now link directly to the flagged post;
every admin queue has a heading, skeleton, and structured retry/error state;
role assignment uses the shared input styling; and the approval threshold is
exported from `src/lib/post-edits/post-edits.config.ts`.

### 31. `console.log("Running in", …)` runs on every router creation — `S`

`src/router.tsx:12-15` logs `{ mode, url }` every time `getRouter()` runs: on the
server for every SSR request, and in every visitor's browser console, with no
`import.meta.env.DEV` guard. `AGENTS.md` names `console.log` as something not to
leave in production code, and this is the only such call left in `src/` (the
`console.warn` in `useTurnstile.ts:113` is on an error path, which is
defensible). The logged value is only the base URL, so nothing secret leaks — it
is the log volume and the rule that argue for removing it.

**Fix.** Delete it, or gate it behind `if (import.meta.env.DEV)`.

### 32. The delete-confirm dialog is not linked to its message — `S`

`src/components/Comments.tsx:103-108` renders the confirmation copy as a plain
`<p>` inside `Dialog.Body` rather than `Dialog.Description`, so zag never emits
`aria-describedby` on the content element and "Are you sure you want to delete
this comment? This action cannot be undone." is not announced as the dialog's
description — the same unlinked-message gap as item 21.

**Correction (2026-09-10).** This item previously claimed the comment mutations
had no failure path. That was wrong: `useAddComment`, `useUpdateComment`, and
`useDeleteComment` (`src/lib/comments/comments.hooks.ts`) all wrap
`useMutationWithFeedback` (`src/lib/mutations/mutation-feedback.ts:82-110`),
which raises an error toast (`errorTitle` + `errorFallback`) on every rejection.
An `onSuccess`-only call site is the success path, not the absence of one.

**Fix.** Use `Dialog.Description` for the confirm copy so it is announced.

**Note (2026-09-10), the gap is wider than this one dialog.** Only
`VideoMetadataDialog.tsx:44` uses `Dialog.Description`; every other
`Dialog.Body` renders its copy as a plain element, so no dialog but that one
gets an `aria-describedby`. The confirmations that carry text a screen-reader
user needs: the delete-passkey warning
(`src/components/PasskeysSection.tsx:154-160`), the disable-two-factor warning
(`src/components/TwoFactorSection.tsx:504-528`), the remove-posts-from-playlist
warning (`src/routes/account_.playlists.$playlistId.tsx:322-328`), and the
delete-account warning (`src/routes/account.tsx:80-85`). The fix is a sweep over
the dialog call sites, not a one-line change in `Comments.tsx`.

### 33. `dark:text-gray-500` is a dark variant that changes nothing — `S`

`src/routes/wiki.index.tsx:36` writes
`className="text-sm font-semibold tracking-wide text-gray-500 uppercase
dark:text-gray-500"`. The two classes are identical, so the dark variant is dead
text: the heading keeps its light-mode value on the dark surface. It is not
neutral, either — `--color-gray-500` is `oklch(55.1% 0.027 264.364)` and
`--color-gray-950` is `oklch(13% 0.028 261.692)`, which is ≈4.2:1, just under the
4.5:1 AA threshold. At `text-sm` (14px) the heading is not large text, so the
exemption does not apply. It is the only place in `src/` where a `dark:` variant
repeats its light-mode value, which makes it look like the dark mode was checked
here when it was not — the muted-label value was probably meant to be
`dark:text-gray-400` (≈7.7:1 on `gray-950`).

**Fix.** Drop the redundant `dark:` class and pick a value that passes on both
surfaces, e.g. `text-gray-500 dark:text-gray-400`.

### 35. Notifications can never be read one at a time, and two types can never be read at all — `M`

**Observed.** `src/routes/notifications.tsx:92-121` renders each row as a bordered
`Stack`. The label is wrapped in a `Link` **only when `row.postId !== null`**
(`:104-112`), and the unread state (`bg="gray.50"`, bold label) is cleared only by
the page-level "Mark all read" button (`:59-67`, `:74-80`).

**Root cause.** There is no per-row read mutation anywhere in the stack.
`src/lib/notifications/notifications.hooks.ts` exports exactly three hooks —
`useNotifications` (`:17`), `useUnreadNotificationCount` (`:27`), and
`useMarkAllNotificationsRead` (`:33`) — and the service exposes a single
`markAllNotificationsRead` server function (`notifications.service.ts:149`) whose
implementation flips `readAt` on _every_ unread row for the user
(`:104-106`). `useMarkAllNotificationsRead` is called only from the explicit
button, so the hook's own doc comment at `notifications.hooks.ts:32` — "Flips
every unread row's readAt (client opens the inbox)" — describes behaviour that
does not exist.

**Consequence.** Every notification stays bold and tinted until the user presses
"Mark all read"; following the row's link to `/posts/$postId` does not mark it
read either. Worse, the two types emitted with no `postId` —
`promotion-approved` and `promotion-rejected`
(`src/lib/promotions/promotions.service.ts:287,323`) — render as a plain `Text`
with nothing clickable at all, so those rows have no interaction of any kind and
no way to be dismissed.

**Fix.** Add a `markNotificationRead` server function plus hook keyed by
notification id, fire it when a row is opened, and give the destination-less rows
an explicit "mark read" control. Correct or delete the stale comment on
`useMarkAllNotificationsRead`, and consider whether the 30 s badge poll
(`REFETCH_INTERVAL_MS`, `:14`) is still the right model once rows can be read
individually.

### 36. Avatar images carry no `alt`, and the account avatar has an empty fallback — `S`

The `Image` primitive deliberately defaults `alt` to `""`
(`src/components/ui/media.tsx:18`), but the `Avatar.Image` wrapper in the same
module (`:57-75`) forwards caller props straight to `ArkAvatar.Image` with no
default — and Ark/Zag add none: `@zag-js/avatar`'s `getImageProps()` returns no
`alt`. Every avatar rendered without an explicit `alt` therefore reaches the DOM
as an unlabelled `<img>`.

Call sites missing it: `src/components/User.tsx:21`,
`src/components/ContributorProfile.tsx:43`, `src/routes/account.tsx:219`, and the
live preview at `account.tsx:340`. The two that get it right pass the user's name
— `src/components/mentions/MentionTextarea.tsx:170` and
`src/components/Comments.tsx:192`.

`User.tsx:15-32` is the clearest miss: the whole card is a `Link` to
`/users/$id`, the accessible name comes from the adjacent name text, and the
avatar is decorative but unlabelled rather than `alt=""`. `account.tsx:221` is a
second bug in the same area — `<Avatar.Fallback />` is passed no `name`, so when
the image is absent or fails the avatar is an empty grey circle.

**Fix.** Default `alt` to `""` in `Avatar.Image` the way `Image` already does,
pass a real name where the avatar is the only visual identity (`User.tsx`,
`ContributorProfile.tsx`), and give the account fallback the user's name.

### 37. The error and not-found screens are starter-template leftovers — `S`

`NotFound.tsx` and `DefaultCatchBoundary.tsx` are the app's 404 and crash
surfaces — the former is mounted as `notFoundComponent` on the root route and on
at least six others — and both style their actions with one-off Tailwind palette
classes instead of the `Button` primitives used everywhere else.

- `src/components/NotFound.tsx:13` and `:21` colour their chips with
  `bg-emerald-500` / `bg-cyan-600` and set `font-black text-white uppercase`,
  with no dark variant, so both keep their light-mode colour on the dark surface.
- `src/components/DefaultCatchBoundary.tsx:35` and `:42` carry the _identical_
  class string `rounded bg-gray-600 px-2 py-1 font-extrabold text-white uppercase
dark:bg-gray-700`, so the `isRoot` ternary (`:33-51`) changes only the label and
  the click handler, not the appearance.
- `font-black`, `font-extrabold`, and `uppercase` appear in exactly these four
  places across all of `src/`.

The `ErrorComponent` those files render is unstyled for the same reason: it is
TanStack Router's own component
(`@tanstack/react-router/dist/esm/CatchBoundary.js`), built from inline `style`
objects — a `<strong>Something went wrong!</strong>`, a raw `<button>` with
`border: 1px solid currentColor`, and a red-bordered `<pre>` holding
`error.message` (shown by default outside production). `src/components/UserError.tsx`
and `src/components/PostError.tsx` are six-line pass-throughs to it, wired up as
`errorComponent` on `users.$id.tsx:25` and `posts/$postId.tsx:20`, so a failed
route render falls back to a bold "Something went wrong!" above an unstyled
toggle button.

**Fix.** Rebuild both screens on the design-system primitives (`Button` variants,
a card-like container) with dark-mode-correct colours, and wrap or replace the
nested `ErrorComponent` so the message is rendered with `Text`/`Code` rather
than inline styles.

### 38. Four components still use `React.forwardRef` on React 19 — `S`

`AGENTS.md` states the React 19 rule explicitly — "use ref as a prop instead of
`React.forwardRef`" — but four components still wrap themselves in it:

- `src/components/Video.tsx:42` — `forwardRef<VideoRef, VideoProps>`.
- `src/components/ui/password-input.tsx:26` — `forwardRef<HTMLInputElement, …>`.
- `src/components/ui/password-input.tsx:132` — `forwardRef<HTMLDivElement, …>`.
- `src/components/ui/color-mode.tsx:77` — `forwardRef<HTMLButtonElement, …>`.

`ColorModeButton` shows why it is now dead weight: the ref is forwarded straight
to `IconButton`, which already accepts a `ref` prop, so the wrapper could take
`ref` in its own props and pass it down. The `forwardRef` form also forces a
named function expression for the display name, which the other three do not
need.

**Fix.** Convert all four to ref-as-prop (`VideoProps & { ref?: React.Ref<VideoRef> }`
or the React 19 `ref` in props), then add an oxlint rule or a note so the pattern
does not creep back in. This is a mechanical change with no visual effect, so it
is only worth doing alongside a real touch on those files.

### 40. An explicit `borderColor` ignores dark mode and paints a bright outline — `S`

**Observed.** Bordered boxes that name a colour keep that light token on the dark
surface, where the page is `gray-950`: the outline turns into a bright line
(`gray.200` against `gray-950` is ≈16:1) that no other border on the page shares.
Boxes that only set a width correct themselves — `borderColor` is what breaks
them — which is why the mismatch reads as random rather than broken.

**Root cause.** `mapBorderColor` (`src/components/ui/ui-utils.ts:89-96`) has no
dark counterpart, unlike `mapColor` (`:51-68`) which appends the `dark:` class
from `TEXT_DARK_VARIANTS` (`:72-82`). The dark-aware default exists, but
`borderColor` suppresses it: the guard
`if (hasBorderWidth && !hasBorderColor)` at `ui-utils.ts:732-734` adds
`border-gray-200 dark:border-gray-700`, while `hasBorderColor` is set
unconditionally by the `borderColor` case (`:640-643`). So
`border="1px" borderColor="gray.200"` becomes `border border-gray-200` with no
`dark:` class, whereas `border="1px"` alone becomes
`border border-gray-200 dark:border-gray-700`. `mapVariantClasses` has the same
gap (`ui-utils.ts:185`): a hover or pressed `borderColor` maps straight to a
`border-<token>` class with no dark partner either.

**Blast radius.** All 15 `borderColor=` props in `src/` — 12 × `gray.200`, 1 ×
`gray.100`, 1 × `orange.300`, 1 × `blue.500`:

- Dividers: `account_.playlists.liked.tsx:103`,
  `account_.playlists.index.tsx:41,130`, `playlists.index.tsx:68`,
  `users.$id.playlists.index.tsx:64`,
  `account_.playlists.$playlistId.tsx:251,368`,
  `users.$id.playlists.$playlistId.tsx:109`, `convert.lazy.tsx:316`,
  `ContributorProfile.tsx:77,106`.
- Surfaces: `SavedSearchDialogs.tsx:206`, `PlaylistAddModal.tsx:193` (`gray.100`).
- Selection state, the two where the colour carries meaning: `SeriesHub.tsx:130`
  (`orange.300`) and `upload.lazy.tsx:787` (`blue.500` marks the default
  thumbnail).

**Fix.** Give `mapBorderColor` a dark table the way `mapColor` has one — the
shades pair with the text table (`gray.200` → `border-gray-700`, `blue.500` →
`border-blue-400`) — and key the default on whether a border class was emitted
rather than on whether the prop was passed. Same omission as item 9 (`bg`), and
the place item 22's `border-neutral-200` needs a `dark:` partner.

### 41. Storage cleanup destroys objects on one click, with no confirmation — `S`

`src/components/admin/StorageGcPanel.tsx` is where an admin triggers the storage
sweep, and one click on `Run cleanup` (`:79-85`) deletes everything the dry run
listed — orphaned bucket objects and video revisions past the 90-day retention
window. The panel's own doc comment (`:10-14`) describes the flow as "a dry-run
listing … then an explicit, confirmable sweep", but nothing in the file confirms
anything: there is no `Dialog`, no second step, and no undo.

Every other destructive action in the app asks first — deleting a single comment
goes through a confirm dialog (`Comments.tsx:89-127`) — so the one action that
removes media files is the least guarded. Nothing names the scope either: the
button is identical whether the sweep would touch one object or four thousand,
even though the totals are already rendered directly above it (`:51-54`).

Two smaller gaps in the same panel:

- The failure message uses `color="red.500"` (`:102`). `red.500` appears in
  neither `TEXT_DARK_VARIANTS` nor `TEXT_LIGHT_OVERRIDES` (`ui-utils.ts:72-87`),
  so the same shade is used in both themes: correct on `gray-950` (≈5.3:1) but
  ≈3.8:1 on the light surface, below AA for 14px text. The equivalent message
  elsewhere is rendered through `Alert` (`convert.lazy.tsx:520-560`), which
  themes itself; item 27 is the same family of gap.
- Success and failure are both plain `fontSize="sm"` copy (`:95-105`), with no
  toast and no distinct treatment, so the only feedback after an irreversible
  sweep is a line of body text.

**Fix.** Put the sweep behind a confirmation that names what will be deleted (the
two counts are already in the dry run), and render the outcome through `Alert`.
The rest of this surface is item 30.

### 42. A failed saved-search load renders the empty state — `S`

`SavedSearchesDialog` (`src/components/SavedSearchDialogs.tsx:158-165`) branches
on `isPending` and `length === 0` only, and derives its rows from
`const savedSearches = savedSearchesQuery.data ?? []` (`:137`). A rejected fetch
is therefore indistinguishable from an empty list: the dialog shows "You have no
saved searches yet. Save the current search to find it here." — actively wrong
copy, with no retry. Unlike mutations, reads have no global feedback:
`src/lib/query-client.ts` sets only `staleTime`.

**Correction (2026-09-10).** This item previously reported the save and delete
paths as silent too. That was wrong: `useSaveSearch` and `useDeleteSavedSearch`
(`src/lib/saved-searches/saved-searches.hooks.ts:8-36`) use
`useMutationWithFeedback` and toast their `errorTitle`/`errorFallback`, so the
duplicate-name `ValidationError` does reach the user.

**Fix.** Add an `isError` branch that renders the failure — with a retry — in
place of the empty-state copy.

**Note (2026-09-10), the same read is in two more places.** This item's pattern
is not unique to saved searches. `notifications.tsx:56` (`inbox.data ?? []`)
falls through to "You have no notifications yet." (`:89-90`), and
`PasskeysSection.tsx:29` (`data: passkeys = []`) falls through to "You don't
have any passkeys yet." (`:78-84`) when the read rejects, because neither has
an `isError` branch. The second is the more misleading of the two: it asserts a
fact about the user's security setup. The right shape is already in the
codebase — `PromotionQueuePanel.tsx:34-36` returns "Could not load the promotion
queue." before it ever touches `queue.data ?? []` (`:38`).

---

### 43. Active-filter chips print raw search-parameter values — `S`

The results-summary chips are built straight from the URL search params.
`src/routes/posts/index.tsx:46-52` interpolates the raw enum values:

```ts
...(dateRange !== "all" ? [`Date: ${dateRange}`] : []),
...(sortBy !== "newest" ? [`Sort: ${sortBy}`] : []),
...(view !== "chronological" ? [`View: ${view}`] : []),
```

`PostsResultsState.tsx:27-33` renders each string verbatim in a `Badge`. A
filtered feed therefore shows `Date: week`, `Date: month`, `View: most-liked`,
`View: random-study`, `Sort: oldest` — the slug, not the label the user picked.
`PostFilters.tsx:32-37` already holds the display strings ("This Week",
"This Month"), and `DISCOVERY_VIEW_INFO[...].label` has the view names.

**Fix.** Build the chip text from those label tables instead of the enum, or
map the enum to a label at the point the chip is created.

---

### 45. Media Info prints raw MediaInfo keys and unit-less values — `S`

`src/components/VideoMetadataDialog.tsx:48-79` renders `Object.entries(metadata)`
straight into a `DataList`, using each object key as the row label. Those keys are
the stored MediaInfo identifiers (`src/lib/posts/posts.schema.ts:15-34`) and are
mixed technical names: `BitDepth`, `BitRate`, `ChromaSubsampling`, `CodecID`,
`ColorSpace`, `DisplayAspectRatio`, `Duration`, `Encoded_Library_Name`,
`Encoded_Library_Settings`, `Format_Profile`, `FrameCount`, `FrameRate`,
`Height`, `Width`, `colour_primaries`.

So the dialog shows `Encoded_Library_Settings`, `Format_Profile`, and the
lowercase `colour_primaries` beside the camel-case remainder, and every value is
printed raw (`String(value)`, `:74`) — `Duration`, `FrameRate`, and `BitRate` in
their stored units with no unit shown. The `Encoded_Library_Settings` special
case (`:53-72`, which swaps the value for a "View Settings" popover) shows the
drift: one key already gets bespoke treatment. The empty state at `:80-84` is
unreachable, since the trigger is disabled when `entries.length === 0` (`:24`).

**Fix.** Map the keys to display labels, format numbers with units (seconds,
kbps, fps), combine `Width`/`Height` into one resolution row, and drop the dead
empty state. Same family as items 43 and 44.

**Note (2026-09-10), the same table is implemented twice.** The post detail page
renders this table outside the dialog: `PostsPageLayout.tsx:194-221` maps
`Object.entries(videoMetadata)` into the same `DataList`, key as the label
(`:196`) and value printed raw (`:219`), including its own copy of the
`Encoded_Library_Settings` "View Settings" popover (`:198-217`, against
`VideoMetadataDialog.tsx:53-72`). `posts/$postId.tsx:58` passes
`videoMetadata={post.videoMetadata}` to it and `upload.lazy.tsx:663` passes
`metadata={video.videoMetadata}` to the dialog, so both surfaces show the same
rows from the same stored value: the raw-key, unit-less-value defect above ships
on the post detail page too, and the fix has to reach both. The copies have
already drifted — the dialog names the key (`ENCODED_LIBRARY_SETTINGS_KEY`,
`:15`) while the sidebar compares the string literal (`PostsPageLayout.tsx:198`),
and the dialog keeps a dead empty state (`:80-84`) the sidebar has no
equivalent of.

---

### 47. The report queue prints the raw report reason — `S`

`src/components/admin/ReportsPanel.tsx:50-56` renders `{report.reason}` on the
"Reason:" line. That value is the stored enum, not the wording the reporter
picked: `ModerationReportRow.reason` is typed `string`
(`src/lib/moderation/moderation.service.ts:22`) carrying `duplicate` /
`poor_quality` / `unrelated`. So staff read `Reason: poor_quality` where the
reporter read "Poor resolution / quality". `REPORT_REASON_LABELS`
(`src/lib/db/schema/sakuga.utils.ts:89-93`) already holds the mapping and
`ReportDialog.tsx:67` already renders it. Same family as items 43 and 45.

**Fix.** Look up `REPORT_REASON_LABELS[report.reason]`, falling back to the raw
value for reasons the union does not cover (`reason` is typed `string`, so the
lookup needs an explicit guard rather than a cast).

**Note (2026-09-10), completeness of the family.** A fourth site, on the account
page: the passkey card prints the credential's transport tokens as copy —
`passkey.transports.replaceAll(",", ", ")`
(`src/components/PasskeysSection.tsx:107-109`). `transports` is the stored
string from `@better-auth/passkey` (`transports?: string`,
`dist/index-B7Y0IgKK.d.mts:201`) holding the WebAuthn transport names the
browser reported — `usb`, `nfc`, `ble`, `internal`, `hybrid`,
`smart-card` — so the line reads `Added Sep 10, 2026 · internal, hybrid`. The
line above it already shows the fix for the name (`passkeyLabel`, `:17-19`,
which prefers `passkey.name` and falls back to
`getAuthenticatorName(passkey.aaguid)`); the transports have no such mapping.

---

### 48. Role-assignment feedback looks the same whether it succeeded or failed — `S`

`RolesPanel` (`src/components/admin/RolesPanel.tsx:39-40`) writes both outcomes
into the same `feedback` string, rendered at `:90` as `<Text fontSize="sm">`. So
`abc is now a moderator.` and `Could not assign "admin" to abc.` reach the screen
at the same size, weight, and colour — no icon, no border, no live region.

Two related asymmetries:

- `Alert` already exists with `status="error"`/`"success"` variants
  (`src/components/ui/feedback.tsx:190-212`), and it is what the rest of the app
  uses for exactly this (`convert.lazy.tsx:516,537`,
  `PostEditSuggestionDialog.tsx:250`). It also sets `role="alert"` or
  `role="status"` per status, so the outcome is announced; a bare `Text` is not.
- `useSetUserRole` (`src/lib/moderation/moderation.hooks.ts:100-111`) is the only
  moderation mutation that uses plain `useMutation` instead of
  `useMutationWithFeedback`, so this is also the only moderation action whose
  failure never raises a toast and never carries the server's message.

**Fix.** Render the outcome through `Alert.Root` with the matching status, and
switch the hook to `useMutationWithFeedback` so the server message is available.

---

### 49. Moderation decisions apply on one click, with no confirmation or undo — `S`

The staff decisions are adjacent `size="xs"` buttons that fire on click:
Promote/Reject (`PromotionQueuePanel.tsx:68-83`), Apply/Discard
(`SuggestionsPanel.tsx:85-101`), and Approve/Reject
(`PostEditHistory.tsx:109-127`, see item 50). Nothing asks first, and each outcome
is attributed to a person and has a lasting effect — approving a promotion grants
upload rights, and rejecting "hides them until they out-earn the rejection
snapshot" (`moderation.hooks.ts:42`, `:59-60`, `:94`).

The destructive direction is also the visually quieter one: Promote/Apply are
default buttons while Reject/Discard are `variant="outline"`, so the pair is
ranked by accent rather than by consequence, and a misclick is not recoverable
from the UI. This is the same family as item 41 — the irreversible action is the
unguarded one.

**Fix.** Confirm the consequential direction (Reject/Discard) and name the effect
in the confirmation, or add an undo. Note that the toast plumbing renders an
action button for errors (`mutation-feedback.ts:66`) but `toastSuccess`
(`:49-57`) accepts no action, so an undo affordance needs that extended first.

---

### 50. Edit history shows the proposed values but never the current ones — `S`

`PostEditHistory.tsx:44-59` (`EditFields`) walks `FIELD_KEYS` and prints
`displayValue(payload[key])` in green (`text-green-700 dark:text-green-300`). But
`payload` holds only the changed fields and only their **new** values
(`post-edits.service.ts:60`; `postEditPayloadSchema`); the entry carries no
original values, and `PostEditHistory` is never given the post data (`:143-151`).
The green styling reads as one column of a before/after comparison, yet there is
no second column.

That matters most on a pending entry, where the Approve/Reject buttons for that
entry sit in the same card (`:107-129`) and the approver decides from the
suggestion alone. The sibling dialog does not have this problem:
`PostEditSuggestionDialog.tsx:225-247` renders a "Current | Suggested" table with
red and green columns, using a `displayValue` (`:56`) that maps blanks to
"Empty". The suggester therefore sees strictly more context than the reviewer.

**Fix.** Give the history entry the values it replaces (or resolve the approved
entry against the version it produced) and reuse the two-column diff from the
suggestion dialog.

---

### 52. A failed "mark all read" is the one notification action with no feedback — `S`

**Observed.** The `Mark all read (n)` button (`src/routes/notifications.tsx:71-79`)
shows a pending state (`:75`) and nothing else. If the request fails, the
unread count is unchanged and no message appears — the click looks like it did
nothing.

**Root cause.** `useMarkAllNotificationsRead`
(`src/lib/notifications/notifications.hooks.ts:34-46`) is a plain `useMutation`
whose only handler is an `onSuccess` that invalidates the inbox; the call site
(`notifications.tsx:60-67`) adds a second `onSuccess` and no `onError`. Nothing
catches the failure globally either: `src/lib/query-client.ts:6-12` configures
only `defaultOptions.queries.staleTime`, and a client with no
`MutationCache.onError` reports nothing. `useMutationWithFeedback`
(`src/lib/mutations/mutation-feedback.ts:82-110`) exists for exactly this and is
what the app's other mutations use.

**Fix.** Use `useMutationWithFeedback` for this hook (with an `errorTitle`) so a
failure toasts, and drop the duplicated `onSuccess` in the route.

This hook is not part of a broader pattern: the plain `useMutation`s in
`src/lib/auth/two-factor.hooks.ts:48,72` and `auth.hooks.ts:378` all receive an
`onError` from their call site, so they do report their failures.

---

### 53. The password form computes its validation errors and renders none of them — `S`

**Observed.** On `/account`, a new password that fails the policy produces no
message: either the `Update password` button is greyed out for no visible reason,
or the request goes to the server and comes back as a toast. The profile form in
the same page shows an inline message under every field; the password form below
it shows none.

**Root cause.** `passwordForm` declares a form-level validator,
`validators: { onChange: toStandardSchemaV1Strict(passwordSchema) }`
(`src/routes/account.tsx:201-203`) — the same construct the profile form uses
(`:186-188`). Its rule is `StrongPassword` (`src/lib/auth/auth.schemas.ts:49-62`:
`MIN_PASSWORD_LENGTH` plus `assessPassword` strength), and TanStack Form does
distribute the resulting errors into each field's `meta.errors`
(`node_modules/.store/@tanstack+form-core@1.33.5/node_modules/@tanstack/form-core/dist/esm/FormApi.js:220-290`).
`FieldInfo` is imported (`account.tsx:6`) and used by all three profile fields
(`:284`, `:307`, `:347`) and by neither password field: each of the two controls
is a `Field.Root` / `Field.Label` pair around a `PasswordInput` and nothing else
(`:404-418`, `:424-438`).

The button's guard (`:454-456`) checks `canSubmit` and emptiness
(`values.some((v) => !v)`, which is exactly the schema's `isMinLength(1)`
clause) and never surfaces the strength rule; the strength rule reaches the UI
only as a disabled button. TanStack Form makes `canSubmit` validity-driven once
a field has been touched (`FormApi.js:1147`), a field is touched by
`handleBlur` (`…/form-core/dist/esm/FieldApi.js:531-537`) — which both controls
call (`account.tsx:411`, `:431`) — and validation only runs after that
(`FieldApi.js:461`), so the greyed button is a real, message-less error state.

**Fix.** Render `FieldInfo` for both password fields, and — per item 21 — move it
inside `Field.Root` with an `aria-describedby`/`aria-invalid` association, so
the `StrongPassword` message appears where the profile form's messages already
do.

---

### 54. The post-type Video/Image toggle never exposes which one is selected — `S`

**Observed.** `src/routes/upload.lazy.tsx:580-606` renders a "Post type"
`Field.Label` above two buttons. The active one is drawn with
`variant="solid"` and the inactive with `variant="outline"` (`:590`, `:600`), so
a screen reader announces two buttons, "Video" and "Image", with no indication of
which is current.

**Root cause.** The pair conveys state through the visual `variant` alone;
`aria-pressed` is absent, although it is the convention the codebase already uses
for the same pattern in eight other places: `upload.lazy.tsx:682`,
`account_.playlists.index.tsx:198`, `account_.playlists.$playlistId.tsx:224`,
`TagFollowButton.tsx:21`, `PostVoteButtons.tsx:43,57`, `PostFilters.tsx:48`,
`DiscoveryViewSelector.tsx:45`. `Button` defaults to `type="button"` and spreads
its remaining props onto the native element (`src/components/ui/button.tsx:172-173`),
so `aria-pressed` would pass straight through.

The choice is not cosmetic: `mediaKind` is part of the upload form state
(`:95`, `:124`), it swaps the metadata field set below it (`:518` image →
title/artists, `:608` video → season/episode), and it gates submission
(`:920-922`).

**Fix.** Add `aria-pressed={mediaKind === "video"}` and
`aria-pressed={mediaKind === "image"}`. Resolvable label association for the
`Field.Label` is item 39's problem; this item is only the pressed state.

---

### 55. The pager is not a landmark, and its gaps are announced as dots — `S`

**Observed.** `src/components/Pagination.tsx:28` wraps the whole control in an
`HStack` — a plain `div` — so the pager has no accessible name and belongs to no
landmark. It renders below long grids on `/playlists`
(`playlists.index.tsx:153`), `/account/playlists/liked`
(`account_.playlists.liked.tsx:172`), and
`/users/$id/playlists/$playlistId` (`users.$id.playlists.$playlistId.tsx:200`),
which is exactly where a screen-reader user has the most content to skim past
before reaching it.

The two elided ranges are rendered as `<Text>...</Text>` (`:52`, `:75`). `Text`
defaults to a `<p>` (`src/components/ui/typography.tsx:28`), so each gap is a
paragraph of three literal periods in the reading order, announced as dots and
carrying no `aria-hidden`. The page buttons themselves are named only by their
number (`:50`, `:69`, `:84`), so the row reads as an unlabelled run of numbers.

**Fix.** Wrap the row in `<nav aria-label="Pagination">` (the same landmark gap
as item 29, in a second component), mark the gaps `aria-hidden` with an
`sr-only` "pages omitted" alternative, and give the number buttons an
`aria-label` such as `Page 2` alongside the existing `aria-current="page"`.

---

### 56. Field helper and error text hardcode light-mode colours — `S`

**Observed.** The two supported status lines under a control skip the dark-mode
colour table, while `Field.Label` in the same object uses it:
`src/components/ui/field.tsx:63` hardcodes `text-xs text-gray-500` for
`HelperText` and `:76` hardcodes `text-xs text-red-600` for `ErrorText`,
against `:34`'s `text-gray-800 dark:text-gray-200` for `Label`. All three are
`text-xs` (12px), so they need 4.5:1 — there is no large-text exemption to lean
on.

Measured on the app's dark surfaces (`app.css:28` paints the body `gray-950`;
`overlay.tsx:20` paints `Dialog.Content` `dark:bg-gray-900`):

- helper text — `gray-500` on `gray-950` is **4.16:1**, and **3.67:1** inside a
  dialog, which is exactly where `SavedSearchDialogs.tsx:96` renders it;
- error text — `red-600` on `gray-950` is **4.22:1**
  (`account_.playlists.$playlistId.tsx:283`).

Both miss AA, and both correct partners are already tabulated:
`ui-utils.ts:72-82` maps `gray.500 → text-gray-400` (7.7:1) and
`red.600 → text-red-400` (7.0:1).

**Root cause.** The parts ignore the token path. Both accept `ChakraStyleProps`
(`:57`, `:70`), so `color="red.600"` would resolve through `mapColor` to
`text-red-600 dark:text-red-400`, which merges over the base class correctly —
checked against `cn@0.2.6`:
`cn("text-xs text-red-600", "text-red-600 dark:text-red-400")` →
`text-xs text-red-600 dark:text-red-400`. No call site passes a colour, so the
base class wins on both themes.

**Fix.** Give the two base classes the dark partner they are missing, or route
them through `mapColor` so `TEXT_DARK_VARIANTS` stays the single source of
truth. Item 21 is the same bypass in a one-off component (`FieldInfo.tsx:24`
hardcodes `text-red-700`, 3.1:1) and item 9 finds it in `toaster.tsx:66`;
fixing it in the primitive covers the shared cases at once.

---

### 57. A loading button goes silent and takes the keyboard focus with it — `S`

**Observed.** `Button` swaps its content for a spinner and disables itself, but
tells assistive technology nothing and loses the user's place:

- the spinner is `aria-hidden="true"`
  (`src/components/ui/button.tsx:113-114`), so the only visual change is
  invisible to a screen reader;
- the label is `loadingText ?? children` (`:145`), so unless the call site
  passes `loadingText` the accessible name is identical before and after the
  click. Exactly one `Button` in `src/` passes it
  (`convert.lazy.tsx:505-506`); the other 25 keep the visible label —
  `(auth)/login.tsx`, `account.tsx` (×3), `account_.playlists.index.tsx`,
  `account_.playlists.$playlistId.tsx` (×3), `upload.lazy.tsx`,
  `notifications.tsx`, `Comments.tsx` (×2), `PlaylistAddModal.tsx`,
  `ReportDialog.tsx`, `SavedSearchDialogs.tsx` (×2), `PasskeysSection.tsx`, and
  the four `admin/*` panels;
- `aria-busy` appears nowhere in `src/`, so pending-versus-idle is not exposed
  either.

Then `isDisabled = disabled || loading` (`:141`) passes the real `disabled`
attribute (`:170`; `IconButton` does the same at `:210`). A disabled element
cannot hold focus, so activating a submit button moves focus to the document
body, where it stays once the request finishes: a keyboard user who signs in
resumes from the top of the page. This is also where the two branches disagree
— `asChild` (`:151-166`) sets `aria-disabled` instead and never renders the
spinner, and its `data-loading` state is not enforced:
`disabled:pointer-events-none` (`:71`) needs a `disabled` attribute, and an
`aria-disabled` link still activates on click and Enter. No call site combines
`asChild` with `loading` today, so that half is latent.

**Fix.** Add `aria-busy={loading}` and give the button a state name (a
visually-hidden "Loading" when `loadingText` is absent), and prefer
`aria-disabled` plus an early return in the click handler over the native
attribute so focus survives the request. Item 48 is the same "pending looks like
idle" gap in a bespoke control.

---

### 58. The Alert and DataList primitives ignore dark mode — `S`

**Observed.** `src/components/ui/feedback.tsx` gets dark mode right for badges —
`SUBTLE_BADGE` (`:17-25`) pairs every light class with a `dark:` one — and wrong
for the two primitives beside it:

- `Alert.Root` (`:193-197`) hardcodes all four status panels with **no** dark
  variant: `border-red-200 bg-red-50 text-red-800` for error, then the same shape
  in green, blue, and orange. `app.css:28` paints the page `gray-950`, so on
  every alert path — `convert.lazy.tsx:516`, `convert.lazy.tsx:537` (success),
  and `PostEditSuggestionDialog.tsx:250` — the panel is a near-white block
  (`bg-red-50` is `#fef2f2`) with a light border, brighter than anything else on
  the page. Unlike item 9's notification row the text stays readable, because the
  surface stays light; the defect is that the surface never inverts at all.
- `DataList.ItemLabel` (`:306`) hardcodes `text-gray-500` with no dark variant:
  4.16:1 on `gray-950`, and 3.67:1 inside a dialog (`overlay.tsx:20` paints
  `Dialog.Content` `dark:bg-gray-900`), which is exactly where
  `VideoMetadataDialog.tsx:51` renders it. `PostsPageLayout.tsx:196` is the other
  call site, and at `text-sm` (14px) neither is large text.

**Root cause.** Both were written as raw utility strings instead of going through
the token path, the same gap as items 9 and 56. A scan for every `bg-white`,
`bg-gray-50/100`, and `bg-*-50` in `src/` without a `dark:` partner in the same
element returns item 9's nine rows plus these four — the `Alert` panels are the
one light surface that inventory missed, and it is a shared primitive rather than
a one-off panel.

**Fix.** Give the four status maps the dark halves the badges already
demonstrate (`dark:border-red-800 dark:bg-red-950/40 dark:text-red-200`), and add
`dark:text-gray-400` to the data-list label. Same pass as items 9 and 56.

---

### 59. The news, wiki, and help pages are a second design language — `S`

**Observed.** Five routes import no design-system primitive at all:
`news.index.tsx`, `news.$slug.tsx`, `wiki.index.tsx`, `wiki.$slug.tsx`, and
`help.tsx`. Each surface is hand-rolled in Tailwind with a private type scale:

- page shell `mx-auto max-w-3xl px-5 py-12 sm:py-20` — `news.index.tsx:17`,
  `wiki.index.tsx:18`, `help.tsx:23`, and the article pages
  (`news.$slug.tsx:43`, `wiki.$slug.tsx:44`).
- eyebrow `mb-3 text-sm font-medium text-blue-600 dark:text-blue-400` —
  `news.index.tsx:19`, `wiki.index.tsx:20`, `help.tsx:25`.
- title `text-4xl font-bold tracking-tight sm:text-5xl` on the index pages
  (`news.index.tsx:22`, `wiki.index.tsx:23`, `help.tsx:28`) and
  `text-3xl font-bold tracking-tight sm:text-4xl` on the article pages
  (`news.$slug.tsx:57`, `wiki.$slug.tsx:55`).
- lead `mt-4 text-lg text-gray-600 dark:text-gray-400` —
  `news.index.tsx:23-25`, `wiki.index.tsx:24-26`, `help.tsx:29-31`.
- list frame `divide-y divide-gray-200 border-y border-gray-200
dark:divide-gray-800 dark:border-gray-800` (`news.index.tsx:32`,
  `wiki.index.tsx:33`) and an empty state that is a bare `<p>`
  (`news.index.tsx:28-30`, `wiki.index.tsx:29-31`).

`news.$slug.tsx:43-67` and `wiki.$slug.tsx:44-66` are then the same page: a back
link, a `<header className="mt-8 mb-10 border-b border-gray-200 pb-8
dark:border-gray-800">`, `markdown-prose`, and a `NotFound` component
(`news.$slug.tsx:26-38`, `wiki.$slug.tsx:27-39`) that differs only in nouns.

**Root cause.** Each route was built standalone, so the header, the prose shell,
and the back link were copied rather than extracted. Nothing in
`src/components/ui` can express this scale anyway — `Heading` has no
`tracking-tight`, and it currently emits no size at all (item 1) — so Tailwind
classes were the path of least resistance.

**Fix.** Extract an `ArticleShell` (back link, header, prose body) and a
`PageHeader` (eyebrow, title, lead), and use them from all five routes; the two
`NotFound` bodies collapse into one component with two string props. Keeping raw
Tailwind inside those two components is fine — the win is that the scale and
palette then have one home per pattern.

**Resolved (2026-09-11).** `EditorialShell` now owns the shared page header and
content frame for news, wiki, help, and both article detail routes.

**Related.** This is the concrete half of open question 3; item 46 is the same
drift inside the shortcuts dialog.

---

### 60. The search box's syntax hint duplicates the wiki and is the least readable text on the screen — `S`

**Observed.** `src/components/SearchBox.tsx:201-205` renders one line —
`Advanced filters: width:>1000, height:=800, height:<800, likes:>10,
video_width:=1920, -movies` — as `Text color="fg.muted" fontSize="xs"` with each
operator in a `<code>` chip. Nothing in it links to the page that documents the
syntax, and the wiki already is that page:

- `src/content/wiki/search-operators.md:5-9` holds the qualifier table
  (`width`/`height`, `likes`/`score`, `video_width`/`video_height`) and the rule
  this line cannot state (`>=` and `<=` are unsupported).
- `help.tsx` links to it from `src/content/help/help.md:17` (“The full list
  lives in [Search operators](/wiki/search-operators)”).
- `docs/features.md:55` keeps a third copy of the same table.

The examples have already drifted: `score` is documented as an alias for `likes`
in the wiki and is absent here. The line is also the copy that has to be read
character-by-character, and `fg.muted` maps to `text-neutral-400
dark:text-neutral-500` (`ui-utils.ts:54`) — item 27 measures that at ≈2.5:1 on
white and ≈4.2:1 on `gray-950`.

**Fix.** Keep one or two examples, make “Advanced filters” a link to
`/wiki/search-operators`, and move the line behind a disclosure so the default
view is the field alone. Fix the token per item 27, and treat the wiki table as
the single source for the examples.

---

### 62. The post grids scroll inside a container the keyboard cannot reach — `S`

**Observed.** `src/components/VirtualPostsGrid.tsx:178-181` renders the feed's
viewport as a bare `<div ref={parentRef} style={{ height: SCROLL_VIEWPORT,
overflowY: "auto" }}>`: no `tabIndex`, no `role`, no accessible name.
`SCROLL_VIEWPORT` is `calc(100dvh - 8rem)` (`:21`), so the grid gets a scrollbar
of its own inside the page.

Only a focused scrollable element receives scroll keys, so with focus on the
document the arrows, Page Up/Down, Space, and Home/End move the page and never
this container; the feed scrolls once the user Tabs into one of its links, and
it is invisible to landmark navigation — the same gap as item 55 on the pager.
Chrome's own a11y audit flags this shape as “scrollable region must have
keyboard access”. `PlaylistPostsTable.tsx:447-449` virtualizes into the same
kind of container (`h-full overflow-auto`, no `tabIndex`/`role`), so playlist
management is affected too.

**Fix.** Make each viewport a focusable, named region — `tabIndex={0}`,
`role="region"`, and an `aria-label` (“Posts”, “Playlist posts”), with a
visible focus ring — or stop nesting scrollers and let a window virtualizer own
the scroll so the page keeps one scrollbar. The two append/prepend spinners
(`:182-186`, `:224-228`) want the same status treatment as item 57.

---

### 63. The profile tabs are `Tabs.Trigger`s wrapping routed links, so they announce as tabs that control nothing — `S`

**Observed.** `src/routes/users.$id.tsx:129-145` builds the profile tab strip
from `Tabs.Trigger asChild` wrapping TanStack `<Link>`s, with
`navigate={() => {}}` (`:127`) and no `Tabs.Content` anywhere.

**Root cause.** `asChild` does not preserve the child's semantics.
`TabTrigger`
(`node_modules/.store/@ark-ui+react@5.39.1_*/node_modules/@ark-ui/react/dist/components/tabs/tab-trigger.js`)
merges the machine's trigger props _onto_ the cloned child (`ark.button` plus
`mergeProps(restProps, onlyChild.props)` in `…/factory.js`), and Zag's
`getTriggerProps`
(`node_modules/.store/@zag-js+tabs@1.43.3/node_modules/@zag-js/tabs/dist/tabs.connect.mjs:120-138`)
sets `role: "tab"`, `type: "button"`, `id`, `aria-selected`,
`aria-controls`, `data-selected`, and `tabIndex: selected ? 0 : -1`. Plain
props from the machine win over the anchor's, so the rendered element is an
`<a>` with `role="tab"` and `type="button"`, inside a `tablist` that has
no `tabpanel` under it.

**Why it matters.**

- The anchors are announced as tabs ("tab, 1 of 2"), not as the navigation links
  they are. The selected tab carries `aria-controls`
  (`tabs.connect.mjs:134`, id built in `tabs.dom.mjs:6`) pointing at
  `tabs:<id>:content-<value>`, an element that is never rendered. A dangling
  `aria-controls` is an ARIA violation, not a style choice.
- `composite` defaults to `true` (`tabs.machine.mjs:14`), so the
  _unselected_ trigger gets `tabIndex: -1`: the "Playlists" link is removed
  from the tab order. The only way to reach it from the keyboard is Arrow
  Right/Left — a tab-widget gesture applied to page navigation.
- `activationMode` defaults to `automatic` (`tabs.machine.mjs:10`), so the
  arrow keys also try to select on focus. The app passes a controlled `value`
  with no `onValueChange`, and Zag's bindable drops the write when controlled
  (`@zag-js/react/dist/bindable.mjs:13,26,32`), so that state change is
  silently lost.
- The `navigate={() => {}}` override and its four-line comment
  (`users.$id.tsx:122-127`) exist only to stop a tab machine from re-clicking
  a link — a workaround for using the wrong primitive.

`src/routes/admin.tsx:50-60` already shows the intended shape for a routed tab
strip: a `<nav aria-label="Admin sections">` containing `<Link>`s styled
with `TABS_TRIGGER_BASE` and `activeProps={{ className: TABS_TRIGGER_SELECTED }}`
(both exported from `src/components/ui/tabs.tsx:9-14`).

**Related.** `TABS_TRIGGER_SELECTED` (`tabs.tsx:13-14`) was added for exactly
this pattern and is used in one place, `admin.tsx:56`. The same component also
suspends on `useSuspenseQuery` (`users.$id.tsx:99`) with no
`pendingComponent` on the route (`:23-31`), so the profile header and the tab
strip disappear for the whole profile fetch — the class items 51 and 61
describe.

**Fix.** Drop `asChild` and the `navigate` override; render the two
`<Link>`s directly inside a `<nav aria-label="Profile sections">` using
`TABS_TRIGGER_BASE` / `TABS_TRIGGER_SELECTED`, as `admin.tsx` does.

---

### 64. The auth screens' server errors use class names that were never defined — `S`

**Observed.** `src/routes/(auth)/login.tsx:116` renders the sign-in failure as
`<span className="text-destructive text-center text-sm" role="alert">`;
`src/routes/(auth)/signup.tsx:142` and `:325` render theirs as
`<div className="alert alert-error" role="alert">`.

**Root cause.** None of the three class names exists. `src/styles/app.css:1` is
the whole theme entry (`@import "tailwindcss"`, no `@theme` block), and
`tailwind.config.mjs` carries only a commented-out daisyUI plugin, so
`text-destructive` and the daisyUI `alert`/`alert-error` pair have no
definition. All three are absent from the production stylesheet
(`.output/public/assets/app-kzIUL02g.css`: 0 occurrences each) — the same
"looks like a class, resolves to nothing" failure as items 1 and 27.

**Why it matters.** A failed login or signup renders as ordinary paragraph text
in the body colour, with no colour, icon, border, or background to mark it as an
error. On `signup.tsx` it is worse than plain: the error `<div>` sits inside
the `flex flex-col gap-5` stack (`:90`, `:322`) that otherwise holds field
groups, so it reads as one more unexplained line of copy between controls. The
contrast is fine (`.dark body` sets `text-gray-100`, `app.css:28`) — the
affordance is what is missing.

The same forms already show what an error should look like: `FieldInfo`
(`src/components/form/FieldInfo.tsx:24`) renders field-level validation in
`text-red-700`. A bad password is therefore red in one place and grey in
another, inside the same form.

**Fix.** Render the message with a real error style — the `Alert` primitive
(`src/components/ui/feedback.tsx`) once item 58 is fixed, or an explicit
`text-sm text-red-600 dark:text-red-400`. Neither oxlint nor oxfmt can see a
dead class name; the built stylesheet is the only proof, so a guard needs to
live somewhere else.

**Note (2026-09-10).** The same three files carry a fourth dead class, and this
one is a typo rather than an import from another framework: `with-full` —
`login.tsx:75`, `signup.tsx:88` and `:185`, each time as the first token of
`with-full flex h-fit flex-col items-center justify-center p-4`. It resolves to
nothing (`.output/public/assets/app-kzIUL02g.css`: 0 occurrences, against 1 for
`w-full`), but unlike the error classes above nothing is visibly broken: the
element is a block `div` whose parent is the `<main>` block
(`__root.tsx:495`), so it already spans the width. Worth keeping as a data
point for whatever guard gets built — a class name that no longer exists and a
class name that never did look identical in source.

---

### 65. Auth submit errors appear below the button with no focus move and no association — `S`

**Observed.** In `src/routes/(auth)/login.tsx` the error region (`:113-121`)
comes _after_ the submit button (`:106`) and the passkey button (`:110`) in
the DOM; in `src/routes/(auth)/signup.tsx` the equivalents are `:141` (after
the verification form) and `:324` (after the signup form).

**Why it matters.** On a failed submit, nothing changes focus: the user stays on
the "Login" button while a `role="alert"` region appears below it. An
`alert` is announced, so a screen-reader user hears the message — but it is
not associated with the field that caused it (`aria-describedby`), it is not
inside the `<form>`, and it carries no instructions. A sighted keyboard user
gets no cue at all, because their focus ring never moved to anything.

The forms also have _field-level_ errors (`FieldInfo`, `role="alert"`,
`src/components/form/FieldInfo.tsx:24`), so an assistive-technology user can
receive two alert announcements in a row — the field error and the server error
— with different styling and no stated priority.

**Fix.** Decide one error region per form: render `role="alert"` inside the
`<form>` above the submit button with `tabIndex={-1}` plus a ref the
mutation's `onError` focuses, or associate it with the offending field via
`aria-describedby`. Above the fields is preferable so it is read in document
order rather than after the action it explains. This is the same decision as
question 7 — the field-error and form-error conventions should be chosen
together.

---

### 66. Two account sections and the signup heading bypass `Heading` — `S`

**Observed.** `src/components/PasskeysSection.tsx:56` and
`src/components/TwoFactorSection.tsx:232` both render
`<h2 className="text-lg font-semibold">`, and `src/routes/(auth)/signup.tsx:92`
renders `<h1 className="text-xl font-bold">Check your email</h1>`. Those two
`<h2>`s are the only literal headings in `src/components/`, and
`signup.tsx:92` is the only literal `<h1>` in `src/routes/` outside the
news/wiki/help set of item 59.

**Why it matters.** The hand-rolled `<h2>`s are what
`Heading as="h2" size="md"` is meant to produce — except that `Heading` pins
`fontWeight: "bold"` (`src/components/ui/typography.tsx:48`), so these two
sections are `font-semibold` while every sibling section heading in
`account.tsx` (`:226`, `:240`, `:253`, `:388`, `:480`) is bold. The
`account.tsx` flow is otherwise consistent, so the weight difference is
visible once item 1 restores the sizes.

Because of item 1 the primitive currently renders no size class at all
(`text-text-lg`), so these hand-rolled headings are the ones that look right.
That is the clearest sign the primitive is broken, not that the call sites
should stay ad hoc. `signup.tsx:92` is a page title at `text-xl`, which is
`HEADING_SIZES.lg` (`typography.tsx:21`) — the element is correct, only the
styling path bypasses the system.

**Fix.** Fold these three into the `Heading` pass with item 1: use
`Heading as="h2" size="md"` in the two sections and
`Heading as="h1" size="lg"` in `signup.tsx`, and let the primitive own the
size and weight.

---

### 67. The converter's result preview picks its element from the container, so WebM and MKV results play as audio — `S`

**Observed.** `src/routes/convert.lazy.tsx:558-576` chooses the result player
with `output?.container === "mp4" ? <video …> : <audio …>`,
`SUPPORTED_OUTPUTS` (`src/routes/-convert.machine.ts:89-107`) has five entries
across `mp4`, `webm`, and `mkv`, and the WebM/MKV entries are offered to video
inputs — the combobox annotates them with
`isPassthroughCompatible(format, inputVideoCodec)`
(`convert.lazy.tsx:438-446`).

**Why it matters.** A video converted to WebM or MKV is previewed in an
`<audio controls>` element: there is no picture, so the user cannot check the
conversion, and the only evidence it worked is the file name. The element should
follow whether the _result_ has a video track, not the container string. The
page's other preview already uses a different rule —
`convert.lazy.tsx:240` branches on `isAudioFile` (`:101`, from the input MIME
type) — so two previews answer the same question two ways, and neither consults
the track layout the machine already computed.

**Fix.** Branch on the output's tracks rather than the container. The machine
knows both sides (`inputVideoCodec`, `src/routes/-convert.machine.ts:252-254`,
and `output.videoCodec`, `convert.lazy.tsx:467`), so render `<video>`
whenever the result keeps video and `<audio>` only for audio-only results.
MKV deserves its own note in the copy as well: browsers do not play it at all,
so a download-only result would be more honest than an empty player.

### 68. The converter's progress bar is named after its own value, and the `striped` prop it is given does nothing — `S`

**Observed.** `ConversionProgress` (`src/routes/convert.lazy.tsx:55-69`) holds
the app's only `Progress.Root`:

```tsx
<Text mb={1}>Progress: {Math.round(progress)}%</Text>
<Progress.Root striped value={progress}>
  <Progress.Track>
    <Progress.Range />
  </Progress.Track>
</Progress.Root>
```

- **The accessible name is the value.** Zag puts the role and the name on the
  _track_: `getTrackProps()` spreads `progressbarProps` last
  (`@zag-js/progress/dist/progress.connect.mjs:85-92`), and `progressbarProps`
  sets `role: "progressbar"`, `aria-label: valueAsString`, and
  `aria-valuenow: value` (`progress.connect.mjs:28-37`). Ark merges the caller's
  props over it
  (`@ark-ui/react/dist/components/progress/progress-track.js:10-11`), so a call
  site can still name the bar — this one passes nothing, and neither does
  `Progress.Track` (`src/components/ui/feedback.tsx:166-173`). With the default
  `formatOptions` of `style: "percent"` (`progress.machine.mjs:14-17`) and no
  `translations` override, `valueAsString` is the formatted number
  (`progress.connect.mjs:6-14,19,26,30`), so the bar is exposed as
  `aria-label="42%"` beside `aria-valuenow="42"` — the number twice, and
  nothing that says what is progressing.
- **The visible label is not attached to the bar.** `Progress: 42%` is a plain
  `Text` in the surrounding `Box` (`convert.lazy.tsx:63`), not
  `Progress.Label`/`Progress.ValueText` (`feedback.tsx:147-164`). `ValueText` is
  the part Zag gives `aria-live="polite"` (`progress.connect.mjs:78-83`), and it
  is also the part that formats the percentage for display
  (`@ark-ui/react/dist/components/progress/progress-value-text.js:15`), so the
  hand-rolled paragraph gets neither. `aria-valuenow` is the machine's raw
  float while the paragraph rounds (`convert.lazy.tsx:63`), so the two can
  disagree by a fraction.
- **`striped` is accepted and dropped.** `Progress.Root` destructures
  `striped: _striped` and forwards only the rest (`feedback.tsx:137-146`), and
  nothing implements stripes: Zag's anatomy has no striped part
  (`progress.anatomy.mjs:3-12`) and Ark's `Progress.Root` only splits the known
  machine props (`progress-root.js:12-24`). The prop is inert, and
  `convert.lazy.tsx:64` is its only use in the app.

**Why it matters.** A conversion is the longest wait in the product, and the
only bar that reports it announces the number and nothing else. It is also the
same inverted dark-mode track as the slider (item 9).

**Fix.** Name the bar (an `aria-label` on `Progress.Track`, or an `id` on
`Progress.Root` plus `aria-labelledby`), render the visible text inside the Root
as `Progress.Label`/`Progress.ValueText`, and delete `striped` from the call
site and the primitive — nothing implements it and the project is pre-launch.

---

### 69. The post page's two section titles are styled paragraphs — `S`

**Observed.** `src/components/Comments.tsx:59` renders
`<Text fontSize="xl" fontWeight="bold" mb={4}>Comments</Text>`, and
`src/components/PostDetail/PostEditHistory.tsx:155` renders the same shape
(`mb={3}`) for "Edit history". `Text` defaults to `as="p"`
(`src/components/ui/typography.tsx:29`), so neither is a heading element.

`Heading`'s defaults reproduce both exactly — `as="h2"`, `size="xl"` →
`text-2xl`, `fontWeight: "bold"` (`typography.tsx:21,37-52`) — plus
`text-balance`, which a two-word title does not notice.

**Why it matters.** The post page has a working heading outline for the panels
around them: the post title is an `h1` (`src/components/Post.tsx:51`) and the
series panels are `h2`/`h3` (`SeriesHub.tsx:177`, `:202`, rendered at
`PostDetailDisplay.tsx:298-299`). Heading navigation therefore reaches the
series panels but skips "Comments" (`PostDetailDisplay.tsx:312`) and "Edit
history" (`:272`), the two sections a reader is most likely to want. Item 66
records the same bypass in the account sections and `signup.tsx`; item 59
covers the hand-rolled news/wiki/help pages.

**Fix.** `<Heading mb={4}>` and `<Heading mb={3}>`. `Text` also accepts `as`, so
`as="h2"` on the existing tags would work, but `Heading` already carries the
right size and weight.

---

### 70. The comments list has no empty state — `S`

**Observed.** `CommentsContent` renders `{comments?.map(…)}` and nothing else
under the composer (`src/components/Comments.tsx:69-80`). The rows come from
`useSuspenseQuery`, so the array is always present and the optional chain is
redundant; a post with no comments shows the "Comments" title, the composer,
and then blank space.

**Why it matters.** Every other list in the app says when it is empty: "No
posts have been filed under this series yet."
(`SeriesHub.tsx:148-152`), "No metadata available for this file."
(`VideoMetadataDialog.tsx:80-84`), "No community edit suggestions yet."
(`PostEditHistory.tsx:160-162`), the saved-search list
(`SavedSearchDialogs.tsx:160`), and the three playlist tables
(`playlists.index.tsx:64`, `users.$id.playlists.$playlistId.tsx:105`,
`account_.playlists.$playlistId.tsx:364`). Comments is the one list that omits
the message, so on a fresh post nothing confirms that the section loaded apart
from the spinner disappearing — and for a reader who scrolled past a long post,
the empty space reads like a failure.

**Fix.** One line beside the composer, e.g. "No comments yet. Be the first to
comment." Either the muted note style of `PostEditHistory.tsx:161` or the
bordered `Box` the series and playlist empty states use.

---

### 71. Signed-out visitors get two different answers for the same "you must sign in" state — `S`

**Observed.** `PostVoteButtons` renders at full strength for signed-out
visitors and only explains itself after a click: `handleVote` early-returns into
an error toast — title "Login required", description "Log in to vote on posts.",
`type: "error"` (`src/components/PostVoteButtons.tsx:26-33`) — while the two
buttons it belongs to are ordinary enabled `Button`s carrying `aria-pressed`
(`:38-62`), and `Post.tsx:81` renders them unconditionally beside the
owner-only "Edit Post" / "Suggest an edit" pair. The tag page's equivalent
affordance answers the same condition up front: `TagFollowButton` returns
`<Button disabled>Sign in to follow</Button>`
(`src/components/TagFollowButton.tsx:11-15`), `DiscoveryViewSelector` disables
the locked view, suffixes its label with "(sign in required)", and prints
"Sign in to unlock followed-tag discovery." beneath the strip
(`DiscoveryViewSelector.tsx:39,43,47,79`), and the saved-search dialog offers a
`Log in to save` link instead of a dead control (`SavedSearchDialogs.tsx:36`).

**Why it matters.** The vote pair is the one sign-in-gated affordance drawn as
if it worked, so a signed-out reader has to click to find out; `aria-pressed` on
a button that cannot toggle also advertises a state the user cannot be in. The
toast then reports a non-error — nothing failed — in the error channel, and its
message names the action ("vote on posts") rather than the one the user needs
("Sign in", cf. the sign-in links item 61 covers). Two treatments of one
condition also means the convention cannot be learned.

**Fix.** Pick one. Mirroring `TagFollowButton` is the cheaper half — render the
pair disabled under a "Sign in to vote" label — and a sign-in link that returns
to the post is the more useful half, matching what the comment composer should
do for the same visitor.

---

### 72. The contributor stat grid loses two of its three column counts in the production stylesheet — `S`

**Observed.** `ContributorProfile` lays its five stat tiles out with
`<SimpleGrid columns={{ base: 2, sm: 3, lg: 5 }}>`
(`src/components/ContributorProfile.tsx:66`). `SimpleGrid` turns each breakpoint
into a class name by string building — `` `grid-cols-${n}` `` prefixed with
`sm:`/`lg:` (`src/components/ui/layout.tsx:124-133,147-162`) — so the element
needs `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`. Neither `sm:grid-cols-3` nor
`lg:grid-cols-5` appears as a literal anywhere in `src/` (Tailwind v4 purges by
scanning source text), and `src/styles/safelist.ts` — the file whose stated job
is to keep exactly these dynamically-built names — lists `grid-cols-1`…
`grid-cols-5`, `sm:grid-cols-2`, `md:grid-cols-3`, `lg:grid-cols-4`,
`xl:grid-cols-5`, and `lg:grid-cols-[1fr_3fr]` (`:82-91`) but not the two it
needs. The generated stylesheet agrees: `.output/public/assets/app-kzIUL02g.css`
contains `sm\:grid-cols-2`, `md\:grid-cols-3`, `lg\:grid-cols-4`, and
`xl\:grid-cols-5`, and neither missing name.

**Why it matters.** The profile's stat row is stuck at two columns at every
breakpoint; on a desktop profile the five counters wrap into a three-row stack
instead of the intended single row. This is the failure the safelist exists to
prevent, and it is invisible to `tsc` and `oxlint` because the class is
assembled at runtime. The sibling grid in the same file (`base: 1, sm: 2, lg: 4`,
`ContributorProfile.tsx:115`) renders correctly only because both of its
breakpoint names happen to be listed, which is why the bug survived — proximity
to a working call site makes the missing entry look present.

**Fix.** Add `"sm:grid-cols-3"` and `"lg:grid-cols-5"` to
`src/styles/safelist.ts`, or use the `@source inline(…)` form already in use at
`src/styles/app.css:9`. Whichever route, derive the safelist from the responsive
column maps rather than maintain it by hand, so a new `columns={{ … }}` value
cannot silently fall out of the stylesheet again.

**Verified (2026-09-10), the other dynamic-column call sites resolve cleanly.**
Of the six `SimpleGrid` call sites, five pass a responsive object:
`account_.playlists.index.tsx:125`, `account_.playlists.liked.tsx:114`,
`playlists.index.tsx:78` and `users.$id.playlists.index.tsx:75` all ask for
`{ base: 1, sm: 2, md: 3, lg: 4, xl: 5 }`, and `ContributorProfile.tsx:115`
asks for `{ base: 1, sm: 2, lg: 4 }`; each of those resolves to a name the
safelist already carries (`src/styles/safelist.ts:82-90`). The sixth,
`VirtualPostsGrid.tsx:212`, passes the runtime number from
`useResponsiveColumns` (`src/lib/posts/useResponsiveColumns.ts:9-14`), whose
range is 1–5, so it maps onto the five `grid-cols-N` entries. The same check
over `TEXT_DARK_VARIANTS` (`src/components/ui/ui-utils.ts:72-82`), the other
string-built class source, finds all nine of its names present as literals
elsewhere in `src/`, so item 72's two missing entries are today's only gap in
these two maps.

---

### 73. The account and two-factor pages are a header taller than the viewport — `S`

**Observed.** `account.tsx:213` and `two-factor.tsx:74` open with the same
shell, `<Box className="flex min-h-dvh flex-col items-center px-4 py-16 sm:px-8">`,
inside the root layout's `<main className="pt-16">` (`__root.tsx:495`) — the
4rem the absolutely-positioned header reserves (`__root.tsx:210-218`).
`.min-h-dvh{min-height:100dvh}` is in the shipped stylesheet, measured from
that offset, so the document is a guaranteed 4rem taller than the viewport and
these two pages scroll even when the form fits. The card is top-aligned rather
than centered, too: `items-center` centers only the cross axis of a column
flex, so the shell's own `py-16` stacks on `pt-16` and the first element sits
8rem below the viewport top.

**Why it matters.** Two of the app's full-page forms open with a dead
8rem gap and a scrollbar with nothing to scroll to. Every other full-height
surface compensates for the header: `index.tsx:22` and `convert.lazy.tsx:190`
use `minH="calc(100vh - 4rem)"`, `account_.playlists.$playlistId.tsx:201` uses
`calc(100dvh - 4rem)`, `VirtualPostsGrid.tsx:21` uses `calc(100dvh - 8rem)`,
and `safelist.ts:103` pins `min-h-[calc(100vh-4rem)]`. The `(auth)` routes
use a third recipe, `with-full flex h-fit flex-col items-center justify-center
p-4` (`login.tsx:75`, `signup.tsx:88`, `:185`), which is the only one that
actually centers its card — and it carries one of item 64's dead `with-full`
classes.

**Fix.** One page-shell component that both pages and the `(auth)` routes use
(at minimum `min-h-[calc(100dvh-4rem)]` plus `justify-center`), so the header
offset lives in a single place.

---

### 74. Route params are decoded with a decoder that cannot fail — `S`

**Observed.** Three routes decode their numeric path segment with
`parse(Schema.NumberFromString)`: `posts/$postId.tsx:22-26` turns it into a
route-level `params.parse`, `users.$id.playlists.$playlistId.tsx:41-43` wraps
it in `asPlaylistId(...)` inside the render body, and
`account_.playlists.$playlistId.tsx:71` does the same in one line.

`parse` is `Schema.decodeUnknownSync` (`src/lib/effect/schema.utils.ts:3-7`),
so each of these reads as a "reject a malformed URL" boundary. None of them can
reject: `Schema.NumberFromString` is `Number()`, and Effect's `Schema.Number`
accepts `NaN`. Decoded against the installed Effect:

- `"abc"`, `"5abc"`, `"15px"` → `NaN` — returned, not thrown;
- `""` → `0`;
- `"0x10"` → `16`; `"1e3"` → `1000`; `" 5 "` → `5`.

**Why it matters.** `/posts/abc` reaches the query as `postId: NaN` —
`fetchPostDetail`'s validator is a bare `parse(Schema.Number)`
(`posts.service.ts:1175`) and `asPostId` (`src/lib/ids.ts:26-30`) is a cast.
The `pg` driver serializes the value with `val.toString()`
(`node_modules/.store/pg@8.23.0/node_modules/pg/lib/utils.js:69`), i.e. the
text `'NaN'`, against a `serial` primary key
(`src/lib/db/schema/sakuga.schema.ts:67`, `:132`). `PostNotFoundError` and
`PlaylistNotFoundError` are client-safe, but a driver failure is not
(`server-fn.handler.ts:20-32`). Either way the URL ends at the crash boundary
(item 37): the driver rejects the comparison outright, or no row matches and the
domain error travels the path item 75 describes. Neither route shows its own
not-found copy for a malformed id.

The playlists have one guard fewer than the posts. `PlaylistId`
(`src/lib/ids.ts:15`) is `Schema.Number.pipe(Schema.brand(…))` with no numeric
check and `fetchPlaylistDetailSchema` (`playlists.schema.ts:76`) consumes it
unchanged, while `updatePostInputSchema`'s
`PostId.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))`
(`posts.schema.ts:223`) is the only numeric check on an id in the server
schemas — and it guards the update path, not this read.

`Number()` also accepts non-canonical spellings, so `/posts/0x10` and
`/posts/1e3` resolve to posts 16 and 1000: any post or playlist is reachable
under several URLs.

**Fix.** Decode with an integer schema at all three sites —
`Schema.NumberFromString.pipe(Schema.check(Schema.isInt()))` rejects `NaN` and
`1.5`, checked against the installed Effect. Give `PlaylistId` the same check
so the server refuses what the client lets through, and send the miss to the
page's own not-found state.

---

### 75. Five `notFoundComponent`s can never render — `S`

**Observed.** Eight routes define not-found copy, and only three can render it:
the news and wiki pages are the app's only `throw notFound()` calls
(`news.$slug.tsx:9`, `wiki.$slug.tsx:9`), and the root's catch-all
(`__root.tsx:121`) fires when no route matches. The five that follow sit on
routes that always match, and none of them can be reached:

- `posts/$postId.tsx:21` ("Post not found"), `users.$id.tsx:26` ("User not
  found"), `users.$id.playlists.$playlistId.tsx:32` and
  `account_.playlists.$playlistId.tsx:31` ("Playlist not found") read a query
  that fails for a missing resource: `PostNotFoundError`
  (`posts.service.ts:564-568`), `UserNotFoundError` (`users.service.ts:357-364`)
  and `PlaylistNotFoundError` (`playlists.service.ts:795-812`).
- `users.$id.playlists.index.tsx:21` ("User not found") is dead the other way
  round: `fetchUserPlaylists` returns `[]` for an id that does not exist
  (`playlists.service.ts:704`), so `/users/nobody/playlists` renders the empty
  state at `:70-72` under a "Playlists" heading instead of failing.

**Why they cannot render.** `createHandler` rejects the server-function promise
with the domain error (`server-fn.handler.ts:117-135`), and all three tags are
in `CLIENT_SAFE_ERROR_TAGS` (`:20-32`), so the message survives the wire — but
it arrives as an _error_. `useSuspenseQuery` throws it during render, and
TanStack Router reaches for `errorComponent`, never `notFoundComponent`.
Nothing maps those messages back to a router not-found either: `getRouter`
(`src/router.tsx:17-27`) sets only `defaultErrorComponent` and
`defaultNotFoundComponent`, and the shared `QueryClient`
(`query-client.ts:7-13`) installs no error hook.

So the same missing user gets two different answers: `/users/nobody` renders
`UserErrorComponent`'s bare `<ErrorComponent>` (`users.$id.tsx:25` →
`UserError.tsx:5`), i.e. item 37's unstyled "Something went wrong!" heading with
the domain message under it outside production, while `/users/nobody/playlists`
renders a normal empty page. `/account/playlists/42` — whose parent is the root
route (`routeTree.gen.ts:663`) — falls to `DefaultCatchBoundary` instead. The
defect here is the routing decision, not the styling, which is item 37's.

**Fix.** Recognise the three messages in one shared place — an `errorComponent`
wrapper or the query layer — and throw the router's `notFound()`, so these five
components become live and both `/users/nobody…` answers agree. If the crash
page is deliberate, delete the dead components and style the error the routes
actually render.

### 76. One decision in an admin row disables and re-spinners every row — `S`

Both moderation queues create their mutation hooks once, at panel level, and
hand the single instance down to every row: `useApproveEdit()` /
`useRejectEdit()` (`src/components/admin/SuggestionsPanel.tsx:26-27`) and
`useApprovePromotion()` / `useRejectPromotion()`
(`src/components/admin/PromotionQueuePanel.tsx:24-25`). TanStack Query tracks
`isPending`, `variables`, and `data` per `useMutation` instance rather
than per `mutate()` call — `MutationObserverBaseResult.variables` is
documented as "the variables object passed to the `mutationFn`"
(`@tanstack/query-core` `build/modern/hydration-Bjs0MSgg.d.ts:1217`) — so the
flag belongs to the panel, not the row:

- `SuggestionsPanel.tsx:68` derives `busy = approve.isPending ||
reject.isPending` and passes it to both buttons of every row (`:86`,
  `:94`), while `:87` gives every Apply button `loading={approve.isPending}`.
  Applying one suggestion therefore puts a spinner on all of them and freezes
  the rest of the queue.
- `PromotionQueuePanel.tsx:69-71` and `:77` repeat the shape for Promote and
  Reject, so one decision locks the whole candidate list.

The clicked row is indistinguishable from the others: none says "this one is
working", none says "the others are merely waiting". Items 30 and 49 cover the
panels' chrome and their one-click decisions; this is the pending state they do
not describe.

**Fix.** Thread the row's id into the test and use it per row, e.g. `const
isApplying = approve.isPending && approve.variables === suggestion.editId`.
Per-row `variables` is the only supported attribution, since one mutation
instance keeps just the latest call.

### 77. `/posts/tags/$tag` has no loading, error, or empty state — `S`

`src/routes/posts/index.tsx:88-96` wraps its grid in `PostsResultsState`,
which owns all three non-happy states: `isPending && !hasLoadedPosts` renders
a `Spinner` and "Loading posts..." (`src/components/PostsResultsState.tsx:79-86`),
`error && !hasLoadedPosts` renders "Could not load posts" with Retry and Clear
filters (`:88-103`), and `resultCount === 0` renders "No posts found" with a
clear-filters action (`:105-121`).

The tag feed renders the same grid without it.
`src/routes/posts/tags/$tag.tsx:53-59` puts `VirtualPostsGrid` straight into a
`Box border="1px"`, and the hook result is destructured at `:24-41` without
`error`, `isPending`, `retry`, or `firstPage` — `usePostsInfiniteScroll`
computes them and the route drops them. `PostsPageLayout` adds nothing: it only
renders `children` (`src/components/PostsPageLayout.tsx:236`).

So on `/posts/tags/<tag>`:

- a rejected read is silent — the grid draws the same tall empty scroll region
  as a tag with no posts (`VirtualPostsGrid.tsx:180` fixes the height at
  `calc(100dvh - 8rem)` regardless of content);
- a slow first load shows that region instead of the spinner `/posts/` shows;
- a tag with zero posts gets no "No posts found" guidance and no way out,
  because the route has no `clearFilters` to offer.

The only trace is `Posts loaded: 0` (`VirtualPostsGrid.tsx:173`), and that is
gated behind `envClient.MODE === "development"`. This is item 42's pattern — a
failed read rendered as an empty state — on a surface that never opted into the
shared state component at all; item 13 covers the inconsistency among the empty
states that do exist.

**Fix.** Wrap the tag feed's grid in `PostsResultsState` exactly as `/posts/`
does, passing the tag as the active filter and a `clearFilters` that drops it
and navigates to `/posts/`.

### 78. Multi-line post descriptions and comments collapse into one paragraph — `S`

`src/components/Post.tsx:105-109` renders the body as
`<Text className="break-words" mb={4}>{post.description}</Text>`, and `Text`
(`src/components/ui/typography.tsx:28-40`) sets no `white-space`: it maps style
props to classes and emits a plain `<p>`. Newlines in the description are
therefore collapsed by the browser's default `white-space: normal`, so a
description entered over several lines reads as one run-on paragraph.

Both controls that capture the field accept multiple lines, so the loss is
reachable: the upload form's description input is a textarea
(`src/routes/upload.lazy.tsx:380`, `asTextarea`), and the post page's inline
edit uses `<Textarea>` (`src/components/PostDetail/PostDetailDisplay.tsx:189`).
`posts.description` is a plain `text().notNull()` column
(`src/lib/db/schema/sakuga.schema.ts:65`), decoded through `sanitizeString`
(`src/lib/posts/posts.schema.ts:61-67`), whose only constraint is `MinLen3`
(`:71-73`) — nothing trims or folds internal whitespace, and the server
sanitizer is `sanitize-html` over a text node (`src/lib/sanitize.server.ts`),
so the newlines are stored and only lost at render.

The codebase already has the right shape: `VideoMetadataDialog.tsx:65` and
`PostsPageLayout.tsx:210` render the same kind of free text with
`whitespace-pre-wrap break-words`. The card variant is deliberately
single-line (`src/components/PostCard.tsx:185-187` sets `lineClamp={1}`), so
only the detail page needs the change.

**Fix.** Add `whitespace-pre-wrap` to the description `Text` in
`Post.tsx:106`. If descriptions are ever meant to carry markdown, render them
through the existing `.markdown-prose` container
(`src/styles/app.css:31-76`) instead — `.dark body` (`:27-29`) already gives
it a dark-mode surface.

**Note (2026-09-10), the same shape in comments.** Comment bodies collapse the
same way. `src/components/mentions/CommentContent.tsx:91-107` renders the
segments inside `<Text className="break-words" mt={2}>` with no
`whitespace-pre-wrap`, and the composer is a real multiline textarea
(`MentionTextarea.tsx:104,137`, whose ref is an
`HTMLTextAreaElement`). The stored string is unrestricted —
`commentsSelectSchema.content` is a bare `Schema.String`
(`src/lib/db/schema/sakuga.utils.ts:126`) and `Comments.tsx:165` only
`trim()`s it — so a two-paragraph comment renders as one paragraph. Any
comment body that spans lines is affected, and the fix is the same class on
that `Text`.

---

### 81. A client-side route change moves no focus and announces nothing — `S`

**Observed.** `scrollRestoration: true` (`src/router.tsx:26`) restores the
saved scroll offset and the routes that set `head` replace the title (item 5),
but nothing reacts to a resolved navigation. `src/` contains exactly two
`.focus()` calls — the skip link (`SkipToContentLink.tsx:5`) and the search
shortcut (`GlobalShortcuts.tsx:10`) — and its only `aria-live` attributes are
component-scoped status text (`FieldInfo.tsx:29`,
`PostsResultsState.tsx:60`, `upload.lazy.tsx:857`). There is no
`router.subscribe("onResolved")` or equivalent effect, so after a navigation
focus stays on the control that was activated and the new page is never
announced.

`<main id="main-content" tabIndex={-1}>` (`src/routes/__root.tsx:495`) is
already focusable — the plumbing the skip link uses — so the fix is a handler,
not markup.

**Why it matters.** With client-side routing a link click replaces the document
without a navigation event: the reading position, the focused element, and the
announced page all stay on the previous route. The skip link is the only route
into the content region, and it has to be re-invoked on every page. Item 29
covers the missing `nav` landmark; this is the missing focus move.

**Fix.** Subscribe to `onResolved` and focus `main#main-content` when the
`pathname` changed, leaving focus alone when only the search string changed —
the browse filters and pager are param-only updates within one page, where
stealing focus would be worse than leaving it.

---

### 83. A post's recorded source URL is never rendered — `S`

**Observed.** `posts.source` is captured at upload
(`src/routes/upload.lazy.tsx:391-398`, labelled "Source URL"), edited from the
post page (`src/components/PostDetail/PostDetailDisplay.tsx:202-213`), proposed
through the edit-suggestion dialog
(`src/components/PostDetail/PostEditSuggestionDialog.tsx:188`), constrained to
an http(s) URL by `HttpsUrl` (`src/lib/posts/posts.schema.ts:75-77,161`),
selected by the detail query (`src/lib/posts/posts.service.ts:548`), and mapped
into the loader's `post` (`:627`). `docs/features.md:78` lists "URL source"
among the metadata a post carries.

No read path renders it. `Post.tsx` draws the video or gallery, the title,
`formatEpisodeInfo`, the description, `Posted <date>`, the tags, the related
post, and the uploader — `post.source` appears in no component outside those
three forms. The sibling `sourceType` is only a shade better:
`formatEpisodeInfo` (`src/lib/posts/episode-info.ts:32-34`) turns it into the
literal label `Movie` and drops `tv_series`, while `series-hubs.ts:62,70` uses
it only to classify the post.

**Why it matters.** On an archive whose entries are collected from elsewhere
(an upload hint reads "Source: 403"), the attribution field is write-only: a
reader cannot reach the original post, and the value is visible only to the
uploader, only inside the edit form. That also makes `docs/features.md:78` wrong
about what a post displays.

**Fix.** Render a labelled external link beside the `Posted <date>` line when
`post.source` is a non-empty string, with `target="_blank"` and
`rel="noopener noreferrer"` (`AGENTS.md`). Either give `sourceType` a visible
label in the same pass or drop it from `docs/features.md:78`.

---

### 84. The web app manifest is never linked, and declares no name — `S`

`public/site.webmanifest` ships an installable-app manifest whose `name` and
`short_name` are empty strings (lines 16-17), which has no `start_url` or
`scope`, and whose `theme_color` and `background_color` are both `#ffffff`.
Nothing links it: the root `head()` (`src/routes/__root.tsx:75-95`) lists the
favicons and the apple-touch-icon but no `rel: "manifest"`, and nothing in
`src/` or `vite.config.ts` references it.

**Why it matters.** As checked in the manifest is dead weight — the browser never
reads it, so there is no install path, no launcher name, and no icon fallback for
an installed shortcut. Linked as-is it would be worse than absent: the installed
app would be named "" on the home screen, and its splash screen would stay white
for dark-mode users even though `__root.tsx:105-114` already ships a dark
`theme-color`.

**Fix.** Add `{ href: "/site.webmanifest", rel: "manifest" }` to the root
`head()` links, set a real `name`/`short_name`, add a `start_url`, and give
`theme_color` a value that reflects the app rather than the light surface. One
line of work alongside item 5's per-route metadata pass.

---

### 85. Ten compat-layer utility classes never reach the production stylesheet — `S`

**Observed.** This is item 72's failure in the third map the compat layer builds
by string concatenation. A style prop becomes a class name verbatim —
`pt={4}` → `pt-4`, `py={6}` → `py-6`, `gap={0}` → `gap-0`, `minW={4}` →
`min-w-4` (`src/components/ui/ui-utils.ts:130-149,333-357,378-381,509-512`) —
and Tailwind v4 keeps such a class only when the same text appears somewhere in
the scanned source. `src/styles/safelist.ts` exists to carry the names that are
only ever assembled at runtime (`:1-9`); its spacing block (`:11-56`) lists
`p-2/-3/-4/-6`, `px-1/-1.5/-2/-2.5/-3/-4/-6`, `py-0.5/-1/-1.5/-2/-8`, `pt-3`,
`pt-16`, `pb-2`, `mt-1/-2/-4/-8`, `mb-1…6/-8`, `ms-2`, `-me-2`, `gap-1…6`, and
the sizing block carries `min-w-0` (`:109`).

Ten names the layer emits are in neither it nor any other literal:

- `py-6` — `Container py={6}` at `src/routes/admin.tsx:49` and
  `src/routes/notifications.tsx:70`. No padding class survives, so those two
  pages lose their vertical inset entirely rather than 1.5rem of it.
- `p-8` — the results-state panel, `src/components/PostsResultsState.tsx:59`,
  which is every loading, empty, and error state it draws.
- `mt-6` and `pt-4` — the two rule-separated blocks of the contributor profile,
  `src/components/ContributorProfile.tsx:77,106`; `pt-4` also separates the
  converter's episode list, `src/routes/convert.lazy.tsx:316`.
- `pb-0` — `src/routes/users.$id.tsx:119`, `<Box p={4} pb={0}>`. This is the one
  that asks to _remove_ space, so the last block keeps the 1rem of bottom
  padding the prop exists to cancel: `p-4` is safelisted and `pb-0` is not.
- `mr-2` — the badge in `src/components/DiscoverySummary.tsx:18`; `ml-2` — the
  converter's field row, `src/routes/convert.lazy.tsx:550`.
- `min-w-4` — the unread-count pill, `src/routes/__root.tsx:147`, which falls
  back to a `px={1}`-wide capsule instead of the intended 1rem minimum.
- `min-h-[300px]` — the admin panel's centered state block,
  `src/routes/admin.tsx:77`. The safelist carries `min-h-[200px]`,
  `min-h-[400px]`, and `min-h-[600px]` (`:100-102`) but not this one, so the
  block collapses to its content instead of holding the height it asks for.
- `gap-0` — `src/components/ContributorProfile.tsx:18,79`,
  `src/components/admin/ReportsPanel.tsx:42`,
  `src/components/admin/SuggestionsPanel.tsx:71`,
  `src/components/admin/PromotionQueuePanel.tsx:59` and
  `src/routes/notifications.tsx:99`. This is the one that renders as intended by
  accident: with no class emitted there is no `gap` declaration at all, and a
  flex container's initial gap is already `0`.

The build agrees and is current — no file under `src/` is newer than
`.output/public/assets/app-kzIUL02g.css` (checked 2026-09-10). That stylesheet
carries `.p-5{`, `.px-4{`, `.py-2{`, `.py-8{`, `.mt-3{`, `.mt-4{`, `.mr-1{`,
`.mb-5{`, and the escaped `.mt-0\.5{` and `.gap-1\.5{`, while none of the ten
names above resolves in it.

**Verified (2026-09-10), the colour half of the same audit is clean.** Every
class the `bg`, `color`, and `borderColor` props produce over the values used in
`src/` resolves in that stylesheet — six `bg-*`, four `border-*`, and twenty
`text-*` names, including all nine dark counterparts in `TEXT_DARK_VARIANTS`
(`src/components/ui/ui-utils.ts:72-82`). The safelist, the literal corpus, and
the build agree there; the size side above is where they diverge.

**Why it matters.** A hand-maintained safelist drifts, and it drifts silently in
the direction that costs the most: adding a prop looks like a one-token change,
passes `tsc`, `oxlint`, and review, and does nothing in production. `pb-0` after
`p-4` is the sharpest case, because the missing name turns an explicit override
into its opposite — the panel keeps the padding its author wrote code to remove.

**Fix.** Add the ten names to `src/styles/safelist.ts`, or — better, and the same
conclusion as item 72 — stop maintaining the list by
hand. `@source inline("…")` (`src/styles/app.css:10`) expands braces, so a single
entry such as
`@source inline("{p,px,py,pt,pb,pl,pr,m,mx,my,mt,mb,ml,mr,gap}-{0,0.5,1,1.5,2,3,4,6,8}")`
covers every value these props take today plus the neighbours a next edit is
likely to reach for, and `min-h-[{200,300,400,600}px]` in the same form covers
the min-height steps. The current dependency supports it: the installed
`tailwindcss` 4.3.3 expands the pattern before matching in
`node_modules/tailwindcss/dist/lib.js` (the `@source` branch).

---

### 86. `minH` and `minW` build a class Tailwind cannot parse for rem values — `S`

**Observed.** The two size mappers concatenate the prop value straight onto the
prefix — `minH` returns `min-h-${v}` (`src/components/ui/ui-utils.ts:393-403`),
`minW` returns `min-w-${v}` (`:378-381`) — and the only value they treat
specially is one that ends in `px` or contains `(`, which they wrap in brackets.
A rem value therefore becomes `min-h-16rem` or `min-w-6rem`, and neither of
those is a class Tailwind v4 can parse: compiling the installed `tailwindcss`
4.3.3 against `@import "tailwindcss"` and asking it to build `min-h-16rem`,
`min-w-6rem`, `h-16rem`, and `w-16rem` produces no rule at all, while the
bracketed `min-h-[16rem]` and `min-w-[6rem]` compile to 51 and 48 bytes of CSS
in the same run. So the class name is emitted, matches nothing, and a safelist
entry cannot rescue it — there is no valid spelling of it.

Two call sites pass such a value:

- `minH="16rem"` on the results-state panel
  (`src/components/PostsResultsState.tsx:58`), the box behind every loading,
  empty, and error state. With the declaration dropped it collapses to its
  content height instead of holding 16rem.
- `minW="6rem"` on the label column of the edit-history field list
  (`src/components/PostDetail/PostEditHistory.tsx:49`, one label/value `HStack`
  per changed field), which no longer reserves the gutter that lines the values
  up into a column.

Every other length in the tree is either a bare number, which produces the scale
form the safelist already carries (`min-h-32`, `src/styles/safelist.ts:99`), or a
bracketed length (`minH="200px"` → `min-h-[200px]`, `:100`), including the
`calc()` case the mapper already brackets (`minH="calc(100vh - 4rem)"` →
`min-h-[calc(100vh-4rem)]`, `:103`), which is why the gap survived review.

**Why it matters.** This is the third instance of the failure in items 72 and
85 — a class composed at runtime that never reaches the stylesheet — but with a
worse fix constraint: the safelist cannot help, because the generated name is
outside Tailwind's grammar. It reads as working code from both ends: the prop is
typed, the call site is reachable, and the layout intent is visible.

**Fix.** In `ui-utils.ts`, bracket any `minH`/`minW` value that is not a plain
number or a `--min-height`/`--min-width` keyword, instead of the current
`endsWith("px")` test — treat an unmapped length the way the `calc()` case is
already treated. `h` and `w` (`:359-392`) have the same prefix-only shape but no
call site passes a non-`px` length today (`h` is only `"200px"` or `"full"`, `w`
only `"auto"` or `"full"`), so they are worth the same guard while the mapper is
open.

---

## P3 — Exploratory / cosmetic

### 23. The home page shows nothing about the product — `M`

`src/routes/index.tsx` is a centered full-height column: a bare `H1`, the search
box, a popular-tags list, and a news link. There is no hero imagery, no preview
of what the archive contains, and no primary call to action (browse or upload).
For a media archive the first screen should demonstrate the content.

Also, `index.tsx:29-33` wraps `PopularTagsSection` in `<Suspense>` although the
`useSuspenseQuery` on line 15 has already suspended the whole component — the
fallback is unreachable.

**Resolved (2026-09-11).** The homepage now presents the archive positioning,
hero copy, search action, popular tags, and a path to updates above the fold.

### 24. Thumbnails are letterboxed against near-black in light mode — `S`

`PostCard.tsx:137` uses `bg="gray.900"` behind `objectFit="contain"`, so light
mode shows a black frame around every 16:9 thumbnail, and posters of differing
aspect ratios read as inconsistent. Consider a neutral surface token, or a
`blurhash`/dominant-color fill while loading.

### 25. Jargon in discovery copy — `S`

`DiscoveryViewSelector.tsx:30,33` labels the group "Browse intentionally" and
explains that chronological "stays the default". These read as internal product
naming rather than user-facing language.

### 44. The discovery summary exposes internal ranking signals as user copy — `S`

Item 25 covers the selector copy; the panel below it is more explicit.
`src/components/DiscoverySummary.tsx:28-38` renders `info.signals` and
`info.timeWindow` under the bold labels "Signals:" and "Time window:". Those
strings in `src/lib/posts/discovery.ts:11-56` read like ranking-spec notes
rather than user-facing prose:

- trending — "Likes minus dislikes in the last 7 days; recent likes and upload
  time break ties."
- random-study — "A queue seed only; no popularity or quality signal."
- under-seen `description` — "A small-visibility experiment for recent posts
  that have not accumulated many likes yet."

**Fix.** Rewrite the `description`/`signals`/`timeWindow` strings as plain
language, or collapse the panel to the one-line `description` plus the existing
`DISCOVERY_TRANSPARENCY_NOTE` and drop the scoring detail.

### 26. Floating devtools are mounted unconditionally — `S`

`src/routes/__root.tsx:500` renders `TanStackDevtools` with Query, Router, Form,
and Pacer panels with no `import.meta.env.DEV` guard. Worth confirming this is
tree-shaken out of the production bundle rather than trusting it.

### 46. The shortcuts dialog bypasses the design-system `Dialog` wrapper — `S`

`src/components/KeyboardShortcutsDialog.tsx:1` imports `Dialog` from
`@ark-ui/react` directly and hand-rolls the backdrop, positioner, and content
with Tailwind classes (`:61-65` — `bg-black/50`, `rounded-lg border
border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900`).
Every other dialog in the app goes through `src/components/ui/overlay.tsx`
(`ReportDialog.tsx:5`, `VideoMetadataDialog.tsx:7`, `Comments.tsx:13`,
`PlaylistAddModal.tsx:7`, …), so this one drifts on the shared radius, shadow, and
focus-ring tokens, and its `KeyBadge` (`:48`) hardcodes `bg-gray-100
dark:bg-gray-800`.

The copy also has two rows both labelled "Focus search" (`:30-31`, for `G` `S`
and `⌘K`), and the `search-sequences` id matches neither binding.

**Fix.** Use the shared `Dialog` wrapper, and give the two search entries
distinct labels (or merge them into one sequence row).

---

### 61. The post page's `Suspense` fallback can never render — `S`

**Observed.** `src/routes/posts/$postId.tsx:37` reads
`useSuspenseQuery(postQueryDetail(postId))` inside `PostComponent`, and `:60-67`
returns a `<Suspense>` — with a `Loading post...` spinner — around
`PostDetailDisplay`, inside that same component. React looks for the boundary
above whatever suspended, so the ancestor it finds is the router's match
boundary, not this one. The fallback is dead: the route paints
`PostsPageLayout` and then nothing until the query resolves.

**Root cause.** The boundary wraps the view instead of the read. Item 23 records
the identical mistake on `/` (`index.tsx:29-33`, whose `useSuspenseQuery` on
`:15` has already suspended `Home`), and item 51 covers the missing pending
state from the other side: neither `pendingComponent` in the app
(`convert.lazy.tsx:29`, `upload.lazy.tsx:50`) is on these routes, so nothing
renders in the gap.

**Fix.** Either delete both dead boundaries, or move the suspending read into a
child of the boundary (`<Suspense><PostDetailLoader … /></Suspense>`). The
route-level pending UI item 51 asks for closes the whole class.

---

### 82. The "Focus search" shortcuts are inert on most routes — `S`

**Observed.** `GlobalShortcuts` is mounted for every route
(`__root.tsx:531`) and binds `Mod`+`K` and `G` `S` to
`focusSearchInput` (`GlobalShortcuts.tsx:21-39`), which does
`document.getElementById("search-input")?.focus()`. `#search-input` is
rendered only by `SearchBox.tsx:156`, and `SearchBox` is used only by `/`
(`index.tsx:28`) and by `PostsPageLayout.tsx:132` — that is, `/posts`,
`/posts/$postId`, `/posts/tags/$tag`, and `/users/$id`. On `/users`,
`/playlists`, `/news`, `/wiki`, `/help`, `/account*`,
`/notifications`, `/admin/*`, `/upload`, and `/convert` the element does
not exist, so both bindings silently do nothing.

The dialog that documents them is reachable from every one of those pages —
`Shift`+`/`, or the always-mounted floating button
(`GlobalShortcuts.tsx:44-56`: fixed at bottom-left, `zIndex 50`, no
`import.meta.env.DEV` guard, no dismissal) — so the app advertises a shortcut
that is dead on most screens. The same table
(`KeyboardShortcutsDialog.tsx:26-44`) is incomplete in the other direction: it
lists the `,` and `.` frame steps but omits the `Space` play/pause binding
implemented at `Video.tsx:75-83`.

Item 46 covers this dialog's styling, its two identically-labelled "Focus
search" rows, and the unused `search-sequences` id; the reach of the binding
and the missing row are separate.

**Fix.** Make the binding work off the search pages — navigate to `/posts` and
focus the box on resolve, through the same `onResolved` hook item 81 adds — or
scope the two rows to the pages that have one; and add the `Space` row.

---

## Cross-references

- `docs/ideas.md` is the **product** backlog (wiki-edit workflow, video
  replacement, multi-image posts, series hubs, discovery feeds, moderation case
  view, …). It is about capabilities. This document is about how the existing
  capabilities are presented.
- `docs/features.md` is the **behavioural** source of truth. Items here that
  change visible behaviour (tag-filter application and search history, items 2-3;
  footer content, nav structure, page titles; the admin panel error and empty
  states, item 30; per-notification read state, item 35; the form-label wiring,
  item 39; the storage-cleanup confirmation, item 41; the saved-search load
  error, item 42, now covering the notification inbox and passkey list too; the
  active-filter chip labels, item 43; the Media Info labels, item 45, on the
  post detail page as well as the dialog; and the moderation queue copy,
  feedback, and confirmation, items
  47-49; the playlist routes' pending state, item 51; the mark-all-read failure
  feedback, item 52; the password-form validation messages, item 53; and the
  post-type pressed state, item 54; the field helper and error text contrast,
  item 56; the loading-button pending state, item 57; and the in-app
  search-syntax hint, item 60; the profile tab semantics, item 63; the auth error
  styling and placement, items 64-65; the heading weight in the two account
  sections, item 66; the converter's result preview, item 67; the progress bar's
  accessible name and the `striped` prop, item 68; the heading element for the
  post page's Comments and Edit history sections, item 69; the comments
  empty-state copy, item 70; and the signed-out vote affordance, item 71) should
  be reflected there once implemented, per `AGENTS.md`; so should the
  unvalidated numeric route params, item 74; the five dead not-found states,
  item 75; the moderation queues' row-scoped pending state, item 76; the tag
  feed's missing loading, error, and empty states, item 77; the collapsed line
  breaks in post descriptions and comments, item 78; and the browse routes'
  missing server-rendered HTML, item 79; the browse routes' tracking-parameter
  500s, item 80; the missing route-change focus and announcement, item 81;
  the inert search shortcuts and the dialog's missing `Space` row,
  item 82; and the post's source link, item 83.
- Items 4, 5, and 84 are the same surface seen from three sides: the starter
  `seo()` helper, the missing per-route `head()`s, and the unlinked manifest.
  Item 84 is the install-side counterpart and needs no `docs/features.md` entry.
- Items 72 and 85 are one bug in two maps: a class name composed at runtime that
  `src/styles/safelist.ts` does not carry, so Tailwind drops it from the build.
  Item 72 is the responsive-column map with two names missing; item 85 is the
  spacing and sizing map with ten, where the colour half of the same audit is
  clean. Item 86 is the degenerate case of the same failure, where the composed
  name is outside Tailwind's grammar and no safelist entry can bring it back.
- Three items overlap deliberately: `ideas.md` §3 (multi-image posts) needs a
  gallery that items 10 and 11 here affect; `ideas.md` §1 (wiki-edit UI)
  depends on the `Heading` fix (item 1) to render a legible diff; and the
  accessibility pass in `ideas.md` §4 overlaps with items 9, 16, 17, 21, 28, 29,
  32, 33, 34, 36, 39, 40, 48, 52, 53, 54, 55, 56, 57, 58, 62, 63, 65, 68, 69,
  71, and 81 (form labels; borders and contrast; unannounced status text;
  pressed state; landmarks; pending state; keyboard access to scroll regions;
  tab semantics and keyboard access to the profile tab strip; error focus
  management and route-change focus; the progress bar's accessible name; the
  post page's section titles; and the signed-out vote affordance).
- The `/admin/*` panels (items 28, 30, and 41) are the moderation UI that
  `ideas.md` calls a "moderation case view". If that capability lands, these
  screens are replaced rather than fixed, so items 30 and 47-49 are only worth
  the effort if they are staying in roughly their current shape.

---

## Open questions

1. **Where should this register live long-term?** A checked-in markdown file (as
   now), or converted into individual GitHub issues on `ozakione/vitesakuga`
   (see `docs/agents/issue-tracker.md`)? A file is easy to review and edit; issues
   are easier to assign, close, and reference from PRs. They are not mutually
   exclusive — the file can act as the source and issues as the work items.
2. **Is the site's navigation meant to stay developer-facing?** Items 6 and 26
   assume the `Dev Tools` menu and floating devtools are temporary.
3. **Is the design system meant to converge on Chakra-style props**
   (`useChakraProps`) as the primary surface, with Tailwind classes as an escape
   hatch? Item 1's fix depends on that answer, and items 9, 14, 39, 40, 46, 56,
   and 59 are symptoms of the same tension.
4. **Does the archive have a licensing/attribution obligation** that the missing
   footer (item 8) should carry?
5. **Are the `/admin/*` panels meant to ship to staff as they are?** Items 30,
   41, and 47-49 are an afternoon of work each, but only if they are staying; if
   the moderation case view is imminent, they are better left alone until it
   replaces them.
6. **What should mark a notification read?** Item 35 can be fixed several ways —
   fire on row click, on hover, or only through an explicit control — and the two
   destination-less `promotion-*` rows still need a decision. Is a per-row "mark
   read" the intent, or did the stale hook comment describe the real plan (the
   inbox clears when it is opened)?
7. **Which form-label convention wins?** Item 39's label wiring can be fixed
   either by giving every `Field.Root` a stable `id` (the field machine then
   generates a matching `for`) or by writing an explicit
   `Field.Label htmlFor="…"` at each call site. The two conventions already
   coexist; picking one is a design-system decision that belongs with question 3.
   Item 65 asks the same for error regions: whether the message belongs above the
   form with focus moved to it, or beside the field it concerns.
8. **What should a suspense-pending route render?** Item 51 can be closed with a
   route `pendingComponent`, or once for the whole app on the router, and item 12
   argues the content routes should show skeletons rather than spinners. Deciding
   the shape (skeleton grid, spinner, or nothing while `defaultPreload: "intent"`
   makes the cache warm) settles both, since five of item 12's spinner sites are
   in fact unreachable. Item 61 adds the mirror image: two `Suspense` fallbacks
   that sit _below_ the suspending read and therefore never render either.

9. **Should the converter's progress bar be striped?** Item 68 found `striped`
   accepted and dropped; Zag has no striped part, so implementing it means custom
   CSS on `Progress.Range`. The same item raises the bar's name: "Conversion
   progress" is the obvious label, but if the profile's points bar or an upload
   bar ever moves onto this primitive, the naming belongs on `Progress` rather
   than at the call site.
