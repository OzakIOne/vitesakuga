# Frontend design & UX review — ViteSakuga

Review of the frontend design, layout, accessibility, and feature surfaces.
This document is the register for improvements found during that review: it
records what was observed, where it lives in the source, and what the fix is.
It is a living list — update it as items land rather than opening a new review
each time.

**Method.** Source review of `src/routes`, `src/components`, and the design-system
primitives in `src/components/ui`, cross-checked against the rendered HTML of the
running dev server (`/`, `/posts`, `/login`, `/users`, `/news`, `/help`) and the generated
stylesheet. No visual/browser tooling was used; contrast ratios are computed
from the _oklch()_ tokens in that stylesheet with the WCAG relative-luminance
formula.

**Scope.** Presentation and interaction only. Product-backlog items live in
`docs/ideas.md`; behavioural contracts live in `docs/features.md`. See
[Cross-references](#cross-references) for how the three relate.

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

### 13. Empty states are inconsistent — `S`

`PostsResultsState.tsx:113` renders a proper empty state (`Heading` + guidance)
for search. Three other surfaces fall back to a bare string: `No posts` appears
in `playlists.index.tsx:117`, `users.$id.playlists.index.tsx:111`, and
`account_.playlists.index.tsx:164`, while `account_.playlists.$playlistId.tsx:375`
and `users.$id.playlists.$playlistId.tsx:115` use `Text color="gray.500"`.

**Fix.** Extract one `EmptyState` (title, description, optional action) and use
it everywhere, so "No posts" also offers the next step.

### 14. Three copies of the color-token class maps — `M`

`src/components/ui/button.tsx`, `src/components/ui/feedback.tsx`, and
`src/components/ui/overlay.tsx` each define their own `Palette` list and their own
solid/subtle/outline `Record<Palette, string>` maps. They have already drifted
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

## P3 — Exploratory / cosmetic

### 23. The home page shows nothing about the product — `M`

`src/routes/index.tsx` is a centered full-height column: a bare `H1`, the search
box, a popular-tags list, and a news link. There is no hero imagery, no preview
of what the archive contains, and no primary call to action (browse or upload).
For a media archive the first screen should demonstrate the content.

Also, `index.tsx:29-33` wraps `PopularTagsSection` in `<Suspense>` although the
`useSuspenseQuery` on line 15 has already suspended the whole component — the
fallback is unreachable.

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
  error, item 42; the active-filter chip labels, item 43; the Media Info labels,
  item 45; and the moderation queue copy, feedback, and confirmation, items
  47-49; the playlist routes' pending state, item 51; the mark-all-read failure
  feedback, item 52; the password-form validation messages, item 53; and the
  post-type pressed state, item 54; the field helper and error text contrast,
  item 56; the loading-button pending state, item 57; and the in-app
  search-syntax hint, item 60) should be reflected
  there once implemented, per `AGENTS.md`.
- Three items overlap deliberately: `ideas.md` §3 (multi-image posts) needs a
  gallery that items 10 and 11 here affect; `ideas.md` §1 (wiki-edit UI)
  depends on the `Heading` fix (item 1) to render a legible diff; and the
  accessibility pass in `ideas.md` §4 overlaps with items 9, 16, 17, 21, 28, 29,
  32, 33, 34, 36, 39, 40, 48, 52, 53, 54, 55, 56, 57, 58, and 62 (form labels;
  borders and contrast; unannounced status text; pressed state; landmarks;
  pending state; keyboard access to scroll regions).
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
8. **What should a suspense-pending route render?** Item 51 can be closed with a
   route `pendingComponent`, or once for the whole app on the router, and item 12
   argues the content routes should show skeletons rather than spinners. Deciding
   the shape (skeleton grid, spinner, or nothing while `defaultPreload: "intent"`
   makes the cache warm) settles both, since five of item 12's spinner sites are
   in fact unreachable. Item 61 adds the mirror image: two `Suspense` fallbacks
   that sit _below_ the suspending read and therefore never render either.
