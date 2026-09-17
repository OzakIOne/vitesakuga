# Effect v4 — exploration revue des tâches 1, 2, 3, 4 et 6

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task, seulement après une nouvelle autorisation. Ce document clôt l’exploration et la revue, pas l’implémentation.

**Goal:** Choisir les changements utiles et leurs garanties vérifiables, sans migration générale de framework.

**Architecture:** Conserver TanStack, Better Auth, Kysely/Drizzle et XState. Renforcer les frontières Effect côté serveur; traiter le lifecycle des médias sans introduire de mini-runtime client.

**Tech Stack:** Effect installé `4.0.0-rc.112`, Node observé `v26.5.0`, Vitest 5, Neon HTTP/WS sur Workers, PostgreSQL local, PGlite/RustFS, mediabunny `1.56.0`.

---

## Périmètre et résultat de la revue

Numérotation **du message**, qui différait du premier fichier : **T1 transactions ; T2 DB/R2 ; T3 frontières serveur ; T4 Schema/Clock ; T6 média frontend**. Performance/observabilité générale exclues de cette passe, hormis les logs nécessaires aux erreurs de cleanup.

- Cinq explorations, puis revue parent, puis cinq sous-agents correctifs, puis seconde revue parent.
- Modèle des deux lots : `gpt-5.6-luna`; délégation existante `openai-codex`, effort `xhigh`, vérifiée avant/après. Aucun réglage modifié.
- Délégations : `deleg_940f4289`, puis `deleg_84d610a3`.
- Base : `9308020`. Aucun fichier applicatif modifié; aucune installation, migration, requête vers une DB/R2 partagée ni publication.
- Les choix produit T2 sont **validés par l’utilisateur : lifecycle durable face aux crashes, confirmation idempotente et rejet des modifications obsolètes/concurrentes**. T1 exige toujours un prototype isolé; T2 exige encore de préciser puis tester le protocole de récupération. Cette décision ne constitue pas une implémentation.

### Preuves exécutées par le parent

Sondes avec `nub --no-env-file --input-type=module -e`, sans lecture de fichiers d’environnement ni écriture de code dans le dépôt :

| Sonde                                                                              | Résultat réel                                            | Portée                                                                |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| Vrai `makeFromKysely` + `PGliteDialect`, base `memory://`, TestClock fixé à `1234` | `preserved: false` : la transaction lit l’horloge réelle | Défaut du bridge reproduit, pas simple hypothèse                      |
| Même bridge, callback suspendu, abort parent acquitté, puis libération du callback | Parent `Failure/Interrupt`, puis `rows: [{value:1}]`     | INSERT committé après acquittement de l’annulation, reproduit         |
| Schema : entrée numérique invalide                                                 | `Fail / SchemaError`                                     | Échec attendu                                                         |
| Transformation qui throw, décodage dans `Effect.suspend`                           | `Die`                                                    | Défaut préservé                                                       |
| Même transformation via `decodeUnknownSync` dans `Effect.try`                      | `Fail / RowParseError`                                   | Le wrapper reclassifie indûment le défaut                             |
| API publique `@tanstack/react-start/server`                                        | `getRequest` et `getRequestHeaders` sont des fonctions   | Import interne inutile                                                |
| `setMonth(-1)` depuis le 31 mars 2026 à midi, Europe/Paris                         | 3 mars 2026 à midi                                       | Overflow calendrier confirmé; ne pas changer implicitement le produit |

La base mémoire a été fermée. Les suites Vitest/Browser Mode/E2E, les builds et les comportements réels Workers/Neon/R2 **n’ont pas été exécutés**. Deux tentatives de sondes ont échoué avant correction : `nub exec node` cherche un binaire `.bin`, et un décodage évalué avant le runtime peut throw pendant sa construction. Ces échecs ne sont pas des résultats de tests applicatifs.

## T1 — Transactions : prototype préalable, pas correction cosmétique

