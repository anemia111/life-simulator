import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { newGame, dispatch, advanceDays } from "./engine";
import type { GameState, ActionTarget } from "./engine/types";
import { addGoal, updateGoals, learningFocus } from "./engine/goals";
import {
  profile,
  household,
  householdClaim,
  careHours,
  bondFor,
  npcFree,
} from "./engine/social/selectors";
import {
  converse,
  ensureBond,
  romanceReason,
  startDating,
  prepareSocialDay,
} from "./engine/social/relationships";
import {
  contribute,
  householdExpense,
  marry,
  welcomeChild,
  verifyHouseholds,
  adoptionReason,
} from "./engine/social/households";
import { verifySocial } from "./engine/social/schema";
import { remember } from "./engine/events";
import { book, verifyAccounts, nav } from "./engine/enterprise/accounting";
import { receive, netWorth, reconcile } from "./engine/finance";
import {
  assertSchedule,
  buildDayPlan,
  availableHours,
} from "./engine/schedule";
import { verifySimulation, changeJob } from "./engine/simulation";
import { age } from "./engine/person";
import { parseSave, validateSave, saveGame, loadGame } from "./persistence";
import fixture from "../tests/fixtures/v5-save.json";
const exec = (s: GameState, id: string, target: ActionTarget = {}) =>
  dispatch(s, { type: "execute", actionId: id, target });
