import { worldIndustries } from "./models";
import { industryModules } from "../enterprise/registry";
import { applicantScore } from "./labor";
import { quitJob } from "../career";
import type { GameState, Person } from "../types";
import type { AIFirm, Resident } from "./types";
import type { Accounts } from "../enterprise/types";
import {
  accounts,
  book,
  spend,
  settle,
  verifyAccounts,
} from "../enterprise/accounting";
import { jobs } from "../catalog/jobs";
import { properties, districts } from "../spatial/catalog";
import { route } from "../spatial/selectors";
import { weekday } from "../time";
import { standards } from "../life";
import { motives, resident, makeFirm } from "./initial";
import {
  clamp,
  districtState,
  snapshotMarkets,
  quotedRent,
  effectiveJobWage,
} from "./market";

export function random(s: GameState) {
  const sim = s.simulation;
  sim.randomState = (Math.imul(1664525, sim.randomState) + 1013904223) >>> 0;
  return sim.randomState / 4294967296;
}
export function news(
  s: GameState,
  kind: string,
  entityId: string,
  text: string,
  districtId: string | null = null,
) {
  s.simulation.news.unshift({
    id: ++s.sequence,
    date: s.date,
    kind,
    entityId,
    districtId,
    text,
  });
  s.simulation.news = s.simulation.news.slice(0, 120);
}
export function compact(a: Accounts) {
  if (a.journal.length > 60)
    a.opening = { ...a.journal.splice(0, a.journal.length - 60).at(-1)!.after };
  a.months = a.months.slice(-120);
}
function site(s: GameState, id: string) {
  return properties.find((p) => p.id === id)!;
}
export function occupiedByAI(s: GameState, id: string) {
  return (
    s.simulation.firms.find(
      (f) => f.status === "active" && f.sites.includes(id),
    )?.id ?? null
  );
}
export function vacant(s: GameState, id: string) {
  const p = site(s, id);
  return (
    !s.spatial.leases.some((l) => l.propertyId === id) &&
    !occupiedByAI(s, id) &&
    (!p.tenantId || s.simulation.firms.some((f) => f.id === p.tenantId))
  );
}
export function changeJob(s: GameState, r: Resident, jobId: string | null) {
  const p = s.npcs.find((p) => p.id === r.id)!;
  const old = r.jobId;
  for (const f of s.simulation.firms)
    f.employees = f.employees.filter((id) => id !== r.id);
  r.jobId = jobId;
  const j = jobs.find((j) => j.id === jobId);
  if (j) {
    const f = s.simulation.firms.find((f) => f.id === j.employerId)!;
    f.employees.push(r.id);
    p.employerId = f.id;
    p.occupation = j.name;
    r.lastDecision = old ? "条件を比較して転職" : "求人へ応募し採用";
    r.changes++;
    news(
      s,
      old ? "job-change" : "hire",
      r.id,
      p.name + "：" + (old ? "転職" : "就職") + " → " + f.name,
      site(s, "work-" + j.id).districtId,
    );
  } else {
    p.employerId = null;
    p.occupation = "求職中";
    r.lastDecision = old ? "退職・求職へ" : "求職中";
    if (old) news(s, "dismiss", r.id, p.name + "：雇用契約が終了");
  }
}
export function openings(s: GameState, f: AIFirm) {
  if (f.status !== "active" || f.book.debt || f.book.cash < 50000) return 0;
  const player = s.employments.filter((e) => e.employerId === f.id).length;
  const desired = Math.max(1, Math.min(4, 1 + Math.floor(f.lastDemand / 15)));
  return Math.max(0, desired - f.employees.length - player);
}
function rankJob(
  s: GameState,
  r: Resident,
  p: Person,
  j: (typeof jobs)[number],
) {
  const f = s.simulation.firms.find((f) => f.id === j.employerId);
  if (!f || !openings(s, f) || p.skills[j.skill] < j.requirement)
    return -Infinity;
  const trip = route(site(s, r.homeId), site(s, "work-" + j.id));
  if (8 + 2 + j.hours + trip.hours * 2 > 24) return -Infinity;
  const score = applicantScore(
    p,
    j,
    s.vacancies.find((v) => v.jobId === j.id)?.competition ?? j.competition,
  );
  if (score < j.threshold) return -Infinity;
  return (
    effectiveJobWage(s, j) * j.hours -
    trip.fare * 2 -
    trip.hours * 2 * (r.motive === "stability" ? 1000 : 500)
  );
}
export function npcDecisions(s: GameState) {
  for (const r of s.simulation.residents) {
    const p = s.npcs.find((p) => p.id === r.id)!;
    const own = s.simulation.firms.find(
      (f) => f.status === "active" && f.ownerId === r.id,
    );
    if (
      own ||
      s.ventures.some((v) =>
        v.employees.some((e) => e.active && e.npcId === r.id),
      )
    )
      continue;
    const current = jobs.find((j) => j.id === r.jobId);
    let best = current,
      score = current
        ? effectiveJobWage(s, current) * current.hours -
          route(site(s, r.homeId), site(s, "work-" + current.id)).fare * 2 -
          500 *
            route(site(s, r.homeId), site(s, "work-" + current.id)).hours *
            2
        : -Infinity;
    for (const j of jobs) {
      const value = rankJob(s, r, p, j);
      if (value > score) {
        best = j;
        score = value;
      }
    }
    const improvement =
      !current ||
      score >
        effectiveJobWage(s, current) *
          current.hours *
          (r.motive === "mobility" ? 1.02 : r.motive === "income" ? 1.12 : 1.3);
    if (best && best.id !== current?.id && improvement && random(s) < 0.8)
      changeJob(s, r, best.id);
    else r.lastDecision = current ? "勤務を継続" : "技能を学びながら求職";
    if (r.book.cash < 30000) r.standard = "frugal";
    else if (r.motive === "spending" && r.book.cash > 150000)
      r.standard = "comfortable";
    if (s.date.endsWith("-01") && r.book.cash < 60000) {
      const cheaper = properties
        .filter((p) => p.kind === "home" && p.homeStyle === "share")
        .sort((a, b) => quotedRent(s, a) - quotedRent(s, b))[0];
      if (
        quotedRent(s, cheaper) < quotedRent(s, site(s, r.homeId)) &&
        spend(s, r, 5000, "引越し費用")
      ) {
        r.homeId = cheaper.id;
        r.lastDecision = "家賃を抑える住み替え";
        news(
          s,
          "move",
          r.id,
          p.name +
            "が" +
            districts.find((d) => d.id === cheaper.districtId)!.name +
            "へ転居",
          cheaper.districtId,
        );
      }
    }
    if (
      r.motive === "enterprise" &&
      r.book.cash > 250000 &&
      !r.businessId &&
      p.skills.service >= 20
    ) {
      const empty = properties.find(
        (p) => p.kind === "shop" && vacant(s, p.id),
      );
      if (empty) {
        const capital = 120000;
        book(s, r, "小商いへの出資", { cash: -capital, equity: -capital });
        const f = makeFirm(
          s,
          "ai-startup-" + r.id + "-" + ++s.sequence,
          p.name + "の小商い",
          r.id,
          empty.id,
          "retail",
          capital,
        );
        f.strategy = "growth";
        f.legalForm = "sole";
        s.simulation.firms.push(f);
        r.businessId = f.id;
        r.lastDecision = "仕事と両立して小商いを開業";
        news(s, "startup", f.id, f.name + "が開業", empty.districtId);
      }
    }
  }
}
export function npcDay(s: GameState) {
  for (const p of s.npcs)
    if (!s.simulation.residents.some((r) => r.id === p.id))
      s.simulation.residents.push(
        resident(s, p.id, s.simulation.residents.length),
      );
  for (const r of s.simulation.residents) {
    const p = s.npcs.find((p) => p.id === r.id)!;
    const j = jobs.find((j) => j.id === r.jobId),
      f = s.simulation.firms.find((f) => f.id === j?.employerId);
    let work = 0,
      commute = 0,
      business = 0;
    if (j && f?.status === "active" && j.weekdays.includes(weekday(s.date))) {
      const trip = route(site(s, r.homeId), site(s, "work-" + j.id));
      const wage = effectiveJobWage(s, j) * j.hours;
      if (spend(s, f, wage, "NPC勤務賃金")) {
        book(s, r, "給与受取", { cash: wage, revenue: wage });
        r.income = wage;
        r.earned += wage;
        work = j.hours;
        commute = trip.hours * 2;
        spend(s, r, trip.fare * 2, "通勤交通費", true);
        p.skills[j.skill] = Math.min(100, p.skills[j.skill] + work * 0.06);
        p.experience[j.skill] += work;
        f.staffHours += work;
        r.contacts = [
          ...new Set([
            ...r.contacts,
            ...f.employees.filter((id) => id !== r.id),
            f.ownerId,
          ]),
        ].slice(-30);
      } else {
        changeJob(s, r, null);
      }
    } else r.income = 0;
    const v = s.ventures
      .flatMap((v) => v.employees)
      .find((e) => e.active && e.npcId === r.id);
    if (v && ![0, 6].includes(weekday(s.date))) work = v.hours;
    const own = s.simulation.firms.find(
      (f) => f.status === "active" && f.ownerId === r.id,
    );
    if (own) {
      business = Math.min(4, Math.max(0, 12 - work - commute));
      if (s.date.endsWith("-01") && own.book.cash > 200000) {
        const payout = Math.min(20000, Math.max(0, own.lastMonthProfit));
        if (payout) {
          book(s, own, "所有者配当", { cash: -payout, equity: -payout });
          book(s, r, "事業からの配当", { cash: payout, revenue: payout });
        }
      }
    }
    const study = Math.min(2, Math.max(0, 12 - work - commute - business));
    const skill =
      r.motive === "enterprise"
        ? "service"
        : r.motive === "income"
          ? "digital"
          : "craft";
    p.skills[skill] = Math.min(100, p.skills[skill] + study * 0.12);
    p.experience[skill] += study;
    const h = site(s, r.homeId),
      d = districts.find((d) => d.id === h.districtId)!;
    const living = Math.round(
      700 * standards[r.standard].factor * d.livingIndex * s.world.costIndex,
    );
    spend(s, r, living, "食費・日用品", true);
    r.consumed += living;
    if (s.date.endsWith("-01")) {
      const rent = quotedRent(s, h);
      spend(s, r, rent, "月額家賃", true);
      r.consumed += rent;
    }
    if (s.date.endsWith("-10")) spend(s, r, 4500, "光熱費", true);
    if (s.date.endsWith("-15")) spend(s, r, 2500, "通信費", true);
    settle(s, r);
    r.hours = {
      work,
      commute,
      study,
      business,
      sleep: 8,
      free: 16 - work - commute - study - business,
    };
    compact(r);
  }
}
export function closeFirm(s: GameState, f: AIFirm) {
  for (const id of [...f.employees]) {
    const r = s.simulation.residents.find((r) => r.id === id)!;
    changeJob(s, r, null);
  }
  for (const e of [...s.employments].filter((e) => e.employerId === f.id))
    quitJob(s, e.id);
  f.status = "closed";
  f.sites = [];
  f.lastUnits = 0;
  f.marketShare = 0;
  const value = Math.floor(f.book.equipment / 2);
  if (f.book.equipment)
    book(s, f, "設備清算", {
      cash: value,
      equipment: -f.book.equipment,
      expenses: f.book.equipment - value,
    });
  const owner = s.simulation.residents.find((r) => r.id === f.ownerId);
  if (owner?.businessId === f.id) {
    owner.businessId = null;
    owner.lastDecision = "撤退して次の仕事を探す";
  }
  const org = s.organizations.find((o) => o.id === f.id);
  if (org) org.cash = f.book.cash - f.book.debt;
  settle(s, f);
  news(s, "closure", f.id, f.name + "が資金難で撤退。残債務は帳簿に保持");
}
export function firmDecisions(s: GameState) {
  for (const f of s.simulation.firms.filter((f) => f.status === "active")) {
    f.decisions++;
    if (f.book.cash < 30000 && f.borrowed < f.creditLimit && f.lastProfit > 0) {
      const n = Math.min(50000, f.creditLimit - f.borrowed);
      book(s, f, "運転資金借入", { cash: n, debt: n });
      f.borrowed += n;
      news(s, "credit", f.id, f.name + "が運転資金を調達");
    }
    if (f.book.cash < 20000 || f.lossDays > 21) {
      const r = s.simulation.residents.find((r) => r.id === f.employees.at(-1));
      if (r) changeJob(s, r, null);
      if (f.sites.length > 1) {
        const id = f.sites.pop()!;
        news(
          s,
          "shrink",
          f.id,
          f.name + "が不採算拠点を閉鎖",
          site(s, id).districtId,
        );
      }
    }
    if (f.book.cash < 5000 && f.lossDays > 14) {
      closeFirm(s, f);
      continue;
    }
    const base = industryModules.get(f.industry)!.basePrice;
    const target =
      f.strategy === "quality" ? 1.25 : f.strategy === "value" ? 0.85 : 1;
    f.price = Math.round(
      clamp(
        f.price * (f.lastUnits < f.lastDemand * 0.4 ? 0.97 : 1.01),
        base * 0.65,
        base * target * 1.2,
      ),
    );
    f.advertising =
      f.book.cash > 80000
        ? Math.min(250, Math.max(0, Math.round(f.lastProfit * 0.08)))
        : 0;
    f.wageIndex = clamp(
      f.wageIndex + (openings(s, f) > 0 && f.lastProfit > 0 ? 0.002 : -0.001),
      0.85,
      1.5,
    );
    if (s.date.endsWith("-01")) {
      if (f.monthProfit > 15000 && f.book.cash > 180000 && f.book.debt === 0) {
        const empty = properties
          .filter(
            (p) =>
              (
                worldIndustries.get(f.industry)!.siteKinds ?? ["office"]
              ).includes(p.kind) &&
              (p.allowedIndustries.includes("*") ||
                p.allowedIndustries.includes(f.industry)) &&
              vacant(s, p.id),
          )
          .sort((a, b) => quotedRent(s, a) - quotedRent(s, b))[0];
        if (
          empty &&
          spend(s, f, quotedRent(s, empty) + 20000, "新規拠点開設")
        ) {
          f.sites.push(empty.id);
          f.capacity += 15;
          news(
            s,
            "opening",
            f.id,
            f.name + "が" + empty.name + "へ新規出店",
            empty.districtId,
          );
        }
        if (f.book.cash > 100000) {
          book(s, f, "設備投資", { cash: -10000, equipment: 10000 });
          f.capacity += 2;
          f.quality = Math.min(100, f.quality + 1);
        }
      }
      f.lastMonthProfit = f.monthProfit;
      f.monthProfit = 0;
    }
  }
}
export function firmDay(s: GameState) {
  for (const f of s.simulation.firms.filter((f) => f.status === "active")) {
    const before = f.dayOpeningProfit;
    const market = s.simulation.markets.find((m) => m.industry === f.industry);
    f.lastDemand = market?.allocations[f.id] ?? 0;
    const owner = s.simulation.residents.find((r) => r.id === f.ownerId);
    const owned = s.simulation.firms.filter(
      (x) => x.status === "active" && x.ownerId === f.ownerId,
    ).length;
    const hours =
      (owner?.hours.business ?? 0) / Math.max(1, owned) + f.staffHours;
    f.workCarry = Math.min(48, f.workCarry + hours);
    const model = worldIndustries.get(f.industry)!;
    const capacity = Math.min(
      f.capacity,
      Math.floor(
        ((model.carryWork ? f.workCarry : hours) / model.workHoursPerUnit) *
          (1 + Math.log1p(f.book.equipment / 10000) * 0.1),
      ),
    );
    const unitCost = Math.round(
      industryModules.get(f.industry)!.basePrice *
        s.world.costIndex *
        model.unitCostRatio *
        (1 - Math.min(0.12, Math.log2(Math.max(1, f.sites.length)) * 0.03)),
    );
    const units = Math.min(
      f.lastDemand,
      capacity,
      Math.floor(f.book.cash / Math.max(1, unitCost)),
    );
    if (units)
      book(s, f, "供給仕入・販売", {
        cash: units * (f.price - unitCost),
        revenue: units * f.price,
        expenses: units * unitCost,
      });
    if (model.carryWork)
      f.workCarry = Math.max(0, f.workCarry - units * model.workHoursPerUnit);
    else f.workCarry = 0;
    f.lastUnits = units;
    f.marketShare = market?.pool ? units / market.pool : 0;
    const rent = f.sites.reduce(
      (n, id) => n + quotedRent(s, site(s, id)) / 30,
      0,
    );
    spend(
      s,
      f,
      Math.round(
        rent +
          200 +
          f.sites.length * 100 +
          f.employees.length * 20 +
          f.book.equipment * 0.0002,
      ),
      "拠点・管理費",
      true,
    );
    if (f.advertising) spend(s, f, f.advertising, "広告");
    f.brand = Math.max(0, f.brand * 0.998 + Math.sqrt(f.advertising) / 100);
    if (f.book.debt)
      spend(
        s,
        f,
        Math.ceil((f.book.debt * s.simulation.interest) / 365),
        "借入・未払利息",
        true,
      );
    f.lastProfit = f.book.revenue - f.book.expenses - before;
    f.monthProfit += f.lastProfit;
    f.lossDays = f.lastProfit < 0 ? f.lossDays + 1 : 0;
    if (f.book.cash > 100000 && f.book.debt) {
      const n = Math.min(f.book.debt, f.book.cash - 100000);
      book(s, f, "債務返済", { cash: -n, debt: -n });
    }
    compact(f);
    const o = s.organizations.find((o) => o.id === f.id);
    if (o) {
      o.cash = f.book.cash - f.book.debt;
      o.dailyRevenue = units * f.price;
      o.dailyCost = units * unitCost + Math.round(rent + 200);
    }
  }
}
export function payroll(
  s: GameState,
  employerId: string,
  n: number,
  hours: number,
) {
  const f = s.simulation.firms.find((f) => f.id === employerId);
  if (f) {
    f.staffHours += hours;
    spend(s, f, n, "プレイヤー給与発生", true);
    const o = s.organizations.find((o) => o.id === f.id);
    if (o) o.cash = f.book.cash - f.book.debt;
  }
}
export function updateVacancies(s: GameState) {
  for (const v of s.vacancies) {
    const f = s.simulation.firms.find((f) => f.id === v.employerId);
    const j = jobs.find((j) => j.id === v.jobId)!;
    v.openings = f ? openings(s, f) : 0;
    v.competition = clamp(
      j.competition * (1 + s.simulation.unemployment * 3),
      0.1,
      100,
    );
    v.threshold = j.threshold + (f && f.book.cash < 100000 ? 3 : 0);
  }
}
export function economyMonth(s: GameState) {
  const sim = s.simulation;
  const active = sim.firms.filter((f) => f.status === "active");
  const seekers = sim.residents.filter(
    (r) =>
      !active.some((f) => f.ownerId === r.id) &&
      !s.ventures.some((v) =>
        v.employees.some((e) => e.active && e.npcId === r.id),
      ),
  );
  const individual = seekers.length
    ? seekers.filter((r) => r.jobId === null).length / seekers.length
    : 0;
  sim.unemployment = clamp(
    sim.unemployment * 0.85 + individual * 0.15,
    0.02,
    0.5,
  );
  const profitability = active.length
    ? active.reduce((n, f) => n + (f.lastProfit > 0 ? 1 : 0), 0) / active.length
    : 0;
  const target = clamp(
    1 + (profitability - 0.5) * 0.3 - (sim.unemployment - 0.05) * 0.7,
    0.55,
    1.5,
  );
  s.world.economy = clamp(s.world.economy * 0.9 + target * 0.1, 0.5, 1.6);
  s.world.costIndex = clamp(
    s.world.costIndex * (1 + (s.world.economy - 1) * 0.003),
    0.6,
    2,
  );
  sim.wage = clamp(sim.wage * (1 + (s.world.economy - 1) * 0.004), 0.7, 1.6);
  sim.income = Math.round(320000 * sim.wage * (1 - sim.unemployment * 0.5));
  sim.interest = clamp(
    0.025 + (s.world.costIndex - 1) * 0.02 + sim.unemployment * 0.05,
    0.01,
    0.12,
  );
  for (const d of sim.districts) {
    const firms = active.filter((f) =>
      f.sites.some((id) => site(s, id).districtId === d.id),
    );
    const occupied = firms.length;
    d.unemployment = clamp(
      sim.unemployment + (occupied < 2 ? 0.025 : -0.01),
      0.01,
      0.6,
    );
    d.demand = clamp(
      (1 - d.unemployment) * s.world.economy * (1 + occupied * 0.01),
      0.4,
      1.6,
    );
    d.rent = clamp(
      d.rent * (1 + (occupied - 3) * 0.0015 + (d.demand - 1) * 0.005),
      0.6,
      1.8,
    );
    d.wage = clamp(sim.wage * (1 + (occupied - 3) * 0.005), 0.7, 1.7);
    d.land = clamp(d.land * 0.98 + d.rent * 0.02, 0.5, 2);
    d.income = Math.round(
      sim.income * districts.find((x) => x.id === d.id)!.incomeIndex,
    );
    const change = Math.round(
      d.population * clamp((d.demand - 1) * 0.002, -0.002, 0.002),
    );
    d.population = Math.max(100, d.population + change);
  }
  // Households move toward employment and affordable housing. The transfer conserves census population.
  const sorted = [...sim.districts].sort(
    (a, b) => b.demand / b.rent - a.demand / a.rent,
  );
  const to = sorted[0],
    from = sorted.at(-1)!;
  const migrants = Math.min(100, Math.floor(from.population * 0.002));
  from.population -= migrants;
  to.population += migrants;
  s.world.population = sim.districts.reduce((n, d) => n + d.population, 0);
  sim.rent =
    sim.districts.reduce((n, d) => n + d.rent, 0) / sim.districts.length;
  news(
    s,
    "economy",
    "aoba",
    `青葉市：失業率${(sim.unemployment * 100).toFixed(1)}%、人口${s.world.population}人。企業稼働・雇用に基づく月次更新`,
  );
  if (migrants)
    news(
      s,
      "migration",
      "aoba",
      `${migrants}人の世帯が${districts.find((d) => d.id === from.id)!.name}から${districts.find((d) => d.id === to.id)!.name}へ移動`,
      to.id,
    );
  sim.history.push({
    date: s.date,
    population: s.world.population,
    unemployment: sim.unemployment,
    economy: s.world.economy,
    price: s.world.costIndex,
    income: sim.income,
    firms: active.length,
  });
  sim.history = sim.history.slice(-120);
}
export function beginWorldDay(s: GameState) {
  if (s.days > 0 && s.date.endsWith("-01")) economyMonth(s);
  if (s.days % 7 === 0 || s.date.endsWith("-01")) {
    firmDecisions(s);
    npcDecisions(s);
  }
  updateVacancies(s);
  snapshotMarkets(s);
  for (const f of s.simulation.firms) {
    f.dayOpeningProfit = f.book.revenue - f.book.expenses;
    f.staffHours = 0;
  }
  npcDay(s);
}
export function endWorldDay(s: GameState) {
  firmDay(s);
  updateVacancies(s);
}
export function verifySimulation(s: GameState) {
  const sim = s.simulation;
  if (
    !sim ||
    sim.districts.reduce((n, d) => n + d.population, 0) !== s.world.population
  )
    return false;
  const ids = [
    ...sim.firms.map((f) => f.id),
    ...sim.residents.map((r) => r.id),
  ];
  if (new Set(ids).size !== ids.length) return false;
  if (
    new Set(sim.districts.map((d) => d.id)).size !== districts.length ||
    sim.districts.some(
      (d) =>
        !districts.some((x) => x.id === d.id) ||
        Math.abs(
          d.ageShares.young + d.ageShares.working + d.ageShares.senior - 1,
        ) > 1e-8,
    )
  )
    return false;
  const employees = [
    ...sim.firms.flatMap((f) => f.employees),
    ...s.ventures.flatMap((v) =>
      v.employees.filter((e) => e.active).map((e) => e.npcId),
    ),
  ];
  if (new Set(employees).size !== employees.length) return false;
  if (
    s.sequence <
    Math.max(
      0,
      ...sim.news.map((n) => n.id),
      ...[...sim.firms, ...sim.residents].flatMap((a) =>
        a.journal.map((e) => e.id),
      ),
    )
  )
    return false;
  const sites = sim.firms
    .filter((f) => f.status === "active")
    .flatMap((f) => f.sites);
  if (
    new Set(sites).size !== sites.length ||
    s.spatial.leases.some((l) => sites.includes(l.propertyId))
  )
    return false;
  if (
    sim.firms.some(
      (f) =>
        !worldIndustries.has(f.industry) ||
        !industryModules.has(f.industry) ||
        !verifyAccounts(f) ||
        !s.npcs.some((p) => p.id === f.ownerId) ||
        f.borrowed > f.creditLimit ||
        (f.status === "closed" &&
          (f.sites.length > 0 || f.employees.length > 0)) ||
        f.sites.some((id) => !properties.some((p) => p.id === id)) ||
        f.employees.some(
          (id) =>
            !sim.residents.some(
              (r) =>
                r.id === id &&
                jobs.find((j) => j.id === r.jobId)?.employerId === f.id,
            ),
        ),
    )
  )
    return false;
  if (
    sim.residents.some(
      (r) =>
        !verifyAccounts(r) ||
        !s.npcs.some((p) => p.id === r.id) ||
        !properties.some((p) => p.id === r.homeId && p.kind === "home") ||
        Object.values(r.hours).some((n) => n < 0) ||
        Math.abs(Object.values(r.hours).reduce((n, h) => n + h, 0) - 24) >
          1e-8 ||
        (r.jobId !== null &&
          !sim.firms.some(
            (f) =>
              f.status === "active" &&
              f.employees.includes(r.id) &&
              jobs.find((j) => j.id === r.jobId)?.employerId === f.id,
          )),
    )
  )
    return false;
  return sim.markets.every(
    (m) =>
      industryModules.has(m.industry) &&
      Object.keys(m.allocations).every(
        (id) =>
          sim.firms.some((f) => f.id === id) ||
          s.ventures.some((v) => v.id === id),
      ) &&
      Object.values(m.allocations).reduce((n, q) => n + q, 0) <= m.pool,
  );
}

export const residentNetWorth = (s: GameState, r: Resident) =>
  r.book.cash +
  r.book.inventory +
  r.book.equipment +
  r.book.receivables -
  r.book.debt +
  s.simulation.firms
    .filter((f) => f.ownerId === r.id)
    .reduce(
      (n, f) =>
        n +
        (f.legalForm === "sole"
          ? f.book.cash + f.book.equipment - f.book.debt
          : Math.max(0, f.book.cash + f.book.equipment - f.book.debt)),
      0,
    );
