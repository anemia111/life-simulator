import type { Accounts } from "../enterprise/types";
export type Motive =
  "stability" | "income" | "enterprise" | "spending" | "saving" | "mobility";
export interface Resident extends Accounts {
  id: string;
  homeId: string;
  motive: Motive;
  goal: string;
  standard: "frugal" | "balanced" | "comfortable";
  jobId: string | null;
  income: number;
  earned: number;
  consumed: number;
  changes: number;
  lastDecision: string;
  hours: {
    work: number;
    commute: number;
    study: number;
    business: number;
    essential: number;
    social: number;
    care: number;
    sleep: number;
    free: number;
  };
  contacts: string[];
  businessId: string | null;
}
export interface AIFirm extends Accounts {
  id: string;
  name: string;
  industry: string;
  ownerId: string;
  founded: string;
  legalForm: "company" | "sole";
  strategy: "value" | "quality" | "growth";
  status: "active" | "closed";
  sites: string[];
  employees: string[];
  price: number;
  quality: number;
  brand: number;
  wageIndex: number;
  advertising: number;
  capacity: number;
  lossDays: number;
  creditLimit: number;
  borrowed: number;
  lastProfit: number;
  monthProfit: number;
  lastMonthProfit: number;
  staffHours: number;
  workCarry: number;
  dayOpeningProfit: number;
  lastDemand: number;
  lastUnits: number;
  marketShare: number;
  decisions: number;
}
export interface DistrictEconomy {
  ageShares: { young: number; working: number; senior: number };
  id: string;
  population: number;
  income: number;
  unemployment: number;
  rent: number;
  wage: number;
  land: number;
  demand: number;
}
export interface MarketSnapshot {
  industry: string;
  pool: number;
  allocations: Record<string, number>;
}
export interface WorldEvent {
  id: number;
  date: string;
  kind: string;
  entityId: string;
  districtId: string | null;
  text: string;
}
export interface Simulation {
  seed: number;
  randomState: number;
  firms: AIFirm[];
  residents: Resident[];
  districts: DistrictEconomy[];
  markets: MarketSnapshot[];
  news: WorldEvent[];
  interest: number;
  unemployment: number;
  income: number;
  wage: number;
  rent: number;
  history: {
    date: string;
    population: number;
    unemployment: number;
    economy: number;
    price: number;
    income: number;
    firms: number;
  }[];
}
