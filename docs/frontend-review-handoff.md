# Passation — correction de la revue frontend

**Date :** 2026-09-11  
**Dépôt :** `/Users/clementcouriol/dev/vitesakuga`  
**Branche :** `master` (`2` commits devant `origin/master` au moment de la
passation)  
**État :** documentation synchronisée avec la passe terminée ; les changements
de code et de documentation restent non commités

## Objectif du travail

Vérifier les constats de la revue frontend, corriger les problèmes réellement
fonctionnels ou logiques, et conserver une liste explicite des améliorations
restantes plutôt que d'appliquer aveuglément chaque suggestion de design.

Le registre détaillé et son statut sont dans
[`docs/frontend-review.md`](./frontend-review.md).

## Résultat

- **86 constats corrigés**.
- **Constats 5, 13, 49, 50 et 79 résolus** : métadonnées complètes avec
  `noindex` sur les surfaces privées, états vides partagés et adaptés aux
  surfaces imbriquées, confirmations de modération destructive, historique
  avant/après persistant, et SSR du répertoire `/users`.
- **Les cinq travaux optionnels restants sont maintenant traités** : skeletons
  spécialisés, palette partagée, positionnement de l'accueil, tableau de bord
  admin et shell éditorial commun.

### Principaux correctifs

- Recherche : synchronisation immédiate des tags avec l'URL, remplacement de
  l'historique pendant le debounce, navigation explicite lors de la soumission
  et acceptation des paramètres de tracking inconnus.
- Routage : validation canonique des identifiants entiers positifs, vrais écrans
  404 pour les paramètres malformés et conversion des erreurs métier « not
  found » en `notFound()` TanStack Router.
- SSR : réactivation du rendu serveur pour les posts, tags, séries, profils et
  playlists publiques.
- Accessibilité : labels et descriptions de formulaires reliés aux champs,
  hiérarchie de titres, landmarks, restauration du focus, annonce des changements
  de route, groupes de filtres, pagination et listes virtualisées accessibles.
- Navigation et structure : nouvel en-tête responsive, navigation active,
  footer, raccourcis réparés et devtools limités au développement.
- États d'interface : erreurs, états vides, chargements, boutons occupés,
  confirmations destructives et retours de mutations rendus explicites.
- Notifications : lecture unitaire ou globale, erreurs visibles et dates
  relatives.
- Modération : mutations isolées par ligne, raisons lisibles, confirmation des
  rejets/suppressions et retours succès/erreur distincts.
- Média : lecteur non forcé en sourdine, contrôles compatibles avec le thème,
  sélection correcte de l'aperçu converti et métadonnées vidéo formatées avec
  libellés et unités.
- Design system : correction de `Heading`, des couleurs sombres, du contraste,
  des dimensions `minH`/`minW`, du safelist Tailwind et migration des derniers
  `forwardRef` vers les refs React 19.
- Qualité TypeScript : ajout de types publics explicites aux collections
  TanStack DB afin d'éliminer les erreurs TS2883 de génération de types.

### Nouveaux modules principaux

- `src/components/ConfirmationDialog.tsx`
- `src/components/RoutePending.tsx`
- `src/components/VideoMetadataList.tsx`
- `src/lib/router/not-found.ts`
- `src/lib/router/route-params.ts`
- `src/lib/posts/video-metadata.ts`
- `src/lib/posts/video-metadata.test.ts`
- `src/components/EmptyState.tsx`
- `src/components/EmptyState.test.tsx`
- `src/components/LoadingSkeletons.tsx`
- `src/components/EditorialShell.tsx`
- `src/components/ui/palette.ts`
- `src/lib/post-edits/post-edits.config.ts`
- `src/utils/seo.test.ts`
- `src/lib/ids.test.ts`

### Migration ajoutée

- `drizzle/20260910235519_post_edit_previous_payload/migration.sql`
- `drizzle/20260910235519_post_edit_previous_payload/snapshot.json`

La migration ajoute temporairement `previous_payload` comme nullable,
renseigne les suggestions existantes depuis `posts`, puis applique `NOT NULL`.
Le snapshot Drizzle a été généré avec `nub run db:local generate`, pas rédigé à
la main.

## Validation effectuée

