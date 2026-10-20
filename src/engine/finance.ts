import type { GameState, LedgerEntry } from "./types";
function entry(
  s: GameState,
  label: string,
  amount: number,
  category: LedgerEntry["category"],
) {
  s.ledger.push({ id: ++s.sequence, date: s.date, label, amount, category });
  s.ledger = s.ledger.slice(-1000);
}
export function pay(s: GameState, amount: number, label: string) {
  amount = Math.max(0, Math.round(amount));
  const paid = Math.min(s.cash, amount);
  s.cash -= paid;
  entry(s, label, -paid, "expense");
  if (paid < amount) {
    s.debt += amount - paid;
    entry(s, label + "：未払い", amount - paid, "debt");
  }
}
export function receive(s: GameState, amount: number, label: string) {
  amount = Math.max(0, Math.round(amount));
  s.cash += amount;
  entry(s, label, amount, "income");
  const repayment = Math.min(s.cash, s.debt);
  if (repayment) {
    s.cash -= repayment;
    s.debt -= repayment;
    entry(s, "未払債務の返済", -repayment, "expense");
  }
}
export function requireCash(s: GameState, amount: number) {
  if (s.cash < amount)
    throw Error("資金が足りません。勤務や貯金で資金を用意してください");
}
export const netWorth = (s: GameState) =>
  s.cash +
  (s.employment?.accrued ?? 0) +
  s.assets.reduce((a, b) => a + b.cost, 0) -
  s.debt;
