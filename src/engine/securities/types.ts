import type { Accounts } from "../enterprise/types";
export type InvestorStyle =
  "value" | "growth" | "income" | "index" | "cautious";
export interface Position {
  instrumentId: string;
  quantity: number;
  cost: number;
}
export interface SecuritiesAccount extends Accounts {
  id: string;
  name: string;
  kind: "player" | "npc" | "institution" | "founder" | "fund" | "issuer";
  ownerId: string;
  strategy: InvestorStyle;
  positions: Position[];
  realized: number;
  dividends: number;
  fees: number;
  deposits: number;
  withdrawals: number;
}
export interface FinancialRelease {
  period: string;
  published: string;
  revenue: number;
  operatingProfit: number;
  netIncome: number;
  assets: number;
  debt: number;
  cash: number;
  shares: number;
  eps: number;
  growth: number;
  forecast: number;
  dividendPerShare: number;
  cashFlow: number;
  rd: number;
  capex: number;
}
export interface WorldFirm extends Accounts {
  id: string;
  instrumentId: string;
  name: string;
  region: string;
  headquarters: string;
  founded: number;
  sector: string;
  business: string;
  employees: number;
  strategy: "value" | "quality" | "growth";
  quality: number;
  capacity: number;
  unitPrice: number;
  growthStage: number;
  international: number;
  marketShare: number;
  monthRevenue: number;
  monthProfit: number;
  quarterRevenue: number;
  quarterProfit: number;
  quarterCosts: number;
  quarterCashFlow: number;
  quarterRD: number;
  quarterCapex: number;
  previousRevenue: number;
  published: FinancialRelease[];
  pending: FinancialRelease[];
  status: "active" | "distressed" | "closed";
  lossMonths: number;
}
export interface Instrument {
  id: string;
  ticker: string;
  name: string;
  kind: "stock" | "etf" | "mutual";
  issuerId: string | null;
  fundId: string | null;
  exchangeId: string;
  shares: number;
  price: number;
  previousClose: number;
  reference: number;
  volume: number;
  listed: string;
  status: "listed" | "delisted";
  history: { date: string; close: number; volume: number }[];
}
export interface ExchangeOrder {
  id: string;
  accountId: string;
  instrumentId: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  quantity: number;
  remaining: number;
  limit: number;
  reservedCash: number;
  reservedShares: number;
  status: "open" | "partial" | "filled" | "cancelled" | "expired";
  created: string;
  sequence: number;
  expires: string;
  automatic: boolean;
}
export interface Trade {
  id: number;
  date: string;
  instrumentId: string;
  buyerId: string;
  sellerId: string;
  quantity: number;
  price: number;
  buyerFee: number;
  sellerFee: number;
  kind: "exchange" | "ipo" | "fund";
}
export interface MarketIndex {
  id: string;
  name: string;
  members: string[];
  divisor: number;
  value: number;
  history: { date: string; value: number }[];
}
export interface IndexFund {
  id: string;
  accountId: string;
  instrumentId: string;
  indexId: string;
  name: string;
  kind: "etf" | "mutual";
  feeBps: number;
  distributed: number;
  feesAccrued: number;
}
export interface Offering {
  id: string;
  companyId: string;
  filed: string;
  opens: string;
  status: "pending" | "listed" | "failed";
  primary: number;
  secondary: number;
  price: number;
  prospectus: FinancialRelease;
  raised: number;
  secondaryProceeds: number;
  reason: string;
}
export interface SecuritiesState {
  firms: WorldFirm[];
  instruments: Instrument[];
  accounts: SecuritiesAccount[];
  orders: ExchangeOrder[];
  trades: Trade[];
  indices: MarketIndex[];
  funds: IndexFund[];
  offerings: Offering[];
  external: Accounts;
  broker: Accounts;
  openingCash: number;
  netTransfers: number;
  sectorDemand: Record<string, number>;
  news: {
    id: number;
    date: string;
    kind: string;
    instrumentId: string;
    text: string;
  }[];
  reinvestments: { instrumentId: string; amount: number }[];
  plans: {
    instrumentId: string;
    amount: number;
    day: number;
    reinvest: boolean;
  }[];
  started: string;
  lastAccountingDate: string;
  lastRun: string;
  localReports: Record<string, string>;
  localFinancials: Record<string, FinancialRelease[]>;
}
export interface SecuritiesInput {
  operation: string;
  instrumentId?: string;
  orderId?: string;
  companyId?: string;
  side?: "buy" | "sell";
  orderType?: "market" | "limit";
  quantity?: number;
  price?: number;
  amount?: number;
  primary?: number;
  secondary?: number;
  value?: string;
  day?: number;
  reinvest?: boolean;
}
