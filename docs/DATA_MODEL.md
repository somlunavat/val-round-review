# Data model

What the Riot API gives us vs. what we derive.

- Raw payload schemas: `packages/shared/src/match.ts`. Fields marked `// VERIFY` are not confirmed
  against a real production response and are optional.
- Derived replay model: `packages/shared/src/replay.ts`.
- Transform: `packages/server/src/transform/toReplay.ts` (pure, unit tested).

## Given by the API (copied through)

| Replay field                                        | Source                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `MatchReplay.matchId`, `mapId`, `gameStartMillis`   | `matchInfo`                                                                                                              |
| `ReplayPlayer.team`, `characterId`                  | `players[].teamId`, `characterId`                                                                                        |
| `RoundReplay.roundNum`, `winningTeam`, `resultType` | `roundResults[].roundNum`, `winningTeam`, `roundResult`                                                                  |
| `RoundReplay.economy[]`                             | `roundResults[].playerStats[].economy` (players without it are omitted)                                                  |
| `RoundReplay.afk[]`                                 | `playerStats[].wasAfk` (VERIFY)                                                                                          |
| kill events                                         | `playerStats[].kills[]`: `timeSinceRoundStartMillis`, `killer`, `victim`, `victimLocation`, `finishingDamage.damageItem` |
| plant / defuse events                               | `bombPlanter`, `plantRoundTime`, `plantSite`, `bombDefuser`, `defuseRoundTime`                                           |
| snapshot positions                                  | `kills[].playerLocations`, `plantPlayerLocations`, `defusePlayerLocations`                                               |
| snapshot `facing`                                   | `playerLocations[].viewRadians` (VERIFY; only included when present)                                                     |

## Derived (deterministic, no guessing)

- **Event order.** Kills from every player's `kills[]` are merged and sorted by round time.
- **`alive` in a snapshot.** A player is dead if they were the victim of a kill strictly earlier in
  the round. In a kill snapshot the victim is included with `alive: false`.
- **Victim position.** In a kill snapshot the victim is placed at `victimLocation`, which is the
  dedicated field for the death spot, not at their entry in `playerLocations`.
- **Players missing from a snapshot.** Their position at that moment is unknown. Absence does not
  mean dead; read `alive` from the snapshots where they do appear. When a kill has no
  `playerLocations`, its snapshot contains only the victim.
- **No plant.** A round counts as planted only when `bombPlanter` is set and `plantRoundTime` is a
  number. The API sends `plantRoundTime: 0`, `plantSite: ""` for unplanted rounds (VERIFY).
- **`durationMs`.** The API has no round end time. We use the latest time the data justifies:
  - `Bomb detonated`: plant time + 45 s fuse.
  - `Round timer expired`: 100 s round timer.
  - otherwise: the last event's time.

  This is a lower bound, not a measurement. VERIFY whether `timeSinceRoundStartMillis` counts from
  the end of the buy phase.

## Never done on the server

- Interpolating positions between snapshots. That lives in the frontend only and is always tagged
  `approximate: true`.
- Returning raw Riot payloads or any player's `gameName`/`tagLine`.

## Fixtures

`fixtures/src/generate.ts` produces synthetic matches in the `MatchDto` shape. Duels need a sight
line on the map's walkable footprint (see DECISIONS.md). Matches are validated against
`MatchSchema` on write. All ids (puuids, agents, weapons, armor) are fake, and positions come from
made-up zones inside a plausible coordinate box. They do **not** follow real map geometry, so they
can't be used to check minimap calibration.

| File                       | Purpose                                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fx-match-0001-standard`   | 13-11 regulation match                                                                                                                                            |
| `fx-match-0002-overtime`   | 13-15 overtime loss                                                                                                                                               |
| `fx-match-0003-edge-cases` | AFK player all match; round 3 has no kills and no plant; round 5 has a player with no economy; round 7 kills have no `playerLocations`; no `viewRadians` anywhere |
| `fx-match-0004-not-own`    | Fixture player not in it; the API must 404 it                                                                                                                     |

Regenerate with `pnpm fixtures:gen`. A test fails if the committed files drift from the generator.
