import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { newGame, dispatch, advanceDays } from "./engine";
import type { GameState } from "./engine/types";
import type { EnterpriseInput } from "./engine/enterprise/types";
import {
  nav,
  profit,
  verifyEnterprise,
  verifyAccounts,
  companyNAV,
  runEnterpriseDay,
} from "./engine/enterprise";
import { reconcile, liquid, netWorth, receive } from "./engine/finance";
import { demandFor } from "./engine/enterprise/market";
import {
  book,
  consolidatedBook,
  companyProfit,
  companyMonths,
  shareValue,
} from "./engine/enterprise/accounting";
import { registerIndustry } from "./engine/enterprise/registry";
import { industryModules } from "./engine/enterprise";
import { parseSave, validateSave, saveGame, loadGame } from "./persistence";
import v2 from "../tests/fixtures/v2-save.json";
const cmd = (s: GameState, input: EnterpriseInput) =>
  dispatch(s, { type: "enterprise", input });
function setup(industry = "retail", companyId?: string) {
  let s = newGame("事業テスト", "comfortable");
  s.person.skills.digital = 30;
  return cmd(s, {
    operation: "create",
    name: "最初の副業",
    industry,
    amount: 20000,
    price: industry === "retail" ? 700 : industry === "software" ? 900 : 12000,
    companyId,
  });
}
const work = (s: GameState) =>
  dispatch(s, { type: "action", action: "enterprise-work" });
