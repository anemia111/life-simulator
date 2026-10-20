import { executeSecurities } from "./securities";
import { addGoal } from "./goals";
import { profile, npcFree, bondFor } from "./social/selectors";
import {
  reserveConversation,
  converse,
  romanceReason,
  startDating,
  endDating,
} from "./social/relationships";
import {
  contribute,
  marry,
  welcomeChild,
  adoptionReason,
} from "./social/households";
import {
  moveToProperty,
  leaseProperty,
  releaseProperty,
  visitFacility,
} from "./spatial/commands";
import { property, homeProperty, route } from "./spatial/selectors";
import { executeEnterprise } from "./enterprise";
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
add({
  id: "enterprise-work",
  label: "副業・会社の事業を運営",
  category: "business",
  hours: 1,
  daily: true,
  manual: false,
  energyPerHour: 2,
  target: "business",
  condition: (s) =>
    s.ventures.some((v) => v.status === "active")
      ? null
      : "先に副業・事業を開設してください",
  result: "余暇時間を事業の配分比率で分割。従業員・外注は別に作業",
  effect: (s, _t, h) => {
    s.person.energy = Math.max(0, s.person.energy - h * 2);
  },
});
add({
  id: "enterprise-manage",
  label: "事業・会社の経営指示",
  category: "business",
  hours: 0.5,
  duration: (_s, t) =>
    ["create", "create-company", "incorporate", "close"].includes(
      t.enterprise?.operation ?? "",
    )
      ? 2
      : 0.5,
  target: "business",
  result: "帳簿・契約・設備・所有権を変更",
  effect: (s, t) => {
    if (!t.enterprise) throw Error("経営指示がありません");
    executeEnterprise(s, t.enterprise);
  },
});
add({
  id: "map-move",
  label: "物件へ引っ越す",
  hours: 2,
  target: "housing",
  effect: (s, t) => moveToProperty(s, t.id!),
});
add({
  id: "map-lease",
  label: "物件を事業・会社で借りる",
  hours: 1,
  target: "business",
  effect: (s, t) => leaseProperty(s, t.id!, t.value!),
});
add({
  id: "map-release",
  label: "事業物件を解約する",
  hours: 0.5,
  target: "business",
  effect: (s, t) => releaseProperty(s, t.id!),
});
add({
  id: "map-favorite",
  label: "日常の施設を登録・解除",
  hours: 0,
  target: "none",
  effect: (s, t) => {
    if (property(t.id!).kind !== "facility")
      throw Error("施設を選択してください");
    s.spatial.favorites = s.spatial.favorites.includes(t.id!)
      ? s.spatial.favorites.filter((id) => id !== t.id)
      : [...s.spatial.favorites, t.id!];
  },
});
add({
  id: "map-visit",
  label: "都市の施設を利用する",
  duration: (s, t) => 1 + route(homeProperty(s), property(t.id!)).hours * 2,
  target: "none",
  effect: (s, t) => visitFacility(s, t.id!),
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
  if (
    ["socialize", "meet-npc", "support-npc", "date-npc", "marry-npc"].includes(
      id,
    )
  ) {
    const npcId = target.id ?? s.routine.socialTarget;
    const needed = id === "socialize" ? (hours ?? 1) : 1;
    if (npcId && npcFree(s, npcId) < needed)
      return "相手の勤務・生活予定が埋まっています。別の日に交流してください";
  }
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

add({
  id: "meet-npc",
  charge: true,
  label: "地域の人物と会う",
  category: "social",
  hours: 1,
  target: "npc",
  result: "交流して関係を築く。移動時間・交通費も消費します。",
  duration: (s, t) =>
    1 +
    route(
      homeProperty(s),
      property(
        s.simulation.residents.find((r) => r.id === t.id)?.homeId ??
          s.spatial.homePropertyId,
      ),
    ).hours *
      2,
  cost: (s, t) =>
    route(
      homeProperty(s),
      property(
        s.simulation.residents.find((r) => r.id === t.id)?.homeId ??
          s.spatial.homePropertyId,
      ),
    ).fare * 2,
  condition: (s, t) =>
    s.simulation.residents.some((r) => r.id === t.id)
      ? null
      : "人物が見つかりません",
  effect: (s, t) => {
    let r = s.relationships.find((r) => r.npcId === t.id);
    if (!r) {
      r = {
        npcId: t.id!,
        affinity: 10,
        trust: 10,
        met: s.date,
        interactions: 0,
      };
      s.relationships.push(r);
    }
    socialize(s, t.id!, 1);
    const npc = s.simulation.residents.find((r) => r.id === t.id)!;
    npc.contacts = [...new Set([...npc.contacts, "player"])].slice(-30);
  },
});

add({
  id: "life-goal",
  label: "人生の目標を設定",
  target: "person",
  effect: (s, t) => {
    addGoal(s, "player", t.id!, t.amount);
  },
});
add({
  id: "life-goal-pause",
  label: "目標を休止・再開",
  target: "person",
  effect: (s, t) => {
    const g = s.social.goals.find(
      (g) => g.id === t.id && g.actorId === "player",
    );
    if (!g || g.status === "achieved")
      throw Error("変更できる目標ではありません");
    if (
      g.status === "paused" &&
      s.social.goals.some(
        (v) =>
          v.id !== g.id &&
          v.actorId === g.actorId &&
          v.definitionId === g.definitionId &&
          v.status === "active",
      )
    )
      throw Error("同じ目標が取り組み中です");
    g.status = g.status === "active" ? "paused" : "active";
  },
});
add({
  id: "support-npc",
  label: "相談して支え合う",
  category: "social",
  hours: 1,
  target: "npc",
  condition: (s, t) =>
    !bondFor(s, "player", t.id!) ? "まず知り合ってください" : null,
  effect: (s, t) => {
    reserveConversation(s, t.id!, 1);
    converse(s, "player", t.id!, 1, "support");
  },
});
add({
  id: "date-npc",
  label: "交際を相談する",
  category: "social",
  hours: 1,
  target: "npc",
  condition: (s, t) => romanceReason(s, "player", t.id!),
  effect: (s, t) => {
    reserveConversation(s, t.id!, 1);
    startDating(s, "player", t.id!);
  },
});
add({
  id: "marry-npc",
  label: "結婚・共同生活を始める",
  category: "social",
  hours: 2,
  target: "npc",
  cost: () => 5000,
  condition: (s, t) => romanceReason(s, "player", t.id!, true),
  effect: (s, t) => {
    reserveConversation(s, t.id!, 1);
    marry(s, "player", t.id!);
  },
});
add({
  id: "romance-preference",
  label: "交際への希望を変更",
  target: "person",
  effect: (s, t) => {
    if (!["open", "friendship"].includes(t.value!))
      throw Error("希望が不正です");
    profile(s, "player").romance = t.value as "open" | "friendship";
  },
});
add({
  id: "household-deposit",
  label: "共同資金へ積立",
  target: "account",
  effect: (s, t) => contribute(s, "player", t.amount!),
});
add({
  id: "household-withdraw",
  label: "共同資金から返還",
  target: "account",
  effect: (s, t) => contribute(s, "player", t.amount!, true),
});
add({
  id: "household-auto",
  label: "毎月の共同積立を設定",
  target: "account",
  effect: (s, t) => {
    if (!Number.isSafeInteger(t.amount) || t.amount! < 0 || t.amount! > 1000000)
      throw Error("毎月の積立は0〜100万円の整数です");
    const h = s.social.households.find(
      (h) => h.id === profile(s, "player").householdId,
    )!;
    h.contribution.player = t.amount!;
  },
});
add({
  id: "adopt-child",
  label: "子どもを家族に迎える",
  category: "social",
  hours: 2,
  target: "person",
  condition: (s) => adoptionReason(s),
  effect: (s, t) => welcomeChild(s, "player", t.value ?? "青葉 そら"),
});
add({
  id: "npc-life-policy",
  label: "NPCの交際・家族方針を変更",
  target: "none",
  effect: (s, t) => {
    if (t.id !== "npcRelationships" && t.id !== "npcFamily")
      throw Error("方針が不正です");
    s.social.policy[t.id] = t.value === "on";
  },
});

add({
  id: "end-dating",
  label: "交際を終える",
  category: "social",
  hours: 1,
  target: "npc",
  condition: (s, t) =>
    bondFor(s, "player", t.id!)?.status === "dating"
      ? null
      : "交際中の相手を選んでください",
  effect: (s, t) => endDating(s, "player", t.id!),
});

add({
  id: "securities-manage",
  label: "証券口座・投資の指示",
  category: "finance",
  target: "account",
  hours: 0,
  duration: (_s, t) =>
    t.securities?.operation === "ipo"
      ? 2
      : t.securities?.operation === "vote"
        ? 1
        : 0,
  effect: (s, t) => {
    if (!t.securities) throw Error("証券指示がありません");
    executeSecurities(s, t.securities);
  },
});
