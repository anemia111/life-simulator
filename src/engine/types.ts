export type Skill = "service" | "craft" | "digital";
export type Action = string;
export interface Person {
  id: string;
  name: string;
  birthDate: string;
  energy: number;
  health: number;
  sleepDebt: number;
  satisfaction: number;
  skills: Record<Skill, number>;
  experience: Record<Skill, number>;
  occupation: string;
  employerId: string | null;
  personality: "steady" | "outgoing" | "curious";
}
export interface Organization {
  id: string;
  name: string;
  kind: "employer" | "sole-trader" | "competitor";
  ownerId: string;
  cash: number;
  dailyRevenue: number;
  dailyCost: number;
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
  id: string;
  jobId: string;
  employerId: string;
  accrued: number;
  workedDays: number;
  workedHours: number;
  absences: number;
  wage: number;
  rating: number;
  rank: number;
  started: string;
  weekdays: number[];
  start: number;
  hours: number;
  commute: number;
  absentNext: boolean;
  month: string;
  monthHours: number;
  monthDenominator: number;
}
export interface CareerRecord {
  jobId: string;
  company: string;
  started: string;
  ended: string;
  workedHours: number;
  workedDays: number;
  absences: number;
  rank: number;
  rating: number;
}
export interface Application {
  date: string;
  jobId: string;
  hired: boolean;
  score: number;
  threshold: number;
  reason: string;
}
export interface Vacancy {
  jobId: string;
  employerId: string;
  openings: number;
  competition: number;
  threshold: number;
}
export interface Relationship {
  npcId: string;
  affinity: number;
  trust: number;
  met: string;
  interactions: number;
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
export type FinanceKind =
  | "wages"
  | "business-revenue"
  | "business-cost"
  | "living"
  | "capital"
  | "interest"
  | "transfer"
  | "borrowing"
  | "repayment"
  | "other";
export interface Balances {
  cash: number;
  bank: number;
  debt: number;
}
export interface LedgerEntry {
  id: number;
  date: string;
  label: string;
  amount: number;
  category: "income" | "expense" | "debt" | "transfer";
  kind: FinanceKind;
  cashDelta: number;
  bankDelta: number;
  debtDelta: number;
  cashAfter: number;
  bankAfter: number;
  debtAfter: number;
}
export interface MonthReport {
  month: string;
  opening: Balances;
  closing: Balances;
  earned: number;
  wages: number;
  sales: number;
  businessCosts: number;
  living: number;
  capital: number;
  interest: number;
  otherIncome: number;
  otherExpenses: number;
  cashFlow: number;
}
export interface TimeBlock {
  kind:
    "sleep" | "work" | "commute" | "essential" | "manual" | "activity" | "free";
  label: string;
  start: number;
  hours: number;
  targetId?: string;
}
export interface DayRecord {
  date: string;
  cash: number;
  bank: number;
  debt: number;
  netWorth: number;
  earned: number;
  spending: number;
  sales: number;
  profit: number;
  workHours: number;
  sleepHours: number;
  studyHours: number;
  commuteHours: number;
  freeHours: number;
  activityHours: number;
  energy: number;
  satisfaction: number;
  blocks: TimeBlock[];
  events: string[];
}
export interface Routine {
  sleepHours: number;
  activityHours: number;
  weekendHours: number;
  weekdayAction: string;
  weekendAction: string;
  socialTarget: string | null;
}
export interface GameState {
  schemaVersion: 2;
  person: Person;
  npcs: Person[];
  date: string;
  started: string;
  days: number;
  cash: number;
  bank: number;
  debt: number;
  loan: number;
  employments: EmploymentContract[];
  employment: EmploymentContract | null;
  careerHistory: CareerRecord[];
  applications: Application[];
  vacancies: Vacancy[];
  relationships: Relationship[];
  business: Offering | null;
  organizations: Organization[];
  assets: Asset[];
  action: Action;
  routine: Routine;
  manualActions: { actionId: string; label: string; hours: number }[];
  housingId: string;
  livingStandard: "frugal" | "balanced" | "comfortable";
  ledger: LedgerEntry[];
  checkpoint: Balances;
  reports: MonthReport[];
  sequence: number;
  history: DayRecord[];
  world: {
    city: string;
    population: number;
    economy: number;
    costIndex: number;
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
  location: string;
  industry: string;
  wage: number;
  payMode: "hourly" | "monthly";
  salary: number;
  payDay: number;
  hours: number;
  start: number;
  weekdays: number[];
  commute: number;
  fare: number;
  skill: Skill;
  requirement: number;
  competition: number;
  threshold: number;
  promotion: string;
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
export type ActionTarget = {
  id?: string;
  amount?: number;
  value?: string;
  price?: number;
  contractId?: string;
};
export type Command =
  | { type: "advance"; days: number }
  | { type: "apply"; jobId: string }
  | { type: "quit"; contractId?: string }
  | { type: "action"; action: Action }
  | { type: "open"; industryId: string }
  | { type: "price"; price: number }
  | { type: "invest" }
  | { type: "toggle" }
  | { type: "close" }
  | { type: "housing"; housingId: string }
  | { type: "routine"; routine: Partial<Routine> }
  | { type: "shift"; contractId: string; start: number; weekdays: number[] }
  | { type: "absence"; contractId: string }
  | { type: "standard"; standard: GameState["livingStandard"] }
  | { type: "execute"; actionId: string; target?: ActionTarget };
