# Debug : Cloudflare Turnstile + Auth en dev local

## Contexte

Lancement de `nub run dev` (stage **dev**, `.env`). Le login/signup échouait avec plusieurs erreurs console en cascade.

---

## Problème 1 — « Call to execute() on a widget that is already executing »

**Symptôme** : clic sur Login + erreur console Turnstile.

**Diagnostic** : dans `src/lib/auth/useTurnstile.ts`, le widget invisible était rendu sans `execution: "execute"`. Avec le mode par défaut (`execution: "render"`), un widget invisible lance automatiquement son challenge à l'installation. Quand on cliquait sur Login, `turnstile.execute()` était appelé sur un widget déjà en cours → conflit.

**Changement** : ajout de `execution: "execute"` aux options de `render()` (+ typé dans `TurnstileClient`), avec commentaire explicatif. Le challenge ne se lance plus qu'à la soumission.

---

## Problème 2 — « Turnstile Error 110200 (Domain not authorized) » + POST `challenge-platform` 400

**Symptôme** : après le fix ci-dessus, le widget rendait quand même le challenge, mais le POST vers Cloudflare renvoyait `400` + `110200`.

**Diagnostic** : erreur **de configuration**, pas de code. `VITE_TURNSTILE_SITEKEY=0x4AAAAAAEWKQODscGo4E7xS` dans `.env` était un **sitekey de production** dont le widget Cloudflare n'autorise que le domaine déployé, **pas `localhost`**. Sur un domaine non autorisé, Turnstile renvoie `110200` (Domain not authorized). Le design de l'app est d'ailleurs « production only » (hook no-op si sitekey vide).

**Changement** : `.env` garde la **vraie sitekey dev** (`0x4AAAAAAEWKQODscGo4E7xS`) car il sert aussi au stage Alchemy (`infra:dev` / `infra:deploy` lisent `.env` pour les vars du worker). Pour le dev local, le script `dev` dans `package.json` override la sitekey **et** le secret avec les clés de test Cloudflare (même mécanisme que `APP_ENV` ; les vars du shell ont priorité sur les `.env` files dans Vite) :

```
VITE_TURNSTILE_SITEKEY=2x00000000000000000000AB   # sitekey test invisible "always passes"
TURNSTILE_SECRET=1x0000000000000000000000000000000AA  # secret test "always passes"
```

Les deux overrides sont indispensables : la sitekey de test renvoie un dummy token (`XXXX.DUMMY.TOKEN.XXXX`) que la vraie secretkey rejetterait côté siteverify. Résultat : le flux captcha complet (widget → token → vérif serveur) est exercé en local, et passe toujours.

Autres clés de test utiles (https://developers.cloudflare.com/turnstile/troubleshooting/testing/) :

- `1x00000000000000000000AA` / `1x00000000000000000000BB` : visible always-passes / always-blocks
- `3x00000000000000000000FF` : invisible always-blocks
- `2x0000000000000000000000000000000AA` (secret) : always-fails

---

## Problème 3 — Block CSP « connect-src 'self' » sur `sakuga-dev.ozaki.one/api/auth/sign-up/email`

**Symptôme** : le fetch d'inscription refusé par la Content-Security-Policy.

**Diagnostic** : `.env` pointait vers le backend distant :

```
VITE_BASE_URL      = https://sakuga-dev.ozaki.one
BETTER_AUTH_ORIGIN = https://sakuga-dev.ozaki.one
```

Or le frontend était servi sur `localhost:3000`. `VITE_BASE_URL` pilote la base URL du client Better Auth (`client.ts`) et le router. Résultat : appel cross-origin vers l'hôte distant → bloqué par `connect-src 'self'`.

**Changement** : dans `.env`,

```
VITE_BASE_URL      = http://localhost:3000
BETTER_AUTH_ORIGIN = http://localhost:3000
```

Les appels auth sont maintenant **same-origin** avec la page servie → le CSP est satisfait. La base Neon dev + R2 dev (distants) restent inchangés.

---

## Problème 4 — « Uncaught TurnstileError: Error: 600010 »

**Symptôme** : exception non catchée dans la console lors du challenge.

**Diagnostic** : `600010` = famille 600* (generic challenge failure), très souvent l'échec de la requête **Private Access Token** — fréquent sur Brave/Chromium et souvent bénin (Turnstile auto-retry). Sans `error-callback` passé au `render()`, Turnstile **throw une exception JS** au lieu de logger. De plus, si le challenge échoue, la Promise de `execute()` ne résolvait jamais → formulaire figé.

**Changement** : dans `src/lib/auth/useTurnstile.ts`, ajout d'un `error-callback` (retourne `true` = erreur gérée, plus d'exception non catchée) et résolution de l'`execute()` en attente avec `null` en cas d'erreur.

