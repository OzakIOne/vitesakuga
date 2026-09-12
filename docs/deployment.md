# Production deployment

La production est déployée uniquement quand une GitHub Release est publiée.
Les push et pull requests exécutent la CI, mais ne déploient rien.

## Séquence

1. La CI vérifie format, Oxlint type-aware, TypeScript, tests Vitest, build et
   garde-fou du bundle production.
2. Le workflow capture la version Worker active.
3. Alchemy déploie la release sur Cloudflare.
4. Le workflow attend la nouvelle version, sonde `HEALTHCHECK_URL`, puis
   interroge Workers Analytics.
5. Si le taux d'erreur dépasse `MAX_ERROR_RATE` avec au moins `MIN_REQUESTS`
   requêtes, Wrangler restaure automatiquement la version précédente.

Le monitoring couvre cinq échantillons d'une minute par défaut. Une absence de
trafic ne déclenche pas de rollback ; les smoke checks restent obligatoires.

## Configuration GitHub

Créer un environnement GitHub nommé `production`. Ajouter ces secrets :

- `CLOUDFLARE_API_TOKEN` : token Cloudflare avec `Workers Scripts Write` et
  `Account Analytics Read` sur le compte concerné.
- `CLOUDFLARE_ACCOUNT_ID` : identifiant du compte, si non défini comme variable.
- `PRODUCTION_ENV_FILE` : contenu complet du `.env.production` local, sans le
  committer.
- `CF_ACCESS_CLIENT_ID` et `CF_ACCESS_CLIENT_SECRET` : service token Cloudflare
  Access permettant au smoke check d'atteindre le site protégé.

Ajouter ces variables GitHub si les valeurs par défaut ne conviennent pas :

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_WORKER_NAME`
- `HEALTHCHECK_URL`
- `MAX_ERROR_RATE` (défaut `0.10`)
- `MIN_REQUESTS` (défaut `20`)
- `MONITOR_ATTEMPTS` (défaut `5`)
- `MONITOR_INTERVAL_SECONDS` (défaut `60`)

Le nom Worker actuel est utilisé par défaut dans le workflow :
`vitesakuga-infra-sakugaworker-production-5osp6ydh4rodg534`. Définir
`CLOUDFLARE_WORKER_NAME` si Alchemy le change.

Le token Cloudflare de déploiement doit être le même que celui utilisé pour
Analytics, ou le workflow doit être modifié pour fournir deux tokens séparés.

## Publier

Créer une release GitHub avec un tag, puis cliquer sur **Publish release**.
Le workflow `Deploy production release` démarre après les vérifications CI.

Le workflow `Roll back production` permet de restaurer manuellement une version
depuis **Actions**. Fournir un `version_id` pour une cible précise ou laisser
le champ vide pour demander à Wrangler la version précédente.

## Limites

Le rollback restaure le code, les assets et les bindings de la version Worker.
Il ne restaure pas les changements déjà effectués dans Neon, R2, KV ou les
autres ressources. Les migrations de base doivent donc rester rétrocompatibles
pendant la fenêtre de rollback.

La suite Playwright n'est pas dans ce premier garde-fou de release : son runner
CI est actuellement connu pour être instable avec la combinaison Nitro/
Miniflare présente dans le dépôt. Elle doit être réintégrée après correction de
ce problème.
