import type { IndustryDefinition } from "../types";
export const writing: IndustryDefinition = {
  id: "writing",
  name: "小さな制作室",
  product: "記事・文章制作",
  description: "言葉で、誰かの仕事を支える。パソコン一台から始める制作事業。",
  setup: 20000,
  basePrice: 2500,
  unitCost: 100,
  fixedCost: 300,
  demand: 5,
  capacity: 0.65,
  skill: "digital",
};
