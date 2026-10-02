/**
 * Deterministic fixture match generator.
 *
 * Produces payloads shaped like VAL-MATCH-V1 `MatchDto` (see packages/shared/src/match.ts).
 * Puuids, names, and positions are synthetic. Agent, weapon, and armor ids are the real
 * public content UUIDs so the UI can label them. Players move along routes built from the
 * map's callout points (see docs/ASSETS.md) and jump between waypoints, so snapshots land in
 * playable areas.
 */
import {
  isWalkable,
  lineOfSight,
  mapData,
  snapToWalkable,
  type Callout,
  type MapData,
  type Mask,
} from "@replay-lab/shared";
import type {
  Economy,
  Kill,
  Match,
  Player,
  PlayerLocations,
  PlayerRoundStats,
  RoundResult,
} from "@replay-lab/shared";

export const SELF_PUUID = "fx-self-0000-0000-0000-000000000000";
export const FIXTURE_MAP = "/Game/Maps/Ascent/Ascent";
/** Every map the fixture set uses. */
export const FIXTURE_MAPS = [
  FIXTURE_MAP,
  "/Game/Maps/Triad/Triad",
  "/Game/Maps/Duality/Duality",
  "/Game/Maps/Jam/Jam",
];

type Side = "Blue" | "Red";
type Vec = { x: number; y: number };
type Waypoint = { at: number; pos: Vec };

/** Spawns, sites, and plausible routes built from a map's callout points. */
type MapRoutes = {
  atkSpawn: Vec;
  defSpawn: Vec;
  sites: Record<string, Vec>;
  attack: Record<string, Vec[]>; // per site, plus "Mid"
  defense: Vec[][];
};

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

export function routesFor(map: MapData): MapRoutes {
  const xy = (c: Callout): Vec => ({ x: c.pos.x, y: c.pos.y });
  const find = (region: string, name: string) =>
    map.callouts.find((c) => c.region === region && c.name === name);
  const spawn = (side: string) =>
    map.callouts.find((c) => c.name === "Spawn" && c.region.startsWith(side));
  const atk = spawn("Attacker");
  const def = spawn("Defender");
  if (!atk || !def) throw new Error(`${map.displayName}: missing spawn callouts`);
  const atkSpawn = xy(atk);
  const defSpawn = xy(def);

  const sites: Record<string, Vec> = {};
  const attack: Record<string, Vec[]> = {};
  const defense: Vec[][] = [];
  for (const site of map.callouts.filter((c) => c.name === "Site")) {
    const region = site.region;
    const sitePos = xy(site);
    sites[region] = sitePos;
    // Attackers: lobby -> main -> site when the map names them, else nearest callouts in order.
    const named = [find(region, "Lobby"), find(region, "Main")].flatMap((c) => (c ? [xy(c)] : []));
    const regionPoints = map.callouts
      .filter((c) => c.region === region && c.name !== "Site")
      .map(xy);
    const approach = named.length
      ? named
      : [...regionPoints].sort((a, b) => dist(a, atkSpawn) - dist(b, atkSpawn)).slice(0, 2);
    attack[region] = [...approach, sitePos];
    // Defenders: rotate in from the nearest point to their spawn, then hold the site or a corner.
    const entry = [...regionPoints].sort((a, b) => dist(a, defSpawn) - dist(b, defSpawn))[0];
    const corner = [...regionPoints].sort((a, b) => dist(b, sitePos) - dist(a, sitePos)).at(-1);
    defense.push([entry ?? sitePos, sitePos, sitePos]);
    if (corner) defense.push([entry ?? sitePos, sitePos, corner]);
  }
  const mid = map.callouts.filter((c) => c.region === "Mid").map(xy);
  attack.Mid = [...mid].sort((a, b) => dist(a, atkSpawn) - dist(b, atkSpawn)).slice(0, 3);
  const midHold = [...mid].sort((a, b) => dist(a, defSpawn) - dist(b, defSpawn)).slice(0, 2);
  if (midHold.length) defense.push([...midHold, midHold.at(-1) ?? defSpawn]);
  if (Object.keys(sites).length === 0) throw new Error(`${map.displayName}: no site callouts`);
  return { atkSpawn, defSpawn, sites, attack, defense };
}

