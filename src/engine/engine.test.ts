import { book as aiBook } from "./enterprise/accounting";
import { changeJob as npcJob } from "./simulation";
import { describe, it, expect } from "vitest";
import { newGame, dispatch, advanceDays } from "./index";
import { age } from "./person";
import { receive, liquid } from "./finance";
import { calculateMarket } from "./market";
import { industries } from "./business";
const employed = () =>
  dispatch(newGame("テスト"), { type: "apply", jobId: "cafe" });
const business = () =>
  dispatch(
    dispatch(newGame("テスト", "comfortable"), {
      type: "open",
      industryId: "writing",
    }),
    { type: "routine", routine: { activityHours: 6 } },
  );

describe("時間・生活・勤務", () => {
  it("入力を変更せず30日と日次30回が一致", () => {
    const s = employed();
    let daily = s;
    for (let n = 0; n < 30; n++) daily = advanceDays(daily, 1);
    expect(advanceDays(s, 30)).toEqual(daily);
    expect(s.days).toBe(0);
    expect(s.cash).toBe(26000);
  });
  it("初月家賃は重複せず翌月1日に支払う", () => {
    let s = newGame("テスト");
    s = advanceDays(s, 30);
    expect(s.totals.living).toBe(24000 + 700 * 30 + 7000);
    s = advanceDays(s, 1);
    expect(s.totals.living).toBe(48000 + 700 * 31 + 7000);
  });
  it("平日のみ勤務し25日に給与全額を振り込む", () => {
    let s = advanceDays(employed(), 24);
    expect(s.employment?.accrued).toBe(99000);
    expect(s.totals.wages).toBe(99000);
    expect(s.ledger.filter((e) => e.label.startsWith("給与振込"))).toHaveLength(
      0,
    );
    s = advanceDays(s, 1);
    expect(s.employment?.accrued).toBe(0);
    expect(s.ledger.find((e) => e.label.startsWith("給与振込"))?.amount).toBe(
      99000,
    );
  });
  it("退職時に未払給与を精算して勤務が止まる", () => {
    let s = advanceDays(employed(), 7);
    const accrued = s.employment!.accrued,
      before = liquid(s);
    s = dispatch(s, { type: "quit" });
    expect(liquid(s)).toBe(before + accrued);
    expect(s.employment).toBeNull();
    const wages = s.totals.wages;
    expect(advanceDays(s, 7).totals.wages).toBe(wages);
  });
  it("資金不足は債務にし収入から自動返済する", () => {
    const s = newGame("テスト", "challenge");
    expect(s.debt).toBe(4000);
    expect(s.cash).toBe(0);
    receive(s, 10000, "支援");
    expect(s.cash).toBe(6000);
    expect(s.debt).toBe(0);
  });
  it("スキル条件を満たすと次の仕事に応募できる", () => {
    let s = newGame("学習");
    s = dispatch(s, { type: "apply", jobId: "design" });
    expect(s.applications.at(-1)?.hired).toBe(false);
    s = dispatch(s, { type: "action", action: "digital" });
    s = dispatch(s, { type: "routine", routine: { activityHours: 6 } });
    s = advanceDays(s, 14);
    expect(s.person.skills.digital).toBeGreaterThan(10);
    // 学習の検証では採用枠を確保する。通常の世界ではNPCが同じ枠を競う。
    for (const r of s.simulation.residents.filter((r) => r.jobId === "design"))
      npcJob(s, r, null);
    s.vacancies.find((v) => v.jobId === "design")!.openings = 1;
    s = dispatch(s, { type: "apply", jobId: "design" });
    expect(s.employment?.jobId).toBe("design");
  });
  it("勤務と余暇の学習が両立する", () => {
    const s = advanceDays(
      dispatch(employed(), { type: "action", action: "digital" }),
      7,
    );
    expect(s.person.skills.digital).toBeGreaterThan(3.5);
    expect(s.person.skills.digital).toBeLessThan(4.1);
    expect(s.totals.wages).toBe(27500);
  });
  it("年齢が上がっても人生を継続できる", () => {
    let s = newGame("長い人生");
    s.date = "2126-04-01";
    s = advanceDays(s, 365);
    expect(age(s.person, s.date)).toBe(119);
    expect(s.days).toBe(365);
    expect(s.debt).toBeGreaterThan(0);
  });
  it.each([0, -1, 1.5, 366, NaN, Infinity])("不正な早送りを拒否 %s", (days) => {
    expect(() => advanceDays(employed(), days)).toThrow();
  });
  it("入居変更を請求し同一住居への重複請求をしない", () => {
    let s = newGame("住居", "comfortable");
    s = dispatch(s, { type: "housing", housingId: "studio" });
    expect(s.cash).toBe(55000);
    const again = dispatch(s, { type: "housing", housingId: "studio" });
    expect(again.cash).toBe(55000);
  });
});
describe("事業と市場", () => {
  it("事業の30日一括と日次が一致する", () => {
    const s = business();
    let daily = s;
    for (let n = 0; n < 30; n++) daily = advanceDays(daily, 1);
    expect(advanceDays(s, 30)).toEqual(daily);
  });
  it("需要は価格・品質・人口から計算し値上げで下がる", () => {
    const s = business(),
      i = industries[0];
    const base = calculateMarket(s, i, 6);
    s.business!.price *= 2;
    expect(calculateMarket(s, i, 6).demand).toBeLessThan(base.demand);
    s.business!.price = i.basePrice;
    s.person.skills.digital = 100;
    expect(calculateMarket(s, i, 6).capacity).toBeGreaterThan(base.capacity);
  });
  it("原価と固定費を引いた営業利益を積み上げる", () => {
    const s = advanceDays(business(), 1),
      b = s.business!;
    expect(b.last.units).toBe(3);
    expect(b.last.revenue).toBe(7500);
    expect(b.last.costs).toBe(600);
    expect(b.last.profit).toBe(6900);
    expect(b.revenue - b.costs).toBe(b.last.profit);
  });
  it("勤務日は事業能力が少なく休日は増える", () => {
    let s = dispatch(employed(), { type: "open", industryId: "writing" });
    s = advanceDays(s, 1);
    expect(s.business!.last.capacity).toBe(1);
    s.date = "2026-04-04";
    s = advanceDays(s, 1);
    expect(s.business!.last.capacity).toBe(3);
  });
  it("材料を購入できる数量に販売が制約される", () => {
    const s = business();
    s.cash = 450;
    expect(calculateMarket(s, industries[0], 6).units).toBe(1);
    s.cash = 0;
    const next = advanceDays(s, 1);
    expect(next.business!.last.units).toBe(0);
    expect(next.business!.last.profit).toBe(-300);
    expect(next.debt).toBe(1000);
  });
  it("再投資は現金と設備に反映し生産能力を増やす", () => {
    const s = business(),
      capacity = calculateMarket(s, industries[0], 6).capacity;
    const upgraded = dispatch(s, { type: "invest" });
    expect(upgraded.cash).toBe(s.cash - 15000);
    expect(upgraded.assets[0].cost).toBe(35000);
    expect(
      calculateMarket(upgraded, industries[0], 6).capacity,
    ).toBeGreaterThan(capacity);
  });
  it("学習中と休業中には販売・費用が発生しない", () => {
    for (const s of [
      dispatch(business(), { type: "toggle" }),
      dispatch(business(), { type: "action", action: "digital" }),
    ]) {
      const n = advanceDays(s, 7);
      expect(n.business!.revenue).toBe(0);
      expect(n.business!.costs).toBe(0);
    }
  });
  it("廃業後も累計を保持し再開業できる", () => {
    const s = advanceDays(business(), 5);
    const closed = dispatch(s, { type: "close" });
    expect(closed.business).toBeNull();
    expect(closed.assets).toHaveLength(0);
    expect(closed.totals.revenue).toBe(s.totals.revenue);
    expect(
      dispatch(closed, { type: "open", industryId: "bakery" }).business
        ?.industryId,
    ).toBe("bakery");
  });
  it("資金不足と価格の不正な値を拒否する", () => {
    expect(() =>
      dispatch(newGame("資金", "challenge"), {
        type: "open",
        industryId: "bakery",
      }),
    ).toThrow("資金");
    for (const price of [0, 99, 100001, NaN, 1.5])
      expect(() => dispatch(business(), { type: "price", price })).toThrow();
  });
});