function audit(s: GameState) {
  expect(reconcile(s)).toBe(true);
  for (const v of s.ventures) expect(verifyEnterprise(v)).toBe(true);
  for (const c of s.companies) expect(verifyAccounts(c)).toBe(true);
  expect(validateSave(s)).toEqual(s);
}
describe("Phase 2 共通所有権・会計・時間", () => {
  it("初期投資は資金移動と設備取得で純資産を減らさない", () => {
    const initial = newGame("事業テスト", "comfortable");
    const s = setup();
    expect(liquid(initial) - liquid(s)).toBe(20000);
    expect(s.ventures[0].book.cash).toBe(15000);
    expect(netWorth(s)).toBe(netWorth(initial));
    audit(s);
  });
  it("仕入れは費用でなく在庫、販売時に原価と売上を認識", () => {
    let s = setup();
    s = cmd(s, { operation: "purchase", id: s.ventures[0].id, amount: 20 });
    const v = s.ventures[0];
    expect(v.book.expenses).toBe(0);
    expect(v.book.inventory + v.book.cash).toBe(15000);
    const before = v.book.inventory;
    s = advanceDays(work(s), 1);
    const after = s.ventures[0];
    expect(after.last.units).toBeGreaterThan(0);
    expect(after.book.inventory).toBeLessThan(before);
    expect(after.book.revenue).toBe(after.last.units * 700);
    expect(profit(after)).toBe(after.book.revenue - after.book.expenses);
    audit(s);
  });
  it("需要と販売を区別し在庫切れ・価格弾力性・競合を反映", () => {
    let s = setup();
    const v = s.ventures[0],
      m = industryModules.get("retail")!;
    const cheap = demandFor(s, v, m);
    expect(demandFor(s, { ...v, price: 1400 }, m)).toBeLessThan(cheap);
    expect(
      demandFor({ ...s, world: { ...s.world, competitorQuality: 2 } }, v, m),
    ).toBeLessThan(cheap);
    s = advanceDays(work(s), 1);
    expect(s.ventures[0].last.demand).toBeGreaterThan(0);
    expect(s.ventures[0].last.units).toBe(0);
    audit(s);
  });
  it("仕入れ・投資・資金移動は資金不足で原子的に拒否", () => {
    const s = setup();
    const before = structuredClone(s);
    expect(() =>
      cmd(s, { operation: "purchase", id: s.ventures[0].id, amount: 100000 }),
    ).toThrow("不足");
    expect(() =>
      cmd(s, { operation: "fund", id: s.ventures[0].id, amount: 1000000 }),
    ).toThrow();
    expect(s).toEqual(before);
    audit(s);
  });
  it("アルバイトと事業を両立し本人の時間を複製しない", () => {
    let s = setup();
    s = dispatch(s, { type: "apply", jobId: "cafe" });
    s = cmd(s, {
      operation: "create",
      industry: "freelance",
      name: "第二の副業",
      amount: 10000,
    });
    s = advanceDays(work(s), 30);
    expect(s.employments[0].workedHours).toBeGreaterThan(0);
    expect(s.totals.wages).toBeGreaterThan(0);
    for (const day of s.history) {
      expect(day.blocks.reduce((n, b) => n + b.hours, 0)).toBe(24);
      const assigned = s.ventures.reduce(
        (n, v) =>
          n + (v.history.find((d) => d.date === day.date)?.ownerHours ?? 0),
        0,
      );
      expect(assigned).toBeLessThanOrEqual(day.activityHours + 1e-9);
    }
    audit(s);
  });
  it("設立出資で個人と法人の資金が一致し法人売上は個人現金にならない", () => {
    let s = newGame("資本", "comfortable");
    const initial = liquid(s);
    s = cmd(s, { operation: "create-company", name: "第一社", amount: 30000 });
    expect(liquid(s)).toBe(initial - 40000);
    const c = s.companies[0];
    expect(c.book.cash).toBe(30000);
    s = cmd(s, {
      operation: "create",
      companyId: c.id,
      name: "法人小売",
      industry: "retail",
      amount: 20000,
    });
    expect(s.companies[0].book.cash).toBe(10000);
    expect(companyNAV(s, s.companies[0])).toBe(30000);
    s = cmd(s, { operation: "purchase", id: s.ventures[0].id, amount: 20 });
    const personal = liquid(s);
    runEnterpriseDay(s, 3);
    expect(liquid(s)).toBe(personal);
    expect(s.ventures[0].book.revenue).toBeGreaterThan(0);
    audit(s);
  });
  it("二社の独立した帳簿・追加出資・役員報酬", () => {
    let s = newGame("二社", "comfortable");
    s = cmd(s, { operation: "create-company", name: "A社", amount: 10000 });
    s = cmd(s, { operation: "create-company", name: "B社", amount: 10000 });
    const b = structuredClone(s.companies[1]);
    s = cmd(s, {
      operation: "capital",
      id: s.companies[0].id,
      amount: 1000,
      value: 1,
    });
    const personal = liquid(s);
    s = cmd(s, { operation: "officer", id: s.companies[0].id, amount: 500 });
    expect(liquid(s)).toBe(personal + 500);
    expect(s.companies[1]).toEqual(b);
    expect(s.companies[0].shares).toBe(101);
    expect(s.companies[0].book.expenses).toBe(500);
    audit(s);
  });
  it("元本から配当できず事業利益の回収後のみ配当可能", () => {
    let s = newGame("配当", "comfortable");
    s = cmd(s, { operation: "create-company", name: "配当社", amount: 40000 });
    const id = s.companies[0].id;
    expect(() => cmd(s, { operation: "dividend", id, amount: 1000 })).toThrow(
      "稼得利益",
    );
    s = cmd(s, {
      operation: "create",
      companyId: id,
      name: "小売",
      industry: "retail",
      amount: 20000,
    });
    s = cmd(s, { operation: "purchase", id: s.ventures[0].id, amount: 30 });
    s = advanceDays(work(s), 7);
    s = cmd(s, { operation: "withdraw", id: s.ventures[0].id, amount: 1000 });
    const before = liquid(s);
    s = cmd(s, { operation: "dividend", id, amount: 1000 });
    expect(liquid(s)).toBe(before + 1000);
    expect(s.companies[0].dividends).toBe(1000);
    audit(s);
  });
  it("個人事業の法人移管で個人純資産を二重計上しない", () => {
    let s = setup();
    s = cmd(s, { operation: "create-company", name: "移管先", amount: 10000 });
    const before = netWorth(s);
    s = cmd(s, {
      operation: "incorporate",
      id: s.ventures[0].id,
      companyId: s.companies[0].id,
    });
    expect(netWorth(s)).toBe(before);
    expect(s.ventures[0].ownerId).toBe(s.companies[0].id);
    audit(s);
  });
  it("請負は納品と現金回収を区別し高評価で継続顧客を維持", () => {
    let s = setup("freelance");
    s = dispatch(s, {
      type: "routine",
      routine: { activityHours: 8, weekendHours: 8 },
    });
    s = advanceDays(work(s), 1);
    let v = s.ventures[0];
    expect(v.book.revenue).toBe(12000);
    expect(v.book.receivables).toBe(12000);
    expect(v.orders[0].status).toBe("invoiced");
    const first = v.orders[0].clientId;
    s = advanceDays(s, 7);
    v = s.ventures[0];
    expect(v.orders[0].status).toBe("paid");
    expect(v.orders.filter((o) => o.clientId === first).length).toBeGreaterThan(
      1,
    );
    audit(s);
  });
  it("デジタル事業は開発完了後に顧客を獲得し30日後に課金", () => {
    let s = setup("software");
    s = cmd(s, { operation: "fund", id: s.ventures[0].id, amount: 20000 });
    s = dispatch(s, {
      type: "routine",
      routine: { activityHours: 8, weekendHours: 8 },
    });
    s = advanceDays(work(s), 5);
    expect(s.ventures[0].development).toBe(24);
    expect(s.ventures[0].subscribers.length).toBeGreaterThan(0);
    expect(s.ventures[0].book.revenue).toBe(0);
    s = advanceDays(s, 35);
    expect(s.ventures[0].book.revenue).toBeGreaterThan(0);
    audit(s);
  });
  it("従業員は賃金と引き換えに作業し休息中にも事業が動く", () => {
    let s = setup();
    s = cmd(s, { operation: "purchase", id: s.ventures[0].id, amount: 20 });
    s = cmd(s, {
      operation: "hire",
      id: s.ventures[0].id,
      policy: "production",
    });
    s = advanceDays(s, 1);
    expect(s.ventures[0].last.ownerHours).toBe(0);
    expect(s.ventures[0].last.staffHours).toBe(4);
    expect(s.ventures[0].employees[0].paid).toBe(4400);
    expect(s.ventures[0].book.revenue).toBeGreaterThan(0);
    audit(s);
  });
  it("払えない賃金で無料労働を作らない", () => {
    let s = setup();
    s = cmd(s, { operation: "hire", id: s.ventures[0].id });
    s = cmd(s, {
      operation: "withdraw",
      id: s.ventures[0].id,
      amount: s.ventures[0].book.cash,
    });
    s = advanceDays(s, 1);
    expect(s.ventures[0].employees[0].workedHours).toBe(0);
    expect(s.ventures[0].book.debt).toBeGreaterThan(0);
    audit(s);
  });
  it("閉鎖しても負債と返品義務は消えず補填後に精算できる", () => {
    let s = setup();
    const id = s.ventures[0].id;
    s = cmd(s, { operation: "withdraw", id, amount: 15000 });
    s = advanceDays(s, 100);
    s = cmd(s, { operation: "close", id });
    expect(s.ventures[0].status).toBe("closed");
    expect(s.ventures[0].book.debt).toBeGreaterThan(0);
    expect(s.ventures[0].book.equipment).toBe(0);
    expect(() => cmd(s, { operation: "purchase", id, amount: 1 })).toThrow(
      "閉鎖",
    );
    receive(s, 300000, "テスト収入");
    s = cmd(s, { operation: "fund", id, amount: 10000 });
    expect(s.ventures[0].book.debt).toBe(0);
    s = advanceDays(s, 1);
    audit(s);
  });
  it("返品と在庫陳腐化を処理する", () => {
    let s = setup();
    const id = s.ventures[0].id;
    s = cmd(s, { operation: "purchase", id, amount: 20 });
    s.ventures[0].quality = 0;
    s = advanceDays(work(s), 20);
    expect(s.ventures[0].journal.some((e) => e.label.includes("返品"))).toBe(
      true,
    );
    s = cmd(s, { operation: "pause", id });
    s = cmd(s, { operation: "purchase", id, amount: 2 });
    s = advanceDays(advanceDays(s, 365), 1);
    expect(s.ventures[0].book.inventory).toBe(0);
    expect(s.ventures[0].journal.some((e) => e.label.includes("陳腐化"))).toBe(
      true,
    );
    audit(s);
  });
  it("法人解散は清算前に拒否し残余資産を分配", () => {
    let s = newGame("解散", "comfortable");
    s = cmd(s, { operation: "create-company", name: "会社", amount: 20000 });
    const id = s.companies[0].id;
    s = cmd(s, {
      operation: "create",
      name: "事業",
      industry: "retail",
      amount: 10000,
      companyId: id,
    });
    expect(() => cmd(s, { operation: "dissolve", id, amount: 1 })).toThrow(
      "全事業",
    );
    s = cmd(s, { operation: "close", id: s.ventures[0].id });
    s = cmd(s, {
      operation: "withdraw",
      id: s.ventures[0].id,
      amount: s.ventures[0].book.cash,
    });
    const before = liquid(s);
    s = cmd(s, { operation: "dissolve", id, amount: 1 });
    expect(liquid(s)).toBeGreaterThan(before);
    expect(s.companies[0].status).toBe("dissolved");
    expect(companyNAV(s, s.companies[0])).toBe(0);
    audit(s);
  });
  it("複数事業と会社の1年進行は日次と早送りで一致し保存できる", async () => {
    let s = setup();
    s = cmd(s, {
      operation: "reorder",
      id: s.ventures[0].id,
      amount: 10,
      value: 30,
    });
    s = cmd(s, { operation: "create-company", name: "会社", amount: 10000 });
    s = dispatch(s, { type: "apply", jobId: "cafe" });
    s = work(s);
    const fast = advanceDays(s, 365);
    let daily = s;
    for (let i = 0; i < 365; i++) daily = advanceDays(daily, 1);
    expect(fast).toEqual(daily);
    audit(fast);
    expect(parseSave(JSON.stringify(fast))).toEqual(fast);
    await saveGame(3, fast);
    expect(await loadGame(3)).toEqual(fast);
  });
  it("v2の現金・事業・給与・能力を保存移行後も維持", () => {
    const s = validateSave(v2);
    expect(s.schemaVersion).toBe(3);
    expect(s.business).toEqual(v2.business);
    expect(s.cash).toBe(v2.cash);
    expect(s.assets).toEqual(v2.assets);
    expect(s.person).toEqual(v2.person);
    expect(s.ventures).toEqual([]);
    audit(advanceDays(s, 30));
  });
  it("改ざんした会社・事業帳簿と株式構成を拒否", () => {
    let s = setup();
    s = cmd(s, { operation: "create-company", name: "検証", amount: 10000 });
    const bad = structuredClone(s);
    bad.companies[0].book.cash++;
    expect(() => validateSave(bad)).toThrow("帳簿");
    const bad2 = structuredClone(s);
    bad2.ventures[0].book.inventory++;
    expect(() => validateSave(bad2)).toThrow();
    const bad3 = structuredClone(s);
    bad3.companies[0].shareholders[0].shares++;
    expect(() => validateSave(bad3)).toThrow();
  });
  it("非公開株の一部売却は個人間取引で会社現金を変えない", () => {
    expect(shareValue(9000000000000001, 79, 101)).toBe(7039603960396040);
    let s = newGame("株主", "comfortable");
    s = cmd(s, {
      operation: "create-company",
      name: "共同保有",
      amount: 10000,
    });
    s.relationships.push({
      npcId: s.npcs[0].id,
      affinity: 50,
      trust: 50,
      met: s.date,
      interactions: 1,
    });
    const c = s.companies[0],
      cash = c.book.cash,
      before = liquid(s);
    s = cmd(s, {
      operation: "sell-shares",
      id: c.id,
      amount: 10,
      npcId: s.npcs[0].id,
    });
    expect(s.companies[0].book.cash).toBe(cash);
    expect(s.companies[0].shareholders[0].shares).toBe(90);
    expect(liquid(s)).toBe(before + 1000);
    audit(s);
  });
  it("移管前の個人利益を法人の配当可能利益にしない", () => {
    let s = setup("freelance");
    s = advanceDays(work(s), 20);
    expect(profit(s.ventures[0])).toBeGreaterThan(0);
    receive(s, 50000, "追加給与");
    s = cmd(s, { operation: "create-company", name: "移管", amount: 10000 });
    const c = s.companies[0];
    s = cmd(s, {
      operation: "incorporate",
      id: s.ventures[0].id,
      companyId: c.id,
    });
    expect(companyProfit(s, s.companies[0])).toBe(0);
    expect(consolidatedBook(s, s.companies[0]).revenue).toBe(0);
    expect(() =>
      cmd(s, { operation: "dividend", id: c.id, amount: 1000 }),
    ).toThrow();
    audit(s);
  });
  it("会社と事業の内部資金移動を連結キャッシュフローで相殺", () => {
    let s = newGame("連結", "comfortable");
    s = cmd(s, { operation: "create-company", name: "連結社", amount: 30000 });
    s = cmd(s, {
      operation: "create",
      companyId: s.companies[0].id,
      name: "事業",
      industry: "retail",
      amount: 20000,
    });
    const b = consolidatedBook(s, s.companies[0]);
    expect(b.cash).toBe(25000);
    expect(b.equipment).toBe(5000);
    expect(b.equity).toBe(30000);
    const m = companyMonths(s, s.companies[0])[0];
    expect(m.cashFlow).toBe(25000);
    expect(m.funding).toBe(30000);
    audit(s);
  });
  it("新業界は登録だけで所有権・時間・帳簿・独自データ・保存を利用", () => {
    registerIndustry({
      id: "lesson-test",
      name: "学習支援",
      description: "登録例",
      skill: "service",
      setup: 1000,
      basePrice: 1000,
      market: 200,
      capacity: 1,
      minimumSkill: 0,
      initialize: (_s, v) => {
        v.data.lessons = 0;
      },
      tick: (s, v, h, d) => {
        const n = Math.min(Math.floor(h), d);
        if (n) {
          book(s, v, "授業料", { cash: n * v.price, revenue: n * v.price });
          v.data.lessons = Number(v.data.lessons) + n;
        }
        return n;
      },
    });
    let s = newGame("拡張", "comfortable");
    s = cmd(s, {
      operation: "create",
      name: "学習会",
      industry: "lesson-test",
      amount: 10000,
    });
    s = advanceDays(work(s), 7);
    expect(Number(s.ventures[0].data.lessons)).toBeGreaterThan(0);
    audit(s);
    expect(parseSave(JSON.stringify(s)).ventures[0].data).toEqual(
      s.ventures[0].data,
    );
  });
  it("期限切れ案件の解約費と会社清算前の返品義務を維持", () => {
    let s = setup("freelance");
    s = cmd(s, { operation: "accept", id: s.ventures[0].id });
    s = advanceDays(s, 16);
    expect(s.ventures[0].orders[0].status).toBe("cancelled");
    expect(s.ventures[0].book.expenses).toBeGreaterThanOrEqual(1200);
    audit(s);
  });
});
