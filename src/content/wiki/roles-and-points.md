ViteSakuga uses a role ladder to keep the archive safe without slowing contributors down.

## Roles

Roles progress from `novice → uploader → moderator → admin`. Each role grants an explicit set of permissions in `src/lib/auth/policy.ts`, and every decision checks one of those permissions, never the rank itself. Some permissions are held only by the higher roles, as listed below.

- **Novice** — newly registered accounts. They can browse, vote, comment, build playlists, and upload their own posts. They cannot suggest edits to other people's posts yet.
- **Uploader** — novices promoted after review. They can also suggest edits to other people's posts and take part in the wiki-edit workflow.
- **Moderator** — reviews reports, edit suggestions, and promotion candidates from `/admin`, and suspends or restores ordinary accounts.
- **Admin** — everything a moderator can do, plus storage cleanup (preview and purge) and manual role assignment from `/admin`. Role changes and account deletion cannot leave the site without an active admin: the last active admin cannot be demoted or delete their account until another admin exists. Admins also suspend or restore moderators and admins.

## How promotion works

A novice is eligible once they have at least 300 points, an account at least 7 days old, and no deleted account. Eligible novices appear in the promotion queue that moderators review in `/admin`. Approval checks these rules again, so a candidate who was rejected after the queue loaded cannot be promoted. A rejected candidate returns to the queue only after earning more points than they had when they were rejected. Promotions draw on the points system, so everyday useful activity — voting, commenting, uploading — is what moves an account forward.

## Points

Points live in an append-only ledger with per-action caps. They are a signal used for decisions like uploader promotion, not a leaderboard: discovery views rank by votes and activity, never by points.

## Account security

Accounts support email/password (12 characters minimum, approved email providers), GitHub and Google sign-in, passkeys, and two-factor authentication with recovery codes. You can change your username, rotate your password, and delete your account with anonymization — public content stays attributed to “Deleted user”.

## Account suspension

A moderator or admin can suspend an account with a reason. A suspended account can still read and sign in, but it cannot post, comment, vote, report, suggest edits, manage playlists or review anything until the account is restored. The reason is shown to the account so it can see why. Moderators can suspend and restore ordinary accounts; only admins can act on other moderators and admins. Nobody can suspend their own account, and the last active admin cannot be suspended.
