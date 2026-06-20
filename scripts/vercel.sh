#!/usr/bin/env bash
# Resolve a usable Vercel CLI and forward all args to it.
#
# Prefer a globally-installed `vercel`: it avoids re-downloading the CLI on
# every deploy and works on machines where a registry firewall blocks the
# `pnpm dlx` fetch. Fall back to `pnpm dlx vercel` when no global binary is
# present (e.g. a fresh checkout).
set -euo pipefail

if command -v vercel >/dev/null 2>&1; then
  exec vercel "$@"
fi

exec pnpm dlx vercel "$@"
