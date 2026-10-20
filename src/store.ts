import { create } from "zustand";
import type { GameState, Command } from "./engine/types";
import { dispatch, newGame } from "./engine";
import { saveGame, loadGame, parseSave } from "./persistence";
interface Store {
  game: GameState | null;
  slot: number;
  error: string;
  saving: boolean;
  saved: boolean;
  start: (
    name: string,
    condition: "standard" | "challenge" | "comfortable",
    slot: number,
  ) => void;
  act: (c: Command) => void;
  save: () => Promise<void>;
  load: (slot: number) => Promise<void>;
  importGame: (json: string, slot: number) => Promise<void>;
  clearError: () => void;
}
let revision = 0;
export const useGame = create<Store>((set, get) => ({
  game: null,
  slot: 1,
  error: "",
  saving: false,
  saved: false,
  clearError: () => set({ error: "" }),
  start: (name, condition, slot) => {
    try {
      set({ game: newGame(name, condition), slot, error: "" });
      void get().save();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  act: (c) => {
    try {
      const s = get().game;
      if (!s) return;
      set({ game: dispatch(s, c), error: "" });
      void get().save();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  save: async () => {
    const { game, slot } = get();
    if (!game) return;
    const r = ++revision;
    set({ saving: true, saved: false });
    try {
      await saveGame(slot, game);
      if (r === revision) set({ saving: false, saved: true });
    } catch {
      if (r === revision)
        set({
          saving: false,
          saved: false,
          error:
            "保存できませんでした。JSONを書き出してバックアップしてください。",
        });
    }
  },
  load: async (slot) => {
    try {
      const game = await loadGame(slot);
      set({ game, slot, error: "", saved: true });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
  importGame: async (json, slot) => {
    try {
      const game = parseSave(json);
      set({ game, slot, error: "" });
      await get().save();
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },
}));
