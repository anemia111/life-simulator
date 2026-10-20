import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { newGame, advanceDays, dispatch } from "./engine";
import {
  validateSave,
  parseSave,
  saveGame,
  loadGame,
  listSaves,
} from "./persistence";
describe("セーブ境界", () => {
  it("稼働中の状態を完全に往復できる", () => {
    const s = advanceDays(
      dispatch(newGame("セーブ", "comfortable"), {
        type: "open",
        industryId: "bakery",
      }),
      30,
    );
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
  it("未知の版と不正な数値や参照を拒否", () => {
    const s = newGame("検証");
    expect(() => validateSave({ ...s, schemaVersion: 99 })).toThrow();
    expect(() => validateSave({ ...s, cash: NaN })).toThrow();
    expect(() => validateSave({ ...s, housingId: "unknown" })).toThrow();
    expect(() =>
      validateSave({ ...s, employment: { jobId: "missing" } }),
    ).toThrow();
    expect(() => validateSave({ ...s, date: "2026-02-30" })).toThrow();
    expect(() => parseSave("not json")).toThrow();
    expect(() => parseSave(" ".repeat(8000001))).toThrow();
  });
  it("IndexedDBの3枠が独立し同時保存は順番を保持する", async () => {
    const a = newGame("最初"),
      b = advanceDays(a, 7);
    await Promise.all([
      saveGame(1, a),
      saveGame(1, b),
      saveGame(2, newGame("別の人生")),
      saveGame(3, newGame("3番目")),
    ]);
    expect(await loadGame(1)).toEqual(b);
    expect((await loadGame(2)).person.name).toBe("別の人生");
    expect(await listSaves()).toHaveLength(3);
    await expect(loadGame(9)).rejects.toThrow();
  });
});
