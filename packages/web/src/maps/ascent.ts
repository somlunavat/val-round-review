import type { MapConfig } from "./types.js";

/**
 * Ascent calibration and callout points from valorant-api.com /v1/maps
 * (fetched 2026-10-01). Community data, not an official Riot source. See docs/ASSETS.md.
 * VERIFY against a real match response before trusting positions.
 */
export const ascent: MapConfig = {
  calibration: {
    mapPath: "/Game/Maps/Ascent/Ascent",
    displayName: "Ascent",
    xMultiplier: 0.00007,
    yMultiplier: -0.00007,
    xScalarToAdd: 0.813895,
    yScalarToAdd: 0.573242,
    imageSize: 1024,
  },
  callouts: [
    { name: "Tree", region: "A", pos: { x: 3981, y: -5939 } },
    { name: "Lobby", region: "A", pos: { x: 4489, y: -3014 } },
    { name: "Main", region: "A", pos: { x: 5322, y: -4710 } },
    { name: "Window", region: "A", pos: { x: 4023, y: -8181 } },
    { name: "Site", region: "A", pos: { x: 6154, y: -6626 } },
    { name: "Garden", region: "A", pos: { x: 3774, y: -7551 } },
    { name: "Rafters", region: "A", pos: { x: 6130, y: -8210 } },
    { name: "Wine", region: "A", pos: { x: 7359, y: -4689 } },
    { name: "Lobby", region: "B", pos: { x: -1491, y: -1390 } },
    { name: "Main", region: "B", pos: { x: -1984, y: -5841 } },
    { name: "Boat House", region: "B", pos: { x: -4485, y: -7763 } },
    { name: "Site", region: "B", pos: { x: -2344, y: -7549 } },
    { name: "Bottom", region: "Mid", pos: { x: 1122, y: -5952 } },
    { name: "Catwalk", region: "Mid", pos: { x: 2316, y: -4127 } },
    { name: "Cubby", region: "Mid", pos: { x: 3387, y: -5130 } },
    { name: "Market", region: "Mid", pos: { x: 1089, y: -7363 } },
    { name: "Courtyard", region: "Mid", pos: { x: 1223, y: -4587 } },
    { name: "Link", region: "Mid", pos: { x: -632, y: -4280 } },
    { name: "Pizza", region: "Mid", pos: { x: 1802, y: -7262 } },
    { name: "Top", region: "Mid", pos: { x: 2754, y: -2130 } },
    { name: "Spawn", region: "Attacker Side", pos: { x: 60, y: 50 } },
    { name: "Spawn", region: "Defender Side", pos: { x: 1995, y: -9745 } },
  ],
};
