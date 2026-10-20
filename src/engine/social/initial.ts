import type { GameState, Person } from "../types";
import type { LifeProfile, SocialState, Household } from "./types";
import { accounts } from "../enterprise/accounting";
export function stableHash(value: string) {
  let n = 2166136261;
  for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0;
  return n;
}
export function newHousehold(
  s: GameState,
  id: string,
  actorId: string,
  homeId: string,
): Household {
  return {
    ...accounts(),
    id,
    name:
      actorId === "player"
        ? "あなたの世帯"
        : s.npcs.find((p) => p.id === actorId)!.name + "の世帯",
    adults: [actorId],
    children: [],
    homeId,
    claims: { [actorId]: 0 },
    contribution: { [actorId]: 0 },
    paid: { rent: s.date.slice(0, 7) },
  };
}
export function newProfile(
  s: GameState,
  p: Person,
  householdId: string,
): LifeProfile {
  const n = stableHash(p.id + ":" + s.simulation.seed);
  return {
    id: p.id,
    values: {
      security: 35 + (n % 46),
      ambition: 30 + ((n >>> 5) % 51),
      connection: 40 + ((n >>> 10) % 51),
      independence: 30 + ((n >>> 15) % 51),
    },
    interests: [["読書", "散歩", "ものづくり", "音楽", "技術", "料理"][n % 6]],
    riskTolerance: 35 + ((n >>> 8) % 41),
    stress: 0,
    romance: p.id !== "player" && n % 9 === 0 ? "friendship" : "open",
    partnerId: null,
    householdId,
    parents: [],
    children: [],
    timeline: [],
    memories: [],
    jobIds: [],
    businessIds: [],
    lastFamilyDate: s.date,
    birthRecorded: true,
  };
}
export function initialSocial(s: GameState): SocialState {
  const social: SocialState = {
    profiles: [],
    bonds: [],
    goals: [],
    households: [],
    lastWorldEvent: Math.max(0, ...s.simulation.news.map((n) => n.id)),
    today: { date: s.date, npcHours: {}, playerCosts: 0, npcProcessed: false },
    policy: { npcRelationships: true, npcFamily: true },
    stats: {
      conversations: 0,
      friendships: 0,
      partnerships: 0,
      marriages: 0,
      births: 0,
      adoptions: 0,
    },
  };
  for (const p of [s.person, ...s.npcs]) {
    const id = "household-" + p.id;
    const homeId =
      p.id === "player"
        ? s.spatial.homePropertyId
        : (s.simulation.residents.find((r) => r.id === p.id)?.homeId ??
          "campus-share");
    social.households.push(newHousehold(s, id, p.id, homeId));
    const profile = newProfile(s, p, id);
    profile.jobIds =
      p.id === "player"
        ? s.employments.map((e) => e.id)
        : [
            s.simulation.residents.find((r) => r.id === p.id)?.jobId ?? "",
          ].filter(Boolean);
    profile.businessIds =
      p.id === "player"
        ? [...s.ventures.map((v) => v.id), ...s.companies.map((c) => c.id)]
        : s.simulation.firms.filter((f) => f.ownerId === p.id).map((f) => f.id);
    social.profiles.push(profile);
  }
  return social;
}
