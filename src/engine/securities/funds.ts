import type { GameState } from "../types";
import { book } from "../enterprise/accounting";
import {
  account,
  instrument,
  integer,
  availableCash,
  held,
  fundNAV,
  fee,
  acquire,
  dispose,
  addPosition,
  position,
  prorata,
  compactAccount,
  marketNews,
} from "./ledger";
import { placeOrder, reserveAmount } from "./exchange";
export function subscribeFund(
  s: GameState,
  accountId: string,
  id: string,
  quantity: number,
  redeem = false,
) {
  const i = instrument(s, id),
    f = s.securities.funds.find((f) => f.id === i.fundId),
    a = account(s, accountId);
  if (!f || f.kind !== "mutual") throw Error("積立投信を選んでください");
  integer(quantity, 1, 1000000000);
  const fund = account(s, f.accountId),
    price = Math.max(1, Math.floor(fundNAV(s, f.id) / i.shares)),
    value = integer(price * quantity, 1, Number.MAX_SAFE_INTEGER);
  if (redeem) {
    if (
      held(a, id) < quantity ||
      availableCash(s, fund) < value ||
      fund.book.debt
    )
      throw Error("保有口数またはファンドの換金用現金が不足しています");
    dispose(s, a, id, quantity, price, 0);
    book(s, fund, "投信の払戻し", { cash: -value, equity: -value });
    i.shares -= quantity;
  } else {
    if (availableCash(s, a) < value)
      throw Error("投信買付資金が不足しています");
    acquire(s, a, id, quantity, price, 0);
    book(s, fund, "投信申込資金", { cash: value, equity: value });
    i.shares += quantity;
  }
  i.price = Math.max(1, Math.floor(fundNAV(s, f.id) / i.shares));
  i.reference = i.price;
  s.securities.trades.push({
    id: ++s.sequence,
    date: s.date,
    instrumentId: id,
    buyerId: redeem ? fund.id : a.id,
    sellerId: redeem ? a.id : fund.id,
    quantity,
    price,
    buyerFee: 0,
    sellerFee: 0,
    kind: "fund",
  });
}
export function updateIndices(s: GameState) {
  const byId = new Map(s.securities.instruments.map((i) => [i.id, i]));
  for (const index of s.securities.indices) {
    const cap = index.members.reduce((n, id) => {
      const i = byId.get(id)!;
      return n + (i.status === "listed" ? i.shares * i.price : 0);
    }, 0);
    index.value = cap / index.divisor;
    const last = index.history.at(-1);
    if (last?.date === s.date) last.value = index.value;
    else index.history.push({ date: s.date, value: index.value });
    index.history = index.history.slice(-120);
  }
}
export function reconstituteIndex(s: GameState, id: string, members: string[]) {
  const index = s.securities.indices.find((i) => i.id === id);
  if (
    !index ||
    !members.length ||
    new Set(members).size !== members.length ||
    members.some((id) => instrument(s, id).kind !== "stock")
  )
    throw Error("指数構成が不正です");
  const previous = index.value,
    cap = members.reduce((n, id) => {
      const i = instrument(s, id);
      return n + i.shares * i.price;
    }, 0);
  index.members = members;
  index.divisor = cap / Math.max(0.00001, previous);
  index.value = previous;
}
export function fundDay(s: GameState) {
  for (const f of s.securities.funds) {
    const a = account(s, f.accountId),
      i = instrument(s, f.instrumentId);
    if (s.date.endsWith("-01") && s.date !== s.securities.started) {
      const cost = Math.floor(
          (Math.max(0, fundNAV(s, f.id)) * f.feeBps) / 120000,
        ),
        cash = Math.min(cost, a.book.cash);
      if (cost) {
        book(s, a, "ファンド信託報酬", {
          cash: -cash,
          debt: cost - cash,
          expenses: cost,
        });
        book(s, s.securities.broker, "信託報酬受取", {
          cash,
          receivables: cost - cash,
          revenue: cost,
        });
        f.feesAccrued += cost;
      }
    }
    if (a.book.debt && a.book.cash) {
      const payment = Math.min(a.book.debt, a.book.cash);
      book(s, a, "未払信託報酬を精算", { cash: -payment, debt: -payment });
      book(s, s.securities.broker, "未払信託報酬を回収", {
        cash: payment,
        receivables: -payment,
      });
    }
    const income = a.dividends - f.distributed - f.feesAccrued;
    if (
      [1, 4, 7, 10].includes(Number(s.date.slice(5, 7))) &&
      s.date.endsWith("-08") &&
      income > 0 &&
      !a.book.debt
    ) {
      const per = Math.floor(Math.min(income, a.book.cash) / i.shares),
        total = per * i.shares;
      if (total) {
        book(s, a, "ファンド分配金", { cash: -total, equity: -total });
        for (const owner of s.securities.accounts) {
          const n = held(owner, i.id) * per;
          if (n) {
            book(s, owner, "ファンド分配金の受取", { cash: n, revenue: n });
            owner.dividends += n;
            if (
              owner.id === "player" &&
              s.securities.plans.some(
                (p) => p.instrumentId === i.id && p.reinvest,
              )
            )
              s.securities.reinvestments.push({
                instrumentId: i.id,
                amount: n,
              });
          }
        }
        f.distributed += total;
        marketNews(
          s,
          "distribution",
          i.id,
          f.name + "が1口" + per + "円を分配",
        );
      }
    }
    const nav = fundNAV(s, f.id);
    i.reference = Math.max(1, Math.floor(nav / i.shares));
    if (i.kind === "mutual") i.price = i.reference;
    // New subscription cash is deployed through the same exchange, not converted
    // into fictional index returns. Unfilled cash remains part of NAV.
    if (s.days % 7 === 0 && a.book.cash > nav * 0.08 && !a.book.debt) {
      const index = s.securities.indices.find((x) => x.id === f.indexId)!;
      const members = index.members.filter(
          (id) => instrument(s, id).status === "listed",
        ),
        cap = members.reduce((n, id) => {
          const x = instrument(s, id);
          return n + x.price * x.shares;
        }, 0),
        budget = Math.max(0, Math.floor(a.book.cash - nav * 0.05));
      for (const id of members) {
        const stock = instrument(s, id),
          weight = (stock.price * stock.shares) / cap,
          target = Math.floor((nav * weight) / stock.price),
          need = Math.max(0, target - held(a, id)),
          n = Math.min(
            need,
            Math.floor((budget * weight) / (stock.price + fee(stock.price))),
          );
        if (
          n &&
          availableCash(s, a) >= reserveAmount(Math.ceil(stock.price * 1.05), n)
        )
          placeOrder(s, a.id, id, "buy", "market", n, undefined, true);
      }
    }
    compactAccount(a);
  }
}
export function runPlans(s: GameState) {
  for (const task of s.securities.reinvestments) {
    const i = instrument(s, task.instrumentId),
      cash = Math.min(task.amount, availableCash(s, account(s))),
      price =
        i.kind === "mutual"
          ? i.reference
          : Math.ceil(i.price * 1.05) + fee(Math.ceil(i.price * 1.05)),
      q = Math.floor(cash / price);
    if (i.status !== "listed") continue;
    if (q) {
      if (i.kind === "mutual") subscribeFund(s, "player", i.id, q);
      else placeOrder(s, "player", i.id, "buy", "market", q);
    }
  }
  s.securities.reinvestments = [];
  for (const plan of s.securities.plans) {
    if (Number(s.date.slice(8)) !== plan.day) continue;
    const a = account(s),
      i = instrument(s, plan.instrumentId),
      budget = Math.min(plan.amount, availableCash(s, a)),
      price =
        i.kind === "mutual"
          ? i.reference
          : Math.ceil(i.price * 1.05) + fee(Math.ceil(i.price * 1.05)),
      quantity = Math.floor(budget / price);
    if (i.status !== "listed") {
      marketNews(s, "plan", i.id, "積立を見送り：上場廃止銘柄");
      continue;
    }
    if (quantity < 1) {
      marketNews(s, "plan", i.id, "積立を見送り：予約後の証券資金が不足");
      continue;
    }
    if (i.kind === "mutual") subscribeFund(s, "player", i.id, quantity);
    else placeOrder(s, "player", i.id, "buy", "market", quantity);
  }
}
