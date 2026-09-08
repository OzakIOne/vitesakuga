# Features — ViteSakuga

Inventaire des fonctionnalités visibles de ViteSakuga (clone de Sakugabooru), vérifié contre le code au **2026-09-06**.

## Sommaire

- [Pages publiques & navigation](#pages-publiques--navigation)
- [Upload & création de contenu](#upload--création-de-contenu)
- [Interaction communautaire](#interaction-communautaire)
- [Authentification & comptes](#authentification--comptes)
- [Espace admin / staff](#espace-admin--staff)
- [API (server functions)](#api-server-functions)
- [Tests](#tests)
- [Infrastructure & configuration](#infrastructure--configuration)
- [Schéma de base de données](#schéma-de-base-de-données)

---

## Pages publiques & navigation

### Actualités du produit

Le fil public `/news` présente les annonces de ViteSakuga de la plus récente à la plus ancienne. Chaque article possède sa page `/news/<slug>`, un titre, un résumé, une date et un corps Markdown. Liens depuis l’accueil, la navigation desktop et le menu mobile. Les articles sont conservés dans `src/content/news/`, enregistrés dans `src/lib/news/news.ts` et publiés avec les déploiements ; pas d’éditeur admin ni de base de données. Voir [Publication des actualités](./news.md).

| Fonctionnalité              | Description                                                                                                                                                            | Fichiers clés                                                                                                                                                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Accueil**                 | Recherche globale et tags populaires                                                                                                                                   | `src/routes/index.tsx`, `src/components/SearchBox.tsx`, `src/components/PopularTagsSection.tsx`                                                                        |
| **Fil de posts**            | Grille virtualisée avec scroll infini bidirectionnel, tri, filtres de date, tags, recherche plein texte et filtres numériques avancés, pagination synchronisée à l'URL | `src/routes/posts/index.tsx`, `src/components/VirtualPostsGrid.tsx`, `src/components/PostFilters.tsx`, `src/components/Pagination.tsx`, `src/lib/posts/posts.hooks.ts` |
| **Recherches sauvegardées** | Les membres connectés peuvent nommer la recherche courante (texte, tags, tri et période), la réappliquer depuis le champ de recherche ou la supprimer                  | `src/components/SavedSearchDialogs.tsx`, `src/lib/saved-searches/*`, migration `drizzle/20260907194313_curious_wild_pack/migration.sql`                                |
| **Page de tag**             | Posts d'un tag avec les filtres du feed                                                                                                                                | `src/routes/posts/tags/$tag.tsx`                                                                                                                                       |
| **Détail d'un post**        | Lecteur vidéo ou galerie d'images, métadonnées, post lié, tags, votes, commentaires, édition propriétaire et signalement                                               | `src/routes/posts/$postId.tsx`, `src/components/PostDetail/PostDetailDisplay.tsx`, `src/components/VideoMetadataDialog.tsx`                                            |
| **Annuaire utilisateurs**   | Liste réactive des utilisateurs via TanStack DB                                                                                                                        | `src/routes/users.index.tsx`, `src/lib/db/collections.ts`                                                                                                              |
| **Profil utilisateur**      | Posts de l'utilisateur et playlists publiques                                                                                                                          | `src/routes/users.$id.tsx`, `src/routes/users.$id.playlists.*.tsx`                                                                                                     |
| **Playlists publiques**     | Liste paginée et détail des playlists publiques                                                                                                                        | `src/routes/playlists.index.tsx`, `src/routes/users.$id.playlists.*.tsx`, `src/lib/playlists/playlists.service.ts`                                                     |
| **Playlists du compte**     | Playlists personnelles, playlist privée des posts aimés, ajout/retrait unitaire ou en masse, et réordonnancement                                                       | `src/routes/account_.playlists.*.tsx`, `src/lib/playlists/playlists.service.ts`                                                                                        |
| **Notifications**           | Inbox personnelle avec badge non lus et marquage global comme lu                                                                                                       | `src/routes/notifications.tsx`, `src/lib/notifications/notifications.hooks.ts`                                                                                         |
| **Raccourcis clavier**      | `?` (aide), `Mod+K` (recherche), séquences `G P` / `G U` / `G S`, navigation vidéo image par image                                                                     | `src/components/GlobalShortcuts.tsx`, `src/components/KeyboardShortcutsDialog.tsx`                                                                                     |
| **Thème clair/sombre**      | Sélecteur de mode de couleur                                                                                                                                           | `src/routes/__root.tsx`, `src/components/ui/color-mode.tsx`                                                                                                            |

### Recherche avancée des posts

La recherche accepte des qualificatifs numériques de style Sakugabooru et l'exclusion de tags dans le champ de recherche. Les opérateurs autorisés sont strictement `>`, `<` et `=` ; `>=` et `<=` ne sont pas supportés.

| Qualificatif                   | Cible                                           | Exemple                   |
| ------------------------------ | ----------------------------------------------- | ------------------------- |
| `width` / `height`             | Dimensions des images attachées, en pixels      | `width:>1000 height:<800` |
| `likes` / `score`              | Nombre de votes positifs (`score` est un alias) | `likes:>10`               |
| `video_width` / `video_height` | Dimensions de la piste vidéo, en pixels         | `video_width:=1920`       |
| `-tag`                         | Exclut les posts portant le tag indiqué         | `-movies`                 |

Les qualificatifs peuvent être combinés avec du texte libre (`action width:>1000`) et entre eux. Un token `-tag` exclut tout post qui possède ce tag (`action -movies`). Ils sont extraits côté serveur puis traduits en prédicats SQL avant le comptage et la pagination. Les dimensions d'image sont capturées au moment de l'upload et stockées dans `post_images`; les anciens posts sans dimensions ne correspondent pas aux filtres `width`/`height`.

Fichiers principaux : `src/lib/posts/search-filters.ts`, `src/lib/posts/posts.service.ts`, `src/components/SearchBox.tsx`, `src/lib/upload/useUploadForm.ts`, migration `drizzle/20260906190600_brown_caretaker/migration.sql`.

## Upload & création de contenu

### Upload de post (`/upload`, authentification requise)

- Deux types de post : **vidéo** (mp4/avi/mov/wmv/flv/mkv, max 200 MiB) ou **image** (jpg/jpeg/png/webp, max 10 MiB, une image par post dans l'interface actuelle). Le schéma serveur accepte jusqu'à 5 images, mais cette capacité n'est pas exposée par l'UI actuelle.
- Génération locale de vignettes vidéo, sélection de thumbnail et métadonnées via mediainfo.js. Les images enregistrent leurs dimensions et utilisent la première image comme thumbnail.
- Métadonnées : titre, description, URL source, saison/épisode (vidéo) ou volume/chapitre (image), type de source, tags, post lié.
- Brouillon persistant côté client (`useUploadDraft`).
- Vidéos : URL présignée S3 → PUT direct vers Cloudflare R2 (prod) ou RustFS (local), namespace `videos/_pending/{userId}/`, puis validation et promotion côté serveur.
- Images et thumbnails transitent par le serveur et sont validées par extension, taille et type de contenu.
- Fichiers : `src/routes/upload.lazy.tsx`, `src/lib/upload/*`, `src/lib/storage/*`, `src/lib/posts/posts.schema.ts`, `src/lib/posts/posts.service.ts`.

### Convertisseur vidéo navigateur (`/convert`)

- Conversion vidéo/audio 100 % client avec WebCodecs/Mediabunny.
- Sorties MP4 H.264/AAC, WebM VP9/Opus, et passthrough MP4/WebM/MKV.
- Qualité CRF, progression et téléchargement.
- Machine à états XState : `src/routes/-convert.machine.ts`, `src/routes/convert.tsx`, `src/routes/convert.lazy.tsx`.

## Interaction communautaire

- **Votes** : like/dislike sur les posts, un vote par utilisateur ; playlist « Liked posts » dérivée des likes — `src/lib/votes/*`, `src/routes/account_.playlists.liked.tsx`.
- **Commentaires** : ajout/édition/suppression (propriétaire ou staff), sanitization serveur et mentions `@pseudo` avec autocomplétion — `src/lib/comments/*`, `src/lib/mentions/*`, `src/lib/sanitize.server.ts`.
- **Playlists** : CRUD, visibilité publique/privée, ajout/retrait unitaire et en masse, réordonnancement souris/clavier — `src/lib/playlists/*`, `src/components/PlaylistPostsTable.tsx`.
- **Recherches sauvegardées** : snapshots privés des paramètres de recherche pour les utilisateurs connectés ; application et suppression depuis le champ de recherche — `src/lib/saved-searches/*`, `src/components/SavedSearchDialogs.tsx`.
- **Signalements** : signaler un post avec un motif — `src/components/ReportDialog.tsx`, `src/lib/reports/*`.
- **Suggestions d'édition « wiki »** : workflow serveur pour proposer des modifications sur le post d'un autre, avec approbations uploaders ou décision staff et historique. La proposition n'a pas encore de formulaire public dédié — `src/lib/post-edits/*`, `src/lib/moderation/*`.
- **Remplacement de vidéo** : workflow serveur pour remplacer la vidéo en conservant l'identité du post ; révisions conservées 90 jours et restaurables par le staff. Aucun écran public dédié n'est actuellement exposé — `src/lib/videos/*`.
- **Système de points** : registre append-only `points_ledger` avec caps par action ; utilisé notamment pour la promotion des uploaders — `src/lib/points/*`, `src/lib/promotions/*`.
- **Notifications in-app** : promotion, suggestion d'édition, mentions de commentaires et autres événements métier — `src/lib/notifications/*`, `src/routes/notifications.tsx`.

### Mentions @pseudo

- Chaque compte possède un pseudo unique (`user.username`), généré à l'inscription et modifiable sur `/account`.
- Dans un commentaire, `@` ouvre une autocomplétion clavier accessible. Le contenu est stocké avec des tokens liés à l'identifiant utilisateur, donc un changement de pseudo ne casse pas les anciennes mentions.
- Les nouvelles mentions créent `comment_mentions` et une notification best-effort ; les comptes supprimés et l'auto-mention sont exclus.
- Rendu : `src/components/mentions/CommentContent.tsx`, `src/components/mentions/MentionTextarea.tsx`, `src/lib/mentions/mentions.ts`.

## Authentification & comptes

Better Auth est monté sur `/api/auth/*` (`src/lib/auth/index.ts`, `src/routes/api/auth/$.ts`) :

- **Email/mot de passe** avec longueur minimale de 12 caractères et contrôle de diversité côté serveur.
- **Inscription protégée** : les nouvelles adresses doivent appartenir à la liste de fournisseurs approuvés (Gmail, Outlook, Yahoo, Apple/Private Relay, Proton, etc.) ; la création d’un compte est suspendue jusqu’à la saisie d’un code envoyé par email.
- **OAuth social** GitHub et Google, activé uniquement quand les credentials sont configurés.
- **Passkeys (WebAuthn)** — `src/components/PasskeySignInButton.tsx`, `src/components/PasskeysSection.tsx`.
- **2FA TOTP** avec codes de secours et option de confiance d'appareil — `src/components/TwoFactorSection.tsx`, `src/routes/two-factor.tsx`.
- **Captcha Cloudflare Turnstile** en production lorsqu'il est provisionné.
- **Codes email** via Better Auth Email OTP, avec stockage haché, expiration de 10 minutes et cinq tentatives maximum. L’envoi utilise Cloudflare Email Service ; `CLOUDFLARE_EMAIL_API_TOKEN` et `EMAIL_FROM` doivent être provisionnés avant l’activation sur un déploiement.
- **Rate limiting** en base Better Auth, avec règles renforcées sur les endpoints d'authentification.
- **Compte** (`/account`) : profil, pseudo, changement de mot de passe et suppression avec anonymisation ; le contenu public reste attribué à « Deleted user ».
- **Rôles et permissions** : `novice → uploader → moderator → admin`, appliqués par les policies Effect — `src/lib/auth/roles.ts`, `src/lib/auth/policy.ts`, `src/lib/auth/ownership.ts`.

## Espace admin / staff

`/admin` est réservé aux rôles moderator+ (`src/routes/admin.tsx`). Onglets disponibles :

| Onglet           | Rôle                                                                         | Fichiers                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Promotions**   | File de novices éligibles ; approuver ou rejeter                             | `src/routes/admin.promotions.tsx`, `src/components/admin/PromotionQueuePanel.tsx`, `src/lib/promotions/*` |
| **Reports**      | File des signalements récents                                                | `src/routes/admin.reports.tsx`, `src/components/admin/ReportsPanel.tsx`, `src/lib/moderation/*`           |
| **Suggestions**  | Suggestions d'édition en attente, décision staff                             | `src/routes/admin.suggestions.tsx`, `src/components/admin/SuggestionsPanel.tsx`, `src/lib/post-edits/*`   |
| **Storage (GC)** | Prévisualisation puis purge des révisions vidéo expirées et objets orphelins | `src/routes/admin.storage.tsx`, `src/components/admin/StorageGcPanel.tsx`, `src/lib/videos/*`             |
| **Roles**        | Attribution manuelle des rôles                                               | `src/routes/admin.roles.tsx`, `src/components/admin/RolesPanel.tsx`, `src/lib/moderation/*`               |

## API (server functions)

Il n'y a pas de route REST applicative hors `/api/auth/$`. Les opérations passent par des server functions TanStack Start et le bridge Effect `src/lib/server-fn.handler.ts` :

- **Posts** : recherche, détail, upload, URL vidéo présignée, mise à jour — `src/lib/posts/posts.service.ts`
- **Recherches sauvegardées** : sauvegarder, lister et supprimer les recherches personnelles — `src/lib/saved-searches/saved-searches.service.ts`
- **Videos** : remplacement, révisions, restauration, aperçu GC, GC — `src/lib/videos/videos.service.ts`
- **Comments** : fetch, ajout, édition, suppression — `src/lib/comments/comments.service.ts`
- **Votes** : fetch, set/remove, posts aimés — `src/lib/votes/votes.service.ts`
- **Playlists** : CRUD, ajout/retrait unitaire et en masse, détail, liste publique, réordonnancement — `src/lib/playlists/playlists.service.ts`
- **Tags / Users** : tags, utilisateurs, posts d'un utilisateur, utilisateurs mentionnables — `src/lib/tags/*`, `src/lib/users/*`
- **Reports / Post-edits** : signaler, proposer, approuver, rejeter, lister les suggestions — `src/lib/reports/*`, `src/lib/post-edits/*`
- **Promotions / Modération** : file de promotion, décisions, aperçu modération, attribution de rôle — `src/lib/promotions/*`, `src/lib/moderation/*`
- **Notifications** : lister et marquer comme lu — `src/lib/notifications/notifications.service.ts`
- **Auth** : session, sécurité du compte, suppression — `src/lib/auth/*`

## Tests

État vérifié le **2026-09-07**.

- **Vitest** : `nub exec vitest run --maxWorkers=1` — **580/580 tests passés dans 55 fichiers**, dont 54 sous `src/` et `nitro-config.test.ts` à la racine. `nub run test` lance Vitest en mode watch. La configuration limite le parallélisme à quatre workers (`vitest.config.ts`).
- **Playwright** : `nub run test:ee` avec Postgres local + RustFS. L'inventaire actuel contient 14 fichiers `e2e/*.spec.ts` et 50 tests découverts ; leur exécution n'a pas été vérifiée dans cet audit.
- **Couverture e2e** : authentification, upload vidéo, conversion, commentaires, mentions, playlists (ajout/retrait en masse et réordonnancement souris/clavier), votes, suppression de compte credential et passwordless, passkeys, 2FA, hydratation, toasts et raccourcis clavier.
- **Couverture unitaire/service** : recherche et filtres numériques, pagination, posts, tags, utilisateurs, commentaires, mentions, playlists, votes, rapports, notifications, modération, suggestions, révisions vidéo/GC, points, rate limiting, stockage, auth et server-function boundary.
- **Manques e2e principaux** : parcours feed/recherche → détail, pages accueil/tag/utilisateur/playlists publiques, inbox notifications, soumission de signalement, panneaux admin et upload d'image.

## Infrastructure & configuration

- **Stockage** : `StorageModule` + `storage.adapter.ts`, S3-compatible : Cloudflare R2 en déploiement, RustFS en local/tests ; vidéos présignées et staging `videos/_pending/` → clé finale.
- **Base de données** : Postgres (Neon en déploiement, Postgres local pour e2e/dev local) ; PGlite pour les tests de services — `src/lib/db/kysely.ts`, `src/lib/db/pool.ts`, `src/lib/db/e2e-db.ts`.
- **Migrations** : Drizzle Kit et chaîne unique dans `drizzle/` à la racine.
- **Environnements** : stages dev/local/prod (`.env`, `.env.test`, `.env.production`) et validation Effect dans `src/lib/env/defs.ts` ; secrets redacted.
- **Observabilité** : OpenTelemetry (`src/lib/effect/tracing.ts`) et observabilité Cloudflare en déploiement.
- **UI** : Ark UI v5, Tailwind CSS v4, TanStack Devtools, `@tanstack/react-hotkeys` et Pacer.

## Schéma de base de données

`src/lib/db/schema/auth.schema.ts` : `user` (rôle, username unique, twoFactorEnabled, deletedAt), `session`, `account`, `verification`, `passkey`, `twoFactor`, `rateLimit`. Les codes email temporaires sont stockés dans `verification` par Better Auth.

`src/lib/db/schema/sakuga.schema.ts` : `tags`, `post_tags`, `posts`, `post_images`, `post_votes`, `post_reports`, `playlists`, `playlist_posts`, `saved_searches`, `comments`, `comment_mentions`, `points_ledger`, `promotion_reviews`, `notifications`, `post_edits`, `post_edit_approvals`, `video_revisions`.
