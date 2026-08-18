# Browser Control (with nub) — Agent Reference

ViteSakuga agents use [Browser Control](https://github.com/anomalyco/browser-control)
(`@opencode-ai/browser-control`) to drive the user's **existing Chromium-family browser**
(Brave) with Playwright — real profile, logged-in sessions, no separate browser.

This page documents the **specific nub + install layout that works on this machine**,
the traps that break it, and the exact commands to use. Read it before any browser
control task.

## Architecture

```
Agent (LLM)  →  browser-control CLI  →  local relay (127.0.0.1:19989)  →  Browser Control
                extension (loaded unpacked in Brave)  →  the user's browser tab
```

Flow: **inspect → act → verify**. The skill file is the behavioural contract:
`~/.browser-control/node_modules/@opencode-ai/browser-control/skills/browser-control/SKILL.md`
(or `.agents/skills/browser-control/SKILL.md` in this repo) — read it and follow it.

## Install layout (working)

Browser Control does **not** live in the project's dependencies. It lives in an
isolated, pinned toolchain outside the repo, with a `bc` wrapper on `PATH`.

| Piece | Location / value |
|---|---|
| Toolchain (CLI + pinned deps) | `~/.browser-control/` |
| Extension (loaded unpacked in Brave) | `~/.browser-control/node_modules/.store/@opencode-ai+browser-control@0.4.0_ioredis@5.11.1/node_modules/@opencode-ai/browser-control/extension/dist` |
| Extension ID the relay accepts | `glnkinmmgjbmncnmgfblbjhkkhboidka` |
| Wrapper command | `bc` = `cd ~/.browser-control && nub exec browser-control "$@"` |
| Relay log | `~/.browser-control/relay.log` |
| Versions | package `0.4.0`, extension `0.0.23`, relay HTTP `127.0.0.1:19989` |

Pinned `package.json` at `~/.browser-control` (do **not** change these versions):

```json
{
  "dependencies": {
    "@opencode-ai/browser-control": "0.4.0",
    "effect": "4.0.0-beta.97",
    "@effect/platform-node": "4.0.0-beta.97",
    "ws": "8.18.3"
  }
}
```

## Usage — the 3 rules for LLMs

1. **Always invoke through the `bc` wrapper** (or `cd ~/.browser-control && nub exec browser-control …`).
   Never `nub add` browser-control into this repo's `package.json`.
2. **Keep the extension path stable.** Chrome derives the unpacked extension ID from
   the SHA-256 of the extension folder's realpath. The relay accepts **only** the ID of
   its own bundled `extension/dist` path (or the official Chrome Web Store ID). Moving or
   reinstalling the toolchain changes the store hash → new path → new ID → WebSocket **403**.
3. **Relay restart / extension reload pairing.** If `connected:false`: restart the relay
   from `~/.browser-control`, then reload the extension in Brave (or vice versa). The
   extension only announces itself once the relay it hashes against is the one running.

### Everyday commands

```bash
bc execute 'return { url: page.url(), title: await page.title() }'
bc execute --session <id> '…'            # continue an existing session
bc status --json                         # relay + extension health
bc session adopt --target-url github.com --session github   # use an existing tab
bc journal --session <id>                # what was done
```

A bare `bc execute` creates a fresh session-owned page and prints the session ID +
continuation command.

## Why this layout (the traps, so you don't re-break it)

| Trap | Symptom | Root cause |
|---|---|---|
| In-project `nub add @opencode-ai/browser-control` | `exit 1`, no output | CLI is built against `effect@4.0.0-beta.97`; repo pins `effect@4.0.0-rc.108`. Silent teardown. |
| `nub add -g` global store | `exit 1`, no output | Global store dedupes `@effect/platform-node-shared` to `rc.110_effect@rc.110` while the CLI needs the `…_effect@beta.97` pairing. Two effect runtimes mix → silent `exit(1)` in `defaultTeardown`. |
| Loading the extension from any other copy (project, old sandbox, global store) | WebSocket handshake `403` | Extension ID must equal the relay's own path hash. See rule 2. |
| `nub add` refuses the package | `ERR_NUB_NEW_PACKAGE_NAME` | Package is <30 days old. Pass `--allow-low-downloads`. |
| Port busy | relay `EADDRINUSE` | A previous relay is still running. Kill the listener: `lsof -tiTCP:19989 -sTCP:LISTEN \| xargs kill`, then restart. |

The isolated-folder layout works because it materialises a **flat, ESM-resolvable**
`node_modules` with the correct `platform-node-shared@rc.110_effect@beta.97` pairing.
nub's global store layout (content-addressed store + `aube-bin-shim`) can achieve this,
but only with exact version pinning; the current global store is broken for this package.

## First-time setup on a fresh machine

```bash
mkdir -p ~/.browser-control && cd ~/.browser-control
# write the pinned package.json above
nub install
# verify
nub exec browser-control --version         # → browser-control v0.4.0
# wrapper
cat > ~/.local/bin/bc <<'EOF'
#!/bin/sh
cd "$HOME/.browser-control" || exit 1
exec nub exec browser-control "$@"
EOF
chmod +x ~/.local/bin/bc
# relay + extension
bc serve --log-level debug >> ~/.browser-control/relay.log 2>&1 &
# Brave → brave://extensions → Developer mode → Load unpacked →
#   ~/.browser-control/node_modules/.store/@opencode-ai+browser-control@0.4.0_ioredis@5.11.1/node_modules/@opencode-ai/browser-control/extension/dist
bc status --json    # extension.connected should be true
```

The store name inside `.store/` (the `…@0.4.0_ioredis@5.11.1` suffix) can change if
dependency resolution changes — recompute the extension path and ID if the installed
versions ever differ:

```bash
node -e "const fs=require('fs'),crypto=require('crypto');const p=fs.realpathSync(process.env.HOME+'/.browser-control/node_modules/@opencode-ai/browser-control/extension/dist');const d=crypto.createHash('sha256').update(p).digest();let id='';for(const b of d.subarray(0,16))id+=String.fromCharCode(97+(b>>4),97+(b&15));console.log(p);console.log(id)"
```

## Troubleshooting quick reference

- `execute` succeeds but extension `connected:false` before it → extension not loaded /
  wrong copy loaded. Reload from the realpath above.
- `403` on `ws://127.0.0.1:19989/extension` → extension loaded from a different path
  (ID mismatch). Reload from `~/.browser-control`'s extension/dist.
- `exit 1` with no output → dependency-version mixing. Do not reinstall via project or
  `-g`; repin the isolated `~/.browser-control` exactly as above.
- Fill timeouts on login fields → some browser extensions fight focus; use the explicit
  `fillInput` fallback from the skill.
- Downloads → unsupported through extension-backed tabs; read bytes via `fetch` + `fs`.
- Auth / 2FA / CAPTCHA / payment → use skill `handoff()` and must verify the URL/element after.

## Repo references

- Skill: `.agents/skills/browser-control/SKILL.md`
- This doc: `docs/agents/browser-control.md`