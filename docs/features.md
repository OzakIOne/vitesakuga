# Features — ViteSakuga

Inventaire des fonctionnalités de ViteSakuga (clone de Sakugabooru). Basé sur le code au 2026-09-02.

## Sommaire

- [Pages publiques & navigation](#pages-publiques--navigation)
- [Upload & création de contenu](#upload--création-de-contenu)
- [Interaction communautaire](#interaction-communautaire)
- [Authentification & comptes](#authentification--comptes)
- [Espace admin / staff](#espace-admin--staff)
- [API (server functions)](#api-server-functions)
- [Tests & couverture](#tests--couverture)
- [Infrastructure & configuration](#infrastructure--configuration)

---

## Pages publiques & navigation

| Fonctionnalité            | Description                                                                                                                                           | Fichiers clés                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Accueil**               | Recherche globale + tags populaires                                                                                                                   | `src/routes/index.tsx`, `src/components/SearchBox.tsx`, `src/components/PopularTagsSection.tsx`                                                                        |
| **Fil de posts**          | Grille virtuelle avec scroll infini bidirectionnel, tri, filtres (date, tags), recherche plein-texte, pagination synchronisée à l'URL (SSR data-only) | `src/routes/posts/index.tsx`, `src/components/VirtualPostsGrid.tsx`, `src/components/PostFilters.tsx`, `src/components/Pagination.tsx`, `src/lib/posts/posts.hooks.ts` |
| **Page de tag**           | Tous les posts d'un tag                                                                                                                               | `src/routes/posts/tags/$tag.tsx`                                                                                                                                       |
| **Détail d'un post**      | Lecteur vidéo/image, métadonnées (saison/épisode, méta technique), post lié, tags, votes, commentaires, édition propriétaire, signalement             | `src/routes/posts/$postId.tsx`, `src/components/PostDetail/PostDetailDisplay.tsx`, `src/components/VideoMetadataDialog.tsx`                                            |
| **Annuaire utilisateurs** | Liste des utilisateurs (TanStack DB, `useLiveSuspenseQuery`)                                                                                          | `src/routes/users.index.tsx`, `src/lib/db/collections.ts`                                                                                                              |
| **Profil utilisateur**    | Posts de l'utilisateur + playlists publiques                                                                                                          | `src/routes/users.$id.tsx`, `src/routes/users.$id.playlists.*.tsx`                                                                                                     |
| **Playlists publiques**   | Liste paginée des playlists publiques                                                                                                                 | `src/routes/playlists.index.tsx`, `src/lib/playlists/playlists.service.ts`                                                                                             |
| **Raccourcis clavier**    | `?` (aide), `Mod+K` (recherche), séquences `G P` / `G U` / `G S`                                                                                      | `src/components/GlobalShortcuts.tsx`, `src/components/KeyboardShortcutsDialog.tsx`                                                                                     |
| **Thème clair/sombre**    | Color mode menu (Ark UI)                                                                                                                              | `src/routes/__root.tsx`, `src/components/ui/color-mode.tsx`                                                                                                            |

## Upload & création de contenu

### Upload de post (`/upload`, auth requis)

- Deux types de post : **vidéo** (mp4/mov/mkv, max 200 Mo) ou **image** (jpg/png/webp, 10 Mo, jusqu'à 5 images/post).
- Génération locale de vignettes (capture de frame), sélection de thumbnail, métadonnées via mediainfo.js.
- Métadonnées : titre, description, URL source, saison/épisode (vidéo) ou volume/chapitre (image), tags (noms réservés `image`/`video` interdits), post lié.
- Brouillon persisté (`useUploadDraft`).
- Stockage : présignature S3 → PUT direct vers **Cloudflare R2** (prod) ou **RustFS** (local), namespace `videos/_pending/{userId}/`, confirmation serveur avec validation taille + content-type.
  - Fichiers : `src/routes/upload.tsx`, `src/routes/upload.lazy.tsx`, `src/lib/upload/*`, `src/lib/storage/keys.ts`, `src/lib/upload/upload-policy.ts`, `src/lib/posts/posts.service.ts`

### Convertisseur vidéo navigateur (`/convert`)

- Conversion vidéo/audio 100 % client (WebCodecs/Mediabunny), sans serveur.
- Formats de sortie : MP4 H.264/AAC, WebM VP9/Opus, passthrough MP4/WebM/MKV.
- Qualité CRF, progression, téléchargement.
- Machine à états XState : `src/routes/-convert.machine.ts`, routes `src/routes/convert.tsx` / `convert.lazy.tsx`.

## Interaction communautaire

- **Votes** : up/down sur les posts, un vote par utilisateur ; playlist virtuelle « Liked posts » dérivée des likes — `src/lib/votes/*`
- **Commentaires** : ajout/édition/suppression (propriétaire ou staff), sanitization serveur, **mentions @pseudo** avec autocomplétion (recherche par pseudo ou nom d'affichage) — `src/lib/comments/comments.service.ts`, `src/lib/sanitize.ts`, `src/components/Comments.tsx`, `src/components/mentions/*`, `src/lib/mentions/*`
- **Playlists** : CRUD, publique/privée, ajout/retrait (unitaire + en masse), réordonnancement — `src/routes/account_.playlists.*.tsx`, `src/lib/playlists/playlists.service.ts`, `src/components/PlaylistAddModal.tsx`, `src/components/PlaylistPostsTable.tsx`
- **Signalements** : reporter un post avec motif — `src/components/ReportDialog.tsx`, `src/lib/reports/reports.service.ts`
- **Suggestions d'édition « wiki »** : modifications proposées sur le post d'un autre ; appliquées après 2 approbations d'uploaders ou 1 décision staff ; historique conservé — `src/lib/post-edits/post-edits.service.ts`, tables `post_edits` / `post_edit_approvals`
- **Remplacement de vidéo** : le propriétaire (ou staff) remplace la vidéo en conservant id/likes/commentaires ; ancienne clé archivée dans `video_revisions` (rétention 90 j, restaurable par staff) — `src/lib/videos/videos.service.ts`
- **Système de points** : registre append-only `points_ledger` — `post-upload` (25 pts, cap 3/j), `post-like-received` (5 pts, cap 50/j), `comment-written` (2 pts, cap 10/j), `edit-suggestion-approved` (10 pts, cap 5/j) ; anti-farm par index unique (user, action, ref, actor) — `src/lib/points/points.config.ts`, `points.service.ts`
- **Notifications in-app** : inbox `/notifications`, badge non-lus, « Mark all read » ; types : promotion approuvée/rejetée, suggestion d'édition appliquée, **mention dans un commentaire** (lien direct vers le post) — `src/routes/notifications.tsx`, `src/lib/notifications/notifications.service.ts`

### Mentions @pseudo

- Chaque compte a un **pseudo unique** (`user.username`, lowercase `[a-z0-9_]`, 3–30) : généré automatiquement à l'inscription (couvre aussi OAuth), modifiable sur `/account` — plugin `username` Better Auth, `src/lib/auth/index.ts`, `username.server.ts`
- Dans un commentaire, `@` ouvre une autocomplétion (↑/↓/Entrée/Échap, ARIA combobox) sur les utilisateurs actifs ; le contenu stocké est canonisé en **tokens id** `[@handle](user:userId)` — renames de pseudo jamais cassent les anciennes mentions, le rendu affiche toujours le pseudo courant
- Les nouvelles mentions écrivent `comment_mentions` (commentId, userId) + notif best-effort (jamais d'échec du commentaire) ; l'édition ne notifie que les nouveaux mentionnés ; auto-mention et comptes supprimés exclus
- Rendu : tokens résolus en liens profil depuis le join `comment_mentions × user` — `src/components/mentions/CommentContent.tsx`, `MentionTextarea.tsx`, `src/lib/mentions/mentions.ts`

## Authentification & comptes

Better Auth monté sur `/api/auth/*` (`src/lib/auth/index.ts`, `src/routes/api/auth/$.ts`) :

- **Email/mot de passe** avec politique de force serveur (`src/lib/auth/password-policy.ts`)
- **OAuth social** : GitHub et Google (actifs si credentials présents)
- **Passkeys (WebAuthn)** : `src/components/PasskeySignInButton.tsx`, `src/components/PasskeysSection.tsx`
- **2FA TOTP** : activation dans le compte, page `/two-factor` (code TOTP ou code de secours, option « trust device ») — `src/components/TwoFactorSection.tsx`, `src/routes/two-factor.tsx`, `src/lib/auth/two-factor.hooks.ts`
- **Captcha Cloudflare Turnstile** sur login/signup si activé par env (`src/lib/auth/useTurnstile.ts`)
- **Rate limiting** en base avec règles renforcées sur `/sign-in/email` et `/sign-up/email`
- **Compte** (`/account`) : profil (nom, **pseudo**, avatar), changement de mot de passe, suppression avec anonymisation (contenu conservé, attribué à « Deleted user ») — `src/lib/auth/delete-account.ts`, `account-security.ts`
- **Rôles & permissions** : hiérarchie `novice → uploader → moderator → admin`, permissions (`posts:create`, `posts:suggest-edit`, `posts:edit-any`, `posts:delete-any`, `videos:replace-own/any`, `edits:approve`, `promotions:review`…) appliquées via policies Effect (`withPolicy`, `requireRole`, `requirePermission`) — `src/lib/auth/roles.ts`, `policy.ts`, `ownership.ts`

## Espace admin / staff

`/admin` réservé moderator+ (gate en `beforeLoad`, shell à onglets) — `src/routes/admin.tsx`, `/admin/` redirige vers promotions.

| Onglet           | Rôle                                                                                              | Fichiers                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Promotions**   | File de novices éligibles (≥ 300 pts + compte ≥ 7 j) : approuver (→ uploader, notifie) ou rejeter | `src/routes/admin.promotions.tsx`, `src/components/admin/PromotionQueuePanel.tsx`, `src/lib/promotions/*`           |
| **Reports**      | File des signalements récents                                                                     | `src/routes/admin.reports.tsx`, `src/components/admin/ReportsPanel.tsx`, `src/lib/moderation/moderation.service.ts` |
| **Suggestions**  | Suggestions d'édition en attente, décision staff                                                  | `src/routes/admin.suggestions.tsx`, `src/components/admin/SuggestionsPanel.tsx`, `src/lib/post-edits/*`             |
| **Storage (GC)** | Dry-run des révisions vidéo expirées (90 j) et objets orphelins du bucket, puis purge explicite   | `src/routes/admin.storage.tsx`, `src/components/admin/StorageGcPanel.tsx`, `src/lib/videos/videos.service.ts`       |
| **Roles**        | Attribution manuelle de rang (novice/uploader/moderator/admin)                                    | `src/routes/admin.roles.tsx`, `src/components/admin/RolesPanel.tsx`, `src/lib/moderation/moderation.service.ts`     |

## API (server functions)

Aucune route REST hors `/api/auth/$` (Better Auth). Tout passe par des server functions TanStack Start (handler Effect : `src/lib/server-fn.handler.ts`) :

- **Posts** (`posts.service.ts`) : `searchPosts`, `fetchPostDetail`, `uploadPost`, `createVideoUploadUrl`, `updatePost`
- **Videos** (`videos.service.ts`) : `replaceVideo`, `fetchVideoRevisions`, `restoreVideoRevision`, `previewGc`, `runGc`
- **Comments** : `fetchComments`, `addComment`, `updateComment`, `deleteComment`
- **Votes** : `fetchPostVotes`, `setPostVote`, `removePostVote`, `fetchLikedPosts`
- **Playlists** : `createPlaylist`, `updatePlaylist`, `deletePlaylist`, `addPostToPlaylist`, `removePostFromPlaylist`, `bulkAddPostsToPlaylist`, `bulkRemovePostsFromPlaylist`, `reorderPlaylistPosts`, `fetchUserPlaylists`, `fetchPublicPlaylists`, `fetchPlaylistDetail`, `fetchPlaylistsForPost`
- **Tags / Users** : `getAllTags`, `getAllPopularTags`, `fetchUsers`, `fetchUserPosts`, `fetchMentionableUsers`
- **Reports / Post-edits** : `submitPostReport`, `proposeEdit`, `approveEdit`, `rejectEdit`, `fetchPostEdits`
- **Promotions / Modération** : `fetchPromotionQueue`, `approvePromotion`, `rejectPromotion`, `fetchModerationOverview`, `assignUserRole`
- **Notifications** : `fetchNotifications`, `markAllNotificationsRead`
- **Auth** : `getUserSession`, `getAccountSecurity`, `deleteAccount`

## Tests & couverture

État au 2026-09-03. Tests unitaires dans `src/**/*.test.{ts,tsx}` (vitest), e2e dans `e2e/*.spec.ts` (Playwright, stack locale Postgres + RustFS).

### Unitaires + e2e

| Feature                         | Unitaires                                                                                      | e2e                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------ |
| Upload de post                  | `file-validation`, `upload-policy`, `upload.processor`, `useUploadForm`, `posts.fn`, `storage` | `upload.spec.ts`         |
| Convertisseur vidéo             | `-convert.machine`                                                                             | `convert.spec.ts`        |
| Commentaires                    | `comments.fn`, `comments.hooks`, `sanitize`                                                    | `comments.spec.ts`       |
| Mentions @pseudo                | `mentions`                                                                                     | `mentions.spec.ts`       |
| Playlists UI                    | `playlists.fn`                                                                                 | `playlists.spec.ts`      |
| Votes                           | `votes.fn`, `votes.hooks`                                                                      | `votes.spec.ts`          |
| Compte / sécurité / suppression | `account-security`, `delete-account.fn`, `auth.hooks`                                          | `delete-account.spec.ts` |
| Auth de base                    | `auth.config`, `auth.middleware`, `auth.schemas`, `password-policy`, `policy`                  | `auth.spec.ts`           |
| Passkeys                        | `passkey.hooks`                                                                                | `passkey.spec.ts`        |
| 2FA TOTP                        | `two-factor.hooks`, `TwoFactorSection`                                                         | `two-factor.spec.ts`     |

### Unitaires seulement

| Feature                               | Unitaires                                          |
| ------------------------------------- | -------------------------------------------------- |
| Fil de posts / recherche / pagination | `posts.infinite`, `search-pattern`, `posts.schema` |
| Tags                                  | `tags.fn`                                          |
| Annuaire / profil utilisateurs        | `users.fn`                                         |
| Suggestions d'édition wiki            | `post-edits.service`                               |
| Remplacement vidéo + Storage GC       | `videos.service`                                   |
| Système de points                     | `points.service`                                   |
| Promotions admin                      | `promotions.service`                               |
| Rate limiting                         | `rate-limiter`                                     |
| Stockage                              | `storage`, `content-type`                          |

### Sans test

- Signalements (`reports.service.ts`)
- Notifications in-app (partiellement couvertes via `mentions.spec.ts` pour la notif de mention)
- Onglets admin Reports et Roles (`moderation.service.ts`)
- Raccourcis clavier (`GlobalShortcuts`)
- Pages publiques en tant que telles (accueil, page de tag, détail de post) — couvertes seulement indirectement via les tests des services sous-jacents ; **aucun smoke test e2e du parcours feed → détail**

### Priorités e2e restantes

1. **Smoke test de lecture** : feed (filtres + sync URL) → détail de post (tags, votes, commentaires visibles) — chemin de tous les visiteurs, zéro couverture e2e.

_(Playlists UI (ajout en masse + réordonnancement drag & drop, souris et clavier), votes et suppression de compte avec anonymisation : couverts par `playlists.spec.ts`, `votes.spec.ts` et `delete-account.spec.ts`.)_

## Infrastructure & configuration

- **Stockage** : abstraction Effect `StorageModule` (`src/lib/storage/storage.module.ts`, `storage.adapter.ts`) — S3-compatible : Cloudflare R2 (prod), RustFS (local Docker) ; présignatures `@aws-sdk/s3-request-presigner` ; cycle staging `videos/_pending/` → clé finale
- **Base de données** : Postgres (Neon en prod, dialect transaction Neon), PGlite possible en local — `src/lib/db/kysely.ts`, `pool.ts`, `src/db/drizzle/`
- **Environnements** : stages dev/test(local)/prod (`.env`, `.env.test`, `.env.production`), validation Effect Config (`src/lib/env/defs.ts`) ; secrets Redacted
- **Observabilité** : tracing OpenTelemetry (`src/lib/effect/tracing.ts`), liens devtools Otelite/SigNoz dans le header
- **UI** : Ark UI v5 (`src/components/ui/*`), TanStack Devtools, `@tanstack/react-hotkeys`, Pacer

## Schéma de base de données (Drizzle/Postgres)

`src/lib/db/schema/auth.schema.ts` : `user` (role, **username** unique, twoFactorEnabled, deletedAt), `session`, `account`, `verification`, `passkey`, `twoFactor`, `rateLimit`

`src/lib/db/schema/sakuga.schema.ts` : `tags`, `post_tags`, `posts`, `post_images`, `post_votes`, `post_reports`, `playlists`, `playlist_posts`, `comments`, `comment_mentions`, `points_ledger`, `promotion_reviews`, `notifications`, `post_edits`, `post_edit_approvals`, `video_revisions`
