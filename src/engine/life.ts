import type { GameState } from "./types";
import { pay } from "./finance";
import { dayOfMonth } from "./time";
export const housing = [
  {
    id: "share",
    name: "シェアハウス",
    rent: 24000,
    daily: 700,
    recovery: 22,
    description: "小さな個室と、ほどよい距離感。",
  },
  {
    id: "studio",
    name: "ワンルーム",
    rent: 45000,
    daily: 900,
    recovery: 28,
    description: "自分だけの空間で、しっかり休む。",
  },
  {
    id: "suburb",
    name: "郊外アパート",
    rent: 32000,
    daily: 800,
    recovery: 25,
    description: "静かな暮らしと、手頃な家賃。",
  },
];
export const home = (s: GameState) =>
  housing.find((h) => h.id === s.housingId)!;
export function dailyLife(s: GameState, worked: number) {
  const h = home(s);
  s.person.energy = Math.min(100, s.person.energy + h.recovery);
  if (s.action === "rest") {
    s.person.energy = Math.min(100, s.person.energy + 20);
    s.person.health = Math.min(100, s.person.health + 1);
  } else if (s.action !== "business") {
    const hours = worked ? 2 : 5;
    s.person.skills[s.action] = Math.min(
      100,
      s.person.skills[s.action] + hours * 0.18,
    );
    s.person.energy = Math.max(0, s.person.energy - hours * 2);
  }
  if (s.person.energy < 15) s.person.health = Math.max(10, s.person.health - 1);
  return s.action === "business"
    ? Math.min(worked ? 2 : 6, Math.floor(s.person.energy / 2))
    : 0;
}
export function livingExpenses(s: GameState) {
  const h = home(s);
  let cost = h.daily;
  pay(s, h.daily, "食費・日用品");
  if (dayOfMonth(s.date) === 1 && s.date !== s.started) {
    cost += h.rent;
    pay(s, h.rent, h.name + " 家賃");
  }
  s.totals.living += cost;
  return cost;
}
