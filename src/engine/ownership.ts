import type { GameState } from "./types";
export function addEquipment(s: GameState, name: string, cost: number) {
  s.assets.push({
    id: "asset-" + ++s.sequence,
    ownerId: "player-business",
    kind: "equipment",
    name,
    level: 1,
    cost,
  });
}
export function upgradeEquipment(s: GameState, cost: number) {
  const a = s.assets.find((a) => a.ownerId === "player-business");
  if (a) {
    a.level++;
    a.cost += cost;
  }
}
