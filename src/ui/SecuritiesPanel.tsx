import { useState } from "react";
import type { GameState } from "../engine/types";
import type { SecuritiesInput, Instrument } from "../engine/securities/types";
import {
  account,
  availableCash,
  availableShares,
  portfolioValue,
  held,
  fundNAV,
} from "../engine/securities/ledger";
import { reserveAmount } from "../engine/securities/exchange";
import { sectorModels } from "../engine/securities/catalog";
import { ipoReason, listedInstrument } from "../engine/securities/ipo";
import { companyNAV } from "../engine/enterprise/accounting";
import { useGame } from "../store";
import "../phase6.css";
const yen = (n: number) => "¥" + Math.round(n).toLocaleString("ja-JP");
const number = (n: number) => n.toLocaleString("ja-JP");
const statuses: Record<string, string> = {
  open: "受付",
  partial: "一部約定",
  filled: "約定済",
  cancelled: "取消済",
  expired: "失効",
  pending: "審査・募集中",
  listed: "上場済",
  failed: "募集不成立",
  delisted: "上場廃止",
};
function PriceChart({ i }: { i: Instrument }) {
  const h = i.history;
  if (!h.length)
    return (
      <p className="market-note">
        開始基準価格。まだ市場の取引履歴はありません。
      </p>
    );
  const lo = Math.min(...h.map((x) => x.close)) * 0.98,
    hi = Math.max(...h.map((x) => x.close)) * 1.02;
  return (
    <figure className="stock-chart">
      <svg
        viewBox="0 0 600 120"
        role="img"
        aria-label="実際の約定・定期終値の推移"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={h
            .map(
              (x, k) =>
                `${(k / (h.length - 1 || 1)) * 600},${110 - ((x.close - lo) / (hi - lo || 1)) * 100}`,
            )
            .join(" ")}
        />
      </svg>
      <figcaption>
        {h[0].date} → {h.at(-1)?.date} · 実取引日・月初の終値（最大90件）
      </figcaption>
    </figure>
  );
}
export default function SecuritiesPanel({ g }: { g: GameState }) {
  const { act } = useGame();
  const send = (securities: SecuritiesInput) =>
    act({
      type: "execute",
      actionId: "securities-manage",
      target: { securities },
    });
  const [tab, setTab] = useState("stocks"),
    [query, setQuery] = useState(""),
    [sector, setSector] = useState(""),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState(g.securities.instruments[0].id),
    [amount, setAmount] = useState(10000),
    [quantity, setQuantity] = useState(1),
    [price, setPrice] = useState(1000),
    [side, setSide] = useState<"buy" | "sell">("buy"),
    [orderType, setOrderType] = useState<"market" | "limit">("market"),
    [companyId, setCompany] = useState(g.companies[0]?.id ?? ""),
    [primary, setPrimary] = useState(20),
    [secondary, setSecondary] = useState(0),
    [ipoPrice, setIPOPrice] = useState(1000),
    [planAmount, setPlanAmount] = useState(10000),
    [planDay, setPlanDay] = useState(1),
    [reinvest, setReinvest] = useState(false),
    [policy, setPolicy] = useState("value");
  const x = g.securities,
    a = account(g),
    i = x.instruments.find((i) => i.id === selected) ?? x.instruments[0],
    firm = x.firms.find((f) => f.id === i.issuerId),
    release =
      firm?.published.at(-1) ??
      (i.issuerId ? x.localFinancials[i.issuerId]?.at(-1) : undefined),
    fund = x.funds.find((f) => f.instrumentId === i.id),
    value = portfolioValue(g, a),
    company = g.companies.find((c) => c.id === companyId),
    own =
      company?.shareholders.find((h) => h.personId === "player")?.shares ?? 0;
  const filtered = x.instruments.filter(
    (i) =>
      i.kind === "stock" &&
      (!sector ||
        x.firms.find((f) => f.id === i.issuerId)?.sector === sector) &&
      `${i.name} ${i.ticker} ${x.firms.find((f) => f.id === i.issuerId)?.headquarters ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const cap =
    orderType === "limit"
      ? price
      : Math.max(
          1,
          side === "buy"
            ? Math.ceil(i.price * 1.05)
            : Math.floor(i.price * 0.95),
        );
  const choose = (id: string) => {
    setSelected(id);
    setPrice(x.instruments.find((i) => i.id === id)!.price);
    setQuantity(1);
  };
  const moneyInput = (
    label: string,
    v: number,
    set: (n: number) => void,
    min = 1,
  ) => (
    <label>
      {label}
      <input
        type="number"
        min={min}
        step="1"
        value={v}
        onChange={(e) => set(Number(e.target.value))}
      />
    </label>
  );
  return (
    <div className="securities">
      <header className="market-heading">
        <div>
          <span className="eyebrow">WORLD CAPITAL MARKETS</span>
          <h1>証券・投資</h1>
          <p>生活の先に、世界の事業を持つ。投資は自由な人生の選択肢です。</p>
        </div>
        <span className="tag">
          {x.firms.length}社 · {sectorModels.size}業界 · 平日日次清算
        </span>
      </header>
      <div className="market-metrics">
        {[
          ["証券口座現金", yen(a.book.cash)],
          ["買付可能資金", yen(availableCash(g, a))],
          ["保有証券評価額", yen(value)],
          ["売却実現損益", yen(a.realized)],
          ["配当・分配受取", yen(a.dividends)],
        ].map(([label, v]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <nav className="market-tabs" aria-label="証券メニュー">
        {[
          ["stocks", "銘柄を探す"],
          ["portfolio", "資産・注文"],
          ["funds", "指数・ファンド"],
          ["ipo", "IPO・株主"],
          ["news", "市場ニュース"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "selected" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "stocks" && (
        <div className="market-layout">
          <section className="card market-list">
            <h2>世界の上場企業</h2>
            <div className="market-form">
              <label>
                銘柄検索
                <input
                  placeholder="企業名・証券コード・本店"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label>
                業界
                <select
                  value={sector}
                  onChange={(e) => {
                    setSector(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="">すべての業界</option>
                  {[...sectorModels.values()].map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p>
              {filtered.length}銘柄 · {page + 1}/
              {Math.max(1, Math.ceil(filtered.length / 20))}
            </p>
            <div className="market-scroll">
              <table>
                <thead>
                  <tr>
                    <th>企業 / コード</th>
                    <th>株価</th>
                    <th>出来高</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(page * 20, page * 20 + 20).map((stock) => (
                    <tr
                      key={stock.id}
                      className={i.id === stock.id ? "chosen" : ""}
                    >
                      <td>
                        <button
                          className="stock-link"
                          onClick={() => choose(stock.id)}
                        >
                          {stock.name}
                          <small>{stock.ticker}</small>
                        </button>
                      </td>
                      <td>
                        {yen(stock.price)}
                        <small>{statuses[stock.status]}</small>
                      </td>
                      <td>{number(stock.volume)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="market-form">
              <button disabled={!page} onClick={() => setPage(page - 1)}>
                前へ
              </button>
              <button
                disabled={(page + 1) * 20 >= filtered.length}
                onClick={() => setPage(page + 1)}
              >
                次へ
              </button>
            </div>
          </section>
          <section className="card market-detail">
            <span className="eyebrow">
              {i.ticker} · {i.exchangeId}
            </span>
            <h2>{i.name}</h2>
            <strong className="stock-price">{yen(i.price)}</strong>
            <p>
              公開情報による参考価値 {yen(i.reference)} / 保有{" "}
              {number(held(a, i.id))}株
            </p>
            <PriceChart i={i} />
            {firm && (
              <p>
                {sectorModels.get(firm.sector)?.name} · {firm.headquarters}
                <br />
                {firm.business}
              </p>
            )}
            {release && (
              <>
                <h3>最新の公開財務</h3>
                <p>
                  {release.period} · 開示日 {release.published}
                </p>
                <dl className="market-dl">
                  {[
                    ["売上", yen(release.revenue)],
                    ["純利益", yen(release.netIncome)],
                    [
                      "総資産 / 負債",
                      `${yen(release.assets)} / ${yen(release.debt)}`,
                    ],
                    ["EPS", yen(release.eps)],
                    ["時価総額", yen(i.price * i.shares)],
                    [
                      "参考PER（世界企業は四半期×4）",
                      release.netIncome > 0
                        ? (
                            (i.price * release.shares) /
                            (release.netIncome * (firm ? 4 : 1))
                          ).toFixed(2) + "倍"
                        : "利益なし",
                    ],
                    [
                      "PBR",
                      release.assets > release.debt
                        ? (
                            (i.price * release.shares) /
                            (release.assets - release.debt)
                          ).toFixed(2) + "倍"
                        : "純資産なし",
                    ],
                    [
                      "対象期間ROE",
                      release.assets > release.debt
                        ? (
                            (release.netIncome /
                              (release.assets - release.debt)) *
                            100
                          ).toFixed(1) + "%"
                        : "—",
                    ],
                    [
                      "公表配当利回り（1回分）",
                      ((release.dividendPerShare / i.price) * 100).toFixed(2) +
                        "%",
                    ],
                    ["公表予想売上", yen(release.forecast)],
                    ["キャッシュフロー", yen(release.cashFlow)],
                    ["発行済株式", number(release.shares)],
                    ["成長率", (release.growth * 100).toFixed(1) + "%"],
                    ["公表配当 / 株", yen(release.dividendPerShare)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <h3>注文</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send({
                  operation: "order",
                  instrumentId: i.id,
                  side,
                  orderType,
                  quantity,
                  price,
                });
              }}
            >
              <div className="market-form">
                <label>
                  売買
                  <select
                    value={side}
                    onChange={(e) => setSide(e.target.value as typeof side)}
                  >
                    <option value="buy">買い</option>
                    <option value="sell">売り</option>
                  </select>
                </label>
                <label>
                  注文方法
                  <select
                    value={orderType}
                    onChange={(e) =>
                      setOrderType(e.target.value as typeof orderType)
                    }
                  >
                    <option value="market">成行（価格保護あり）</option>
                    <option value="limit">指値</option>
                  </select>
                </label>
                {moneyInput("注文株数", quantity, setQuantity)}
                {orderType === "limit" &&
                  moneyInput("指値価格", price, setPrice)}
              </div>
              <p className="market-note">
                {side === "buy"
                  ? `予約上限 ${Number.isSafeInteger(quantity) && quantity > 0 && cap > 0 && Number.isSafeInteger((cap + Math.ceil(cap / 1000)) * quantity) ? yen(reserveAmount(cap, quantity)) : "—"}`
                  : `売却可能 ${availableShares(g, a, i.id)}株`}{" "}
                ·
                手数料0.1%（約定ごと最低1円）。成行は直近価格±5%以内・次営業日まで。未約定や一部約定も発生します。
              </p>
              <button
                className="primary"
                disabled={i.status !== "listed"}
                type="submit"
              >
                注文を出す
              </button>
            </form>
          </section>
        </div>
      )}
      {tab === "portfolio" && (
        <>
          <section className="card">
            <h2>生活資金と証券口座の振替</h2>
            <div className="market-form">
              {moneyInput("振替金額", amount, setAmount)}
              <button onClick={() => send({ operation: "deposit", amount })}>
                証券口座へ入金
              </button>
              <button onClick={() => send({ operation: "withdraw", amount })}>
                生活資金へ出金
              </button>
            </div>
            <p className="market-note">
              法人・世帯の資金は使用しません。注文に予約した資金は出金できません。
            </p>
          </section>
          <section className="card">
            <h2>保有証券</h2>
            <div className="market-scroll">
              <table>
                <thead>
                  <tr>
                    <th>銘柄</th>
                    <th>数量</th>
                    <th>取得総額</th>
                    <th>評価額 / 評価損益</th>
                  </tr>
                </thead>
                <tbody>
                  {a.positions
                    .filter((p) => p.quantity)
                    .map((p) => {
                      const stock = x.instruments.find(
                          (i) => i.id === p.instrumentId,
                        )!,
                        v =
                          stock.status === "listed"
                            ? stock.price * p.quantity
                            : 0;
                      return (
                        <tr key={p.instrumentId}>
                          <td>
                            <button
                              onClick={() => {
                                choose(stock.id);
                                setTab(
                                  stock.kind === "stock" ? "stocks" : "funds",
                                );
                              }}
                            >
                              {stock.name}
                            </button>
                          </td>
                          <td>{number(p.quantity)}</td>
                          <td>
                            {yen(p.cost)}
                            <small>平均 {yen(p.cost / p.quantity)}</small>
                          </td>
                          <td>
                            {yen(v)}
                            <small>{yen(v - p.cost)}</small>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {!a.positions.some((p) => p.quantity) && (
              <p>保有証券はありません。入金後に銘柄を選んで注文できます。</p>
            )}
          </section>
          <section className="card">
            <h2>注文履歴・取消</h2>
            {x.orders
              .filter((o) => o.accountId === "player")
              .slice(-30)
              .reverse()
              .map((o) => (
                <div className="market-row" key={o.id}>
                  <div>
                    {x.instruments.find((i) => i.id === o.instrumentId)?.name}
                    <small>
                      {o.created} · {o.side === "buy" ? "買" : "売"}{" "}
                      {o.quantity}株 / 残{o.remaining}株 · {statuses[o.status]}{" "}
                      · 上限/下限 {yen(o.limit)}
                    </small>
                  </div>
                  {["open", "partial"].includes(o.status) && (
                    <button
                      onClick={() =>
                        send({ operation: "cancel", orderId: o.id })
                      }
                    >
                      取消
                    </button>
                  )}
                </div>
              ))}
          </section>
          <section className="card">
            <h2>約定履歴</h2>
            {x.trades
              .filter((t) => t.buyerId === "player" || t.sellerId === "player")
              .slice(-30)
              .reverse()
              .map((t) => (
                <div className="market-row" key={t.id}>
                  <div>
                    {x.instruments.find((i) => i.id === t.instrumentId)?.name}
                    <small>
                      {t.date} · {t.buyerId === "player" ? "買付" : "売却"}{" "}
                      {t.quantity}株 × {yen(t.price)} · {t.kind}
                    </small>
                  </div>
                  <span>
                    手数料{" "}
                    {yen(t.buyerId === "player" ? t.buyerFee : t.sellerFee)}
                  </span>
                </div>
              ))}
          </section>
        </>
      )}
      {tab === "funds" && (
        <>
          <div className="market-metrics">
            {x.indices.map((index) => (
              <div key={index.id}>
                <small>
                  {index.name} · {index.members.length}銘柄
                </small>
                <strong>{index.value.toFixed(2)}</strong>
                <span>時価総額加重 / 開始1,000</span>
              </div>
            ))}
          </div>
          <section className="card">
            <h2>実物株式を保有するインデックスファンド</h2>
            <div className="market-form">
              {x.funds.map((f) => (
                <button
                  key={f.id}
                  className={i.id === f.instrumentId ? "selected" : ""}
                  onClick={() => choose(f.instrumentId)}
                >
                  {f.name}
                </button>
              ))}
            </div>
            {fund ? (
              <>
                <h3>{fund.name}</h3>
                <dl className="market-dl">
                  <div>
                    <dt>基準価額 / 1口</dt>
                    <dd>{yen(i.price)}</dd>
                  </div>
                  <div>
                    <dt>純資産</dt>
                    <dd>{yen(fundNAV(g, fund.id))}</dd>
                  </div>
                  <div>
                    <dt>年率運用費用</dt>
                    <dd>{(fund.feeBps / 100).toFixed(2)}%</dd>
                  </div>
                  <div>
                    <dt>保有銘柄</dt>
                    <dd>
                      {
                        account(g, fund.accountId).positions.filter(
                          (p) => p.quantity,
                        ).length
                      }
                    </dd>
                  </div>
                  <div>
                    <dt>保有口数</dt>
                    <dd>{held(a, i.id)}</dd>
                  </div>
                </dl>
                <div className="market-form">
                  {moneyInput("ファンド口数", quantity, setQuantity)}
                  <button
                    onClick={() =>
                      send(
                        fund.kind === "mutual"
                          ? {
                              operation: "subscribe",
                              instrumentId: i.id,
                              quantity,
                            }
                          : {
                              operation: "order",
                              instrumentId: i.id,
                              side: "buy",
                              orderType: "market",
                              quantity,
                            },
                      )
                    }
                  >
                    購入する
                  </button>
                  <button
                    onClick={() =>
                      send(
                        fund.kind === "mutual"
                          ? {
                              operation: "redeem",
                              instrumentId: i.id,
                              quantity,
                            }
                          : {
                              operation: "order",
                              instrumentId: i.id,
                              side: "sell",
                              orderType: "market",
                              quantity,
                            },
                      )
                    }
                  >
                    売却・解約する
                  </button>
                </div>
                <p className="market-note">
                  ETFは取引所で日次約定。投資信託は基準価額で発行・償還し、解約はファンドの利用可能現金以内です。保有株の配当を原資に分配します。
                </p>
                <h3>毎月の積立</h3>
                <div className="market-form">
                  {moneyInput(
                    "毎月の予算（0で停止）",
                    planAmount,
                    setPlanAmount,
                    0,
                  )}
                  {moneyInput("実行日（1〜28日）", planDay, setPlanDay)}
                  <label>
                    <input
                      type="checkbox"
                      checked={reinvest}
                      onChange={(e) => setReinvest(e.target.checked)}
                    />
                    分配金を再投資
                  </label>
                  <button
                    onClick={() =>
                      send({
                        operation: "plan",
                        instrumentId: i.id,
                        amount: planAmount,
                        day: planDay,
                        reinvest,
                      })
                    }
                  >
                    積立設定を保存
                  </button>
                </div>
                <p>
                  現在の設定：
                  {x.plans.find((p) => p.instrumentId === i.id)
                    ? `${yen(x.plans.find((p) => p.instrumentId === i.id)!.amount)} / 毎月${x.plans.find((p) => p.instrumentId === i.id)!.day}日`
                    : "なし"}
                </p>
              </>
            ) : (
              <p>ファンドを選択すると購入・積立を設定できます。</p>
            )}
          </section>
        </>
      )}
      {tab === "ipo" && (
        <section className="card">
          <h2>自分の会社を上場する</h2>
          <p>
            会社への公募出資と、個人が受け取る既存株の売出代金を分離します。有限の機関投資家が引き受けられない募集は不成立になります。
          </p>
          <label>
            対象会社
            <select
              value={companyId}
              onChange={(e) => {
                setCompany(e.target.value);
                const c = g.companies.find((c) => c.id === e.target.value);
                if (c)
                  setIPOPrice(
                    Math.max(1, Math.floor(companyNAV(g, c) / c.shares)),
                  );
              }}
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
          </label>
          {company && (
            <>
              <p>
                会社純資産 {yen(companyNAV(g, company))} · 発行済{" "}
                {company.shares}株 · 自分 {own}株（
                {((own / company.shares) * 100).toFixed(1)}%）
              </p>
              {!listedInstrument(g, company.id) ? (
                <>
                  <p className="market-note">
                    {ipoReason(g, company.id) ??
                      "上場申請条件を満たしています。手続費用1万円・2時間、募集開始は7日後です。"}
                  </p>
                  <div className="market-form">
                    {moneyInput("公募の新株数", primary, setPrimary, 0)}
                    {moneyInput(
                      "売り出す自分の株数",
                      secondary,
                      setSecondary,
                      0,
                    )}
                    {moneyInput("募集価格 / 株", ipoPrice, setIPOPrice)}
                    <button
                      disabled={!!ipoReason(g, company.id)}
                      onClick={() =>
                        send({
                          operation: "ipo",
                          companyId,
                          primary,
                          secondary,
                          price: ipoPrice,
                        })
                      }
                    >
                      上場を申請する
                    </button>
                  </div>
                  <p>
                    募集後の自分の持株比率{" "}
                    {(
                      ((own - secondary) / (company.shares + primary)) *
                      100
                    ).toFixed(1)}
                    % · 会社への公募総額 {yen(primary * ipoPrice)} ·
                    個人売出総額 {yen(secondary * ipoPrice)}
                    （各売却手数料を別途控除）
                  </p>
                </>
              ) : (
                <>
                  <h3>株主構成と議決</h3>
                  {company.shareholders.map((h) => (
                    <p key={h.personId}>
                      {h.personId === "player"
                        ? g.person.name
                        : (x.accounts.find((a) => a.ownerId === h.personId)
                            ?.name ??
                          g.npcs.find((p) => p.id === h.personId)?.name ??
                          h.personId)}{" "}
                      — {h.shares}株 /{" "}
                      {((h.shares / company.shares) * 100).toFixed(1)}%
                    </p>
                  ))}
                  <p>
                    過半数の議決権が経営権の条件です。売却により失うことがあります。
                  </p>
                  <div className="market-form">
                    <label>
                      経営方針
                      <select
                        value={policy}
                        onChange={(e) => setPolicy(e.target.value)}
                      >
                        <option value="value">費用効率</option>
                        <option value="growth">広告と在庫への拡大投資</option>
                        <option value="delist">全株取得後の自主上場廃止</option>
                      </select>
                    </label>
                    <button
                      onClick={() =>
                        send({ operation: "vote", companyId, value: policy })
                      }
                    >
                      株主決議を実行
                    </button>
                    {moneyInput("配当 / 1株", price, setPrice)}
                    <button
                      onClick={() =>
                        send({ operation: "dividend", companyId, price })
                      }
                    >
                      会社から配当を支払う
                    </button>
                  </div>
                </>
              )}
            </>
          )}
          {x.offerings
            .slice()
            .reverse()
            .map((o) => (
              <div className="market-row" key={o.id}>
                <div>
                  {g.companies.find((c) => c.id === o.companyId)?.name}
                  <small>
                    {statuses[o.status]} · 募集開始 {o.opens} · {o.reason}
                  </small>
                </div>
                <span>
                  会社調達 {yen(o.raised)}
                  <small>個人売出受取 {yen(o.secondaryProceeds)}</small>
                </span>
              </div>
            ))}
          {!g.companies.length && (
            <p>
              「会社・所有権」で会社を設立し、利益と運営実績を蓄積すると申請できます。
            </p>
          )}
        </section>
      )}
      {tab === "news" && (
        <section className="card">
          <h2>市場ニュース</h2>
          {x.news
            .slice()
            .reverse()
            .map((n) => (
              <article className="market-row" key={n.id}>
                <div>
                  <small>
                    {n.date} · {n.kind}
                  </small>
                  <p>{n.text}</p>
                </div>
              </article>
            ))}
          {!x.news.length && (
            <p>
              進行後、決算開示・約定・配当・上場などの実際の出来事を掲載します。
            </p>
          )}
        </section>
      )}
      <p className="market-note">
        ゲーム独自の架空企業・簡略制度です。取引・配当の税率は現在0%。全市場は円決済。外国為替・2000社規模・高度なM&Aは今後のフェーズです。上場廃止銘柄は換金価格未確定のため評価額0円で表示します。開始開示は初期条件です。
      </p>
    </div>
  );
}
