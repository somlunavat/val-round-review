import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MatchSchema } from "@replay-lab/shared";
import { FIXTURE_MAPS, FIXTURE_MATCHES_DIR, fixtureSet, loadMasks } from "./index.js";

mkdirSync(FIXTURE_MATCHES_DIR, { recursive: true });
for (const f of readdirSync(FIXTURE_MATCHES_DIR)) {
  if (f.endsWith(".json")) rmSync(join(FIXTURE_MATCHES_DIR, f));
}

const masks = await loadMasks(FIXTURE_MAPS);
console.log(`walkable masks: ${masks.size}/${FIXTURE_MAPS.length} maps`);

for (const match of fixtureSet(masks)) {
  // Fail loudly if the generator drifts from the schema the live client will enforce.
  MatchSchema.parse(match);
  const file = join(FIXTURE_MATCHES_DIR, `${match.matchInfo.matchId}.json`);
  writeFileSync(file, JSON.stringify(match, null, 2) + "\n");
  const rounds = match.roundResults.length;
  const score = (match.teams ?? []).map((t) => `${t.teamId} ${t.roundsWon}`).join(" - ");
  console.log(`wrote ${match.matchInfo.matchId}.json (${rounds} rounds, ${score})`);
}
