import { jobs, makeContract } from "../career";
import { assertSchedule } from "../schedule";
import { jobOffer } from "./selectors";
import type { GameState } from "../types";
import type { Enterprise } from "../enterprise/types";
import { industryModules } from "../enterprise/registry";
import { demandFor } from "../enterprise/market";
import {
  locationEffect,
  property,
  homeProperty,
  route,
  tenant,
  allowed,
} from "./selectors";
export function compareSite(s: GameState, v: Enterprise, id: string) {
  const m = industryModules.get(v.industry)!;
  const p = property(id);
  if (tenant(s, p) || !allowed(p, v.industry))
    throw Error("入居可能な事業物件を選択してください");
  const projected = {
    ...s,
    spatial: {
      ...s.spatial,
      leases: [
        ...s.spatial.leases,
        {
          propertyId: id,
          tenantId: v.id,
          started: s.date,
          rent: p.monthlyRent,
          paidMonth: s.date.slice(0, 7),
        },
      ],
    },
  };
  return {
    before: demandFor(s, v, m),
    after: demandFor(projected, v, m),
    current: locationEffect(s, v, m.siteProfile),
    proposed: locationEffect(projected, v, m.siteProfile),
    trip: route(homeProperty(s), p),
  };
}

export function planMove(s: GameState, id: string) {
  const p = property(id),
    old = homeProperty(s);
  if (p.kind !== "home") throw Error("住居を選択してください");
  const projected = { ...s, spatial: { ...s.spatial, homePropertyId: id } };
  const contracts = s.employments.map((e) => ({
    ...e,
    commute: jobOffer(
      projected,
      jobs.find((j) => j.id === e.jobId)!,
    ).commute,
  }));
  let reason = "";
  try {
    assertSchedule(s, contracts);
  } catch (e) {
    reason = (e as Error).message;
  }
  const currentRent =
    s.spatial.leases.find((l) => l.propertyId === old.id)?.rent ??
    old.monthlyRent;
  return {
    contracts,
    cost:
      Math.max(0, p.monthlyRent - currentRent) +
      (p.districtId === old.districtId ? 0 : 5000),
    reason,
  };
}
export function jobScheduleReason(s: GameState, id: string) {
  if (s.employments.some((e) => e.jobId === id)) return "";
  try {
    assertSchedule(s, [...s.employments, makeContract(structuredClone(s), id)]);
    return "";
  } catch (e) {
    return (e as Error).message;
  }
}
