import { book as aiBook } from "./enterprise/accounting";
import { changeJob as npcJob } from "./simulation";
import { describe, it, expect } from "vitest";
import { newGame, dispatch, advanceDays } from "./index";
import { buildDayPlan, availableHours } from "./schedule";
import { jobs, hiringAssessment } from "./career";
import {
  pay,
  receive,
  liquid,
  netWorth,
  reconcile,
  transfer,
  borrow,
  repay,
  chargeInterest,
} from "./finance";
import { actionRegistry, registerAction } from "./actions";
import { validateSave } from "../persistence";
const working = () =>
  dispatch(newGame("人生", "comfortable"), { type: "apply", jobId: "cafe" });
const dual = () =>
  dispatch(advanceDays(working(), 14), { type: "apply", jobId: "convenience" });
describe("24時間・シフトと1年間", () => {
  it("通勤・必須生活・手動行動を含み常に24時間で重複しない", () => {
    const s = dual();
    expect(s.employments).toHaveLength(2);
    const blocks = buildDayPlan(s);
    expect(blocks.reduce((a, b) => a + b.hours, 0)).toBe(24);
    let end = 0;
    for (const b of blocks) {
      expect(b.start).toBe(end);
      end += b.hours;
    }
    expect(availableHours(s)).toBe(3);
    expect(
      blocks.filter((b) => b.kind === "work").reduce((a, b) => a + b.hours, 0),
    ).toBe(9);
  });
  it("通勤を含む重複・睡眠への侵入・必須時間不足を拒否して元状態を維持", () => {
    const s = working(),
      id = s.employments[0].id;
    expect(() =>
      dispatch(s, { type: "shift", contractId: id, start: 8, weekdays: [1] }),
    ).toThrow("重複");
    const d = dual();
    expect(() =>
      dispatch(d, {
        type: "shift",
        contractId: d.employments[1].id,
        start: 14,
        weekdays: [1],
      }),
    ).toThrow("重複");
    expect(s.employments[0].start).toBe(9);
    expect(() =>
      dispatch(s, { type: "routine", routine: { sleepHours: 10 } }),
    ).toThrow("重複");
  });
  it("空き時間を超える手動行動と不正な曜日を拒否", () => {
    let s = dual();
    s = dispatch(s, { type: "execute", actionId: "rest" });
    s = dispatch(s, { type: "execute", actionId: "rest" });
    expect(() => dispatch(s, { type: "execute", actionId: "rest" })).toThrow(
      "時間",
    );
    for (const weekdays of [[], [1, 1], [7], [-1]])
      expect(() =>
        dispatch(s, {
          type: "shift",
          contractId: s.employments[0].id,
          start: 9,
          weekdays,
        }),
      ).toThrow();
  });
  it("掛け持ち・勉強・休息を組み合わせ365日を日次/30日/一括で一致", () => {
    let seed = dual();
    seed = dispatch(seed, {
      type: "routine",
      routine: {
        weekdayAction: "digital",
        weekendAction: "rest",
        activityHours: 2,
        weekendHours: 4,
      },
    });
    let daily = seed,
      batch = seed;
    for (let n = 0; n < 351; n++) daily = advanceDays(daily, 1);
    for (let n = 0; n < 351; n += 30)
      batch = advanceDays(batch, Math.min(30, 351 - n));
    const once = advanceDays(seed, 351);
    expect(daily).toEqual(batch);
    expect(batch).toEqual(once);
    expect(once.days).toBe(365);
    expect(once.date).toBe("2027-04-01");
    expect(once.history).toHaveLength(365);
    expect(liquid(once)).toBeGreaterThan(
      liquid(newGame("比較", "comfortable")),
    );
    expect(once.person.skills.digital).toBeGreaterThan(10);
    expect(once.employments.every((e) => e.workedHours > 0)).toBe(true);
    expect(once.history.reduce((a, h) => a + h.earned, 0)).toBe(
      once.totals.wages,
    );
    for (const h of once.history) {
      expect(h.blocks.reduce((a, b) => a + b.hours, 0)).toBe(24);
      expect(
        h.workHours +
          h.commuteHours +
          h.sleepHours +
          h.freeHours +
          h.blocks
            .filter((b) => b.kind === "essential" || b.kind === "manual")
            .reduce((a, b) => a + b.hours, 0) +
          h.activityHours,
      ).toBe(24);
    }
    expect(reconcile(once)).toBe(true);
    expect(validateSave(once)).toEqual(once);
  }, 20000);
  it("予定欠勤は次の該当勤務日に一回だけで給与と交通費は発生しない", () => {
    let s = advanceDays(working(), 3);
    s = dispatch(s, { type: "absence", contractId: s.employments[0].id });
    s = advanceDays(s, 2);
    expect(s.employments[0].absences).toBe(0);
    s = advanceDays(s, 1);
    expect(s.employments[0].absences).toBe(1);
    expect(s.history.at(-1)?.earned).toBe(0);
    expect(s.history.at(-1)?.commuteHours).toBe(0);
    expect(s.employments[0].absentNext).toBe(false);
    expect(advanceDays(s, 1).history.at(-1)?.workHours).toBe(5);
  });
  it("体調不良の欠勤・短時間勤務も24hで保存できる", () => {
    const s = working();
    s.person.health = 10;
    const n = advanceDays(s, 1);
    expect(n.employments[0].absences).toBe(1);
    expect(n.history[0].workHours).toBe(0);
    expect(n.history[0].blocks.reduce((a, b) => a + b.hours, 0)).toBe(24);
    expect(validateSave(n)).toEqual(n);
  });
  it("平日・土日の自動行動が切り替わり手動学習も記録", () => {
    let s = newGame("選択");
    s = dispatch(s, {
      type: "routine",
      routine: {
        weekdayAction: "digital",
        weekendAction: "craft",
        activityHours: 2,
        weekendHours: 3,
      },
    });
    s = dispatch(s, { type: "execute", actionId: "digital" });
    s = advanceDays(s, 4);
    expect(s.history[0].studyHours).toBe(3);
    expect(s.history[3].studyHours).toBe(3);
    expect(s.person.skills.craft).toBeGreaterThan(0);
  });
});
describe("採用・経験・成長・交流", () => {
  it("必要能力だけでなく倍率と採用点から不採用を記録し再現する", () => {
    const s = newGame("応募");
    const a = dispatch(s, { type: "apply", jobId: "convenience" });
    expect(a.applications[0].hired).toBe(false);
    expect(a.employments).toHaveLength(0);
    expect(a).toEqual(dispatch(s, { type: "apply", jobId: "convenience" }));
    const qualified = advanceDays(working(), 14);
    expect(hiringAssessment(qualified, "convenience").hired).toBe(true);
  });
  it("企業の資金不足では募集を停止し採用しない", () => {
    const s = newGame("企業");
    const firm = s.simulation.firms.find((f) => f.id === "cafe-co")!;
    aiBook(s, firm, "資金不足の試験", {
      cash: -firm.book.cash,
      debt: 100000,
      expenses: firm.book.cash + 100000,
    });
    const n = advanceDays(s, 1);
    expect(n.vacancies.find((v) => v.jobId === "cafe")!.openings).toBe(0);
    expect(
      dispatch(n, { type: "apply", jobId: "cafe" }).applications.at(-1)?.hired,
    ).toBe(false);
  });
  it("勤務を続けると経験・能力・評価・昇給・昇格が育つ", () => {
    const initial = working();
    const firm = initial.simulation.firms.find((f) => f.id === "cafe-co")!;
    aiBook(initial, firm, "長期勤務の検証用運転資金", {
      cash: 10000000,
      equity: 10000000,
    });
    const s = advanceDays(initial, 180),
      e = s.employments[0];
    expect(e.workedDays).toBeGreaterThan(90);
    expect(e.wage).toBeGreaterThan(1100);
    expect(e.rank).toBeGreaterThanOrEqual(2);
    expect(s.person.experience.service).toBe(e.workedHours);
    expect(s.person.skills.service).toBeGreaterThan(0);
    expect(e.rating).toBeGreaterThan(65);
  });
  it("月給職の実働22日132hと月給が一致する", () => {
    let s = newGame("月給", "comfortable");
    s.person.skills.digital = 20;
    s = dispatch(s, { type: "apply", jobId: "office" });
    s = advanceDays(s, 30);
    const e = s.employments[0];
    expect(e.workedHours).toBe(132);
    expect(s.totals.wages).toBe(171600);
    expect(s.reports[0].earned).toBe(171600);
    expect(s.reports[0].wages + e.accrued).toBe(171600);
  });
  it("退職は対象契約だけを終了し給与と経歴を残す", () => {
    const s = advanceDays(dual(), 7),
      e = s.employments[1],
      sum = liquid(s) + e.accrued;
    const n = dispatch(s, { type: "quit", contractId: e.id });
    expect(n.employments).toHaveLength(1);
    expect(n.employments[0].jobId).toBe("cafe");
    expect(liquid(n)).toBe(sum);
    expect(n.careerHistory[0].workedHours).toBe(e.workedHours);
    expect(n.person.experience).toEqual(s.person.experience);
    expect(reconcile(n)).toBe(true);
  });
  it("職場で知り合い、実際に交流して信頼が採用点へ反映する", () => {
    let s = advanceDays(working(), 1);
    expect(s.relationships).toHaveLength(1);
    const id = s.relationships[0].npcId,
      before = hiringAssessment(s, "cafe").score,
      affinity = s.relationships[0].affinity;
    s = dispatch(s, { type: "execute", actionId: "socialize", target: { id } });
    expect(s.relationships[0].affinity).toBeGreaterThan(affinity);
    expect(s.relationships[0].interactions).toBe(1);
    expect(hiringAssessment(s, "cafe").score).toBeGreaterThan(before);
    expect(() =>
      dispatch(s, {
        type: "execute",
        actionId: "socialize",
        target: { id: "unknown" },
      }),
    ).toThrow();
  });
});
describe("口座・生活費・元帳", () => {
  it("給与は銀行へ、事業は現金へ入金し振替は収入にしない", () => {
    let s = advanceDays(working(), 25);
    expect(s.bank).toBeGreaterThan(0);
    expect(s.reports[0].wages).toBe(99000);
    const worth = netWorth(s),
      before = liquid(s);
    s = dispatch(s, {
      type: "execute",
      actionId: "withdraw",
      target: { amount: 10000 },
    });
    expect(netWorth(s)).toBe(worth);
    expect(liquid(s)).toBe(before);
    expect(s.reports[0].wages).toBe(99000);
    expect(reconcile(s)).toBe(true);
    s = dispatch(s, { type: "open", industryId: "writing" });
    s = advanceDays(s, 1);
    expect(
      s.ledger.some(
        (e) =>
          e.kind === "business-revenue" && e.cashDelta > 0 && e.bankDelta === 0,
      ),
    ).toBe(true);
  });
  it("家賃1日・光熱10日・通信15日を一回ずつ支払う", () => {
    const s = advanceDays(newGame("費用"), 31);
    expect(s.ledger.filter((e) => e.label === "光熱費")).toHaveLength(1);
    expect(s.ledger.filter((e) => e.label === "通信費")).toHaveLength(1);
    expect(s.ledger.filter((e) => e.label.includes("家賃"))).toHaveLength(2);
    expect(s.totals.living).toBe(24000 * 2 + 700 * 31 + 4500 + 2500);
    expect(reconcile(s)).toBe(true);
  });
  it("節約・住居・物価が生活費を変え、買い物は時間と資金を消費", () => {
    const standard = advanceDays(newGame("標準", "comfortable"), 1);
    const frugal = advanceDays(
      dispatch(newGame("節約", "comfortable"), {
        type: "standard",
        standard: "frugal",
      }),
      1,
    );
    expect(frugal.history[0].spending).toBeLessThan(
      standard.history[0].spending,
    );
    let s = newGame("買物");
    const before = s.cash,
      feel = s.person.satisfaction;
    s = dispatch(s, { type: "execute", actionId: "shopping" });
    expect(s.cash).toBe(before - 1500);
    expect(s.person.satisfaction).toBeGreaterThan(feel);
    expect(s.manualActions[0].hours).toBe(1);
    s = advanceDays(s, 1);
    expect(s.history[0].spending).toBe(24000 + 1500 + 700);
  });
  it("睡眠不足は健康・疲労に影響するが資金ゼロや高齢でも継続する", () => {
    const base = working();
    const low = advanceDays(
        dispatch(base, {
          type: "routine",
          routine: { sleepHours: 4, activityHours: 6 },
        }),
        120,
      ),
      high = advanceDays(base, 120);
    expect(low.person.health).toBeLessThan(high.person.health);
    expect(low.person.energy).toBeLessThan(high.person.energy);
    const poor = advanceDays(newGame("無資金", "challenge"), 365);
    expect(poor.days).toBe(365);
    expect(poor.debt).toBeGreaterThan(0);
    expect(reconcile(poor)).toBe(true);
  });
  it("生活費不足・借入・利息・返済を区別し純資産を保つ", () => {
    const s = newGame("借入", "challenge"),
      before = netWorth(s);
    borrow(s, 10000);
    expect(s.bank).toBe(10000);
    expect(s.loan).toBe(10000);
    expect(netWorth(s)).toBe(before);
    repay(s, 4000, false);
    expect(s.debt).toBe(10000);
    repay(s, 2000);
    expect(s.loan).toBe(8000);
    expect(reconcile(s)).toBe(true);
    const r = advanceDays(s, 31);
    expect(r.loan).toBe(8080);
    expect(r.reports.find((m) => m.month === "2026-05")?.interest).toBe(80);
    expect(reconcile(r)).toBe(true);
  });
  it("月次の期首＋現金収支＝期末、全給与＝入金＋未払給与", () => {
    const s = advanceDays(dual(), 90);
    for (const r of s.reports)
      expect(r.opening.cash + r.opening.bank + r.cashFlow).toBe(
        r.closing.cash + r.closing.bank,
      );
    const paid = s.ledger
      .filter((e) => e.kind === "wages")
      .reduce((a, e) => a + e.amount, 0);
    expect(paid + s.employments.reduce((a, e) => a + e.accrued, 0)).toBe(
      s.totals.wages,
    );
    expect(reconcile(s)).toBe(true);
  });
  it("5000件を超える元帳もチェックポイントで残高を照合できる", () => {
    const s = newGame("圧縮", "comfortable");
    for (let n = 0; n < 2600; n++) {
      transfer(s, 1, "bank");
      transfer(s, 1, "cash");
    }
    expect(s.ledger).toHaveLength(5000);
    expect(reconcile(s)).toBe(true);
    expect(validateSave(s)).toEqual(s);
  });
  it.each([NaN, Infinity, 0, -1, 1.5])("不正な資金移動を拒否 %s", (amount) => {
    const s = newGame("検証");
    expect(() => transfer(s, amount, "bank")).toThrow();
    expect(reconcile(s)).toBe(true);
  });
});
describe("拡張性・既存事業", () => {
  it("体力を使わない休養は疲労時にも実行でき、最小時間未満の買い物は見送る", () => {
    let s = dual();
    s = dispatch(s, {
      type: "routine",
      routine: { sleepHours: 4, weekdayAction: "rest", activityHours: 2 },
    });
    s.person.energy = 0;
    s.person.sleepDebt = 48;
    const n = advanceDays(s, 1);
    expect(n.history.at(-1)?.activityHours).toBe(2);
    let shop = newGame("短時間", "comfortable");
    shop = dispatch(shop, {
      type: "routine",
      routine: { weekdayAction: "shopping", activityHours: 0.5 },
    });
    const after = advanceDays(shop, 1);
    expect(after.history[0].activityHours).toBe(0);
    expect(after.history[0].events.some((e) => e.includes("必要な時間"))).toBe(
      true,
    );
    expect(after.cash).toBe(shop.cash - 700);
  });
  it("新しい行動を登録するだけで日次自動実行できる", () => {
    registerAction({
      id: "test-gardening",
      label: "園芸",
      category: "life",
      hours: 1,
      cost: () => 0,
      target: "person",
      result: "満足度上昇",
      manual: true,
      daily: true,
      condition: () => null,
      effect: (s, t, h) => {
        s.person.satisfaction = Math.min(100, s.person.satisfaction + h);
      },
    });
    try {
      let s = newGame("拡張");
      s = dispatch(s, { type: "action", action: "test-gardening" });
      expect(advanceDays(s, 1).person.satisfaction).toBeGreaterThan(
        s.person.satisfaction + 1,
      );
    } finally {
      actionRegistry.delete("test-gardening");
    }
  });
  it("二つの仕事と事業が同じ時間・資金モデルで両立する", () => {
    let s = dual();
    s = dispatch(s, { type: "open", industryId: "writing" });
    s = advanceDays(s, 30);
    expect(s.totals.wages).toBeGreaterThan(0);
    expect(s.business!.revenue).toBeGreaterThan(0);
    expect(
      s.history.every((h) => h.blocks.reduce((a, b) => a + b.hours, 0) === 24),
    ).toBe(true);
    expect(reconcile(s)).toBe(true);
    expect(validateSave(s)).toEqual(s);
  });
});