**Preuves source :** `src/lib/effect/effect.utils.ts:42-46,85-95`; `node_modules/kysely/dist/kysely.js:668-692`; `src/lib/db/neon-transaction-dialect.ts:117-130`.

**Changement retenu :** restaurer la continuité `A/E/R`, la cause complète, l’horloge et le contexte de trace. Le candidat principal garde le builder transactionnel Kysely et exécute le programme métier dans la fibre/context approprié, avec un protocole explicite pour attendre la transaction. Il n’est pas encore validé par un prototype.

**Corrections imposées au premier rapport :**

- Un `callbackStarted`/`callbackExit` ne distingue pas BEGIN, COMMIT, ROLLBACK et RELEASE. Observer les phases dans l’adaptateur, ou rester conservateur lorsque le résultat n’est pas connu.
- Une erreur de RELEASE **après COMMIT confirmé** ne signifie pas que l’écriture a échoué. Signaler ce cleanup séparément; ne pas déclencher compensation ni retry métier.
- L’interruption avant acquisition/BEGIN ne doit jamais laisser un callback attendre un résultat qui ne sera pas produit. Le protocole doit terminer chaque gate exactement une fois.
- Pendant une requête SQL non annulable, attendre son règlement avant d’autoriser le chemin de rollback. Rejeter trop tôt la Promise du callback lancerait précisément le rollback concurrent qu’on veut éviter.
- Le finalizer propriétaire englobe acquisition, callback et fermeture; le cleanup de `Effect.callback` seul ne couvre pas toutes les sorties (`effect/src/internal/effect.ts:1102-1159`).
- Une fois COMMIT envoyé, un abort ne peut plus le retirer. Distinguer **commit confirmé**, **absence de commit/rollback confirmé**, **résultat inconnu**. Aucun délai borné ne doit être promis si le driver peut rester suspendu.
- `ControlledTransaction` n’est pas un raccourci sûr : BEGIN peut échouer avant retour du handle; commit/rollback peuvent rejeter avant release; release signale un Deferred sans exposer la fin du provider (`kysely.js:712-723,772-809`, `util/provide-controlled-connection.js:4-21`).

**Lot de validation :** `effect.utils.test.ts`, puis adaptateur/contrat de driver. Couvrir contexte, défaut, interruption avant BEGIN/durant SQL/à COMMIT, rollback rejeté, COMMIT confirmé + release rejeté, drainage et absence de deadlock. Rejouer la contre-épreuve mémoire. Ensuite seulement intégrer aux services; vérifier PostgreSQL et Workers/Neon séparément.

**Décision :** première priorité, mais **pas de GO définitif sur l’algorithme proposé avant ces preuves**. Une erreur terminale inconnue doit rester visible à T2.

## T2 — DB/R2 : le verrou seul ne suffit pas

**Preuves :** upload et compensation `src/lib/posts/posts.service.ts:737-868`; remplacement `src/lib/videos/videos.service.ts:300-319`; restauration `:395-415`; GC `:440-499`; clé finale déterministe `src/lib/storage/keys.ts:18-23`.

**Constat de revue :** un verrou PostgreSQL disparaît si la connexion meurt, alors qu’un DELETE R2 peut encore aboutir. Un restore qui adopte l’objet entre ces deux événements peut donc perdre un média vivant. Un délai de grâce ou une relecture ne constitue pas une preuve de sûreté.

**Choix utilisateur : niveau 2 retenu. Le niveau 1 seul est insuffisant :**

1. **Petit lot de réduction de risque :** transaction DB commune pour archive + remplacement/restauration, compensation non destructive sur résultat inconnu, échecs de nettoyage observables. Ne pas prétendre que ce lot rend le GC sûr face aux crashes. Le GC destructif doit rester limité à un cadre opérationnel explicitement drainé, ou être suspendu tant que la garantie supérieure n’existe pas.
2. **Garantie face à une suppression tardive :** registre durable léger de lifecycle/intention, sans imposer Workflow ni un nouveau worker. Sous transaction, vérifier l’absence de références protégées puis marquer `deleting`; confirmer ce commit **avant** d’envoyer DELETE. Toute adoption/restauration doit refuser cet état. Une réponse ambiguë conserve l’état non adoptable jusqu’à réconciliation, éventuellement manuelle. Un commit de marquage inconnu exige d’abord une relecture fiable, jamais un DELETE aveugle.