// Real content UUIDs (valorant-api.com /v1/weapons, /v1/gear, /v1/agents).
const WEAPONS = {
  classic: { id: "29a0cfab-485b-f5d5-779a-b59f85e204a8", cost: 0 },
  ghost: { id: "1baa85b4-4c70-1284-64bb-6481dfc3bb4e", cost: 500 },
  sheriff: { id: "e336c6b8-418d-9340-d77f-7a9e4cfe0702", cost: 800 },
  spectre: { id: "462080d1-4035-2937-7c09-27aa2a5c27a7", cost: 1600 },
  vandal: { id: "9c82e19d-4575-0200-1a81-3eacf00cf872", cost: 2900 },
  phantom: { id: "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a", cost: 2900 },
  operator: { id: "a03b24d3-4319-996d-0f8c-94bbfba1dfc7", cost: 4700 },
};
const ARMOR = {
  light: { id: "4dec83d5-4902-9ab3-bed6-a7a390761157", cost: 400 },
  heavy: { id: "822bcab2-40a2-324e-c137-e09195ad7692", cost: 1000 },
};
const AGENTS = [
  "add6443a-41bd-e414-f6ad-e58d267f4e95", // Jett
  "8e253930-4c05-31dd-1b6c-968525494517", // Omen
  "320b2a48-4d9b-a075-30f1-1f93a9b638fa", // Sova
  "1e58de9c-4950-5125-93e9-a0aee9f98746", // Killjoy
  "6f2a04ca-43e0-be17-7f36-b3908627744d", // Skye
  "f94c3b30-42be-e959-889c-5aa313dba261", // Raze
  "707eab51-4836-f488-046a-cda6bf494859", // Viper
  "dade69b4-4f5a-8528-247b-219e5a1facd6", // Fade
  "117ed9e3-49f3-6512-3ccf-0cada7e3823b", // Cypher
  "41fb69c1-4189-7b37-f117-bcaf1e96f1bf", // Astra
];

const ROUND_LIMIT_MS = 100_000;
/** Max distance (game units) between two players for a duel; roughly a site's width. */
const ENGAGE_RANGE = 2200;
const SPIKE_TIMER_MS = 45_000;

/** mulberry32: small, fast, deterministic. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type EdgeCaseOptions = {
  /** puuid of a player who is AFK for the whole match. */
  afkPuuid?: string;
  /** Round numbers forced to end on the timer with no kills and no plant. */
  noKillRounds?: number[];
  /** Round number where one player's `economy` is missing. */
  missingEconomyRound?: number;
  /** Drop `viewRadians` from player locations. */
  omitViewRadians?: boolean;
  /** Round number where kills have no `playerLocations`. */
  missingPlayerLocationsRound?: number;
};

export type GenerateOptions = {
  seed: number;
  matchId: string;
  gameStartMillis: number;
  /** Include the fixture "signed-in" player. False produces someone else's match. */
  includeSelf: boolean;
  /** Map path; defaults to Ascent. Any map with spawn and site callouts works. */
  mapPath?: string;
  /**
   * Walkable footprint for the map. With it, positions stay on walkable floor and
   * duels need a clear sight line, matching what the 3D blockout shows.
   */
  mask?: Mask;
  edge?: EdgeCaseOptions;
};

type PlayerState = {
  puuid: string;
  team: Side;
  credits: number;
  alive: boolean;
  route: Waypoint[];
  economy: Economy;
  weaponPower: number;
  kills: Kill[];
  damage: Map<string, { damage: number; headshots: number; bodyshots: number; legshots: number }>;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  score: number;
};

