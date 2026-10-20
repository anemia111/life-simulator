import { z } from "zod";
import type { GameState } from "../types";
import { cities, districts, properties, property, allowed } from "./selectors";
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const spatialSchema = z.object({
  cityId: z.string(),
  homePropertyId: z.string(),
  leases: z.array(
    z.object({
      propertyId: z.string(),
      tenantId: z.string(),
      started: date,
      rent: z.number().int().nonnegative().max(1e15),
      paidMonth: z.string().regex(/^\d{4}-\d{2}$/),
    }),
  ),
  favorites: z.array(z.string()),
});
export function validateSpatial(s: GameState) {
  const unique = (v: string[]) => new Set(v).size === v.length;
  if (
    !cities.some((c) => c.id === s.spatial.cityId) ||
    !unique(s.spatial.leases.map((l) => l.propertyId)) ||
    !unique(s.spatial.favorites)
  )
    throw Error("地図の都市・契約IDが不正です");
  const home = property(s.spatial.homePropertyId),
    homes = s.spatial.leases.filter((l) => l.tenantId === "player");
  if (
    home.kind !== "home" ||
    home.homeStyle !== s.housingId ||
    homes.length !== 1 ||
    homes[0].propertyId !== home.id
  )
    throw Error("住居と入居契約が一致しません");
  for (const l of s.spatial.leases) {
    const p = property(l.propertyId),
      v = s.ventures.find((v) => v.id === l.tenantId && v.status !== "closed"),
      c = s.companies.find((c) => c.id === l.tenantId && c.status === "active");
    if (
      (p.tenantId &&
        !s.simulation.firms.some(
          (f) => f.id === p.tenantId && f.status === "closed",
        )) ||
      !districts.some(
        (d) => d.id === p.districtId && d.cityId === s.spatial.cityId,
      ) ||
      l.started > s.date ||
      l.paidMonth > s.date.slice(0, 7) ||
      (l.tenantId === "player"
        ? p.kind !== "home"
        : v
          ? !allowed(p, v.industry)
          : c
            ? p.kind !== "office"
            : true)
    )
      throw Error("物件・入居者・用途の参照が不正です");
  }
  if (
    s.spatial.favorites.some(
      (id) => !properties.some((p) => p.id === id && p.kind === "facility"),
    )
  )
    throw Error("日常施設の参照が不正です");
}
