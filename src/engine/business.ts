import type { GameState } from "./types";
import { pay, receive, requireCash } from "./finance";
import { addEquipment, upgradeEquipment } from "./ownership";
import { calculateMarket } from "./market";
import { industries } from "./industries";
export { industries } from "./industries";
export const emptyBusinessDay = () => ({
  demand: 0,
  capacity: 0,
  units: 0,
  revenue: 0,
  costs: 0,
  profit: 0,
});
export function openBusiness(s: GameState, id: string) {
  if (s.business) throw Error("既存事業の廃業後に開業できます");
  const i = industries.find((i) => i.id === id);
  if (!i) throw Error("業種が見つかりません");
  requireCash(s, i.setup);
  pay(s, i.setup, i.name + " 開業設備");
  s.organizations.push({
    id: "player-business",
    name: i.name,
    kind: "sole-trader",
    ownerId: "player",
  });
  addEquipment(s, i.product + "設備", i.setup);
  s.business = {
    industryId: id,
    price: i.basePrice,
    level: 1,
    active: true,
    revenue: 0,
    costs: 0,
    units: 0,
    last: emptyBusinessDay(),
  };
  s.action = "business";
  s.notices.unshift(i.name + "を開業しました");
}
export const investmentCost = (s: GameState) =>
  s.business ? 15000 * s.business.level : 0;
export function invest(s: GameState) {
  if (!s.business) throw Error("先に開業してください");
  const cost = investmentCost(s);
  requireCash(s, cost);
  pay(s, cost, "設備への再投資");
  s.business.level++;
  upgradeEquipment(s, cost);
}
export function operateBusiness(s: GameState, hours: number) {
  const b = s.business;
  if (!b) return emptyBusinessDay();
  const i = industries.find((i) => i.id === b.industryId)!;
  b.last = emptyBusinessDay();
  if (!b.active || !hours) return b.last;
  const market = calculateMarket(s, i, hours);
  const costs = market.units * i.unitCost + i.fixedCost;
  pay(s, costs, "事業：材料費・運営費");
  const revenue = market.units * b.price;
  receive(s, revenue, "事業：" + i.product + " 売上");
  b.last = { ...market, revenue, costs, profit: revenue - costs };
  b.units += market.units;
  b.revenue += revenue;
  b.costs += costs;
  s.totals.revenue += revenue;
  s.totals.businessProfit += revenue - costs;
  s.person.energy = Math.max(0, s.person.energy - hours * 2);
  s.person.skills[i.skill] = Math.min(
    100,
    s.person.skills[i.skill] + hours * 0.1,
  );
  return b.last;
}
