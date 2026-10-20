import type { GameState, Skill } from "../types";
export interface Book {
  cash: number;
  inventory: number;
  equipment: number;
  receivables: number;
  debt: number;
  equity: number;
  revenue: number;
  expenses: number;
}
export interface Entry {
  id: number;
  date: string;
  label: string;
  delta: Book;
  after: Book;
}
export interface Accounts {
  months: {
    month: string;
    ownerId: string;
    revenue: number;
    expenses: number;
    cashFlow: number;
    funding: number;
  }[];
  book: Book;
  opening: Book;
  journal: Entry[];
}
export interface Order {
  id: string;
  price: number;
  hours: number;
  progress: number;
  due: string;
  payDate: string;
  status: "accepted" | "invoiced" | "paid" | "cancelled";
  clientId: string;
  rating: number;
}
export interface Lot {
  quantity: number;
  unitCost: number;
  expires: string;
}
export interface ReturnOrder {
  date: string;
  quantity: number;
  price: number;
  cost: number;
}
export interface Subscriber {
  count: number;
  fee: number;
  due: string;
}
export interface Employee {
  id: string;
  npcId: string;
  role: "production" | "manager";
  hours: number;
  wage: number;
  active: boolean;
  workedHours: number;
  paid: number;
}
export interface Enterprise extends Accounts {
  personalRevenue: number;
  personalExpenses: number;
  acquisitionRevenue: number;
  acquisitionExpenses: number;
  data: Record<string, number | string | boolean>;
  id: string;
  name: string;
  industry: string;
  ownerId: string;
  region: "central" | "suburb" | "online";
  product: string;
  founded: string;
  status: "active" | "paused" | "closed";
  price: number;
  quality: number;
  rating: number;
  brand: number;
  level: number;
  weight: number;
  advertising: number;
  outsource: number;
  channels: number;
  sites: number;
  autoOrders: boolean;
  reorder: number;
  targetStock: number;
  procurementBudget: number;
  inventory: Lot[];
  returns: ReturnOrder[];
  orders: Order[];
  subscribers: Subscriber[];
  development: number;
  customerCarry: number;
  employees: Employee[];
  last: {
    date: string;
    demand: number;
    capacity: number;
    units: number;
    ownerHours: number;
    staffHours: number;
    revenue: number;
    expenses: number;
    cashFlow: number;
  };
  history: Enterprise["last"][];
}
export interface Company extends Accounts {
  id: string;
  name: string;
  founded: string;
  region: string;
  description: string;
  representative: string;
  shares: number;
  shareholders: { personId: string; shares: number; paid: number }[];
  capital: number;
  dividends: number;
  status: "active" | "dissolved";
}
export interface IndustryModule {
  id: string;
  name: string;
  description: string;
  skill: Skill;
  setup: number;
  basePrice: number;
  market: number;
  capacity: number;
  minimumSkill: number;
  initialize?: (s: GameState, v: Enterprise) => void;
  obligations?: (s: GameState, v: Enterprise) => void;
  tick: (s: GameState, v: Enterprise, hours: number, demand: number) => number;
}
export interface EnterpriseInput {
  operation: string;
  id?: string;
  companyId?: string;
  industry?: string;
  name?: string;
  region?: string;
  product?: string;
  amount?: number;
  price?: number;
  value?: number;
  policy?: string;
  npcId?: string;
}
