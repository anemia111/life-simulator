import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { newGame, dispatch, advanceDays } from "./engine";
import type { GameState } from "./engine/types";
import type { SecuritiesInput } from "./engine/securities/types";
import {
  account,
  held,
  availableCash,
  availableShares,
  marketCash,
  portfolioValue,
  fee,
} from "./engine/securities/ledger";
import {
  placeOrder,
  matchOrders,
  cancelOrder,
} from "./engine/securities/exchange";
import {
  subscribeFund,
  updateIndices,
  reconstituteIndex,
} from "./engine/securities/funds";
import {
  referenceValue,
  worldMonth,
  worldExpense,
  publishReleases,
  payDividend,
  globalDemandFactor,
} from "./engine/securities/world";
import { applyIPO, ipoReason, listedInstrument } from "./engine/securities/ipo";
import { verifySecurities } from "./engine/securities/schema";
import {
  book,
  verifyAccounts,
  companyNAV,
  enterpriseWealth,
} from "./engine/enterprise/accounting";
import { netWorth, receive, reconcile } from "./engine/finance";
import { parseSave, validateSave, saveGame, loadGame } from "./persistence";
import v6 from "../tests/fixtures/v6-save.json";
const exec = (s: GameState, input: SecuritiesInput) =>
  dispatch(s, {
    type: "execute",
    actionId: "securities-manage",
    target: { securities: input },
  });
const funded = () =>
  exec(newGame("投資する人生", "comfortable"), {
    operation: "deposit",
    amount: 50000,
  });
