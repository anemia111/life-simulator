import type { GameState, Job } from "./types";
import { receive } from "./finance";
import { dayOfMonth, weekday } from "./time";
export const jobs: Job[] = [
  {
    id: "cafe",
    employerId: "cafe-co",
    name: "カフェスタッフ",
    company: "喫茶 こもれび",
    wage: 1100,
    hours: 5,
    skill: "service",
    requirement: 0,
    description: "はじめての仕事にも。コーヒーと人に触れる毎日。",
  },
  {
    id: "shop",
    employerId: "shop-co",
    name: "書店スタッフ",
    company: "青葉ブックストア",
    wage: 1200,
    hours: 6,
    skill: "service",
    requirement: 5,
    description: "本のある空間で、接客の経験を活かす。",
  },
  {
    id: "design",
    employerId: "design-co",
    name: "制作アシスタント",
    company: "スタジオ ノート",
    wage: 1600,
    hours: 6,
    skill: "digital",
    requirement: 10,
    description: "小さな制作チームでデジタルの技術を磨く。",
  },
];
export function applyJob(s: GameState, id: string) {
  if (s.employment) throw Error("先に現在の仕事を退職してください");
  const j = jobs.find((j) => j.id === id);
  if (!j) throw Error("求人が見つかりません");
  if (s.person.skills[j.skill] < j.requirement)
    throw Error("応募条件のスキルが不足しています");
  s.employment = {
    jobId: id,
    employerId: j.employerId,
    accrued: 0,
    workedDays: 0,
  };
  s.notices.unshift(j.company + "に採用されました");
}
export function quitJob(s: GameState) {
  if (!s.employment) throw Error("現在は就業していません");
  receive(s, s.employment.accrued, "退職時の給与精算");
  s.employment = null;
  s.notices.unshift("退職しました。新しい選択はいつでもできます");
}
export function workDay(s: GameState) {
  if (!s.employment) return { hours: 0, earned: 0 };
  const e = s.employment,
    j = jobs.find((j) => j.id === e.jobId)!;
  let hours = 0;
  const w = weekday(s.date);
  if (w !== 0 && w !== 6) {
    hours = Math.min(j.hours, Math.floor(s.person.energy / 4));
    s.person.energy -= hours * 4;
    e.accrued += hours * j.wage;
    if (hours) e.workedDays++;
    s.person.skills[j.skill] = Math.min(
      100,
      s.person.skills[j.skill] + hours * 0.06,
    );
  }
  const earned = hours * j.wage;
  s.totals.wages += earned;
  if (dayOfMonth(s.date) === 25 && e.accrued) {
    receive(s, e.accrued, "給与振込：" + j.company);
    s.notices.unshift(
      "給与 " + e.accrued.toLocaleString("ja-JP") + "円を受け取りました",
    );
    e.accrued = 0;
  }
  return { hours, earned };
}
