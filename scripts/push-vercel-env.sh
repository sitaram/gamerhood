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
  echo "Using Vercel CLI via pnpm dlx…" >&2
  VERCEL_BIN="pnpm dlx vercel"
else
  VERCEL_BIN="vercel"
fi

if [[ ! -f .vercel/project.json && ! -f .vercel/repo.json ]]; then
  echo "Link this repo first: $VERCEL_BIN link" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source .env.local
set +a

VARS=(
  # Stripe
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  STRIPE_PLATFORM_FEE_PERCENT
  # Supabase (public + service role)
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  # Admin allow-list
  ADMIN_EMAILS
  # Resend (transactional email)
  RESEND_API_KEY
  RESEND_FROM_EMAIL
  # Printful (merch)
  PRINTFUL_API_TOKEN
  PRINTFUL_TSHIRT_VARIANT_ID
  PRINTFUL_HOODIE_VARIANT_ID
  PRINTFUL_JOGGERS_VARIANT_ID
  PRINTFUL_MUG_VARIANT_ID
  PRINTFUL_POSTER_VARIANT_ID
  PRINTFUL_STICKER_VARIANT_ID
  PRINTFUL_BACKPACK_VARIANT_ID
  PRINTFUL_PHONE_CASE_VARIANT_ID
  # Discovered 2026-05-24 — Black/M (or sensible default) for each blank.
  PRINTFUL_KIDS_HOODIE_VARIANT_ID
  PRINTFUL_KIDS_TSHIRT_VARIANT_ID
  PRINTFUL_KIDS_LONG_SLEEVE_VARIANT_ID
  PRINTFUL_KIDS_HEAVYWEIGHT_TEE_VARIANT_ID
  PRINTFUL_KIDS_SPORTS_TEE_VARIANT_ID
  PRINTFUL_PILLOW_VARIANT_ID
  PRINTFUL_BLANKET_VARIANT_ID
  PRINTFUL_PET_SWEATER_VARIANT_ID
  PRINTFUL_TOTE_BAG_VARIANT_ID
  PRINTFUL_ORNAMENT_VARIANT_ID
  PRINTFUL_PUZZLE_VARIANT_ID
  PRINTFUL_EMBROIDERED_PATCH_VARIANT_ID
  PRINTFUL_HARDCOVER_JOURNAL_VARIANT_ID
)

# By default only push to production. Override with TARGET_ENVS env var,
# e.g. TARGET_ENVS="production preview development" ./scripts/push-vercel-env.sh
ENVS=(${TARGET_ENVS:-production})

for name in "${VARS[@]}"; do
  val="${!name-}"
  if [[ -z "$val" ]]; then
    echo "Skip $name (empty in .env.local)" >&2
    continue
  fi
  for env in "${ENVS[@]}"; do
    echo "Setting $name for $env…"
    # --force overwrites if it already exists. Fall back to plain add if
    # this CLI version doesn't support --force on env add.
    printf '%s' "$val" | $VERCEL_BIN env add "$name" "$env" --force >/dev/null 2>&1 \
      || { $VERCEL_BIN env rm "$name" "$env" --yes >/dev/null 2>&1 || true; \
           printf '%s' "$val" | $VERCEL_BIN env add "$name" "$env" >/dev/null; }
  done
done

echo "Env push complete."
