#!/usr/bin/env bash
# Local end-to-end: Stripe CLI forwards webhooks into Next and Next gets a
# matching STRIPE_WEBHOOK_SECRET for that tunnel (no Dashboard webhook).
#
# Usage: bash scripts/dev-e2e-stripe.sh   — no CLI flags (PORT via env: PORT=3001 …).
set -euo pipefail

if [[ $# -gt 0 ]]; then
  echo "This script takes no arguments (got: $*). Run: bash scripts/dev-e2e-stripe.sh" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

set -a
# shellcheck source=/dev/null
source .env.local
set +a

PORT="${PORT:-3000}"
WEBHOOK_URL="http://127.0.0.1:${PORT}/api/webhooks/stripe"
STRIPE_BIN="${STRIPE_BIN:-$HOME/.local/bin/stripe}"
if [[ ! -x "$STRIPE_BIN" ]] && command -v stripe >/dev/null 2>&1; then
  STRIPE_BIN="$(command -v stripe)"
fi

if [[ ! -x "$STRIPE_BIN" ]]; then
  echo "Stripe CLI not found. Install: https://stripe.com/docs/stripe-cli"
  exit 1
fi

if [[ -z "${STRIPE_SECRET_KEY:-}" ]]; then
  echo "STRIPE_SECRET_KEY missing from .env.local"
  exit 1
fi

# If something is already bound to PORT (typically an old Next dev), stop only
# the listener so we don't block E2E.
OLD_PID=""
OLD_PID="$(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null | head -1 || true)"
if [[ -n "$OLD_PID" ]]; then
  echo "Stopping process ${OLD_PID} (was listening on port ${PORT})."
  kill "$OLD_PID" 2>/dev/null || true
  sleep 0.9
fi

LOG="$(mktemp /tmp/gamerhood-stripe-listen.XXXXXX)"
STRIPE_LISTEN_PID=""

cleanup() {
  if [[ -n "$STRIPE_LISTEN_PID" ]] && kill -0 "$STRIPE_LISTEN_PID" 2>/dev/null; then
    kill "$STRIPE_LISTEN_PID" 2>/dev/null || true
    wait "$STRIPE_LISTEN_PID" 2>/dev/null || true
  fi
  rm -f "$LOG"
}
trap cleanup EXIT INT TERM

# Best-effort: stop an older CLI tunnel for the same URL so we don't stack listeners.
pkill -f "stripe listen.*127\.0\.0\.1:${PORT}/api/webhooks/stripe" 2>/dev/null || true
sleep 0.4

"$STRIPE_BIN" listen \
  --api-key "$STRIPE_SECRET_KEY" \
  --events checkout.session.completed \
  --forward-to "$WEBHOOK_URL" \
  -s >"$LOG" 2>&1 &
STRIPE_LISTEN_PID=$!

WEBHOOK_SECRET=""
for _ in $(seq 1 40); do
  WEBHOOK_SECRET=$(grep -oE 'whsec_[[:alnum:]]+' "$LOG" | head -1 || true)
  if [[ -n "$WEBHOOK_SECRET" ]]; then break; fi
  sleep 0.25
done

if [[ -z "$WEBHOOK_SECRET" ]]; then
  echo "Could not read webhook signing secret from stripe listen. Output:"
  cat "$LOG"
  exit 1
fi

export STRIPE_WEBHOOK_SECRET="$WEBHOOK_SECRET"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " E2E dev: Stripe → ${WEBHOOK_URL}"
echo " Signing secret (this shell only): ${WEBHOOK_SECRET:0:18}…"
echo " App: http://127.0.0.1:${PORT}"
echo " Press Ctrl+C to stop Next.js and the Stripe listener."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Run Next in the foreground; Ctrl+C / EXIT runs cleanup (stops stripe listen).
./node_modules/.bin/next dev --port "$PORT"
