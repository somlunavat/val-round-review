# Replay Lab

Review key moments from your own VALORANT matches: a 2D round scrubber now, a 3D blockout later.
See `CLAUDE.md` for the full brief.

## Setup

```sh
corepack enable   # puts the pinned pnpm on PATH
pnpm install
pnpm dev          # web (Vite) + server (Fastify), fixtures only, no network
pnpm test
pnpm test:e2e     # Playwright smoke tests (uses installed Chrome locally)
pnpm maps:sync    # refresh map calibration + callouts from valorant-api.com
pnpm lint
pnpm typecheck
```

## Real match data

1. Copy `.env.example` to `.env` (never committed).
2. Set `RIOT_SOURCE=live`, `RIOT_API_KEY`, `RIOT_ID` (yours, e.g. `Name#NA1`), `RIOT_SHARD`, and
   `RIOT_ACCOUNT_REGION`.
3. Restart `pnpm dev`. The header badge shows "Live · Name#TAG".

Riot only lets **approved production keys** read match data (VAL-MATCH-V1). With a development key,
the account lookup works but the match list shows Riot's 403 with an explanation. Completed matches
are cached in `.cache/matches.sqlite`.
