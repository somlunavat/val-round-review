import { z } from "zod";
import type { Content } from "@replay-lab/shared";

/**
 * Fetches display names and image URLs from valorant-api.com (community API,
 * no key). Images are hot-linked by the browser, never stored. See docs/ASSETS.md.
 */
const BASE = "https://valorant-api.com/v1";

const AgentSchema = z.object({
  uuid: z.string(),
  displayName: z.string(),
  displayIcon: z.string().nullish(),
  role: z.object({ displayName: z.string() }).nullish(),
});
const WeaponSchema = z.object({
  uuid: z.string(),
  displayName: z.string(),
  killStreamIcon: z.string().nullish(),
  displayIcon: z.string().nullish(),
});
const GearSchema = z.object({
  uuid: z.string(),
  displayName: z.string(),
  displayIcon: z.string().nullish(),
});
const MapSchema = z.object({
  mapUrl: z.string().nullish(),
  displayName: z.string(),
  displayIcon: z.string().nullish(),
  listViewIcon: z.string().nullish(),
});

export const EMPTY_CONTENT: Content = {
  available: false,
  agents: [],
  weapons: [],
  armor: [],
  maps: [],
};

async function getList<T>(fetchImpl: typeof fetch, path: string, item: z.ZodType<T>): Promise<T[]> {
  const res = await fetchImpl(`${BASE}${path}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`valorant-api ${path} ${res.status}`);
  return z.object({ data: z.array(item) }).parse(await res.json()).data;
}

const icon = (v: string | null | undefined) => (v ? { icon: v } : {});

export async function fetchContent(fetchImpl: typeof fetch = fetch): Promise<Content> {
  const [agents, weapons, gear, maps] = await Promise.all([
    getList(fetchImpl, "/agents?isPlayableCharacter=true", AgentSchema),
    getList(fetchImpl, "/weapons", WeaponSchema),
    getList(fetchImpl, "/gear", GearSchema),
    getList(fetchImpl, "/maps", MapSchema),
  ]);
  return {
    available: true,
    agents: agents.map((a) => ({
      id: a.uuid.toLowerCase(),
      name: a.displayName,
      ...icon(a.displayIcon),
      ...(a.role ? { role: a.role.displayName } : {}),
    })),
    weapons: weapons.map((w) => ({
      id: w.uuid.toLowerCase(),
      name: w.displayName,
      ...icon(w.killStreamIcon ?? w.displayIcon),
    })),
    armor: gear.map((g) => ({
      id: g.uuid.toLowerCase(),
      name: g.displayName,
      ...icon(g.displayIcon),
    })),
    maps: maps.flatMap((m) =>
      m.mapUrl
        ? [
            {
              mapPath: m.mapUrl,
              displayName: m.displayName,
              ...(m.displayIcon ? { minimap: m.displayIcon } : {}),
              ...(m.listViewIcon ? { thumbnail: m.listViewIcon } : {}),
            },
          ]
        : [],
    ),
  };
}

/** Caches a successful fetch for the process lifetime; retries a minute after a failure. */
export function contentProvider(load: () => Promise<Content> = () => fetchContent()) {
  let cached: Content | undefined;
  let lastFailure = 0;
  return async (): Promise<Content> => {
    if (cached) return cached;
    if (Date.now() - lastFailure < 60_000) return EMPTY_CONTENT;
    try {
      cached = await load();
      return cached;
    } catch {
      lastFailure = Date.now();
      return EMPTY_CONTENT;
    }
  };
}
