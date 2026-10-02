# Commit signing

All commits reachable from `master` should show as **Verified** on GitHub.

## How signing is configured (do not change)

- **jj** (user config): `signing.behavior = "own"`, SSH backend, key `~/.ssh/id_ozaki.pub`. Every commit jj creates or rewrites is SSH-signed automatically.
- **git** (global config): `commit.gpgsign = true`, `gpg.format = ssh`, SSH signing key. This is recorded for reference; repository history work must use jj.

Local work needs no extra steps. The failure modes are all **remote**: commits created by GitHub's API or in agent sandboxes, which have no access to the local signing key.

## Rules for agents and humans

- **Never merge PRs with `gh pr merge` or the GitHub API.** API-created merge/squash/rebase commits are created server-side and are **unsigned by design** — there is no way to configure signing for them. Merge on github.com instead (web-UI merges are signed by GitHub's `web-flow` key), or merge locally with jj and push the signed merge commit.
- **Never update PR branches via the API** (`gh pr update-branch` / the "Update branch" endpoint) — same unsigned-commit problem. Rebase the branch locally with jj (signed) and force-push.
- **Agent sandboxes (ChatGPT/Codex, cloud VMs) cannot sign commits** — they have no access to `~/.ssh` or `~/.config/git`. Their pushes will always be Unverified. To keep history verified, merge their PRs with **squash merge on the web UI** so their work lands as a single GitHub-signed commit.
- Local jj workspaces are the required way to produce commits in this repository. Use jj for all history operations; do not create commits with Git.

## Known unverified history

2026-09-07: PRs #4–#8 were merged with `gh pr merge`, producing 11 unsigned commits (API merges, API branch updates, and two agent-sandbox commits). Left as-is; do not reproduce. Rewriting them would require a force-push of master for cosmetic gain.
