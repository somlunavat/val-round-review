# CLAUDE.md — Valorant Round Review (working name: "Replay Lab")

A web app that lets a player review key moments from **their own** VALORANT matches. It starts as a 2D round scrubber and grows into a Three.js 3D reconstruction.

Read this whole file before writing code. When something here conflicts with a quick shortcut, follow this file.

---

## 1. Product in one paragraph

A player opts in, links their account, and picks a recent match. They choose a round and see a timeline of what happened: kills, spike plant/defuse, economy, and player positions at those moments. They scrub through the round on a minimap (2D) or a 3D blockout of the map (3D). The goal is **review**: "could I have seen the person who killed me?", "was that buy right?", "did I die isolated?"

## 2. Hard rules (do not violate)

1. **Own data only.** The app shows a player their own opted-in matches. No opponent scouting, no pre-match analysis of other players, no looking up arbitrary players. Build the UI and API so this is structurally difficult, not just discouraged.
2. **The Riot API key never reaches the browser.** All Riot calls go through our backend. The key lives in environment variables only. Never commit it. Never log it. Use HTTPS only.
3. **No extracted game assets.** Do not use geometry, textures, or images ripped from the game client. 3D maps are our own simplified blockouts built in-repo. 2D minimap images must come from a source whose license/terms permit use; record the source in `docs/ASSETS.md` for every asset.
4. **Do not present guesses as facts.** The API gives positions only at specific events, not a continuous trace. Anything between known snapshots is interpolated and must be visibly marked as approximate in the UI (dashed trails, lower opacity, an "approx." label). Never imply we know where a player was between events.
5. **Respect rate limits and policy.** One production key per project. Cache aggressively. Check the current Riot developer policy before adding any feature that touches other players' data. Add the required Riot legal boilerplate/attribution to the site footer.
6. **Do not invent API fields.** If a field is not confirmed in the official docs or a real response, mark it `// VERIFY` in types and handle it as optional.

## 3. Current status and constraints

- Personal/dev Riot keys **cannot** access VAL-MATCH-V1. A **production key is required** and can take weeks.
- Therefore the project is built **fixture-first**. Everything must run against local fixture matches with no network and no key. The live Riot client is a swappable adapter added later.
- Available Riot endpoints: VAL-CONTENT-V1 (agents, maps, queues, acts), VAL-MATCH-V1 (match by id, matchlist by puuid, recent matches by queue), VAL-RANKED-V1 (leaderboards), VAL-STATUS-V1 (platform status). Account lookup and sign-in go through Riot Sign On (RSO), which also needs approval.

## 4. Tech stack

- **Language:** TypeScript everywhere (strict mode).
- **Frontend:** Vite + React + TypeScript. State with Zustand. Styling with Tailwind. 2D view on HTML canvas (or SVG overlay). 3D view with **Three.js** via `@react-three/fiber` and `@react-three/drei`.
- **Backend:** Node + Fastify (TypeScript). Validate every Riot response with **Zod** at the boundary. Cache with SQLite (`better-sqlite3`) keyed by match id; match data is immutable once completed, so cache it indefinitely.
- **Tests:** Vitest for unit tests, Playwright for one or two end-to-end smoke tests.
- **Lint/format:** ESLint + Prettier. `pnpm` workspaces.

Do not add heavy dependencies without a reason written in the PR description.

## 5. Repo layout

```
/
├─ CLAUDE.md
├─ docs/
│  ├─ ASSETS.md              # source + license for every asset
│  ├─ DATA_MODEL.md          # what the API gives vs what we derive
│  └─ DECISIONS.md           # short ADR-style log
├─ packages/
│  ├─ shared/                # types + Zod schemas used by web and server
│  │  └─ src/{match.ts, replay.ts, maps.ts}
│  ├─ server/
│  │  └─ src/
│  │     ├─ index.ts
│  │     ├─ riot/            # RiotClient interface + live + fixture adapters
│  │     ├─ cache/           # SQLite cache
│  │     ├─ routes/          # /api/matches, /api/matches/:id, /api/maps
│  │     └─ transform/       # raw match -> ReplayModel
│  └─ web/
│     └─ src/
│        ├─ components/      # Timeline, RoundPicker, Minimap2D, Scene3D, EconomyPanel
│        ├─ maps/            # per-map config (calibration, blockout geometry)
│        ├─ state/
│        └─ pages/
└─ fixtures/
   └─ matches/               # sample match JSON + a generator script
```

