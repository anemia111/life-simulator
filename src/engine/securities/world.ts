import type { GameState } from "../types";
import type { WorldFirm, FinancialRelease } from "./types";
import { book, nav } from "../enterprise/accounting";
import { nextDate } from "../time";
import { sectorModels } from "./catalog";
import {
  account,
  instrument,
  integer,
  held,
  compactAccount,
  marketNews,
} from "./ledger";
export function worldExpense(
  s: GameState,
  f: WorldFirm,
  amount: number,
  label: string,
) {
  const cash = Math.min(f.book.cash, amount),
    debt = amount - cash;
  book(s, f, label, { cash: -cash, debt, expenses: amount });
  book(s, s.securities.external, label + "（集計側）", {
    cash,
    receivables: debt,
    revenue: amount,
  });
}
export function payDividend(s: GameState, issuerId: string, perShare: number) {
  const x = s.securities,
    i = x.instruments.find((i) => i.issuerId === issuerId)!,
    f = x.firms.find((f) => f.id === issuerId),
    c = s.companies.find((c) => c.id === issuerId);
  if (!i || (!f && !c)) throw Error("配当主体が見つかりません");
  integer(perShare, 1);
  const source = f ?? c!,
    amount = integer(perShare * i.shares, 1, Number.MAX_SAFE_INTEGER);
  if (source.book.cash < amount || source.book.debt)
    throw Error("配当原資が不足しています");
  book(s, source, "株主への配当支払", { cash: -amount, equity: -amount });
  if (c) {
    c.dividends += amount;
    x.netTransfers += amount;
  }
  for (const a of x.accounts) {
    const q = held(a, i.id);
    if (!q) continue;
    const value = q * perShare;
    book(s, a, "保有株配当", { cash: value, revenue: value });
    a.dividends += value;
    if (
      a.id === "player" &&
      x.plans.some((p) => p.instrumentId === i.id && p.reinvest)
    )
      x.reinvestments.push({ instrumentId: i.id, amount: value });
    compactAccount(a);
  }
  marketNews(
    s,
    "dividend",
    i.id,
    i.name + "が1株" + perShare + "円の配当を支払った",
  );
}
export function worldMonth(s: GameState) {
  const x = s.securities;
  if (!s.date.endsWith("-01") || x.lastAccountingDate === s.date) return;
  const elapsed =
      (Date.parse(s.date) - Date.parse(x.lastAccountingDate)) / 86400000,
    scale = Math.min(31, elapsed) / 30;
  for (const model of sectorModels.values()) {
    const firms = x.firms.filter(
      (f) => f.sector === model.id && f.status !== "closed",
    );
    if (!firms.length) continue;
    const prior = x.sectorDemand[model.id] ?? 1,
      trend = 1 + model.growth / 12;
    const demand = Math.max(
      0.45,
      Math.min(
        2,
        prior * 0.9 * trend +
          0.1 *
            (0.8 + 0.2 * s.world.economy) *
            Math.pow(s.world.economy, model.cyclical * 0.1),
      ),
    );
    x.sectorDemand[model.id] = demand;
    const capacity = firms.reduce((n, f) => n + f.capacity, 0),
      pool = Math.floor(capacity * 0.8 * demand * scale),
      weights = firms.map(
        (f) =>
          (0.5 + f.quality / 100) *
          Math.pow(model.price / f.unitPrice, model.elasticity) *
          (f.strategy === "quality" ? 1.12 : 1),
      ),
      total = weights.reduce((a, b) => a + b, 0);
    let allocated = 0;
    firms.forEach((f, n) => {
      const wants =
        n === firms.length - 1
          ? pool - allocated
          : Math.floor((pool * weights[n]) / total);
      allocated += wants;
      const liquidity =
          f.book.cash + Math.min(1000000, Math.floor(f.book.equipment * 0.02)),
        costRatio = Math.max(0.15, 1 - model.margin - model.rd),
        units = Math.min(
          wants,
          Math.floor(f.capacity * scale),
          Math.floor(liquidity / (f.unitPrice * costRatio * 0.2)),
        );
      const revenue = Math.min(
          Math.floor(units * f.unitPrice),
          x.external.book.cash,
        ),
        costs = Math.round(
          revenue * costRatio + f.capacity * model.price * 0.06 * scale,
        ),
        rd = Math.round(revenue * model.rd),
        before = f.book.cash;
      book(s, x.external, "集計顧客の購入", {
        cash: -revenue,
        expenses: revenue,
      });
      book(s, f, "製品・サービス売上", { cash: revenue, revenue });
      worldExpense(s, f, costs, "原材料・給与・運営費");
      if (rd) worldExpense(s, f, rd, "研究開発費");
      const profit = revenue - costs - rd;
      f.monthRevenue = revenue;
      f.monthProfit = profit;
      f.quarterRevenue += revenue;
      f.quarterProfit += profit;
      f.quarterCosts += costs + rd;
      f.quarterRD += rd;
      f.marketShare = units / Math.max(1, pool);
      f.lossMonths = profit < 0 ? f.lossMonths + 1 : 0;
      f.status = f.book.debt ? "distressed" : "active";
      if (f.book.debt && f.book.cash) {
        const payment = Math.min(f.book.debt, f.book.cash);
        book(s, f, "未払費用を返済", { cash: -payment, debt: -payment });
        book(s, x.external, "企業未払費用の回収", {
          cash: payment,
          receivables: -payment,
        });
      }
      if (profit > 0 && f.book.cash > costs * 2 && !f.book.debt) {
        const capex = Math.min(
          Math.floor(profit * (f.strategy === "growth" ? 0.25 : 0.1)),
          Math.floor(f.book.cash * 0.05),
        );
        if (capex) {
          book(s, f, "生産設備への再投資", { cash: -capex, equipment: capex });
          book(s, x.external, "設備供給の代金", {
            cash: capex,
            revenue: capex,
          });
          f.capacity += Math.max(
            1,
            Math.floor(capex / (model.price * model.capital)),
          );
          f.quarterCapex += capex;
        }
      }
      f.quality = Math.min(98, f.quality + (rd > 0 ? 0.01 : 0.0));
      f.quarterCashFlow += f.book.cash - before;
      if (f.lossMonths >= 6 && f.book.debt > f.book.cash + f.book.equipment) {
        f.status = "closed";
        const i = instrument(s, f.instrumentId);
        i.status = "delisted";
        for (const o of x.orders.filter(
          (o) =>
            o.instrumentId === i.id &&
            (o.status === "open" || o.status === "partial"),
        )) {
          o.status = "cancelled";
          o.reservedCash = 0;
          o.reservedShares = 0;
        }
        marketNews(
          s,
          "delisting",
          i.id,
          f.name + "は資金不足と累積赤字により上場廃止。残債務を保持",
        );
      }
      if ([1, 4, 7, 10].includes(Number(s.date.slice(5, 7)))) {
        const published = new Date(Date.parse(s.date) + 7 * 86400000)
            .toISOString()
            .slice(0, 10),
          shares = instrument(s, f.instrumentId).shares,
          growth = f.previousRevenue
            ? f.quarterRevenue / f.previousRevenue - 1
            : 0,
          period = new Date(Date.parse(s.date) - 86400000)
            .toISOString()
            .slice(0, 7);
        f.pending.push({
          period,
          published,
          revenue: f.quarterRevenue,
          operatingProfit: f.quarterProfit,
          netIncome: f.quarterProfit,
          assets: f.book.cash + f.book.equipment,
          debt: f.book.debt,
          cash: f.book.cash,
          shares,
          eps: Math.trunc(f.quarterProfit / shares) || 0,
          growth,
          forecast: Math.round(
            f.quarterRevenue *
              (1 + Math.max(-0.2, Math.min(0.2, growth * 0.5))),
          ),
          dividendPerShare:
            f.quarterProfit > 0 && !f.book.debt
              ? Math.floor(
                  Math.min(f.quarterProfit * 0.2, f.book.cash * 0.1) / shares,
                )
              : 0,
          cashFlow: f.quarterCashFlow,
          rd: f.quarterRD,
          capex: f.quarterCapex,
        });
        f.previousRevenue = f.quarterRevenue;
        f.quarterRevenue = 0;
        f.quarterProfit = 0;
        f.quarterCosts = 0;
        f.quarterCashFlow = 0;
        f.quarterRD = 0;
        f.quarterCapex = 0;
      }
      compactAccount(f);
    });
  }
  x.lastAccountingDate = s.date;
}
export function publishReleases(s: GameState) {
  for (const f of s.securities.firms) {
    for (const r of f.pending.filter((r) => r.published <= s.date)) {
      f.published.push(r);
      f.published = f.published.slice(-12);
      if (
        f.status !== "closed" &&
        r.dividendPerShare > 0 &&
        f.book.cash >=
          r.dividendPerShare * instrument(s, f.instrumentId).shares &&
        !f.book.debt
      )
        payDividend(s, f.id, r.dividendPerShare);
      marketNews(
        s,
        "earnings",
        f.instrumentId,
        f.name +
          "が" +
          r.period +
          "決算を公表：売上" +
          r.revenue.toLocaleString("ja-JP") +
          "円、利益" +
          r.netIncome.toLocaleString("ja-JP") +
          "円",
      );
    }
    f.pending = f.pending.filter((r) => r.published > s.date);
  }
}
export function referenceValue(s: GameState, id: string) {
  const i = instrument(s, id),
    f = s.securities.firms.find((f) => f.id === i.issuerId);
  if (!f) return i.reference;
  const r = f.published.filter((r) => r.published <= s.date).at(-1);
  if (!r) return i.reference;
  const model = sectorModels.get(f.sector)!,
    bookPer = Math.max(0, (r.assets - r.debt) / r.shares),
    pe = Math.max(
      5,
      Math.min(
        25,
        10 + model.growth * 100 + r.growth * 3 - s.simulation.interest * 30,
      ),
    ),
    earnings = Math.max(0, ((r.netIncome * 4) / r.shares) * pe);
  return Math.max(
    1,
    Math.min(
      1000000000,
      Math.round(
        (bookPer * 0.5 + earnings * 0.5) *
          (1 + Math.max(-0.3, Math.min(0.3, r.growth))),
      ),
    ),
  );
}
export function globalDemandFactor(s: GameState, industry: string) {
  if (!s.securities) return 1;
  const family =
    industry === "software"
      ? "technology"
      : industry === "freelance"
        ? "industry"
        : "consumer";
  const values = [...sectorModels.values()]
    .filter((m) => m.family === family)
    .map((m) => s.securities.sectorDemand[m.id] ?? 1);
  return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
}