Pour le niveau 2 : couvrir tous les producteurs/adopteurs/suppresseurs du namespace protégé, y compris promotion initiale et compensation. Réserver les identités avant les I/O R2. Éviter une transaction DB longue pendant le réseau. Un objet encore référencé par un post ou une révision protégée n’entre pas dans `deleting`.

**Autres invariants :**

- COMMIT confirmé ou inconnu : aucune compensation destructive aveugle.
- HEAD en panne n’est pas preuve de fichier invalide. Supprimer seulement après invalidité positivement établie; sinon garder le staging/lifecycle existant.
- **Idempotence retenue pour toute la confirmation** : vidéo, images, thumbnails et création du post partagent une identité d’opération stable, liée à l’utilisateur et au contenu de la demande. Même clé et même demande retrouvent l’opération en cours ou son résultat enregistré; même clé avec une demande différente produit un conflit. Même clé finale R2 seule ne suffit pas.
- **Rejet des modifications concurrentes retenu (CAS/version attendue)** : pour une nouvelle opération, vérifier atomiquement la version lue par le client; si la ressource a changé, ne rien écraser et présenter un conflit permettant de recharger. Pas de last-writer-wins silencieux.
- **Interaction des deux garanties** : après les contrôles d’identité et d’accès, reconnaître le rejeu d’une opération déjà enregistrée avant de traiter sa version attendue comme obsolète. Un retry de l’opération réussie doit retrouver son résultat, pas échouer à cause de la version que cette même opération a fait avancer.

**Fichiers futurs :** posts/videos services et tests; storage module/adapter/tests; `src/lib/db/schema/sakuga.schema.ts` et `src/lib/db/kysely.ts` pour le registre durable et le contrôle de version, avec migration générée sans réécriture du baseline.

**Tests :** rollback après promotion, commit inconnu, cleanup échoué, restore/replace/GC concurrents, crash après marquage et DELETE tardif. Ajouter doubles confirmations simultanées avec même clé, retry après succès sans doublon ni faux conflit de version, refus de réutilisation d’une clé avec contenu différent, isolation entre utilisateurs, et deux opérations distinctes sur la même version dont une seule peut modifier la ressource. PGlite pour logique; PostgreSQL + stockage isolé et voie Workers pour concurrence/lifecycle.

**Décision validée :** lifecycle durable + idempotence complète de la confirmation + conflits explicites sur versions obsolètes. Le mécanisme de récupération doit inspecter les opérations non terminales après incident, sans supposer que la requête initiale continue; son déclenchement reste à préciser dans le design. T1 reste préalable aux garanties transactionnelles de T2; les autres tâches peuvent avancer indépendamment.

## T3 — Frontières serveur : API publiques et scopes explicites

**Preuves :** `src/lib/server-fn.handler.ts:81-135`; `src/lib/auth/auth.middleware.ts:7-21`; `src/lib/db/layer-factories.server.ts:45-74`; captures Storage/Points dans `src/lib/posts/posts.service.ts:219-222`.

**Plan retenu :**

1. Partager l’exécution/sanitisation entre `createHandler` et `getUserSession`, sans casser les imports dynamiques client-safe.
2. Lire `getRequest().signal` via **`@tanstack/react-start/server`**, API publique vérifiée; transmettre à Effect. Ne pas importer `@tanstack/start-storage-context`.
3. Séparer DB/auth de Storage. Déplacer les exigences Storage/Points aux méthodes concernées, mettre à jour leurs canaux `R` et layers de handlers; supprimer Storage de la factory seule ne suffit pas puisque les services le capturent encore.
4. Rendre S3 scoped avec fermeture unique. Garder pool Node au niveau serveur, WS Neon par transaction, headers/session par requête.
5. Adapter le harness : runtime/scope vivant pendant toutes les opérations du contexte; cleanup des clés **avant** disposal; disposal même si cleanup échoue; ne jamais rendre un service extrait d’une layer déjà fermée.