function audit(s: GameState) {
  updateIndices(s);
  expect(verifySecurities(s)).toBe(true);
  expect(reconcile(s)).toBe(true);
  expect(marketCash(s)).toBe(
    s.securities.openingCash + s.securities.netTransfers,
  );
  expect(parseSave(JSON.stringify(s))).toEqual(s);
}
function established() {
  let s = newGame("公開企業", "comfortable");
  receive(s, 300000, "試験の開始資産");
  s = dispatch(s, {
    type: "enterprise",
    input: {
      operation: "create-company",
      name: "青葉研究社",
      amount: 150000,
      value: 100,
    },
  });
  const c = s.companies[0];
  c.founded = "2025-01-01";
  book(s, c, "既存の受託利益", { cash: 20000, revenue: 20000 });
  return s;
}
describe("Phase 6 世界企業・証券市場", () => {
  it("45業界225社の一意な社名・コードと異なる実財務を生成する", () => {
    const s = newGame("世界");
    expect(s.securities.firms).toHaveLength(225);
    expect(new Set(s.securities.firms.map((f) => f.sector)).size).toBe(45);
    expect(new Set(s.securities.instruments.map((i) => i.ticker)).size).toBe(
      227,
    );
    expect(new Set(s.securities.firms.map((f) => f.capacity))).toHaveLength(5);
    expect(
      new Set(s.securities.firms.map((f) => f.unitPrice)).size,
    ).toBeGreaterThan(20);
    audit(s);
  });
  it("個人口座と証券口座の入出金は純資産を保存し予約資金は出金できない", () => {
    const initial = newGame("資金", "comfortable"),
      s = exec(initial, { operation: "deposit", amount: 50000 });
    expect(netWorth(s)).toBe(netWorth(initial));
    expect(s.cash + s.bank).toBe(initial.cash + initial.bank - 50000);
    expect(account(s).book.cash).toBe(50000);
    const id = s.securities.instruments[0].id;
    placeOrder(s, "player", id, "buy", "limit", 100, 400);
    expect(() => exec(s, { operation: "withdraw", amount: 20000 })).toThrow(
      /不足/,
    );
    audit(s);
  });
  it("買付資金と売却株を二重予約できず取消で解放する", () => {
    let s = funded();
    const id = s.securities.instruments[0].id,
      o = placeOrder(s, "player", id, "buy", "limit", 100, 400);
    expect(availableCash(s, account(s))).toBe(9900);
    expect(() =>
      placeOrder(s, "player", id, "buy", "limit", 30, 400),
    ).toThrow();
    cancelOrder(s, o.id);
    expect(availableCash(s, account(s))).toBe(50000);
    expect(() =>
      placeOrder(s, "player", id, "sell", "limit", 1, 100),
    ).toThrow();
    audit(s);
  });
  it("価格・時間優先で部分約定し現金・株数・取得原価・手数料が一致する", () => {
    const s = funded(),
      id = s.securities.instruments[0].id;
    const buy = placeOrder(s, "player", id, "buy", "limit", 200, 100);
    placeOrder(s, "institution-0", id, "sell", "limit", 100, 100);
    const cash = marketCash(s);
    expect(matchOrders(s, id, 40)).toBe(40);
    expect(buy.remaining).toBe(160);
    expect(buy.status).toBe("partial");
    expect(held(account(s), id)).toBe(40);
    expect(account(s).positions.find((p) => p.instrumentId === id)!.cost).toBe(
      4004,
    );
    expect(account(s).book.inventory).toBe(4004);
    expect(marketCash(s)).toBe(cash);
    expect(s.securities.broker.book.cash).toBe(8);
    audit(s);
  });
  it("売却の平均取得原価を整数配分し実現損益と残高を照合する", () => {
    const s = funded(),
      id = s.securities.instruments[0].id;
    placeOrder(s, "player", id, "buy", "limit", 40, 100);
    placeOrder(s, "institution-0", id, "sell", "limit", 40, 100);
    matchOrders(s, id);
    placeOrder(s, "player", id, "sell", "limit", 30, 120);
    placeOrder(s, "institution-2", id, "buy", "limit", 30, 120);
    matchOrders(s, id);
    expect(account(s).realized).toBe(593);
    expect(account(s).book.inventory).toBe(1001);
    expect(held(account(s), id)).toBe(10);
    audit(s);
  });
  it("自分の売りと買いだけでは約定や株価を生成しない", () => {
    const s = funded(),
      id = s.securities.instruments[0].id;
    placeOrder(s, "institution-0", id, "buy", "limit", 10, 500);
    placeOrder(s, "institution-0", id, "sell", "limit", 10, 400);
    const price = s.securities.instruments[0].price;
    expect(matchOrders(s, id)).toBe(0);
    expect(s.securities.instruments[0].price).toBe(price);
    audit(s);
  });
  it("成行は価格保護付きで次の平日に清算し残りを失効する", () => {
    let s = funded(),
      id = s.securities.instruments[0].id;
    s = exec(s, {
      operation: "order",
      instrumentId: id,
      side: "buy",
      orderType: "market",
      quantity: 1,
    });
    expect(held(account(s), id)).toBe(0);
    s = advanceDays(s, 1);
    expect(held(account(s), id)).toBe(1);
    expect(
      s.securities.orders.find((o) => o.accountId === "player")!.status,
    ).toBe("filled");
    audit(s);
  });
  it("週末には約定せず指値注文が保持される", () => {
    let s = advanceDays(funded(), 3);
    expect(s.date).toBe("2026-04-04");
    const id = s.securities.instruments[0].id;
    s = exec(s, {
      operation: "order",
      instrumentId: id,
      side: "buy",
      orderType: "limit",
      quantity: 1,
      price: 1,
    });
    s = advanceDays(s, 2);
    expect(held(account(s), id)).toBe(0);
    expect(
      s.securities.orders.find((o) => o.accountId === "player")!.status,
    ).toBe("open");
    audit(s);
  });
  it("資金不足・過剰売却・不正数量は元の状態を変えず拒否する", () => {
    const s = funded(),
      id = s.securities.instruments[0].id,
      before = JSON.stringify(s);
    for (const input of [
      {
        operation: "order",
        instrumentId: id,
        side: "buy",
        orderType: "limit",
        quantity: 100000,
        price: 10000,
      },
      {
        operation: "order",
        instrumentId: id,
        side: "sell",
        orderType: "market",
        quantity: 1,
      },
      {
        operation: "order",
        instrumentId: id,
        side: "buy",
        orderType: "limit",
        quantity: -1,
        price: 100,
      },
    ])
      expect(() => exec(s, input as SecuritiesInput)).toThrow();
    expect(JSON.stringify(s)).toBe(before);
  });
  it("公開前の決算を参考価値やNPCが利用しない", () => {
    const s = newGame("開示"),
      f = s.securities.firms[0],
      i = s.securities.instruments[0],
      before = referenceValue(s, i.id),
      r = { ...f.published[0], published: "2026-04-08", netIncome: 9999999999 };
    f.pending.push(r);
    expect(referenceValue(s, i.id)).toBe(before);
    publishReleases(s);
    expect(f.pending).toHaveLength(1);
    s.date = "2026-04-08";
    publishReleases(s);
    expect(referenceValue(s, i.id)).toBeGreaterThan(before);
    expect(f.pending).toHaveLength(0);
  });
  it("月次業績と外部部門の対応記帳・四半期の遅延開示が動作する", () => {
    const s = advanceDays(newGame("決算"), 100);
    expect(s.securities.firms.some((f) => f.monthRevenue > 0)).toBe(true);
    expect(s.securities.firms[0].published.length).toBeGreaterThan(1);
    expect(
      s.securities.firms.every((f) =>
        f.published.every((r) => r.published <= s.date),
      ),
    ).toBe(true);
    expect(s.securities.news.some((n) => n.kind === "earnings")).toBe(true);
    audit(s);
  });
  it("世界需要が地域事業へ接続し売上のために無限現金を発生させない", () => {
    const s = newGame("需要"),
      before = globalDemandFactor(s, "software");
    for (const f of s.securities.firms.filter((f) => f.sector === "sector-01"))
      s.securities.sectorDemand[f.sector] = 0.5;
    expect(globalDemandFactor(s, "software")).toBeLessThan(before);
    const external = s.securities.external;
    book(s, external, "試験で利用可能な外部資金を手数料口座へ移動", {
      cash: -external.book.cash,
      equity: -external.book.cash,
    });
    book(s, s.securities.broker, "外部資金の受入", {
      cash: s.securities.openingCash - marketCash(s),
      equity: s.securities.openingCash - marketCash(s),
    });
    s.date = "2026-05-01";
    worldMonth(s);
    expect(s.securities.firms[0].monthRevenue).toBe(0);
    expect(external.book.cash).toBeGreaterThanOrEqual(0);
    expect(marketCash(s)).toBe(s.securities.openingCash);
  });
  it("株数に応じた配当は会社資金を減らし各口座とファンドへ入る", () => {
    const s = funded(),
      id = s.securities.instruments[0].id;
    placeOrder(s, "player", id, "buy", "limit", 2, 100);
    placeOrder(s, "institution-0", id, "sell", "limit", 2, 100);
    matchOrders(s, id);
    const f = s.securities.firms[0],
      before = f.book.cash,
      cash = account(s).book.cash;
    payDividend(s, f.id, 1);
    expect(f.book.cash).toBe(before - 100000);
    expect(account(s).book.cash).toBe(cash + 2);
    expect(account(s).dividends).toBe(2);
    audit(s);
  });
  it("ETFの基準価額が実在する225社の保有資産と費用へ連動する", () => {
    let s = funded();
    const fund = s.securities.funds[0],
      a = account(s, fund.accountId);
    expect(a.positions).toHaveLength(225);
    const before = a.book.cash;
    s = advanceDays(s, 31);
    expect(s.securities.funds[0].feesAccrued).toBeGreaterThan(0);
    expect(account(s, fund.accountId).book.cash).toBeLessThan(before + 1000000);
    audit(s);
  });
  it("投信の申込・解約で実現金と口数を移し、残金不足を拒否する", () => {
    const s = funded(),
      id = "fund-mutual",
      units = s.securities.instruments.find((i) => i.id === id)!.shares,
      cash = marketCash(s);
    subscribeFund(s, "player", id, 2);
    expect(held(account(s), id)).toBe(2);
    expect(s.securities.instruments.find((i) => i.id === id)!.shares).toBe(
      units + 2,
    );
    expect(marketCash(s)).toBe(cash);
    subscribeFund(s, "player", id, 1, true);
    expect(held(account(s), id)).toBe(1);
    expect(() => subscribeFund(s, "player", id, 5, true)).toThrow();
    audit(s);
  });
  it("指数は実銘柄の時価総額から計算し構成変更でも値を維持する", () => {
    const s = newGame("指数"),
      index = s.securities.indices[0],
      before = index.value;
    reconstituteIndex(s, index.id, index.members.slice(0, 50));
    expect(index.value).toBe(before);
    updateIndices(s);
    expect(index.value).toBeCloseTo(before, 9);
    audit(s);
  });
  it("積立投資は証券口座にある資金だけを使う", () => {
    let s = funded();
    s = exec(s, {
      operation: "plan",
      instrumentId: "fund-mutual",
      amount: 10000,
      day: 1,
      reinvest: true,
    });
    s = advanceDays(s, 1);
    expect(held(account(s), "fund-mutual")).toBeGreaterThan(0);
    expect(account(s).book.cash).toBeGreaterThanOrEqual(0);
    audit(s);
  });
  it("IPOには会社の年齢・利益・資産・議決権を必要とする", () => {
    let s = established(),
      c = s.companies[0];
    expect(ipoReason(s, c.id)).toBeNull();
    c.founded = s.date;
    expect(ipoReason(s, c.id)).toMatch(/90日/);
  });
  it("IPOの公募と売出しを分離し希薄化・外部株主・支配権喪失を反映する", () => {
    let s = established(),
      c = s.companies[0],
      beforeCash = c.book.cash;
    s = exec(s, {
      operation: "ipo",
      companyId: c.id,
      primary: 100,
      secondary: 20,
      price: 1700,
    });
    expect(s.securities.offerings[0].status).toBe("pending");
    s = advanceDays(s, 8);
    c = s.companies[0];
    const offer = s.securities.offerings[0],
      i = listedInstrument(s, c.id)!;
    expect(offer.status).toBe("listed");
    expect(c.shares).toBe(200);
    expect(held(account(s), i.id)).toBe(80);
    expect(offer.raised).toBe(170000);
    expect(offer.secondaryProceeds).toBe(33966);
    expect(c.book.cash).toBe(beforeCash - 10000 + 170000 - 170);
    expect(c.representative).not.toBe("player");
    expect(enterpriseWealth(s)).toBe(0);
    expect(() =>
      dispatch(s, {
        type: "enterprise",
        input: { operation: "officer", id: c.id, amount: 1000 },
      }),
    ).toThrow();
    audit(s);
  });
  it("IPO申請中に株数を変更して募集条件をすり替えられない", () => {
    let s = established();
    s = exec(s, {
      operation: "ipo",
      companyId: s.companies[0].id,
      primary: 20,
      secondary: 0,
      price: 1700,
    });
    expect(() =>
      dispatch(s, {
        type: "enterprise",
        input: {
          operation: "capital",
          id: s.companies[0].id,
          amount: 1000,
          value: 1,
        },
      }),
    ).toThrow(/申請中/);
  });
  it("NPCにも実資金の入金・保有・予約があり架空の買付を行わない", () => {
    const s = advanceDays(newGame("NPC投資"), 60);
    expect(
      s.securities.accounts.some((a) => a.kind === "npc" && a.deposits > 0),
    ).toBe(true);
    expect(s.securities.trades.some((t) => t.kind === "exchange")).toBe(true);
    audit(s);
  });
  it("旧v6の人生・家族・資金・事業を保って新しい市場を追加する", () => {
    const s = validateSave(v6);
    expect(s.schemaVersion).toBe(7);
    for (const key of [
      "cash",
      "bank",
      "debt",
      "ventures",
      "companies",
      "social",
      "spatial",
      "employments",
    ] as const)
      expect(s[key]).toEqual(v6[key]);
    expect(s.securities.firms).toHaveLength(225);
    audit(s);
  });
  it("注文・予約・証券原価・株数・現金の不正なセーブを拒否する", () => {
    const s = funded(),
      id = s.securities.instruments[0].id;
    placeOrder(s, "player", id, "buy", "limit", 10, 100);
    for (const damage of [
      (n: GameState) => {
        n.securities.orders[0].reservedCash++;
      },
      (n: GameState) => {
        account(n).book.inventory++;
      },
      (n: GameState) => {
        n.securities.instruments[0].shares++;
      },
      (n: GameState) => {
        n.securities.netTransfers++;
      },
    ]) {
      const n = structuredClone(s);
      damage(n);
      expect(() => validateSave(n)).toThrow();
    }
  });
  it(
    "証券を含む保存と再開、日次と一括の結果が一致する",
    { timeout: 60000 },
    async () => {
      let s = funded();
      s = exec(s, {
        operation: "order",
        instrumentId: s.securities.instruments[0].id,
        side: "buy",
        orderType: "limit",
        quantity: 1,
        price: 1,
      });
      await saveGame(2, s);
      expect(await loadGame(2)).toEqual(s);
      const fast = advanceDays(s, 60);
      let daily = s;
      for (let n = 0; n < 60; n++) daily = advanceDays(daily, 1);
      expect(fast).toEqual(daily);
      audit(fast);
    },
  );
});

