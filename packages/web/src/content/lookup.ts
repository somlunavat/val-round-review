import type { Content, ContentItem, MapImages } from "@replay-lab/shared";

/** Case-insensitive id lookups over /api/content. Every getter tolerates missing data. */
export type ContentLookup = {
  agent: (
    id: string | undefined,
  ) => (ContentItem & { role?: string; portrait?: string }) | undefined;
  weapon: (id: string | undefined) => ContentItem | undefined;
  armor: (id: string | undefined) => ContentItem | undefined;
  map: (mapPath: string) => MapImages | undefined;
};

export function buildLookup(content: Content | undefined): ContentLookup {
  const index = <T extends ContentItem>(items: readonly T[] = []) =>
    new Map(items.map((i) => [i.id.toLowerCase(), i]));
  const agents = index(content?.agents);
  const weapons = index(content?.weapons);
  const armor = index(content?.armor);
  const maps = new Map((content?.maps ?? []).map((m) => [m.mapPath, m]));
  const get =
    <T>(m: Map<string, T>) =>
    (id: string | undefined) =>
      id ? m.get(id.toLowerCase()) : undefined;
  return {
    agent: get(agents),
    weapon: get(weapons),
    armor: get(armor),
    map: (mapPath) => maps.get(mapPath),
  };
}

/** Name for an item id, or a short id when content is unavailable. */
export function itemName(item: ContentItem | undefined, id: string | undefined): string {
  if (item) return item.name;
  if (!id) return "—";
  return `${id.slice(0, 8)}…`;
}
