import type { GameState } from "../types";
import type {
  SecuritiesState,
  WorldFirm,
  Instrument,
  FinancialRelease,
} from "./types";
import { accounts, book, nav } from "../enterprise/accounting";
import { sectorModels, regions, companyIdentity } from "./catalog";
import { createAccount, addPosition, marketCash, account } from "./ledger";
export function initialSecurities(s: GameState): SecuritiesState {
  const x: SecuritiesState = {
    firms: [],
    instruments: [],
    accounts: [],
    orders: [],
    trades: [],
    indices: [],
    funds: [],
    offerings: [],
    external: accounts(),
    broker: accounts(),
    openingCash: 0,
    netTransfers: 0,
    sectorDemand: {},
    news: [],
    reinvestments: [],
    plans: [],
    started: s.date,
    lastAccountingDate: s.date,
    lastRun: "",
    localReports: {},
    localFinancials: {},
  };
  s.securities = x;
  book(s, x.external, "集計外部部門の開始資産", {
    cash: 500000000000000,
    equity: 500000000000000,
  });
  createAccount(s, "player", s.person.name + " 証券口座", "player", "player");
  for (const [i, strategy] of (
    ["value", "growth", "income", "cautious"] as const
  ).entries()) {
    const a = createAccount(
      s,
      "institution-" + i,
      ["蒼環長期運用", "星稜成長基金", "環海配当運用", "白樹安定基金"][i],
      "institution",
      "institution-" + i,
      strategy,
    );
    book(s, a, "運用開始資本", { cash: 5000000000, equity: 5000000000 });
  }
  let index = 0;
  for (const model of sectorModels.values()) {
    x.sectorDemand[model.id] = 1;
    for (let region = 0; region < regions.length; region++) {
      const identity = companyIdentity(index, region),
        id = "world-" + region + "-" + index,
        seed =
          ((s.simulation.seed >>> 0) + (index + 1) * 7919 + region * 104729) >>>
          0;
      const scale = 1 + (seed % 5),
        capacity = 15000 * scale,
        unitPrice = Math.round(model.price * (0.85 + (seed % 31) / 100)),
        monthly = capacity * unitPrice,
        cash = monthly * 3,
        equipment = Math.round(monthly * model.capital),
        shares = 100000;
      const f: WorldFirm = {
        ...accounts(),
        id,
        instrumentId: "stock-" + id,
        ...{ name: identity.name },
        region: regions[region].id,
        headquarters: regions[region].city,
        founded: 1960 + (seed % 60),
        sector: model.id,
        business: model.name + "の製品・サービス",
        employees: Math.max(
          100,
          Math.floor(capacity * (model.family === "technology" ? 0.04 : 0.12)),
        ),
        strategy: (["value", "quality", "growth"] as const)[seed % 3],
        quality: 45 + (seed % 46),
        capacity,
        unitPrice,
        growthStage: 0.7 + (seed % 61) / 100,
        international: 0.25 + (seed % 61) / 100,
        marketShare: 0.2,
        monthRevenue: 0,
        monthProfit: 0,
        quarterRevenue: 0,
        quarterProfit: 0,
        quarterCosts: 0,
        quarterCashFlow: 0,
        quarterRD: 0,
        quarterCapex: 0,
        previousRevenue: monthly * 3,
        published: [],
        pending: [],
        status: "active",
        lossMonths: 0,
      };
      book(s, f, "上場企業の開始資産", {
        cash,
        equipment,
        equity: cash + equipment,
      });
      const price = Math.max(
        100,
        Math.floor((cash + equipment + monthly * model.margin * 36) / shares),
      );
      const release: FinancialRelease = {
        period: s.date.slice(0, 7) + " 開始開示",
        published: s.date,
        revenue: monthly * 3,
        operatingProfit: Math.round(monthly * 3 * model.margin),
        netIncome: Math.round(monthly * 3 * model.margin * 0.9),
        assets: cash + equipment,
        debt: 0,
        cash,
        shares,
        eps: Math.floor((monthly * 3 * model.margin * 0.9) / shares),
        growth: model.growth * f.growthStage,
        forecast: Math.round(monthly * 3 * (1 + model.growth)),
        dividendPerShare: 0,
        cashFlow: Math.round(monthly * 3 * model.margin * 0.9),
        rd: Math.round(monthly * 3 * model.rd),
        capex: 0,
      };
      f.published = [release];
      x.firms.push(f);
      x.instruments.push({
        id: f.instrumentId,
        ticker: identity.ticker,
        name: f.name,
        kind: "stock",
        issuerId: id,
        fundId: null,
        exchangeId: region % 2 ? "meridian" : "aurora",
        shares,
        price,
        previousClose: price,
        reference: price,
        volume: 0,
        listed: s.date,
        status: "listed",
        history: [],
      });
      const founder = createAccount(
        s,
        "founder-" + id,
        f.name + "創業持分",
        "founder",
        "founder-" + id,
      );
      addPosition(s, founder, f.instrumentId, 60000, price * 60000, true);
      for (let i = 0; i < 4; i++)
        addPosition(
          s,
          account(s, "institution-" + i),
          f.instrumentId,
          8750,
          price * 8750,
          true,
        );
    }
    index++;
  }
  const stockIds = x.instruments.map((i) => i.id);
  for (const [id, name, members] of [
    ["all", "環海主要企業指数", stockIds],
    [
      "tech",
      "暁星技術企業指数",
      x.firms
        .filter((f) => sectorModels.get(f.sector)!.family === "technology")
        .map((f) => f.instrumentId),
    ],
    [
      "income",
      "白樹生活・基盤指数",
      x.firms
        .filter((f) =>
          ["consumer", "resources"].includes(
            sectorModels.get(f.sector)!.family,
          ),
        )
        .map((f) => f.instrumentId),
    ],
  ] as [string, string, string[]][]) {
    const cap = x.instruments
      .filter((i) => members.includes(i.id))
      .reduce((n, i) => n + i.price * i.shares, 0);
    x.indices.push({
      id,
      name,
      members,
      divisor: cap / 1000,
      value: 1000,
      history: [],
    });
  }
  for (const kind of ["etf", "mutual"] as const) {
    const id = "fund-" + kind,
      a = createAccount(
        s,
        id,
        kind === "etf" ? "環海225 ETF" : "環海225 積立投信",
        "fund",
        id,
        "index",
      );
    book(s, a, "ファンド開始現金", { cash: 50000000, equity: 50000000 });
    for (const i of x.instruments.filter((i) => i.kind === "stock"))
      addPosition(s, a, i.id, 2500, 2500 * i.price, true);
    const units = kind === "mutual" ? 10000000 : 100000,
      price = Math.floor(nav(a) / units);
    x.funds.push({
      id,
      accountId: id,
      instrumentId: id,
      indexId: "all",
      name: a.name,
      kind,
      feeBps: kind === "etf" ? 12 : 25,
      distributed: 0,
      feesAccrued: 0,
    });
    x.instruments.push({
      id,
      ticker: kind === "etf" ? "LSF001" : "LSF002",
      name: a.name,
      kind,
      issuerId: null,
      fundId: id,
      exchangeId: "aurora",
      shares: units,
      price,
      previousClose: price,
      reference: price,
      volume: 0,
      listed: s.date,
      status: "listed",
      history: [],
    });
    for (let n = 0; n < 4; n++)
      addPosition(
        s,
        account(s, "institution-" + n),
        id,
        units / 4,
        price * (units / 4),
        true,
      );
  }
  x.openingCash = marketCash(s);
  return x;
}
