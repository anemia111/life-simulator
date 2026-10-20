import { spatialSchema, validateSpatial } from "./engine/spatial/schema";
import { initialSpatial } from "./engine/spatial/catalog";
import { createPerson } from "./engine/person";
import { ventureSchema, companySchema } from "./engine/enterprise/schema";
import {
  verifyEnterprise,
  verifyAccounts,
} from "./engine/enterprise/accounting";
import { industryModules } from "./engine/enterprise/registry";
import { z } from "zod";
import type { GameState } from "./engine/types";
import { legacySchema } from "./legacy-save";
import { migrateV1 } from "./migration";
import { actionRegistry } from "./engine/actions";
import { reconcile } from "./engine/finance";
import { assertSchedule } from "./engine/schedule";
import { jobs } from "./engine/career";
const amount = z.number().finite().int().min(0).max(1e15),
  signed = z.number().finite().int().min(-1e15).max(1e15),
  scalar = z.number().finite().min(0).max(100),
  text = z.string().max(300),
  date = legacySchema.shape.date;
const hours = z.number().finite().min(0).max(24).multipleOf(0.5);
const balances = z.object({ cash: amount, bank: amount, debt: amount });
const person = legacySchema.shape.person.omit({ id: true }).extend({
  id: z.string().min(1).max(100),
  satisfaction: scalar,
  sleepDebt: z.number().min(0).max(48),
  experience: z.object({
    service: z.number().min(0).max(1e12),
    craft: z.number().min(0).max(1e12),
    digital: z.number().min(0).max(1e12),
  }),
  occupation: text,
  employerId: text.nullable(),
  personality: z.enum(["steady", "outgoing", "curious"]),
});
const jobId = z.string().refine((id) => jobs.some((j) => j.id === id));
const contract = z.object({
  id: text,
  jobId,
  employerId: text,
  accrued: amount,
  workedDays: amount,
  workedHours: z.number().min(0).max(1e12),
  absences: amount,
  wage: amount.min(1),
  rating: scalar,
  rank: amount.min(1).max(4),
  started: date,
  weekdays: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .max(7)
    .refine((v) => new Set(v).size === v.length),
  start: hours,
  hours: hours.min(0.5),
  commute: hours.max(3),
  absentNext: z.boolean(),
  month: z.string().regex(/^(|\d{4}-\d{2})$/),
  monthHours: z.number().min(0).max(1000),
  monthDenominator: z.number().min(0).max(744),
});
const block = z.object({
  kind: z.enum([
    "sleep",
    "work",
    "commute",
    "essential",
    "manual",
    "activity",
    "free",
  ]),
  label: text,
  start: hours.max(23.5),
  hours: hours.min(0.5),
  targetId: text.optional(),
});
const schema = z.object({
  schemaVersion: z.literal(4),
  spatial: spatialSchema,
  ventures: z.array(ventureSchema),
  companies: z.array(companySchema),
  person: person.extend({ id: z.literal("player") }),
  npcs: z.array(person),
  date,
  started: date,
  days: amount,
  cash: amount,
  bank: amount,
  debt: amount,
  loan: amount,
  employments: z.array(contract).max(4),
  employment: contract.nullable(),
  careerHistory: z
    .array(
      z.object({
        jobId,
        company: text,
        started: date,
        ended: date,
        workedHours: z.number().min(0).max(1e12),
        workedDays: amount,
        absences: amount,
        rank: amount.min(1).max(4),
        rating: scalar,
      }),
    )
    .max(200),
  applications: z
    .array(
      z.object({
        date,
        jobId,
        hired: z.boolean(),
        score: z.number().finite(),
        threshold: z.number().finite(),
        reason: text,
      }),
    )
    .max(100),
  vacancies: z
    .array(
      z.object({
        jobId,
        employerId: text,
        openings: amount.max(100),
        competition: z.number().min(0.1).max(100),
        threshold: z.number().min(0).max(1000),
      }),
    )
    .max(100),
  relationships: z
    .array(
      z.object({
        npcId: text,
        affinity: scalar,
        trust: scalar,
        met: date,
        interactions: amount,
      }),
    )
    .max(1000),
  business: legacySchema.shape.business,
  organizations: z
    .array(
      legacySchema.shape.organizations.element.extend({
        cash: signed,
        dailyRevenue: amount,
        dailyCost: amount,
      }),
    )
    .max(100),
  assets: legacySchema.shape.assets,
  action: z.string().refine((id) => actionRegistry.get(id)?.daily === true),
  routine: z.object({
    sleepHours: z.number().int().min(4).max(10),
    activityHours: hours.max(8),
    weekendHours: hours.max(8),
    weekdayAction: z
      .string()
      .refine((id) => actionRegistry.get(id)?.daily === true),
    weekendAction: z
      .string()
      .refine((id) => actionRegistry.get(id)?.daily === true),
    socialTarget: text.nullable(),
  }),
  manualActions: z
    .array(
      z.object({
        actionId: z.string().refine((id) => actionRegistry.has(id)),
        label: text,
        hours: hours,
      }),
    )
    .max(48),
  housingId: legacySchema.shape.housingId,
  livingStandard: z.enum(["frugal", "balanced", "comfortable"]),
  checkpoint: balances,
  ledger: z
    .array(
      z.object({
        id: amount,
        date,
        label: text,
        amount: signed,
        category: z.enum(["income", "expense", "debt", "transfer"]),
        kind: z.enum([
          "wages",
          "business-revenue",
          "business-cost",
          "living",
          "capital",
          "interest",
          "transfer",
          "borrowing",
          "repayment",
          "other",
        ]),
        cashDelta: signed,
        bankDelta: signed,
        debtDelta: signed,
        cashAfter: amount,
        bankAfter: amount,
        debtAfter: amount,
      }),
    )
    .max(5000),
  reports: z
    .array(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        opening: balances,
        closing: balances,
        earned: amount,
        wages: amount,
        sales: amount,
        businessCosts: amount,
        living: amount,
        capital: amount,
        interest: amount,
        otherIncome: amount,
        otherExpenses: amount,
        cashFlow: signed,
      }),
    )
    .max(120),
  sequence: amount,
  history: z
    .array(
      z.object({
        date,
        cash: amount,
        bank: amount,
        debt: amount,
        netWorth: signed,
        earned: amount,
        spending: amount,
        sales: amount,
        profit: signed,
        workHours: hours,
        sleepHours: hours,
        studyHours: hours,
        commuteHours: hours,
        freeHours: hours,
        activityHours: hours,
        energy: scalar,
        satisfaction: scalar,
        blocks: z.array(block).min(1).max(48),
        events: z.array(text).max(30),
      }),
    )
    .max(365),
  world: legacySchema.shape.world.extend({
    costIndex: z.number().min(0.1).max(10),
  }),
  totals: legacySchema.shape.totals,
  notices: z.array(text).max(12),
});
export function validateSave(value: unknown): GameState {
  if (
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion === 1
  )
    return validateSave(migrateV1(value));
  if (
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion === 2
  )
    value = { ...value, schemaVersion: 3, ventures: [], companies: [] };
  let migrated = false;
  if (
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion === 3
  ) {
    const old = value as {
      housingId?: string;
      started?: string;
      date?: string;
    };
    value = {
      ...value,
      schemaVersion: 4,
      spatial: initialSpatial(old.housingId ?? "share", old.started, old.date),
    };
    migrated = true;
  }
  const r = schema.safeParse(value);
  if (!r.success) throw Error("セーブ形式が不正、または未対応のバージョンです");
  const s: GameState = r.data;
  if (migrated)
    for (const j of jobs) {
      if (!s.organizations.some((o) => o.id === j.employerId))
        s.organizations.push({
          id: j.employerId,
          name: j.company,
          kind: "employer",
          ownerId: "npc-" + j.id,
          cash: 500000,
          dailyRevenue: 20000,
          dailyCost: 12500,
        });
      if (!s.vacancies.some((v) => v.jobId === j.id))
        s.vacancies.push({
          jobId: j.id,
          employerId: j.employerId,
          openings: 2,
          competition: j.competition,
          threshold: j.threshold,
        });
      if (!s.npcs.some((p) => p.id === "npc-" + j.id))
        s.npcs.push({
          ...createPerson("地域担当 " + j.name),
          id: "npc-" + j.id,
          employerId: j.employerId,
          occupation: j.name + " / 担当者",
        });
    }
  validateSpatial(s);
  if (
    s.date < s.started ||
    s.person.birthDate > s.date ||
    Math.round((Date.parse(s.date) - Date.parse(s.started)) / 86400000) !==
      s.days ||
    s.sequence < Math.max(0, ...s.ledger.map((e) => e.id)) ||
    !reconcile(s)
  )
    throw Error("セーブの残高または日付の整合性を確認できません");
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (
    !unique(s.assets.map((a) => a.id)) ||
    !unique(s.npcs.map((a) => a.id)) ||
    !unique(s.employments.map((a) => a.id)) ||
    !unique(s.employments.map((a) => a.jobId)) ||
    !unique(s.relationships.map((a) => a.npcId)) ||
    !unique(s.vacancies.map((a) => a.jobId)) ||
    !unique(s.organizations.map((a) => a.id)) ||
    !unique(s.reports.map((a) => a.month))
  )
    throw Error("セーブ内のIDが重複しています");
  if (
    s.employments.some(
      (e) =>
        jobs.find((j) => j.id === e.jobId)?.employerId !== e.employerId ||
        !s.organizations.some((o) => o.id === e.employerId),
    ) ||
    s.relationships.some((r) => !s.npcs.some((p) => p.id === r.npcId)) ||
    (s.routine.socialTarget &&
      !s.relationships.some((r) => r.npcId === s.routine.socialTarget))
  )
    throw Error("人物または勤務契約の参照が不正です");
  for (const day of s.history) {
    let end = 0;
    for (const block of day.blocks) {
      if (block.start !== end) throw Error("日次時間配分が不正です");
      end += block.hours;
    }
    if (end !== 24 || day.date >= s.date)
      throw Error("日次時間配分または日付が不正です");
  }
  for (const report of s.reports)
    if (
      report.closing.cash +
        report.closing.bank -
        report.opening.cash -
        report.opening.bank !==
      report.cashFlow
    )
      throw Error("月次収支と残高が一致しません");
  if (
    s.sequence <
      Math.max(
        0,
        ...[...s.ventures, ...s.companies].flatMap((a) =>
          a.journal.map((e) => e.id),
        ),
      ) ||
    !unique(s.ventures.map((v) => v.id)) ||
    !unique(s.companies.map((c) => c.id)) ||
    s.ventures.some(
      (v) =>
        !industryModules.has(v.industry) ||
        !verifyEnterprise(v) ||
        (v.ownerId !== "player" &&
          !s.companies.some((c) => c.id === v.ownerId)) ||
        v.employees.some((e) => !s.npcs.some((p) => p.id === e.npcId)) ||
        v.orders.some(
          (o) =>
            o.progress > o.hours || !s.npcs.some((p) => p.id === o.clientId),
        ),
    ) ||
    s.companies.some(
      (c) =>
        !verifyAccounts(c) ||
        c.shareholders.reduce((n, h) => n + h.shares, 0) !== c.shares ||
        !unique(c.shareholders.map((h) => h.personId)) ||
        c.shareholders.some(
          (h) =>
            h.personId !== "player" && !s.npcs.some((p) => p.id === h.personId),
        ),
    )
  )
    throw Error("事業・法人の帳簿または所有権が不正です");
  assertSchedule(s);
  s.employment = s.employments[0] ?? null;
  return s;
}
export function parseSave(json: string) {
  if (json.length > 8000000)
    throw Error("セーブファイルは8MB以内にしてください");
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
  const slots = await transact<SaveSlot[]>("readonly", (s) => s.getAll());
  return slots.map((slot) => ({ ...slot, state: validateSave(slot.state) }));
}
