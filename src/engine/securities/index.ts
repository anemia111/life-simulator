import type { GameState } from "../types";
import type { SecuritiesInput } from "./types";
import { book, companyProfit } from "../enterprise/accounting";
import { weekday } from "../time";
import { age } from "../person";
import { profile } from "../social/selectors";
import { stableHash } from "../social/initial";
import { sectorModels } from "./catalog";
import {
  account,
  instrument,
  integer,
  availableCash,
  availableShares,
  held,
  createAccount,
  transferCash,
  portfolioValue,
  compactAccount,
  marketNews,
  fundNAV,
} from "./ledger";
import {
  placeOrder,
  cancelOrder,
  matchOrders,
  expireDayOrders,
} from "./exchange";
import {
  worldMonth,
  publishReleases,
  referenceValue,
  payDividend,
} from "./world";
import {
  fundDay,
  runPlans,
  subscribeFund,
  updateIndices,
  reconstituteIndex,
} from "./funds";
import {
  applyIPO,
  processOfferings,
  syncShareholders,
  publishLocalCompanies,
  votingAction,
  listedInstrument,
} from "./ipo";
export * from "./ledger";
export * from "./exchange";
export * from "./catalog";
export * from "./funds";
export * from "./ipo";
export function executeSecurities(s: GameState, t: SecuritiesInput) {
  switch (t.operation) {
    case "deposit":
      transferCash(s, "player", integer(t.amount, 1));
      break;
    case "withdraw":
      transferCash(s, "player", integer(t.amount, 1), true);
      break;
    case "order":
      placeOrder(
        s,
        "player",
        t.instrumentId!,
        t.side!,
        t.orderType!,
        integer(t.quantity, 1),
        t.price,
      );
      break;
    case "cancel":
      cancelOrder(s, t.orderId!);
      break;
    case "subscribe":
      subscribeFund(s, "player", t.instrumentId!, integer(t.quantity, 1));
      break;
    case "redeem":
      subscribeFund(s, "player", t.instrumentId!, integer(t.quantity, 1), true);
      break;
    case "plan": {
      const i = instrument(s, t.instrumentId!);
      integer(t.amount, 0);
      integer(t.day ?? 1, 1, 28);
      s.securities.plans = s.securities.plans.filter(
        (p) => p.instrumentId !== i.id,
      );
      if (t.amount)
        s.securities.plans.push({
          instrumentId: i.id,
          amount: t.amount!,
          day: t.day ?? 1,
          reinvest: t.reinvest ?? false,
        });
      break;
    }
    case "ipo":
      applyIPO(
        s,
        t.companyId!,
        integer(t.primary, 0),
        integer(t.secondary, 0),
        integer(t.price, 1),
      );
      break;
    case "dividend": {
      const c = s.companies.find((c) => c.id === t.companyId),
        i = listedInstrument(s, t.companyId!);
      if (!c || !i || held(account(s), i.id) * 2 <= i.shares)
        throw Error("配当決議には過半数の議決権が必要です");
      const per = integer(t.price, 1);
      if (companyProfit(s, c) - c.dividends < per * c.shares)
        throw Error("未分配の稼得利益が不足しています");
      payDividend(s, c.id, per);
      break;
    }
    case "vote":
      votingAction(s, t.companyId!, t.value!);
      break;
    default:
      throw Error("証券操作が不正です");
  }
  s.securities.trades = s.securities.trades.slice(-200);
  syncShareholders(s);
}

