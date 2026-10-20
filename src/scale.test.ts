import { it, expect } from "vitest";
import { newGame, advanceDays } from "./engine";
import { createPerson } from "./engine/person";
import { resident } from "./engine/simulation/initial";
import { initialSocial } from "./engine/social/initial";
import { seedGoals } from "./engine/goals";
import { verifySocial } from "./engine/social/schema";
import { verifySimulation } from "./engine/simulation";
import { parseSave } from "./persistence";
// Synthetic load case, not the production preset. Initial equity represents
// pre-existing wealth; it is never injected by the running simulation.
it(
  "500人を個別化した負荷ケースで30日・会計・24時間・保存を検証する",
  { timeout: 60000 },
  () => {
    let s = newGame("負荷検証", "comfortable");
    for (let i = s.npcs.length; i < 500; i++) {
      const p = createPerson("検証住民 " + i);
      p.id = "scale-" + i;
      p.birthDate = 1980 + (i % 26) + "-05-10";
      p.skills = { service: i % 40, craft: i % 35, digital: i % 30 };
      s.npcs.push(p);
      s.simulation.residents.push(resident(s, p.id, i));
    }
    s.social = initialSocial(s);
    seedGoals(s);
    const start = performance.now();
    s = advanceDays(s, 30);
    const simulationMs = Math.round(performance.now() - start);
    expect(s.npcs).toHaveLength(500);
    expect(verifySocial(s)).toBe(true);
    expect(verifySimulation(s)).toBe(true);
    for (const r of s.simulation.residents) {
      expect(r.hours.essential).toBe(2);
      expect(r.hours.free).toBeGreaterThanOrEqual(0);
      expect(Object.values(r.hours).reduce((a, b) => a + b, 0)).toBe(24);
    }
    const json = JSON.stringify(s);
    expect(json.length).toBeLessThan(16000000);
    expect(parseSave(json)).toEqual(s);
    console.log(
      "SCALE_500_RESULT",
      JSON.stringify({
        npcs: s.npcs.length,
        days: 30,
        simulationMs,
        elapsedMs: Math.round(performance.now() - start),
        saveBytes: new TextEncoder().encode(json).length,
        allInvariants: true,
      }),
    );
  },
);
