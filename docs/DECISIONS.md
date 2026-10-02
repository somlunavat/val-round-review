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

## Procedural 3D blockouts for every map

CLAUDE.md §8 says to start with one hand-built map. The owner asked for every map, and
hand-modelling 13 maps wouldn't scale, so each blockout is generated from data we already have:
the minimap's walkable footprint and the callout heights. Ascent was checked first, then Haven,
Bind, and Lotus. The geometry is approximate: lanes and sites are in the right place, but heights
are blended from about 20 points per map and the 160-cell grid misses thin geometry. Hand-tuned
overrides per map can come later if needed.

## POV = recorded position + chosen aim

The API gives positions at events, and maybe a facing angle (`viewRadians`, unverified). POV puts the
camera at the chosen player's recorded position at eye height (160 units), aimed at a player the
viewer picks. For a kill, "Killer's view" and "Victim's view" pre-select the pair. The panel says
the real view direction isn't in the data. Facing isn't used until `viewRadians` is verified against
a real response. Eyes that land inside a blockout wall are moved onto the nearest open floor.

## Sight-line labels are marked approximate

In POV, a label whose sight line from the camera hits blockout geometry is dimmed and tagged
"out of sight (approx.)". This is a hint from simplified geometry, not a verdict. Phase 3's
"could I have seen them?" flag will need its own evidence display.

## Labels are projected DOM, not drei <Html>

drei's `<Html>` mounts a React root per label. Under React 19 that threw `removeChild` errors when
the canvas unmounted (switching matches in 3D). Labels are now one DOM list outside the canvas,
positioned each frame by a projector inside it, with our own raycast for occlusion.

## Fixture matches on several maps

The generator builds routes from any map's callouts (spawns → lobby/main → site; defenders hold
site points), and duels mostly pair nearby players. Sample matches now cover Ascent, Haven, Bind,
and Lotus.

## Visual style: tactical HUD, not game branding

The owner asked for a look closer to the game and less "generic AI dashboard". The UI uses the
game's general visual language:

- **Colours:** navy ink, bone text, a red accent.
- **Type:** tall condensed display caps (Bebas Neue) and condensed labels (Barlow Condensed).
- **Shapes:** hard edges, cut corners, HUD corner brackets, and a kill feed tinted by side.

It does **not** use Riot's logo, wordmark, or proprietary fonts. Our mark is a reticle with a rewind
chevron, deliberately unlike the game's logo. Agent portraits, icons, and minimaps are hot-linked
under the fan-content policy (see ASSETS.md).

## Sample kills need a sight line

Sample duels used to pair any two players, so kills happened across the map through walls. Now a
duel needs both of these:

- **Range:** the two players are within 2,200 units of each other, roughly the width of a site.
- **Sight line:** the straight line between them stays on walkable floor. "Walkable" comes from the
  same minimap footprint the 3D blockout uses (`shared/walkable.ts`), so a sample kill always shows a
  clear line in the 3D view.

The rounds also play out more like real ones:

- Attackers plant only after someone reaches the site.
- First contact near a site pulls the defenders over.
- Late in the round, attackers regroup on the site.
- Positions stay on walkable floor.

The footprints are decoded from the hot-linked minimap PNGs by a tiny zlib-based decoder (no new
dependency). They are cached in `fixtures/.cache/`, which git ignores. Tests that need them (exact
regeneration and the sight-line check) are skipped when the cache is missing, for example in CI.
The other fixture tests run on the committed JSON.

In POV, the subject's teammates are drawn as faint ghosts, and the spike is drawn near real size so
it doesn't fill the view.

## 3D maps use the minimap's tones

Each minimap encodes local detail in its greys: base floor, low cover (boxes, pillars, small
platforms), higher ground, plant-site tint, and outlines. The blockout now samples those tones on a
256-cell grid:

- **Heights:** low cover is lifted 110 units and high ground 230 above a regional base. The base is
  blended only from callouts standing on base floor, so heights aren't counted twice.
- **Floor texture:** floor tops show the minimap projected straight down in world space, so site
  markings and box outlines line up with the raised geometry.
- **Palettes:** each map gets its own palette (sandstone on Bind, ice on Icebox, and so on).

All geometry is still ours and generated at runtime. The minimap is a 2D image used under the
fan-content policy, hot-linked and never committed. Tone→height is a heuristic, not survey data.

## Strat board

A whiteboard per map, with:

- agent tokens (yours or enemy);
- freehand lines and route arrows;
- text;
- utility markers (smoke, flash, molly, recon, wall);
- up to 12 steps per strat, where a new step keeps the previous step's agent positions;
- notes;
- undo/redo and keyboard shortcuts.

Coordinates are normalized to the minimap (0–1), not game units, so a strat doesn't depend on
calibration.

Strats are saved on the server in SQLite (`.cache/strats.sqlite`), keyed by the signed-in player's
puuid, like match data: every route is scoped to the session, and another player's strat looks like
it doesn't exist. They autosave 0.7 s after each edit. Bodies are validated with `StratSchema`
(size-capped) before storing.
