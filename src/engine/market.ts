import type { GameState, IndustryDefinition } from "./types";
export function calculateMarket(
  s: GameState,
  i: IndustryDefinition,
  hours: number,
) {
  const b = s.business!;
  const quality = 1 + s.person.skills[i.skill] / 100;
  const priceFactor = Math.pow(i.basePrice / b.price, 1.4);
  const competition = s.world.competitorPrice / s.world.competitorQuality;
  const demand = Math.max(
    0,
    Math.floor(
      i.demand *
        (s.world.population / 120000) *
        s.world.economy *
        priceFactor *
        quality *
        competition *
        (i.demandFactor?.(s) ?? 1),
    ),
  );
  const capacity = Math.floor(
    hours * i.capacity * (1 + (b.level - 1) * 0.5) * quality,
  );
  const available = Math.max(0, s.cash - i.fixedCost);
  const affordable = i.unitCost ? Math.floor(available / i.unitCost) : capacity;
  return { demand, capacity, units: Math.min(demand, capacity, affordable) };
}
