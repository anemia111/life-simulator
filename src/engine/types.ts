export type Skill = "service" | "craft" | "digital";
export type Action = "rest" | Skill | "business";
export interface Person {
  id: string;
  name: string;
  birthDate: string;
  energy: number;
  health: number;
  skills: Record<Skill, number>;
}
export interface Organization {
  id: string;
  name: string;
  kind: "employer" | "sole-trader" | "competitor";
  ownerId: string;
}
export interface Asset {
  id: string;
  ownerId: string;
  kind: "equipment";
  name: string;
  level: number;
  cost: number;
}
export interface EmploymentContract {
  jobId: string;
  employerId: string;
  accrued: number;
  workedDays: number;
}
export interface Offering {
  industryId: string;
  price: number;
  level: number;
  active: boolean;
  revenue: number;
  costs: number;
  units: number;
  last: BusinessDay;
}
export interface BusinessDay {
  demand: number;
  capacity: number;
  units: number;
  revenue: number;
  costs: number;
  profit: number;
}
export interface LedgerEntry {
  id: number;
  date: string;
  label: string;
  amount: number;
  category: "income" | "expense" | "debt";
}
export interface DayRecord {
  date: string;
  cash: number;
  netWorth: number;
  earned: number;
  spending: number;
  sales: number;
  profit: number;
}
export interface GameState {
  schemaVersion: 1;
  person: Person;
  npcs: Person[];
  date: string;
  started: string;
  days: number;
  cash: number;
  debt: number;
  employment: EmploymentContract | null;
  business: Offering | null;
  organizations: Organization[];
  assets: Asset[];
  action: Action;
  housingId: string;
  ledger: LedgerEntry[];
  sequence: number;
  history: DayRecord[];
  world: {
    city: string;
    population: number;
    economy: number;
    competitorPrice: number;
    competitorQuality: number;
  };
  totals: {
    wages: number;
    revenue: number;
    businessProfit: number;
    living: number;
  };
  notices: string[];
}
export interface Job {
  id: string;
  employerId: string;
  name: string;
  company: string;
  wage: number;
  hours: number;
  skill: Skill;
  requirement: number;
  description: string;
}
export interface IndustryDefinition {
  id: string;
  name: string;
  product: string;
  description: string;
  setup: number;
  basePrice: number;
  unitCost: number;
  fixedCost: number;
  demand: number;
  capacity: number;
  skill: Skill;
  demandFactor?: (state: GameState) => number;
}
export type Command =
  | { type: "advance"; days: number }
  | { type: "apply"; jobId: string }
  | { type: "quit" }
  | { type: "action"; action: Action }
  | { type: "open"; industryId: string }
  | { type: "price"; price: number }
  | { type: "invest" }
  | { type: "toggle" }
  | { type: "close" }
  | { type: "housing"; housingId: string };
