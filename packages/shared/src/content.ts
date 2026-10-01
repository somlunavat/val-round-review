/**
 * Display data for ids that appear in match payloads (agents, weapons, armor)
 * and per-map imagery. Served by our backend, normalized from valorant-api.com.
 * Every field is optional in spirit: the UI must work when this is empty.
 */
import { z } from "zod";

export const ContentItemSchema = z.object({
  id: z.string(), // lowercase UUID
  name: z.string(),
  icon: z.string().optional(), // image URL
});
export type ContentItem = z.infer<typeof ContentItemSchema>;

export const MapImagesSchema = z.object({
  mapPath: z.string(),
  displayName: z.string(),
  minimap: z.string().optional(),
  thumbnail: z.string().optional(),
});
export type MapImages = z.infer<typeof MapImagesSchema>;

export const ContentSchema = z.object({
  available: z.boolean(),
  agents: z.array(ContentItemSchema.extend({ role: z.string().optional() })),
  weapons: z.array(ContentItemSchema),
  armor: z.array(ContentItemSchema),
  maps: z.array(MapImagesSchema),
});
export type Content = z.infer<typeof ContentSchema>;

export const SessionInfoSchema = z.object({
  source: z.enum(["fixture", "live"]),
  /** The signed-in player's own Riot ID, for the header. */
  riotId: z.string().optional(),
});
export type SessionInfo = z.infer<typeof SessionInfoSchema>;
