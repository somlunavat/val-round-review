/**
 * Per-map colour themes for the 3D blockout, picked to echo each map's setting.
 * Purely our own choices; no game textures are involved.
 */
export type MapPalette = {
  /** Multiplies the draped minimap on floor tops. */
  floor: string;
  /** Floor sides and ledges. */
  floorSide: string;
  wall: string;
  sky: string;
  /** Warm or cool key light. */
  light: string;
};

const DEFAULT: MapPalette = {
  floor: "#c9c3b8",
  floorSide: "#3b4652",
  wall: "#c9c3b8",
  sky: "#0f1923",
  light: "#fff4e0",
};

const PALETTES: Record<string, Partial<MapPalette>> = {
  // Ascent: Venetian stone and terracotta.
  "/Game/Maps/Ascent/Ascent": {
    floor: "#e6d6bd",
    floorSide: "#6b5644",
    wall: "#d8c7ab",
    light: "#ffe8c4",
  },
  // Bind: Moroccan sandstone.
  "/Game/Maps/Duality/Duality": {
    floor: "#ecd2a6",
    floorSide: "#7a5a3a",
    wall: "#e0c08f",
    light: "#ffdcab",
  },
  // Haven: Bhutanese monastery, warm wood and plaster.
  "/Game/Maps/Triad/Triad": {
    floor: "#e2cfb8",
    floorSide: "#6d4a3a",
    wall: "#d7bfa3",
    light: "#ffe2bd",
  },
  // Split: Tokyo concrete and neon.
  "/Game/Maps/Bonsai/Bonsai": {
    floor: "#cfd3d8",
    floorSide: "#3e4955",
    wall: "#b9c2cc",
    light: "#e6f0ff",
    sky: "#101826",
  },
  // Icebox: snow, ice, steel.
  "/Game/Maps/Port/Port": {
    floor: "#e8f1f8",
    floorSide: "#46607a",
    wall: "#d6e4ef",
    light: "#e3f1ff",
    sky: "#0e1a26",
  },
  // Breeze: island sand and teal water.
  "/Game/Maps/Foxtrot/Foxtrot": {
    floor: "#f1e3c0",
    floorSide: "#3f6f6a",
    wall: "#e9d7a8",
    light: "#fff3d6",
  },
  // Fracture: rust and red rock.
  "/Game/Maps/Canyon/Canyon": {
    floor: "#e3c6ae",
    floorSide: "#6e3d33",
    wall: "#cfa48a",
    light: "#ffd9bd",
  },
  // Pearl: underwater Lisbon, teal stone.
  "/Game/Maps/Pitt/Pitt": {
    floor: "#cfe3df",
    floorSide: "#2f5a5c",
    wall: "#b9d4cf",
    light: "#d9fff6",
    sky: "#0b1b22",
  },
  // Lotus: overgrown stone and green.
  "/Game/Maps/Jam/Jam": {
    floor: "#d9dfc5",
    floorSide: "#44583b",
    wall: "#c6cfa9",
    light: "#f1ffd9",
  },
  // Sunset: LA dusk, orange plaster.
  "/Game/Maps/Juliett/Juliett": {
    floor: "#f0d2b6",
    floorSide: "#7a4636",
    wall: "#e8b994",
    light: "#ffcf9f",
    sky: "#1a1420",
  },
  // Abyss: dark stone over the void.
  "/Game/Maps/Infinity/Infinity": {
    floor: "#c9c6d6",
    floorSide: "#352f48",
    wall: "#b0abc4",
    light: "#e5dcff",
    sky: "#0b0b14",
  },
  // Corrode: weathered industrial.
  "/Game/Maps/Rook/Rook": {
    floor: "#d6cfc4",
    floorSide: "#504236",
    wall: "#bdb2a2",
    light: "#ffe9cf",
  },
  // Summit: alpine stone and snow.
  "/Game/Maps/Plummet/Plummet": {
    floor: "#e3e6e9",
    floorSide: "#4b5763",
    wall: "#cdd3d8",
    light: "#eef6ff",
  },
};

export function paletteFor(mapPath: string): MapPalette {
  return { ...DEFAULT, ...PALETTES[mapPath] };
}
