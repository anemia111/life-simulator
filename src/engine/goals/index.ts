import { age } from "../person";
import type { GameState } from "../types";
import type { LifeGoal } from "../social/types";
import { profile, householdClaim } from "../social/selectors";
import { remember } from "../events";
export interface GoalDefinition {
  id: string;
  name: string;
  description: string;
  unit: string;
  target: number;
  measure: (s: GameState, id: string) => number;
}
export const goalRegistry = new Map<string, GoalDefinition>();
export function registerGoal(g: GoalDefinition) {
  if (goalRegistry.has(g.id)) throw Error("目標IDが重複しています");
  goalRegistry.set(g.id, g);
}
[
  {
    id: "reserve",
    name: "暮らしの備えを貯める",
    description: "生活費のために手元資金を蓄える",
    unit: "円",
    target: 180000,
    measure: (s: GameState, id: string) =>
      id === "player"
        ? s.cash + s.bank - s.debt + householdClaim(s, id)
        : (s.simulation.residents.find((r) => r.id === id)?.book.cash ?? 0) -
          (s.simulation.residents.find((r) => r.id === id)?.book.debt ?? 0) +
          householdClaim(s, id),
  },
  {
    id: "career",
    name: "仕事の経験を重ねる",
    description: "働いて得た給与を積み重ねる",
    unit: "円",
    target: 300000,
    measure: (s: GameState, id: string) =>
      id === "player"
        ? s.totals.wages
        : (s.simulation.residents.find((r) => r.id === id)?.earned ?? 0),
  },
  {
    id: "friends",
    name: "信頼できる友人をつくる",
    description: "互いに信頼する友人との関係を育てる",
    unit: "人",
    target: 2,
    measure: (s: GameState, id: string) =>
      s.social.bonds.filter(
        (b) =>
          (b.a === id || b.b === id) &&
          ["friend", "close", "dating", "married"].includes(b.status),
      ).length,
  },
  {
    id: "enterprise",
    name: "小さな事業を始める",
    description: "資金と時間を準備して、自分の仕事を始める",
    unit: "事業",
    target: 1,
    measure: (s: GameState, id: string) =>
      id === "player"
        ? s.ventures.filter(
            (v) => v.ownerId === "player" && v.status === "active",
          ).length + s.companies.filter((c) => c.status === "active").length
        : s.simulation.firms.filter(
            (f) => f.ownerId === id && f.status === "active",
          ).length,
  },
  {
    id: "family",
    name: "支え合う家族をつくる",
    description: "双方の同意を経て結婚し、暮らしを共にする",
    unit: "組",
    target: 1,
    measure: (s: GameState, id: string) =>
      s.social.bonds.some(
        (b) => (b.a === id || b.b === id) && b.status === "married",
      )
        ? 1
        : 0,
  },
  ...(["service", "craft", "digital"] as const).map((skill) => ({
    id: "learn-" + skill,
    name:
      { service: "接客", craft: "制作", digital: "デジタル" }[skill] +
      "の力を伸ばす",
    description: "学習と実務を通じて技能を高める",
    unit: "技能",
    target: 25,
    measure: (s: GameState, id: string) =>
      (id === "player" ? s.person : s.npcs.find((p) => p.id === id)!).skills[
        skill
      ],
  })),
].forEach(registerGoal);
export function addGoal(
  s: GameState,
  id: string,
  definitionId: string,
  target?: number,
) {
  const d = goalRegistry.get(definitionId);
  if (!d) throw Error("目標が見つかりません");
  if (
    s.social.goals.some(
      (g) =>
        g.actorId === id &&
        g.definitionId === definitionId &&
        g.status === "active",
    )
  )
    throw Error("この目標は設定済みです");
  const t = target ?? d.target;
  if (!Number.isSafeInteger(t) || t < 1 || t > 1e12)
    throw Error("目標値は正の整数です");
  const g: LifeGoal = {
    id: "goal-" + ++s.sequence,
    actorId: id,
    definitionId,
    target: t,
    progress: Math.max(0, d.measure(s, id)),
    status: "active",
    created: s.date,
    completed: null,
  };
  s.social.goals.push(g);
  return g;
}
export function updateGoals(s: GameState) {
  for (const g of s.social.goals.filter((g) => g.status === "active")) {
    g.progress = Math.max(
      0,
      goalRegistry.get(g.definitionId)!.measure(s, g.actorId),
    );
    if (g.progress >= g.target) {
      g.status = "achieved";
      g.completed = s.date;
      remember(
        s,
        g.actorId,
        "achievement",
        goalRegistry.get(g.definitionId)!.name + "を達成した",
      );
      if (g.actorId === "player")
        s.person.satisfaction = Math.min(100, s.person.satisfaction + 4);
    }
  }
}
export const activeGoal = (s: GameState, id: string, definitionId: string) =>
  s.social?.goals.some(
    (g) =>
      g.actorId === id &&
      g.definitionId === definitionId &&
      g.status === "active",
  ) ?? false;
export function learningFocus(
  s: GameState,
  id: string,
  fallback: "service" | "craft" | "digital",
) {
  for (const skill of ["digital", "service", "craft"] as const)
    if (activeGoal(s, id, "learn-" + skill)) return skill;
  return fallback;
}
export function seedGoals(s: GameState) {
  for (const p of s.social.profiles.filter(
    (p) =>
      p.id !== "player" &&
      age(
        s.npcs.find((n) => n.id === p.id)!,
        s.date,
      ) >= 18,
  )) {
    if (s.social.goals.some((g) => g.actorId === p.id)) continue;
    const r = s.simulation.residents.find((r) => r.id === p.id);
    addGoal(s, p.id, "reserve", r?.motive === "saving" ? 250000 : 120000);
    addGoal(
      s,
      p.id,
      r?.motive === "enterprise"
        ? "enterprise"
        : p.values.connection >= 65 && p.romance === "open"
          ? "family"
          : r?.motive === "income"
            ? "learn-digital"
            : "friends",
    );
  }
}
