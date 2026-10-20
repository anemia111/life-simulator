import { worldIndustries } from "./models";
import type { GameState } from "../types";
import type { Enterprise, IndustryModule } from "../enterprise/types";
import type { MarketSnapshot } from "./types";
import { properties, districts } from "../spatial/catalog";
import { industryModules } from "../enterprise/registry";
export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const districtState = (s: GameState, id: string) =>
  s.simulation.districts.find((d) => d.id === id)!;
export const quotedRent = (
  s: GameState,
  p: { monthlyRent: number; districtId: string },
) => Math.round(p.monthlyRent * districtState(s, p.districtId).rent);
export function allocateMarket(
  s: GameState,
  m: IndustryModule,
  override?: Enterprise,
): MarketSnapshot {
  const customers = s.simulation.districts;
  const pool = Math.max(
    0,
    Math.floor(
      m.market *
        (worldIndustries.get(m.id)?.demandScale ?? 1) *
        (s.world.population / 120000) *
        s.world.economy *
        (s.simulation.income / 320000),
    ),
  );
  const offers: {
    id: string;
    price: number;
    quality: number;
    brand: number;
    ad: number;
    sites: string[];
    region: string;
  }[] = [];
  for (const f of s.simulation.firms.filter(
    (f) => f.status === "active" && f.industry === m.id,
  ))
    offers.push({
      id: f.id,
      price: f.price,
      quality: f.quality,
      brand: f.brand,
      ad: f.book.cash > f.advertising ? f.advertising : 0,
      sites: f.sites,
      region: "central",
    });
  for (const original of s.ventures.filter(
    (v) => v.status === "active" && v.industry === m.id,
  )) {
    const v = override?.id === original.id ? override : original;
    offers.push({
      id: v.id,
      price: v.price,
      quality: v.quality,
      brand: v.brand,
      ad: v.book.cash > v.advertising ? v.advertising : 0,
      sites: s.spatial.leases
        .filter((l) => l.tenantId === v.id)
        .map((l) => l.propertyId),
      region: v.region,
    });
  }
  const weights = offers.map((o) => {
    const sites = o.sites
      .map((id) => properties.find((p) => p.id === id)!)
      .filter(Boolean);
    const locality = m.siteProfile?.locality ?? 0.5;
    let reach = 0;
    for (const c of customers) {
      const d = districts.find((d) => d.id === c.id)!;
      const nearby = sites.length
        ? sites.reduce(
            (n, p) =>
              n +
              ((p.visibility / 65) *
                (1 + ((d.brandFit - 1) * o.brand) / (10 + o.brand))) /
                (1 + Math.hypot(p.x - d.x, p.y - d.y) * locality * 0.12),
            0,
          ) / Math.sqrt(sites.length)
        : o.region === "online"
          ? 1
          : 0.85;
      const sensitivity =
        1.2 + c.ageShares.young * 0.8 + c.ageShares.senior * 0.2;
      const affinity = worldIndustries.get(m.id)?.ageAffinity ?? {
        young: 1,
        working: 1,
        senior: 1,
      };
      const ageFit =
        c.ageShares.young * affinity.young +
        c.ageShares.working * affinity.working +
        c.ageShares.senior * affinity.senior;
      reach +=
        (c.population / s.world.population) *
        ageFit *
        c.demand *
        (d.demand[m.id] ?? 1) *
        (1 - locality + locality * nearby) *
        Math.pow((m.basePrice * c.income) / 320000 / o.price, sensitivity);
    }
    const location = sites.length
      ? sites.reduce((n, p) => {
          const d = districts.find((d) => d.id === p.districtId)!;
          return (
            n + (d.footfall / 650) * (d.demand[m.id] ?? 1) * (p.visibility / 65)
          );
        }, 0) / sites.length
      : 1;
    return Math.max(
      0,
      reach *
        (1 - locality + locality * location) *
        (0.5 + o.quality / 100) *
        (1 + Math.log1p(o.brand) / 4) *
        (1 + Math.log1p(o.ad / 500) / 3),
    );
  });
  // Background suppliers retain a finite outside option; floor rounding leaves unserved customers.
  const denominator =
    weights.reduce((n, w) => n + w, 0) +
    (4 * s.world.competitorQuality) / s.world.competitorPrice;
  return {
    industry: m.id,
    pool,
    allocations: Object.fromEntries(
      offers.map((o, i) => [
        o.id,
        Math.floor((pool * weights[i]) / denominator),
      ]),
    ),
  };
}
export function sharedDemand(s: GameState, v: Enterprise, m: IndustryModule) {
  return allocateMarket(s, m, v).allocations[v.id] ?? 0;
}
export function snapshotMarkets(s: GameState) {
  s.simulation.markets = [...industryModules.values()].map((m) =>
    allocateMarket(s, m),
  );
}
export const effectiveJobWage = (
  s: GameState,
  j: { employerId: string; wage: number },
) =>
  Math.round(
    j.wage *
      (s.simulation.firms.find((f) => f.id === j.employerId)?.wageIndex ?? 1) *
      (s.simulation.districts.find(
        (d) =>
          d.id ===
          properties.find((p) => p.id === "work-" + ("id" in j ? j.id : ""))
            ?.districtId,
      )?.wage ?? 1),
  );
