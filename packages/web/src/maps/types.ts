import type { Vec2 } from "@replay-lab/shared";

/**
 * Converts game x/y to the minimap. Values are normalized (0..1) and scaled by
 * `imageSize`. Note the axis swap: game Y drives horizontal, game X vertical.
 */
export type MapCalibration = {
  mapPath: string;
  displayName: string;
  xMultiplier: number;
  yMultiplier: number;
  xScalarToAdd: number;
  yScalarToAdd: number;
  imageSize: number;
};

/** A named area with a reference point in game coordinates. */
export type Callout = {
  name: string;
  region: string;
  pos: Vec2;
};

export type MapConfig = {
  calibration: MapCalibration;
  callouts: readonly Callout[];
};
