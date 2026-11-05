#!/usr/bin/env bash
# Compare the Effect tooling engines on this project: Oxlint type-aware lint on
# tsgolint versus tsrs, and typecheck on the patched tsc versus tsrs.
#
# Usage: bash scripts/bench-tooling.sh [runs]
set -uo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root" || exit 1

runs=${1:-5}
time_bin=/usr/bin/time
if [ ! -x "$time_bin" ]; then
  echo "bench-tooling: $time_bin not found (macOS time -l is required)" >&2
  exit 1
fi

tsrs_version=$(grep -oE 'tsrs@[0-9][^ "]*' package.json | head -1 | cut -d@ -f2)
if [ -z "${tsrs_version:-}" ]; then
  echo "bench-tooling: no tsrs version found in package.json scripts" >&2
  exit 1
fi

export APP_ENV=${APP_ENV:-test}
export NODE_ENV=${NODE_ENV:-test}
export BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET:-bench-placeholder-secret-not-for-production}
export DATABASE_URL=${DATABASE_URL:-'postgresql://user:password@localhost:15432/sakuga?sslmode=disable'}
export CLOUDFLARE_BUCKET=${CLOUDFLARE_BUCKET:-bench-bucket}
export CLOUDFLARE_R2=${CLOUDFLARE_R2:-http://localhost:9000}
export CLOUDFLARE_ACCESS_KEY=${CLOUDFLARE_ACCESS_KEY:-rustfsadmin}
export CLOUDFLARE_SECRET_KEY=${CLOUDFLARE_SECRET_KEY:-rustfsadmin}

out=$(mktemp)
trap 'rm -f "$out"' EXIT

measure() {
  local variant=$1
  shift
  for run in $(seq 0 "$runs"); do
    local log real user sys rss
    log=$(mktemp)
    "$time_bin" -l "$@" >/dev/null 2>"$log"
    real=$(awk '/real/ && /user/ && /sys/ {print $1; exit}' "$log")
    user=$(awk '/real/ && /user/ && /sys/ {print $3; exit}' "$log")
    sys=$(awk '/real/ && /user/ && /sys/ {print $5; exit}' "$log")
    rss=$(awk '/maximum resident set size/ {print $1; exit}' "$log")
    rm -f "$log"
    [ "$run" -eq 0 ] && continue
    printf '%s\t%s\t%s\t%s\t%s\n' "$variant" "$real" "$user" "$sys" "${rss:-0}" >>"$out"
  done
}

measure tsc ./node_modules/.bin/tsc --noEmit
measure tsrs ./node_modules/.bin/effect-tsgo "tsrs@${tsrs_version}" --noEmit
measure lint-tsgolint ./node_modules/.bin/oxlint . --type-check --type-aware --ignore-pattern '.commandcode/**'
measure "lint-tsrs" ./node_modules/.bin/effect-tsgo "--tsrs-lint=${tsrs_version}" oxlint . --type-check --type-aware --ignore-pattern '.commandcode/**'

printf '%-16s %10s %10s %10s %10s\n' variant median_s cpu_s cores peak_rss
awk -F'\t' '
  { n[$1]++; wall[$1, n[$1]] = $2; cpu[$1, n[$1]] = $3 + $4; rss[$1, n[$1]] = $5 }
  END {
    for (variant in n) {
      count = n[variant]
      for (i = 1; i <= count; i++) {
        for (j = i + 1; j <= count; j++) {
          if (wall[variant, j] < wall[variant, i]) {
            t = wall[variant, i]; wall[variant, i] = wall[variant, j]; wall[variant, j] = t
            t = cpu[variant, i]; cpu[variant, i] = cpu[variant, j]; cpu[variant, j] = t
            t = rss[variant, i]; rss[variant, i] = rss[variant, j]; rss[variant, j] = t
          }
        }
      }
      mid = int((count + 1) / 2)
      median = wall[variant, mid]
      mcpu = cpu[variant, mid]
      mrss = rss[variant, mid] / 1024 / 1024
      printf "%-16s %10.2f %10.1f %10.1f %10.0f\n", variant, median, mcpu, mcpu / median, mrss
    }
  }
' "$out" | sort
