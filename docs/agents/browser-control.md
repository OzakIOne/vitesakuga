# Browser Control (with nub) — Agent Reference

ViteSakuga agents use [Browser Control](https://github.com/anomalyco/browser-control)
(`@opencode-ai/browser-control`) to drive the user's **existing Chromium-family browser**
(Brave) with Playwright — real profile, logged-in sessions, no separate browser.

Use the loop **inspect → act → verify**. The repository skill is the behavioural
contract and the detailed source of truth:
`.agents/skills/browser-control/SKILL.md`.

## Architecture

```
Agent (LLM) → Browser Control CLI → local relay → Browser Control extension → user's browser tab
```

## Install and commands

Browser Control is a repository dev dependency. The installed CLI currently
reports **v0.5.1**. Invoke it through the project toolchain:

```bash
nub exec browser-control --version
nub exec browser-control status --json
nub exec browser-control doctor
```

Do not copy package versions, extension IDs, store paths, or relay details into
new automation. Those values depend on the installed toolchain and browser
profile. For the full workflow, use `.agents/skills/browser-control/SKILL.md`.

Typical commands:

```bash
nub exec browser-control execute 'return { url: page.url(), title: await page.title() }'
nub exec browser-control execute --session <id> 'return page.url()'
nub exec browser-control session adopt --target-url github.com --session github
nub exec browser-control journal --session <id>
```

A bare `execute` creates a fresh session-owned page and prints a continuation
session ID. Adopt an existing tab when its authenticated browser state is
needed. Inspect the real page before choosing locators, perform the narrowest
stable action, and verify the resulting URL or stable UI element.

## Safety rules

- Never put credentials in execute source, logs, screenshots, or journals.
- Use the skill's `handoff()` before WebAuthn, 2FA, CAPTCHA, or payment prompts.
- For destructive UI work, read candidates, obtain approval for exact stable
  identifiers, then re-select, confirm, and verify the result independently.
- Do not globally accept native dialogs or bypass Browser Control's CDP
  guardrails.
- Playwright download artifacts are unavailable through extension-backed tabs;
  use the documented fetch/file approach instead.

## Troubleshooting

1. Run `nub exec browser-control doctor`.
2. Run `nub exec browser-control status --json` and inspect the exact session and
   target ownership.
3. Reproduce once with the smallest `execute` command before changing setup.
4. If the extension is disconnected or the relay is stale, follow the recovery
   steps in `.agents/skills/browser-control/SKILL.md`; do not install a second
   copy into the project or a global store.

## Repo references

- Skill: `.agents/skills/browser-control/SKILL.md`
- This reference: `docs/agents/browser-control.md`
