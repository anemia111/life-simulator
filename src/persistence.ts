import { z } from "zod";
import type { GameState } from "./engine/types";
import { industries } from "./engine/industries";
import { jobs } from "./engine/career";
import { housing } from "./engine/life";
const amount = z.number().finite().int().min(0).max(1e15),
  signed = z.number().finite().int().min(-1e15).max(1e15),
  text = z.string().max(200);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v,
  );
const industry = z.string().refine((id) => industries.some((i) => i.id === id));
const day = z.object({
  demand: amount,
  capacity: amount,
  units: amount,
  revenue: amount,
  costs: amount,
  profit: signed,
});
const schema = z.object({
  schemaVersion: z.literal(1),
  person: z.object({
    id: z.literal("player"),
    name: z.string().trim().min(1).max(24),
    birthDate: date,
    energy: z.number().min(0).max(100),
    health: z.number().min(0).max(100),
    skills: z.object({
      service: z.number().min(0).max(100),
      craft: z.number().min(0).max(100),
      digital: z.number().min(0).max(100),
    }),
  }),
  npcs: z
    .array(
      z.object({
        id: text,
        name: text,
        birthDate: date,
        energy: z.number().min(0).max(100),
        health: z.number().min(0).max(100),
        skills: z.object({
          service: z.number().min(0).max(100),
          craft: z.number().min(0).max(100),
          digital: z.number().min(0).max(100),
        }),
      }),
    )
    .max(1000),
  date,
  started: date,
  days: amount,
  cash: amount,
  debt: amount,
  employment: z
    .object({
      jobId: z.string().refine((id) => jobs.some((j) => j.id === id)),
      employerId: text,
      accrued: amount,
      workedDays: amount,
    })
    .nullable(),
  business: z
    .object({
      industryId: industry,
      price: amount.min(100).max(100000),
      level: amount.min(1).max(100000),
      active: z.boolean(),
      revenue: amount,
      costs: amount,
      units: amount,
      last: day,
    })
    .nullable(),
  organizations: z
    .array(
      z.object({
        id: text,
        name: text,
        kind: z.enum(["employer", "sole-trader", "competitor"]),
        ownerId: text,
      }),
    )
    .max(100),
  assets: z
    .array(
      z.object({
        id: text,
        ownerId: text,
        kind: z.literal("equipment"),
        name: text,
        level: amount.min(1),
        cost: amount,
      }),
    )
    .max(100),
  action: z.enum(["rest", "service", "craft", "digital", "business"]),
  housingId: z.string().refine((id) => housing.some((h) => h.id === id)),
  ledger: z
    .array(
      z.object({
        id: amount,
        date,
        label: text,
        amount: signed,
        category: z.enum(["income", "expense", "debt"]),
      }),
    )
    .max(1000),
  sequence: amount,
  history: z
    .array(
      z.object({
        date,
        cash: amount,
        netWorth: signed,
        earned: amount,
        spending: amount,
        sales: amount,
        profit: signed,
      }),
    )
    .max(365),
  world: z.object({
    city: text,
    population: amount.min(1).max(1e9),
    economy: z.number().min(0.1).max(10),
    competitorPrice: z.number().min(0.1).max(10),
    competitorQuality: z.number().min(0.1).max(10),
  }),
  totals: z.object({
    wages: amount,
    revenue: amount,
    businessProfit: signed,
    living: amount,
  }),
  notices: z.array(text).max(12),
});
export function validateSave(value: unknown): GameState {
  const r = schema.safeParse(value);
  if (!r.success) throw Error("セーブ形式が不正、または未対応のバージョンです");
  const s = r.data;
  const ids = s.assets.map((a) => a.id);
  if (
    new Set(ids).size !== ids.length ||
    s.date < s.started ||
    s.person.birthDate > s.date ||
    s.sequence < Math.max(0, ...s.ledger.map((e) => e.id))
  )
    throw Error("セーブの整合性を確認できません");
  return s;
}
export function parseSave(json: string) {
  if (json.length > 2000000)
    throw Error("セーブファイルは2MB以内にしてください");
  return validateSave(JSON.parse(json));
}
export interface SaveSlot {
  id: number;
  savedAt: string;
  state: GameState;
}
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("life-simulator", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("saves", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function transact<T>(
  mode: IDBTransactionMode,
  operation: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("saves", mode);
    const req = operation(tx.objectStore("saves"));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? req.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? Error("保存に失敗しました"));
    };
  });
}
let queue: Promise<unknown> = Promise.resolve();
export function saveGame(id: number, state: GameState): Promise<SaveSlot> {
  const snapshot = validateSave(structuredClone(state));
  const slot = { id, savedAt: new Date().toISOString(), state: snapshot };
  const task = queue
    .catch(() => {})
    .then(() => transact("readwrite", (s) => s.put(slot)))
    .then(() => slot);
  queue = task;
  return task;
}
export async function loadGame(id: number) {
  await queue.catch(() => {});
  const slot = await transact<SaveSlot | undefined>("readonly", (s) =>
    s.get(id),
  );
  if (!slot) throw Error("このスロットにはセーブがありません");
  return validateSave(slot.state);
}
export async function listSaves() {
  await queue.catch(() => {});
  return transact<SaveSlot[]>("readonly", (s) => s.getAll());
}
