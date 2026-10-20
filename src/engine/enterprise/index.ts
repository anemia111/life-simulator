import { age } from "../person";
import { resident as initializeResident } from "../simulation/initial";
import { releaseSites } from "../spatial/commands";
import {
  businessTrip,
  locationEffect,
  businessProperties,
} from "../spatial/selectors";
import type { GameState } from "../types";
import type { Company, Enterprise, EnterpriseInput } from "./types";
import {
  accounts,
  book,
  nav,
  profit,
  spend,
  settle,
  transferBook,
  companyNAV,
  companyProfit,
  companyVentures,
  shareValue,
} from "./accounting";
import { industryModules } from "./registry";
import { demandFor, regions } from "./market";
import { purchase, products } from "./retail";
import { liquid, post, receive, requireCash, pay } from "../finance";
import { createPerson } from "../person";
export { industryModules, regions, products };
export * from "./accounting";
const integer = (n: number | undefined, min = 0) => {
  if (!Number.isSafeInteger(n) || n! < min)
    throw Error("金額・数量は範囲内の整数で指定してください");
  return n!;
};
function personalFunding(s: GameState, n: number, label: string) {
  requireCash(s, n);
  const cash = Math.min(s.cash, n);
  post(s, label, "transfer", -cash, -(n - cash), 0);
}
function company(s: GameState, id: string | undefined): Company {
  const c = s.companies.find((c) => c.id === id && c.status === "active");
  if (!c || c.representative !== "player")
    throw Error("経営できる会社が見つかりません");
  return c;
}
function enterprise(s: GameState, id: string | undefined): Enterprise {
  const v = s.ventures.find((v) => v.id === id);
  if (!v) throw Error("事業が見つかりません");
  if (v.ownerId !== "player") company(s, v.ownerId);
  return v;
}
function fund(s: GameState, v: Enterprise, n: number) {
  if (v.ownerId === "player") {
    personalFunding(s, n, v.name + "へ資金移動");
    book(s, v, "所有者からの元入金", { cash: n, equity: n });
  } else transferBook(s, company(s, v.ownerId), v, n, "会社から事業へ資金移動");
}
export function executeEnterprise(s: GameState, t: EnterpriseInput) {
  if (t.operation === "create-company") {
    const capital = integer(t.amount, 10000),
      shares = integer(t.value ?? 100, 1),
      name = t.name?.trim();
    if (!name || name.length > 80) throw Error("商号は1〜80文字です");
    requireCash(s, capital + 10000);
    pay(s, 10000, "会社設立費（ゲーム内簡略制度）", "other");
    personalFunding(s, capital, "会社への出資");
    const c: Company = {
      ...accounts(),
      id: "company-" + ++s.sequence,
      name,
      founded: s.date,
      region: t.region ?? "online",
      description: t.policy?.slice(0, 200) || "自由な事業活動",
      representative: "player",
      shares,
      shareholders: [{ personId: "player", shares, paid: 0 }],
      capital,
      dividends: 0,
      status: "active",
    };
    book(s, c, "設立出資", { cash: capital, equity: capital });
    s.companies.push(c);
    return;
  }
  if (t.operation === "create") {
    const m = industryModules.get(t.industry ?? "");
    if (!m) throw Error("業界が不正です");
    const upgrades = integer(t.value ?? 0),
      equipment = m.setup + (10000 * upgrades * (upgrades + 1)) / 2;
    const n = integer(t.amount, equipment),
      name = t.name?.trim();
    if (!name || name.length > 80) throw Error("事業名は1〜80文字です");
    if (!Object.hasOwn(regions, t.region ?? "online"))
      throw Error("活動地域が不正です");
    const product = t.product ?? "stationery";
    const v: Enterprise = {
      ...accounts(),
      data: {},
      personalRevenue: 0,
      personalExpenses: 0,
      acquisitionRevenue: 0,
      acquisitionExpenses: 0,
      id: "venture-" + ++s.sequence,
      name,
      industry: m.id,
      ownerId: t.companyId || "player",
      region: (t.region ?? "online") as Enterprise["region"],
      product,
      founded: s.date,
      status: "active",
      price: integer(t.price ?? m.basePrice, 100),
      quality: Math.min(95, 40 + s.person.skills[m.skill] / 2),
      rating: 60,
      brand: 0,
      level: 1 + upgrades,
      weight: 1,
      advertising: t.policy === "growth" ? 500 : 0,
      outsource: 0,
      channels: 1,
      sites: 1,
      autoOrders: t.policy !== "manual",
      reorder: t.policy === "growth" ? 10 : 0,
      targetStock: 30,
      procurementBudget: 3000,
      inventory: [],
      returns: [],
      orders: [],
      subscribers: [],
      development: 0,
      customerCarry: 0,
      employees: [],
      last: {
        date: s.date,
        demand: 0,
        capacity: 0,
        units: 0,
        ownerHours: 0,
        staffHours: 0,
        revenue: 0,
        expenses: 0,
        cashFlow: 0,
      },
      history: [],
    };
    fund(s, v, n);
    book(s, v, "開業設備の取得", { cash: -equipment, equipment });
    m.initialize?.(s, v);
    s.ventures.push(v);
    return;
  }
  if (
    ["capital", "officer", "dividend", "sell-shares", "dissolve"].includes(
      t.operation,
    )
  ) {
    const c = company(s, t.id),
      n = integer(t.amount, 1);
    if (t.operation === "capital") {
      const share = integer(t.value ?? 1, 1);
      if (n < share) throw Error("出資額は発行株式数以上です");
      personalFunding(s, n, c.name + "へ追加出資");
      book(s, c, "追加出資", { cash: n, equity: n });
      c.capital += n;
      c.shares += share;
      const h = c.shareholders.find((h) => h.personId === "player");
      if (h) h.shares += share;
      else c.shareholders.push({ personId: "player", shares: share, paid: 0 });
    }
    if (t.operation === "officer") {
      if (
        c.book.debt ||
        companyVentures(s, c).some((v) => v.book.debt) ||
        c.book.cash < n
      )
        throw Error("会社の支払可能資金が不足しています");
      spend(s, c, n, "役員報酬");
      receive(s, n, c.name + "から役員報酬", "other", "bank");
    }
    if (t.operation === "dividend") {
      if (
        c.book.debt ||
        companyVentures(s, c).some((v) => v.book.debt) ||
        c.book.cash < n ||
        companyProfit(s, c) - c.dividends < n
      )
        throw Error("配当には現金と未分配の稼得利益が必要です");
      book(s, c, "配当", { cash: -n, equity: -n });
      c.dividends += n;
      const mine = shareValue(
        n,
        c.shareholders.find((h) => h.personId === "player")?.shares ?? 0,
        c.shares,
      );
      if (mine) receive(s, mine, c.name + "から配当", "other", "bank");
    }
    if (t.operation === "sell-shares") {
      const relation = s.relationships.find(
        (r) => r.npcId === t.npcId && r.trust >= 30,
      );
      const buyer = s.npcs.find((p) => p.id === t.npcId);
      const own = c.shareholders.find((h) => h.personId === "player");
      if (!relation || !buyer || !own || n >= own.shares)
        throw Error("信頼30以上の知人に保有株式の一部を売却できます");
      const price = shareValue(Math.max(0, companyNAV(s, c)), n, c.shares);
      if (price < 1) throw Error("現在の簿価では売却できません");
      const budget =
        20000 +
        Math.floor(relation.trust * 1000) -
        s.companies.reduce(
          (sum, x) =>
            sum +
            (x.shareholders.find((h) => h.personId === buyer.id)?.paid ?? 0),
          0,
        );
      if (price > budget) throw Error("買い手の投資余力を超えています");
      own.shares -= n;
      const h = c.shareholders.find((h) => h.personId === buyer.id);
      if (h) {
        h.shares += n;
        h.paid += price;
      } else
        c.shareholders.push({ personId: buyer.id, shares: n, paid: price });
      receive(s, price, "非公開株式の相対売却（簿価）", "other", "bank");
    }
    if (t.operation === "dissolve") {
      if (
        companyVentures(s, c).some(
          (v) =>
            v.status !== "closed" ||
            nav(v) !== 0 ||
            v.book.debt > 0 ||
            v.returns.length > 0 ||
            v.book.receivables > 0,
        ) ||
        c.book.debt
      )
        throw Error("全事業を閉鎖し残金回収・負債精算を行ってください");
      const cash = c.book.cash,
        mine = shareValue(
          cash,
          c.shareholders.find((h) => h.personId === "player")?.shares ?? 0,
          c.shares,
        );
      book(s, c, "解散・残余財産分配", { cash: -cash, equity: -cash });
      if (mine) receive(s, mine, "会社解散の残余財産", "transfer", "bank");
      releaseSites(s, c.id);
      c.status = "dissolved";
    }
    return;
  }
  const v = enterprise(s, t.id);
  if (t.operation === "fund") {
    fund(s, v, integer(t.amount, 1));
    settle(s, v);
    return;
  }
  if (t.operation === "withdraw") {
    const n = integer(t.amount, 1);
    if (v.book.debt || v.book.cash < n)
      throw Error("未払のない余剰現金から移動してください");
    if (v.ownerId === "player") {
      book(s, v, "個人口座へ回収", { cash: -n, equity: -n });
      receive(s, n, v.name + "から資金回収", "transfer", "bank");
    } else
      transferBook(s, v, company(s, v.ownerId), n, "事業から会社へ資金回収");
    return;
  }
  if (t.operation === "incorporate") {
    if (v.ownerId !== "player") throw Error("個人事業のみ法人に移管できます");
    const c = company(s, t.companyId),
      value = nav(v);
    if (value < 0 || c.shareholders.length !== 1)
      throw Error("移管には債務超過でない事業と単独所有の会社が必要です");
    v.acquisitionRevenue = v.book.revenue;
    v.acquisitionExpenses = v.book.expenses;
    v.ownerId = c.id;
    c.capital += value;
    book(s, v, "個人から会社へ簿価移管", {});
    return;
  }
  if (v.status === "closed")
    throw Error("閉鎖した事業は資金回収・補填のみ可能です");
  switch (t.operation) {
    case "purchase":
      if (v.industry !== "retail") throw Error("小売事業を選択してください");
      purchase(s, v, integer(t.amount, 1));
      break;
    case "price":
      v.price = integer(t.amount, 100);
      break;
    case "weight":
      v.weight = integer(t.amount);
      break;
    case "advertising":
      v.advertising = integer(t.amount);
      break;
    case "outsource":
      v.outsource = integer(t.amount);
      break;
    case "auto":
      v.autoOrders = !v.autoOrders;
      break;
    case "reorder":
      v.reorder = integer(t.amount);
      v.targetStock = integer(t.value, v.reorder);
      break;
    case "pause":
      v.status = v.status === "paused" ? "active" : "paused";
      if (v.status === "paused") v.subscribers = [];
      break;
    case "equipment": {
      const cost = 10000 * v.level;
      if (v.book.cash < cost || v.book.debt)
        throw Error("設備投資資金が不足しています");
      book(s, v, "設備拡張", { cash: -cost, equipment: cost });
      v.level++;
      v.quality = Math.min(100, v.quality + 2);
      break;
    }
    case "quality":
      if (!spend(s, v, 5000, "品質改善研究"))
        throw Error("研究費が不足しています");
      v.quality = Math.min(100, v.quality + 5);
      break;
    case "channel":
      if (!spend(s, v, 10000 * v.channels, "販売経路の開拓"))
        throw Error("開拓資金が不足しています");
      v.channels++;
      break;
    case "site": {
      const cost = 20000 * v.sites;
      if (v.book.cash < cost || v.book.debt)
        throw Error("拠点資金が不足しています");
      book(s, v, "拠点設備", { cash: -cost, equipment: cost });
      v.sites++;
      break;
    }
    case "hire": {
      if (!spend(s, v, 3000, "採用費")) throw Error("採用費が不足しています");
      const candidate = s.simulation.residents.find(
        (r) =>
          !r.jobId &&
          (!t.npcId || r.id === t.npcId) &&
          !s.simulation.firms.some(
            (f) => f.status === "active" && f.ownerId === r.id,
          ) &&
          !s.ventures.some((x) =>
            x.employees.some((e) => e.active && e.npcId === r.id),
          ) &&
          s.npcs.find((p) => p.id === r.id)!.skills[
            industryModules.get(v.industry)!.skill
          ] >= industryModules.get(v.industry)!.minimumSkill,
      );
      if (!candidate)
        throw Error(
          "現在の労働市場に採用できる候補者がいません。時間を進めて再募集してください",
        );
      const npc = s.npcs.find((p) => p.id === candidate.id)!;
      const id = "worker-" + ++s.sequence;
      npc.employerId = v.id;
      npc.occupation =
        v.name + " / " + (t.policy === "manager" ? "管理" : "制作");
      candidate.lastDecision = "条件の合うプレイヤー事業へ就職";
      v.employees.push({
        id,
        npcId: npc.id,
        role: t.policy === "manager" ? "manager" : "production",
        hours: 4,
        wage: 1100,
        active: true,
        workedHours: 0,
        paid: 0,
      });
      break;
    }
    case "dismiss": {
      const e = v.employees.find((e) => e.id === t.npcId);
      if (!e) throw Error("従業員が見つかりません");
      e.active = false;
      const npc = s.npcs.find((p) => p.id === e.npcId);
      if (npc) {
        npc.employerId = null;
        npc.occupation = "求職中";
      }
      break;
    }
    case "accept": {
      if (v.industry !== "freelance" || s.person.skills.digital < 5)
        throw Error("請負案件にはデジタル技能5以上が必要です");
      const due = new Date(Date.parse(s.date) + 7 * 86400000)
        .toISOString()
        .slice(0, 10);
      if (
        demandFor(s, v, industryModules.get(v.industry)!) <=
        v.orders.filter((o) => o.due === due).length
      )
        throw Error("現在の市場に新しい案件がありません");
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
        clientId: s.npcs.filter((p) => age(p, s.date) >= 18)[
          s.days % s.npcs.filter((p) => age(p, s.date) >= 18).length
        ].id,
        rating: 0,
      });
      break;
    }
    case "close": {
      releaseSites(s, v.id);
      v.status = "closed";
      v.subscribers = [];
      for (const e of v.employees) {
        e.active = false;
        const p = s.npcs.find((p) => p.id === e.npcId);
        if (p) {
          p.employerId = null;
          p.occupation = "求職中";
        }
      }
      for (const o of v.orders)
        if (o.status === "accepted") {
          o.status = "cancelled";
          spend(s, v, Math.floor(o.price * 0.1), "未納品案件の解約費", true);
        }
      const assets = v.book.inventory + v.book.equipment,
        value = Math.floor(assets * 0.5);
      if (assets)
        book(s, v, "在庫・設備の清算（簿価の50%）", {
          cash: value,
          inventory: -v.book.inventory,
          equipment: -v.book.equipment,
          expenses: assets - value,
        });
      v.inventory = [];
      settle(s, v);
      break;
    }
    default:
      throw Error("経営指示が不正です");
  }
}
export function runEnterpriseDay(s: GameState, ownerHours: number) {
  const active = s.ventures.filter(
    (v) =>
      v.status === "active" &&
      (v.ownerId === "player" ||
        s.companies.some((c) => c.id === v.ownerId && c.status === "active")),
  );
  const totalWeight = active.reduce((n, v) => n + v.weight, 0);
  for (const v of s.ventures) {
    for (const o of v.orders.filter(
      (o) => o.status === "invoiced" && o.payDate <= s.date,
    )) {
      book(s, v, "売掛金の入金", { cash: o.price, receivables: -o.price });
      o.status = "paid";
    }
    for (const o of v.orders.filter(
      (o) =>
        o.status === "accepted" &&
        Date.parse(s.date) - Date.parse(o.due) > 7 * 86400000,
    )) {
      o.status = "cancelled";
      v.rating = Math.max(0, v.rating - 10);
      spend(s, v, Math.floor(o.price * 0.1), "納期超過による契約解約費", true);
    }
    const m = industryModules.get(v.industry)!;
    m.obligations?.(s, v);
    settle(s, v);
    const own =
      v.status === "active" && totalWeight
        ? (ownerHours * v.weight) / totalWeight
        : 0;
    v.data.siteCommuteHours = 0;
    let workedOwn = 0,
      staff = 0,
      managers = 0,
      demand = 0,
      capacity = 0,
      units = 0;
    if (v.status === "active") {
      for (const e of v.employees.filter((e) => e.active)) {
        if ([0, 6].includes(new Date(s.date + "T00:00:00Z").getUTCDay()))
          continue;
        const wage = e.hours * e.wage;
        if (!spend(s, v, wage, "従業員賃金")) {
          const r = s.simulation.residents.find((r) => r.id === e.npcId);
          if (r) {
            r.hours.free += r.hours.work;
            r.hours.work = 0;
          }
          continue;
        }
        const resident = s.simulation.residents.find((r) => r.id === e.npcId);
        if (resident) {
          book(s, resident, "事業スタッフ給与", { cash: wage, revenue: wage });
          resident.earned += wage;
          resident.income = wage;
          settle(s, resident);
          const p = s.npcs.find((p) => p.id === e.npcId)!;
          p.skills[m.skill] = Math.min(100, p.skills[m.skill] + e.hours * 0.06);
          p.experience[m.skill] += e.hours;
        }
        e.paid += wage;
        e.workedHours += e.hours;
        if (e.role === "manager") managers += e.hours;
        else staff += e.hours;
      }
      const outsource = Math.min(v.outsource, Math.floor(v.book.cash / 1500));
      if (outsource > 0 && spend(s, v, outsource * 1500, "外注作業"))
        staff += outsource;
      const overhead = Math.ceil(
        (50 * v.sites +
          20 * (v.channels - 1) +
          10 * v.employees.filter((e) => e.active).length) *
          regions[v.region].cost,
      );
      const funded = spend(s, v, overhead, "拠点・管理費", true);
      let ad = 0;
      if (v.advertising && spend(s, v, v.advertising, "広告掲載"))
        ad = v.advertising;
      v.brand = Math.max(0, v.brand * 0.995 + Math.sqrt(ad) / 100);
      const burden = Math.max(
        0,
        0.15 * v.sites +
          0.05 * v.employees.filter((e) => e.active).length -
          managers -
          locationEffect(s, v, m.siteProfile).managementSupport,
      );
      const hasSite = businessProperties(s, v).length > 0,
        trip = businessTrip(s, v, own);
      v.data.siteCommuteHours = trip.hours;
      if (trip.hours) {
        pay(s, trip.fare, "事業拠点への交通費：" + v.name);
        s.totals.living += trip.fare;
      }
      const effectiveOwn =
        hasSite && trip.hours === 0 ? 0 : Math.max(0, own - trip.hours);
      workedOwn = effectiveOwn;
      const hours =
        Math.max(0, effectiveOwn + staff - burden) *
        locationEffect(s, v, m.siteProfile).productivity;
      demand =
        s.simulation.markets.find((x) => x.industry === v.industry)
          ?.allocations[v.id] ?? demandFor(s, { ...v, advertising: ad }, m);
      const productiveHours =
        s.person.skills[m.skill] >= m.minimumSkill || staff > 0
          ? hours * (1 + Math.log2(v.level)) * Math.sqrt(v.sites)
          : 0;
      capacity = Math.floor(productiveHours * m.capacity);
      if (funded) units = m.tick(s, v, productiveHours, demand);
      if (effectiveOwn) {
        s.person.skills[m.skill] = Math.min(
          100,
          s.person.skills[m.skill] + effectiveOwn * 0.08,
        );
        s.person.experience[m.skill] += effectiveOwn;
      }
    }
    settle(s, v);
    v.last = {
      date: s.date,
      demand,
      capacity,
      units,
      ownerHours: workedOwn,
      staffHours: staff,
      revenue: v.journal
        .filter((e) => e.date === s.date)
        .reduce((n, e) => n + e.delta.revenue, 0),
      expenses: v.journal
        .filter((e) => e.date === s.date)
        .reduce((n, e) => n + e.delta.expenses, 0),
      cashFlow: v.journal
        .filter((e) => e.date === s.date)
        .reduce((n, e) => n + e.delta.cash, 0),
    };
    v.history.push({ ...v.last });
    v.history = v.history.slice(-365);
    // Paid/cancelled contracts are history; unpaid and active contracts are never pruned.
    if (v.orders.length > 500)
      v.orders = v.orders
        .filter((o) => !["paid", "cancelled"].includes(o.status))
        .concat(
          v.orders
            .filter((o) => ["paid", "cancelled"].includes(o.status))
            .slice(-100),
        );
  }
  return {
    ownerHours: s.ventures.reduce((n, v) => n + v.last.ownerHours, 0),
    travelHours: s.ventures.reduce(
      (n, v) => n + Number(v.data.siteCommuteHours ?? 0),
      0,
    ),
  };
}
