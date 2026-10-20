import { sharedDemand } from "../simulation/market";
import { locationEffect } from "../spatial/selectors";
import type { GameState } from "../types";
import type { Enterprise, IndustryModule } from "./types";
export const regions = {
  central: { name: "中心市街地", market: 1.25, income: 1.15, cost: 1.3 },
  suburb: { name: "郊外", market: 0.8, income: 0.9, cost: 0.8 },
  online: { name: "オンライン", market: 1, income: 1, cost: 1 },
};
export function attraction(v: Enterprise, m: IndustryModule, s: GameState) {
  const r = regions[v.region],
    geo = locationEffect(s, v, m.siteProfile);
  return (
    (Math.pow((m.basePrice * r.income * geo.income) / v.price, 1.4) *
      (0.5 + v.quality / 100) *
      (0.5 + v.rating / 100) *
      (1 + Math.log1p(v.brand) / 4) *
      (1 + Math.log1p(v.advertising / 500) / 3) *
      (1 + Math.log1p(v.channels - 1) / 2)) /
    (s.world.competitorQuality * geo.competition)
  );
}
export function demandFor(s: GameState, v: Enterprise, m: IndustryModule) {
  return sharedDemand(s, v, m);
}
