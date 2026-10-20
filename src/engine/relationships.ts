import {
  ensureBond,
  refreshBond,
  converse,
  reserveConversation,
} from "./social/relationships";
import type { GameState } from "./types";
export function meetColleagues(s: GameState, employerId: string) {
  for (const p of s.npcs.filter((p) => p.employerId === employerId)) {
    let r = s.relationships.find((r) => r.npcId === p.id);
    if (!r) {
      r = {
        npcId: p.id,
        affinity: 10,
        trust: 10,
        met: s.date,
        interactions: 0,
      };
      s.relationships.push(r);
      s.notices.unshift(p.name + "と職場で知り合いました");
    }
    r.affinity = Math.min(100, r.affinity + 0.15);
    r.trust = Math.min(100, r.trust + 0.1);
    const b = ensureBond(s, "player", p.id);
    if (b.a === "player") {
      b.affinityA = r.affinity;
      b.trustA = r.trust;
      b.affinityB = Math.min(100, b.affinityB + 0.15);
      b.trustB = Math.min(100, b.trustB + 0.1);
    } else {
      b.affinityB = r.affinity;
      b.trustB = r.trust;
      b.affinityA = Math.min(100, b.affinityA + 0.15);
      b.trustA = Math.min(100, b.trustA + 0.1);
    }
    refreshBond(s, b);
  }
}
export function workplaceTrust(s: GameState, employerId: string) {
  return Math.max(
    0,
    ...s.relationships
      .filter((r) =>
        s.npcs.some((p) => p.id === r.npcId && p.employerId === employerId),
      )
      .map((r) => r.trust),
  );
}
export function socialize(s: GameState, npcId: string, hours = 1) {
  const r = s.relationships.find((r) => r.npcId === npcId),
    npc = s.npcs.find((p) => p.id === npcId);
  if (!r || !npc) throw Error("まず職場で知り合ってから交流できます");
  reserveConversation(s, npcId, hours);
  converse(s, "player", npcId, hours);
  s.person.satisfaction = Math.min(100, s.person.satisfaction + 3 * hours);
  s.person.skills.service = Math.min(
    100,
    s.person.skills.service + 0.1 * hours,
  );
  s.person.energy = Math.max(0, s.person.energy - hours);
}
