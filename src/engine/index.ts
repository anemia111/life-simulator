import type { GameState, Command } from "./types";
import { createPerson } from "./person";
import { createWorld } from "./world";
import {
  pay,
  netWorth,
  chargeInterest,
  monthReport,
  balances,
} from "./finance";
import { nextDate, validateDays, weekday } from "./time";
import { jobs, syncEmployment } from "./career";
import {
  sleepAndRecover,
  energyLimit,
  livingExpenses,
  standards,
} from "./life";
import { decideCompetitors } from "./ai";
import {
  assertSchedule,
  buildDayPlan,
  validateShift,
  isShiftDay,
} from "./schedule";
import { actionRegistry, executeAction, actionUnavailable } from "./actions";
import { emptyBusinessDay } from "./business";
export function newGame(
  name: string,
  condition: "standard" | "challenge" | "comfortable" = "standard",
): GameState {
  const cash = { standard: 50000, challenge: 20000, comfortable: 100000 }[
    condition
  ];
  if (cash === undefined) throw Error("初期条件が不正です");
  const names = [
    "木村 さとし",
    "森 ゆい",
    "石井 あきら",
    "小林 なつ",
    "山田 まこと",
    "高橋 ひかり",
    "佐藤 たくみ",
    "中村 みお",
  ];
  const npcs = jobs.map((j, n) => ({
    ...createPerson(names[n]),
    id: "npc-" + j.id,
    birthDate: 1985 + n + "-06-15",
    occupation: j.name + " / 店長",
    employerId: j.employerId,
    personality: (["steady", "outgoing", "curious"] as const)[n % 3],
    skills: { service: 40 + n, craft: 35 + n, digital: 30 + n },
  }));
  const s: GameState = {
    schemaVersion: 2,
    person: createPerson(name),
    npcs,
    date: "2026-04-01",
    started: "2026-04-01",
    days: 0,
    cash,
    bank: 0,
    debt: 0,
    loan: 0,
    employments: [],
    employment: null,
    careerHistory: [],
    applications: [],
    relationships: [],
    vacancies: jobs.map((j) => ({
      jobId: j.id,
      employerId: j.employerId,
      openings: 2,
      competition: j.competition,
      threshold: j.threshold,
    })),
    business: null,
    organizations: jobs.map((j) => ({
      id: j.employerId,
      name: j.company,
      kind: "employer",
      ownerId: "npc-" + j.id,
      cash: 500000,
      dailyRevenue: 20000,
      dailyCost: 12500,
    })),
    assets: [],
    action: "rest",
    routine: {
      sleepHours: 8,
      activityHours: 2,
      weekendHours: 6,
      weekdayAction: "rest",
      weekendAction: "rest",
      socialTarget: null,
    },
    manualActions: [],
    housingId: "share",
    livingStandard: "balanced",
    ledger: [],
    checkpoint: { cash, bank: 0, debt: 0 },
    reports: [],
    sequence: 0,
    history: [],
    world: createWorld(),
    totals: { wages: 0, revenue: 0, businessProfit: 0, living: 24000 },
    notices: ["青葉市で、新しい毎日が始まります"],
  };
  pay(s, 24000, "入居月の家賃");
  return s;
}
function companyDay(s: GameState) {
  for (const o of s.organizations.filter((o) => o.kind === "employer"))
    o.cash += Math.round(o.dailyRevenue * s.world.economy) - o.dailyCost;
  for (const v of s.vacancies) {
    const j = jobs.find((j) => j.id === v.jobId)!,
      o = s.organizations.find((o) => o.id === v.employerId)!;
    v.openings =
      o.cash < 0
        ? 0
        : Math.max(0, 2 - s.employments.filter((e) => e.jobId === j.id).length);
    v.competition = Math.round((j.competition / s.world.economy) * 100) / 100;
    v.threshold = j.threshold + (o.cash < 100000 ? 3 : 0);
  }
}
export function advanceDays(state: GameState, days: number) {
  validateDays(days);
  const s = structuredClone(state);
  syncEmployment(s);
  for (let d = 0; d < days; d++) {
    assertSchedule(s);
    const blocks = buildDayPlan(s);
    sleepAndRecover(s);
    decideCompetitors(s);
    companyDay(s);
    chargeInterest(s);
    let earned = 0,
      workHours = 0,
      transport = 0;
    const events: string[] = [];
    const actualWork = new Map<string, number>();
    for (const e of [...s.employments].sort((a, b) => a.start - b.start)) {
      const r = executeAction(s, "work", { id: e.id }, true);
      actualWork.set(e.id, r.hours);
      earned += r.earned ?? 0;
      workHours += r.hours;
      transport += r.spending ?? 0;
      events.push(...(r.events ?? []));
    }
    let business = emptyBusinessDay();
    if (s.business) s.business.last = emptyBusinessDay();
    const activity = blocks
      .filter((b) => b.kind === "activity")
      .reduce((a, b) => a + b.hours, 0);
    const id = [0, 6].includes(weekday(s.date))
      ? s.routine.weekendAction
      : s.routine.weekdayAction;
    let studyHours = 0,
      performed = 0;
    if (activity) {
      const reason = actionUnavailable(s, id);
      if (reason) events.push("余暇の行動を見送り：" + reason);
      else {
        const energyCost = actionRegistry.get(id)?.energyPerHour ?? 0;
        const hours = energyCost
          ? Math.min(activity, s.person.energy / energyCost)
          : activity;
        const rounded = Math.floor(hours * 2) / 2;
        const durationReason =
          rounded === 0 && energyCost > 0
            ? "体力が足りません"
            : actionUnavailable(s, id, {}, rounded);
        if (durationReason)
          events.push("余暇の行動を見送り：" + durationReason);
        else if (rounded) {
          const r = executeAction(s, id, {}, true, rounded);
          business = r.business ?? business;
          performed = rounded;
          if (actionRegistry.get(id)?.category === "study")
            studyHours = rounded;
          events.push(actionRegistry.get(id)!.label + " " + rounded + "時間");
        }
      }
    }
    let remaining = performed;
    const actualBlocks = blocks.flatMap((b) => {
      if (b.kind === "work") {
        const actual = actualWork.get(b.targetId!) ?? 0;
        return [
          ...(actual ? [{ ...b, hours: actual }] : []),
          ...(actual < b.hours
            ? [
                {
                  ...b,
                  kind: "free" as const,
                  label: "体調・欠勤による休養",
                  start: b.start + actual,
                  hours: b.hours - actual,
                },
              ]
            : []),
        ];
      }
      if (b.kind === "commute" && actualWork.get(b.targetId!) === 0)
        return [{ ...b, kind: "free" as const, label: "欠勤による休養" }];
      if (b.kind === "activity") {
        const used = Math.min(remaining, b.hours);
        remaining -= used;
        return [
          ...(used
            ? [{ ...b, hours: used, label: actionRegistry.get(id)!.label }]
            : []),
          ...(used < b.hours
            ? [
                {
                  ...b,
                  kind: "free" as const,
                  label: "行動を見送り・休息",
                  start: b.start + used,
                  hours: b.hours - used,
                },
              ]
            : []),
        ];
      }
      return [b];
    });
    studyHours += s.manualActions
      .filter((a) => actionRegistry.get(a.actionId)?.category === "study")
      .reduce((a, b) => a + b.hours, 0);
    const freeHours = actualBlocks
      .filter((b) => b.kind === "free")
      .reduce((a, b) => a + b.hours, 0);
    s.person.energy = Math.min(
      energyLimit(s),
      s.person.energy + freeHours * 0.7,
    );
    livingExpenses(s);
    const entries = s.ledger.filter((e) => e.date === s.date);
    const spending = entries
      .filter((e) => e.kind === "living")
      .reduce((a, e) => a - e.amount + Math.max(0, e.debtDelta), 0);
    const sales = entries
        .filter((e) => e.kind === "business-revenue")
        .reduce((a, e) => a + e.amount, 0),
      businessCosts = entries
        .filter((e) => e.kind === "business-cost")
        .reduce((a, e) => a - e.amount + Math.max(0, e.debtDelta), 0);
    // Planned absence releases its slots. Unexpected absence/partial work retains the reservation as recovery time.
    for (const b of blocks)
      if (b.kind === "activity")
        b.label = actionRegistry.get(b.label)?.label ?? b.label;
    s.history.push({
      date: s.date,
      cash: s.cash,
      bank: s.bank,
      debt: s.debt,
      netWorth: netWorth(s),
      earned,
      spending,
      sales,
      profit: sales - businessCosts,
      workHours,
      sleepHours: s.routine.sleepHours,
      studyHours,
      commuteHours: actualBlocks
        .filter((b) => b.kind === "commute")
        .reduce((a, b) => a + b.hours, 0),
      freeHours,
      activityHours: performed,
      energy: s.person.energy,
      satisfaction: s.person.satisfaction,
      blocks: actualBlocks,
      events,
    });
    s.history = s.history.slice(-365);
    monthReport(s).closing = balances(s);
    s.days++;
    s.manualActions = [];
    s.date = nextDate(s.date);
    for (const event of events.filter((v) => /昇給|昇格|欠勤/.test(v)))
      s.notices.unshift(event);
    s.notices = s.notices.slice(0, 12);
  }
  syncEmployment(s);
  return s;
}
export function dispatch(state: GameState, command: Command): GameState {
  if (command.type === "advance") return advanceDays(state, command.days);
  const s = structuredClone(state);
  syncEmployment(s);
  switch (command.type) {
    case "apply":
      executeAction(s, "apply", { id: command.jobId });
      break;
    case "quit":
      executeAction(s, "quit", { id: command.contractId });
      break;
    case "action": {
      const def = actionRegistry.get(command.action);
      if (!def?.daily) throw Error("自動行動が不正です");
      const reason = actionUnavailable(s, command.action);
      if (reason) throw Error(reason);
      s.action = command.action;
      s.routine.weekdayAction = command.action;
      s.routine.weekendAction = command.action;
      break;
    }
    case "open":
      executeAction(s, "open", { id: command.industryId });
      break;
    case "invest":
      executeAction(s, "invest");
      break;
    case "price":
      executeAction(s, "price", { price: command.price });
      break;
    case "toggle":
      executeAction(s, "toggle");
      break;
    case "close":
      executeAction(s, "close");
      break;
    case "housing":
      executeAction(s, "housing", { id: command.housingId });
      break;
    case "routine": {
      const r = { ...s.routine, ...command.routine };
      if (
        !Number.isInteger(r.sleepHours) ||
        r.sleepHours < 4 ||
        r.sleepHours > 10 ||
        !Number.isFinite(r.activityHours) ||
        r.activityHours < 0 ||
        r.activityHours > 8 ||
        r.activityHours % 0.5 ||
        !Number.isFinite(r.weekendHours) ||
        r.weekendHours < 0 ||
        r.weekendHours > 8 ||
        r.weekendHours % 0.5
      )
        throw Error("睡眠は4〜10時間、余暇は0〜8時間（0.5刻み）です");
      for (const id of [r.weekdayAction, r.weekendAction])
        if (!actionRegistry.get(id)?.daily) throw Error("自動行動が不正です");
      if (
        r.socialTarget &&
        !s.relationships.some((p) => p.npcId === r.socialTarget)
      )
        throw Error("交流相手とまだ知り合っていません");
      s.routine = r;
      assertSchedule(s);
      s.action = r.weekdayAction;
      break;
    }
    case "shift": {
      validateShift(command.start, command.weekdays);
      const e = s.employments.find((e) => e.id === command.contractId);
      if (!e) throw Error("勤務契約が見つかりません");
      e.start = command.start;
      e.weekdays = [...command.weekdays];
      assertSchedule(s);
      break;
    }
    case "absence": {
      const e = s.employments.find((e) => e.id === command.contractId);
      if (!e) throw Error("勤務契約が見つかりません");
      e.absentNext = !e.absentNext;
      assertSchedule(s);
      break;
    }
    case "standard":
      if (!standards[command.standard]) throw Error("生活水準が不正です");
      s.livingStandard = command.standard;
      break;
    case "execute":
      executeAction(s, command.actionId, command.target);
      break;
  }
  syncEmployment(s);
  s.notices = s.notices.slice(0, 12);
  return s;
}
