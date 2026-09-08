ViteSakuga uses a role ladder to keep the archive safe without slowing contributors down.

## Roles

Roles progress from `novice → uploader → moderator → admin`. Permissions — not role labels — drive every authorization check, so what each role can do is explicit in code.

- **Novice** — newly registered accounts. They can browse, vote, comment, and build playlists, but cannot upload yet.
- **Uploader** — novices promoted after review. They can upload posts and take part in the wiki-edit workflow.
- **Moderator** — handles reports, edit suggestions, and storage cleanup from `/admin`.
- **Admin** — additionally manages roles manually.

## How promotion works

Eligible novices appear in the promotion queue that moderators review in `/admin`. Promotions draw on the points system, so everyday useful activity — voting, commenting, uploading — is what moves an account forward.

## Points

Points live in an append-only ledger with per-action caps. They are a signal used for decisions like uploader promotion, not a leaderboard: discovery views rank by votes and activity, never by points.

## Account security

Accounts support email/password (12 characters minimum, approved email providers), GitHub and Google sign-in, passkeys, and two-factor authentication with recovery codes. You can change your username, rotate your password, and delete your account with anonymization — public content stays attributed to “Deleted user”.
