import type { PropertyKind } from "../spatial/types";
/** Register one model alongside each industry to enable AI supply and finite city demand. */
export interface WorldIndustryModel {
  id: string;
  demandScale: number;
  unitCostRatio: number;
  workHoursPerUnit: number;
  carryWork: boolean;
  siteKinds?: PropertyKind[];
  ageAffinity?: { young: number; working: number; senior: number };
}
export const worldIndustries = new Map<string, WorldIndustryModel>();
export function registerWorldIndustry(m: WorldIndustryModel) {
  if (
    worldIndustries.has(m.id) ||
    m.demandScale <= 0 ||
    m.workHoursPerUnit <= 0 ||
    m.unitCostRatio < 0 ||
    m.unitCostRatio >= 1
  )
    throw Error("世界業界モデルの登録が不正です");
  worldIndustries.set(m.id, m);
}
[
  {
    id: "retail",
    siteKinds: ["shop", "competitor"] as PropertyKind[],
    ageAffinity: { young: 1, working: 1, senior: 0.9 },
    demandScale: 1.6,
    unitCostRatio: 0.42,
    workHoursPerUnit: 0.2,
    carryWork: false,
  },
  {
    id: "freelance",
    siteKinds: ["office"] as PropertyKind[],
    ageAffinity: { young: 0.6, working: 1.2, senior: 0.8 },
    demandScale: 2,
    unitCostRatio: 0.15,
    workHoursPerUnit: 6,
    carryWork: true,
  },
  {
    id: "software",
    siteKinds: ["office"] as PropertyKind[],
    ageAffinity: { young: 1.4, working: 1, senior: 0.5 },
    demandScale: 2,
    unitCostRatio: 0.15,
    workHoursPerUnit: 0.2,
    carryWork: false,
  },
].forEach(registerWorldIndustry);
