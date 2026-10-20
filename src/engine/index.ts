import type { GameState, Command } from "./types";
import { createPerson } from "./person";
import { createWorld } from "./world";
import { pay, netWorth, requireCash } from "./finance";
import { nextDate, validateDays } from "./time";
import { applyJob, quitJob, workDay } from "./career";
import { dailyLife, livingExpenses, housing, home } from "./life";
import { openBusiness, invest, operateBusiness } from "./business";
import { decideCompetitors } from "./ai";
export function newGame(
  name: string,
  condition: "standard" | "challenge" | "comfortable" = "standard",
): GameState {
  const cash = { standard: 50000, challenge: 20000, comfortable: 100000 }[
    condition
  ];
  if (cash === undefined) throw Error("初期条件が不正です");
  const s: GameState = {
    schemaVersion: 1,
    person: createPerson(name),
    npcs: [
      {
        ...createPerson("木村 さとし"),
        id: "npc-cafe",
        birthDate: "1985-06-15",
      },
      { ...createPerson("森 ゆい"), id: "npc-shop", birthDate: "1990-08-20" },
      {
        ...createPerson("石井 あきら"),
        id: "npc-design",
        birthDate: "1988-03-03",
      },
    ],
    date: "2026-04-01",
    started: "2026-04-01",
    days: 0,
    cash,
    debt: 0,
    employment: null,
    business: null,
    organizations: [
      {
        id: "cafe-co",
        name: "喫茶 こもれび",
        kind: "employer",
        ownerId: "npc-cafe",
      },
      {
        id: "shop-co",
        name: "青葉ブックストア",
        kind: "employer",
        ownerId: "npc-shop",
      },
      {
        id: "design-co",
        name: "スタジオ ノート",
        kind: "employer",
        ownerId: "npc-design",
      },
    ],
    assets: [],
    action: "rest",
    housingId: "share",
    ledger: [],
    sequence: 0,
    history: [],
    world: createWorld(),
    totals: { wages: 0, revenue: 0, businessProfit: 0, living: 24000 },
    notices: ["青葉市で、新しい毎日が始まります"],
  };
  pay(s, 24000, "入居月の家賃");
  return s;
}
export function advanceDays(state: GameState, days: number) {
  validateDays(days);
  const s = structuredClone(state);
  for (let d = 0; d < days; d++) {
    decideCompetitors(s);
    const work = workDay(s);
    const hours = dailyLife(s, work.hours);
    const business = operateBusiness(s, hours);
    const spending = livingExpenses(s);
    s.history.push({
      date: s.date,
      cash: s.cash,
      netWorth: netWorth(s),
      earned: work.earned,
      spending,
      sales: business.revenue,
      profit: business.profit,
    });
    s.history = s.history.slice(-365);
    s.days++;
    s.date = nextDate(s.date);
    s.notices = s.notices.slice(0, 12);
  }
  return s;
}
export function dispatch(state: GameState, command: Command): GameState {
  if (command.type === "advance") return advanceDays(state, command.days);
  const s = structuredClone(state);
  switch (command.type) {
    case "apply":
      applyJob(s, command.jobId);
      break;
    case "quit":
      quitJob(s);
      break;
    case "action":
      if (
        !["rest", "service", "craft", "digital", "business"].includes(
          command.action,
        )
      )
        throw Error("行動が不正です");
      s.action = command.action;
      break;
    case "open":
      openBusiness(s, command.industryId);
      break;
    case "invest":
      invest(s);
      break;
    case "price":
      if (!s.business) throw Error("先に開業してください");
      if (
        !Number.isInteger(command.price) ||
        command.price < 100 ||
        command.price > 100000
      )
        throw Error("価格は100〜100,000円の整数です");
      s.business.price = command.price;
      break;
    case "toggle":
      if (s.business) s.business.active = !s.business.active;
      break;
    case "close":
      s.business = null;
      s.assets = s.assets.filter((a) => a.ownerId !== "player-business");
      s.organizations = s.organizations.filter(
        (o) => o.id !== "player-business",
      );
      if (s.action === "business") s.action = "rest";
      break;
    case "housing": {
      const h = housing.find((h) => h.id === command.housingId);
      if (!h) throw Error("住居が不正です");
      if (h.id !== s.housingId) {
        const cost = Math.max(0, h.rent - home(s).rent);
        requireCash(s, cost);
        pay(s, cost, "住み替え差額");
        s.totals.living += cost;
        s.housingId = h.id;
      }
      break;
    }
  }
  s.notices = s.notices.slice(0, 12);
  return s;
}
