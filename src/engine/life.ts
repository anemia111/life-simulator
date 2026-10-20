import type { GameState } from "./types";
import { pay } from "./finance";
import { dayOfMonth } from "./time";
export const housing = [
  {
    id: "share",
    name: "シェアハウス",
    rent: 24000,
    daily: 700,
    utilities: 4500,
    recovery: 22,
    description: "小さな個室と、ほどよい距離感。",
  },
  {
    id: "studio",
    name: "ワンルーム",
    rent: 45000,
    daily: 900,
    utilities: 6500,
    recovery: 28,
    description: "自分だけの空間で、しっかり休む。",
  },
  {
    id: "suburb",
    name: "郊外アパート",
    rent: 32000,
    daily: 800,
    utilities: 5500,
    recovery: 25,
    description: "静かな暮らしと、手頃な家賃。",
  },
];
export const standards = {
  frugal: { name: "節約", factor: 0.7, satisfaction: -0.25 },
  balanced: { name: "標準", factor: 1, satisfaction: 0.15 },
  comfortable: { name: "ゆとり", factor: 1.5, satisfaction: 0.5 },
};
export const home = (s: GameState) =>
  housing.find((h) => h.id === s.housingId)!;
export const energyLimit = (s: GameState) => 100 - s.person.sleepDebt * 0.8;
export function sleepAndRecover(s: GameState) {
  const hours = s.routine.sleepHours;
  s.person.sleepDebt = Math.max(
    0,
    Math.min(
      48,
      s.person.sleepDebt + (hours < 7 ? 7 - hours : -(hours - 7) * 2),
    ),
  );
  s.person.energy = Math.min(
    energyLimit(s),
    s.person.energy + hours * 5 + home(s).recovery * 0.3,
  );
  s.person.health = Math.max(
    5,
    Math.min(100, s.person.health + (hours < 6 ? -1 : hours >= 7 ? 0.25 : 0)),
  );
  s.person.satisfaction = Math.max(
    0,
    Math.min(100, s.person.satisfaction + (hours < 6 ? -0.6 : 0.1)),
  );
}
export function livingExpenses(s: GameState) {
  const h = home(s),
    level = standards[s.livingStandard],
    day = dayOfMonth(s.date);
  let cost = 0;
  const charge = (amount: number, label: string) => {
    const v = Math.round(amount * s.world.costIndex);
    pay(s, v, label);
    cost += v;
  };
  charge(h.daily * level.factor, "食費・日用品（" + level.name + "）");
  if (day === 1 && s.date !== s.started) charge(h.rent, h.name + " 家賃");
  if (day === 10) charge(h.utilities, "光熱費");
  if (day === 15) charge(2500, "通信費");
  s.totals.living += cost;
  s.person.satisfaction = Math.max(
    0,
    Math.min(
      100,
      s.person.satisfaction + level.satisfaction - (s.debt > s.loan ? 0.3 : 0),
    ),
  );
  if (s.person.energy < 15)
    s.person.health = Math.max(5, s.person.health - 0.5);
  return cost;
}
export function moveHome(s: GameState, id: string) {
  const h = housing.find((h) => h.id === id);
  if (!h) throw Error("住居が不正です");
  if (h.id === s.housingId) return;
  const cost = Math.round(
    Math.max(0, h.rent - home(s).rent) * s.world.costIndex,
  );
  if (s.cash + s.bank < cost) throw Error("住み替え資金が足りません");
  pay(s, cost, "住み替え差額");
  s.totals.living += cost;
  s.housingId = id;
}
