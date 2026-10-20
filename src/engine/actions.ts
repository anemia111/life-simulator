import type { GameState, ActionTarget, Skill } from "./types";
import { availableHours } from "./schedule";
import { liquid, pay, requireCash, transfer, borrow, repay } from "./finance";
import { applyJob, quitJob, workDay } from "./career";
import {
  openBusiness,
  invest,
  investmentCost,
  operateBusiness,
  industries,
} from "./business";
import { moveHome, energyLimit } from "./life";
import { socialize } from "./relationships";
export interface ActionResult {
  hours: number;
  earned?: number;
  spending?: number;
  events?: string[];
  business?: ReturnType<typeof operateBusiness>;
}
export interface ActionDefinition {
  id: string;
  label: string;
  category: "work" | "study" | "life" | "social" | "finance" | "business";
  hours: number;
  minHours?: number;
  energyPerHour?: number;
  duration?: (s: GameState, t: ActionTarget) => number;
  cost: (s: GameState, t: ActionTarget) => number;
  target:
    | "person"
    | "npc"
    | "job"
    | "contract"
    | "business"
    | "account"
    | "housing"
    | "none";
  result: string;
  manual: boolean;
  daily: boolean;
  charge?: boolean;
  condition: (s: GameState, t: ActionTarget) => string | null;
  effect: (
    s: GameState,
    t: ActionTarget,
    hours: number,
  ) => Partial<ActionResult> | void;
}
const none = () => null,
  zero = () => 0;
export const actionRegistry = new Map<string, ActionDefinition>();
export function registerAction(def: ActionDefinition) {
  if (actionRegistry.has(def.id)) throw Error("行動IDが重複しています");
  actionRegistry.set(def.id, def);
}
function add(
  def: Partial<ActionDefinition> &
    Pick<ActionDefinition, "id" | "label" | "effect">,
) {
  registerAction({
    category: "life",
    hours: 0,
    cost: zero,
    target: "none",
    result: "",
    manual: true,
    daily: false,
    condition: none,
    ...def,
  });
}
add({
  id: "rest",
  label: "ゆっくり休む",
  hours: 1,
  daily: true,
  target: "person",
  result: "毎時 体力+3・健康+0.1・満足度+0.4",
  effect: (s, t, h) => {
    s.person.energy = Math.min(energyLimit(s), s.person.energy + h * 3);
    s.person.health = Math.min(100, s.person.health + h * 0.1);
    s.person.satisfaction = Math.min(100, s.person.satisfaction + h * 0.4);
  },
});
for (const [id, label] of Object.entries({
  service: "接客を学ぶ",
  craft: "ものづくりを学ぶ",
  digital: "デジタルを学ぶ",
}))
  add({
    id,
    label,
    hours: 1,
    daily: true,
    category: "study",
    energyPerHour: 2,
    target: "person",
    result: "毎時スキル+0.18（健康・満足度で補正）、体力−2",
    effect: (s, t, h) => {
      const quality =
        (0.5 + s.person.health / 200) * (0.75 + s.person.satisfaction / 400);
      s.person.skills[id as Skill] = Math.min(
        100,
        s.person.skills[id as Skill] + h * 0.18 * quality,
      );
      s.person.energy = Math.max(0, s.person.energy - h * 2);
    },
  });
