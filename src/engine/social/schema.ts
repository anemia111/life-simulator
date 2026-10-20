import { z } from "zod";
import { account } from "../enterprise/schema";
import type { GameState } from "../types";
import { goalRegistry } from "../goals";
import { verifyHouseholds } from "./households";
import {
  bondId,
  profile,
  actor,
  areKin,
  careHours,
  npcScheduledLoad,
} from "./selectors";
import { properties } from "../spatial/catalog";
import { age } from "../person";
const id = z.string().min(1).max(300),
  n = z.number().safe().int().nonnegative(),
  signed = z.number().safe().int(),
  f = z.number().finite().nonnegative(),
  score = f.max(100),
  date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        Number.isFinite(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v,
    );
const event = z.object({
  id: n,
  date,
  kind: id,
  text: id,
  relatedIds: z.array(id),
});
export const socialSchema = z.object({
  profiles: z.array(
    z.object({
      id,
      values: z.object({
        security: score,
        ambition: score,
        connection: score,
        independence: score,
      }),
      interests: z.array(id),
      riskTolerance: score,
      stress: score,
      romance: z.enum(["open", "friendship"]),
      partnerId: id.nullable(),
      householdId: id,
      parents: z.array(id),
      children: z.array(id),
      timeline: z.array(event),
      memories: z.array(event).max(24),
      jobIds: z.array(id),
      businessIds: z.array(id),
      lastFamilyDate: date,
      birthRecorded: z.boolean(),
    }),
  ),
  bonds: z.array(
    z.object({
      id,
      a: id,
      b: id,
      affinityA: score,
      affinityB: score,
      trustA: score,
      trustB: score,
      attraction: score,
      status: z.enum([
        "acquaintance",
        "friend",
        "close",
        "dating",
        "married",
        "estranged",
      ]),
      met: date,
      since: date,
      lastContact: date,
      interactions: n,
    }),
  ),
  goals: z.array(
    z.object({
      id,
      actorId: id,
      definitionId: id,
      target: n.min(1),
      progress: f,
      status: z.enum(["active", "achieved", "paused"]),
      created: date,
      completed: date.nullable(),
    }),
  ),
  households: z.array(
    z.object({
      ...account,
      id,
      name: id,
      adults: z.array(id),
      children: z.array(id),
      homeId: id,
      claims: z.record(id, signed),
      contribution: z.record(id, n),
      paid: z.record(id, z.string().regex(/^\d{4}-\d{2}$/)),
    }),
  ),
  lastWorldEvent: n,
  today: z.object({
    date,
    npcHours: z.record(id, f.max(24)),
    playerCosts: n,
    npcProcessed: z.boolean(),
  }),
  policy: z.object({ npcRelationships: z.boolean(), npcFamily: z.boolean() }),
  stats: z.object({
    conversations: n,
    friendships: n,
    partnerships: n,
    marriages: n,
    births: n,
    adoptions: n,
  }),
});
export function verifySocial(s: GameState) {
  const x = s.social,
    ids = [s.person.id, ...s.npcs.map((p) => p.id)],
    unique = (v: string[]) => new Set(v).size === v.length,
    has = (id: string) => ids.includes(id);
  if (
    !unique(x.profiles.map((p) => p.id)) ||
    !unique(x.bonds.map((b) => b.id)) ||
    !unique(x.goals.map((g) => g.id)) ||
    !unique(x.households.map((h) => h.id)) ||
    x.profiles.length !== ids.length ||
    !verifyHouseholds(s)
  )
    return false;
  const members = x.households.flatMap((h) => [...h.adults, ...h.children]);
  if (!unique(members) || members.length !== ids.length) return false;
  for (const p of x.profiles) {
    const h = x.households.find((h) => h.id === p.householdId);
    if (
      !has(p.id) ||
      !h ||
      !members.includes(p.id) ||
      !unique(p.parents) ||
      !unique(p.children) ||
      p.parents.includes(p.id) ||
      p.children.includes(p.id) ||
      actor(s, p.id).birthDate > s.date ||
      p.lastFamilyDate > s.date
    )
      return false;
    if (
      p.partnerId &&
      (!has(p.partnerId) ||
        profile(s, p.partnerId)?.partnerId !== p.id ||
        !x.bonds.some(
          (b) =>
            (b.a === p.id || b.b === p.id) &&
            (b.a === p.partnerId || b.b === p.partnerId) &&
            ["dating", "married"].includes(b.status),
        ))
    )
      return false;
    if (
      p.parents.some(
        (id) => !has(id) || !profile(s, id).children.includes(p.id),
      ) ||
      p.children.some(
        (id) => !has(id) || !profile(s, id).parents.includes(p.id),
      )
    )
      return false;
    if (
      [...p.timeline, ...p.memories].some(
        (e) => e.date > s.date || e.id > s.sequence,
      )
    )
      return false;
    if (!unique(p.timeline.map((e) => String(e.id)))) return false;
  }
  for (const h of x.households) {
    if (
      h.adults.some((id) => h.claims[id] === undefined) ||
      Object.entries(h.claims).some(
        ([id, n]) => !h.adults.includes(id) && n !== 0,
      )
    )
      return false;
    if (
      !properties.some((p) => p.id === h.homeId && p.kind === "home") ||
      !unique([...h.adults, ...h.children]) ||
      (!h.adults.length &&
        (h.children.length || Object.values(h.book).some((n) => n !== 0))) ||
      Object.keys(h.claims).some((id) => !has(id)) ||
      Object.keys(h.contribution).some((id) => !h.adults.includes(id))
    )
      return false;
    if (
      h.adults.some((id) => age(actor(s, id), s.date) < 18) ||
      h.children.some((id) => !has(id))
    )
      return false;
    if (h.adults.includes("player") && h.homeId !== s.spatial.homePropertyId)
      return false;
    if (
      [...h.adults, ...h.children].some((id) =>
        s.simulation.residents.some(
          (r) => r.id === id && r.homeId !== h.homeId,
        ),
      )
    )
      return false;
  }
  for (const b of x.bonds) {
    if (
      !has(b.a) ||
      !has(b.b) ||
      b.a >= b.b ||
      b.id !== bondId(b.a, b.b) ||
      b.met > s.date ||
      b.since > s.date ||
      b.lastContact > s.date
    )
      return false;
    if (
      ["dating", "married"].includes(b.status) &&
      (profile(s, b.a).partnerId !== b.b ||
        profile(s, b.b).partnerId !== b.a ||
        areKin(s, b.a, b.b) ||
        age(actor(s, b.a), s.date) < 18 ||
        age(actor(s, b.b), s.date) < 18)
    )
      return false;
  }
  if (
    !unique(
      x.goals
        .filter((g) => g.status === "active")
        .map((g) => g.actorId + "::" + g.definitionId),
    )
  )
    return false;
  if (
    x.goals.some(
      (g) =>
        !has(g.actorId) ||
        !goalRegistry.has(g.definitionId) ||
        g.created > s.date ||
        (g.completed !== null &&
          (g.completed > s.date || g.status !== "achieved")) ||
        (g.status === "achieved" && (!g.completed || g.progress < g.target)),
    )
  )
    return false;
  if (
    x.today.date > s.date ||
    Object.keys(x.today.npcHours).some(
      (id) => !s.simulation.residents.some((r) => r.id === id),
    )
  )
    return false;
  if (x.today.date === s.date && !x.today.npcProcessed)
    for (const [id, hours] of Object.entries(x.today.npcHours)) {
      const r = s.simulation.residents.find((r) => r.id === id)!;
      if (
        hours + careHours(s, id) + npcScheduledLoad(s, id, r.homeId, true) >
        14
      )
        return false;
    }
  // Acyclic kinship; child/parent links alone do not exclude a longer loop.
  const walk = (id: string, path: Set<string>): boolean => {
    if (path.has(id)) return false;
    const next = new Set(path);
    next.add(id);
    return profile(s, id).parents.every((p) => walk(p, next));
  };
  return (
    ids.every((id) => walk(id, new Set())) &&
    x.households.every((h) => h.journal.every((e) => e.id <= s.sequence))
  );
}
