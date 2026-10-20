import { book as aiBook } from "./engine/enterprise/accounting";
import { changeJob as npcJob } from "./engine/simulation";
import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { newGame, dispatch, advanceDays } from "./engine";
import type { GameState } from "./engine/types";
import {
  cities,
  districts,
  properties,
  property,
  homeProperty,
  tenant,
  route,
  jobOffer,
  locationEffect,
  businessTrip,
  propertyEffects,
} from "./engine/spatial/selectors";
import { compareSite } from "./engine/spatial/preview";
import { home } from "./engine/life";
import { jobs } from "./engine/career";
import {
  industryModules,
  verifyAccounts,
  verifyEnterprise,
  nav,
} from "./engine/enterprise";
import { demandFor } from "./engine/enterprise/market";
import { liquid, reconcile } from "./engine/finance";
import { parseSave, validateSave, saveGame, loadGame } from "./persistence";
import fixture from "../tests/fixtures/v3-save.json";
const act = (s: GameState, id: string, target: string, value?: string) =>
  dispatch(s, { type: "execute", actionId: id, target: { id: target, value } });
function setup() {
  return dispatch(newGame("地図テスト", "comfortable"), {
    type: "enterprise",
    input: {
      operation: "create",
      name: "立地テスト店",
      industry: "retail",
      amount: 50000,
      price: 700,
    },
  });
}
const lease = (s: GameState, id: string) =>
  act(s, "map-lease", id, s.ventures[0].id);
const work = (s: GameState) =>
  dispatch(s, { type: "action", action: "enterprise-work" });