function couple() {
  let s = newGame("家族の暮らし", "comfortable");
  s.social.policy = { npcRelationships: false, npcFamily: false };
  s = dispatch(s, { type: "apply", jobId: "cafe" });
  s = advanceDays(s, 100);
  const id = [...s.simulation.residents].sort(
    (a, b) => b.book.cash - a.book.cash,
  )[0].id;
  profile(s, id).romance = "open";
  profile(s, "player").romance = "open";
  const b = ensureBond(s, "player", id);
  Object.assign(b, {
    affinityA: 95,
    affinityB: 95,
    trustA: 95,
    trustB: 95,
    attraction: 90,
  });
  startDating(s, "player", id);
  b.since = s.started;
  marry(s, "player", id);
  return { s, id };
}
function audit(s: GameState) {
  expect(verifyHouseholds(s)).toBe(true);
  expect(verifySocial(s)).toBe(true);
  expect(verifySimulation(s)).toBe(true);
  expect(reconcile(s)).toBe(true);
  expect(parseSave(JSON.stringify(s))).toEqual(s);
  for (const r of s.simulation.residents)
    expect(Object.values(r.hours).reduce((n, h) => n + h, 0)).toBe(24);
}
describe("Phase 5 人生・NPC・家族", () => {
  it("プレイヤーに強制目標がなく、NPCには価値観と長期目標がある", () => {
    const s = newGame("自由");
    expect(s.social.goals.filter((g) => g.actorId === "player")).toEqual([]);
    expect(s.social.profiles).toHaveLength(s.npcs.length + 1);
    expect(
      s.simulation.residents.every((r) =>
        s.social.goals.some((g) => g.actorId === r.id),
      ),
    ).toBe(true);
    audit(s);
  });
  it("選んだ目標を休止・再開し、達成は年表へ一度だけ残る", () => {
    let s = newGame("目標");
    s = exec(s, "life-goal", { id: "reserve", amount: 20000 });
    expect(s.social.goals.find((g) => g.actorId === "player")!.status).toBe(
      "achieved",
    );
    const count = profile(s, "player").timeline.length;
    updateGoals(s);
    expect(profile(s, "player").timeline).toHaveLength(count);
    s = exec(s, "life-goal", { id: "learn-digital" });
    const g = s.social.goals.at(-1)!;
    s = exec(s, "life-goal-pause", { id: g.id });
    expect(s.social.goals.at(-1)!.status).toBe("paused");
    s = exec(s, "life-goal-pause", { id: g.id });
    expect(s.social.goals.at(-1)!.status).toBe("active");
    audit(s);
  });
  it("同じ目標の重複と不正な値を原子的に拒否する", () => {
    let s = newGame("選択");
    s = exec(s, "life-goal", { id: "reserve" });
    const before = JSON.stringify(s);
    expect(() => exec(s, "life-goal", { id: "reserve" })).toThrow();
    expect(() => exec(s, "life-goal", { id: "family", amount: -1 })).toThrow();
    expect(JSON.stringify(s)).toBe(before);
  });
  it("NPCの学習目標が実際に学ぶ技能を変える", () => {
    const s = newGame("学習"),
      id = s.simulation.residents[0].id;
    addGoal(s, id, "learn-digital");
    expect(learningFocus(s, id, "craft")).toBe("digital");
    const before = profile(s, id).stress;
    const n = advanceDays(s, 1);
    expect(n.npcs.find((p) => p.id === id)!.skills.digital).toBeGreaterThan(
      s.npcs.find((p) => p.id === id)!.skills.digital,
    );
    expect(profile(n, id).stress).toBeLessThanOrEqual(before + 1);
  });
  it("相互の関係が育ち友情の節目を重複せず記録する", () => {
    const s = newGame("友人"),
      id = s.npcs[0].id;
    for (let i = 0; i < 12; i++) converse(s, "player", id);
    const b = bondFor(s, "player", id)!;
    expect(b.status).toBe("friend");
    expect(b.affinityA).toBeGreaterThan(35);
    expect(b.affinityB).toBeGreaterThan(35);
    expect(s.relationships[0].interactions).toBe(12);
    expect(
      profile(s, "player").timeline.filter((e) => e.kind === "friendship"),
    ).toHaveLength(1);
    expect(
      profile(s, id).timeline.filter((e) => e.kind === "friendship"),
    ).toHaveLength(1);
    audit(s);
  });
  it("交流はプレイヤーとNPCの時間を消費し二重予約しない", () => {
    let s = newGame("交流");
    const id = s.npcs[0].id;
    s = exec(s, "meet-npc", { id });
    const reserved = s.social.today.npcHours[id];
    expect(reserved).toBe(1);
    expect(s.manualActions[0].hours).toBeGreaterThanOrEqual(1);
    s = advanceDays(s, 1);
    const r = s.simulation.residents.find((r) => r.id === id)!;
    expect(r.hours.social).toBeGreaterThanOrEqual(1);
    expect(Object.values(r.hours).reduce((n, h) => n + h, 0)).toBe(24);
    audit(s);
  });
  it("相手の自由時間を超える交流は資金も関係も変えず拒否する", () => {
    let s = newGame("多忙");
    const id = s.npcs[0].id;
    s = exec(s, "meet-npc", { id });
    s.social.today.npcHours[id] = 24;
    const before = JSON.stringify(s);
    expect(() => exec(s, "meet-npc", { id })).toThrow(/相手/);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("交際に双方の信頼・成人・希望・既存パートナーを必要とする", () => {
    const s = newGame("同意"),
      id = s.npcs[0].id,
      b = ensureBond(s, "player", id);
    Object.assign(b, {
      affinityA: 100,
      affinityB: 10,
      trustA: 100,
      trustB: 10,
    });
    expect(romanceReason(s, "player", id)).toBeTruthy();
    Object.assign(b, { affinityB: 100, trustB: 100, attraction: 90 });
    profile(s, id).romance = "friendship";
    expect(romanceReason(s, "player", id)).toMatch(/友情/);
    profile(s, id).romance = "open";
    s.npcs[0].birthDate = "2012-04-01";
    expect(romanceReason(s, "player", id)).toMatch(/成人/);
    s.npcs[0].birthDate = "1985-06-15";
    expect(romanceReason(s, "player", id)).toBeNull();
    startDating(s, "player", id);
    expect(profile(s, id).partnerId).toBe("player");
    expect(profile(s, "player").partnerId).toBe(id);
    expect(romanceReason(s, "player", id, true)).toMatch(/90日/);
  });
  it("家族間の交際を拒否する", () => {
    const { s, id } = couple();
    profile(s, "player").parents.push(id);
    expect(romanceReason(s, "player", id)).toMatch(/家族/);
  });
  it("結婚後も個人資金は別で、世帯への出入金が純資産を変えない", () => {
    const { s, id } = couple();
    expect(household(s, id)).toBe(household(s, "player"));
    const before = netWorth(s),
      cash = s.cash + s.bank,
      npc = s.simulation.residents.find((r) => r.id === id)!.book.cash;
    contribute(s, "player", 10000);
    expect(s.cash + s.bank).toBe(cash - 10000);
    expect(householdClaim(s)).toBe(10000);
    expect(netWorth(s)).toBe(before);
    expect(s.simulation.residents.find((r) => r.id === id)!.book.cash).toBe(
      npc,
    );
    contribute(s, "player", 5000, true);
    expect(netWorth(s)).toBe(before);
    audit(s);
  });
  it("共同支出を円整数で分担し、未払いと負の持分を消さない", () => {
    const { s, id } = couple();
    contribute(s, "player", 10000);
    const h = household(s, "player"),
      before = netWorth(s);
    householdExpense(s, h, 15001, "共同生活");
    expect(h.book.cash).toBe(0);
    expect(h.book.debt).toBe(5001);
    expect(Object.values(h.claims).reduce((n, v) => n + v, 0)).toBe(nav(h));
    expect([10000 - h.claims.player, -h.claims[id]].sort()).toEqual([
      7500, 7501,
    ]);
    expect(netWorth(s)).toBe(before - (10000 - h.claims.player));
    expect(() => contribute(s, "player", 1, true)).toThrow(/未払い/);
    audit(s);
  });
  it("他人の積立は自分の持分として引き出せない", () => {
    const { s, id } = couple();
    contribute(s, id, 10000);
    expect(() => contribute(s, "player", 1, true)).toThrow(/持分/);
    expect(household(s, id).book.cash).toBe(10000);
    audit(s);
  });
  it("共同家賃は月一回で二重課金されず、NPCも実資金を積立する", () => {
    let { s, id } = couple();
    contribute(s, "player", 50000);
    const beforeNpc = s.simulation.residents.find((r) => r.id === id)!.book
      .cash;
    s = advanceDays(s, 30);
    const h = household(s, "player");
    expect(h.journal.filter((e) => e.label === "共同家賃")).toHaveLength(1);
    expect(
      s.ledger.filter(
        (e) =>
          e.date.slice(0, 7) === s.date.slice(0, 7) && / 家賃$/.test(e.label),
      ),
    ).toHaveLength(0);
    expect(h.journal.some((e) => e.label === "共同資金の積立")).toBe(true);
    expect(beforeNpc).toBeGreaterThan(0);
    audit(s);
  });
  it("実際の子育ては住居・共同予算・時間を必要とし、子どもは働かない", () => {
    let { s, id } = couple();
    expect(adoptionReason(s)).toMatch(/住居/);
    s = exec(s, "map-move", { id: "campus-family" });
    contribute(s, "player", 70000);
    expect(adoptionReason(s)).toMatch(/20歳/);
    s.person.birthDate = "2000-04-01";
    expect(adoptionReason(s)).toBeNull();
    const cash = household(s, "player").book.cash;
    s = exec(s, "adopt-child", { value: "青葉 ひなた" });
    const child = s.npcs.at(-1)!;
    expect(age(child, s.date)).toBe(5);
    expect(profile(s, child.id).parents.sort()).toEqual(["player", id].sort());
    expect(household(s, "player").book.cash).toBe(cash - 15000);
    expect(careHours(s, "player") + careHours(s, id)).toBe(0.5);
    expect(s.simulation.residents.some((r) => r.id === child.id)).toBe(false);
    const n = advanceDays(s, 1);
    expect(n.simulation.residents.some((r) => r.id === child.id)).toBe(false);
    expect(buildDayPlan(n).reduce((a, b) => a + b.hours, 0)).toBe(24);
    expect(
      n.history.at(-1)!.blocks.some((b) => b.kind === "care") ||
        n.simulation.residents.find((r) => r.id === id)!.hours.care > 0,
    ).toBe(true);
    audit(n);
  });
  it("養育時間で自由時間が減り、予定超過の養育開始は原子的に拒否される", () => {
    let { s, id } = couple();
    s.person.birthDate = "2000-04-01";
    s = exec(s, "map-move", { id: "campus-family" });
    contribute(s, "player", 70000);
    const free = availableHours(s);
    s = exec(s, "adopt-child", { value: "家族の子" });
    expect(availableHours(s)).toBe(free - careHours(s, "player"));
    expect(() => exec(s, "map-move", { id: "campus-share" })).toThrow(/家族/);
    audit(s);
  });
  it("重要年表は残し、日常の記憶だけを直近24件に抑える", () => {
    const s = newGame("記憶");
    remember(s, "player", "closure", "事業を閉じた");
    const risk = profile(s, "player").riskTolerance;
    for (let i = 0; i < 50; i++)
      remember(s, "player", "conversation", "日常の会話", [], false);
    expect(profile(s, "player").memories).toHaveLength(24);
    expect(profile(s, "player").timeline[0].text).toBe("事業を閉じた");
    expect(risk).toBeLessThan(75);
    audit(s);
  });
  it("就職・退職・目標達成は実際の変更から年表に記録する", () => {
    let s = newGame("経歴");
    s = dispatch(s, { type: "apply", jobId: "cafe" });
    expect(profile(s, "player").timeline.some((e) => e.kind === "career")).toBe(
      true,
    );
    s = advanceDays(s, 1);
    s = dispatch(s, { type: "quit" });
    expect(
      profile(s, "player").timeline.filter((e) => e.kind === "career"),
    ).toHaveLength(2);
    audit(s);
  });
  it(
    "NPC同士が自主交流し、交際・結婚・生活の変化が実際に起きる",
    { timeout: 30000 },
    () => {
      const s = advanceDays(advanceDays(newGame("街の人生"), 365), 365);
      expect(s.social.stats.friendships).toBeGreaterThan(0);
      expect(s.social.stats.partnerships).toBeGreaterThan(0);
      expect(s.social.stats.marriages).toBeGreaterThan(0);
      expect(
        s.social.bonds.some(
          (b) => b.a !== "player" && b.b !== "player" && b.interactions > 0,
        ),
      ).toBe(true);
      audit(s);
    },
  );
  it("v5の実セーブを資金・事業・勤務・乱数・地図を保持して移行する", () => {
    const s = validateSave(fixture);
    expect(s.schemaVersion).toBe(6);
    for (const key of [
      "cash",
      "bank",
      "debt",
      "ventures",
      "companies",
      "spatial",
      "employments",
    ] as const)
      expect(s[key]).toEqual(fixture[key]);
    expect(s.simulation.randomState).toBe(fixture.simulation.randomState);
    expect(s.social.profiles.every((p) => p.timeline.length === 0)).toBe(true);
    audit(advanceDays(s, 1));
  });
  it("家族・目標・記憶・共同会計をJSONとIndexedDBへ往復する", async () => {
    let { s } = couple();
    contribute(s, "player", 10000);
    s = exec(s, "life-goal", { id: "reserve", amount: 500000 });
    await saveGame(1, s);
    expect(await loadGame(1)).toEqual(s);
    expect(advanceDays(await loadGame(1), 30)).toEqual(advanceDays(s, 30));
    audit(s);
  });
  it("不正な持分・相互参照・目標・年表・血縁循環のセーブを拒否する", () => {
    const { s, id } = couple();
    for (const damage of [
      (n: GameState) => {
        const h = household(n, "player"),
          outside = n.npcs.find((p) => !h.adults.includes(p.id))!.id;
        h.claims[outside] = 1;
        h.claims.player -= 1;
      },
      (n: GameState) => {
        const goal = addGoal(n, "player", "reserve", 500000);
        n.social.goals.push({ ...goal, id: "goal-" + ++n.sequence });
      },
      (n: GameState) => {
        prepareSocialDay(n);
        n.social.today.npcHours[id] = 24;
      },
      (n: GameState) => {
        household(n, "player").claims.player += 1;
      },
      (n: GameState) => {
        profile(n, id).partnerId = null;
      },
      (n: GameState) => {
        profile(n, id).parents = ["player"];
        profile(n, "player").parents = [id];
        profile(n, id).children = ["player"];
        profile(n, "player").children = [id];
      },
      (n: GameState) => {
        profile(n, "player").timeline.push({
          id: n.sequence + 1,
          date: n.date,
          kind: "bad",
          text: "bad",
          relatedIds: [],
        });
      },
    ]) {
      const n = structuredClone(s);
      damage(n);
      expect(() => validateSave(n)).toThrow();
    }
  });
  it(
    "同じシードの一括・日次・保存後の進行で人生の結果が一致する",
    { timeout: 30000 },
    () => {
      const start = newGame("再現", "comfortable", 12345);
      const fast = advanceDays(start, 365);
      let daily = start;
      for (let i = 0; i < 365; i++) daily = advanceDays(daily, 1);
      expect(fast).toEqual(daily);
      expect(advanceDays(parseSave(JSON.stringify(fast)), 30)).toEqual(
        advanceDays(fast, 30),
      );
      audit(fast);
    },
  );
  it("養育のための0.5時間も24hへ予約し、満杯の手動予定では迎え入れを拒否する", () => {
    let { s } = couple();
    s.person.birthDate = "2000-04-01";
    s = exec(s, "map-move", { id: "campus-family" });
    contribute(s, "player", 70000);
    s = exec(s, "adopt-child", { value: "最初の子" });
    s = advanceDays(s, 1);
    receive(s, 100000, "養育時間試験の開始資産");
    contribute(s, "player", 20000);
    const free = availableHours(s);
    for (let i = 0; i < free - 2; i++) s = exec(s, "rest");
    const before = JSON.stringify(s);
    expect(() => exec(s, "adopt-child", { value: "次の子" })).toThrow(/時間/);
    expect(JSON.stringify(s)).toBe(before);
    s = advanceDays(s, 1);
    s = exec(s, "adopt-child", { value: "次の子" });
    expect(careHours(s, "player")).toBe(0.5);
    s = advanceDays(s, 1);
    expect(
      s.history
        .at(-1)!
        .blocks.filter((b) => b.kind === "care")
        .reduce((n, b) => n + b.hours, 0),
    ).toBe(0.5);
    audit(s);
  });
  it("交際を終えると双方のパートナーを解除し記録を残す", () => {
    let s = newGame("別々の道");
    const id = s.npcs[0].id;
    profile(s, id).romance = "open";
    const b = ensureBond(s, "player", id);
    Object.assign(b, {
      affinityA: 90,
      affinityB: 90,
      trustA: 80,
      trustB: 80,
      attraction: 90,
    });
    startDating(s, "player", id);
    s = exec(s, "end-dating", { id });
    expect(profile(s, id).partnerId).toBeNull();
    expect(profile(s, "player").partnerId).toBeNull();
    expect(profile(s, "player").timeline.at(-1)!.kind).toBe("separation");
    audit(s);
  });
});
