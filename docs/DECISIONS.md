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

## Official 2D images under Riot's fan policy (owner decision, 2026-10-01)

At first the 2D view used no minimap image, because valorant-api.com's images are taken from the
game client and CLAUDE.md §2.3 ruled them out. The project owner then chose to use the real
minimap. Riot's "Legal Jibber Jabber" policy allows Riot assets in free fan projects that show its
notice, so 2D images (minimap, map thumbnails, agent and weapon icons) are now hot-linked from
valorant-api.com and never committed. 3D assets ripped from the client are still out.
**CLAUDE.md §2.3 still has the old wording and needs the owner to update it** (the assistant
isn't allowed to edit CLAUDE.md).

Overlaying the official minimap also checks the calibration by eye: all 22 Ascent callout
points land on the matching areas of the image.

## 2D view holds the last snapshot, never blends

Scrubbing between events keeps showing the most recent known snapshot, dimmed, with a banner
naming the time it is from. Before the first event, nothing is drawn. Facing (`viewRadians`) is not
drawn yet because its direction convention is unverified.

## Players are labelled relative to the viewer

Ally/enemy colours, not Blue/Red. See "Players labelled by agent" below.

## Playwright uses the installed Chrome locally

`playwright.config.ts` sets `channel: "chrome"` outside CI to avoid a browser download. CI installs
Playwright's Chromium.

## Live Riot client before review features (owner request)

The owner asked for real data before the review flags, so the live adapter was moved ahead of the
CLAUDE.md phase order. It works now, but development keys can't read VAL-MATCH-V1, so real
matches need an approved production key. Until then the UI shows Riot's 403 with an explanation.

## Owner identity from RIOT_ID until RSO

With no RSO yet, the "signed-in" player is the Riot ID in the server's `.env`, resolved once through
ACCOUNT-V1. No request can change it, so the API still serves only the owner's own matches. RSO
replaces this before the app is used by anyone else.

## node:sqlite instead of better-sqlite3

Node 22.5+ ships SQLite (`node:sqlite`). That avoids a native build step and a dependency. It is
still marked experimental and logs a warning at startup. Switch to better-sqlite3 if the API
changes.

## Content (names/icons) goes through our server

`GET /api/content` returns normalized agent/weapon/armor/map display data, so the frontend never
depends on a third-party response shape. It never fails: when valorant-api.com is unreachable it
returns `available: false` and the UI shows ids and plain styling.

## Players labelled by agent

Map markers and panels show "You", or the agent's name and icon, coloured ally/enemy. Riot names are
still never sent to the browser. When content is unavailable, labels fall back to "Ally N"/"Enemy N".
