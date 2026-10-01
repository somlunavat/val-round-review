# Decisions

Short ADR-style log. Newest at the bottom.

## TypeScript pinned to 6.0.x

`typescript-eslint` 8.x supports TypeScript `<6.1`. TypeScript 7 (native) is out, but linting would
run on an unsupported version. Revisit when typescript-eslint supports 7.

## pnpm via Corepack

`packageManager` pins pnpm in `package.json`. Run `corepack enable` once so `pnpm` is on PATH.
`esbuild` is the only dependency allowed to run install scripts (`allowBuilds` in
`pnpm-workspace.yaml`).

## No SQLite until the live adapter

Fixtures are local files and need no cache. `better-sqlite3` (native build) lands with the live
Riot client, where caching actually matters.

## Replay roster carries no names

`MatchReplay.players` has puuid, team, agent, and `isSelf`, but no `gameName`/`tagLine`. The
minimap needs to tell players apart, but the app is for reviewing your own play, and names would
make it easier to use as a scouting tool (CLAUDE.md §2.1). The schema extends the CLAUDE.md §6.3
sketch with `players`, `selfPuuid`, `gameStartMillis`, and `RoundReplay.afk`.

## Ownership is enforced in one place

Every route gets "whose data" from a `SessionResolver`, never from the request. No route takes a
puuid. `/api/matches/:id` returns the same 404 for "doesn't exist" and "you weren't in it", so
match ids can't be probed. Until RSO, the dev resolver returns `DEV_SESSION_PUUID` or the fixture
player.

## Server depends on the fixtures package

`config.ts` imports the fixture directory and fixture puuid from `@replay-lab/fixtures`. It's only
used when `RIOT_SOURCE=fixture`. When the live adapter lands, fixtures must be hard-gated out of
production builds.

## Round duration is a lower bound

See `DATA_MODEL.md`. The API has no round end time, so `durationMs` is the latest time the data
justifies.

## No minimap image in the 2D view

valorant-api.com's minimap images are extracted from the game client, so CLAUDE.md §2.3 rules them
out. The 2D view draws a plain background with callout labels placed via the calibration. Only the
calibration numbers and callout points come from valorant-api.com (logged in `ASSETS.md`).

## 2D view holds the last snapshot, never blends

Scrubbing between events keeps showing the most recent known snapshot, dimmed, with a banner
naming the time it is from. Before the first event, nothing is drawn. Facing (`viewRadians`) is not
drawn yet because its direction convention is unverified.

## Players are labelled relative to the viewer

"You", "Ally 1–4", "Enemy 1–5", with ally/enemy colours, not Blue/Red. Labels come from roster
order, so they are stable within a match.

## Playwright uses the installed Chrome locally

`playwright.config.ts` sets `channel: "chrome"` outside CI to avoid a browser download. CI installs
Playwright's Chromium.
