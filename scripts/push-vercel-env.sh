#!/usr/bin/env bash
# Push selected secrets from .env.local to the linked Vercel project.
# Prereq: vercel login && vercel link (from repo root).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local" >&2
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "Installing Vercel CLI via pnpm dlx…" >&2
  VERCEL_BIN="pnpm dlx vercel"
else
  VERCEL_BIN="vercel"
fi

if [[ ! -f .vercel/project.json ]]; then
  echo "Link this repo first: $VERCEL_BIN link" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source .env.local
set +a

VARS=(
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  ADMIN_EMAILS
  STRIPE_PLATFORM_FEE_PERCENT
)

ENVS=(production preview development)

for name in "${VARS[@]}"; do
  val="${!name-}"
  if [[ -z "$val" ]]; then
    echo "Skip $name (empty in .env.local)" >&2
    continue
  fi
  for env in "${ENVS[@]}"; do
    echo "Setting $name for $env…"
    printf '%s' "$val" | $VERCEL_BIN env add "$name" "$env" --force 2>/dev/null ||       printf '%s' "$val" | $VERCEL_BIN env add "$name" "$env"
  done
done

echo "Redeploying production…"
$VERCEL_BIN deploy --prod --yes
echo "Done."
