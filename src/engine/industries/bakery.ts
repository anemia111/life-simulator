import type { IndustryDefinition } from "../types";
export const bakery: IndustryDefinition = {
  id: "bakery",
  name: "週末ベイクショップ",
  product: "焼き菓子",
  description: "日常に小さな楽しみを。地域に届ける、手づくりのお菓子。",
  setup: 30000,
  basePrice: 500,
  unitCost: 180,
  fixedCost: 500,
  demand: 32,
  capacity: 5,
  skill: "craft",
};
