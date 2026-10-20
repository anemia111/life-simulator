import type { Accounts, Book, Company, Enterprise } from "./types";
import type { GameState } from "../types";
export const emptyBook = (): Book => ({
  cash: 0,
  inventory: 0,
  equipment: 0,
  receivables: 0,
  debt: 0,
  equity: 0,
  revenue: 0,
  expenses: 0,
});
export const accounts = (): Accounts => ({
  book: emptyBook(),
  opening: emptyBook(),
  journal: [],
  months: [],
});
export const nav = (a: Accounts) =>
  a.book.cash +
  a.book.inventory +
  a.book.equipment +
  a.book.receivables -
  a.book.debt;
export const profit = (a: Accounts) => a.book.revenue - a.book.expenses;
export function book(
  s: GameState,
  a: Accounts,
  label: string,
  change: Partial<Book>,
) {
  const delta = { ...emptyBook(), ...change },
    after = { ...a.book };
  for (const k of Object.keys(delta) as (keyof Book)[]) {
    after[k] += delta[k];
    if (!Number.isSafeInteger(after[k]) || (k !== "equity" && after[k] < 0))
      throw Error("事業帳簿の残高が不正です");
  }
  if (
    after.cash +
      after.inventory +
      after.equipment +
      after.receivables -
      after.debt !==
    after.equity + after.revenue - after.expenses
  )
    throw Error("事業の貸借が一致しません");
  const ownerId =
    "ownerId" in a ? String(a.ownerId) : "id" in a ? String(a.id) : "player";
  const month = s.date.slice(0, 7);
  let report = a.months.find((m) => m.month === month && m.ownerId === ownerId);
  if (!report) {
    report = {
      month,
      ownerId,
      revenue: 0,
      expenses: 0,
      cashFlow: 0,
      funding: 0,
    };
    a.months.push(report);
    a.months = a.months.slice(-240);
  }
  report.revenue += delta.revenue;
  report.expenses += delta.expenses;
  report.cashFlow += delta.cash;
  report.funding += delta.equity;
  if ("ownerId" in a && a.ownerId === "player") {
    const v = a as Enterprise;
    v.personalRevenue += delta.revenue;
    v.personalExpenses += delta.expenses;
  }
  a.book = after;
  a.journal.push({
    id: ++s.sequence,
    date: s.date,
    label,
    delta,
    after: { ...after },
  });
  if (a.journal.length > 2000)
    a.opening = {
      ...a.journal.splice(0, a.journal.length - 2000).at(-1)!.after,
    };
}
export function spend(
  s: GameState,
  a: Accounts,
  amount: number,
  label: string,
  mandatory = false,
) {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw Error("支出額が不正です");
  if (!mandatory && a.book.cash < amount) return false;
  const cash = Math.min(amount, a.book.cash);
  book(s, a, label, { cash: -cash, debt: amount - cash, expenses: amount });
  return true;
}
export function settle(s: GameState, a: Accounts) {
  const n = Math.min(a.book.cash, a.book.debt);
  if (n) book(s, a, "未払費用を精算", { cash: -n, debt: -n });
}
export function transferBook(
  s: GameState,
  from: Accounts,
  to: Accounts,
  n: number,
  label: string,
) {
  if (
    !Number.isSafeInteger(n) ||
    n <= 0 ||
    from.book.cash < n ||
    from.book.debt
  )
    throw Error("移動可能な事業資金が不足しています（未払を先に精算）");
  book(s, from, label, { cash: -n, equity: -n });
  book(s, to, label, { cash: n, equity: n });
}
export const companyVentures = (s: GameState, c: Company) =>
  s.ventures.filter((v) => v.ownerId === c.id);
export const companyNAV = (s: GameState, c: Company) =>
  nav(c) + companyVentures(s, c).reduce((n, v) => n + nav(v), 0);
export const companyProfit = (s: GameState, c: Company) =>
  profit(c) +
  companyVentures(s, c).reduce(
    (n, v) => n + profit(v) - v.acquisitionRevenue + v.acquisitionExpenses,
    0,
  );
