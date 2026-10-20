import { initialSocial } from "./engine/social/initial";
import { seedGoals } from "./engine/goals";
import { initialSimulation } from "./engine/simulation/initial";
import { initialSpatial } from "./engine/spatial/catalog";
import { validateLegacy } from "./legacy-save";
import { newGame } from "./engine";
import { makeContract, jobs, syncEmployment } from "./engine/career";
import { post, monthReport } from "./engine/finance";
import type { FinanceKind } from "./engine/types";
export function migrateV1(value: unknown) {
  const old = validateLegacy(value),
    s = newGame(old.person.name);
  s.person = { ...s.person, ...old.person };
  s.date = old.date;
  s.started = old.started;
  s.days = old.days;
  s.cash = old.cash;
  s.bank = 0;
  s.debt = old.debt;
  s.loan = 0;
  s.sequence = old.sequence;
  s.assets = old.assets;
  s.business = old.business;
  s.housingId = old.housingId;
  s.world = { ...s.world, ...old.world };
  s.action = old.action;
  s.routine.weekdayAction = old.action;
  s.routine.weekendAction = old.action;
  s.totals = old.totals;
  s.manualActions = [];
  s.npcs = s.npcs.map((p) => ({
    ...p,
    ...old.npcs.find((n) => n.id === p.id),
  }));
  if (old.business) {
    const o = old.organizations.find((o) => o.id === "player-business");
    if (o)
      s.organizations.push({ ...o, cash: 0, dailyRevenue: 0, dailyCost: 0 });
  }
  if (old.employment) {
    const e = makeContract(s, old.employment.jobId),
      j = jobs.find((j) => j.id === e.jobId)!;
    e.accrued = old.employment.accrued;
    e.workedDays = old.employment.workedDays;
    e.workedHours = e.workedDays * j.hours;
    e.started = old.started;
    s.employments = [e];
    s.person.experience[j.skill] = e.workedHours;
    s.vacancies.find((v) => v.jobId === j.id)!.openings--;
  }
  syncEmployment(s);
  const entries = old.ledger.map((e) => {
    const debtDelta =
      e.category === "debt"
        ? e.amount
        : e.label === "未払債務の返済"
          ? e.amount
          : 0;
    const cashDelta = e.category === "debt" ? 0 : e.amount;
    const kind: FinanceKind =
      e.label === "未払債務の返済"
        ? "repayment"
        : /給与/.test(e.label)
          ? "wages"
          : /開業設備|再投資/.test(e.label)
            ? "capital"
            : /売上/.test(e.label)
              ? "business-revenue"
              : /材料費/.test(e.label)
                ? "business-cost"
                : "living";
    return { e, debtDelta, cashDelta, kind };
  });
  const openingCash = old.cash - entries.reduce((a, e) => a + e.cashDelta, 0),
    openingDebt = old.debt - entries.reduce((a, e) => a + e.debtDelta, 0);
  if (openingCash < 0 || openingDebt < 0)
    throw Error("旧版セーブの残高が一致しません");
  s.cash = openingCash;
  s.debt = openingDebt;
  s.checkpoint = { cash: openingCash, bank: 0, debt: openingDebt };
  s.ledger = [];
  s.reports = [];
  for (const row of entries) {
    s.date = row.e.date;
    post(
      s,
      row.e.label,
      row.kind,
      row.cashDelta,
      0,
      row.debtDelta,
      row.e.category === "debt"
        ? row.debtDelta
        : row.cashDelta < 0 && row.kind !== "repayment"
          ? -row.cashDelta
          : 0,
    );
  }
  s.date = old.date;
  s.history = old.history.map((h) => ({
    ...h,
    bank: 0,
    debt: 0,
    workHours: 0,
    sleepHours: 0,
    studyHours: 0,
    commuteHours: 0,
    freeHours: 24,
    activityHours: 0,
    energy: 100,
    satisfaction: 70,
    blocks: [
      {
        kind: "free" as const,
        label: "v0.1の集計（時間配分は未記録）",
        start: 0,
        hours: 24,
      },
    ],
    events: [
      "v0.1から移行した記録です。勤務時間と日次債務残高は旧版に記録がありません。",
    ],
  }));
  for (const h of old.history) {
    const previous = s.date;
    s.date = h.date;
    monthReport(s).earned += h.earned;
    s.date = previous;
  }
  s.reports.sort((a, b) => a.month.localeCompare(b.month));
  s.notices = [
    "Phase 1へ移行しました。旧勤務時間は勤務日数×所定時間で推定しています。",
    ...old.notices,
  ].slice(0, 12);
  s.spatial = initialSpatial(s.housingId, s.started, s.date);
  s.simulation = initialSimulation(s);
  s.social = initialSocial(s);
  seedGoals(s);
  return s;
}