it("資金も保有株もない機関は注文を出せず価格も動かせない", () => {
  let s = funded();
  const i = s.securities.instruments[0],
    a = account(s, "institution-0");
  expect(() =>
    placeOrder(s, a.id, i.id, "buy", "limit", 1000000000, i.price),
  ).toThrow();
  expect(() =>
    placeOrder(s, a.id, i.id, "sell", "limit", 8751, i.price),
  ).toThrow();
  const price = i.price;
  expect(matchOrders(s, i.id)).toBe(0);
  expect(i.price).toBe(price);
  audit(s);
});
it("50%保有では経営権を維持できず議決操作を拒否する", () => {
  let s = established();
  applyIPO(s, s.companies[0].id, 100, 0, 1600);
  s = advanceDays(s, 8);
  const c = s.companies[0];
  expect(c.shares).toBe(200);
  expect(c.representative).not.toBe("player");
  expect(() =>
    exec(s, { operation: "vote", companyId: c.id, value: "growth" }),
  ).toThrow(/過半数/);
  audit(s);
});
it("積立対象の上場廃止でも人生を進行できる", () => {
  let s = funded();
  const i = s.securities.instruments[0];
  i.status = "delisted";
  s.securities.plans.push({
    instrumentId: i.id,
    amount: 1000,
    day: 1,
    reinvest: true,
  });
  s = advanceDays(s, 1);
  expect(s.days).toBe(1);
  expect(s.securities.news.some((n) => n.text.includes("上場廃止銘柄"))).toBe(
    true,
  );
  audit(s);
});
it("非公開株の売却・配当・解散は知人の実資金と残余財産へ反映する", () => {
  let s = established();
  const r = s.simulation.residents[0],
    c = s.companies[0];
  s.relationships.push({
    npcId: r.id,
    affinity: 90,
    trust: 90,
    met: s.date,
    interactions: 1,
  });
  const before = r.book.cash;
  s = dispatch(s, {
    type: "enterprise",
    input: { operation: "sell-shares", id: c.id, npcId: r.id, amount: 5 },
  });
  const after = s.simulation.residents.find((x) => x.id === r.id)!;
  expect(after.book.cash).toBeLessThan(before);
  expect(
    s.companies[0].shareholders.find((h) => h.personId === r.id)?.booked,
  ).toBeGreaterThan(0);
  const holdingCash = after.book.cash;
  s = dispatch(s, {
    type: "enterprise",
    input: { operation: "dividend", id: c.id, amount: 1000 },
  });
  expect(s.simulation.residents.find((x) => x.id === r.id)!.book.cash).toBe(
    holdingCash + 50,
  );
  s = dispatch(s, {
    type: "enterprise",
    input: { operation: "dissolve", id: c.id, amount: 1 },
  });
  expect(
    s.simulation.residents.find((x) => x.id === r.id)!.book.inventory,
  ).toBe(0);
  expect(s.companies[0].book.cash).toBe(0);
  audit(s);
});

