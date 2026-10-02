# Frontend review

This page is the short, current index for frontend review work. The detailed
2026 review and its historical handoff are preserved in the archive below.

## Current status — 2026-10-02

- The detailed review recorded 86 findings; all were marked resolved at the
  2026-09-11 review completion.
- On 2026-10-02, Playwright check B5 caught a missing page-level heading on `/`.
  The homepage heading was restored, and the full Playwright suite passed:
  **58/58 tests in 15 files** (`nub run test:ee`).
- No actionable findings from this review are currently open. No GitHub issue
  was created during this update.

## Tracking new findings

Open a GitHub issue for each concrete, actionable defect or improvement, as
described in [`docs/agents/issue-tracker.md`](./agents/issue-tracker.md). Include
the observed and expected behavior, reproduction steps, priority, acceptance
criteria, and relevant test or stable source symbol. Prefer paths and symbols
over line numbers, which drift as files change.

Keep undecided product questions in the historical review until a decision makes
the requested behavior concrete; then open an issue for the agreed work.

## Archive

- [Detailed frontend review, findings 1–86](./reviews/frontend-review-2026-10-02.md)
- [Historical handoff from 2026-09-11](./reviews/frontend-review-handoff-2026-09-11.md)
