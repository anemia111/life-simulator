import type { IndustryModule } from "./types";
import { book, spend } from "./accounting";
export const software: IndustryModule = {
  siteProfile: { locality: 0.15, storage: false },
  id: "software",
  name: "デジタル商品・ソフトウェア",
  description:
    "24時間の開発後、月額サービスを提供。30日周期で利用料を回収し、更新時に顧客が離脱します。",
  skill: "digital",
  setup: 10000,
  basePrice: 900,
  market: 250,
  capacity: 4,
  minimumSkill: 10,
  tick(s, v, h, demand) {
    if (v.development < 24) {
      if (
        s.person.skills.digital < 10 &&
        v.employees.length === 0 &&
        v.outsource === 0
      )
        return 0;
      v.development = Math.min(24, v.development + h);
      return 0;
    }
    const users = v.subscribers.reduce((n, c) => n + c.count, 0),
      hosting = 100 + users * 3;
    if (!spend(s, v, hosting, "サーバー・保守費")) {
      v.subscribers = [];
      v.rating = Math.max(0, v.rating - 2);
      return 0;
    }
    let renewed = 0;
    for (const c of v.subscribers.filter((c) => c.due <= s.date)) {
      const charge = c.count * c.fee;
      book(s, v, "30日間のサービス利用料", { cash: charge, revenue: charge });
      const churn = Math.min(
        0.9,
        0.04 +
          (100 - v.quality) / 500 +
          Math.max(0, c.fee / 900 - 1) * 0.1 +
          Math.max(0, users / 50 - h) * 0.02,
      );
      c.count = Math.floor(c.count * (1 - churn));
      renewed += c.count;
      c.due = new Date(Date.parse(s.date) + 30 * 86400000)
        .toISOString()
        .slice(0, 10);
    }
    v.subscribers = v.subscribers.filter((c) => c.count > 0);
    const n = Math.max(
      0,
      Math.min(demand - users, Math.floor(Math.max(0, h - users / 100) * 4)),
    );
    if (n)
      v.subscribers.push({
        count: n,
        fee: v.price,
        due: new Date(Date.parse(s.date) + 30 * 86400000)
          .toISOString()
          .slice(0, 10),
      });
    return n + renewed;
  },
};
