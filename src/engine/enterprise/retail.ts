import type { GameState } from "../types";
import type { Enterprise, IndustryModule } from "./types";
import { book, spend } from "./accounting";
export const products = {
  stationery: { name: "文具セット", cost: 300, price: 700, life: 365 },
  craft: { name: "手作り雑貨", cost: 600, price: 1400, life: 120 },
  accessory: { name: "スマホ小物", cost: 900, price: 1900, life: 90 },
};
export function purchase(s: GameState, v: Enterprise, q: number) {
  if (!Number.isSafeInteger(q) || q <= 0) throw Error("仕入数量は正の整数です");
  const product = products[v.product as keyof typeof products];
  if (!product) throw Error("商品が不正です");
  const unitCost = Math.ceil(
      product.cost * (1 - Math.min(0.15, Math.log10(Math.max(1, q)) * 0.05)),
    ),
    cost = q * unitCost;
  if (!Number.isSafeInteger(cost) || v.book.cash < cost || v.book.debt)
    throw Error("仕入資金が不足しています");
  v.inventory.push({
    quantity: q,
    unitCost,
    expires: new Date(Date.parse(s.date) + product.life * 86400000)
      .toISOString()
      .slice(0, 10),
  });
  book(s, v, "商品仕入", { cash: -cost, inventory: cost });
}
export const retail: IndustryModule = {
  siteProfile: { locality: 0.85, storage: true },
  id: "retail",
  name: "ネット販売・小売",
  description:
    "仕入れた在庫を販売。品質に応じた7日後の返品と陳腐化損失があります。",
  skill: "service",
  setup: 5000,
  basePrice: 700,
  market: 220,
  capacity: 5,
  minimumSkill: 0,
  obligations: retailObligations,
  initialize(_s, v) {
    if (!Object.hasOwn(products, v.product)) throw Error("商品が不正です");
  },
  tick(s, v, h, demand) {
    const stock = v.inventory.reduce((n, l) => n + l.quantity, 0);
    if (v.reorder > 0 && stock < v.reorder) {
      const p = products[v.product as keyof typeof products];
      const q = Math.min(
        v.targetStock - stock,
        Math.floor(Math.min(v.book.cash, v.procurementBudget) / p.cost),
      );
      if (q > 0 && !v.book.debt) purchase(s, v, q);
    }
    const qty = Math.min(
      demand,
      Math.floor(h * 5),
      v.inventory.reduce((n, l) => n + l.quantity, 0),
    );
    let remaining = qty,
      cost = 0;
    for (const lot of v.inventory) {
      const n = Math.min(remaining, lot.quantity);
      cost += n * lot.unitCost;
      lot.quantity -= n;
      remaining -= n;
    }
    v.inventory = v.inventory.filter((l) => l.quantity > 0);
    if (qty) {
      book(s, v, "商品販売と売上原価", {
        cash: qty * v.price,
        inventory: -cost,
        revenue: qty * v.price,
        expenses: cost,
      });
      v.customerCarry += qty * Math.max(0.01, (100 - v.quality) / 1000);
      const returns = Math.floor(v.customerCarry);
      v.customerCarry -= returns;
      if (returns)
        v.returns.push({
          date: new Date(Date.parse(s.date) + 7 * 86400000)
            .toISOString()
            .slice(0, 10),
          quantity: returns,
          price: v.price,
          cost: Math.floor(cost / qty),
        });
      v.rating = Math.min(100, v.rating + 0.02 * qty);
    }
    return qty;
  },
};
export function retailObligations(s: GameState, v: Enterprise) {
  for (const r of v.returns.filter((r) => r.date <= s.date)) {
    spend(s, v, r.quantity * r.price, "返品返金（損失）", true);
    v.rating = Math.max(0, v.rating - 1);
  }
  v.returns = v.returns.filter((r) => r.date > s.date);
  for (const l of v.inventory.filter((l) => l.expires <= s.date))
    book(s, v, "在庫の陳腐化・廃棄", {
      inventory: -l.quantity * l.unitCost,
      expenses: l.quantity * l.unitCost,
    });
  v.inventory = v.inventory.filter((l) => l.expires > s.date);
}
