import { describe, it, expect } from "vitest";
import { newGame, advanceDays, dispatch } from "./engine";
import { initialSimulation, makeFirm } from "./engine/simulation/initial";
import {
  beginWorldDay,
  closeFirm,
  firmDecisions,
  npcDecisions,
  changeJob,
  verifySimulation,
  random,
  economyMonth,
  occupiedByAI,
} from "./engine/simulation";
import {
  snapshotMarkets,
  allocateMarket,
  quotedRent,
} from "./engine/simulation/market";
import { industryModules } from "./engine/enterprise/registry";
import { book, verifyAccounts } from "./engine/enterprise/accounting";
import { tenant, property } from "./engine/spatial/selectors";
import { reconcile } from "./engine/finance";
import { parseSave, validateSave, saveGame, loadGame } from "./persistence";
import { indexedDB } from "fake-indexeddb";
import fixture from "../tests/fixtures/v4-save.json";
const audit = (s: ReturnType<typeof newGame>) => {
  expect(verifySimulation(s)).toBe(true);
  expect(reconcile(s)).toBe(true);
  for (const a of [...s.simulation.firms, ...s.simulation.residents])
    expect(verifyAccounts(a)).toBe(true);
};
describe("Phase 4 自律世界と有限市場", () => {
  it("旧版から個人残高・勤務・マップ・既存企業資金を維持して移行", () => {
    const s = validateSave(fixture);
    expect(s.schemaVersion).toBe(5);
    expect(s.cash).toBe(fixture.cash);
    expect(s.spatial).toEqual(fixture.spatial);
    expect(s.ventures).toEqual(fixture.ventures);
    expect(s.simulation.firms.find((f) => f.id === "cafe-co")!.book.cash).toBe(
      fixture.organizations.find((o) => o.id === "cafe-co")!.cash,
    );
    audit(s);
  });
  it("NPCが能力と求人を比較して自主就職し日次に賃金・経験と生活費を得る", () => {
    const s = advanceDays(newGame("NPC"), 7);
    expect(
      s.simulation.residents.some(
        (r) => r.jobId && r.earned > 0 && r.consumed > 0,
      ),
    ).toBe(true);
    expect(s.simulation.news.some((n) => n.kind === "hire")).toBe(true);
    audit(s);
  });
  it("通勤を含む24時間制約と性格・所得による生活水準", () => {
    const s = advanceDays(newGame("生活"), 60);
    for (const r of s.simulation.residents) {
      expect(Object.values(r.hours).reduce((n, v) => n + v, 0)).toBe(24);
      expect(r.hours.free).toBeGreaterThanOrEqual(0);
    }
    expect(
      new Set(s.simulation.residents.map((r) => r.standard)).size,
    ).toBeGreaterThan(1);
    audit(s);
  });
  it("より高い賃金の企業へ移ると旧企業と新企業の雇用参照も変わる", () => {
    const s = newGame("転職");
    const r = s.simulation.residents.find((r) => r.id === "resident-5")!;
    const p = s.npcs.find((p) => p.id === r.id)!;
    p.skills = { service: 90, craft: 90, digital: 90 };
    r.motive = "income";
    changeJob(s, r, "cafe");
    const design = s.simulation.firms.find((f) => f.id === "design-co")!;
    design.wageIndex = 1.5;
    for (let i = 0; i < 12 && r.jobId === "cafe"; i++) npcDecisions(s);
    expect(r.jobId).not.toBe("cafe");
    expect(
      s.simulation.firms.find((f) => f.id === "cafe-co")!.employees,
    ).not.toContain(r.id);
    expect(r.changes).toBeGreaterThan(1);
    audit(s);
  });
  it("価格・品質・競合出店で需要が変わり総配分は有限", () => {
    const s = newGame("市場");
    const m = industryModules.get("retail")!;
    const a = allocateMarket(s, m);
    const first = s.simulation.firms[0];
    const before = a.allocations[first.id];
    const rival = makeFirm(
      s,
      "test-rival",
      "新しい競合",
      s.npcs[0].id,
      "campus-shop",
    );
    rival.quality = 90;
    rival.price = 400;
    s.simulation.firms.push(rival);
    const b = allocateMarket(s, m);
    expect(b.allocations[first.id]).toBeLessThan(before);
    expect(
      Object.values(b.allocations).reduce((n, v) => n + v, 0),
    ).toBeLessThanOrEqual(b.pool);
    rival.price = 2000;
    expect(allocateMarket(s, m).allocations[rival.id]).toBeLessThan(
      b.allocations[rival.id],
    );
  });
  it("資金不足の企業は採用・拡大せず撤退し、残債務が残る", () => {
    let s = newGame("撤退");
    const f = s.simulation.firms[0];
    book(s, f, "経営危機", {
      cash: -f.book.cash,
      debt: 100000,
      expenses: f.book.cash + 100000,
    });
    f.lossDays = 30;
    s = advanceDays(s, 1);
    const closed = s.simulation.firms[0];
    expect(closed.status).toBe("closed");
    expect(closed.book.debt).toBeGreaterThan(0);
    expect(closed.sites).toEqual([]);
    expect(s.vacancies.find((v) => v.employerId === f.id)!.openings).toBe(0);
    expect(
      s.simulation.news.some(
        (n) => n.kind === "closure" && n.entityId === f.id,
      ),
    ).toBe(true);
    audit(s);
  });
  it("資金・実績に余力がある企業が出店しマップの入居と一致する", () => {
    const s = newGame("出店");
    s.date = "2026-05-01";
    const f = s.simulation.firms[0];
    f.monthProfit = 80000;
    firmDecisions(s);
    expect(f.sites.length).toBe(2);
    const id = f.sites[1];
    expect(tenant(s, property(id))).toBe(f.id);
    expect(
      s.simulation.news.some(
        (n) => n.kind === "opening" && n.entityId === f.id,
      ),
    ).toBe(true);
    expect(f.book.cash).toBeLessThan(500000);
    audit(s);
  });
  it("プレイヤーが契約した物件はAIが取得しない", () => {
    let s = newGame("物件");
    s = dispatch(s, {
      type: "enterprise",
      input: {
        operation: "create",
        name: "小売",
        industry: "retail",
        amount: 20000,
        region: "central",
        product: "stationery",
      },
    });
    const v = s.ventures[0];
    book(s, v, "試験資金", { cash: 100000, equity: 100000 });
    s = dispatch(s, {
      type: "execute",
      actionId: "map-lease",
      target: { id: "campus-shop", value: v.id },
    });
    s.date = "2026-05-01";
    for (const f of s.simulation.firms) f.monthProfit = 80000;
    firmDecisions(s);
    expect(occupiedByAI(s, "campus-shop")).toBe(null);
    expect(tenant(s, property("campus-shop"))).toBe(v.id);
  });
  it("閉鎖すると社員が失職し勤務地が空室になる", () => {
    const s = newGame("閉店");
    const r = s.simulation.residents.at(-1)!;
    changeJob(s, r, "cafe");
    const f = s.simulation.firms[0];
    closeFirm(s, f);
    expect(r.jobId).toBe(null);
    expect(s.npcs.find((p) => p.id === r.id)!.employerId).toBe(null);
    expect(tenant(s, property("work-cafe"))).toBe(null);
    audit(s);
  });
  it("月次に人口合計・失業・物価・家賃・地価が企業活動へ反応する", () => {
    const s = newGame("不況");
    for (const f of s.simulation.firms) closeFirm(s, f);
    const old = s.world.economy;
    economyMonth(s);
    expect(s.world.economy).toBeLessThan(old);
    expect(s.simulation.unemployment).toBeGreaterThan(0.05);
    expect(s.simulation.districts.reduce((n, d) => n + d.population, 0)).toBe(
      s.world.population,
    );
    expect(quotedRent(s, property("central-shop"))).not.toBe(
      property("central-shop").monthlyRent,
    );
    audit(s);
  });
  it("信用限度を超える借入を行わず、採用解雇の二重雇用がない", () => {
    const s = newGame("信用");
    const f = s.simulation.firms[0];
    book(s, f, "手元資金の減少", { cash: -490000, expenses: 490000 });
    f.lastProfit = 1000;
    for (let i = 0; i < 12; i++) {
      firmDecisions(s);
      if (f.book.cash)
        book(s, f, "支出", { cash: -f.book.cash, expenses: f.book.cash });
    }
    expect(f.borrowed).toBeLessThanOrEqual(f.creditLimit);
    audit(s);
  });
  it("NPC創業は本人からの出資で成立し借りた住所を占有する", () => {
    const s = newGame("創業");
    const r = s.simulation.residents.find((r) => r.id === "resident-2")!;
    r.motive = "enterprise";
    s.npcs.find((p) => p.id === r.id)!.skills.service = 80;
    book(s, r, "開始資産の追加", { cash: 200000, equity: 200000 });
    const before = r.book.cash;
    npcDecisions(s);
    const f = s.simulation.firms.find((f) => f.id === r.businessId)!;
    expect(f).toBeDefined();
    expect(r.book.cash + f.book.cash).toBe(before);
    expect(tenant(s, property(f.sites[0]))).toBe(f.id);
    audit(s);
  });
  it("関係を築く行動は時間・交通費を消費し信頼を実際に増やす", () => {
    const s = newGame("交流");
    const id = s.simulation.residents[0].id;
    const n = dispatch(s, {
      type: "execute",
      actionId: "meet-npc",
      target: { id },
    });
    expect(n.relationships.find((r) => r.npcId === id)!.trust).toBeGreaterThan(
      10,
    );
    expect(n.manualActions.length).toBeGreaterThan(s.manualActions.length);
    expect(n.cash).toBeLessThan(s.cash);
  });
  it("同一シードは一致し、別シードは意思決定の順序を変える", () => {
    const a = advanceDays(newGame("同じ", "standard", 1), 30),
      b = advanceDays(newGame("同じ", "standard", 1), 30),
      c = advanceDays(newGame("同じ", "standard", 2), 30);
    expect(a).toEqual(b);
    expect(a.simulation.randomState).not.toBe(c.simulation.randomState);
    expect(a.simulation.residents.map((r) => r.jobId)).not.toEqual(
      c.simulation.residents.map((r) => r.jobId),
    );
  });
  it("壊れた帳簿・人口・二重入居・雇用参照を保存時に拒否する", () => {
    const s = newGame("不正");
    const f = structuredClone(s);
    f.simulation.firms[0].book.cash++;
    expect(() => validateSave(f)).toThrow();
    const p = structuredClone(s);
    p.simulation.districts[0].population++;
    expect(() => validateSave(p)).toThrow();
    const t = structuredClone(s);
    t.simulation.firms[0].sites.push("campus-share");
    expect(() => validateSave(t)).toThrow();
    const e = structuredClone(s);
    e.simulation.firms[0].employees.push("missing");
    expect(() => validateSave(e)).toThrow();
  });
  it("個別NPC・企業・乱数状態・ニュースをIndexedDBとJSONへ保存", async () => {
    Object.assign(globalThis, { indexedDB });
    const s = advanceDays(newGame("保存"), 60);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
    await saveGame(3, s);
    expect(await loadGame(3)).toEqual(s);
  });
  it("プレイヤーも実在する求職者を採用し給与を双方記帳する", () => {
    let s = newGame("採用", "comfortable");
    s = dispatch(s, {
      type: "enterprise",
      input: {
        operation: "create",
        name: "文具",
        industry: "retail",
        product: "stationery",
        amount: 50000,
        region: "online",
      },
    });
    const count = s.npcs.length;
    s = dispatch(s, {
      type: "enterprise",
      input: { operation: "hire", id: s.ventures[0].id },
    });
    const id = s.ventures[0].employees[0].npcId;
    s = dispatch(s, {
      type: "execute",
      actionId: "map-lease",
      target: { id: "harbor-shop", value: s.ventures[0].id },
    });
    expect(s.npcs.length).toBe(count);
    s = advanceDays(s, 1);
    const r = s.simulation.residents.find((r) => r.id === id)!;
    expect(r.earned).toBe(4400);
    expect(r.book.revenue).toBe(4400);
    expect(r.hours.work).toBe(4);
    expect(r.hours.commute).toBeGreaterThan(0);
    expect(
      s.npcs.find((p) => p.id === id)!.experience.service,
    ).toBeGreaterThanOrEqual(4);
    expect(s.simulation.firms.every((f) => !f.employees.includes(id))).toBe(
      true,
    );
    audit(s);
  });
  it("NPCが撤退後に再創業しても会社IDが重複しない", () => {
    const s = newGame("再挑戦");
    const r = s.simulation.residents.find((r) => r.id === "resident-2")!;
    r.motive = "enterprise";
    s.npcs.find((p) => p.id === r.id)!.skills.service = 80;
    book(s, r, "自己資金", { cash: 500000, equity: 500000 });
    npcDecisions(s);
    const first = s.simulation.firms.find((f) => f.id === r.businessId)!;
    closeFirm(s, first);
    npcDecisions(s);
    expect(r.businessId).not.toBe(first.id);
    expect(s.simulation.firms.find((f) => f.id === r.businessId)!.status).toBe(
      "active",
    );
    audit(s);
  });
  it("月給制でも企業の供給に給与換算時間ではなく実勤務時間を使う", () => {
    let s = newGame("月給の実働");
    s.person.skills.digital = 90;
    s = dispatch(s, { type: "apply", jobId: "office" });
    s = advanceDays(s, 1);
    const npcHours = s.simulation.residents
      .filter((r) => r.jobId === "office")
      .reduce((n, r) => n + r.hours.work, 0);
    expect(
      s.simulation.firms.find((f) => f.id === "office-co")!.staffHours,
    ).toBe(npcHours + s.history.at(-1)!.workHours);
    expect(s.history.at(-1)!.workHours).toBeGreaterThan(0);
    audit(s);
  });
  it("プレイヤーの採用と営業拠点も失業率と地区需要へ反映する", () => {
    let s = newGame("地域への影響", "comfortable");
    for (const f of s.simulation.firms) closeFirm(s, f);
    const baseline = structuredClone(s);
    economyMonth(baseline);
    s = dispatch(s, {
      type: "enterprise",
      input: {
        operation: "create",
        name: "地域の店",
        industry: "retail",
        product: "stationery",
        amount: 50000,
        region: "suburb",
      },
    });
    s = dispatch(s, {
      type: "execute",
      actionId: "map-lease",
      target: { id: "harbor-shop", value: s.ventures[0].id },
    });
    for (let i = 0; i < 3; i++)
      s = dispatch(s, {
        type: "enterprise",
        input: { operation: "hire", id: s.ventures[0].id },
      });
    economyMonth(s);
    expect(s.simulation.unemployment).toBeLessThan(
      baseline.simulation.unemployment,
    );
    expect(
      s.simulation.districts.find((d) => d.id === "harbor")!.demand,
    ).toBeGreaterThan(
      baseline.simulation.districts.find((d) => d.id === "harbor")!.demand,
    );
    audit(s);
  });
  it(
    "10年間の資金・雇用・店舗・人口・会計と継続再現性",
    { timeout: 60000 },
    () => {
      let s = dispatch(newGame("10年の暮らし", "comfortable"), {
        type: "apply",
        jobId: "cafe",
      });
      s = dispatch(s, { type: "action", action: "digital" });
      let opening = 0,
        closures = 0,
        changes = 0;
      const start = performance.now();
      for (let i = 0; i < 120; i++) {
        s = advanceDays(s, 30);
        audit(s);
        opening += s.simulation.news.filter((n) => n.kind === "opening").length;
        closures += s.simulation.news.filter(
          (n) => n.kind === "closure",
        ).length;
      }
      s = advanceDays(s, 53); // 2026-04-01 → 2036-04-01 includes leap days in 2028/2032/2036.
      audit(s);
      expect(s.date).toBe("2036-04-01");
      expect(s.days).toBe(3653);
      expect(s.history).toHaveLength(365);
      expect(s.person.health).toBeGreaterThan(0);
      expect(s.simulation.firms.length).toBeGreaterThan(20);
      expect(s.simulation.firms.some((f) => f.status === "closed")).toBe(true);
      expect(s.simulation.residents.some((r) => r.changes > 1)).toBe(true);
      const saved = JSON.stringify(s);
      expect(saved.length).toBeLessThan(16000000);
      expect(parseSave(saved)).toEqual(s);
      expect(advanceDays(s, 30)).toEqual(advanceDays(parseSave(saved), 30));
      const report = {
        days: s.days,
        date: s.date,
        elapsedMs: Math.round(performance.now() - start),
        population: s.world.population,
        firms: s.simulation.firms.length,
        active: s.simulation.firms.filter((f) => f.status === "active").length,
        closed: s.simulation.firms.filter((f) => f.status === "closed").length,
        employed: s.simulation.residents.filter((r) => r.jobId).length,
        jobChanges: s.simulation.residents.reduce((n, r) => n + r.changes, 0),
        saveBytes: new TextEncoder().encode(saved).length,
        seed: s.simulation.seed,
        allInvariants: true,
      };
      console.info("TEN_YEAR_RESULT " + JSON.stringify(report));
    },
  );
});