export function enterpriseWealth(s: GameState) {
  return (
    s.ventures
      .filter((v) => v.ownerId === "player")
      .reduce((n, v) => n + nav(v), 0) +
    s.companies.reduce(
      (n, c) =>
        n +
        shareValue(
          Math.max(0, companyNAV(s, c)),
          c.shareholders.find((h) => h.personId === "player")?.shares ?? 0,
          c.shares,
        ),
      0,
    )
  );
}
export function verifyAccounts(a: Accounts) {
  let running = { ...a.opening },
    id = 0;
  for (const e of a.journal) {
    if (e.id <= id) return false;
    id = e.id;
    for (const k of Object.keys(running) as (keyof Book)[]) {
      running[k] += e.delta[k];
      if (running[k] !== e.after[k]) return false;
    }
  }
  const b = a.book;
  return (
    Object.keys(running).every(
      (k) => running[k as keyof Book] === b[k as keyof Book],
    ) && nav(a) === b.equity + profit(a)
  );
}
export function verifyEnterprise(v: Enterprise) {
  return (
    verifyAccounts(v) &&
    v.book.inventory ===
      v.inventory.reduce((n, l) => n + l.quantity * l.unitCost, 0) &&
    v.book.receivables ===
      v.orders
        .filter((o) => o.status === "invoiced")
        .reduce((n, o) => n + o.price, 0)
  );
}

export function consolidatedBook(s: GameState, c: Company): Book {
  const b = { ...c.book };
  for (const v of companyVentures(s, c)) {
    for (const k of Object.keys(b) as (keyof Book)[]) b[k] += v.book[k];
    b.revenue -= v.acquisitionRevenue;
    b.expenses -= v.acquisitionExpenses;
    b.equity += v.acquisitionRevenue - v.acquisitionExpenses;
  }
  return b;
}
export function companyMonths(s: GameState, c: Company) {
  const reports = new Map<
    string,
    {
      month: string;
      revenue: number;
      expenses: number;
      cashFlow: number;
      funding: number;
    }
  >();
  for (const a of [c, ...companyVentures(s, c)])
    for (const m of a.months.filter((m) => m.ownerId === c.id)) {
      const r = reports.get(m.month) ?? {
        month: m.month,
        revenue: 0,
        expenses: 0,
        cashFlow: 0,
        funding: 0,
      };
      r.revenue += m.revenue;
      r.expenses += m.expenses;
      r.cashFlow += m.cashFlow;
      r.funding += m.funding;
      reports.set(m.month, r);
    }
  return [...reports.values()].sort((a, b) => b.month.localeCompare(a.month));
}

export function personalEnterpriseMonths(s: GameState) {
  const reports = new Map<
    string,
    {
      month: string;
      revenue: number;
      expenses: number;
      cashFlow: number;
      funding: number;
    }
  >();
  for (const v of s.ventures)
    for (const m of v.months.filter((m) => m.ownerId === "player")) {
      const r = reports.get(m.month) ?? {
        month: m.month,
        revenue: 0,
        expenses: 0,
        cashFlow: 0,
        funding: 0,
      };
      r.revenue += m.revenue;
      r.expenses += m.expenses;
      r.cashFlow += m.cashFlow;
      r.funding += m.funding;
      reports.set(m.month, r);
    }
  return [...reports.values()].sort((a, b) => b.month.localeCompare(a.month));
}
export const personalEnterpriseProfit = (s: GameState) =>
  s.ventures.reduce((n, v) => n + v.personalRevenue - v.personalExpenses, 0);

/** Fractional yen are discarded; intermediate share multiplication stays exact. */
export function shareValue(amount: number, shares: number, total: number) {
  if (
    ![amount, shares, total].every(Number.isSafeInteger) ||
    amount < 0 ||
    shares < 0 ||
    total <= 0
  )
    throw Error("持分計算の金額・株数が不正です");
  const result = Number((BigInt(amount) * BigInt(shares)) / BigInt(total));
  if (!Number.isSafeInteger(result))
    throw Error("持分が整数範囲を超えています");
  return result;
}
