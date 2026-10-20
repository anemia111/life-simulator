import { industryModules } from "../enterprise/registry";
import type { GameState } from "../types";
import type { Simulation, AIFirm, Resident, Motive } from "./types";
import { accounts, book } from "../enterprise/accounting";
import { jobs } from "../catalog/jobs";
import { properties, districts } from "../spatial/catalog";
import { createPerson } from "../person";
export const motives: Record<Motive, string> = {
  stability: "安定志向",
  income: "高収入志向",
  enterprise: "起業志向",
  spending: "消費志向",
  saving: "貯蓄志向",
  mobility: "転職積極型",
};
export function resident(s: GameState, id: string, index: number): Resident {
  const a: Resident = {
    ...accounts(),
    id,
    homeId: districts[index % districts.length].id + "-share",
    motive: (Object.keys(motives) as Motive[])[index % 6],
    goal: ["生活費6か月分の貯金", "技能を高めて転職", "自分の小商い"][
      index % 3
    ],
    standard: "balanced",
    jobId: null,
    income: 0,
    earned: 0,
    consumed: 0,
    changes: 0,
    lastDecision: "生活を始める",
    hours: { work: 0, commute: 0, study: 0, business: 0, sleep: 8, free: 16 },
    contacts: [],
    businessId: null,
  };
  book(s, a, "開始時の資産", {
    cash: 80000 + (index % 5) * 30000,
    equity: 80000 + (index % 5) * 30000,
  });
  return a;
}
export function makeFirm(
  s: GameState,
  id: string,
  name: string,
  ownerId: string,
  site: string,
  industry = "retail",
  capital = 500000,
): AIFirm {
  const f: AIFirm = {
    ...accounts(),
    id,
    name,
    industry,
    ownerId,
    founded: s.date,
    legalForm: "company",
    strategy: "value",
    status: "active",
    sites: [site],
    employees: [],
    price: industryModules.get(industry)?.basePrice ?? 700,
    quality: 55,
    brand: 3,
    wageIndex: 1,
    advertising: 0,
    capacity: 40,
    lossDays: 0,
    creditLimit: 150000,
    borrowed: 0,
    lastProfit: 0,
    monthProfit: 0,
    lastMonthProfit: 0,
    staffHours: 0,
    workCarry: 0,
    dayOpeningProfit: 0,
    lastDemand: 0,
    lastUnits: 0,
    marketShare: 0,
    decisions: 0,
  };
  book(s, f, "開始時の企業資産", {
    cash: Math.max(0, capital),
    debt: Math.max(0, -capital),
    equity: capital,
  });
  return f;
}
export function initialSimulation(s: GameState, seed = 4172026): Simulation {
  const sim: Simulation = {
    seed,
    randomState: seed,
    firms: [],
    residents: [],
    districts: districts.map((d) => ({
      id: d.id,
      ageShares:
        d.id === "campus"
          ? { young: 0.6, working: 0.3, senior: 0.1 }
          : d.id === "office"
            ? { young: 0.15, working: 0.75, senior: 0.1 }
            : d.id === "hill"
              ? { young: 0.15, working: 0.5, senior: 0.35 }
              : { young: 0.2, working: 0.6, senior: 0.2 },
      population: d.nightPopulation,
      income: 320000 * d.incomeIndex,
      unemployment: 0.05,
      rent: 1,
      wage: 1,
      land: 1,
      demand: 1,
    })),
    markets: [],
    news: [],
    interest: 0.03,
    unemployment: 0.05,
    income: 320000,
    wage: 1,
    rent: 1,
    history: [],
  };
  // Scale census districts to the saved city total without changing player funds.
  const total = sim.districts.reduce((n, d) => n + d.population, 0);
  let remaining = s.world.population;
  sim.districts.forEach((d, i) => {
    d.population =
      i === sim.districts.length - 1
        ? remaining
        : Math.floor((d.population * s.world.population) / total);
    remaining -= d.population;
  });
  for (let i = 0; i < 18; i++) {
    const id = "resident-" + i;
    if (!s.npcs.some((p) => p.id === id))
      s.npcs.push({
        ...createPerson(
          ["青木", "松本", "井上", "加藤", "渡辺", "吉田"][i % 6] +
            " " +
            ["はる", "りく", "そら"][Math.floor(i / 6)],
        ),
        id,
        birthDate: 1990 + i + "-05-10",
        skills: { service: 10 + i, craft: 8 + i, digital: 5 + i },
        employerId: null,
      });
  }
  s.npcs.forEach((p, i) => sim.residents.push(resident(s, p.id, i)));
  for (const [i, j] of jobs.entries()) {
    const o = s.organizations.find((o) => o.id === j.employerId)!;
    const f = makeFirm(
      s,
      o.id,
      o.name,
      o.ownerId,
      "work-" + j.id,
      j.skill === "digital"
        ? "software"
        : j.skill === "craft"
          ? "freelance"
          : "retail",
      o.cash,
    );
    f.strategy = (["value", "quality", "growth"] as const)[i % 3];
    f.quality = 40 + (i % 5) * 10;
    f.price = Math.round(f.price * (0.8 + (i % 4) * 0.2));
    sim.firms.push(f);
  }
  for (const [i, p] of properties
    .filter((p) => p.kind === "competitor")
    .entries()) {
    const owner = s.npcs[i % s.npcs.length].id;
    const f = makeFirm(
      s,
      p.tenantId!,
      "青葉" + districts[i].name + "商会",
      owner,
      p.id,
      p.industry ?? "retail",
      200000 + i * 60000,
    );
    f.quality = 35 + i * 8;
    f.price = 500 + i * 150;
    f.strategy = i % 2 ? "growth" : "quality";
    sim.firms.push(f);
  }
  return sim;
}
