import type { GameState, EmploymentContract, TimeBlock } from "./types";
import { jobs } from "./catalog/jobs";
import { weekday } from "./time";
export function isShiftDay(e: EmploymentContract, date: string) {
  return e.weekdays.includes(weekday(date));
}
export function availableHours(
  s: GameState,
  contracts = s.employments,
  sleep = s.routine.sleepHours,
) {
  return Math.max(
    0,
    24 -
      sleep -
      2 -
      contracts
        .filter((e) => isShiftDay(e, s.date) && !e.absentNext)
        .reduce((sum, e) => sum + e.hours + e.commute * 2, 0),
  );
}
export function assertSchedule(
  s: GameState,
  contracts = s.employments,
  sleep = s.routine.sleepHours,
) {
  for (let day = 0; day < 7; day++) {
    const spans = contracts
      .filter((e) => e.weekdays.includes(day))
      .map((e) => ({
        start: e.start - e.commute,
        end: e.start + e.hours + e.commute,
      }))
      .sort((a, b) => a.start - b.start);
    let end = sleep,
      used = sleep + 2;
    for (const span of spans) {
      if (span.start < end || span.end > 24)
        throw Error("勤務・通勤が他のシフトまたは睡眠と重複しています");
      used += span.end - span.start;
      end = span.end;
    }
    if (used > 24) throw Error("食事・身支度の2時間を確保できません");
  }
  if (
    availableHours(s, contracts, sleep) <
    s.manualActions.reduce((a, b) => a + b.hours, 0)
  )
    throw Error("当日の手動行動に必要な時間が足りません");
}
export function buildDayPlan(s: GameState): TimeBlock[] {
  const slots: (TimeBlock | null)[] = Array(48).fill(null);
  function reserve(
    start: number,
    hours: number,
    kind: TimeBlock["kind"],
    label: string,
    targetId?: string,
  ) {
    const block: TimeBlock = {
      start,
      hours,
      kind,
      label,
      ...(targetId ? { targetId } : {}),
    };
    for (let n = start * 2; n < (start + hours) * 2; n++) {
      if (slots[n]) throw Error("予定の重複を検出しました");
      slots[n] = block;
    }
  }
  reserve(0, s.routine.sleepHours, "sleep", "睡眠");
  for (const e of s.employments.filter(
    (e) => isShiftDay(e, s.date) && !e.absentNext,
  )) {
    reserve(e.start - e.commute, e.commute, "commute", "通勤", e.id);
    reserve(
      e.start,
      e.hours,
      "work",
      jobs.find((j) => j.id === e.jobId)!.name,
      e.id,
    );
    reserve(e.start + e.hours, e.commute, "commute", "帰宅", e.id);
  }
  function allocate(hours: number, kind: TimeBlock["kind"], label: string) {
    let left = hours;
    for (let n = 0; n < 48 && left > 0; n++) {
      if (!slots[n]) {
        reserve(n / 2, 0.5, kind, label);
        left -= 0.5;
      }
    }
    if (left > 0) throw Error("24時間を超える予定です");
  }
  allocate(2, "essential", "食事・身支度");
  for (const a of s.manualActions) allocate(a.hours, "manual", a.label);
  const actionId = [0, 6].includes(weekday(s.date))
    ? s.routine.weekendAction
    : s.routine.weekdayAction;
  const free = slots.filter((v) => !v).length / 2;
  allocate(
    Math.min(
      [0, 6].includes(weekday(s.date))
        ? s.routine.weekendHours
        : s.routine.activityHours,
      free,
    ),
    "activity",
    actionId,
  );
  allocate(slots.filter((v) => !v).length / 2, "free", "自由時間");
  const result: TimeBlock[] = [];
  for (let n = 0; n < 48; n++) {
    const slot = slots[n]!;
    const prev = result.at(-1);
    if (
      prev &&
      prev.kind === slot.kind &&
      prev.label === slot.label &&
      prev.targetId === slot.targetId
    )
      prev.hours += 0.5;
    else result.push({ ...slot, start: n / 2, hours: 0.5 });
  }
  return result;
}
export function validateShift(start: number, weekdays: number[]) {
  if (
    !Number.isFinite(start) ||
    start % 0.5 ||
    start < 0 ||
    start > 23 ||
    !weekdays.length ||
    weekdays.length > 7 ||
    new Set(weekdays).size !== weekdays.length ||
    weekdays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  )
    throw Error("開始時刻または勤務曜日が不正です");
}
