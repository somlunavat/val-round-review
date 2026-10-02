/**
 * Strategy board ("strats"): a player's own plans drawn on a map.
 * Coordinates are normalized to the minimap (0..1), independent of game units.
 */
import { z } from "zod";

const Point = z.tuple([z.number().min(-0.1).max(1.1), z.number().min(-0.1).max(1.1)]);
const Id = z.string().min(1).max(40);
const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const StratTokenSchema = z.object({
  id: Id,
  side: z.enum(["ally", "enemy"]),
  agentId: z.string().max(40).optional(),
  at: Point,
  label: z.string().max(24).optional(),
});
export type StratToken = z.infer<typeof StratTokenSchema>;

export const StratShapeSchema = z.discriminatedUnion("kind", [
  z.object({
    id: Id,
    kind: z.literal("path"),
    points: z.array(Point).min(2).max(2000),
    color: Color,
    arrow: z.boolean(),
  }),
  z.object({
    id: Id,
    kind: z.literal("text"),
    at: Point,
    text: z.string().min(1).max(120),
    color: Color,
  }),
  z.object({
    id: Id,
    kind: z.literal("utility"),
    at: Point,
    type: z.enum(["smoke", "flash", "molly", "recon", "wall"]),
    /** For walls: the far end. */
    to: Point.optional(),
    color: Color,
  }),
]);
export type StratShape = z.infer<typeof StratShapeSchema>;

export const StratFrameSchema = z.object({
  id: Id,
  name: z.string().min(1).max(40),
  tokens: z.array(StratTokenSchema).max(20),
  shapes: z.array(StratShapeSchema).max(500),
});
export type StratFrame = z.infer<typeof StratFrameSchema>;

export const StratSchema = z.object({
  id: Id,
  title: z.string().min(1).max(80),
  mapPath: z.string().max(120),
  side: z.enum(["attack", "defense"]),
  notes: z.string().max(10_000),
  frames: z.array(StratFrameSchema).min(1).max(12),
  updatedAt: z.number(),
});
export type Strat = z.infer<typeof StratSchema>;

export const StratSummarySchema = StratSchema.pick({
  id: true,
  title: true,
  mapPath: true,
  side: true,
  updatedAt: true,
});
export type StratSummary = z.infer<typeof StratSummarySchema>;
