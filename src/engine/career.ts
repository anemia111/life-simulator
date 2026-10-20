import { jobOffer } from "./spatial/selectors";
import type { GameState, EmploymentContract } from "./types";
import { jobs } from "./catalog/jobs";
import { receive, pay, monthReport } from "./finance";
import { dayOfMonth, nextDate } from "./time";
import { assertSchedule, isShiftDay } from "./schedule";
import { meetColleagues, workplaceTrust } from "./relationships";
export { jobs } from "./catalog/jobs";
export const syncEmployment = (s: GameState) => {
  s.employment = s.employments[0] ?? null;
  s.person.occupation = s.employments.length
    ? "アルバイト " + s.employments.length + "件"
    : "自由な暮らし";
};
export function hiringAssessment(s: GameState, id: string) {
  const j = jobs.find((j) => j.id === id);
  if (!j) throw Error("求人が見つかりません");
  const v = s.vacancies.find((v) => v.jobId === id),
    company = s.organizations.find((o) => o.id === j.employerId);
  const score =
    Math.round(
      (50 +
        s.person.skills[j.skill] * 1.5 +
        s.person.experience[j.skill] / 20 +
        workplaceTrust(s, j.employerId) / 10 -
        (v?.competition ?? j.competition) * 5) *
        10,
    ) / 10;
  const threshold = v?.threshold ?? j.threshold;
  const closed = !v || v.openings <= 0 || !company || company.cash < 0;
  const hired =
    !closed && s.person.skills[j.skill] >= j.requirement && score >= threshold;
  return {
    score,
    threshold,
    hired,
    reason: closed
      ? "企業の採用枠がありません"
      : s.person.skills[j.skill] < j.requirement
        ? "必要な能力に届きません"
        : score < threshold
          ? "応募点が採用基準に届きません"
          : "能力・経験が採用基準を満たしました",
  };
}
export function makeContract(s: GameState, id: string): EmploymentContract {
  const j = jobs.find((j) => j.id === id)!;
  return {
    id: "contract-" + ++s.sequence,
    jobId: id,
    employerId: j.employerId,
    accrued: 0,
    workedDays: 0,
    workedHours: 0,
    absences: 0,
    wage: j.wage,
    rating: 60,
    rank: 1,
    started: s.date,
    weekdays: [...j.weekdays],
    start: j.start,
    hours: j.hours,
    commute: jobOffer(s, j).commute,
    absentNext: false,
    month: "",
    monthHours: 0,
    monthDenominator: 0,
  };
}
export function applyJob(s: GameState, id: string) {
  if (s.employments.some((e) => e.jobId === id))
    throw Error("この仕事にはすでに採用されています");
  if (s.employments.length >= 4) throw Error("勤務契約は4件まで管理できます");
  const result = hiringAssessment(s, id);
  if (result.hired) {
    const e = makeContract(s, id);
    assertSchedule(s, [...s.employments, e]);
    s.employments.push(e);
    s.vacancies.find((v) => v.jobId === id)!.openings--;
    syncEmployment(s);
  }
  s.applications.push({ date: s.date, jobId: id, ...result });
  s.applications = s.applications.slice(-100);
  s.notices.unshift(
    jobs.find((j) => j.id === id)!.company +
      "：" +
      (result.hired ? "採用されました" : "不採用 — " + result.reason),
  );
}
export function quitJob(s: GameState, contractId?: string) {
  const e =
    s.employments.find((e) => e.id === contractId) ??
    (!contractId ? s.employments[0] : undefined);
  if (!e) throw Error("勤務契約が見つかりません");
  const j = jobs.find((j) => j.id === e.jobId)!;
  receive(s, e.accrued, "退職時の給与精算：" + j.company, "wages", "bank");
  s.careerHistory.push({
    jobId: e.jobId,
    company: j.company,
    started: e.started,
    ended: s.date,
    workedHours: e.workedHours,
    workedDays: e.workedDays,
    absences: e.absences,
    rank: e.rank,
    rating: e.rating,
  });
  s.careerHistory = s.careerHistory.slice(-200);
  s.employments = s.employments.filter((c) => c.id !== e.id);
  const v = s.vacancies.find((v) => v.jobId === j.id);
  if (v) v.openings++;
  syncEmployment(s);
  s.notices.unshift(j.company + "を退職し、未払給与を精算しました");
}
export function scheduledMonthHours(e: EmploymentContract, date: string) {
  const month = date.slice(0, 7);
  let d = month + "-01",
    hours = 0;
  while (d.startsWith(month)) {
    if (isShiftDay(e, d)) hours += e.hours;
    d = nextDate(d);
  }
  return hours;
}
export function workDay(s: GameState, contractId?: string) {
  let hours = 0,
    earned = 0,
    spending = 0;
  const events: string[] = [];
  for (const e of [...s.employments]
    .sort((a, b) => a.start - b.start)
    .filter((e) => !contractId || e.id === contractId)) {
    const j = jobs.find((j) => j.id === e.jobId)!;
    if (isShiftDay(e, s.date)) {
      const absent =
        e.absentNext || s.person.energy < 12 || s.person.health < 20;
      e.absentNext = false;
      const actual = absent
        ? 0
        : Math.min(e.hours, Math.floor((s.person.energy / 4) * 2) / 2);
      if (!actual) {
        e.absences++;
        e.rating = Math.max(0, e.rating - 8);
        events.push(j.company + "：欠勤（無給）");
      } else {
        meetColleagues(s, e.employerId);
        if (e.month !== s.date.slice(0, 7)) {
          e.month = s.date.slice(0, 7);
          e.monthHours = 0;
          e.monthDenominator = scheduledMonthHours(e, s.date);
        }
        const before = e.monthHours;
        e.monthHours += actual;
        const salary = (j.salary * e.wage) / j.wage;
        const dailyEarned =
          j.payMode === "monthly"
            ? Math.round((salary * e.monthHours) / e.monthDenominator) -
              Math.round((salary * before) / e.monthDenominator)
            : Math.round(actual * e.wage);
        e.accrued += dailyEarned;
        e.workedDays++;
        e.workedHours += actual;
        hours += actual;
        earned += dailyEarned;
        const rating = Math.min(
          100,
          55 +
            s.person.energy * 0.15 +
            s.person.skills[j.skill] * 0.2 +
            workplaceTrust(s, e.employerId) * 0.1 -
            (actual < e.hours ? 20 : 0),
        );
        e.rating = e.rating * 0.9 + rating * 0.1;
        s.person.energy = Math.max(
          0,
          s.person.energy - actual * 4 - e.commute * 2,
        );
        s.person.experience[j.skill] += actual;
        s.person.skills[j.skill] = Math.min(
          100,
          s.person.skills[j.skill] + actual * 0.06,
        );
        s.person.satisfaction = Math.min(100, s.person.satisfaction + 0.15);
        const fare = Math.round(jobOffer(s, j).fare * s.world.costIndex);
        pay(s, fare, "交通費：" + j.company);
        spending += fare;
        s.totals.living += fare;
        if (e.workedDays % 30 === 0 && e.rating >= 65) {
          e.wage = Math.min(j.wage * 2, Math.round(e.wage * 1.03));
          events.push(j.company + "：評価により昇給しました");
        }
        if (e.workedDays % 90 === 0 && e.rating >= 65 && e.rank < 4) {
          e.rank++;
          events.push(j.company + "：役割がLv." + e.rank + "に昇格しました");
        }
        const org = s.organizations.find((o) => o.id === e.employerId);
        if (org) org.cash -= dailyEarned;
        events.push(
          j.company + "：" + actual + "時間勤務 / " + dailyEarned + "円発生",
        );
      }
    }
    if (dayOfMonth(s.date) === j.payDay && e.accrued) {
      receive(s, e.accrued, "給与振込：" + j.company, "wages", "bank");
      s.notices.unshift(
        j.company +
          "の給与 " +
          e.accrued.toLocaleString("ja-JP") +
          "円が銀行に入金されました",
      );
      e.accrued = 0;
    }
  }
  s.totals.wages += earned;
  monthReport(s).earned += earned;
  syncEmployment(s);
  return { hours, earned, spending, events };
}
