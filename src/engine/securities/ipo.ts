import type { GameState } from "../types";
import type { Offering, FinancialRelease } from "./types";
import {
  book,
  companyNAV,
  companyProfit,
  consolidatedBook,
} from "../enterprise/accounting";
import {
  account,
  createAccount,
  addPosition,
  held,
  position,
  integer,
  availableCash,
  acquire,
  dispose,
  fee,
  marketNews,
} from "./ledger";
export const listedInstrument = (s: GameState, id: string) =>
  s.securities?.instruments.find((i) => i.issuerId === id);
export const pendingOffering = (s: GameState, id: string) =>
  s.securities?.offerings.some(
    (o) => o.companyId === id && o.status === "pending",
  ) ?? false;
export function ipoReason(s: GameState, id: string) {
  const c = s.companies.find((c) => c.id === id);
  if (!c || c.status !== "active") return "稼働中の会社を選んでください";
  if (listedInstrument(s, id) || pendingOffering(s, id))
    return "すでに上場済みまたは申請中です";
  if (
    (c.shareholders.find((h) => h.personId === "player")?.shares ?? 0) * 2 <=
    c.shares
  )
    return "過半数の議決権が必要です";
  if (Date.parse(s.date) - Date.parse(c.founded) < 90 * 86400000)
    return "設立から90日以上が必要です";
  if (
    companyNAV(s, c) < 100000 ||
    companyProfit(s, c) < 1000 ||
    c.book.debt ||
    c.book.cash < 10000
  )
    return "純資産10万円・累積利益1千円・未払なし・手続資金1万円が必要です";
  return null;
}
export function applyIPO(
  s: GameState,
  id: string,
  primary: number,
  secondary: number,
  price: number,
) {
  const reason = ipoReason(s, id);
  if (reason) throw Error(reason);
  const c = s.companies.find((c) => c.id === id)!,
    own = c.shareholders.find((h) => h.personId === "player")!;
  integer(primary, 0, c.shares * 4);
  integer(secondary, 0, own.shares);
  integer(price, 1, 1000000000);
  if (!primary && !secondary)
    throw Error("公募または売出し株を指定してください");
  const per = Math.max(1, Math.floor(companyNAV(s, c) / c.shares));
  if (
    price < Math.max(1, Math.floor(per * 0.5)) ||
    price > Math.ceil(per * 1.5)
  )
    throw Error("公開価格は現在の持分簿価の50〜150%で指定してください");
  book(s, c, "上場申請費用", { cash: -10000, expenses: 10000 });
  book(s, s.securities.broker, "上場申請手数料", {
    cash: 10000,
    revenue: 10000,
  });
  s.securities.netTransfers += 10000;
  const b = consolidatedBook(s, c),
    opens = new Date(Date.parse(s.date) + 7 * 86400000)
      .toISOString()
      .slice(0, 10),
    prospectus: FinancialRelease = {
      period: "上場申請時",
      published: s.date,
      revenue: b.revenue,
      operatingProfit: companyProfit(s, c),
      netIncome: companyProfit(s, c),
      assets: b.cash + b.inventory + b.equipment + b.receivables,
      debt: b.debt,
      cash: b.cash,
      shares: c.shares,
      eps: Math.floor(companyProfit(s, c) / c.shares),
      growth: 0,
      forecast: b.revenue,
      dividendPerShare: 0,
      cashFlow: b.cash - c.capital,
      rd: 0,
      capex: b.equipment,
    };
  const o: Offering = {
    id: "ipo-" + ++s.sequence,
    companyId: id,
    filed: s.date,
    opens,
    status: "pending",
    primary,
    secondary,
    price,
    prospectus,
    raised: 0,
    secondaryProceeds: 0,
    reason: "",
  };
  s.securities.offerings.push(o);
  marketNews(
    s,
    "ipo-application",
    id,
    c.name + "が上場を申請。募集開始は" + opens,
  );
  return o;
}
function convertOwnership(
  s: GameState,
  c: GameState["companies"][number],
  instrumentId: string,
  price: number,
) {
  const nav = companyNAV(s, c);
  for (const h of c.shareholders) {
    let a = s.securities.accounts.find(
      (a) =>
        a.ownerId === h.personId && (a.kind === "player" || a.kind === "npc"),
    );
    if (!a) {
      const npc = s.npcs.find((p) => p.id === h.personId)!;
      a = createAccount(
        s,
        h.personId,
        npc.name + " 証券口座",
        "npc",
        h.personId,
      );
    }
    const cost =
      h.paid > 0
        ? h.paid
        : h.personId === "player"
          ? Math.max(0, Math.floor((nav * h.shares) / c.shares))
          : 0;
    const resident = s.simulation.residents.find((r) => r.id === h.personId);
    const carry = Math.min(h.booked ?? 0, resident?.book.inventory ?? 0);
    if (resident && carry)
      book(s, resident, "非公開株を証券口座へ移管", {
        inventory: -carry,
        equity: -carry,
      });
    addPosition(s, a, instrumentId, h.shares, cost, true);
  }
}
export function syncShareholders(s: GameState) {
  for (const c of s.companies) {
    const i = listedInstrument(s, c.id);
    if (!i) continue;
    const old = new Map(c.shareholders.map((h) => [h.personId, h.paid]));
    c.shareholders = s.securities.accounts
      .filter((a) => held(a, i.id) > 0)
      .map((a) => ({
        personId: a.ownerId,
        shares: held(a, i.id),
        paid: old.get(a.ownerId) ?? 0,
      }));
    c.shares = i.shares;
    const player =
      c.shareholders.find((h) => h.personId === "player")?.shares ?? 0;
    c.representative =
      player * 2 > c.shares
        ? "player"
        : (c.shareholders
            .filter((h) => h.personId !== "player")
            .sort((a, b) => b.shares - a.shares)[0]?.personId ??
          "external-board");
  }
}
export function processOfferings(s: GameState) {
  for (const o of s.securities.offerings.filter(
    (o) => o.status === "pending" && o.opens <= s.date,
  )) {
    const c = s.companies.find((c) => c.id === o.companyId)!;
    const buyers = s.securities.accounts.filter(
      (a) => a.kind === "institution",
    );
    let remaining = o.primary + o.secondary;
    const allocations = buyers.map((a) => {
      const reference = Math.max(
        (o.prospectus.assets - o.prospectus.debt) / o.prospectus.shares,
        o.prospectus.eps * 12,
      );
      const quantity =
        o.price <= reference * 1.6
          ? Math.min(
              remaining,
              Math.floor((Math.max(0, availableCash(s, a)) * 0.02) / o.price),
            )
          : 0;
      remaining -= quantity;
      return { a, quantity };
    });
    const sold = allocations.reduce((n, x) => n + x.quantity, 0);
    if (sold < o.primary + o.secondary) {
      o.status = "failed";
      o.reason = "公開条件に見合う有限の買付資金が集まらず募集不成立";
      marketNews(s, "ipo-failed", c.id, c.name + "の上場募集は不成立");
      continue;
    }
    const id = "listed-" + c.id;
    s.securities.instruments.push({
      id,
      ticker: "LSP" + String(++s.sequence),
      name: c.name,
      kind: "stock",
      issuerId: c.id,
      fundId: null,
      exchangeId: "aurora",
      shares: c.shares,
      price: o.price,
      previousClose: o.price,
      reference: o.price,
      volume: 0,
      listed: s.date,
      status: "listed",
      history: [],
    });
    convertOwnership(s, c, id, o.price);
    const issuer = createAccount(
      s,
      "issuer-" + c.id,
      c.name + "発行体",
      "issuer",
      c.id,
    );
    let primary = o.primary,
      secondary = o.secondary;
    for (const { a, quantity } of allocations) {
      let n = Math.min(primary, quantity);
      if (n) {
        const value = n * o.price,
          commission = fee(value);
        acquire(s, a, id, n, o.price, 0);
        book(s, c, "公募増資の払込", {
          cash: value - commission,
          equity: value,
          expenses: commission,
        });
        book(s, s.securities.broker, "公募取扱手数料", {
          cash: commission,
          revenue: commission,
        });
        s.securities.netTransfers -= value - commission;
        c.capital += value;
        s.securities.instruments.at(-1)!.shares += n;
        o.raised += value;
        primary -= n;
        s.securities.trades.push({
          id: ++s.sequence,
          date: s.date,
          instrumentId: id,
          buyerId: a.id,
          sellerId: issuer.id,
          quantity: n,
          price: o.price,
          buyerFee: 0,
          sellerFee: commission,
          kind: "ipo",
        });
      }
      n = Math.min(secondary, quantity - n);
      if (n) {
        const value = n * o.price,
          commission = fee(value);
        acquire(s, a, id, n, o.price, 0);
        dispose(s, account(s), id, n, o.price, commission);
        book(s, s.securities.broker, "既存株売出し手数料", {
          cash: commission,
          revenue: commission,
        });
        o.secondaryProceeds += value - commission;
        secondary -= n;
        s.securities.trades.push({
          id: ++s.sequence,
          date: s.date,
          instrumentId: id,
          buyerId: a.id,
          sellerId: "player",
          quantity: n,
          price: o.price,
          buyerFee: 0,
          sellerFee: commission,
          kind: "ipo",
        });
      }
    }
    o.status = "listed";
    s.securities.localReports[c.id] = s.date;
    const disclosed = consolidatedBook(s, c);
    s.securities.localFinancials[c.id] = [
      {
        ...o.prospectus,
        period: "IPO完了時（累計）",
        published: s.date,
        shares: c.shares,
        assets:
          disclosed.cash +
          disclosed.inventory +
          disclosed.equipment +
          disclosed.receivables,
        cash: disclosed.cash,
        debt: disclosed.debt,
        netIncome: companyProfit(s, c),
        eps: Math.trunc(companyProfit(s, c) / c.shares) || 0,
      },
    ];
    syncShareholders(s);
    marketNews(
      s,
      "ipo",
      id,
      c.name +
        "が上場。公募調達" +
        o.raised +
        "円、既存株売出し" +
        o.secondaryProceeds +
        "円",
    );
  }
}
export function publishLocalCompanies(s: GameState) {
  for (const c of s.companies) {
    const i = listedInstrument(s, c.id);
    if (!i) continue;
    if (c.status === "dissolved") {
      i.status = "delisted";
      continue;
    }
    if (s.date.endsWith("-01")) {
      const b = consolidatedBook(s, c),
        value = Math.max(
          1,
          Math.floor(
            (companyNAV(s, c) + Math.max(0, companyProfit(s, c)) * 4) /
              c.shares,
          ),
        );
      i.reference = value;
      s.securities.localReports[c.id] = s.date;
      const reports = (s.securities.localFinancials[c.id] ??= []);
      reports.push({
        period: s.date.slice(0, 7) + " 累計",
        published: s.date,
        revenue: b.revenue,
        operatingProfit: companyProfit(s, c),
        netIncome: companyProfit(s, c),
        assets: b.cash + b.inventory + b.equipment + b.receivables,
        debt: b.debt,
        cash: b.cash,
        shares: c.shares,
        eps: Math.trunc(companyProfit(s, c) / c.shares) || 0,
        growth: 0,
        forecast: b.revenue,
        dividendPerShare: 0,
        cashFlow: b.cash - c.capital,
        rd: 0,
        capex: b.equipment,
      });
      s.securities.localFinancials[c.id] = reports.slice(-12);
      marketNews(
        s,
        "earnings",
        i.id,
        c.name + "が月次の財務を公開（純資産" + companyNAV(s, c) + "円）",
      );
    }
  }
}
export function votingAction(s: GameState, id: string, policy: string) {
  const c = s.companies.find((c) => c.id === id),
    i = listedInstrument(s, id);
  if (!c || !i || held(account(s), i.id) * 2 <= i.shares)
    throw Error("議決には過半数の保有株が必要です");
  if (policy === "delist") {
    if (c.shareholders.some((h) => h.personId !== "player"))
      throw Error("自主上場廃止は全株取得後に実行できます");
    i.status = "delisted";
    for (const o of s.securities.orders.filter(
      (o) =>
        o.instrumentId === i.id &&
        (o.status === "open" || o.status === "partial"),
    )) {
      o.status = "cancelled";
      o.reservedCash = 0;
      o.reservedShares = 0;
    }
    marketNews(s, "delisting", i.id, c.name + "の全株主承認による上場廃止");
    return;
  }
  if (!["value", "growth", "quality"].includes(policy))
    throw Error("経営方針が不正です");
  c.representative = "player";
  if (policy === "quality") {
    for (const v of s.ventures.filter((v) => v.ownerId === c.id)) {
      if (v.book.debt || v.book.cash < 5000)
        throw Error("品質投資には各事業の利用可能現金5千円が必要です");
    }
    for (const v of s.ventures.filter((v) => v.ownerId === c.id)) {
      book(s, v, "株主方針による品質投資", { cash: -5000, expenses: 5000 });
      v.quality = Math.min(100, v.quality + 5);
    }
  }
  for (const v of s.ventures.filter((v) => v.ownerId === c.id)) {
    v.advertising = policy === "growth" ? 500 : 0;
    v.autoOrders = true;
    v.reorder = policy === "growth" ? 10 : 3;
    v.targetStock = policy === "growth" ? 60 : 30;
  }
  marketNews(
    s,
    "vote",
    i.id,
    c.name +
      "の株主決議：" +
      { value: "費用効率", growth: "拡大投資", quality: "品質重視" }[
        policy as "value" | "growth" | "quality"
      ],
  );
}
