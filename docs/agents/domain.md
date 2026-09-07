# Domain Docs

How engineering skills consume this repository's domain documentation when exploring the codebase.

This repository currently uses `CONTEXT.md` as its glossary and has no checked-in `docs/adr/` directory.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in, when this directory exists.

If a referenced document does not exist, proceed silently. Do not suggest creating it upfront; add domain documentation only when a real decision or glossary gap requires it.

## File structure

Single-context repo:

```
/
├── CONTEXT.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
