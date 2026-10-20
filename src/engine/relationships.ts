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
  const gain =
    npc.personality === "outgoing" ? 6 : npc.personality === "curious" ? 5 : 4;
  r.affinity = Math.min(100, r.affinity + gain * hours);
  r.trust = Math.min(100, r.trust + 2 * hours);
  r.interactions++;
  s.person.satisfaction = Math.min(100, s.person.satisfaction + 3 * hours);
  s.person.skills.service = Math.min(
    100,
    s.person.skills.service + 0.1 * hours,
  );
  s.person.energy = Math.max(0, s.person.energy - hours);
}
