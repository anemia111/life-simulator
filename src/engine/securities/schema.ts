import { z } from "zod";
import { account as accountsSchema } from "../enterprise/schema";
import { verifyAccounts } from "../enterprise/accounting";
import type { GameState } from "../types";
import { sectorModels, exchanges } from "./catalog";
import { reserveAmount } from "./exchange";
import { activeOrder } from "./ledger";
import { marketCash } from "./ledger";
const id = z.string().min(1).max(300),
  n = z.number().safe().int().nonnegative(),
  signed = z.number().safe().int(),
  f = z.number().finite(),
  positive = f.nonnegative(),
  date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        Number.isFinite(Date.parse(v)) &&
        new Date(v).toISOString().slice(0, 10) === v,
    );
export const releaseSchema = z.object({
  period: id,
  published: date,
  revenue: n,
  operatingProfit: signed,
  netIncome: signed,
  assets: n,
  debt: n,
  cash: n,
  shares: n.min(1),
  eps: signed,
  growth: f,
  forecast: n,
  dividendPerShare: n,
  cashFlow: signed,
  rd: n,
  capex: n,
});
const portfolio = z.object({
  ...accountsSchema,
  id,
  name: id,
  kind: z.enum(["player", "npc", "institution", "founder", "fund", "issuer"]),
  ownerId: id,
  strategy: z.enum(["value", "growth", "income", "index", "cautious"]),
  positions: z.array(z.object({ instrumentId: id, quantity: n, cost: n })),
  realized: signed,
  dividends: n,
  fees: n,
  deposits: n,
  withdrawals: n,
});
export const securitiesSchema = z.object({
  firms: z.array(
    z.object({
      ...accountsSchema,
      id,
      instrumentId: id,
      name: id,
      region: id,
      headquarters: id,
      founded: n,
      sector: id,
      business: id,
      employees: n,
      strategy: z.enum(["value", "quality", "growth"]),
      quality: positive.max(100),
      capacity: n,
      unitPrice: n.min(1),
      growthStage: positive,
      international: positive.max(1),
      marketShare: positive.max(1),
      monthRevenue: n,
      monthProfit: signed,
      quarterRevenue: n,
      quarterProfit: signed,
      quarterCosts: n,
      quarterCashFlow: signed,
      quarterRD: n,
      quarterCapex: n,
      previousRevenue: n,
      published: z.array(releaseSchema).max(12),
      pending: z.array(releaseSchema),
      status: z.enum(["active", "distressed", "closed"]),
      lossMonths: n,
    }),
  ),
  instruments: z.array(
    z.object({
      id,
      ticker: id,
      name: id,
      kind: z.enum(["stock", "etf", "mutual"]),
      issuerId: id.nullable(),
      fundId: id.nullable(),
      exchangeId: id,
      shares: n.min(1),
      price: n.min(1),
      previousClose: n.min(1),
      reference: n.min(1),
      volume: n,
      listed: date,
      status: z.enum(["listed", "delisted"]),
      history: z.array(z.object({ date, close: n.min(1), volume: n })).max(90),
    }),
  ),
  accounts: z.array(portfolio),
  orders: z.array(
    z.object({
      id,
      accountId: id,
      instrumentId: id,
      side: z.enum(["buy", "sell"]),
      type: z.enum(["market", "limit"]),
      quantity: n.min(1),
      remaining: n,
      limit: n.min(1),
      reservedCash: n,
      reservedShares: n,
      status: z.enum(["open", "partial", "filled", "cancelled", "expired"]),
      created: date,
      sequence: n,
      expires: date,
      automatic: z.boolean(),
    }),
  ),
  trades: z
    .array(
      z.object({
        id: n,
        date,
        instrumentId: id,
        buyerId: id,
        sellerId: id,
        quantity: n.min(1),
        price: n.min(1),
        buyerFee: n,
        sellerFee: n,
        kind: z.enum(["exchange", "ipo", "fund"]),
      }),
    )
    .max(200),
  indices: z.array(
    z.object({
      id,
      name: id,
      members: z.array(id),
      divisor: positive.min(0.00000001),
      value: positive,
      history: z.array(z.object({ date, value: positive })).max(120),
    }),
  ),
  funds: z.array(
    z.object({
      id,
      accountId: id,
      instrumentId: id,
      indexId: id,
      name: id,
      kind: z.enum(["etf", "mutual"]),
      feeBps: n,
      distributed: n,
      feesAccrued: n,
    }),
  ),
  offerings: z.array(
    z.object({
      id,
      companyId: id,
      filed: date,
      opens: date,
      status: z.enum(["pending", "listed", "failed"]),
      primary: n,
      secondary: n,
      price: n.min(1),
      prospectus: releaseSchema,
      raised: n,
      secondaryProceeds: n,
      reason: z.string().max(300),
    }),
  ),
  external: z.object(accountsSchema),
  broker: z.object(accountsSchema),
  openingCash: n,
  netTransfers: signed,
  sectorDemand: z.record(id, positive),
  news: z
    .array(z.object({ id: n, date, kind: id, instrumentId: id, text: id }))
    .max(100),
  reinvestments: z.array(z.object({ instrumentId: id, amount: n })),
  plans: z.array(
    z.object({
      instrumentId: id,
      amount: n.min(1),
      day: n.min(1).max(28),
      reinvest: z.boolean(),
    }),
  ),
  started: date,
  lastAccountingDate: date,
  lastRun: z.string(),
  localReports: z.record(id, date),
  localFinancials: z.record(id, z.array(releaseSchema).max(12)),
});
export function verifySecurities(s: GameState) {
  const x = s.securities,
    unique = (a: string[]) => new Set(a).size === a.length,
    byId = new Map(x.instruments.map((i) => [i.id, i])),
    holders = new Map(x.accounts.map((a) => [a.id, a]));
  if (
    !unique(x.instruments.map((i) => i.id)) ||
    !unique(x.instruments.map((i) => i.ticker)) ||
    !unique(x.firms.map((f) => f.id)) ||
    !unique(x.firms.map((f) => f.name)) ||
    !unique(x.accounts.map((a) => a.id)) ||
    !unique(x.orders.map((o) => o.id)) ||
    !unique(x.offerings.map((o) => o.id)) ||
    !unique(
      x.offerings.filter((o) => o.status === "pending").map((o) => o.companyId),
    ) ||
    !holders.has("player")
  )
    return false;
  if (
    x.started > s.date ||
    x.lastAccountingDate > s.date ||
    x.lastRun > s.date ||
    marketCash(s) !== x.openingCash + x.netTransfers
  )
    return false;
  for (const a of [x.external, x.broker, ...x.firms, ...x.accounts])
    if (
      !verifyAccounts(a) ||
      a.journal.some((e) => e.id > s.sequence || e.date > s.date)
    )
      return false;
  const quantities = new Map<string, number>();
  for (const a of x.accounts) {
    if (
      !unique(a.positions.map((p) => p.instrumentId)) ||
      a.book.inventory !== a.positions.reduce((n, p) => n + p.cost, 0) ||
      a.positions.some(
        (p) => !byId.has(p.instrumentId) || (p.quantity === 0 && p.cost !== 0),
      )
    )
      return false;
    if (
      a.kind === "npc" &&
      !s.simulation.residents.some((r) => r.id === a.ownerId)
    )
      return false;
    if (a.kind === "issuer" && !s.companies.some((c) => c.id === a.ownerId))
      return false;
    for (const p of a.positions)
      quantities.set(
        p.instrumentId,
        (quantities.get(p.instrumentId) ?? 0) + p.quantity,
      );
  }
  for (const i of x.instruments) {
    if (
      quantities.get(i.id) !== i.shares ||
      !exchanges.some((e) => e.id === i.exchangeId) ||
      i.listed > s.date ||
      i.history.some((h) => h.date > s.date)
    )
      return false;
    if (
      i.issuerId &&
      !x.firms.some((f) => f.id === i.issuerId) &&
      !s.companies.some((c) => c.id === i.issuerId)
    )
      return false;
  }
  const reserved = new Map<string, number>(),
    shares = new Map<string, number>();
  for (const o of x.orders) {
    if (
      !holders.has(o.accountId) ||
      !byId.has(o.instrumentId) ||
      o.remaining > o.quantity ||
      o.created > s.date ||
      o.sequence > s.sequence
    )
      return false;
    if (activeOrder(o)) {
      if (
        !o.remaining ||
        byId.get(o.instrumentId)!.status !== "listed" ||
        o.reservedCash !==
          (o.side === "buy" ? reserveAmount(o.limit, o.remaining) : 0) ||
        o.reservedShares !== (o.side === "sell" ? o.remaining : 0)
      )
        return false;
      reserved.set(
        o.accountId,
        (reserved.get(o.accountId) ?? 0) + o.reservedCash,
      );
      const key = o.accountId + "::" + o.instrumentId;
      shares.set(key, (shares.get(key) ?? 0) + o.reservedShares);
    } else if (o.reservedCash || o.reservedShares) return false;
  }
  for (const a of x.accounts) {
    if ((reserved.get(a.id) ?? 0) > a.book.cash) return false;
    for (const p of a.positions)
      if ((shares.get(a.id + "::" + p.instrumentId) ?? 0) > p.quantity)
        return false;
    for (const [key, n] of shares)
      if (
        key.startsWith(a.id + "::") &&
        n &&
        !a.positions.some((p) => key === a.id + "::" + p.instrumentId)
      )
        return false;
  }
  if (
    x.trades.some(
      (t) =>
        !byId.has(t.instrumentId) ||
        !holders.has(t.buyerId) ||
        !holders.has(t.sellerId) ||
        t.date > s.date ||
        t.id > s.sequence,
    )
  )
    return false;
  for (const f of x.firms)
    if (
      !sectorModels.has(f.sector) ||
      !byId.has(f.instrumentId) ||
      f.published.some((r) => r.published > s.date) ||
      f.pending.some((r) => r.published < x.started)
    )
      return false;
  for (const f of x.funds) {
    const a = holders.get(f.accountId),
      i = byId.get(f.instrumentId);
    if (
      !a ||
      a.kind !== "fund" ||
      !i ||
      i.fundId !== f.id ||
      !x.indices.some((z) => z.id === f.indexId) ||
      a.positions.some((p) => byId.get(p.instrumentId)?.kind !== "stock")
    )
      return false;
  }
  for (const i of x.indices) {
    if (
      !unique(i.members) ||
      !i.members.length ||
      i.members.some((id) => byId.get(id)?.kind !== "stock")
    )
      return false;
    const cap = i.members.reduce((n, id) => {
      const a = byId.get(id)!;
      return n + (a.status === "listed" ? a.price * a.shares : 0);
    }, 0);
    if (Math.abs(cap / i.divisor - i.value) > Math.max(1, i.value) * 1e-10)
      return false;
  }
  for (const [id, reports] of Object.entries(x.localFinancials)) {
    if (
      !s.companies.some((c) => c.id === id) ||
      reports.some((r) => r.published > s.date)
    )
      return false;
  }
  for (const c of s.companies) {
    const i = x.instruments.find((i) => i.issuerId === c.id);
    if (!i) continue;
    if (
      c.shares !== i.shares ||
      c.shareholders.some(
        (h) =>
          !x.accounts.some(
            (a) =>
              a.ownerId === h.personId &&
              a.positions.some(
                (p) => p.instrumentId === i.id && p.quantity === h.shares,
              ),
          ),
      )
    )
      return false;
  }
  return (
    unique(x.plans.map((p) => p.instrumentId)) &&
    x.plans.every((p) => byId.has(p.instrumentId)) &&
    x.reinvestments.every((p) => byId.has(p.instrumentId)) &&
    x.offerings.every(
      (o) => s.companies.some((c) => c.id === o.companyId) && o.filed <= s.date,
    )
  );
}
