import type { GameState } from "../types";
import { properties } from "../spatial/catalog";
import { jobs } from "../career";
import { route } from "../spatial/selectors";
import { weekday } from "../time";
import { age } from "../person";
export const actor = (s: GameState, id: string) =>
  id === "player" ? s.person : s.npcs.find((p) => p.id === id)!;
export const profile = (s: GameState, id: string) =>
  s.social.profiles.find((p) => p.id === id)!;
export const household = (s: GameState, id: string) =>
  s.social.households.find((h) => h.id === profile(s, id)?.householdId)!;
export const householdClaim = (s: GameState, id = "player") =>
  s.social?.households.reduce((n, h) => n + (h.claims[id] ?? 0), 0) ?? 0;
export const bondId = (a: string, b: string) => [a, b].sort().join("::");
export const bondFor = (s: GameState, a: string, b: string) =>
  s.social.bonds.find((x) => x.id === bondId(a, b));
export const careHours = (s: GameState, id: string) => {
  const h = s.social && household(s, id);
  if (!h) return 0;
  const units = h.children.filter((c) => age(actor(s, c), s.date) < 18).length;
  const index = [...h.adults].sort().indexOf(id);
  if (index < 0) return 0;
  return (
    Math.floor(units / h.adults.length) * 0.5 +
    (index < units % h.adults.length ? 0.5 : 0)
  );
};
export function npcFree(s: GameState, id: string) {
  const r = s.simulation.residents.find((r) => r.id === id);
  if (!r) return 0;
  const j = jobs.find((j) => j.id === r.jobId);
  let work = 0,
    commute = 0;
  const home = properties.find((p) => p.id === r.homeId)!;
  if (j && j.weekdays.includes(weekday(s.date))) {
    work = j.hours;
    commute =
      route(
        home,
        properties.find((p) => p.id === "work-" + j.id)!,
      ).hours * 2;
  }
  const e = s.ventures
    .flatMap((v) => v.employees)
    .find((e) => e.active && e.npcId === id);
  if (e && ![0, 6].includes(weekday(s.date))) {
    work = e.hours;
    const v = s.ventures.find((v) => v.employees.includes(e))!;
    const l = s.spatial.leases.find((l) => l.tenantId === v.id);
    commute = l
      ? route(
          home,
          properties.find((p) => p.id === l.propertyId)!,
        ).hours * 2
      : 0;
  }
  const business = s.simulation.firms.some(
    (f) => f.status === "active" && f.ownerId === id,
  )
    ? 4
    : 0;
  const reserved =
    s.social.today.date === s.date ? (s.social.today.npcHours[id] ?? 0) : 0;
  return Math.max(
    0,
    24 -
      8 -
      2 -
      work -
      commute -
      Math.min(business, Math.max(0, 12 - work - commute)) -
      2 -
      careHours(s, id) -
      reserved,
  );
}
export function compatibility(s: GameState, a: string, b: string) {
  const x = profile(s, a),
    y = profile(s, b);
  return Math.round(
    100 -
      Object.keys(x.values).reduce(
        (n, k) =>
          n +
          Math.abs(
            x.values[k as keyof typeof x.values] -
              y.values[k as keyof typeof y.values],
          ),
        0,
      ) /
        4,
  );
}
export const statusNames = {
  acquaintance: "知人",
  friend: "友人",
  close: "親友",
  dating: "交際中",
  married: "配偶者",
  estranged: "距離を置く",
};

export function npcScheduledLoad(
  s: GameState,
  id: string,
  homeId: string,
  scheduledOnly = false,
) {
  const r = s.simulation.residents.find((r) => r.id === id);
  if (!r) return 0;
  const home = properties.find((p) => p.id === homeId)!;
  const job = jobs.find((j) => j.id === r.jobId);
  let load =
    job && (!scheduledOnly || job.weekdays.includes(weekday(s.date)))
      ? job.hours +
        route(
          home,
          properties.find((p) => p.id === "work-" + job.id)!,
        ).hours *
          2
      : 0;
  for (const v of s.ventures) {
    const e = v.employees.find((e) => e.active && e.npcId === id);
    if (e && (!scheduledOnly || ![0, 6].includes(weekday(s.date)))) {
      const lease = s.spatial.leases.find((l) => l.tenantId === v.id);
      load = Math.max(
        load,
        e.hours +
          (lease
            ? route(
                home,
                properties.find((p) => p.id === lease.propertyId)!,
              ).hours * 2
            : 0),
      );
    }
  }
  return load;
}

export function areKin(s: GameState, a: string, b: string) {
  const ancestors = (id: string) => {
    const found = new Set<string>(),
      queue = [...(profile(s, id)?.parents ?? [])];
    while (queue.length) {
      const next = queue.pop()!;
      if (found.has(next)) continue;
      found.add(next);
      queue.push(...(profile(s, next)?.parents ?? []));
    }
    return found;
  };
  const x = ancestors(a),
    y = ancestors(b);
  return x.has(b) || y.has(a) || [...x].some((id) => y.has(id));
}