## 6. Data model

### 6.1 What the Riot match payload gives us

`MatchDto` contains `matchInfo`, `players`, `coaches`, `teams`, `roundResults`.

- `matchInfo`: matchId, mapId (a path string like `/Game/Maps/Port/Port`), gameVersion, gameLengthMillis, gameStartMillis, isCompleted, queueId, gameMode, isRanked, seasonId.
- `players`: puuid, gameName/tagLine, teamId, characterId (agent), score, K/D/A, ability casts, competitive tier.
- `roundResults[]` (per round): round number, result, winning team, spike plant/defuse info (who, round time, site, player locations), and `playerStats[]`.
- `playerStats[]` (per player per round): `kills[]`, `damage[]` (headshots/bodyshots/legshots per receiver), `economy` (loadout value, weapon, armor, remaining, spent), ability info, AFK/penalty flags.
- `kills[]`: game time, round time, killer, victim, victim location, assistants, `playerLocations[]` (all players at that moment), finishing damage (weapon/ability, fire mode).
- Locations are **x/y only**, no height. Facing direction may be present on player locations (`viewRadians`) — `// VERIFY` against a real response before relying on it.

Always re-check exact field names against the official docs and a real response; the fixture generator must mirror the real shape.

### 6.2 The key limitation

Positions exist **only at events** (kills, spike plant, spike defuse). There is no per-second trace. Design every feature around "snapshots at events" and treat anything else as interpolation.

### 6.3 Derived model (what the frontend consumes)

Define in `packages/shared/src/replay.ts`:

```ts
type Vec2 = { x: number; y: number };          // raw game coordinates

type Snapshot = {
  t: number;                                    // ms since round start
  source: "kill" | "plant" | "defuse";          // where this snapshot came from
  players: { puuid: string; team: "Blue" | "Red"; pos: Vec2; facing?: number; alive: boolean }[];
};

type RoundEvent =
  | { type: "kill"; t: number; killer: string; victim: string; weapon?: string; victimPos: Vec2 }
  | { type: "plant"; t: number; planter: string; site: string }
  | { type: "defuse"; t: number; defuser: string };

type RoundReplay = {
  roundNum: number;
  winningTeam: string;
  resultType: string;
  durationMs: number;
  economy: { puuid: string; loadoutValue: number; spent: number; remaining: number; weapon?: string; armor?: string }[];
  snapshots: Snapshot[];                        // known data only
  events: RoundEvent[];
};

type MatchReplay = { matchId: string; mapId: string; rounds: RoundReplay[] };
```

Interpolation lives in the **frontend only**, in a separate module, and its output is always tagged `approximate: true`. The server never fabricates positions.

## 7. Coordinate transform (game → minimap)

Game coordinates must be converted to minimap pixels with a per-map calibration. Store calibration in `packages/web/src/maps/<map>.ts`:

```ts
type MapCalibration = {
  mapPath: string;       // e.g. "/Game/Maps/Port/Port"
  displayName: string;
  xMultiplier: number;
  yMultiplier: number;
  xScalarToAdd: number;
  yScalarToAdd: number;
  imageSize: number;     // minimap image width/height in px
};
```

The commonly used form (**VERIFY against a current community source and against known fixture events before trusting it**) swaps the axes:

```
pixelX = gameY * xMultiplier + xScalarToAdd
pixelY = gameX * yMultiplier + yScalarToAdd
```

