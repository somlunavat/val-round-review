/**
 * Deterministic fixture match generator.
 *
 * Produces payloads shaped like VAL-MATCH-V1 `MatchDto` (see packages/shared/src/match.ts).
 * Everything is synthetic: puuids, names, weapon/armor ids, and positions. Positions are
 * random points in boxes around Ascent callout locations (see docs/ASSETS.md); they land in
 * the right areas but do not respect walls.
 */
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

type Side = "Blue" | "Red";
type Vec = { x: number; y: number };
type Zone = { x: [number, number]; y: [number, number] };

// Boxes around Ascent callout centres (game units).
const ZONES = {
  attackSpawn: { x: [-300, 400], y: [-300, 400] }, // Attacker Side Spawn (60, 50)
  defendSpawn: { x: [1600, 2400], y: [-10100, -9400] }, // Defender Side Spawn (1995, -9745)
  siteA: { x: [5600, 6700], y: [-7200, -6000] }, // A Site (6154, -6626)
  siteB: { x: [-2900, -1800], y: [-8100, -7000] }, // B Site (-2344, -7549)
  mid: { x: [900, 2300], y: [-5000, -4100] }, // Mid Courtyard / Catwalk
} satisfies Record<string, Zone>;

const WEAPONS = {
  classic: { id: "fx-weapon-classic", cost: 0 },
  ghost: { id: "fx-weapon-ghost", cost: 500 },
  spectre: { id: "fx-weapon-spectre", cost: 1600 },
  vandal: { id: "fx-weapon-vandal", cost: 2900 },
  operator: { id: "fx-weapon-operator", cost: 4700 },
};
const ARMOR = {
  light: { id: "fx-armor-light", cost: 400 },
  heavy: { id: "fx-armor-heavy", cost: 1000 },
};

const ROUND_LIMIT_MS = 100_000;
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
  edge?: EdgeCaseOptions;
};

type PlayerState = {
  puuid: string;
  team: Side;
  credits: number;
  alive: boolean;
  start: Vec;
  target: Vec;
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
  const edge = opts.edge ?? {};
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const pointIn = (z: Zone): Vec => ({
    x: Math.round(between(z.x[0], z.x[1])),
    y: Math.round(between(z.y[0], z.y[1])),
  });
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

  const agents = ["fx-agent-a", "fx-agent-b", "fx-agent-c", "fx-agent-d", "fx-agent-e"];
  const states = new Map<string, PlayerState>();
  for (const team of ["Blue", "Red"] as const) {
    puuids[team].forEach((puuid) =>
      states.set(puuid, {
        puuid,
        team,
        credits: 800,
        alive: true,
        start: { x: 0, y: 0 },
        target: { x: 0, y: 0 },
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

    const site = rand() < 0.5 ? ZONES.siteA : ZONES.siteB;
    const siteName = site === ZONES.siteA ? "A" : "B";

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
          weapon = rand() < 0.15 && s.credits >= 5700 ? WEAPONS.operator : WEAPONS.vandal;
          armor = ARMOR.heavy;
        } else if (s.credits >= 2400 && !isPistol) {
          weapon = WEAPONS.spectre;
          armor = ARMOR.light;
        } else if (s.credits >= 900) {
          weapon = WEAPONS.ghost;
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
      const spawn = s.team === attackers ? ZONES.attackSpawn : ZONES.defendSpawn;
      s.start = pointIn(spawn);
      s.target = afk
        ? s.start
        : s.team === attackers
          ? pointIn(rand() < 0.3 ? ZONES.mid : site)
          : pointIn(pick([ZONES.siteA, ZONES.siteB, ZONES.mid]));
    }

    const posAt = (s: PlayerState, t: number): Vec => {
      const k = Math.min(1, t / 35_000);
      return {
        x: Math.round(s.start.x + (s.target.x - s.start.x) * k + between(-150, 150)),
        y: Math.round(s.start.y + (s.target.y - s.start.y) * k + between(-150, 150)),
      };
    };
    const locations = (t: number, extra?: PlayerState): PlayerLocations[] =>
      all()
        .filter((s) => s.alive || s === extra)
        .map((s) => ({
          puuid: s.puuid,
          ...(edge.omitViewRadians
            ? {}
            : { viewRadians: Number(between(0, Math.PI * 2).toFixed(4)) }),
          location: posAt(s, t),
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

      // Plant once attackers have reached the site.
      if (!planter && t > 25_000 && rand() < 0.35) {
        const p = pick(active(atk));
        planter = p;
        plantTime = Math.round(t + between(1_000, 4_000));
        t = plantTime;
        p.target = pointIn(site);
        plantLocation = posAt(p, t);
        plantLocations = locations(t);
        p.credits += 300;
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
            defuser.target = plantLocation ?? defuser.target;
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
        defuseLocations = locations(defuseTime);
        defuser.score += 80;
        result = "Bomb defused";
        winner = defenders;
        t = defuseTime;
        break;
      }

      const a = pick(atk);
      const d = pick(def);
      // Attackers holding a planted spike have the positional edge.
      const aPower = a.weaponPower * (planter ? 1.8 : 1);
      const pA = aPower / (aPower + d.weaponPower || 1);
      const [killer, victim] = rand() < pA ? [a, d] : [d, a];
      const pl = edge.missingPlayerLocationsRound === roundNum ? undefined : locations(t, victim);
      const assistants = aliveOn(killer.team)
        .filter((s) => s !== killer && rand() < 0.2)
        .map((s) => s.puuid);
      victim.alive = false;
      killer.kills.push({
        timeSinceGameStartMillis: gameClock + t,
        timeSinceRoundStartMillis: t,
        killer: killer.puuid,
        victim: victim.puuid,
        victimLocation: posAt(victim, t),
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
    characterId: agents[i % agents.length] ?? null,
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
      mapId: FIXTURE_MAP,
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
export function fixtureSet(): Match[] {
  return [
    generateMatch({
      seed: 44,
      matchId: "fx-match-0001-standard",
      gameStartMillis: Date.UTC(2026, 8, 20, 18, 0),
      includeSelf: true,
    }),
    generateMatch({
      seed: 16,
      matchId: "fx-match-0002-overtime",
      gameStartMillis: Date.UTC(2026, 8, 21, 19, 30),
      includeSelf: true,
    }),
    generateMatch({
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
    // A match the fixture player was not in: the API must refuse to serve it.
    generateMatch({
      seed: 38,
      matchId: "fx-match-0004-not-own",
      gameStartMillis: Date.UTC(2026, 8, 23, 21, 0),
      includeSelf: false,
    }),
  ];
}