| Vérification                                   | Résultat                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| `nub exec tsc --noEmit`                        | Réussie                                                                     |
| `nub run lint:check`                           | Réussie ; avertissements Effect connus uniquement                           |
| `nub run build:dev`                            | Build client, SSR et Nitro réussi                                           |
| `nub exec vitest run`                          | **662/662** tests, **67/67** fichiers                                       |
| `nub run db:local check`                       | Chaîne et snapshots Drizzle cohérents                                       |
| Dépendances Effect/OpenTelemetry               | `effect` et `@effect/opentelemetry` en **4.0.0-rc.112** ; runtime local OK  |
| Inventaire Playwright                          | **58 tests dans 15 fichiers** (`--list`)                                    |
| Playwright complet (premier passage)           | 55 tests réussis ; 3 assertions de nom accessible obsolètes                 |
| Playwright auth/passkey ciblé après correction | **7/7** tests réussis ; les 3 assertions obsolètes ont été alignées         |
| Vérification SSR locale                        | `/users` SSR 200 avec profils, `/login` 200 + `noindex`, `/posts/12abc` 404 |
| Contrôle visuel navigateur                     | `/users`, `/posts` et recherche vide responsive sombre ; console propre     |
| `git diff --check`                             | Réussie                                                                     |
| Format des fichiers touchés en dernier         | Réussi                                                                      |

Les commandes doivent continuer à utiliser `nub`, jamais `npm` ou `pnpm`.

## Travail restant

Aucun correctif fonctionnel ou de design issu de cette revue ne reste ouvert.
Une matrice visuelle exhaustive desktop/mobile × clair/sombre peut encore être
rejouée comme contrôle de non-régression si le produit le nécessite.

## Avertissements connus

- `lint:check` peut encore signaler des avertissements Effect liés aux APIs
  expérimentales, notamment `new Date()` dans `src/lib/points/points.service.ts`.
  Les dépendances `effect`, `@effect/opentelemetry`,
  `@opentelemetry/api-logs` et `@opentelemetry/sdk-metrics` sont alignées et
  le runtime local démarre.
- Le build conserve les avertissements existants concernant
  `MediaInfoModule.wasm` et les gros chunks.
- L'extension Brave de Browser Control reste déconnectée (suivi dans
  [l'issue #9](https://github.com/OzakIOne/vitesakuga/issues/9)), mais le
  navigateur intégré Codex a permis la vérification visuelle finale.
- `nub run format:check` global signale encore des fichiers hors de cette passe :
  `.wrangler/deploy/config.json`, `docs/security-audit.md`, `package.json` et
  `pnpm-workspace.yaml`. Les fichiers modifiés pour la revue ont été vérifiés
  séparément.

## Précautions sur le working tree

Le dépôt était déjà fortement modifié avant cette passe. Ne pas faire de reset,
checkout global ou formatage massif. Des modifications utilisateur préexistantes
se trouvent notamment dans :

- `.papercuts.jsonl`, `docs/features.md`, `docs/testing.md` et
  `pnpm-workspace.yaml` ;
- les tests e2e d'authentification, commentaires et upload, ainsi que leur
  configuration Playwright ;
- `Comments.tsx`, `PostDetailDisplay.tsx`, `Video.tsx`, les hooks/tests d'auth,
  les services/tests de commentaires et posts, et les routes login, signup et
  upload.

Certaines zones ont ensuite été modifiées par les deux ensembles de travaux. La
prochaine personne doit donc inspecter et stagier les hunks individuellement au
lieu de supposer que chaque fichier sale appartient à cette revue.

`tsconfig.tsbuildinfo` a été restauré après les validations et ne doit pas être
inclus dans un commit.

## Reprise recommandée

1. Lire `docs/frontend-review.md` et ce fichier.
2. Examiner `git diff` par domaine, puis séparer soigneusement les commits sans
   écraser les modifications utilisateur préexistantes.
3. Rejouer TypeScript, lint, Vitest et les e2e concernés après chaque séparation.
4. Rejouer, si souhaité, la passe visuelle par une matrice exhaustive desktop/mobile
   et clair/sombre ; les vues responsive sombres principales ont déjà été
   vérifiées dans le navigateur intégré.
