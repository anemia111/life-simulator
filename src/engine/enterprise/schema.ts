import { z } from "zod";
const n = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  signed = z
    .number()
    .int()
    .min(-Number.MAX_SAFE_INTEGER)
    .max(Number.MAX_SAFE_INTEGER),
  f = z.number().finite().nonnegative(),
  text = z.string().max(300),
  date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const bookSchema = z.object({
  cash: n,
  inventory: n,
  equipment: n,
  receivables: n,
  debt: n,
  equity: signed,
  revenue: n,
  expenses: n,
});
const delta = z.object({
  cash: signed,
  inventory: signed,
  equipment: signed,
  receivables: signed,
  debt: signed,
  equity: signed,
  revenue: signed,
  expenses: signed,
});
export const account = {
  months: z
    .array(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        ownerId: text,
        revenue: n,
        expenses: n,
        cashFlow: signed,
        funding: signed,
      }),
    )
    .max(240),
  book: bookSchema,
  opening: bookSchema,
  journal: z
    .array(z.object({ id: n, date, label: text, delta, after: bookSchema }))
    .max(2000),
};
const last = z.object({
  date,
  demand: n,
  capacity: n,
  units: n,
  ownerHours: f.max(24),
  staffHours: f,
  revenue: n,
  expenses: n,
  cashFlow: signed,
});
export const ventureSchema = z.object({
  ...account,
  personalRevenue: n,
  personalExpenses: n,
  acquisitionRevenue: n,
  acquisitionExpenses: n,
  data: z.record(
    z.string(),
    z.union([z.string().max(300), z.number().finite(), z.boolean()]),
  ),
  id: text,
  name: text,
  industry: z.string(),
  ownerId: text,
  region: z.enum(["central", "suburb", "online"]),
  product: text,
  founded: date,
  status: z.enum(["active", "paused", "closed"]),
  price: n.min(100),
  quality: f.max(100),
  rating: f.max(100),
  brand: f,
  level: n.min(1),
  weight: n,
  advertising: n,
  outsource: n,
  channels: n.min(1),
  sites: n.min(1),
  autoOrders: z.boolean(),
  reorder: n,
  targetStock: n,
  procurementBudget: n,
  inventory: z.array(
    z.object({ quantity: n.min(1), unitCost: n, expires: date }),
  ),
  returns: z.array(z.object({ date, quantity: n, price: n, cost: n })),
  orders: z.array(
    z.object({
      id: text,
      price: n,
      hours: f,
      progress: f,
      due: date,
      payDate: z.string(),
      status: z.enum(["accepted", "invoiced", "paid", "cancelled"]),
      clientId: text,
      rating: f.max(100),
    }),
  ),
  subscribers: z.array(z.object({ count: n.min(1), fee: n, due: date })),
  development: f.max(24),
  customerCarry: f.max(1),
  employees: z.array(
    z.object({
      id: text,
      npcId: text,
      role: z.enum(["production", "manager"]),
      hours: n.max(8),
      wage: n,
      active: z.boolean(),
      workedHours: f,
      paid: n,
    }),
  ),
  last,
  history: z.array(last).max(365),
});
export const companySchema = z.object({
  ...account,
  id: text,
  name: text,
  founded: date,
  region: text,
  description: text,
  representative: text,
  shares: n.min(1),
  shareholders: z.array(z.object({ personId: text, shares: n, paid: n })),
  capital: n,
  dividends: n,
  status: z.enum(["active", "dissolved"]),
});