**Validation et erreurs :** les validateurs TanStack passent avant le handler. Auditer leurs callbacks réels, pas créer un wrapper global qui transforme bugs ou causes internes en messages de validation. Préserver les erreurs par champ et la sanitation HTML. Une interruption pure reste distincte des échecs métier; une cause mixte interruption + défaut ne doit pas disparaître.

**Tests :** deux requêtes concurrentes sans mélange de sessions; lecture non média sans S3; finalizer unique; getUserSession masqué sur le vrai transport; signal propagé. T1 reste responsable de la transaction, pas le signal HTTP seul.

**Bundle :** contrôler la présence de modules server-only réellement inclus dans les chunks clients via métadonnées Vite/Rolldown et un smoke d’hydratation. Ne pas tester des chaînes génériques `pg` ou `better-auth` : le client Better Auth est légitime. `check-prod-build.mjs` ne remplace pas ce contrôle.

**Décision :** design accepté pour un lot test-first ciblé; pas de runtime global Worker.

## T4 — Schema/Clock : un lot indépendant et limité

**Preuves :** décodages posts `src/lib/posts/posts.service.ts:433-438,637,656`; dates `:88-105,333-355,474-478`; promotion `src/lib/promotions/promotions.service.ts:98-101`; GC `src/lib/videos/videos.service.ts:174-197`.

**Plan retenu :**

- Invoquer `Schema.decodeUnknownEffect` dans un programme paresseux (`Effect.suspend`, ou au moment de l’exécution du générateur). Mapper les échecs Schema vers `RowParseError`; laisser les défauts dans `Cause`. `Schema.encodeEffect` existe aussi dans la version installée.
- Extraire un helper commun seulement si les sites de décodage le justifient; ne pas encapsuler toute fonction pure.
- Capturer `Clock.currentTimeMillis` une fois par décision, transmettre `now` aux helpers; dates converties aux frontières DB/transport.
- Conserver dans ce lot minuit local, sept jours calendaires et `setMonth` existants. Le comportement du 31 mars n’est ni « 30 jours » ni « mois clampé ».
- Consigner séparément l’incohérence `dateRange` entre résultats non chronologiques et popularTags; ne pas glisser un changement produit dans le refactor Clock.

**Tests :** succès, SchemaError attendu, défaut de transformation, exactitude des bornes, même instant utilisé avant/après I/O. Les tests lisant Clock hors transaction peuvent commencer avant T1. Ne pas réécrire points/local-day, déjà déterministe et zoné. Garder TestClock natif avec Vitest 5; pas de downgrade pour `@effect/vitest` rc.112 incompatible avec ce runner.

**Décision :** bon petit lot pour commencer parallèlement au prototype T1.

## T6 — Média frontend : ownership avant adoption d’Effect

**Preuves :** `src/lib/upload/useVideoProcessing.ts:76-181`; `src/lib/upload/upload.processor.ts:77-167`; `src/lib/upload/useUploadForm.ts:302-325`; `src/routes/-convert.machine.ts:358-472`; cleanup des URLs affichées `src/routes/convert.lazy.tsx:180-186`.

**Arbitrage changé après revue :** démarrer avec closures locales, génération latest-wins, AbortController et `finally`, en conservant React/TanStack/XState. **Pas de nouveau `operation-scope.ts` générique** : il recréerait une partie d’Effect. Reconsidérer Scope/Fiber si l’expérience montre une orchestration commune récurrente, pas pour obtenir un taux d’adoption supérieur.

**Plan retenu :**