Suite : l'`Uncaught TurnstileError` venait en fait de `size: "invisible"` passé au `render()` — Turnstile n'accepte plus que `"normal"`, `"compact"`, `"flexible"` ; l'invisibilité est désormais une propriété du **widget mode de la sitekey**, pas un paramètre. Fix : ne plus passer `size` du tout.

Suite 2 : le `error-callback` ne résout plus l'`execute()` en attente (les erreurs 600* sont souvent transitoires et Turnstile auto-retry — l'annulation anticipée envoyait la requête sans token, rejetée par le plugin captcha). `execute()` résout `null` après un timeout de 15 s uniquement.

Suite 3 : « Call to execute() on a widget that is already executing » — après un échec (timeout 15 s), le widget reste en état « executing » en interne ; le `execute()` suivant throw. Fix : `turnstile.reset(widgetId)` avant chaque `execute()` (cf. doc Cloudflare : reset remet le widget à son état initial), et resolver local avec garde anti-double-settle.

---

## Problème 5 — CSP `connect-src 'self'` bloquant le PUT présigné vers R2

**Symptôme** : upload vidéo en localhost → fetch présigné refusé par la CSP.

**Diagnostic** : l'upload vidéo est direct-to-R2 : le navigateur PUT les octets sur l'URL présignée du **endpoint S3 API** (`CLOUDFLARE_R2`), cross-origin dans tous les stages. `connect-src 'self'` le bloquait (donc l'upload était cassé partout, pas que en local). Subtilité : le SDK AWS signe les URLs en **virtual-hosted style** — le **nom du bucket préfixe le host** (`vitesakuga-media-dev.<account>.eu.r2.cloudflarestorage.com`) — et un wildcard CSP (`*.`) ne matche qu'**un seul label** de host.

**Changement** : dans `nitro.config.ts` :

- chargement explicite du fichier d'env du stage via dotenv (même pattern que `drizzle.config.ts`), car la config Nitro s'exécute avant que Vite ne charge `.env` ;
- `connect-src` = `'self'` + `https://*.<endpoint-host>` (wildcard un-label = le bucket, couvre tous les buckets du compte) + `http://localhost:9000` (rustfs local) hors production.

Le CORS du bucket dans `infra/alchemy.run.ts` autorise `http://localhost:3000`
en PUT — mais cette config n'était **pas appliquée au bucket réel** : le bucket
dev n'avait que `GET/HEAD` + header `range`, donc le préflight du PUT direct-to-R2
échouait (« CORS not configured for this bucket »). Config ré-appliquée sur le
bucket dev via l'API S3 (`PUT` + `content-type` ajoutés, origines
`localhost:3000` / `localhost:5173` / `sakuga-dev.ozaki.one` conservées). Si le
bucket est recréé par Alchemy, penser à vérifier que le CORS est bien reparti.

---

## Problème 6 — Login local inutilisable quand le widget ne complète jamais le challenge

