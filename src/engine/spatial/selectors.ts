import type { GameState, Job } from "../types";
import type { Enterprise } from "../enterprise/types";
import type { Property, PropertyKind } from "./types";
import { cities, districts, properties } from "./catalog";
export { cities, districts, properties };
export const property = (id: string) => {
  const p = properties.find((p) => p.id === id);
  if (!p) throw Error("物件が見つかりません");
  return p;
};
export const district = (id: string) => {
  const d = districts.find((d) => d.id === id);
  if (!d) throw Error("地区が見つかりません");
  return d;
};
export const homeProperty = (s: GameState) =>
  property(s.spatial.homePropertyId);
export const tenant = (s: GameState, p: Property) =>
  s.spatial.leases.find((l) => l.propertyId === p.id)?.tenantId ?? p.tenantId;
export function route(from: Property, to: Property) {
  const distance = Math.hypot(from.x - to.x, from.y - to.y),
    minutes =
      distance < 0.8
        ? Math.ceil((distance / 4) * 60)
        : Math.ceil(5 + (distance / 18) * 60),
    hours = Math.max(0.5, Math.ceil(minutes / 30) * 0.5),
    fare = distance < 0.8 ? 0 : Math.round((100 + distance * 25) / 10) * 10;
  return { distance, minutes, hours, fare };
}
export function jobProperty(j: Job) {
  return property("work-" + j.id);
}
export function jobOffer(s: GameState, j: Job) {
  const destination = jobProperty(j),
    d = district(destination.districtId),
    r = route(homeProperty(s), destination),
    base = route(property("campus-share"), destination);
  return {
    ...j,
    location: cities.find((c) => c.id === d.cityId)!.name + " " + d.name,
    commute: r.hours,
    fare: Math.max(
      0,
      j.fare + Math.round(((r.distance - base.distance) * 35) / 10) * 10,
    ),
  };
}
export const businessProperties = (s: GameState, v: Enterprise) =>
  s.spatial.leases
    .filter((l) => l.tenantId === v.id)
    .map((l) => property(l.propertyId));
export function allowed(p: Property, industry: string) {
  return (
    ["shop", "office", "warehouse"].includes(p.kind) &&
    (p.allowedIndustries.includes("*") ||
      p.allowedIndustries.includes(industry))
  );
}
export interface SiteEffect {
  market: number;
  productivity: number;
  storage: number;
}
export const propertyEffects = new Map<
  PropertyKind,
  (p: Property) => SiteEffect
>([
  [
    "shop",
    (p) => ({
      market: p.visibility / 65,
      productivity: Math.sqrt(p.area / 40),
      storage: 1,
    }),
  ],
  [
    "office",
    (p) => ({
      market: 0.85,
      productivity: 1.15 * Math.sqrt(p.area / 30),
      storage: 1,
    }),
  ],
  [
    "warehouse",
    (p) => ({
      market: 0.6,
      productivity: 1,
      storage: 1 + Math.log1p(p.area / 100),
    }),
  ],
]);
export function locationEffect(
  s: GameState,
  v: Enterprise,
  profile = { locality: 0.5, storage: false },
) {
  const { locality } = profile;
  const offices = s.spatial.leases.filter(
    (l) => l.tenantId === v.ownerId && property(l.propertyId).kind === "office",
  );
  const managementSupport = offices.reduce(
    (n, l) => n + property(l.propertyId).area / 150,
    0,
  );
  const officeEfficiency = 1 + Math.log1p(managementSupport) * 0.1;
  const sites = businessProperties(s, v);
  if (!sites.length)
    return {
      market: 1,
      income: 1,
      competition: 1,
      productivity: officeEfficiency,
      managementSupport,
      districtId: null as string | null,
    };
  let market = 0,
    income = 0,
    competition = 0,
    productivity = 0;
  for (const p of sites) {
    const d = district(p.districtId),
      effect = propertyEffects.get(p.kind)?.(p) ?? {
        market: 1,
        productivity: 1,
        storage: 1,
      };
    const rivals = properties
      .filter((q) => q.kind === "competitor" && q.industry === v.industry)
      .reduce((n, q) => n + 1 / (1 + Math.hypot(q.x - p.x, q.y - p.y)), 0);
    const segment =
      (d.demand[v.industry] ?? 1) *
      (d.footfall / 650) *
      (1 + ((d.brandFit - 1) * v.brand) / (10 + v.brand));
    market +=
      1 -
      locality +
      locality * segment * effect.market * (0.7 + p.condition / 250);
    income += 1 + (d.incomeIndex - 1) * locality;
    competition += 1 + locality * (d.competition * 0.15 + rivals * 0.12);
    productivity +=
      effect.productivity * (profile.storage ? effect.storage : 1);
  }
  return {
    market: market / Math.sqrt(sites.length),
    income: income / sites.length,
    competition: competition / sites.length,
    productivity: (productivity / sites.length) * officeEfficiency,
    managementSupport,
    districtId: sites[0].districtId,
  };
}
export function businessTrip(s: GameState, v: Enterprise, hours: number) {
  const site = businessProperties(s, v)[0];
  if (!site) return { hours: 0, fare: 0 };
  const r = route(homeProperty(s), site);
  if (hours < r.hours * 2 + 0.5) return { hours: 0, fare: 0 };
  return { hours: r.hours * 2, fare: r.fare * 2 };
}
