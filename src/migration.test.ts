import { book as aiBook } from "./engine/enterprise/accounting";
import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import fixture from "../tests/fixtures/v1-save.json";
import {
  validateSave,
  parseSave,
  saveGame,
  loadGame,
  listSaves,
} from "./persistence";
import { advanceDays, dispatch } from "./engine";
import { reconcile, netWorth } from "./engine/finance";
describe("公開v0.1セーブからPhase 1へ", () => {
  it("旧版で家賃未払いのあるセーブも負債と月次支出を保持する", () => {
    const old = {
      ...fixture,
      date: "2026-04-01",
      started: "2026-04-01",
      days: 0,
      cash: 0,
      debt: 4000,
      employment: null,
      business: null,
      assets: [],
      action: "rest",
      sequence: 2,
      history: [],
      totals: { wages: 0, revenue: 0, businessProfit: 0, living: 24000 },
      ledger: [
        {
          id: 1,
          date: "2026-04-01",
          label: "入居月の家賃",
          amount: -20000,
          category: "expense",
        },
        {
          id: 2,
          date: "2026-04-01",
          label: "入居月の家賃：未払い",
          amount: 4000,
          category: "debt",
        },
      ],
    };
    const s = validateSave(old);
    expect(s.cash).toBe(0);
    expect(s.debt).toBe(4000);
    expect(s.reports[0].living).toBe(24000);
    expect(reconcile(s)).toBe(true);
  });
  it("実際の公開版の現金・債務・給与・事業・設備・能力・日付を維持", () => {
    const s = validateSave(fixture);
    expect(s.schemaVersion).toBe(6);
    expect(s.cash).toBe(fixture.cash);
    expect(s.debt).toBe(fixture.debt);
    expect(s.bank).toBe(0);
    expect(s.employments[0].accrued).toBe(fixture.employment.accrued);
    expect(s.business).toEqual(fixture.business);
    expect(s.assets).toEqual(fixture.assets);
    expect(s.person.skills).toEqual(fixture.person.skills);
    expect(s.date).toBe(fixture.date);
    expect(s.history).toHaveLength(fixture.history.length);
    expect(reconcile(s)).toBe(true);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it("移行後に1年進行・掛け持ち・保存ができる", () => {
    let s = validateSave(fixture);
    s = dispatch(s, { type: "apply", jobId: "convenience" });
    expect(s.employments).toHaveLength(2);
    // 保存互換・掛け持ちの長期試験は資金十分な雇用主で行う。
    for (const f of s.simulation.firms)
      aiBook(s, f, "回帰試験の企業出資", { cash: 10000000, equity: 10000000 });
    s = advanceDays(s, 365);
    expect(s.employments).toHaveLength(2);
    expect(s.business!.revenue).toBeGreaterThan(fixture.business.revenue);
    expect(s.date).toBe("2027-05-08");
    expect(reconcile(s)).toBe(true);
    expect(validateSave(s)).toEqual(s);
  });
  it("既存IndexedDBのスロットも読込時に移行する", async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("life-simulator", 1);
      req.onupgradeneeded = () =>
        req.result.createObjectStore("saves", { keyPath: "id" });
      req.onsuccess = () => {
        const db = req.result,
          tx = db.transaction("saves", "readwrite");
        tx.objectStore("saves").put({
          id: 1,
          savedAt: "2026-10-20T00:00:00Z",
          state: fixture,
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
    const s = await loadGame(1);
    expect(s.schemaVersion).toBe(6);
    expect((await listSaves())[0].state.cash).toBe(fixture.cash);
    await saveGame(1, s);
    expect(await loadGame(1)).toEqual(s);
  });
  it("改ざんされた残高・元帳・時間・参照・未知の版は拒否", () => {
    const s = advanceDays(validateSave(fixture), 7);
    expect(() => validateSave({ ...s, cash: s.cash + 1 })).toThrow();
    const ledger = structuredClone(s);
    ledger.ledger[0].cashDelta++;
    expect(() => validateSave(ledger)).toThrow();
    const blocks = structuredClone(s);
    blocks.history.at(-1)!.blocks[0].hours++;
    expect(() => validateSave(blocks)).toThrow();
    expect(() =>
      validateSave({
        ...s,
        relationships: [
          {
            npcId: "unknown",
            affinity: 1,
            trust: 1,
            met: s.date,
            interactions: 0,
          },
        ],
      }),
    ).toThrow();
    expect(() => validateSave({ ...s, schemaVersion: 99 })).toThrow();
  });
});
