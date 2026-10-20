import { goalRegistry } from "../engine/goals";
import { residentNetWorth } from "../engine/simulation";
import { useState } from "react";
import type { GameState } from "../engine/types";
import { districts, properties } from "../engine/spatial/catalog";
import { jobs } from "../engine/career";
import { age } from "../engine/person";
import { motives } from "../engine/simulation/initial";
import { effectiveJobWage } from "../engine/simulation/market";
import { nav, profit } from "../engine/enterprise/accounting";
import { actionUnavailable } from "../engine/actions";
import { useGame } from "../store";
import "../phase4.css";
const yen = (v: number) => "¥" + Math.round(v).toLocaleString("ja-JP");
const pct = (n: number) => (n * 100).toFixed(1) + "%";
const sectors: Record<string, string> = {
  retail: "小売・地域サービス",
  freelance: "受託・制作",
  software: "ソフトウェア",
};
const eventNames: Record<string, string> = {
  hire: "採用",
  dismiss: "雇用終了",
  "job-change": "転職",
  move: "転居",
  startup: "創業",
  closure: "撤退",
  opening: "出店",
  shrink: "縮小",
  credit: "資金調達",
  economy: "都市経済",
  migration: "人口移動",
};
const strategies = {
  value: "価格重視",
  quality: "品質重視",
  growth: "成長重視",
};
function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="world-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
export default function WorldPanel({
  g,
  go,
}: {
  g: GameState;
  go: (id: string) => void;
}) {
  const [tab, setTab] = useState("economy"),
    [firmId, setFirm] = useState(g.simulation.firms[0]?.id ?? ""),
    [personId, setPerson] = useState(g.simulation.residents[0]?.id ?? "");
  const sim = g.simulation,
    firm = sim.firms.find((f) => f.id === firmId),
    r = sim.residents.find((r) => r.id === personId),
    person = g.npcs.find((p) => p.id === personId);
  const active = sim.firms.filter((f) => f.status === "active");
  const tabs = [
    ["economy", "都市経済"],
    ["firms", "競合企業"],
    ["people", "NPC・暮らし"],
    ["labor", "労働市場"],
    ["market", "市場シェア"],
    ["news", "企業ニュース"],
  ];
  return (
    <div className="world-page">
      <header className="world-heading">
        <div>
          <span className="eyebrow">A LIVING CITY · PHASE 4</span>
          <h1>街は、今日も動いている。</h1>
          <p>働く人、変わるお店、あなたの次の選択。{g.date} 時点の青葉市。</p>
        </div>
        <button className="outline" onClick={() => go("map")}>
          都市マップへ ↗
        </button>
      </header>
      <div className="world-metrics">
        <Metric
          label="都市人口"
          value={g.world.population.toLocaleString() + "人"}
          sub="一般住民は地区別集計"
        />
        <Metric
          label="失業率"
          value={pct(sim.unemployment)}
          sub="月次の雇用と企業稼働を反映"
        />
        <Metric
          label="活動中のAI企業"
          value={active.length + "社"}
          sub={
            sim.firms.filter((f) => f.status === "closed").length + "社が撤退"
          }
        />
        <Metric
          label="景気指数"
          value={g.world.economy.toFixed(3)}
          sub={"物価 ×" + g.world.costIndex.toFixed(3)}
        />
      </div>
      <div className="world-tabs" role="tablist" aria-label="世界の情報">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "economy" && (
        <>
          <section className="world-card">
            <div className="world-section-head">
              <div>
                <h2>地域の現在地</h2>
                <p>
                  雇用、店舗稼働、所得から月次で更新されます。契約済み家賃は固定、新規入居には相場を適用。
                </p>
              </div>
              <span className="tag">MONTHLY CENSUS</span>
            </div>
            <div className="world-table-wrap">
              <table className="world-table">
                <thead>
                  <tr>
                    <th>地区</th>
                    <th>人口</th>
                    <th>平均月収</th>
                    <th>失業率</th>
                    <th>賃金</th>
                    <th>家賃</th>
                    <th>需要</th>
                  </tr>
                </thead>
                <tbody>
                  {sim.districts.map((d) => (
                    <tr key={d.id}>
                      <th>{districts.find((x) => x.id === d.id)!.name}</th>
                      <td>{d.population.toLocaleString()}</td>
                      <td>{yen(d.income)}</td>
                      <td>{pct(d.unemployment)}</td>
                      <td>×{d.wage.toFixed(3)}</td>
                      <td>×{d.rent.toFixed(3)}</td>
                      <td>×{d.demand.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="world-two">
            <section className="world-card">
              <h2>所得と金融環境</h2>
              <dl className="world-details">
                <dt>平均月収</dt>
                <dd>{yen(sim.income)}</dd>
                <dt>金利（年率・ゲーム内）</dt>
                <dd>{pct(sim.interest)}</dd>
                <dt>記録</dt>
                <dd>{sim.history.length}か月</dd>
                <dt>個別に暮らすNPC</dt>
                <dd>{sim.residents.length}人</dd>
              </dl>
              <p>
                個別NPCの雇用を代表サンプルとして、集計住民の景気・消費・人口移動へ反映します。
              </p>
            </section>
            <section className="world-card">
              <h2>街の動き</h2>
              {sim.news.slice(0, 4).map((n) => (
                <p className="world-news-mini" key={n.id}>
                  <time>{n.date}</time>
                  {n.text}
                </p>
              ))}
              {!sim.news.length && (
                <p>
                  日付を進めると、採用・出退店・地域経済の変化がここに届きます。
                </p>
              )}
              <button className="outline" onClick={() => setTab("news")}>
                ニュースを読む →
              </button>
            </section>
          </div>
          <section className="world-card">
            <h2>月ごとの変化</h2>
            <div className="world-table-wrap">
              <table className="world-table">
                <thead>
                  <tr>
                    <th>年月</th>
                    <th>人口</th>
                    <th>失業率</th>
                    <th>景気</th>
                    <th>物価</th>
                    <th>企業数</th>
                  </tr>
                </thead>
                <tbody>
                  {sim.history
                    .slice(-12)
                    .reverse()
                    .map((h) => (
                      <tr key={h.date}>
                        <td>{h.date}</td>
                        <td>{h.population.toLocaleString()}</td>
                        <td>{pct(h.unemployment)}</td>
                        <td>{h.economy.toFixed(3)}</td>
                        <td>{h.price.toFixed(3)}</td>
                        <td>{h.firms}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!sim.history.length && <p>最初の月次更新は翌月1日です。</p>}
          </section>
        </>
      )}
      {tab === "firms" && (
        <div className="world-split">
          <section className="world-card">
            <h2>競争する経済主体</h2>
            <p>現金・借入・設備と実際の需要をもとに経営します。</p>
            <div className="world-entity-list">
              {sim.firms.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFirm(f.id)}
                  aria-pressed={firmId === f.id}
                >
                  <span>
                    <strong>{f.name}</strong>
                    <small>
                      {sectors[f.industry]} ·{" "}
                      {f.status === "active" ? f.sites.length + "拠点" : "撤退"}
                    </small>
                  </span>
                  <b className={f.lastProfit < 0 ? "world-negative" : ""}>
                    {yen(f.lastProfit)}
                    <small>直近日利益</small>
                  </b>
                </button>
              ))}
            </div>
          </section>
          {firm && (
            <section className="world-card world-detail">
              <span className="eyebrow">COMPANY PROFILE</span>
              <h2>{firm.name}</h2>
              <p>
                {firm.legalForm === "sole" ? "個人事業" : "法人"} ·{" "}
                {strategies[firm.strategy]} · 設立 {firm.founded}
              </p>
              <dl className="world-details">
                <dt>経営者</dt>
                <dd>
                  <button
                    className="world-text-button"
                    onClick={() => {
                      setPerson(firm.ownerId);
                      setTab("people");
                    }}
                  >
                    {g.npcs.find((p) => p.id === firm.ownerId)?.name}
                  </button>
                </dd>
                <dt>現金</dt>
                <dd>{yen(firm.book.cash)}</dd>
                <dt>純資産</dt>
                <dd>{yen(nav(firm))}</dd>
                <dt>借入・未払</dt>
                <dd>{yen(firm.book.debt)}</dd>
                <dt>信用限度 / 累計借入</dt>
                <dd>
                  {yen(firm.creditLimit)} / {yen(firm.borrowed)}
                </dd>
                <dt>累計売上 / 利益</dt>
                <dd>
                  {yen(firm.book.revenue)} / {yen(profit(firm))}
                </dd>
                <dt>販売価格 / 品質</dt>
                <dd>
                  {yen(firm.price)} / {firm.quality.toFixed(0)}
                </dd>
                <dt>従業員</dt>
                <dd>{firm.employees.length}人</dd>
                <dt>需要 / 実売</dt>
                <dd>
                  {firm.lastDemand} / {firm.lastUnits}
                </dd>
                <dt>業界市場シェア</dt>
                <dd>{pct(firm.marketShare)}</dd>
                <dt>経営判断</dt>
                <dd>{firm.decisions}回</dd>
              </dl>
              <h3>営業拠点</h3>
              {firm.sites.map((id) => (
                <p key={id}>{properties.find((p) => p.id === id)?.name}</p>
              ))}
              <h3>直近の取引</h3>
              {firm.journal
                .slice(-5)
                .reverse()
                .map((e) => (
                  <p className="world-news-mini" key={e.id}>
                    <time>{e.date}</time>
                    {e.label} / 現金 {yen(e.delta.cash)}
                  </p>
                ))}
            </section>
          )}
        </div>
      )}
      {tab === "people" && (
        <div className="world-split">
          <section className="world-card">
            <h2>それぞれの人生</h2>
            <div className="world-entity-list">
              {sim.residents.map((a) => {
                const p = g.npcs.find((p) => p.id === a.id)!;
                return (
                  <button
                    key={a.id}
                    onClick={() => setPerson(a.id)}
                    aria-pressed={personId === a.id}
                  >
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {motives[a.motive]} · {age(p, g.date)}歳
                      </small>
                    </span>
                    <span>
                      {a.jobId
                        ? "勤務中"
                        : sim.firms.some(
                              (f) =>
                                f.ownerId === a.id && f.status === "active",
                            )
                          ? "経営者"
                          : "求職・学習"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
          {r && person && (
            <section className="world-card world-detail">
              <span className="eyebrow">A LIFE IN AOBA</span>
              <h2>{person.name}</h2>
              <button className="outline" onClick={() => go("journey")}>
                人物の目標・人生年表を見る
              </button>
              <p>
                {age(person, g.date)}歳 · {motives[r.motive]}
              </p>
              <dl className="world-details">
                <dt>住居</dt>
                <dd>{properties.find((p) => p.id === r.homeId)?.name}</dd>
                <dt>職業</dt>
                <dd>{person.occupation}</dd>
                <dt>勤務先</dt>
                <dd>
                  {sim.firms.find((f) => f.id === person.employerId)?.name ??
                    g.ventures.find((v) => v.id === person.employerId)?.name ??
                    "―"}
                </dd>
                <dt>現金 / 負債</dt>
                <dd>
                  {yen(r.book.cash)} / {yen(r.book.debt)}
                </dd>
                <dt>純資産</dt>
                <dd>{yen(residentNetWorth(g, r))}</dd>
                <dt>直近の給与（日額）</dt>
                <dd>{yen(r.income)}</dd>
                <dt>接客 / 制作 / デジタル</dt>
                <dd>
                  {Object.values(person.skills)
                    .map((n) => n.toFixed(1))
                    .join(" / ")}
                </dd>
                <dt>目標</dt>
                <dd>
                  {g.social.goals
                    .filter((v) => v.actorId === r.id && v.status === "active")
                    .map((v) => goalRegistry.get(v.definitionId)!.name)
                    .join(" / ") || "目標を達成し、日々を暮らす"}
                </dd>
                <dt>生活水準</dt>
                <dd>
                  {
                    { frugal: "節約", balanced: "標準", comfortable: "ゆとり" }[
                      r.standard
                    ]
                  }
                </dd>
                <dt>直近の判断</dt>
                <dd>{r.lastDecision}</dd>
                <dt>就職・転職</dt>
                <dd>{r.changes}回</dd>
                <dt>知人</dt>
                <dd>{r.contacts.length}人</dd>
              </dl>
              <h3>直近の24時間</h3>
              <p>
                勤務 {r.hours.work}h / 通勤 {r.hours.commute}h / 学習{" "}
                {r.hours.study}h / 事業 {r.hours.business}h / 睡眠{" "}
                {r.hours.sleep}h / 生活・自由 {r.hours.free}h
              </p>
              <button
                className="primary"
                disabled={!!actionUnavailable(g, "meet-npc", { id: r.id })}
                onClick={() =>
                  useGame.getState().act({
                    type: "execute",
                    actionId: "meet-npc",
                    target: { id: r.id },
                  })
                }
              >
                {g.relationships.some((x) => x.npcId === r.id)
                  ? "1時間交流する"
                  : "地域で会って知り合う（1時間）"}
              </button>
              <p>
                {actionUnavailable(g, "meet-npc", { id: r.id }) ??
                  "移動と交流で信頼を育て、採用点・勤務評価に反映します。"}
              </p>
            </section>
          )}
        </div>
      )}
      {tab === "labor" && (
        <section className="world-card">
          <h2>企業が必要としている仕事</h2>
          <p>採用余力・既存スタッフ・資金状況に応じて募集枠が変わります。</p>
          <div className="world-table-wrap">
            <table className="world-table">
              <thead>
                <tr>
                  <th>企業・職種</th>
                  <th>地区</th>
                  <th>時給換算</th>
                  <th>募集枠</th>
                  <th>NPC従業員</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <th>
                      {j.company}
                      <small>{j.name}</small>
                    </th>
                    <td>
                      {
                        districts.find(
                          (d) =>
                            d.id ===
                            properties.find((p) => p.id === "work-" + j.id)
                              ?.districtId,
                        )?.name
                      }
                    </td>
                    <td>{yen(effectiveJobWage(g, j))}</td>
                    <td>
                      {g.vacancies.find((v) => v.jobId === j.id)?.openings ?? 0}
                    </td>
                    <td>
                      {sim.firms.find((f) => f.id === j.employerId)?.employees
                        .length ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="primary" onClick={() => go("career")}>
            求人を比較して応募する →
          </button>
        </section>
      )}
      {tab === "market" && (
        <div className="world-market-grid">
          {sim.markets.map((m) => (
            <section key={m.industry} className="world-card">
              <h2>{sectors[m.industry] ?? m.industry}</h2>
              <p>
                一日の市場規模 {m.pool}件 · 未充足・背景供給{" "}
                {m.pool -
                  Object.values(m.allocations).reduce((n, v) => n + v, 0)}
                件
              </p>
              {Object.entries(m.allocations)
                .sort((a, b) => b[1] - a[1])
                .map(([id, n]) => (
                  <div className="world-share" key={id}>
                    <div>
                      <span>
                        {sim.firms.find((f) => f.id === id)?.name ??
                          g.ventures.find((v) => v.id === id)?.name}
                      </span>
                      <b>
                        {n}件 · {pct(n / Math.max(1, m.pool))}
                      </b>
                    </div>
                    <meter min={0} max={m.pool || 1} value={n} />
                  </div>
                ))}
              <p>
                配分は潜在需要です。実売は在庫・労働時間・資金によって制約されます。
              </p>
            </section>
          ))}
          {!sim.markets.length && (
            <section className="world-card">
              <p>1日進めると、実際の市場配分が表示されます。</p>
            </section>
          )}
        </div>
      )}
      {tab === "news" && (
        <section className="world-card">
          <h2>青葉ビジネス・生活通信</h2>
          <p>
            実際の採用、出退店、創業、人口移動、経済更新から発行。直近120件を保持します。
          </p>
          <ol className="world-news-list">
            {sim.news.map((n) => (
              <li key={n.id}>
                <time>{n.date}</time>
                <div>
                  <span className="tag">
                    {eventNames[n.kind] ?? "企業の変化"}
                  </span>
                  <p>{n.text}</p>
                  {n.districtId && (
                    <small>
                      {districts.find((d) => d.id === n.districtId)?.name}
                    </small>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {!sim.news.length && (
            <p>
              まだニュースはありません。日付を進めて街の変化を見守りましょう。
            </p>
          )}
        </section>
      )}
      <p className="world-footnote">
        一般住民・外部の家主・仕入先・銀行は集計モデル。共同創業交渉、M&A、多都市は未実装です。シード{" "}
        {sim.seed}。
      </p>
    </div>
  );
}