Add a unit test with at least two known points per map, and a debug overlay in the 2D view that draws the calibration grid. Wrong calibration is the most likely source of "everything looks off" bugs; validate it early.

## 8. 3D approach

- Use a **simplified blockout** per map: boxes/planes for walls, floors, sites, ramps, and main lanes, built in code or as small `.glb` files we author ourselves. Stylized and low-poly is the intent.
- The same calibration math drives both views: game x/y → scene x/z. **Height (y in the scene) comes from our own blockout**, since the API has no z. Snap players to the floor height of the blockout at their x/z.
- Players render as simple capsules colored by team, with a view cone from `facing` when available.
- Camera modes: free orbit, top-down, and "follow player".
- Keep the scene light: instanced meshes where possible, no shadows in the first pass, target 60 fps on a mid laptop.
- Start with **one map only**. Do not generalize until one map works end to end.

## 9. Build phases (do them in order, one PR each)

**Phase 0 — Scaffolding**
- pnpm workspace, strict TS, ESLint/Prettier, Vitest, CI running lint + test + typecheck.
- `shared` package with Zod schemas for the match payload.

**Phase 1 — Fixtures and transform**
- Fixture generator producing realistic matches (13+ rounds, kills with `playerLocations`, plant/defuse, economy).
- `transform/` converts raw match → `MatchReplay`, with tests.
- `RiotClient` interface + fixture adapter. Server routes serve fixtures.

**Phase 2 — 2D round scrubber (the shippable core)**
- Match picker → round picker → minimap canvas + timeline slider.
- Event markers on the timeline; click to jump. Kill lines, spike icon, player dots at snapshots.
- Economy panel per round. Calibration debug overlay.
- No interpolation yet: show snapshots exactly as given.

**Phase 3 — Review features**
- Flag moments: trades (kill followed quickly by a kill on the killer), isolated deaths (no teammate within a distance threshold at death), spike timing, buy/save decisions.
- Each flag must show the data it's based on. No unexplained verdicts.

**Phase 4 — Three.js view for one map**
- Blockout for one map, capsules, view cones, camera modes.
- Interpolation module with visible "approximate" styling, plus a toggle to hide interpolated motion.

**Phase 5 — Live Riot adapter (only after key approval)**
- Live `RiotClient` with Zod validation, retry with jitter, token-bucket rate limiting, SQLite cache.
- RSO sign-in so a player can only see their own matches.
- Delete or hard-gate any fixture-only shortcuts.

## 10. Coding conventions

- Strict TypeScript. No `any`; use `unknown` and narrow with Zod.
- Pure functions for transforms, with tests. Keep React components small and presentational.
- Server returns **derived replay models**, not raw Riot payloads, so the frontend never depends on Riot's shape.
- Handle partial data: missing fields, rounds with no kills, spike never planted, AFK players. Add fixtures for these edge cases.
- Errors: typed error responses from the server; the UI shows a clear message, never a blank screen.
- Commit small, with descriptive messages. Update `docs/DECISIONS.md` when making a non-obvious choice.

## 11. Definition of done (per feature)

- Types and Zod schemas updated.
- Unit tests for any transform/math; fixture covers the edge case.
- Works with fixtures and no network.
- Interpolated output is visibly marked as approximate.
- No secrets in the repo; no extracted assets; `docs/ASSETS.md` updated if an asset was added.
- Lint, typecheck, and tests pass.

## 12. Things to ask the human before doing

- Adding any dependency over ~100 KB or any paid service.
- Adding any feature that shows data about a player other than the signed-in user.
- Choosing a source for minimap images or calibration values.
- Anything touching Riot policy, attribution, or key handling.

## 13. Commands (fill in as the scaffold lands)

```
pnpm install
pnpm dev            # web + server with fixtures
pnpm test
pnpm lint
pnpm typecheck
pnpm fixtures:gen   # regenerate sample matches
```
