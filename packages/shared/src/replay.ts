/**
 * Derived replay model: what the server returns and the frontend consumes.
 *
 * Everything here is either copied from the Riot payload or derived from it
 * deterministically. Snapshots contain known positions only; the server never
 * interpolates. See docs/DATA_MODEL.md.
 */
import { z } from "zod";

export const TeamSideSchema = z.enum(["Blue", "Red"]);
export type TeamSide = z.infer<typeof TeamSideSchema>;

/** Raw game coordinates (no height; the API gives x/y only). */
export const Vec2Schema = z.object({ x: z.number(), y: z.number() });
export type Vec2 = z.infer<typeof Vec2Schema>;

export const SnapshotPlayerSchema = z.object({
  puuid: z.string(),
  team: TeamSideSchema,
  pos: Vec2Schema,
  facing: z.number().optional(),
  alive: z.boolean(),
});
export type SnapshotPlayer = z.infer<typeof SnapshotPlayerSchema>;

export const SnapshotSchema = z.object({
  t: z.number(), // ms since round start
  source: z.enum(["kill", "plant", "defuse"]),
  players: z.array(SnapshotPlayerSchema),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

export const RoundEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("kill"),
    t: z.number(),
    killer: z.string().optional(),
    victim: z.string(),
    weapon: z.string().optional(),
    victimPos: Vec2Schema,
  }),
  z.object({
    type: z.literal("plant"),
    t: z.number(),
    planter: z.string(),
    site: z.string(),
    /** Where the spike was planted, from `plantLocation`. */
    pos: Vec2Schema.optional(),
  }),
  z.object({
    type: z.literal("defuse"),
    t: z.number(),
    defuser: z.string(),
  }),
]);
export type RoundEvent = z.infer<typeof RoundEventSchema>;

export const EconomyEntrySchema = z.object({
  puuid: z.string(),
  loadoutValue: z.number(),
  spent: z.number(),
  remaining: z.number(),
  weapon: z.string().optional(),
  armor: z.string().optional(),
});
export type EconomyEntry = z.infer<typeof EconomyEntrySchema>;

export const RoundReplaySchema = z.object({
  roundNum: z.number(), // 0-based, as in the API
  winningTeam: z.string(),
  resultType: z.string(),
  /** Derived lower bound, not a measured value. See docs/DATA_MODEL.md. */
  durationMs: z.number(),
  economy: z.array(EconomyEntrySchema),
  snapshots: z.array(SnapshotSchema),
  events: z.array(RoundEventSchema),
  /** Players flagged AFK this round, when the API reports it. */
  afk: z.array(z.string()),
});
export type RoundReplay = z.infer<typeof RoundReplaySchema>;

/**
 * Roster entry. Deliberately carries no gameName/tagLine for anyone: the app
 * reviews the signed-in player's own play and must not become a lookup tool.
 */
export const PlayerStatLineSchema = z.object({
  kills: z.number(),
  deaths: z.number(),
  assists: z.number(),
  score: z.number(),
});
export type PlayerStatLine = z.infer<typeof PlayerStatLineSchema>;

export const ReplayPlayerSchema = z.object({
  puuid: z.string(),
  team: TeamSideSchema,
  characterId: z.string().optional(),
  isSelf: z.boolean(),
  stats: PlayerStatLineSchema.optional(),
});
export type ReplayPlayer = z.infer<typeof ReplayPlayerSchema>;

export const MatchReplaySchema = z.object({
  matchId: z.string(),
  mapId: z.string(),
  gameStartMillis: z.number(),
  selfPuuid: z.string(),
  players: z.array(ReplayPlayerSchema),
  rounds: z.array(RoundReplaySchema),
});
export type MatchReplay = z.infer<typeof MatchReplaySchema>;

/** Row in the signed-in player's own match list. */
export const MatchSummarySchema = z.object({
  matchId: z.string(),
  mapId: z.string(),
  gameStartMillis: z.number(),
  queueId: z.string().optional(),
  selfTeam: TeamSideSchema,
  selfCharacterId: z.string().optional(),
  selfStats: PlayerStatLineSchema.optional(),
  roundsWon: z.number(),
  roundsLost: z.number(),
  won: z.boolean(),
});
export type MatchSummary = z.infer<typeof MatchSummarySchema>;

/** Typed error body for every non-2xx API response. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.enum(["NOT_FOUND", "BAD_REQUEST", "UNAUTHORIZED", "UPSTREAM", "INTERNAL"]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