it("世界企業が支払不能で撤退し、注文を解放して残債務を保持する", () => {
  const s = funded(),
    f = s.securities.firms[0],
    i = s.securities.instruments[0];
  placeOrder(s, "player", i.id, "buy", "limit", 1, 1);
  f.unitPrice = 1;
  f.lossMonths = 5;
  worldExpense(
    s,
    f,
    f.book.cash + f.book.equipment * 3,
    "試験の損失と未払費用",
  );
  s.date = "2026-05-01";
  s.days = 30;
  worldMonth(s);
  expect(f.status).toBe("closed");
  expect(i.status).toBe("delisted");
  expect(f.book.debt).toBeGreaterThan(0);
  expect(s.securities.orders[0].reservedCash).toBe(0);
  audit(s);
});
it("同じ供給・品質でも高価格は業界需要の配分を減らす", () => {
  const a = newGame("価格因果"),
    b = structuredClone(a);
  const fa = a.securities.firms[0],
    fb = b.securities.firms[0];
  fb.unitPrice *= 2;
  a.date = b.date = "2026-05-01";
  a.days = b.days = 30;
  worldMonth(a);
  worldMonth(b);
  expect(fb.marketShare).toBeLessThan(fa.marketShare);
  expect(
    a.securities.firms
      .filter((f) => f.sector === fa.sector)
      .reduce((n, f) => n + f.marketShare, 0),
  ).toBeLessThanOrEqual(1);
  audit(a);
  audit(b);
});
