import { householdClaim } from "./social/selectors";
import { enterpriseWealth } from "./enterprise/accounting";
import type { GameState, FinanceKind, LedgerEntry, MonthReport } from "./types";
export const liquid = (s: GameState) => s.cash + s.bank;
export const balances = (s: GameState) => ({
  cash: s.cash,
  bank: s.bank,
  debt: s.debt,
});
export const netWorth = (s: GameState) =>
  liquid(s) +
  s.employments.reduce((a, e) => a + e.accrued, 0) +
  s.assets.reduce((a, b) => a + b.cost, 0) -
  s.debt +
  enterpriseWealth(s) +
  householdClaim(s);
export function monthReport(s: GameState): MonthReport {
  const month = s.date.slice(0, 7);
  let r = s.reports.find((r) => r.month === month);
  if (!r) {
    r = {
      month,
      opening: balances(s),
      closing: balances(s),
      earned: 0,
      wages: 0,
      sales: 0,
      businessCosts: 0,
      living: 0,
      capital: 0,
      interest: 0,
      otherIncome: 0,
      otherExpenses: 0,
      cashFlow: 0,
    };
    s.reports.push(r);
    s.reports = s.reports.slice(-120);
  }
  return r;
}
export function post(
  s: GameState,
  label: string,
  kind: FinanceKind,
  cashDelta: number,
  bankDelta: number,
  debtDelta: number,
  expense = 0,
) {
  cashDelta = cashDelta || 0;
  bankDelta = bankDelta || 0;
  debtDelta = debtDelta || 0;
  for (const v of [cashDelta, bankDelta, debtDelta, expense])
    if (!Number.isSafeInteger(v))
      throw Error("金額は円単位の整数で指定してください");
  if (
    ![s.cash + cashDelta, s.bank + bankDelta, s.debt + debtDelta].every(
      Number.isSafeInteger,
    )
  )
    throw Error("残高が安全な整数の範囲を超えています");
  if (
    s.cash + cashDelta < 0 ||
    s.bank + bankDelta < 0 ||
    s.debt + debtDelta < 0
  )
    throw Error("残高が不足しています");
  const report = monthReport(s);
  s.cash += cashDelta;
  s.bank += bankDelta;
  s.debt += debtDelta;
  const amount = cashDelta + bankDelta;
  const category: LedgerEntry["category"] =
    kind === "transfer"
      ? "transfer"
      : kind === "borrowing" || kind === "interest"
        ? "debt"
        : amount > 0
          ? "income"
          : "expense";
  s.ledger.push({
    id: ++s.sequence,
    date: s.date,
    label,
    kind,
    amount,
    category,
    cashDelta,
    bankDelta,
    debtDelta,
    cashAfter: s.cash,
    bankAfter: s.bank,
    debtAfter: s.debt,
  });
  if (s.ledger.length > 5000) {
    const removed = s.ledger.splice(0, s.ledger.length - 5000).at(-1)!;
    s.checkpoint = {
      cash: removed.cashAfter,
      bank: removed.bankAfter,
      debt: removed.debtAfter,
    };
  }
  report.closing = balances(s);
  report.cashFlow += amount;
  if (kind === "wages") report.wages += Math.max(0, amount);
  if (kind === "business-revenue") report.sales += Math.max(0, amount);
  if (kind === "business-cost") report.businessCosts += expense;
  if (kind === "living") report.living += expense;
  if (kind === "capital") report.capital += expense;
  if (kind === "interest") report.interest += expense;
  if (kind === "other") {
    report.otherIncome += Math.max(0, amount);
    report.otherExpenses += expense;
  }
}
export function pay(
  s: GameState,
  amount: number,
  label: string,
  kind: FinanceKind = "living",
) {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw Error("支払い金額が不正です");
  const cash = Math.min(s.cash, amount),
    bank = Math.min(s.bank, amount - cash);
  post(s, label, kind, -cash, -bank, amount - cash - bank, amount);
}
export function receive(
  s: GameState,
  amount: number,
  label: string,
  kind: FinanceKind = "other",
  account: "cash" | "bank" = "cash",
) {
  if (!Number.isSafeInteger(amount) || amount < 0)
    throw Error("入金金額が不正です");
  post(
    s,
    label,
    kind,
    account === "cash" ? amount : 0,
    account === "bank" ? amount : 0,
    0,
  );
  const unpaid = Math.max(0, s.debt - s.loan),
    repayment = Math.min(liquid(s), unpaid);
  if (repayment) repay(s, repayment, false);
}
export function requireCash(s: GameState, amount: number) {
  if (liquid(s) < amount)
    throw Error("資金が足りません。勤務や貯金で資金を用意してください");
}
export function transfer(s: GameState, amount: number, to: "cash" | "bank") {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw Error("金額は正の整数で指定してください");
  post(
    s,
    to === "bank" ? "現金を銀行へ預入" : "銀行から現金を引出",
    "transfer",
    to === "bank" ? -amount : amount,
    to === "bank" ? amount : -amount,
    0,
  );
}
export function borrow(s: GameState, amount: number) {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 1000 ||
    s.loan + amount > 100000
  )
    throw Error("借入は1,000円以上、残高10万円までです");
  s.loan += amount;
  post(s, "生活支援ローン 借入", "borrowing", 0, amount, amount);
}
export function repay(s: GameState, amount: number, loan = true) {
  const due = loan ? s.loan : s.debt - s.loan;
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > due)
    throw Error("返済額は対象の債務残高以内にしてください");
  requireCash(s, amount);
  const cash = Math.min(s.cash, amount);
  post(
    s,
    loan ? "ローン返済" : "未払債務の返済",
    "repayment",
    -cash,
    -(amount - cash),
    -amount,
  );
  if (loan) s.loan -= amount;
}
export function chargeInterest(s: GameState) {
  if (s.date.slice(8) === "01" && s.loan > 0 && s.date !== s.started) {
    const interest = Math.ceil(s.loan * 0.01);
    s.loan += interest;
    post(s, "ローン利息（月1%）", "interest", 0, 0, interest, interest);
  }
}
export function reconcile(s: GameState) {
  let { cash, bank, debt } = s.checkpoint;
  let id = 0;
  for (const e of s.ledger) {
    cash += e.cashDelta;
    bank += e.bankDelta;
    debt += e.debtDelta;
    if (
      e.id <= id ||
      e.amount !== e.cashDelta + e.bankDelta ||
      cash !== e.cashAfter ||
      bank !== e.bankAfter ||
      debt !== e.debtAfter ||
      Math.min(cash, bank, debt) < 0
    )
      return false;
    id = e.id;
  }
  return (
    cash === s.cash && bank === s.bank && debt === s.debt && s.loan <= s.debt
  );
}
