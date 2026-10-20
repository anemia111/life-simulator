import {cities} from "./spatial/catalog";
export const createWorld = () => ({
  city: cities[0].name,
  population: cities[0].population,
  economy: 1,
  costIndex: 1,
  competitorPrice: 1,
  competitorQuality: 1,
});