export function generateMatch(opts: GenerateOptions): Match {
  const rand = rng(opts.seed);
  const mapPath = opts.mapPath ?? FIXTURE_MAP;
  const map = mapData(mapPath);
  if (!map) throw new Error(`No map data for ${mapPath}`);
  const routes = routesFor(map);
  const edge = opts.edge ?? {};
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const mask = opts.mask;
  const near = (p: Vec, r: number): Vec => {
    for (let tries = 0; tries < 8; tries++) {
      const q = { x: Math.round(p.x + between(-r, r)), y: Math.round(p.y + between(-r, r)) };
      if (!mask || isWalkable(mask, map, q)) return q;
    }
    return mask ? snapToWalkable(mask, map, p) : p;
  };
  const pick = <T>(xs: readonly T[]): T => {
    const x = xs[Math.floor(rand() * xs.length)];
    if (x === undefined) throw new Error("pick from empty list");
    return x;
  };

  const puuids: Record<Side, string[]> = { Blue: [], Red: [] };
  for (let i = 0; i < 5; i++) {
    puuids.Blue.push(
      i === 0 && opts.includeSelf ? SELF_PUUID : `fx-${opts.seed}-blue-${i}-0000-000000000000`,
    );
    puuids.Red.push(`fx-${opts.seed}-red-${i}-0000-000000000000`);
  }

  const states = new Map<string, PlayerState>();
  for (const team of ["Blue", "Red"] as const) {
    puuids[team].forEach((puuid) =>
      states.set(puuid, {
        puuid,
        team,
        credits: 800,
        alive: true,
        route: [],
        economy: { loadoutValue: 0, remaining: 0, spent: 0 },
        weaponPower: 1,
        kills: [],
        damage: new Map(),
        totalKills: 0,
        totalDeaths: 0,
        totalAssists: 0,
        score: 0,
      }),
    );
  }
  const all = () => [...states.values()];
  /** Prefer players who are not AFK for actions like planting and defusing. */
  const active = (xs: PlayerState[]) => {
    const present = xs.filter((s) => s.puuid !== edge.afkPuuid);
    return present.length ? present : xs;
  };

  const roundResults: RoundResult[] = [];
  const wins: Record<Side, number> = { Blue: 0, Red: 0 };
  const lossStreak: Record<Side, number> = { Blue: 0, Red: 0 };
  let gameClock = 0;

  const done = () => {
    const hi = Math.max(wins.Blue, wins.Red);
    const lo = Math.min(wins.Blue, wins.Red);
    return (hi >= 13 && hi - lo >= 2) || (hi === 13 && lo < 12);
  };

  for (let roundNum = 0; !done(); roundNum++) {
    const attackers: Side =
      roundNum < 12 ? "Red" : roundNum < 24 ? "Blue" : roundNum % 2 ? "Red" : "Blue";
    const defenders: Side = attackers === "Red" ? "Blue" : "Red";
    const isPistol = roundNum === 0 || roundNum === 12;
    if (isPistol) for (const s of all()) s.credits = 800;
    if (roundNum >= 24) for (const s of all()) s.credits = 5000;

    const siteName = pick(Object.keys(routes.sites));
    const sitePos = routes.sites[siteName] ?? routes.defSpawn;

    // Buy phase.
    for (const s of all()) {
      s.alive = true;
      s.kills = [];
      s.damage = new Map();
      const afk = s.puuid === edge.afkPuuid;
      let spent = 0;
      let weapon = WEAPONS.classic;
      let armor: { id: string; cost: number } | undefined;
      if (!afk) {
        if (s.credits >= 3900) {
          weapon =
            rand() < 0.15 && s.credits >= 5700
              ? WEAPONS.operator
              : rand() < 0.5
                ? WEAPONS.vandal
                : WEAPONS.phantom;
          armor = ARMOR.heavy;
        } else if (s.credits >= 2400 && !isPistol) {
          weapon = WEAPONS.spectre;
          armor = ARMOR.light;
        } else if (s.credits >= 900) {
          weapon = rand() < 0.5 ? WEAPONS.ghost : WEAPONS.sheriff;
          armor = isPistol ? undefined : ARMOR.light;
        }
        spent = weapon.cost + (armor?.cost ?? 0);
        if (spent > s.credits) {
          weapon = WEAPONS.classic;
          armor = undefined;
          spent = 0;
        }
      }
      s.credits -= spent;
      s.weaponPower = afk ? 0 : 1 + weapon.cost / 1500 + (armor ? armor.cost / 2000 : 0);
      s.economy = {
        loadoutValue: spent,
        weapon: weapon.id,
        ...(armor ? { armor: armor.id } : {}),
        remaining: s.credits,
        spent,
      };
      const isAttacker = s.team === attackers;
      const spawn = near(isAttacker ? routes.atkSpawn : routes.defSpawn, 250);
      const path = afk
        ? []
        : isAttacker
          ? (routes.attack[rand() < 0.25 && routes.attack.Mid?.length ? "Mid" : siteName] ?? [])
          : pick(routes.defense);
      // Waypoints are reached at staggered times; between them the player is at the last one.
      let at = 0;
      s.route = [{ at, pos: spawn }];
      for (const wp of path) {
        at += Math.round(between(6_000, 12_000));
        s.route.push({ at, pos: near(wp, 180) });
      }
    }

    const waypointAt = (s: PlayerState, t: number): Vec => {
      let best: Waypoint | undefined;
      for (const wp of s.route) if (wp.at <= t && (!best || wp.at >= best.at)) best = wp;
      return best?.pos ?? routes.atkSpawn;
    };
    const posAt = (s: PlayerState, t: number): Vec => near(waypointAt(s, t), 60);
    const gap = (a: PlayerState, b: PlayerState, t: number) => {
      const p = waypointAt(a, t);
      const q = waypointAt(b, t);
      return Math.hypot(p.x - q.x, p.y - q.y);
    };
    /**
     * Pairs that can actually fight: within engagement range of each other.
     * Closer pairs are more likely, so most kills are short-to-mid range.
     */
    const pickDuel = (atk: PlayerState[], def: PlayerState[], t: number) => {
      const pairs: { a: PlayerState; d: PlayerState; w: number }[] = [];
      for (const a of atk) {
        for (const d of def) {
          const g = gap(a, d, t);
          if (g >= ENGAGE_RANGE) continue;
          if (mask && !lineOfSight(mask, map, waypointAt(a, t), waypointAt(d, t))) continue;
          pairs.push({ a, d, w: 1 / (g + 400) });
        }
      }
      const total = pairs.reduce((sum, p) => sum + p.w, 0);
      let r = rand() * total;
      for (const p of pairs) {
        r -= p.w;
        if (r <= 0) return p;
      }
      return pairs.at(-1);
    };
    /** Sends players (all, or one side) to the site, dropping any later waypoints. */
    const sendToSite = (from: number, who: (s: PlayerState) => boolean, radius: number) => {
      for (const s of all()) {
        if (!s.alive || s.puuid === edge.afkPuuid || !who(s)) continue;
        s.route = s.route.filter((wp) => wp.at <= from);
        s.route.push({
          at: from + Math.round(between(4_000, 12_000)),
          pos: near(sitePos, radius),
        });
      }
    };
    const distTo = (s: PlayerState, t: number, p: Vec) => {
      const q = waypointAt(s, t);
      return Math.hypot(p.x - q.x, p.y - q.y);
    };
    /** After a plant everyone converges on the site: attackers to hold, defenders to retake. */
    const convergeOnSite = (from: number) => sendToSite(from, () => true, 600);
    /** Everyone alive (plus `extra`); `exact` players are reported at their waypoint, unjittered. */
    const locations = (
      t: number,
      extra?: PlayerState,
      exact: PlayerState[] = [],
    ): PlayerLocations[] =>
      all()
        .filter((s) => s.alive || s === extra)
        .map((s) => ({
          puuid: s.puuid,
          ...(edge.omitViewRadians
            ? {}
            : { viewRadians: Number(between(0, Math.PI * 2).toFixed(4)) }),
          location: exact.includes(s) ? waypointAt(s, t) : posAt(s, t),
        }));
    const aliveOn = (team: Side) => all().filter((s) => s.team === team && s.alive);

    let t = 0;
    let planter: PlayerState | undefined;
    let plantTime: number | undefined;
    let plantLocations: PlayerLocations[] | undefined;
    let plantLocation: Vec | undefined;
    let defuser: PlayerState | undefined;
    let defuseTime: number | undefined;
    let defuseLocations: PlayerLocations[] | undefined;
    let result: string;
    let winner: Side;

    const forceNoKills = edge.noKillRounds?.includes(roundNum) ?? false;
    let rotated = false;
    let executed = false;

    for (;;) {
      if (forceNoKills) {
        result = "Round timer expired";
        winner = defenders;
        t = ROUND_LIMIT_MS;
        break;
      }
      const atk = aliveOn(attackers);
      const def = aliveOn(defenders);
      if (atk.length === 0 && !planter) {
        result = "Eliminated";
        winner = defenders;
        break;
      }
      if (def.length === 0) {
        result = "Eliminated";
        winner = attackers;
        break;
      }

      // Late in the round, lurkers and mid players regroup on the site.
      if (!planter && !executed && t > 45_000) {
        executed = true;
        sendToSite(t, (s) => s.team === attackers && distTo(s, t, sitePos) > 1500, 500);
      }

      // Plant once an attacker has actually reached the site.
      const onSite = active(atk).filter(
        (s) => s.puuid !== edge.afkPuuid && distTo(s, t, sitePos) < 1100,
      );
      if (!planter && onSite.length > 0 && rand() < 0.6) {
        const p = pick(onSite);
        planter = p;
        plantTime = Math.round(t + between(1_000, 4_000));
        t = plantTime;
        plantLocation = near(sitePos, 250);
        p.route.push({ at: t, pos: plantLocation });
        convergeOnSite(t);
        plantLocations = locations(t);
        p.credits += 300;
        // Planter stays on the spike.
        p.route = p.route.filter((wp) => wp.at <= t);
        p.score += 80;
        continue;
      }

      const step = Math.round(planter ? between(5_000, 16_000) : between(2_000, 12_000));
      const deadline =
        planter && plantTime !== undefined ? plantTime + SPIKE_TIMER_MS : ROUND_LIMIT_MS;
      if (t + step >= deadline) {
        if (planter) {
          // Defenders may defuse if any are alive and attackers are gone; otherwise detonation.
          if (atk.length === 0 && def.length > 0) {
            defuser = pick(active(def));
            defuseTime = Math.round(t + between(3_500, 7_500));
            if (plantLocation) defuser.route.push({ at: t, pos: plantLocation });
            defuseLocations = locations(defuseTime);
            defuser.score += 80;
            result = "Bomb defused";
            winner = defenders;
            t = defuseTime;
          } else {
            result = "Bomb detonated";
            winner = attackers;
            t = deadline;
          }
        } else {
          result = "Round timer expired";
          winner = defenders;
          t = ROUND_LIMIT_MS;
        }
        break;
      }
      t += step;

      // Post-plant with attackers dead: defenders go defuse.
      if (planter && atk.length === 0) {
        defuser = pick(active(def));
        defuseTime = Math.round(t + between(3_500, 7_500));
        if (plantLocation) defuser.route.push({ at: t, pos: plantLocation });
        defuseLocations = locations(defuseTime);
        defuser.score += 80;
        result = "Bomb defused";
        winner = defenders;
        t = defuseTime;
        break;
      }

      const duel = pickDuel(atk, def, t);
      if (!duel) continue; // Nobody in contact yet; time moves on.
      const { a, d } = duel;
      // First contact near the site pulls the remaining defenders over.
      if (!rotated && !planter && distTo(a, t, sitePos) < 3000) {
        rotated = true;
        sendToSite(t, (s) => s.team === defenders && distTo(s, t, sitePos) > 2500, 900);
      }
      // Attackers holding a planted spike have the positional edge.
      const aPower = a.weaponPower * (planter ? 1.8 : 1);
      const pA = aPower / (aPower + d.weaponPower || 1);
      const [killer, victim] = rand() < pA ? [a, d] : [d, a];
      // The duelling pair is reported exactly where the sight-line check was made.
      const pl =
        edge.missingPlayerLocationsRound === roundNum
          ? undefined
          : locations(t, victim, [killer, victim]);
      const assistants = aliveOn(killer.team)
        .filter((s) => s !== killer && rand() < 0.2)
        .map((s) => s.puuid);
      victim.alive = false;
      killer.kills.push({
        timeSinceGameStartMillis: gameClock + t,
        timeSinceRoundStartMillis: t,
        killer: killer.puuid,
        victim: victim.puuid,
        victimLocation: waypointAt(victim, t),
        assistants,
        ...(pl ? { playerLocations: pl } : {}),
        finishingDamage: {
          damageType: "Weapon",
          damageItem: killer.economy.weapon ?? WEAPONS.classic.id,
          isSecondaryFireMode: false,
        },
      });
      const hs = rand() < 0.25 ? 1 : 0;
      killer.damage.set(victim.puuid, {
        damage: 150,
        headshots: hs,
        bodyshots: 3 - hs,
        legshots: rand() < 0.2 ? 1 : 0,
      });
      killer.totalKills++;
      killer.score += 200;
      killer.credits += 200;
      victim.totalDeaths++;
      for (const id of assistants) {
        const st = states.get(id);
        if (st) {
          st.totalAssists++;
          st.score += 50;
        }
      }
    }

    // Round economy: win/loss rewards.
    const loser: Side = winner === "Blue" ? "Red" : "Blue";
    wins[winner]++;
    lossStreak[winner] = 0;
    lossStreak[loser] = Math.min(lossStreak[loser] + 1, 3);
    for (const s of all()) {
      if (s.team === winner) s.credits += 3000;
      else s.credits += 1900 + 500 * (lossStreak[loser] - 1);
      s.credits = Math.min(s.credits, 9000);
    }

    const playerStats: PlayerRoundStats[] = all().map((s) => {
      const stats: PlayerRoundStats = {
        puuid: s.puuid,
        kills: s.kills,
        damage: [...s.damage.entries()].map(([receiver, d]) => ({ receiver, ...d })),
        score: s.score,
        ability: {
          grenadeEffects: null,
          ability1Effects: null,
          ability2Effects: null,
          ultimateEffects: null,
        },
        wasAfk: s.puuid === edge.afkPuuid,
        wasPenalized: false,
        stayedInSpawn: s.puuid === edge.afkPuuid,
      };
      if (!(edge.missingEconomyRound === roundNum && s.puuid === puuids[defenders][1])) {
        stats.economy = s.economy;
      }
      return stats;
    });

    roundResults.push({
      roundNum,
      roundResult: result,
      roundCeremony: "CeremonyDefault",
      winningTeam: winner,
      bombPlanter: planter?.puuid ?? null,
      bombDefuser: defuser?.puuid ?? null,
      plantRoundTime: plantTime ?? 0,
      plantPlayerLocations: plantLocations ?? null,
      plantLocation: plantLocation ?? { x: 0, y: 0 },
      plantSite: planter ? siteName : "",
      defuseRoundTime: defuseTime ?? 0,
      defusePlayerLocations: defuseLocations ?? null,
      defuseLocation: defuser && plantLocation ? plantLocation : { x: 0, y: 0 },
      playerStats,
      roundResultCode:
        result === "Bomb detonated"
          ? "Detonate"
          : result === "Bomb defused"
            ? "Defuse"
            : "Elimination",
    });

    gameClock += t + 30_000 + 7_000; // round + buy phase + end-of-round
  }

  const players: Player[] = all().map((s, i) => ({
    puuid: s.puuid,
    gameName: s.puuid === SELF_PUUID ? "FixtureSelf" : `FixturePlayer${i}`,
    tagLine: "FX1",
    teamId: s.team,
    partyId: `fx-party-${i}`,
    characterId: AGENTS[i % AGENTS.length] ?? null,
    stats: {
      score: s.score,
      roundsPlayed: roundResults.length,
      kills: s.totalKills,
      deaths: s.totalDeaths,
      assists: s.totalAssists,
      playtimeMillis: gameClock,
      abilityCasts: { grenadeCasts: 0, ability1Casts: 0, ability2Casts: 0, ultimateCasts: 0 },
    },
    competitiveTier: 12,
    playerCard: "fx-card",
    playerTitle: "fx-title",
  }));

  return {
    matchInfo: {
      matchId: opts.matchId,
      mapId: mapPath,
      gameVersion: "fixture",
      gameLengthMillis: gameClock,
      gameStartMillis: opts.gameStartMillis,
      provisioningFlowId: "Matchmaking",
      isCompleted: true,
      customGameName: "",
      queueId: "competitive",
      gameMode: "/Game/GameModes/Bomb/BombGameMode.BombGameMode_C",
      isRanked: true,
      seasonId: "fx-season",
    },
    players,
    coaches: [],
    teams: (["Blue", "Red"] as const).map((teamId) => ({
      teamId,
      won: wins[teamId] > wins[teamId === "Blue" ? "Red" : "Blue"],
      roundsPlayed: roundResults.length,
      roundsWon: wins[teamId],
      numPoints: wins[teamId],
    })),
    roundResults,
  };
}

