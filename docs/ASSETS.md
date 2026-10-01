# Assets

Every image, model, font, or data file that did not originate in this repo must be listed here
with its source and license. No assets extracted from the game client, ever (CLAUDE.md §2.3).

| Asset                                                                                     | Path                                                                           | Source                                                                      | License / terms                                                                                                                                                                                       | Added      |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Ascent minimap calibration (`xMultiplier`, `yMultiplier`, `xScalarToAdd`, `yScalarToAdd`) | `packages/web/src/maps/ascent.ts`                                              | [valorant-api.com](https://valorant-api.com) `/v1/maps`, fetched 2026-10-01 | Community API, no license of its own; numbers derived from Riot game data. Used as data under Riot's fan-project policy ("Legal Jibber Jabber", riotgames.com/legal). VERIFY against real match data. | 2026-10-01 |
| Ascent callout names and reference points (22 points, x/y only)                           | `packages/web/src/maps/ascent.ts`, fixture zones in `fixtures/src/generate.ts` | valorant-api.com `/v1/maps`, fetched 2026-10-01                             | Same as above                                                                                                                                                                                         | 2026-10-01 |

## Deliberately not used

- **Minimap images** (valorant-api.com `displayIcon` etc.). They are extracted from the game client,
  which CLAUDE.md §2.3 forbids even though Riot's fan-project policy might allow it. The 2D view
  draws callout labels on a plain background instead. Revisit only if a source with explicit
  permission turns up, or if the project rule changes.