function npcInvestors(s: GameState) {
  if (s.days % 7 !== 0) return;
  const stocks = s.securities.instruments.filter(
    (i) => i.kind === "stock" && i.status === "listed",
  );
  for (const r of s.simulation.residents) {
    const p = s.npcs.find((p) => p.id === r.id)!;
    if (
      age(p, s.date) < 18 ||
      profile(s, r.id).riskTolerance < 50 ||
      r.hours.free < 0.5
    )
      continue;
    let a = s.securities.accounts.find(
      (a) => a.ownerId === r.id && a.kind === "npc",
    );
    if (r.book.cash > 105000) {
      a ??= createAccount(
        s,
        r.id,
        p.name + " 証券口座",
        "npc",
        r.id,
        r.motive === "saving" ? "income" : "value",
      );
      transferCash(s, a.id, Math.min(5000, r.book.cash - 100000));
    }
    if (!a) continue;
    if (r.book.cash < 20000 && availableCash(s, a) > 1000) {
      transferCash(s, a.id, Math.min(10000, availableCash(s, a)), true);
      continue;
    }
    const i =
        stocks[(stableHash(r.id) + Math.floor(s.days / 7)) % stocks.length],
      price = Math.ceil(i.price * 1.05),
      q = Math.min(
        3,
        Math.floor(availableCash(s, a) / (price + Math.ceil(price / 1000))),
      );
    if (q) {
      placeOrder(s, a.id, i.id, "buy", "market", q, undefined, true);
      r.hours.free -= 0.5;
      r.hours.business += 0.5;
    }
  }
}
function quoteInvestors(s: GameState, ids: string[]) {
  for (const id of ids) {
    const i = instrument(s, id);
    if (i.kind === "mutual" || i.status !== "listed") continue;
    const reference =
      i.kind === "etf"
        ? Math.max(1, Math.floor(fundNAV(s, i.fundId!) / i.shares))
        : referenceValue(s, id);
    i.reference = reference;
    for (const a of s.securities.accounts.filter(
      (a) => a.kind === "institution",
    )) {
      const known = s.securities.firms
          .find((f) => f.id === i.issuerId)
          ?.published.at(-1),
        growth = known?.growth ?? 0,
        bookRatio = known
          ? Math.max(0, (known.assets - known.debt) / known.shares) / reference
          : 1;
      const belief =
        ((stableHash(a.id + id + Math.floor(s.days / 30)) % 61) - 30) / 1000;
      const bias =
        (a.strategy === "growth"
          ? Math.max(-0.03, Math.min(0.03, growth * 0.06))
          : a.strategy === "income"
            ? 0.003
            : a.strategy === "value"
              ? (bookRatio - 0.7) * 0.02
              : -0.005) + belief;
      const anchor = Math.max(
          1,
          Math.round(
            Math.max(
              i.previousClose * 0.97,
              Math.min(i.previousClose * 1.03, reference * (1 + bias)),
            ),
          ),
        ),
        bid = Math.max(1, Math.floor(anchor * 0.995)),
        ask = Math.max(1, Math.ceil(anchor * 1.005)),
        buy = Math.min(
          50,
          Math.floor(
            (Math.max(0, availableCash(s, a)) * 0.01) /
              (bid + Math.ceil(bid / 1000)),
          ),
        ),
        sell = Math.min(50, Math.max(0, availableShares(s, a, id)));
      if (buy) placeOrder(s, a.id, id, "buy", "limit", buy, bid, true);
      if (sell) placeOrder(s, a.id, id, "sell", "limit", sell, ask, true);
    }
  }
}
export function securitiesDay(s: GameState) {
  const x = s.securities;
  if (x.lastRun === s.date) return;
  for (const i of x.instruments) {
    i.previousClose = i.price;
    i.volume = 0;
  }
  worldMonth(s);
  publishReleases(s);
  processOfferings(s);
  publishLocalCompanies(s);
  fundDay(s);
  runPlans(s);
  npcInvestors(s);
  if (![0, 6].includes(weekday(s.date))) {
    const listed = x.instruments.filter(
        (i) => i.status === "listed" && i.kind !== "mutual",
      ),
      ids = new Set(
        listed
          .slice(
            (s.days * 16) % listed.length,
            ((s.days * 16) % listed.length) + 16,
          )
          .map((i) => i.id),
      );
    if (ids.size < 16)
      for (const i of listed.slice(0, 16 - ids.size)) ids.add(i.id);
    for (const o of x.orders.filter(
      (o) => o.status === "open" || o.status === "partial",
    ))
      ids.add(o.instrumentId);
    quoteInvestors(s, [...ids]);
    for (const id of ids) {
      const i = instrument(s, id);
      matchOrders(s, id, Math.max(20, Math.floor(i.shares * 0.002)));
    }
  }
  expireDayOrders(s);
  syncShareholders(s);
  updateIndices(s);
  for (const i of x.instruments) {
    if (i.volume > 0 || !i.history.length || s.date.endsWith("-01"))
      i.history.push({ date: s.date, close: i.price, volume: i.volume });
    i.history = i.history.slice(-90);
  }
  for (const a of x.accounts) compactAccount(a, a.kind === "player" ? 60 : 8);
  compactAccount(x.broker);
  compactAccount(x.external);
  x.lastRun = s.date;
}
