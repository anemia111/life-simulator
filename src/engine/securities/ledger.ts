import type { GameState } from "../types";
import type { SecuritiesAccount, InvestorStyle, Position } from "./types";
import { accounts, book, nav } from "../enterprise/accounting";
import { post, liquid } from "../finance";
export const integer = (v: number | undefined, min = 0, max = 1e12) => {
  if (!Number.isSafeInteger(v) || v! < min || v! > max)
    throw Error("数量・金額は範囲内の整数で入力してください");
  return v!;
};
export const fee = (amount: number) =>
  amount > 0 ? Math.max(1, Math.ceil(amount / 1000)) : 0;
export const prorata = (n: number, a: number, b: number) =>
  b ? Number((BigInt(n) * BigInt(a)) / BigInt(b)) : 0;
export const activeOrder = (o: { status: string }) =>
  o.status === "open" || o.status === "partial";
const indices = new WeakMap<
  object,
  {
    a: number;
    i: number;
    accounts: Map<string, SecuritiesAccount>;
    instruments: Map<string, GameState["securities"]["instruments"][number]>;
  }
>();
function lookup(s: GameState) {
  const x = s.securities;
  let c = indices.get(x);
  if (!c || c.a !== x.accounts.length || c.i !== x.instruments.length) {
    c = {
      a: x.accounts.length,
      i: x.instruments.length,
      accounts: new Map(x.accounts.map((a) => [a.id, a])),
      instruments: new Map(x.instruments.map((i) => [i.id, i])),
    };
    indices.set(x, c);
  }
  return c;
}
export function account(s: GameState, id = "player") {
  const a = lookup(s).accounts.get(id);
  if (!a) throw Error("証券口座が見つかりません");
  return a;
}
export function instrument(s: GameState, id: string) {
  const a = lookup(s).instruments.get(id);
  if (!a) throw Error("銘柄が見つかりません");
  return a;
}
export const position = (a: SecuritiesAccount, id: string) =>
  a.positions.find((p) => p.instrumentId === id);
export const held = (a: SecuritiesAccount, id: string) =>
  position(a, id)?.quantity ?? 0;
export const availableCash = (s: GameState, a: SecuritiesAccount) =>
  a.book.cash -
  s.securities.orders
    .filter((o) => o.accountId === a.id && activeOrder(o))
    .reduce((n, o) => n + o.reservedCash, 0);
export const availableShares = (
  s: GameState,
  a: SecuritiesAccount,
  id: string,
) =>
  held(a, id) -
  s.securities.orders
    .filter(
      (o) => o.accountId === a.id && o.instrumentId === id && activeOrder(o),
    )
    .reduce((n, o) => n + o.reservedShares, 0);
