# Contrat d’intégration T2 — `t2-lifecycle-opid-cas-v1`

## Décision et invariants

Le registre durable protège les crashes; il complète, ne remplace pas, T1. Aucune transaction DB ne doit entourer un appel R2. Toute opération qui écrit, adopte ou supprime un objet géré passe par le registre.

1. Après authentification/autorisation, calculer une empreinte canonique de la demande: type, champs validés dans un ordre stable, identité utilisateur dérivée du serveur, version attendue et empreintes média. Ne jamais persister le payload brut. Les images et thumbnails sont lus/hachés en SHA-256 côté serveur avant le PUT; la vidéo directe porte une empreinte déclarée par le client et liée à sa clé de staging (la voie directe ne peut pas être hachée par le Worker sans rebuffériser).
2. Une transaction courte `claimOperation` insère `(userId, operationKey, requestFingerprint)` avec contrainte unique `(userId, operationKey)`, ou relit la ligne existante. Même utilisateur + même clé + empreinte différente = conflit; autre utilisateur ne doit pas révéler la ligne. Pour une ligne existante, retourner d’abord le résultat terminal ou l’état en cours, avant de juger `expectedVersion` obsolète. Une reprise non terminale reçoit un `fence` monotone; elle ne remet jamais une opération en `preparing` sans ce fence.
3. Réserver avant tout I/O les identités et clés déterministes des objets. Une clé réutilisée doit accepter uniquement le même corps/empreinte; jamais de nouvelle clé aléatoire lors d’un retry. L’écriture/copie se fait hors transaction. Une issue inconnue n’autorise ni compensation destructive ni retry métier aveugle.
4. États minimum des objets: `reserved` → `preparing` → `ready`; suppression durable `ready` → `deleting` (commit confirmé avant DELETE R2) → `deleted` (tombstone permanent). `deleting` et `deleted` refusent adoption/restauration; une clé tombstonée n’est jamais réutilisable. Une issue inconnue reste non adoptable jusqu’au reconcile. La transaction finale marque `ready`, persiste les références et termine l’opération; chaque transition vérifie `(operationId, fence)`.
5. Le reconcile admin parcourt les opérations/objets non terminaux: relecture de la même clé et empreinte, reprise idempotente de l’action, ou maintien quarantainé si l’issue reste inconnue; pour `deleting`, seulement retrait/reconfirmation. C’est une vraie fonction serveur exécutable manuellement, pas une queue, un scheduler, une lease seule ou une nouvelle infrastructure.

## Schéma et API à geler

Ajouter sans réécrire le baseline Drizzle:

- `posts.version integer NOT NULL DEFAULT 0`; toute mutation du post réussie l’incrémente.
- `media_operations`: `id`, `userId`, `operationKey`, `kind`, `requestFingerprint`, `status`, `fence`, `result` JSON limité à des identifiants/états utiles, `failureCode` non sensible, `createdAt`, `updatedAt`, `completedAt`; unique `(userId, operationKey)` et index des statuts non terminaux.
- `media_objects`: `key` unique, `operationId`, `userId`, `kind` (`video|image|thumbnail`), `fingerprint`, `contentType`, `contentLength`, `state`, `fence`, `createdAt`, `updatedAt`, `deletingCommittedAt`; aucune suppression en cascade qui détruirait les tombstones. La clé reste l’identité de l’objet, non le seul identifiant d’opération.
- `post_edits.basePostVersion` (capturée à la proposition), afin qu’une approbation ne puisse pas appliquer un patch sur un post modifié entre-temps.

Port applicatif nouveau (noms à adapter, pas des symboles existants): `claimOperation`, `reserveObject`, `markPreparing`, `markReady`, `beginDelete`, `completeDelete`, `finishOperation`, `reconcileNonTerminal`. Il expose des unions sémantiques (`committed`, `not-committed`, `unknown`, `conflict`) et ne dépend d’aucun nom de classe T1 non gelé.

Contrats appelants: `uploadPost` reçoit `operationKey`; `createVideoUploadUrl` reçoit la même clé et l’empreinte vidéo et renvoie la clé réservée; `updatePost`, `replace`, `restore` reçoivent `operationKey + expectedVersion`; `approveEdit` utilise `basePostVersion` et doit renvoyer un conflit rechargeable. Le résultat terminal d’une confirmation est rejouable tel quel. Les conflits sont des erreurs sérialisables connues avec `postId`, `expectedVersion`, `actualVersion` (sans payload).

CAS doit couvrir `PostsService.update`, remplacement/restauration vidéo et application de suggestion; pas seulement l’endpoint d’édition directe. La création de post n’a pas de version existante mais reste protégée par l’opération idempotente. Le client conserve la clé lors d’un résultat réseau incertain; nouvelle intention ou nouveau payload = nouvelle clé.

## Répartition sans collision

1. **Agent A — schéma/lifecycle/storage/tests, sans appelants:** `src/lib/db/schema/sakuga.schema.ts`, `sakuga.utils.ts`, `src/lib/db/kysely.ts`, nouveau `src/lib/lifecycle/*`, `src/lib/storage/storage.module.ts`, `storage.adapter.ts`, `keys.ts`, `upload-policy.ts`, tests storage/lifecycle, `src/lib/db/test-utils.ts`, migration générée sous `drizzle/`. Tester PGlite réel + RustFS isolé et fault injection déterministe.
2. **Agent B — clients après gel des ports:** `posts.schema.ts`, `posts.queries.ts`, `useUploadDraft.ts`, `useUploadForm.ts` (empreintes et clé persistée), `PostDetailDisplay.tsx`, `PostEditSuggestionDialog.tsx`, `post-edits.hooks.ts`, `moderation.hooks.ts`, `StorageGcPanel.tsx`. Afficher conflit/rechargement; ne jamais générer une nouvelle clé sur retry incertain.
3. **Intégrateur séquentiel:** `posts.service.ts`, puis `videos.service.ts`, puis `post-edits.service.ts`; vérifier `delete-account.ts` sans effacer les tombstones ni laisser une session supprimée autoriser une reprise. Les mutations post doivent toutes passer par le même CAS.

Synchroniser ensuite `docs/features.md`, `CONTEXT.md`, `docs/database-conventions.md`, `docs/server-functions-api.md` et `docs/testing.md`. Ne pas modifier `infra/`, ajouter cron/scheduler ou dépendre du lifecycle R2 de 48 h pour la garantie durable.

## Acceptation et état

A doit prouver deux claims concurrents même clé (un seul owner/fence), retry terminal sans doublon, clé différente avec même contenu, conflit de payload, isolation utilisateur, crash entre chaque transition, DELETE/COPY tardif neutralisé par tombstone, CAS concurrent et absence de transaction réseau. B doit prouver la persistance de clé et le conflit UI. L’intégrateur doit tester les vraies server functions, PostgreSQL local concurrent et RustFS; PGlite seul ne suffit pas.

Vérifié ici: plan/revue T2, AGENTS et conventions/docs, schémas/services/storage/hooks/form/admin/auth; `package.json` fixe Effect `4.0.0-rc.112`; sonde `nub --no-env-file --input-type=module -e` a confirmé `Context.Service`, `Schema.TaggedError`, `Effect.tryPromise`, `Effect.acquireRelease`. Suites lourdes non lancées conformément au scope. Le seul prérequis d’intégration restant est le résultat T1 sur les issues transactionnelles et l’API de phase conservatrice.