**Symptôme** : en local, le login restait bloqué ~15 s puis, selon le stage,
échouait (`Missing CAPTCHA response` en prod-like, `Invalid email or password`
si le compte n'est pas dans la base ciblée). La console montrait toujours
`Turnstile error: 600010` (échec Private Access Token, fréquent sur
Chromium/Brave) et le token n'arrivait jamais.

**Diagnostic** : le widget était monté et attendu **dans tous les stages**, y
compris ceux où le serveur ignore le captcha (le plugin Better Auth captcha
n'est actif que si `NODE_ENV=production` **et** `TURNSTILE_SECRET` est défini —
voir `src/lib/auth/index.ts`). En local (`dev` / `dev:local`), attendre un token
ne servait donc à rien : le formulaire patientait 15 s puis soumettait sans
token. Dans un stage avec plugin actif, cette soumission sans token était
rejetée (`Missing CAPTCHA response`) sans message utilisateur clair.

**Changement** : nouveau flag client `VITE_TURNSTILE_REQUIRED` :

- `1` dans les builds déployés (`.env` pour `build:dev`, `.env.production`) où
  le worker vérifie le token (Alchemy lie `TURNSTILE_SECRET`). Dans ce cas,
  si le challenge ne produit pas de token, le formulaire affiche
  « Captcha verification failed, please try again » au lieu de soumettre sans
  token.
- `0` dans les scripts locaux (`dev`, `dev:local`) : le hook `useTurnstile` ne
  monte plus le widget et `execute()` résout `null` immédiatement → le login
  part sans attente, le serveur local n'ayant de toute façon pas le plugin
  actif.

`useTurnstile(sitekey, required)` : no-op complet si pas de sitekey ou si
`required` est faux.

---

## Fichiers modifiés

| Fichier                        | Changement                                                                                     |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `src/lib/auth/useTurnstile.ts` | `execution: "execute"` au `render()` + type ; commentaire                                      |
| `src/lib/auth/useTurnstile.ts` | `error-callback` (supprime l'exception 600010) + résolution `null` de l'`execute()` en attente |
| `.env`                         | `VITE_TURNSTILE_SITEKEY` restauré (vraie sitekey dev, pour Alchemy)                            |
| `package.json`                 | script `dev` : override sitekey + secret Turnstile avec les clés de test Cloudflare            |
| `.env`                         | `VITE_BASE_URL` → `http://localhost:3000`                                                      |
| `.env`                         | `BETTER_AUTH_ORIGIN` → `http://localhost:3000`                                                 |
| `nitro.config.ts`              | `connect-src` : origine R2 (upload direct-to-R2) + rustfs local, env stage chargée via dotenv  |
| `src/lib/env/defs.ts`          | flag client `VITE_TURNSTILE_REQUIRED` (défaut vide → désactivé)                                |
| `src/lib/auth/useTurnstile.ts` | paramètre `required` : no-op (pas de widget, `execute()` → `null`) si non requis               |
| `src/routes/(auth)/login.tsx`  | ne soumet pas sans token quand requis + message « Captcha verification failed »                |
| `src/routes/(auth)/signup.tsx` | idem signup                                                                                    |
| `package.json`                 | scripts `dev` / `dev:local` : `VITE_TURNSTILE_REQUIRED=0`                                      |
| `.env`                         | `VITE_TURNSTILE_REQUIRED=1` pour le build déployé dev                                          |
| `.env.production`              | `VITE_TURNSTILE_REQUIRED=1` (+ TODO : `VITE_TURNSTILE_SITEKEY` manquant)                       |
| `.env.example`                 | documentation du flag                                                                          |

## Action requise

**Redémarrer le serveur dev** (valeurs `.env` chargées au démarrage) : `nub run dev`.

## À surveiller (prod)

- `.env.production` doit garder la **vraie origine** de prod + le **vrai sitekey/secret Turnstile**.
- `.env.production` ne contient **pas** `VITE_TURNSTILE_SITEKEY` : tant que le
  sitekey prod n'y est pas ajouté, le client ne monte aucun widget alors que le
  worker vérifie le captcha → tout login prod est rejeté (`Missing CAPTCHA
response`). À corriger avant/au premier déploiement prod.
- Login OAuth local (GitHub/Google) : les redirect URIs sont enregistrés pour `sakuga-dev.ozaki.one`, donc le social login en local peut manquer (le login mot de passe est OK).