export function createAccount(
  s: GameState,
  id: string,
  name: string,
  kind: SecuritiesAccount["kind"],
  ownerId = id,
  strategy: InvestorStyle = "value",
) {
  let a = s.securities.accounts.find((a) => a.id === id);
  if (a) return a;
  a = {
    ...accounts(),
    id,
    name,
    kind,
    ownerId,
    strategy,
    positions: [],
    realized: 0,
    dividends: 0,
    fees: 0,
    deposits: 0,
    withdrawals: 0,
  };
  s.securities.accounts.push(a);
  return a;
}
export function addPosition(
  s: GameState,
  a: SecuritiesAccount,
  id: string,
  quantity: number,
  cost: number,
  opening = false,
) {
  let p = position(a, id);
  if (!p) {
    p = { instrumentId: id, quantity: 0, cost: 0 };
    a.positions.push(p);
  }
  p.quantity += quantity;
  p.cost += cost;
  if (opening && cost)
    book(s, a, "開始時の保有証券", { inventory: cost, equity: cost });
}
export function acquire(
  s: GameState,
  a: SecuritiesAccount,
  id: string,
  quantity: number,
  price: number,
  commission: number,
) {
  const value = integer(
    quantity * price + commission,
    1,
    Number.MAX_SAFE_INTEGER,
  );
  book(s, a, "証券買付", { cash: -value, inventory: value });
  addPosition(s, a, id, quantity, value);
  a.fees += commission;
}
export function dispose(
  s: GameState,
  a: SecuritiesAccount,
  id: string,
  quantity: number,
  price: number,
  commission: number,
) {
  const p = position(a, id)!;
  if (!p || p.quantity < quantity) throw Error("売却株が不足しています");
  const basis = prorata(p.cost, quantity, p.quantity),
    net = quantity * price - commission;
  book(s, a, "証券売却", {
    cash: net,
    inventory: -basis,
    revenue: Math.max(0, net - basis),
    expenses: Math.max(0, basis - net),
  });
  p.quantity -= quantity;
  p.cost -= basis;
  a.realized += net - basis;
  a.fees += commission;
}
export function transferCash(
  s: GameState,
  id: string,
  amount: number,
  withdraw = false,
) {
  integer(amount, 1);
  const a = account(s, id),
    r = s.simulation.residents.find((r) => r.id === a.ownerId);
  if (a.kind !== "player" && a.kind !== "npc")
    throw Error("個人の証券口座を選んでください");
  if (withdraw) {
    if (availableCash(s, a) < amount || a.book.debt)
      throw Error("出金可能な証券現金が不足しています");
    book(s, a, "個人口座へ出金", { cash: -amount, equity: -amount });
    if (a.kind === "player")
      post(s, "証券口座から出金", "transfer", amount, 0, 0);
    else book(s, r!, "証券口座から出金", { cash: amount, equity: amount });
    a.withdrawals += amount;
    s.securities.netTransfers -= amount;
  } else {
    const cash = a.kind === "player" ? liquid(s) : (r?.book.cash ?? 0);
    if (cash < amount) throw Error("入金する個人資金が不足しています");
    if (a.kind === "player") {
      const c = Math.min(s.cash, amount);
      post(s, "証券口座へ入金", "transfer", -c, -(amount - c), 0);
    } else book(s, r!, "証券口座へ入金", { cash: -amount, equity: -amount });
    book(s, a, "個人から証券入金", { cash: amount, equity: amount });
    a.deposits += amount;
    s.securities.netTransfers += amount;
  }
}
export const portfolioValue = (s: GameState, a: SecuritiesAccount) =>
  a.positions.reduce(
    (n, p) =>
      n +
      p.quantity *
        (lookup(s).instruments.get(p.instrumentId)?.status === "delisted"
          ? 0
          : (lookup(s).instruments.get(p.instrumentId)?.price ?? 0)),
    0,
  );
export const securitiesWealth = (s: GameState, id = "player") =>
  s.securities
    ? s.securities.accounts
        .filter(
          (a) => a.ownerId === id && (a.kind === "player" || a.kind === "npc"),
        )
        .reduce(
          (n, a) => n + a.book.cash - a.book.debt + portfolioValue(s, a),
          0,
        )
    : 0;
export const marketCash = (s: GameState) =>
  [
    s.securities.external,
    s.securities.broker,
    ...s.securities.firms,
    ...s.securities.accounts,
  ].reduce((n, a) => n + a.book.cash, 0);
export function compactAccount(
  a: {
    journal: SecuritiesAccount["journal"];
    opening: SecuritiesAccount["opening"];
    months: SecuritiesAccount["months"];
  },
  limit = 8,
) {
  if (a.journal.length > limit)
    a.opening = {
      ...a.journal.splice(0, a.journal.length - limit).at(-1)!.after,
    };
  if (a.months.length > 120) a.months = a.months.slice(-120);
}
export function marketNews(
  s: GameState,
  kind: string,
  id: string,
  text: string,
) {
  s.securities.news.unshift({
    id: ++s.sequence,
    date: s.date,
    kind,
    instrumentId: id,
    text,
  });
  s.securities.news = s.securities.news.slice(0, 100);
}
export function fundNAV(s: GameState, id: string) {
  const f = s.securities.funds.find((f) => f.id === id);
  if (!f) throw Error("ファンドが見つかりません");
  const a = account(s, f.accountId);
  return a.book.cash - a.book.debt + portfolioValue(s, a);
}
