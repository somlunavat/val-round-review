# Assets

Every image, model, font, or data file that did not originate in this repo must be listed here
with its source and license. No assets extracted from the game client, ever (CLAUDE.md §2.3).

| Asset                                                                                     | Path                                                                           | Source                                                                      | License / terms                                                                                                                                                                                       | Added      |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Ascent minimap calibration (`xMultiplier`, `yMultiplier`, `xScalarToAdd`, `yScalarToAdd`) | `packages/web/src/maps/ascent.ts`                                              | [valorant-api.com](https://valorant-api.com) `/v1/maps`, fetched 2026-10-01 | Community API, no license of its own; numbers derived from Riot game data. Used as data under Riot's fan-project policy ("Legal Jibber Jabber", riotgames.com/legal). VERIFY against real match data. | 2026-10-01 |
| Ascent callout names and reference points (22 points, x/y only)                           | `packages/web/src/maps/ascent.ts`, fixture zones in `fixtures/src/generate.ts` | valorant-api.com `/v1/maps`, fetched 2026-10-01                             | Same as above                                                                                                                                                                                         | 2026-10-01 |

## Hot-linked at runtime (not in the repo)

Loaded by the browser from `media.valorant-api.com`, using URLs our server gets from
valorant-api.com `/v1/maps`, `/v1/agents`, `/v1/weapons`, `/v1/gear` (`GET /api/content`). Nothing is
downloaded into the repo. If they fail to load, the app falls back to a plain grid and text labels.

| Asset                                     | Used in                        | Terms                                                                                                                  |
| ----------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Minimap image (`displayIcon`) per map     | 2D map background              | Riot IP, used under Riot's fan-project policy ("Legal Jibber Jabber", riotgames.com/legal). Notice in the site footer. |
| Map thumbnail (`listViewIcon`)            | Match list, match header       | Same                                                                                                                   |
| Agent icons (`displayIcon`)               | Map markers, kill feed, panels | Same                                                                                                                   |
| Weapon kill-feed icons (`killStreamIcon`) | Kill lines, kill feed, economy | Same                                                                                                                   |

valorant-api.com is a community service, not Riot, and has no license of its own. It says it is
not endorsed by Riot Games.

## Content ids in fixtures

Fixture matches use the real public content UUIDs for agents, weapons, and armor (from the same
endpoints) so sample data and live data look the same in the UI. Ids only, no images.
