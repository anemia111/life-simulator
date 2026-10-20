import type { GameState } from "./types";
import { industries } from "./industries";
// Competitors review pricing weekly in response to the player's price, bounded by their cost floor.
export function decideCompetitors(s: GameState) {
  if (s.days % 7 === 0) {
    const b = s.business;
    const ratio = b
      ? b.price /
        (industries.find((i) => i.id === b.industryId)?.basePrice ?? b.price)
      : 1;
    s.world.competitorPrice =
      Math.round(Math.max(0.85, Math.min(1.15, 0.9 + ratio * 0.1)) * 100) / 100;
  }
}
