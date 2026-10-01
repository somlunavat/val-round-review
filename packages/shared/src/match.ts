/**
 * Zod schemas for the VAL-MATCH-V1 `MatchDto` payload.
 *
 * Field names follow the official Riot developer docs. Anything not confirmed
 * there (or seen only in community-shared responses) is marked `// VERIFY` and
 * kept optional. Unknown keys are stripped at the boundary, so nothing
 * downstream can depend on fields we have not declared here.
 *
 * Re-check every field against a real production response before Phase 5.
 */
import { z } from "zod";

export const LocationSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const PlayerLocationsSchema = z.object({
  puuid: z.string(),
  viewRadians: z.number().nullish(), // VERIFY: presence and units (radians, which origin/direction?)
  location: LocationSchema,
});

export const MatchInfoSchema = z.object({
  matchId: z.string(),
  mapId: z.string(), // map path, e.g. "/Game/Maps/Ascent/Ascent"
  gameVersion: z.string().nullish(), // VERIFY
  gameLengthMillis: z.number().nullish(),
  gameStartMillis: z.number(),
  provisioningFlowId: z.string().nullish(),
  isCompleted: z.boolean(),
  customGameName: z.string().nullish(),
  queueId: z.string().nullish(), // empty string for custom games
  gameMode: z.string().nullish(),
  isRanked: z.boolean().nullish(),
  seasonId: z.string().nullish(),
  region: z.string().nullish(), // VERIFY
});

export const AbilityCastsSchema = z.object({
  grenadeCasts: z.number().nullish(),
  ability1Casts: z.number().nullish(),
  ability2Casts: z.number().nullish(),
  ultimateCasts: z.number().nullish(),
});

export const PlayerStatsSchema = z.object({
  score: z.number(),
  roundsPlayed: z.number(),
  kills: z.number(),
  deaths: z.number(),
  assists: z.number(),
  playtimeMillis: z.number().nullish(),
  abilityCasts: AbilityCastsSchema.nullish(),
});

export const PlayerSchema = z.object({
  puuid: z.string(),
  gameName: z.string().nullish(),
  tagLine: z.string().nullish(),
  teamId: z.string(), // "Blue" | "Red" in standard modes
  partyId: z.string().nullish(),
  characterId: z.string().nullish(), // agent UUID
  stats: PlayerStatsSchema.nullish(),
  competitiveTier: z.number().nullish(),
  playerCard: z.string().nullish(),
  playerTitle: z.string().nullish(),
  accountLevel: z.number().nullish(), // VERIFY
  isObserver: z.boolean().nullish(), // VERIFY
});

export const CoachSchema = z.object({
  puuid: z.string(),
  teamId: z.string(),
});

export const TeamSchema = z.object({
  teamId: z.string(),
  won: z.boolean(),
  roundsPlayed: z.number(),
  roundsWon: z.number(),
  numPoints: z.number().nullish(),
});

export const FinishingDamageSchema = z.object({
  damageType: z.string().nullish(), // e.g. "Weapon" | "Ability" | "Bomb" | "Melee"
  damageItem: z.string().nullish(), // weapon UUID or ability slot name
  isSecondaryFireMode: z.boolean().nullish(),
});

export const KillSchema = z.object({
  timeSinceGameStartMillis: z.number(),
  timeSinceRoundStartMillis: z.number(), // VERIFY: does round start include the buy phase?
  killer: z.string().nullish(), // absent for e.g. fall/spike deaths — VERIFY
  victim: z.string(),
  victimLocation: LocationSchema,
  assistants: z.array(z.string()).nullish(),
  playerLocations: z.array(PlayerLocationsSchema).nullish(), // VERIFY: includes the victim?
  finishingDamage: FinishingDamageSchema.nullish(),
});

export const DamageSchema = z.object({
  receiver: z.string(),
  damage: z.number(),
  legshots: z.number(),
  bodyshots: z.number(),
  headshots: z.number(),
});

export const EconomySchema = z.object({
  loadoutValue: z.number(),
  weapon: z.string().nullish(), // weapon UUID
  armor: z.string().nullish(), // armor UUID
  remaining: z.number(),
  spent: z.number(),
});

export const AbilitySchema = z.object({
  grenadeEffects: z.string().nullish(),
  ability1Effects: z.string().nullish(),
  ability2Effects: z.string().nullish(),
  ultimateEffects: z.string().nullish(),
});

export const PlayerRoundStatsSchema = z.object({
  puuid: z.string(),
  kills: z.array(KillSchema).nullish(),
  damage: z.array(DamageSchema).nullish(),
  score: z.number().nullish(),
  economy: EconomySchema.nullish(),
  ability: AbilitySchema.nullish(),
  wasAfk: z.boolean().nullish(), // VERIFY
  wasPenalized: z.boolean().nullish(), // VERIFY
  stayedInSpawn: z.boolean().nullish(), // VERIFY
});

export const RoundResultSchema = z.object({
  roundNum: z.number(), // 0-based in the API
  roundResult: z.string(), // e.g. "Eliminated", "Bomb detonated", "Bomb defused", "Round timer expired"
  roundCeremony: z.string().nullish(),
  winningTeam: z.string(),
  bombPlanter: z.string().nullish(),
  bombDefuser: z.string().nullish(),
  plantRoundTime: z.number().nullish(),
  plantPlayerLocations: z.array(PlayerLocationsSchema).nullish(),
  plantLocation: LocationSchema.nullish(),
  plantSite: z.string().nullish(), // "A" | "B" | "C"; empty string when not planted — VERIFY
  defuseRoundTime: z.number().nullish(),
  defusePlayerLocations: z.array(PlayerLocationsSchema).nullish(),
  defuseLocation: LocationSchema.nullish(),
  playerStats: z.array(PlayerRoundStatsSchema),
  roundResultCode: z.string().nullish(),
});

export const MatchSchema = z.object({
  matchInfo: MatchInfoSchema,
  players: z.array(PlayerSchema),
  coaches: z.array(CoachSchema).nullish(),
  teams: z.array(TeamSchema).nullish(),
  roundResults: z.array(RoundResultSchema),
});

export type Location = z.infer<typeof LocationSchema>;
export type PlayerLocations = z.infer<typeof PlayerLocationsSchema>;
export type MatchInfo = z.infer<typeof MatchInfoSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type Team = z.infer<typeof TeamSchema>;
export type Kill = z.infer<typeof KillSchema>;
export type Economy = z.infer<typeof EconomySchema>;
export type PlayerRoundStats = z.infer<typeof PlayerRoundStatsSchema>;
export type RoundResult = z.infer<typeof RoundResultSchema>;
export type Match = z.infer<typeof MatchSchema>;

/** Matchlist entry (GET /val/match/v1/matchlists/by-puuid/{puuid}). */
export const MatchlistEntrySchema = z.object({
  matchId: z.string(),
  gameStartTimeMillis: z.number(),
  queueId: z.string().nullish(),
});

export const MatchlistSchema = z.object({
  puuid: z.string(),
  history: z.array(MatchlistEntrySchema),
});

export type MatchlistEntry = z.infer<typeof MatchlistEntrySchema>;
export type Matchlist = z.infer<typeof MatchlistSchema>;