1. Une MediaInfo par hook, analyses sérialisées; jeter les éléments obsolètes avant leur démarrage. Ne pas prétendre arrêter une analyse en cours; fermer après initialisation et travail effectivement terminés.
2. Protéger tous les résultats — métadonnées, vignettes, preview, captureFrame — par génération. Un résultat obsolète ne modifie pas l’UI et libère ses ressources.
3. Un Input par traitement utile, disposé dans `finally`; réutiliser le même Input pour auto-vignettes. Révoquer toute URL provisoire en cas d’échec.
4. Dans l’acteur conversion : arrêt demandé immédiatement, mais une **Promise d’arrêt unique et observée**. Arrêt durant init mémorisé; init tardif réussi → cancel unique; ensuite attendre la fin du travail avant dispose. Pas de `void cancel()` non suivi, ni d’hypothèse que deux appels cancel attendent le même cleanup. Rejet du cleanup diagnostiqué sans créer de rejet non géré; aucune promesse de délai fini si l’API ne termine pas.
5. Transmettre le **Blob** à la machine; ne créer l’object URL de téléchargement que dans l’effet UI qui possède le résultat accepté. Reset avant rendu → aucune URL créée; cleanup acteur → aucune URL affichée détruite. Adapter types internes/callers atomiquement.
6. PUT lié à un AbortController et à la génération courante. Pas de toast d’échec pour l’arrêt volontaire. Confirmation serveur inconnue ≠ rollback; dépendance au choix d’idempotence T2.

**Tests :** doubles contrôlables pour A→B, unmount, init tardif, cancel rejeté, résultat ignoré, URLs après transition rapide; puis Browser Mode et E2E avec vrais médias/codecs. Les doublures ne prouvent pas le comportement réel des codecs.

**Décision :** corrections locales pertinentes; migration Effect frontend non justifiée à ce stade.

## Ordre proposé et validation future

- **En parallèle :** prototype isolé T1 ; petit lot T4 ; tests lifecycle T6.
- **T3 :** sanitisation/dépendances peuvent avancer; garantir l’annulation transactionnelle attend T1.
- **T2 :** choix lifecycle/idempotence/conflits fixés; commencer l’implémentation après distinction fiable des issues transactionnelles et validation du protocole durable.
- Ne pas lancer deux éditeurs simultanés sur `posts.service.ts`, `videos.service.ts`, `storage.adapter.ts` ou `db/test-utils.ts`; regrouper par ownership de fichiers.

Commandes futures, non exécutées comme suites dans cette exploration :

- T1 : `nub exec vitest run src/lib/effect/effect.utils.test.ts`.
- T3 : `nub exec vitest run src/lib/server-fn.handler.test.ts src/lib/auth/auth.middleware.test.ts src/lib/db/test-utils.test.ts`.
- T4 : `nub exec vitest run src/lib/posts/posts.fn.test.ts src/lib/promotions/promotions.service.test.ts src/lib/effect/schema.utils.test.ts`.
- T2 : ajouter les tests videos/storage et un harness concurrence PostgreSQL isolé, pas uniquement PGlite.
- T6 : `nub run test:browser`, puis `nub exec playwright test --config=e2e/playwright.config.ts e2e/upload.spec.ts e2e/convert.spec.ts`.
- Global après modifications : `nub exec tsc --noEmit`, `nub run lint:check`, `nub run format:check`, `nub exec vitest run --maxWorkers=1`, `nub run build`, `nub scripts/check-prod-build.mjs`.

Synchroniser les docs pertinentes lors de l’implémentation, pas maintenant : server-functions-api, database-conventions, testing, features et CONTEXT. Aucun commit/push automatique.

## Décisions prises et points techniques restants

**Décisions utilisateur prises :** lifecycle durable protégeant des crashes; confirmation idempotente vidéo/images/thumbnails; rejet explicite des modifications concurrentes obsolètes, sans écrasement silencieux.

1. **T1 :** le prototype peut-il préserver contexte et acquitter proprement la fin sans complexifier excessivement Kysely ? Réponse à produire par tests isolés avant choix final.
2. **T2 :** préciser le déclenchement de la récupération et le traitement des états non terminaux, puis les prouver par tests de panne et de concurrence. Les choix de garanties ci-dessus ne sont plus à arbitrer.
