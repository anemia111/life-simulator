import { planMove } from "./preview";
import type { GameState } from "../types";
import { pay, requireCash } from "../finance";
import { spend } from "../enterprise/accounting";
import {
  property,
  homeProperty,
  district,
  tenant,
  jobOffer,
  route,
  allowed,
} from "./selectors";
export function moveToProperty(s: GameState, id: string) {
  const p = property(id),
    old = homeProperty(s);
  if (p.kind !== "home" || !p.homeStyle) throw Error("住居を選択してください");
  if (id === old.id) return;
  if (tenant(s, p)) throw Error("入居中の物件は選べません");
  if (district(p.districtId).cityId !== s.spatial.cityId)
    throw Error("他都市への移住は未実装です");
  const { contracts, cost, reason } = planMove(s, id);
  if (reason) throw Error(reason);
  requireCash(s, cost);
  pay(s, cost, "引越し・当月家賃差額");
  s.totals.living += cost;
  s.spatial.leases = s.spatial.leases.filter((l) => l.tenantId !== "player");
  s.spatial.leases.push({
    propertyId: id,
    tenantId: "player",
    started: s.date,
    rent: p.monthlyRent,
    paidMonth: s.date.slice(0, 7),
  });
  s.spatial.homePropertyId = id;
  s.housingId = p.homeStyle;
  s.employments = contracts;
  s.employment = contracts[0] ?? null;
  s.notices.unshift(p.name + "へ引っ越しました");
}
export function leaseProperty(s: GameState, id: string, entityId: string) {
  const p = property(id);
  if (tenant(s, p)) throw Error("この物件は入居中です");
  const v = s.ventures.find((v) => v.id === entityId && v.status !== "closed"),
    c = s.companies.find((c) => c.id === entityId && c.status === "active");
  if (!v && !c) throw Error("入居する事業・会社を選んでください");
  if (v && !allowed(p, v.industry))
    throw Error("この用途・物件では事業を営業できません");
  if (c && p.kind !== "office")
    throw Error("会社の本店はオフィス物件を選んでください");
  if (district(p.districtId).cityId !== s.spatial.cityId)
    throw Error("他都市への進出は未実装です");
  const a = v ?? c!;
  if (a.book.debt || !spend(s, a, p.monthlyRent, "物件の当月賃料：" + p.name))
    throw Error(
      "入居資金が不足しています。事業・会社口座へ資金を用意してください",
    );
  s.spatial.leases.push({
    propertyId: id,
    tenantId: entityId,
    started: s.date,
    rent: p.monthlyRent,
    paidMonth: s.date.slice(0, 7),
  });
  if (c) c.region = district(p.districtId).name;
  s.notices.unshift(p.name + "を借りました");
}
export function releaseProperty(s: GameState, id: string) {
  const l = s.spatial.leases.find(
    (l) => l.propertyId === id && l.tenantId !== "player",
  );
  if (!l) throw Error("解約できる事業物件がありません");
  s.spatial.leases = s.spatial.leases.filter((l) => l.propertyId !== id);
}
export function releaseSites(s: GameState, entityId: string) {
  s.spatial.leases = s.spatial.leases.filter((l) => l.tenantId !== entityId);
}
export function locationRents(s: GameState) {
  for (const l of s.spatial.leases.filter((l) => l.tenantId !== "player"))
    if (l.paidMonth !== s.date.slice(0, 7)) {
      const a =
        s.ventures.find((v) => v.id === l.tenantId) ??
        s.companies.find((c) => c.id === l.tenantId);
      if (!a) throw Error("物件契約の所有者が不正です");
      spend(s, a, l.rent, "月額賃料：" + property(l.propertyId).name, true);
      l.paidMonth = s.date.slice(0, 7);
    }
}
export function visitFacility(s: GameState, id: string) {
  const p = property(id);
  if (p.kind !== "facility") throw Error("施設を選択してください");
  const trip = route(homeProperty(s), p),
    fee = p.facility === "library" ? 200 : 0;
  requireCash(s, fee + trip.fare * 2);
  pay(s, fee + trip.fare * 2, "施設利用・交通費：" + p.name);
  s.totals.living += fee + trip.fare * 2;
  if (p.facility === "library")
    s.person.skills.digital = Math.min(100, s.person.skills.digital + 0.5);
  else {
    s.person.health = Math.min(100, s.person.health + 0.8);
    s.person.energy = Math.min(
      100 - s.person.sleepDebt * 0.8,
      s.person.energy + 4,
    );
  }
  s.person.satisfaction = Math.min(
    100,
    s.person.satisfaction + district(p.districtId).safety / 20,
  );
}