function audit(s: GameState) {
  expect(reconcile(s)).toBe(true);
  for (const a of [...s.ventures, ...s.companies])
    expect(verifyAccounts(a)).toBe(true);
  for (const v of s.ventures) expect(verifyEnterprise(v)).toBe(true);
  expect(validateSave(s)).toEqual(s);
}
describe("Phase 3 都市・立地・物件", () => {
  it("1都市6地区の物件・職場・施設は一意で実データを持つ", () => {
    expect(cities).toHaveLength(1);
    expect(districts).toHaveLength(6);
    expect(new Set(properties.map((p) => p.id)).size).toBe(properties.length);
    expect(districts.reduce((n, d) => n + d.nightPopulation, 0)).toBe(
      cities[0].population,
    );
    for (const d of districts) {
      expect(
        properties.filter((p) => p.districtId === d.id).length,
      ).toBeGreaterThanOrEqual(9);
      expect(d.dayPopulation).toBeGreaterThan(0);
    }
    for (const j of jobs) expect(property("work-" + j.id).jobId).toBe(j.id);
  });
  it("初期住宅は既存の家賃・生活費を維持する", () => {
    const s = newGame("初期");
    expect(home(s).rent).toBe(24000);
    expect(home(s).daily).toBe(700);
    expect(homeProperty(s).id).toBe("campus-share");
    expect(tenant(s, homeProperty(s))).toBe("player");
    audit(s);
  });
  it("地区で住宅の家賃・食費・治安の回復効果が変わる", () => {
    const s = newGame("住宅", "comfortable");
    const cheap = act(s, "map-move", "residential-share"),
      high = act(s, "map-move", "central-share");
    expect(home(cheap).rent).toBeLessThan(home(high).rent);
    expect(home(cheap).daily).toBeLessThan(home(high).daily);
    expect(home(cheap).recovery).toBeGreaterThan(home(high).recovery);
    audit(cheap);
    audit(high);
  });
  it("引越し費・当月家賃差額を記帳し旧住居が空く", () => {
    const s = newGame("引越", "comfortable"),
      before = liquid(s);
    const n = act(s, "map-move", "central-share");
    expect(before - liquid(n)).toBe(19400);
    expect(tenant(n, property("campus-share"))).toBeNull();
    expect(tenant(n, property("central-share"))).toBe("player");
    expect(n.manualActions.at(-1)?.hours).toBe(2);
    audit(n);
  });
  it("毎月1日の実家賃が物件に応じて変わる", () => {
    const initial = newGame("月賃料", "comfortable");
    const a = advanceDays(act(initial, "map-move", "harbor-share"), 31),
      b = advanceDays(act(initial, "map-move", "central-share"), 31);
    const rent = (s: GameState) =>
      s.ledger
        .filter((e) => e.date === "2026-05-01" && e.label.endsWith("家賃"))
        .reduce((n, e) => n - e.amount + e.debtDelta, 0);
    expect(rent(a)).toBe(14400);
    expect(rent(b)).toBe(38400);
    audit(a);
    audit(b);
  });
  it("勤務地と住居の距離が通勤時間・交通費へ反映", () => {
    const s = newGame("経路", "comfortable"),
      cafe = jobs.find((j) => j.id === "cafe")!;
    const near = jobOffer(s, cafe),
      far = jobOffer(act(s, "map-move", "harbor-share"), cafe);
    expect(far.commute).toBeGreaterThan(near.commute);
    expect(far.fare).toBeGreaterThan(near.fare);
    expect(route(property("harbor-share"), property("work-cafe")).hours).toBe(
      far.commute,
    );
  });
  it("引越しで在職中の通勤を更新し実際の勤務日に交通費を支払う", () => {
    let s = newGame("在職", "comfortable");
    s = dispatch(s, { type: "apply", jobId: "cafe" });
    s = act(s, "map-move", "harbor-share");
    expect(s.employments[0].commute).toBe(1);
    const expected = jobOffer(
      s,
      jobs.find((j) => j.id === "cafe")!,
    ).fare;
    s = advanceDays(s, 1);
    expect(s.history[0].commuteHours).toBe(2);
    expect(
      s.ledger.find((e) => e.label === "交通費：喫茶 こもれび")?.amount,
    ).toBe(-expected);
    audit(s);
  });
  it("通勤が睡眠・シフトへ侵入する引越しを原子的に拒否", () => {
    let s = newGame("両立", "comfortable");
    s = dispatch(s, { type: "apply", jobId: "cafe" });
    s = dispatch(s, {
      type: "shift",
      contractId: s.employments[0].id,
      start: 8.5,
      weekdays: [1, 2, 3, 4, 5],
    });
    const before = structuredClone(s);
    expect(() => act(s, "map-move", "harbor-share")).toThrow("重複");
    expect(s).toEqual(before);
    audit(s);
  });
  it("地域求人を所得・賃金水準から生成し全募集が実企業を参照", () => {
    const s = newGame("求人");
    expect(jobs.filter((j) => j.id.startsWith("local-"))).toHaveLength(6);
    expect(jobs.find((j) => j.id === "local-hill")!.wage).toBeGreaterThan(
      jobs.find((j) => j.id === "local-residential")!.wage,
    );
    for (const j of jobs) {
      expect(s.organizations.some((o) => o.id === j.employerId)).toBe(true);
      expect(s.vacancies.some((v) => v.jobId === j.id)).toBe(true);
    }
  });
  it("地区需要・景気・企業資金が求人枠へ作用", () => {
    const a = advanceDays(newGame("求人枠"), 1);
    expect(
      a.vacancies.find((v) => v.jobId === "local-central")!.openings,
    ).toBeGreaterThan(
      a.vacancies.find((v) => v.jobId === "local-harbor")!.openings,
    );
    const initial = newGame("採用停止");
    const firm = initial.simulation.firms.find(
      (f) => f.id === "local-central-co",
    )!;
    aiBook(initial, firm, "資金不足の試験", {
      cash: -firm.book.cash,
      debt: 1000000,
      expenses: firm.book.cash + 1000000,
    });
    const b = advanceDays(initial, 1);
    expect(b.vacancies.find((v) => v.jobId === "local-central")!.openings).toBe(
      0,
    );
  });
  it("同じ価格・品質でも店舗立地で需要・家賃が異なる", () => {
    const s = setup(),
      a = lease(s, "central-shop"),
      b = lease(s, "harbor-shop"),
      m = industryModules.get("retail")!;
    expect(demandFor(a, a.ventures[0], m)).toBeGreaterThan(
      demandFor(b, b.ventures[0], m),
    );
    expect(a.ventures[0].book.expenses).toBe(38400);
    expect(b.ventures[0].book.expenses).toBe(14400);
    expect(a.ventures[0].book.cash).toBe(6600);
    audit(a);
    audit(b);
  });
  it("需要差が実売と現金・利益へつながる", () => {
    const initial = setup();
    function simulate(id: string) {
      let s = lease(initial, id);
      s = dispatch(s, {
        type: "enterprise",
        input: { operation: "purchase", id: s.ventures[0].id, amount: 20 },
      });
      s = dispatch(s, {
        type: "routine",
        routine: { activityHours: 8, weekendHours: 8 },
      });
      return advanceDays(work(s), 1);
    }
    const a = simulate("central-shop"),
      b = simulate("harbor-shop");
    expect(a.ventures[0].last.units).toBeGreaterThan(b.ventures[0].last.units);
    expect(a.ventures[0].book.revenue).toBeGreaterThan(
      b.ventures[0].book.revenue,
    );
    expect(a.ventures[0].book.expenses).toBeGreaterThan(
      b.ventures[0].book.expenses,
    );
    audit(a);
    audit(b);
  });
  it("近隣の競合・視認性・倉庫用途が集客と処理能力へ作用", () => {
    const s = setup(),
      v = s.ventures[0],
      profile = industryModules.get("retail")!.siteProfile;
    const shop = locationEffect(lease(s, "campus-shop"), v, profile),
      warehouse = locationEffect(lease(s, "campus-warehouse"), v, profile);
    expect(shop.market).toBeGreaterThan(warehouse.market);
    expect(warehouse.productivity).toBeGreaterThan(shop.productivity);
    expect(shop.competition).toBeGreaterThan(1);
    expect(propertyEffects.has("warehouse")).toBe(true);
  });
  it("立地プレビューは実際の入居後と同じ式を使い状態を変えない", () => {
    const s = setup(),
      before = structuredClone(s),
      p = compareSite(s, s.ventures[0], "central-shop");
    const actual = lease(s, "central-shop");
    expect(p.after).toBe(
      demandFor(actual, actual.ventures[0], industryModules.get("retail")!),
    );
    expect(s).toEqual(before);
  });
  it("事業拠点への移動を本人時間内で消費し24時間を保つ", () => {
    let s = work(lease(setup(), "campus-shop"));
    s = advanceDays(s, 1);
    expect(s.ventures[0].data.siteCommuteHours).toBe(1);
    expect(s.history[0].commuteHours).toBe(1);
    expect(s.ventures[0].last.ownerHours).toBe(s.history[0].activityHours);
    expect(s.history[0].blocks.reduce((n, b) => n + b.hours, 0)).toBe(24);
    expect(
      s.history[0].blocks
        .filter((b) => b.kind === "commute")
        .reduce((n, b) => n + b.hours, 0),
    ).toBe(1);
    audit(s);
  });
  it("移動後に作業できない短い割当では通勤せず無料作業もない", () => {
    let s = work(lease(setup(), "harbor-shop"));
    expect(businessTrip(s, s.ventures[0], 2).hours).toBe(0);
    s = advanceDays(s, 1);
    expect(s.ventures[0].last.units).toBe(0);
    expect(s.history[0].activityHours).toBe(0);
    expect(s.ventures[0].data.siteCommuteHours).toBe(0);
    audit(s);
  });
  it("入居の重複・不正用途・資金不足を拒否", () => {
    const s = lease(setup(), "campus-shop"),
      before = structuredClone(s);
    expect(() => lease(s, "campus-shop")).toThrow("入居中");
    expect(() => lease(s, "campus-share")).toThrow();
    expect(() => lease(setup(), "hill-shop")).toThrow("資金");
    expect(s).toEqual(before);
  });
  it("会社の物件賃料は会社資金だけから支払い本店が機能する", () => {
    let s = newGame("本店", "comfortable");
    s = dispatch(s, {
      type: "enterprise",
      input: {
        operation: "create-company",
        name: "立地株式会社",
        amount: 40000,
      },
    });
    const id = s.companies[0].id,
      before = liquid(s);
    s = act(s, "map-lease", "harbor-office", id);
    expect(liquid(s)).toBe(before);
    expect(s.companies[0].book.expenses).toBe(10800);
    expect(s.companies[0].region).toBe("西港物流地区");
    s = dispatch(s, {
      type: "enterprise",
      input: {
        operation: "create",
        name: "子事業",
        industry: "retail",
        amount: 10000,
        companyId: id,
      },
    });
    expect(locationEffect(s, s.ventures[0]).managementSupport).toBeGreaterThan(
      0,
    );
    audit(s);
  });
  it("休業中も賃料が発生し、資金不足は事業の負債として残る", () => {
    let s = lease(setup(), "central-shop");
    s = dispatch(s, {
      type: "enterprise",
      input: { operation: "pause", id: s.ventures[0].id },
    });
    s = advanceDays(s, 31);
    expect(s.ventures[0].book.expenses).toBe(76800);
    expect(s.ventures[0].book.debt).toBeGreaterThan(0);
    expect(
      s.spatial.leases.find((l) => l.tenantId === s.ventures[0].id)?.paidMonth,
    ).toBe("2026-05");
    audit(s);
  });
  it("事業物件を解約・閉鎖すると空室になり翌月請求が止まる", () => {
    let s = lease(setup(), "harbor-shop");
    const id = s.ventures[0].id;
    s = act(s, "map-release", "harbor-shop");
    expect(tenant(s, property("harbor-shop"))).toBeNull();
    s = lease(s, "harbor-shop");
    s = dispatch(s, { type: "enterprise", input: { operation: "close", id } });
    expect(s.spatial.leases.some((l) => l.tenantId === id)).toBe(false);
    const expense = s.ventures[0].book.expenses;
    s = advanceDays(s, 31);
    expect(s.ventures[0].book.expenses).toBe(expense);
    audit(s);
  });
  it("日常施設の登録と訪問は保存され時間・利用料・能力へ作用", () => {
    let s = newGame("図書室", "comfortable");
    s = act(s, "map-favorite", "campus-library");
    const before = liquid(s),
      skill = s.person.skills.digital;
    s = act(s, "map-visit", "campus-library");
    expect(s.spatial.favorites).toContain("campus-library");
    expect(s.person.skills.digital).toBe(skill + 0.5);
    expect(liquid(s)).toBeLessThan(before);
    expect(s.manualActions.at(-1)?.hours).toBe(2);
    audit(s);
  });
  it("地図を含む1年の日次と早送りが一致しIndexedDB・JSON保存できる", async () => {
    let s = lease(setup(), "campus-shop");
    s = dispatch(s, { type: "apply", jobId: "cafe" });
    s = dispatch(s, {
      type: "enterprise",
      input: {
        operation: "reorder",
        id: s.ventures[0].id,
        amount: 10,
        value: 30,
      },
    });
    s = dispatch(s, {
      type: "routine",
      routine: { activityHours: 4, weekendHours: 6 },
    });
    s = work(s);
    const fast = advanceDays(s, 365);
    let daily = s;
    for (let i = 0; i < 365; i++) daily = advanceDays(daily, 1);
    expect(fast).toEqual(daily);
    for (const d of fast.history) {
      expect(d.blocks.reduce((n, b) => n + b.hours, 0)).toBe(24);
      const manual = d.blocks
        .filter((b) => b.kind === "manual")
        .reduce((n, b) => n + b.hours, 0);
      expect(
        d.workHours +
          d.sleepHours +
          d.commuteHours +
          d.activityHours +
          d.freeHours +
          manual +
          2,
      ).toBe(24);
    }
    audit(fast);
    expect(parseSave(JSON.stringify(fast))).toEqual(fast);
    await saveGame(2, fast);
    expect(await loadGame(2)).toEqual(fast);
  }, 60000);
  it("v3の資金・事業・在庫・元帳を保持して在宅へ引継ぐ", () => {
    const s = validateSave(fixture);
    expect(s.schemaVersion).toBe(7);
    expect(s.cash).toBe(fixture.cash);
    expect(s.ventures).toEqual(fixture.ventures);
    expect(s.ledger).toEqual(fixture.ledger);
    expect(s.spatial.leases).toHaveLength(1);
    expect(s.vacancies).toHaveLength(jobs.length);
    audit(advanceDays(s, 30));
  });
  it("存在しない物件・重複契約・入居者・住居との不一致を保存時に拒否", () => {
    const s = setup();
    const a = structuredClone(s);
    a.spatial.homePropertyId = "unknown";
    expect(() => validateSave(a)).toThrow();
    const b = structuredClone(s);
    b.spatial.leases.push({ ...b.spatial.leases[0] });
    expect(() => validateSave(b)).toThrow();
    const c = structuredClone(s);
    c.spatial.leases[0].tenantId = "nobody";
    expect(() => validateSave(c)).toThrow();
    const d = structuredClone(s);
    d.housingId = "studio";
    expect(() => validateSave(d)).toThrow();
  });
});
