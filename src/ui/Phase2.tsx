import {
  businessProperties,
  district,
  properties,
} from "../engine/spatial/selectors";
import { useState } from "react";
import type { ReactNode } from "react";
import type { GameState } from "../engine/types";
import type {
  Enterprise,
  EnterpriseInput,
  Accounts,
} from "../engine/enterprise/types";
import {
  industryModules,
  regions,
  products,
  nav,
  profit,
  companyNAV,
  companyProfit,
  companyVentures,
  verifyAccounts,
  consolidatedBook,
  companyMonths,
  shareValue,
  personalEnterpriseMonths,
} from "../engine/enterprise";
import { liquid, netWorth } from "../engine/finance";
import { useGame } from "../store";
import {
  Building2,
  Store,
  ArrowUpRight,
  Package,
  Users,
  BarChart3,
  Wallet,
  Plus,
  BriefcaseBusiness,
} from "lucide-react";
const yen = (n: number) => "¥" + Math.round(n).toLocaleString("ja-JP");
const operation = (input: EnterpriseInput) =>
  useGame.getState().act({ type: "enterprise", input });
function Card({ children }: { children: ReactNode }) {
  return <section className="card enterprise-card">{children}</section>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="enterprise-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Stats({ items }: { items: [string, string][] }) {
  return (
    <div className="enterprise-stats">
      {items.map(([label, value]) => (
        <div key={label}>
          <small>{label}</small>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
function Amount({
  label,
  button,
  onSubmit,
  initial = 10000,
}: {
  label: string;
  button: string;
  onSubmit: (n: number) => void;
  initial?: number;
}) {
  const [n, set] = useState(initial);
  return (
    <form
      className="enterprise-inline"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(n);
      }}
    >
      <Field label={label}>
        <input
          type="number"
          min="0"
          step="1"
          value={n}
          onChange={(e) => set(Number(e.target.value))}
        />
      </Field>
      <button type="submit" className="btn secondary">
        {button}
      </button>
    </form>
  );
}
function Monthly({
  reports,
}: {
  reports: {
    month: string;
    revenue: number;
    expenses: number;
    cashFlow: number;
    funding: number;
  }[];
}) {
  return (
    <div className="enterprise-scroll">
      <table>
        <thead>
          <tr>
            <th>年月</th>
            <th>売上</th>
            <th>費用</th>
            <th>利益</th>
            <th>現金増減</th>
            <th>出資・回収・分配</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((m, i) => (
            <tr key={m.month + i}>
              <td>{m.month}</td>
              <td>{yen(m.revenue)}</td>
              <td>{yen(m.expenses)}</td>
              <td>{yen(m.revenue - m.expenses)}</td>
              <td>{yen(m.cashFlow)}</td>
              <td>{yen(m.funding)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Books({ account }: { account: Accounts }) {
  const b = account.book;
  return (
    <>
      <Stats
        items={[
          ["現金", yen(b.cash)],
          ["在庫", yen(b.inventory)],
          ["設備", yen(b.equipment)],
          ["売掛金", yen(b.receivables)],
          ["未払負債", yen(b.debt)],
          ["純資産", yen(nav(account))],
          ["累計売上", yen(b.revenue)],
          ["累計費用", yen(b.expenses)],
          ["累計利益", yen(profit(account))],
        ]}
      />
      <p className="enterprise-note">
        元入金・資本移動累計 {yen(b.equity)} ／ 貸借・元帳{" "}
        {verifyAccounts(account) ? "一致" : "不一致"}
        。仕入れ・設備購入は資産の移動、売上原価・広告・賃金は費用です。
      </p>
      <Monthly reports={account.months.slice().reverse()} />
      <div className="enterprise-scroll">
        <table>
          <thead>
            <tr>
              <th>日付 / 取引</th>
              <th>現金増減</th>
              <th>売上</th>
              <th>費用</th>
              <th>現金残高</th>
            </tr>
          </thead>
          <tbody>
            {account.journal
              .slice(-25)
              .reverse()
              .map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.date}
                    <br />
                    {e.label}
                  </td>
                  <td>{yen(e.delta.cash)}</td>
                  <td>{yen(e.delta.revenue)}</td>
                  <td>{yen(e.delta.expenses)}</td>
                  <td>{yen(e.after.cash)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function CreateVenture({ g }: { g: GameState }) {
  const [industry, setIndustry] = useState("freelance"),
    [name, setName] = useState("小さなアトリエ"),
    [owner, setOwner] = useState(""),
    [region, setRegion] = useState("online"),
    [investment, setInvestment] = useState(20000),
    [price, setPrice] = useState(12000),
    [product, setProduct] = useState("stationery"),
    [policy, setPolicy] = useState("balanced"),
    [equipment, setEquipment] = useState(0);
  const m = industryModules.get(industry)!;
  return (
    <Card>
      <h3>
        <Plus size={18} /> 副業・事業を始める
      </h3>
      <p>
        収入の選択肢をひとつ増やす。働き方や生活を続けながら、小さく始められます。
      </p>
      <form
        className="enterprise-form"
        onSubmit={(e) => {
          e.preventDefault();
          operation({
            operation: "create",
            industry,
            name,
            companyId: owner,
            region,
            amount: investment,
            price,
            product,
            policy,
            value: equipment,
          });
        }}
      >
        <Field label="事業名">
          <input
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="事業の種類">
          <select
            value={industry}
            onChange={(e) => {
              const m = industryModules.get(e.target.value)!;
              setIndustry(m.id);
              setPrice(m.basePrice);
            }}
          >
            {[...industryModules.values()].map((m) => (
              <option value={m.id} key={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="事業の所有者">
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">自分 / 個人事業</option>
            {g.companies
              .filter((c) => c.status === "active")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} / 法人事業
                </option>
              ))}
          </select>
        </Field>
        <Field label="活動地域">
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            {Object.entries(regions).map(([id, r]) => (
              <option key={id} value={id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="営業方針">
          <select value={policy} onChange={(e) => setPolicy(e.target.value)}>
            <option value="balanced">堅実：自動受注、広告は手動</option>
            <option value="manual">手動：案件を選んで受注</option>
            <option value="growth">成長：広告500円/日・小売の自動仕入れ</option>
          </select>
        </Field>
        <Field label="初期設備の追加段階（0で最小設備）">
          <input
            type="number"
            min="0"
            step="1"
            value={equipment}
            onChange={(e) => setEquipment(+e.target.value)}
          />
        </Field>
        <Field label="初期事業資金（円）">
          <input
            type="number"
            min={m.setup}
            step="1"
            value={investment}
            onChange={(e) => setInvestment(+e.target.value)}
          />
        </Field>
        <Field label="商品・サービス単価（円）">
          <input
            type="number"
            min="100"
            step="1"
            value={price}
            onChange={(e) => setPrice(+e.target.value)}
          />
        </Field>
        {industry === "retail" && (
          <Field label="取り扱う商品">
            <select
              value={product}
              onChange={(e) => {
                setProduct(e.target.value);
                setPrice(
                  products[e.target.value as keyof typeof products].price,
                );
              }}
            >
              {Object.entries(products).map(([id, p]) => (
                <option value={id} key={id}>
                  {p.name} / 仕入基準 {yen(p.cost)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="enterprise-form-footer">
          <p>
            {m.description}
            <br />
            初期設備 {yen(
              m.setup + (10000 * equipment * (equipment + 1)) / 2,
            )}{" "}
            を資金内から取得。残りは事業口座に確保します。運営費・在庫・広告には別途現金が必要です。
          </p>
          <button className="btn primary" type="submit">
            事業を開設する <ArrowUpRight size={16} />
          </button>
        </div>
      </form>
    </Card>
  );
}
function VentureDetail({
  g,
  v,
  onMap,
}: {
  g: GameState;
  v: Enterprise;
  onMap?: () => void;
}) {
  const [tab, setTab] = useState("analysis"),
    [close, setClose] = useState(false),
    [corp, setCorp] = useState(
      g.companies.find((c) => c.status === "active")?.id ?? "",
    );
  const m = industryModules.get(v.industry)!,
    send = (operationName: string, rest: Partial<EnterpriseInput> = {}) =>
      operation({ operation: operationName, id: v.id, ...rest });
  const tabs = [
    ["analysis", "顧客・売上"],
    ["product", "商品・サービス"],
    ["investment", "設備・運営"],
    ["staff", "従業員"],
    ["finance", "事業別財務"],
  ];
  return (
    <Card>
      <div className="enterprise-heading">
        <div>
          <span className="tag">
            {v.ownerId === "player"
              ? "個人事業"
              : g.companies.find((c) => c.id === v.ownerId)?.name}{" "}
            ·{" "}
            {v.status === "active"
              ? "営業中"
              : v.status === "paused"
                ? "休止中"
                : "閉鎖済み"}
          </span>
          <h2>{v.name}</h2>
          <p>
            {m.name} / {regions[v.region].name} / {v.founded} 開設
          </p>
        </div>
        <Store size={28} />
      </div>
      <Stats
        items={[
          ["事業口座の現金", yen(v.book.cash)],
          ["累計利益", yen(profit(v))],
          ["直近の需要 / 販売", v.last.demand + " / " + v.last.units],
          [
            "本人 / スタッフ時間",
            v.last.ownerHours.toFixed(1) +
              "h / " +
              v.last.staffHours.toFixed(1) +
              "h",
          ],
        ]}
      />
      <div className="map-site-summary">
        <b>事業の立地</b>
        <br />
        {businessProperties(g, v).length
          ? businessProperties(g, v).map((p) => (
              <span key={p.id}>
                {p.name} / 月額{" "}
                {yen(
                  g.spatial.leases.find((l) => l.propertyId === p.id)?.rent ??
                    0,
                )}
                <br />
              </span>
            ))
          : "在宅運営：追加家賃なし。物件に入居すると需要・効率・通勤・家賃が変化します。"}
        <br />
        <button className="btn secondary" onClick={onMap}>
          マップで事業拠点を探す
        </button>
      </div>
      <div className="enterprise-tabs" role="tablist" aria-label="事業管理">
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
      <div role="tabpanel">
        {tab === "analysis" && (
          <>
            <h3>
              <BarChart3 size={18} /> 需要と実績
            </h3>
            <p className="enterprise-note">
              需要は地域の市場規模・所得、価格、品質、競合、広告、ブランド、評価から決まります。実売は作業能力と在庫で制約され、同業の自社事業とも市場を分け合います。
            </p>
            <Stats
              items={[
                ["品質", v.quality.toFixed(0) + " / 100"],
                ["顧客評価", v.rating.toFixed(0) + " / 100"],
                ["認知度", v.brand.toFixed(1)],
                ["現行単価", yen(v.price)],
                ["直近売上", yen(v.last.revenue)],
                ["直近利益", yen(v.last.revenue - v.last.expenses)],
              ]}
            />
            <div className="enterprise-bars" aria-label="直近14日の売上グラフ">
              {v.history.slice(-14).map((d) => (
                <div key={d.date} title={d.date + " 売上 " + yen(d.revenue)}>
                  <span
                    style={{
                      height:
                        (d.revenue
                          ? Math.max(
                              3,
                              (d.revenue /
                                Math.max(
                                  1,
                                  ...v.history.slice(-14).map((x) => x.revenue),
                                )) *
                                90,
                            )
                          : 1) + "px",
                    }}
                  />
                  <small>{d.date.slice(8)}</small>
                </div>
              ))}
            </div>
            <div className="enterprise-scroll">
              <table>
                <thead>
                  <tr>
                    <th>日付</th>
                    <th>需要</th>
                    <th>販売・納品</th>
                    <th>売上</th>
                    <th>費用</th>
                    <th>利益</th>
                  </tr>
                </thead>
                <tbody>
                  {v.history
                    .slice(-30)
                    .reverse()
                    .map((d) => (
                      <tr key={d.date}>
                        <td>{d.date}</td>
                        <td>{d.demand}</td>
                        <td>{d.units}</td>
                        <td>{yen(d.revenue)}</td>
                        <td>{yen(d.expenses)}</td>
                        <td>{yen(d.revenue - d.expenses)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === "product" && (
          <>
            <Amount
              key={v.id + "price"}
              label="新しい販売単価（円）"
              initial={v.price}
              button="単価を更新"
              onSubmit={(n) => send("price", { amount: n })}
            />
            {v.industry === "freelance" && (
              <>
                <h3>案件・請求</h3>
                <p>
                  1案件6時間、納期7日。デジタル技能5以上。納期超過7日で解約となり10%の違約費が発生します。納品3日後に入金。高評価では同じ顧客から継続して受注できます。
                </p>
                <button
                  className="btn secondary"
                  onClick={() => send("accept")}
                >
                  新しい案件を受注
                </button>
                <button className="btn secondary" onClick={() => send("auto")}>
                  {v.autoOrders ? "自動受注を停止" : "自動受注を開始"}
                </button>
                <div className="enterprise-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>顧客 / 案件</th>
                        <th>進捗</th>
                        <th>納期 / 入金日</th>
                        <th>契約額</th>
                        <th>状態</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.orders
                        .slice(-30)
                        .reverse()
                        .map((o) => (
                          <tr key={o.id}>
                            <td>
                              {g.npcs.find((p) => p.id === o.clientId)?.name}
                              <br />
                              {o.id}
                            </td>
                            <td>
                              {o.progress.toFixed(1)} / {o.hours}h
                            </td>
                            <td>
                              {o.due}
                              <br />
                              {o.payDate}
                            </td>
                            <td>{yen(o.price)}</td>
                            <td>
                              {
                                {
                                  accepted: "作業中",
                                  invoiced: "入金待ち",
                                  paid: "入金済",
                                  cancelled: "解約",
                                }[o.status]
                              }
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {v.industry === "retail" && (
              <>
                <h3>
                  <Package size={18} />{" "}
                  {products[v.product as keyof typeof products].name} の在庫
                </h3>
                <Stats
                  items={[
                    [
                      "在庫数量",
                      v.inventory.reduce((n, l) => n + l.quantity, 0) + "個",
                    ],
                    ["在庫原価", yen(v.book.inventory)],
                    [
                      "返金予定",
                      yen(
                        v.returns.reduce((n, r) => n + r.quantity * r.price, 0),
                      ),
                    ],
                  ]}
                />
                <Amount
                  label="仕入数量"
                  initial={20}
                  button="現金で仕入れる"
                  onSubmit={(n) => send("purchase", { amount: n })}
                />
                <Amount
                  label="自動仕入れの発注点（0で停止）"
                  initial={v.reorder}
                  button="自動発注を設定"
                  onSubmit={(n) =>
                    send("reorder", { amount: n, value: Math.max(n * 2, 30) })
                  }
                />
                <p className="enterprise-note">
                  発注点 {v.reorder} / 目標在庫 {v.targetStock} / 日予算{" "}
                  {yen(v.procurementBudget)}
                  。大口仕入れは最大15%の単価割引。返品は過去の販売数量と品質から発生し、7日後に返金・廃棄します。
                </p>
                <div className="enterprise-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>数量</th>
                        <th>単価原価</th>
                        <th>陳腐化日</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.inventory.map((l, i) => (
                        <tr key={i}>
                          <td>{l.quantity}</td>
                          <td>{yen(l.unitCost)}</td>
                          <td>{l.expires}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {v.industry === "software" && (
              <>
                <h3>開発と継続課金</h3>
                <Stats
                  items={[
                    ["開発時間", v.development.toFixed(1) + " / 24h"],
                    [
                      "現在の利用者",
                      v.subscribers.reduce((n, c) => n + c.count, 0) + "人",
                    ],
                    [
                      "契約月額合計",
                      yen(
                        v.subscribers.reduce((n, c) => n + c.count * c.fee, 0),
                      ),
                    ],
                  ]}
                />
                <p>
                  開発にはデジタル技能10以上、または従業員・外注が必要です。開発・顧客獲得・サポートに作業時間を使います。30日利用後に料金を受け取り、更新時に品質・価格・サポート不足で顧客が離脱します。保守費が払えない日・休止時・閉鎖時はサービスを停止して顧客を失い、未請求分の料金を放棄します。
                </p>
                <div className="enterprise-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>利用者</th>
                        <th>契約単価</th>
                        <th>次の請求・更新日</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.subscribers.map((c, i) => (
                        <tr key={i}>
                          <td>{c.count}</td>
                          <td>{yen(c.fee)}</td>
                          <td>{c.due}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
        {tab === "investment" && (
          <>
            <div className="enterprise-two">
              <div>
                <h3>本人の時間と運営方針</h3>
                <Amount
                  label="作業配分の比率（0で割当なし）"
                  initial={v.weight}
                  button="配分を更新"
                  onSubmit={(n) => send("weight", { amount: n })}
                />
                <Amount
                  label="1日あたりの広告予算（円）"
                  initial={v.advertising}
                  button="広告予算を設定"
                  onSubmit={(n) => send("advertising", { amount: n })}
                />
                <Amount
                  label="外注作業時間 / 日"
                  initial={v.outsource}
                  button="外注を設定"
                  onSubmit={(n) => send("outsource", { amount: n })}
                />
                <p className="enterprise-note">
                  外注は1時間1,500円、実際に支払えた分だけ作業します。設備・拠点・従業員の増加には管理時間と維持費がかかります。
                </p>
              </div>
              <div>
                <h3>利益を再投資</h3>
                <p>
                  設備 Lv.{v.level} / 拠点 {v.sites} / 販売経路 {v.channels}
                </p>
                <div className="enterprise-buttons">
                  <button
                    className="btn secondary"
                    onClick={() => send("equipment")}
                  >
                    設備を追加 {yen(10000 * v.level)}
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => send("quality")}
                  >
                    品質を改善 {yen(5000)}
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => send("channel")}
                  >
                    販路を開拓 {yen(10000 * v.channels)}
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => send("site")}
                  >
                    拠点を追加 {yen(20000 * v.sites)}
                  </button>
                </div>
                <p>
                  設備は作業効率、品質は需要・返品・顧客維持、販路は市場到達、拠点は販売能力を増やします。
                </p>
              </div>
            </div>
          </>
        )}
        {tab === "staff" && (
          <>
            <h3>
              <Users size={18} /> 業務を任せる
            </h3>
            <p>
              採用費3,000円。平日4時間・時給1,100円。作業担当は生産時間、管理担当は管理負担を軽減します。賃金を払えない日は勤務しません。
            </p>
            <div className="enterprise-buttons">
              <button
                className="btn secondary"
                onClick={() => send("hire", { policy: "production" })}
              >
                作業スタッフを採用
              </button>
              <button
                className="btn secondary"
                onClick={() => send("hire", { policy: "manager" })}
              >
                管理スタッフを採用
              </button>
            </div>
            {v.employees.map((e) => (
              <div className="enterprise-employee" key={e.id}>
                <span>
                  {g.npcs.find((p) => p.id === e.npcId)?.name} /{" "}
                  {e.role === "manager" ? "管理" : "作業"}
                  <small>
                    {e.workedHours}h勤務 / 支払賃金 {yen(e.paid)}
                  </small>
                </span>
                {e.active ? (
                  <button
                    className="btn secondary"
                    onClick={() => send("dismiss", { npcId: e.id })}
                  >
                    契約を終了
                  </button>
                ) : (
                  <span>契約終了</span>
                )}
              </div>
            ))}
          </>
        )}
        {tab === "finance" && (
          <>
            <Books account={v} />
            <div className="enterprise-two">
              <Amount
                label="追加する事業資金（円）"
                button="所有者から補填"
                onSubmit={(n) => send("fund", { amount: n })}
              />
              <Amount
                label="回収する事業資金（円）"
                button={
                  v.ownerId === "player" ? "個人預金へ回収" : "会社口座へ回収"
                }
                onSubmit={(n) => send("withdraw", { amount: n })}
              />
            </div>
            <p className="enterprise-note">
              個人事業の全純資産は本人に帰属します。法人事業の資金回収先は会社口座です。事業売上を個人収入として重複計上しません。
            </p>
            {v.ownerId === "player" &&
              g.companies.some((c) => c.status === "active") && (
                <form
                  className="enterprise-inline"
                  onSubmit={(e) => {
                    e.preventDefault();
                    send("incorporate", { companyId: corp });
                  }}
                >
                  <Field label="移管先の会社">
                    <select
                      value={corp}
                      onChange={(e) => setCorp(e.target.value)}
                    >
                      <option value="">会社を選択</option>
                      {g.companies
                        .filter((c) => c.status === "active")
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <button className="btn secondary">
                    個人事業を法人へ移管
                  </button>
                </form>
              )}
          </>
        )}
      </div>
      <div className="enterprise-danger">
        {v.status !== "closed" && (
          <>
            <button className="btn secondary" onClick={() => send("pause")}>
              {v.status === "active" ? "営業を休止" : "営業を再開"}
            </button>
            {close ? (
              <>
                <p>
                  在庫・設備を簿価の50%で清算します。未納品案件は10%の解約費。未払負債・返品義務・売掛金は閉鎖後も残ります。
                </p>
                <button
                  className="btn secondary"
                  onClick={() => {
                    send("close");
                    setClose(false);
                  }}
                >
                  清算して事業を閉鎖
                </button>
                <button
                  className="btn secondary"
                  onClick={() => setClose(false)}
                >
                  戻る
                </button>
              </>
            ) : (
              <button className="btn secondary" onClick={() => setClose(true)}>
                事業を閉鎖する
              </button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
export function EnterprisePanel({
  g,
  onMap,
}: {
  g: GameState;
  onMap?: () => void;
}) {
  const [selected, setSelected] = useState(""),
    [showCreate, setCreate] = useState(g.ventures.length === 0);
  const v = g.ventures.find((v) => v.id === selected) ?? g.ventures.at(-1);
  return (
    <div className="enterprise-page">
      <div className="enterprise-title">
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <h1>小さく始めて、育てていく。</h1>
          <p>仕事も、学びも、自分の事業も。あなたの時間で選ぶ。</p>
        </div>
        <button className="btn primary" onClick={() => setCreate(!showCreate)}>
          <Plus size={16} />
          {showCreate ? "事業一覧に戻る" : "新しい副業・事業"}
        </button>
      </div>
      <Card>
        <div className="enterprise-heading">
          <h3>
            <BriefcaseBusiness size={18} /> 働き方と事業
          </h3>
          <button
            className="btn secondary"
            onClick={() =>
              useGame
                .getState()
                .act({ type: "action", action: "enterprise-work" })
            }
          >
            余暇の予定を事業運営にする
          </button>
        </div>
        <p>
          勤務予定と睡眠を確保した残りの時間を使います。複数の事業には「設備・運営」で設定した比率で時間を配分。自動受注・自動仕入れ・従業員は設定後に毎日処理します。
        </p>
        <Stats
          items={[
            ["本人の生活資金", yen(liquid(g))],
            [
              "個人事業の純資産",
              yen(
                g.ventures
                  .filter((v) => v.ownerId === "player")
                  .reduce((n, v) => n + nav(v), 0),
              ),
            ],
            [
              "運営する事業",
              g.ventures.filter((v) => v.status !== "closed").length + "事業",
            ],
            ["雇用契約", g.employments.length + "件"],
          ]}
        />
      </Card>
      {showCreate && <CreateVenture g={g} />}
      <div className="venture-selector">
        {g.ventures.map((v) => (
          <button
            className={
              v.id === (selected || g.ventures.at(-1)?.id) ? "selected" : ""
            }
            key={v.id}
            onClick={() => {
              setSelected(v.id);
              setCreate(false);
            }}
          >
            <Store size={18} />
            <span>
              {v.name}
              <small>
                {industryModules.get(v.industry)?.name} /{" "}
                {v.status === "active"
                  ? "営業中"
                  : v.status === "paused"
                    ? "休止中"
                    : "閉鎖"}
              </small>
            </span>
            <b>{yen(v.book.cash)}</b>
          </button>
        ))}
      </div>
      {v && <VentureDetail key={v.id} g={g} v={v} onMap={onMap} />}
    </div>
  );
}
export function CompanyPanel({
  g,
  onMap,
}: {
  g: GameState;
  onMap?: () => void;
}) {
  const [name, setName] = useState("青葉ラボ株式会社"),
    [capital, setCapital] = useState(30000),
    [selected, setSelected] = useState(""),
    [buyer, setBuyer] = useState("");
  const c = g.companies.find((c) => c.id === selected) ?? g.companies.at(-1);
  const send = (op: string, n: number, rest: Partial<EnterpriseInput> = {}) =>
    operation({ operation: op, id: c?.id, amount: n, ...rest });
  return (
    <div className="enterprise-page">
      <div className="enterprise-title">
        <div>
          <span className="eyebrow">OWNERSHIP & CAPITAL</span>
          <h1>会社を持つ、という選択。</h1>
          <p>会社の資金と、あなたの生活資金を分けて育てる。</p>
        </div>
        <Building2 size={36} />
      </div>
      <Card>
        <h3>個人資産と法人資産</h3>
        <Stats
          items={[
            ["本人の現金・預金", yen(liquid(g))],
            [
              "個人事業の純資産",
              yen(
                g.ventures
                  .filter((v) => v.ownerId === "player")
                  .reduce((n, v) => n + nav(v), 0),
              ),
            ],
            [
              "保有株式の簿価",
              yen(
                g.companies.reduce(
                  (n, c) =>
                    n +
                    shareValue(
                      Math.max(0, companyNAV(g, c)),
                      c.shareholders.find((h) => h.personId === "player")
                        ?.shares ?? 0,
                      c.shares,
                    ),
                  0,
                ),
              ),
            ],
            ["個人の純資産合計", yen(netWorth(g))],
          ]}
        />
        <p className="enterprise-note">
          会社の現金は生活費に使えません。給与・役員報酬・配当・株式売却を通じて個人に移動します。株式簿価は売却価格を保証しません。
        </p>
      </Card>
      <Card>
        <h3>
          <Plus size={18} /> 新規会社設立
        </h3>
        <form
          className="enterprise-form"
          onSubmit={(e) => {
            e.preventDefault();
            operation({
              operation: "create-company",
              name,
              amount: capital,
              value: 100,
              region: g.world.city,
            });
          }}
        >
          <Field label="会社の商号">
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="資本金（円）">
            <input
              type="number"
              min="10000"
              value={capital}
              onChange={(e) => setCapital(+e.target.value)}
            />
          </Field>
          <div className="enterprise-form-footer">
            <p>
              設立費10,000円 ＋ 資本金。100株を発行し全株を保有します。本店{" "}
              {g.world.city}、代表者 {g.person.name}
              。ゲーム向けの簡略制度です。税・登記・法的倒産処理は未実装です。
            </p>
            <button className="btn primary">会社を設立する</button>
          </div>
        </form>
      </Card>
      <div className="venture-selector">
        {g.companies.map((x) => (
          <button
            key={x.id}
            className={x.id === c?.id ? "selected" : ""}
            onClick={() => setSelected(x.id)}
          >
            <Building2 size={18} />
            <span>
              {x.name}
              <small>
                {x.status === "active" ? "経営中" : "解散済み"} / {x.founded}
              </small>
            </span>
            <b>{yen(companyNAV(g, x))}</b>
          </button>
        ))}
      </div>
      {c && (
        <Card>
          <div className="enterprise-heading">
            <div>
              <span className="tag">
                {c.id} / {c.region}
              </span>
              <h2>{c.name}</h2>
              <p>
                代表{" "}
                {c.representative === "player"
                  ? g.person.name
                  : (g.securities.accounts.find(
                      (a) => a.ownerId === c.representative,
                    )?.name ??
                    g.npcs.find((p) => p.id === c.representative)?.name ??
                    "外部取締役会")}{" "}
                / 設立 {c.founded} / 発行済 {c.shares}株 / 資本金{" "}
                {yen(c.capital)}
              </p>
            </div>
            <Building2 />
          </div>
          <Stats
            items={[
              ["会社口座の現金", yen(c.book.cash)],
              ["事業込みの総純資産", yen(companyNAV(g, c))],
              ["事業込みの累計利益", yen(companyProfit(g, c))],
              ["累計配当", yen(c.dividends)],
            ]}
          />
          <div className="map-site-summary">
            <b>本店・オフィス</b>
            <br />
            {g.spatial.leases
              .filter((l) => l.tenantId === c.id)
              .map((l) => (
                <span key={l.propertyId}>
                  {properties.find((p) => p.id === l.propertyId)?.name} / 月額{" "}
                  {yen(l.rent)}
                  <br />
                </span>
              ))}
            <button className="btn secondary" onClick={onMap}>
              マップで本店物件を探す
            </button>
          </div>
          <h3>保有事業</h3>
          {companyVentures(g, c).length === 0 ? (
            <p>
              「事業を営む」からこの会社を所有者として開業、または個人事業の財務画面から移管できます。
            </p>
          ) : (
            companyVentures(g, c).map((v) => (
              <div className="enterprise-employee" key={v.id}>
                <b>{v.name}</b>
                <span>
                  現金 {yen(v.book.cash)} / 純資産 {yen(nav(v))} / 利益{" "}
                  {yen(profit(v))}
                </span>
              </div>
            ))
          )}
          <h3>株主構成</h3>
          {c.shareholders.map((h) => (
            <p key={h.personId}>
              {h.personId === "player"
                ? g.person.name
                : g.npcs.find((p) => p.id === h.personId)?.name}
              ：{h.shares}株 ({((h.shares / c.shares) * 100).toFixed(1)}%)
            </p>
          ))}
          {c.status === "active" && (
            <>
              <div className="enterprise-two">
                <Amount
                  label="追加出資額（円）"
                  button="追加出資・1株発行"
                  onSubmit={(n) => send("capital", n, { value: 1 })}
                />
                <Amount
                  label="役員報酬（円）"
                  button="会社から本人へ報酬支払"
                  onSubmit={(n) => send("officer", n)}
                />
                <Amount
                  label="配当総額（円）"
                  button="稼得利益から配当"
                  onSubmit={(n) => send("dividend", n)}
                />
                <div>
                  <Field label="株式売却の相手（信頼30以上）">
                    <select
                      value={buyer}
                      onChange={(e) => setBuyer(e.target.value)}
                    >
                      <option value="">知人を選択</option>
                      {g.relationships
                        .filter((r) => r.trust >= 30)
                        .map((r) => (
                          <option key={r.npcId} value={r.npcId}>
                            {g.npcs.find((p) => p.id === r.npcId)?.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Amount
                    label="一部売却する株数"
                    initial={1}
                    button="簿価で相対売却"
                    onSubmit={(n) => send("sell-shares", n, { npcId: buyer })}
                  />
                </div>
              </div>
              <p className="enterprise-note">
                配当は会社口座の現金・未分配利益で制限し、持株比率で配分します。相対売却は知人の投資余力に制約があります。公開株式市場・M&Aは未実装です。追加出資の発行条件は簡略化しています。
              </p>
            </>
          )}
          <h3>会社と保有事業の連結財務</h3>
          <p className="enterprise-note">
            事業と会社の内部資金移動を相殺し、移管前の個人事業利益を除外します。売上・費用は会社所有期間で集計。設備は取得原価で管理し減価償却は未実装です。
          </p>
          <Stats
            items={[
              ["連結現金", yen(consolidatedBook(g, c).cash)],
              ["連結在庫", yen(consolidatedBook(g, c).inventory)],
              ["連結設備", yen(consolidatedBook(g, c).equipment)],
              ["連結売掛金", yen(consolidatedBook(g, c).receivables)],
              ["連結負債", yen(consolidatedBook(g, c).debt)],
              ["連結純資産", yen(companyNAV(g, c))],
            ]}
          />
          <Monthly reports={companyMonths(g, c)} />
          <h3>
            <Wallet size={18} /> 会社本体の帳簿（保有事業は上に別記）
          </h3>
          <Books account={c} />
          {c.status === "active" && (
            <div className="enterprise-danger">
              <button
                className="btn secondary"
                onClick={() => send("dissolve", 1)}
              >
                全事業清算後に会社を解散する
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export function PersonalBusinessFinance({ g }: { g: GameState }) {
  if (!g.ventures.length) return null;
  return (
    <Card>
      <h3>個人事業の損益と分別資金</h3>
      <p>
        生活口座への資金回収は振替として扱います。事業の売上・費用はここで発生基準により確認できます。法人所有期間の損益は会社画面に表示します。
      </p>
      <Stats
        items={[
          [
            "個人事業の現金",
            yen(
              g.ventures
                .filter((v) => v.ownerId === "player")
                .reduce((n, v) => n + v.book.cash, 0),
            ),
          ],
          [
            "個人事業の未払負債",
            yen(
              g.ventures
                .filter((v) => v.ownerId === "player")
                .reduce((n, v) => n + v.book.debt, 0),
            ),
          ],
          [
            "個人事業の純資産",
            yen(
              g.ventures
                .filter((v) => v.ownerId === "player")
                .reduce((n, v) => n + nav(v), 0),
            ),
          ],
        ]}
      />
      <Monthly reports={personalEnterpriseMonths(g)} />
    </Card>
  );
}
