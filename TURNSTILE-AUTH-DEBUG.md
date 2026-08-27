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

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/lib/auth/useTurnstile.ts` | `execution: "execute"` au `render()` + type ; commentaire |
| `src/lib/auth/useTurnstile.ts` | `error-callback` (supprime l'exception 600010) + résolution `null` de l'`execute()` en attente |
| `.env` | `VITE_TURNSTILE_SITEKEY` restauré (vraie sitekey dev, pour Alchemy) |
| `package.json` | script `dev` : override sitekey + secret Turnstile avec les clés de test Cloudflare |
| `.env` | `VITE_BASE_URL` → `http://localhost:3000` |
| `.env` | `BETTER_AUTH_ORIGIN` → `http://localhost:3000` |

## Action requise
**Redémarrer le serveur dev** (valeurs `.env` chargées au démarrage) : `nub run dev`.

## À surveiller (prod)
- `.env.production` doit garder la **vraie origine** de prod + le **vrai sitekey/secret Turnstile**.
- Login OAuth local (GitHub/Google) : les redirect URIs sont enregistrés pour `sakuga-dev.ozaki.one`, donc le social login en local peut manquer (le login mot de passe est OK).