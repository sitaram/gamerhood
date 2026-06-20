# Release Routine

## Fast deploy (while developing)

Skips local lint/build; Vercel still builds remotely once.

```bash
pnpm run deploy:preview   # temporary preview URL
pnpm run deploy:prod        # https://www.gamerhood.gg
```

First time on a new machine: `pnpm dlx vercel link` (team project **gamerhood**).

## Full gated deploy (end of cycle)

```bash
pnpm run release:deploy
```

Runs `release:check` first (lint + build + print-area consistency), then prod deploy.

Or step by step:

```bash
pnpm run release:check
pnpm dlx vercel deploy --prod --yes
```

## Sync code to GitHub

Deploying via Vercel CLI does **not** push to GitHub. Before switching machines:

```bash
git add -A
git commit -m "Describe your changes"
git push origin main
```

## Deploying from a Socket-Firewalled machine

On machines running Socket Firewall (e.g. a corporate laptop), `pnpm run
deploy:*` fails with `unable to get local issuer certificate` — pnpm routes
child processes through Socket's TLS proxy, whose CA the system doesn't
trust, so Vercel's HTTPS calls break. It is not a CLI problem.

Work around it by invoking the deploy without going through `pnpm run`:

```bash
bash scripts/vercel.sh deploy --prod --yes --archive=tgz   # or drop --prod for a preview
```

`scripts/vercel.sh` prefers a globally-installed `vercel` and falls back to
`pnpm dlx vercel`. Install the global CLI once with `npm i -g vercel` (or
`brew install vercel-cli`) if you don't have it.

## Notes

- If checks fail, fix the issue before a gated deploy.
- `.env.local` is never committed — copy it separately to new machines.
- Keep deploys small and focused to speed rollback if needed.