/**
 * The fixture set written to fixtures/matches. Seeds are chosen for close, varied games
 * (a mix of eliminations, detonations, and defuses).
 */
export function fixtureSet(masks?: ReadonlyMap<string, Mask>): Match[] {
  const withMask = (o: GenerateOptions): GenerateOptions => {
    const mask = masks?.get(o.mapPath ?? FIXTURE_MAP);
    return mask ? { ...o, mask } : o;
  };
  return [
    generateMatch(
      withMask({
        seed: 12,
        matchId: "fx-match-0001-standard",
        gameStartMillis: Date.UTC(2026, 8, 20, 18, 0),
        includeSelf: true,
      }),
    ),
    generateMatch(
      withMask({
        seed: 15,
        matchId: "fx-match-0002-overtime",
        gameStartMillis: Date.UTC(2026, 8, 21, 19, 30),
        includeSelf: true,
      }),
    ),
    generateMatch(
      withMask({
        seed: 13,
        matchId: "fx-match-0003-edge-cases",
        gameStartMillis: Date.UTC(2026, 8, 22, 20, 15),
        includeSelf: true,
        edge: {
          afkPuuid: "fx-13-red-4-0000-000000000000",
          noKillRounds: [3],
          missingEconomyRound: 5,
          omitViewRadians: true,
          missingPlayerLocationsRound: 7,
        },
      }),
    ),
    // Other maps, so every view can be tried beyond Ascent.
    generateMatch(
      withMask({
        seed: 13,
        matchId: "fx-match-0005-haven",
        gameStartMillis: Date.UTC(2026, 8, 24, 18, 30),
        includeSelf: true,
        mapPath: "/Game/Maps/Triad/Triad",
      }),
    ),
    generateMatch(
      withMask({
        seed: 12,
        matchId: "fx-match-0006-bind",
        gameStartMillis: Date.UTC(2026, 8, 25, 20, 0),
        includeSelf: true,
        mapPath: "/Game/Maps/Duality/Duality",
      }),
    ),
    generateMatch(
      withMask({
        seed: 19,
        matchId: "fx-match-0007-lotus",
        gameStartMillis: Date.UTC(2026, 8, 26, 21, 45),
        includeSelf: true,
        mapPath: "/Game/Maps/Jam/Jam",
      }),
    ),
    // A match the fixture player was not in: the API must refuse to serve it.
    generateMatch(
      withMask({
        seed: 3,
        matchId: "fx-match-0004-not-own",
        gameStartMillis: Date.UTC(2026, 8, 23, 21, 0),
        includeSelf: false,
      }),
    ),
  ];
}
