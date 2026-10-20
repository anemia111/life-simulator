import type { IndustryModule } from "./types";
import { book } from "./accounting";
export const freelance: IndustryModule = {
  siteProfile: { locality: 0.4, storage: false },
  id: "freelance",
  name: "フリーランス・サービス",
  description:
    "デザイン・制作の受注。納品で売上、3日後に入金。遅延は報酬と評価に影響。",
  skill: "digital",
  setup: 5000,
  basePrice: 12000,
  market: 20,
  capacity: 1 / 6,
  minimumSkill: 5,
  tick(s, v, h, demand) {
    if (
      v.autoOrders &&
      v.orders.filter((o) => o.status === "accepted").length === 0 &&
      demand > 0 &&
      h > 0
    ) {
      const prior = v.orders
        .filter((o) => o.status === "paid" && o.rating >= 70)
        .at(-1);
      const client =
        s.npcs.find((p) => p.id === prior?.clientId) ??
        s.npcs[s.days % s.npcs.length];
      v.orders.push({
        id: "order-" + ++s.sequence,
        price: v.price,
        hours: 6,
        progress: 0,
        due: new Date(Date.parse(s.date) + 7 * 86400000)
          .toISOString()
          .slice(0, 10),
        payDate: "",
        status: "accepted",
        clientId: client.id,
        rating: 0,
      });
    }
    let count = 0;
    for (const o of v.orders.filter((o) => o.status === "accepted")) {
      const used = Math.min(h, o.hours - o.progress);
      o.progress += used;
      h -= used;
      if (o.progress >= o.hours) {
        const late = s.date > o.due;
        o.price = Math.floor(o.price * (late ? 0.75 : 1));
        o.rating = late ? 35 : Math.min(100, 60 + Math.floor(v.quality / 3));
        o.status = "invoiced";
        o.payDate = new Date(Date.parse(s.date) + 3 * 86400000)
          .toISOString()
          .slice(0, 10);
        v.rating = (v.rating * 3 + o.rating) / 4;
        book(s, v, "案件納品・売掛金", {
          receivables: o.price,
          revenue: o.price,
        });
        count++;
      }
    }
    return count;
  },
};