add({
  id: "business",
  energyPerHour: 2,
  label: "事業に取り組む",
  category: "business",
  manual: false,
  hours: 1,
  daily: true,
  target: "business",
  condition: (s) => (!s.business ? "先に事業を開業してください" : null),
  result: "需要・能力・資金に応じて生産販売",
  effect: (s, t, h) => ({ business: operateBusiness(s, h) }),
});
add({
  id: "socialize",
  energyPerHour: 1,
  label: "知人と交流する",
  category: "social",
  hours: 1,
  daily: true,
  target: "npc",
  condition: (s, t) =>
    !s.relationships.some((r) => r.npcId === (t.id ?? s.routine.socialTarget))
      ? "交流相手を選んでください"
      : null,
  result: "親密度・信頼・満足度が上がります",
  effect: (s, t, h) => socialize(s, t.id ?? s.routine.socialTarget!, h),
});
add({
  id: "shopping",
  minHours: 1,
  energyPerHour: 1,
  label: "買い物を楽しむ",
  hours: 1,
  daily: true,
  cost: () => 1500,
  charge: true,
  target: "person",
  result: "日用品を購入。満足度+8・健康+0.5",
  effect: (s) => {
    s.person.satisfaction = Math.min(100, s.person.satisfaction + 8);
    s.person.health = Math.min(100, s.person.health + 0.5);
  },
});
add({
  id: "apply",
  label: "求人に応募",
  category: "work",
  hours: 1,
  target: "job",
  result: "能力・経験・採用倍率から採否判定",
  effect: (s, t) => applyJob(s, t.id!),
});
add({
  id: "quit",
  label: "退職する",
  category: "work",
  hours: 0.5,
  target: "contract",
  result: "未払給与を銀行に精算、経歴を保存",
  effect: (s, t) => quitJob(s, t.id),
});
add({
  id: "work",
  duration: (s, t) => s.employments.find((e) => e.id === t.id)?.hours ?? 0,
  label: "勤務する",
  category: "work",
  target: "contract",
  manual: false,
  result: "シフトに従って働き、給与・経験・評価を蓄積",
  effect: (s, t) => workDay(s, t.id),
});
add({
  id: "deposit",
  label: "銀行に預ける",
  category: "finance",
  target: "account",
  result: "現金から預金へ振替",
  effect: (s, t) => transfer(s, t.amount!, "bank"),
});
add({
  id: "withdraw",
  label: "現金を引き出す",
  category: "finance",
  target: "account",
  result: "預金から現金へ振替",
  effect: (s, t) => transfer(s, t.amount!, "cash"),
});
add({
  id: "borrow",
  label: "生活資金を借りる",
  category: "finance",
  target: "account",
  result: "借入残高10万円まで。月初利息1%",
  effect: (s, t) => borrow(s, t.amount!),
});
add({
  id: "repay",
  label: "ローンを返済",
  category: "finance",
  target: "account",
  result: "現金・預金で借入を返済",
  effect: (s, t) => repay(s, t.amount!),
});
add({
  id: "repay-unpaid",
  label: "未払いを精算",
  category: "finance",
  target: "account",
  result: "現金・預金で未払いを返済",
  effect: (s, t) => repay(s, t.amount!, false),
});
add({
  id: "housing",
  label: "住み替える",
  hours: 2,
  target: "housing",
  result: "家賃増額分を精算し生活環境を変更",
  effect: (s, t) => moveHome(s, t.id!),
});
add({
  id: "open",
  label: "個人事業を開業",
  category: "business",
  hours: 2,
  target: "business",
  cost: (s, t) => industries.find((i) => i.id === t.id)?.setup ?? 0,
  result: "設備を取得、余暇を事業運営へ変更",
  effect: (s, t) => openBusiness(s, t.id!),
});
add({
  id: "invest",
  label: "設備に再投資",
  category: "business",
  hours: 1,
  target: "business",
  cost: investmentCost,
  result: "設備レベルと生産能力を拡張",
  effect: (s) => invest(s),
});
add({
  id: "price",
  label: "販売価格を変更",
  category: "business",
  hours: 0.5,
  target: "business",
  condition: (s) => (!s.business ? "先に開業してください" : null),
  result: "価格と需要が変わります",
  effect: (s, t) => {
    if (!Number.isInteger(t.price) || t.price! < 100 || t.price! > 100000)
      throw Error("価格は100〜100,000円の整数です");
    s.business!.price = t.price!;
  },
});
add({
  id: "toggle",
  label: "事業を休業・再開",
  category: "business",
  target: "business",
  condition: (s) => (!s.business ? "先に開業してください" : null),
  result: "休業中は売上・運営費なし",
  effect: (s) => {
    s.business!.active = !s.business!.active;
  },
});
add({
  id: "close",
  label: "事業を廃業",
  category: "business",
  hours: 1,
  target: "business",
  condition: (s) => (!s.business ? "事業がありません" : null),
  result: "設備を手放す。累計収益は保持",
  effect: (s) => {
    s.business = null;
    s.assets = s.assets.filter((a) => a.ownerId !== "player-business");
    s.organizations = s.organizations.filter((o) => o.id !== "player-business");
    for (const key of ["weekdayAction", "weekendAction"] as const)
      if (s.routine[key] === "business") s.routine[key] = "rest";
    if (s.action === "business") s.action = "rest";
  },
});
export const dailyActions = () =>
  [...actionRegistry.values()].filter((a) => a.daily);
export function actionUnavailable(
  s: GameState,
  id: string,
  target: ActionTarget = {},
  hours?: number,
) {
  const def = actionRegistry.get(id);
  if (!def) return "行動が見つかりません";
  if (hours !== undefined && hours < (def.minHours ?? 0.5))
    return "行動に必要な時間が足りません";
  return (
    def.condition(s, target) ??
    (liquid(s) < def.cost(s, target) ? "行動に必要な資金が足りません" : null)
  );
}
export function executeAction(
  s: GameState,
  id: string,
  target: ActionTarget = {},
  automatic = false,
  hoursOverride?: number,
): ActionResult {
  const def = actionRegistry.get(id);
  if (!def) throw Error("行動が見つかりません");
  if (!automatic && !def.manual)
    throw Error("この行動は勤務予定から実行されます");
  const hours = hoursOverride ?? def.duration?.(s, target) ?? def.hours;
  const reason = actionUnavailable(
    s,
    id,
    target,
    hours > 0 ? hours : undefined,
  );
  if (reason) throw Error(reason);
  if (!Number.isFinite(hours) || hours < 0 || hours % 0.5)
    throw Error("必要時間は0.5時間単位です");
  if (!automatic) {
    if (
      availableHours(s) - s.manualActions.reduce((a, b) => a + b.hours, 0) <
      hours
    )
      throw Error("今日は行動に必要な自由時間が足りません");
    if (hours) s.manualActions.push({ actionId: id, label: def.label, hours });
  }
  const cost = def.cost(s, target);
  if (cost) requireCash(s, cost);
  if (def.charge && cost) {
    pay(s, cost, def.label);
    s.totals.living += cost;
  }
  return { hours, ...def.effect(s, target, hours) };
}
