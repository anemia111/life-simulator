import { quotedRent, districtState } from "../engine/simulation/market";
import {
  compareSite,
  planMove,
  jobScheduleReason,
} from "../engine/spatial/preview";
import { useState, useEffect } from "react";
import type { GameState } from "../engine/types";
import type { Property } from "../engine/spatial/types";
import {
  cities,
  districts,
  properties,
  property,
  district,
  homeProperty,
  tenant,
  route,
  jobOffer,
  allowed,
  locationEffect,
} from "../engine/spatial/selectors";
import { jobs, hiringAssessment } from "../engine/career";
import { liquid } from "../engine/finance";
import { useGame } from "../store";
import {
  MapPin,
  ArrowLeft,
  ArrowUpRight,
  House,
  BriefcaseBusiness,
  Store,
  Building2,
  Navigation,
  Layers,
  Heart,
  Check,
  X,
  Globe,
  TrainFront,
} from "lucide-react";
const yen = (n: number) => "¥" + Math.round(n).toLocaleString("ja-JP");
const kindNames = {
  home: "住居",
  shop: "店舗",
  office: "オフィス",
  warehouse: "倉庫",
  workplace: "勤務先",
  competitor: "競合",
  facility: "施設",
};
const glyphs = {
  home: "住",
  shop: "店",
  office: "O",
  warehouse: "倉",
  workplace: "仕",
  competitor: "競",
  facility: "＋",
};
const colors = {
  home: "#537f69",
  shop: "#d3a15b",
  office: "#b58b4e",
  warehouse: "#8e9977",
  workplace: "#547ba1",
  competitor: "#bc7770",
  facility: "#7b9685",
};
const filters = [
  ["all", "すべて"],
  ["home", "住居"],
  ["workplace", "求人"],
  ["business", "事業用"],
  ["facility", "施設"],
  ["competitor", "競合"],
] as const;
const filtered = (g: GameState, p: Property, f: string) =>
  f === "all" ||
  (f === "competitor"
    ? g.simulation.firms.some(
        (x) => x.status === "active" && x.sites.includes(p.id),
      )
    : f === "business"
      ? ["shop", "office", "warehouse"].includes(p.kind)
      : p.kind === f);
const execute = (actionId: string, id: string, value?: string) =>
  useGame.getState().act({ type: "execute", actionId, target: { id, value } });
function Stats({ items }: { items: [string, string][] }) {
  return (
    <dl className="map-stats">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
function LeaseActions({ g, p }: { g: GameState; p: Property }) {
  const [entity, setEntity] = useState("");
  const candidates = [
    ...g.ventures
      .filter((v) => v.status !== "closed" && allowed(p, v.industry))
      .map((v) => ({
        id: v.id,
        name:
          v.name + " / " + (v.ownerId === "player" ? "個人事業" : "法人事業"),
        cash: v.book.cash,
      })),
    ...g.companies
      .filter((c) => c.status === "active" && p.kind === "office")
      .map((c) => ({ id: c.id, name: c.name + " / 本店", cash: c.book.cash })),
  ];
  const selected = candidates.find((c) => c.id === entity) ?? candidates[0];
  const venture = g.ventures.find((v) => v.id === selected?.id),
    preview = venture && !tenant(g, p) ? compareSite(g, venture, p.id) : null;
  if (tenant(g, p))
    return (
      <p className="map-note">
        入居中の物件です。あなたの事業契約は下の管理欄から解約できます。
      </p>
    );
  return (
    <div className="map-operation">
      <h3>ここに拠点を置く</h3>
      {candidates.length ? (
        <>
          <label>
            入居する事業・会社
            <select
              aria-label="入居する事業・会社"
              value={selected?.id ?? ""}
              onChange={(e) => setEntity(e.target.value)}
            >
              {candidates.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <>
            {preview && (
              <>
                <Stats
                  items={[
                    [
                      "基準条件での需要",
                      preview.before + " → " + preview.after + " / 日",
                    ],
                    [
                      "作業効率",
                      "×" + preview.proposed.productivity.toFixed(2),
                    ],
                    ["競争負荷", "×" + preview.proposed.competition.toFixed(2)],
                    ["本人の往復移動", preview.trip.hours * 2 + "h"],
                  ]}
                />
                <p className="map-note">
                  現在の価格・品質・広告等を固定した比較です。実売は在庫・作業時間・予算でさらに制限されます。本人は移動後0.5時間以上作業できる日だけ通います。
                </p>
              </>
            )}
          </>
          <p>
            入居口座の現金 <b>{yen(selected?.cash ?? 0)}</b>
            <br />
            契約時の当月賃料 <b>{yen(quotedRent(g, p))}</b> / 手続き1時間
          </p>
          <button
            className="btn primary"
            disabled={!selected}
            onClick={() => execute("map-lease", p.id, selected.id)}
          >
            この物件を借りる <ArrowUpRight size={16} />
          </button>
          <p className="map-note">
            毎月1日に契約賃料を支払います。休業中も家賃が発生します。解約月の返金・敷金・購入は今回の対象外です。
          </p>
        </>
      ) : (
        <p>
          営業可能な事業または会社がありません。「事業を営む」で開業し、必要な資金を事業口座へ用意してください。法人の本店契約はオフィスのみです。
        </p>
      )}
    </div>
  );
}
function PropertyDetail({
  g,
  p,
  onClose,
}: {
  g: GameState;
  p: Property;
  onClose: () => void;
}) {
  const mapError = useGame((state) => state.error);
  const t = tenant(g, p),
    d = district(p.districtId),
    trip = route(homeProperty(g), p),
    job = jobs.find((j) => j.id === p.jobId),
    own = g.spatial.leases.find((l) => l.propertyId === p.id);
  const occupant =
    t === "player"
      ? g.person.name
      : (g.ventures.find((v) => v.id === t)?.name ??
        g.companies.find((c) => c.id === t)?.name ??
        g.simulation.firms.find((f) => f.id === t)?.name ??
        job?.company ??
        (t?.startsWith("rival-")
          ? "競合の運営会社"
          : t === "city-aoba"
            ? "青葉市"
            : t));
  const move = p.kind === "home" ? planMove(g, p.id) : null,
    newContracts = move?.contracts ?? [],
    moveReason = move?.reason ?? "",
    offer = job ? jobOffer(g, job) : null,
    workReason = job ? jobScheduleReason(g, job.id) : "";
  return (
    <section className="map-property-detail" aria-label="物件の詳細">
      <button className="map-back" onClick={onClose}>
        <ArrowLeft size={16} />
        地図に戻る
      </button>
      {mapError && (
        <p className="map-warning" aria-live="polite">
          {mapError}
        </p>
      )}
      <div className="map-detail-heading">
        <span className="tag">
          {kindNames[p.kind]} · {d.name}
        </span>
        <h2>{job ? job.company : p.name}</h2>
        <span className="map-property-id">{p.id}</span>
      </div>
      <Stats
        items={[
          ["面積", p.area + "㎡"],
          ["月額賃料", yen(quotedRent(g, p))],
          ["購入参考価格", p.purchasePrice ? yen(p.purchasePrice) : "公共施設"],
          ["状態", p.condition + " / 100"],
          ["視認性", p.visibility + " / 100"],
          ["入居状態", t ? "入居中" : "空き物件"],
        ]}
      />
      <p className="map-note">
        所有者：
        {p.ownerId === "aoba-estates"
          ? "青葉不動産"
          : p.ownerId === "city-aoba"
            ? "青葉市"
            : p.ownerId}
        <br />
        入居者：{occupant ?? "なし"}
        <br />
        許可業種：
        {p.allowedIndustries.includes("*")
          ? "全登録業界（用途制約あり）"
          : p.allowedIndustries.length
            ? p.allowedIndustries.join(" / ")
            : p.kind === "home"
              ? "居住専用"
              : "該当なし"}
      </p>
      <div className="map-route">
        <Navigation size={18} />
        <div>
          <b>自宅から {trip.distance.toFixed(1)} km</b>
          <p>
            片道の目安 {trip.minutes}分 / 予定枠 {trip.hours}h<br />
            一般移動運賃 {yen(trip.fare)}・片道
          </p>
        </div>
      </div>
      {p.kind === "home" && (
        <div className="map-operation">
          <h3>この街で暮らす</h3>
          {p.id === g.spatial.homePropertyId ? (
            <p className="map-note">
              <Check size={16} /> 現在の住居です。
            </p>
          ) : t ? (
            <p>この物件は入居中です。</p>
          ) : (
            <>
              <p>
                食費・光熱の地域係数 ×{d.livingIndex.toFixed(2)} / 治安{" "}
                {d.safety}
                <br />
                引越し費用 {yen(move?.cost ?? 0)}
                ・2時間。家賃増額分と、地区変更時5,000円を支払います。
              </p>
              {g.employments.map((e, i) => (
                <p className="map-commute-comparison" key={e.id}>
                  {jobs.find((j) => j.id === e.jobId)?.company}
                  <b>
                    {e.commute}h → {newContracts[i].commute}h・片道
                  </b>
                </p>
              ))}
              {moveReason && (
                <p className="map-warning">
                  {moveReason}
                  。勤務開始時刻・睡眠・当日の行動を調整してください。
                </p>
              )}
              <button
                className="btn primary"
                disabled={!!moveReason}
                onClick={() => execute("map-move", p.id)}
              >
                この住居へ引っ越す <ArrowUpRight size={16} />
              </button>
            </>
          )}
        </div>
      )}
      {offer && job && (
        <div className="map-operation">
          <h3>{job.name}</h3>
          <Stats
            items={[
              ["時給", yen(offer.wage)],
              ["勤務", job.hours + "h / " + job.start + "時開始"],
              ["通勤 / 片道", offer.commute + "h"],
              ["出勤日の交通費", yen(offer.fare)],
              [
                "募集枠",
                String(
                  g.vacancies.find((v) => v.jobId === job.id)?.openings ?? 0,
                ),
              ],
              [
                "応募点 / 基準",
                hiringAssessment(g, job.id).score +
                  " / " +
                  hiringAssessment(g, job.id).threshold,
              ],
            ]}
          />
          <p>{job.description}</p>
          {workReason && <p className="map-warning">{workReason}</p>}
          <button
            className="btn primary"
            disabled={
              !!workReason || g.employments.some((e) => e.jobId === job.id)
            }
            onClick={() =>
              useGame.getState().act({ type: "apply", jobId: job.id })
            }
          >
            {g.employments.some((e) => e.jobId === job.id)
              ? "現在の勤務先"
              : "この勤務先に応募する"}
          </button>
          <p className="map-note">
            応募は1時間。能力・経験・企業の採用枠で採否を判定します。通勤は各勤務先と自宅の往復として予約します。
          </p>
        </div>
      )}
      {["shop", "office", "warehouse", "competitor"].includes(p.kind) && !t && (
        <LeaseActions key={p.id} g={g} p={p} />
      )}
      {g.simulation.firms.some((f) => f.id === t) && (
        <div className="map-operation">
          <h3>{g.simulation.firms.find((f) => f.id === t)?.name}</h3>
          <p>
            小売の競合拠点。店舗との距離が近いほど需要の取り合いが強まり、地区の競合密度と合わせて集客を制約します。
          </p>
          <Stats
            items={[
              ["地区競合密度", "×" + d.competition.toFixed(2)],
              [
                "販売価格",
                yen(g.simulation.firms.find((f) => f.id === t)!.price),
              ],
              [
                "実売 / 需要",
                g.simulation.firms.find((f) => f.id === t)!.lastUnits +
                  " / " +
                  g.simulation.firms.find((f) => f.id === t)!.lastDemand,
              ],
              ["競合品質指数", "×" + g.world.competitorQuality.toFixed(2)],
            ]}
          />
        </div>
      )}
      {p.kind === "facility" && (
        <div className="map-operation">
          <h3>日常の場所にする</h3>
          <p>
            {p.facility === "library"
              ? "図書室で学習：デジタル技能＋0.5、満足度＋治安/20。利用料200円。"
              : "公園で休息：健康＋0.8、体力＋4、満足度＋治安/20。利用料無料。"}
            <br />
            滞在1時間＋移動{trip.hours * 2}時間、往復交通費 {yen(trip.fare * 2)}
            。
          </p>
          <div className="map-buttons">
            <button
              className="btn secondary"
              onClick={() => execute("map-favorite", p.id)}
            >
              <Heart size={16} />
              {g.spatial.favorites.includes(p.id)
                ? "日常の施設から解除"
                : "日常の施設に登録"}
            </button>
            <button
              className="btn primary"
              onClick={() => execute("map-visit", p.id)}
            >
              この施設を利用する
            </button>
          </div>
          <p className="map-note">
            登録した施設はマップ下部から選択できます。訪問は手動行動で、勤務や睡眠に必要な時間は使用できません。
          </p>
        </div>
      )}
      {own && own.tenantId !== "player" && (
        <div className="map-operation">
          <h3>現在の賃貸契約</h3>
          <p>
            {own.started}〜 / 月額 {yen(own.rent)} / {own.paidMonth}
            分まで請求済み
          </p>
          <button
            className="btn secondary"
            onClick={() => execute("map-release", p.id)}
          >
            この事業物件を解約する
          </button>
        </div>
      )}
    </section>
  );
}
export default function CityMap({
  g,
  go,
}: {
  g: GameState;
  go: (page: string) => void;
}) {
  const [level, setLevel] = useState<"world" | "city" | "district">("city"),
    [districtId, setDistrict] = useState(homeProperty(g).districtId),
    [selected, setSelected] = useState<string | null>(null),
    [filter, setFilter] = useState("all"),
    [overlay, setOverlay] = useState("places");
  const city = cities.find((c) => c.id === g.spatial.cityId)!,
    d = district(districtId),
    p = selected ? property(selected) : null;
  const select = (p: Property) => {
    setFilter("all");
    setDistrict(p.districtId);
    setLevel("district");
    setSelected(p.id);
  };
  const list = properties.filter(
    (p) => p.districtId === d.id && filtered(g, p, filter),
  );
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width:700px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width:700px)"),
      update = () => setCompact(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const canvasWidth = compact ? 600 : 1000,
    canvasHeight = compact ? 650 : 720;
  const bounds =
    level === "district"
      ? { x: d.x - 1.55, y: d.y - 1, width: 3.1, height: 2.75 }
      : { x: -0.5, y: -0.5, width: 16, height: 12.5 };
  const point = (p: { x: number; y: number }) => ({
    x: ((p.x - bounds.x) / bounds.width) * canvasWidth,
    y: ((p.y - bounds.y) / bounds.height) * canvasHeight,
  });
  const markerName = (p: Property) =>
    p.jobId ? (jobs.find((j) => j.id === p.jobId)?.company ?? p.name) : p.name;
  return (
    <div className="city-page">
      <div className="city-heading">
        <div>
          <span className="eyebrow">A PLACE FOR YOUR LIFE</span>
          <h1>暮らす場所が、未来を変える。</h1>
          <p>住む、働く、事業を育てる。同じ街の中で、次の場所を選ぶ。</p>
        </div>
        <MapPin size={34} />
      </div>
      <div className="city-summary">
        <span>
          <House size={16} />
          <b>{homeProperty(g).name}</b>
        </span>
        <span>
          生活資金 <b>{yen(liquid(g))}</b>
        </span>
        <span>
          勤務 <b>{g.employments.length}件</b>
        </span>
        <span>
          事業物件{" "}
          <b>
            {g.spatial.leases.filter((l) => l.tenantId !== "player").length}件
          </b>
        </span>
      </div>
      <div className="city-breadcrumb">
        <button
          onClick={() => {
            setLevel("world");
            setSelected(null);
          }}
        >
          <Globe size={15} />
          ワールド
        </button>
        <span>›</span>
        <button
          onClick={() => {
            setLevel("city");
            setSelected(null);
          }}
        >
          {city.name}
        </button>
        {level === "district" && (
          <>
            <span>›</span>
            <button onClick={() => setSelected(null)}>{d.name}</button>
          </>
        )}
      </div>
      {level === "world" ? (
        <section className="card city-world">
          <div>
            <span className="tag">1 CITY · {districts.length} DISTRICTS</span>
            <h2>{city.name}</h2>
            <p>学びと働き方が交差する、あなたの生活圏。</p>
            <Stats
              items={[
                ["人口", g.world.population.toLocaleString() + "人"],
                ["平均月収", yen(city.income)],
                ["家賃指数", "×" + city.rentIndex],
                ["賃金指数", "×" + city.wageIndex],
                ["失業率", (city.unemployment * 100).toFixed(1) + "%"],
                ["年成長率（設定値）", (city.growth * 100).toFixed(1) + "%"],
                ["景気", city.economy >= 1 ? "安定" : "減速"],
                [
                  "業界別需要",
                  Object.entries(city.demand)
                    .map(([k, v]) => k + " ×" + v)
                    .join(" / "),
                ],
              ]}
            />
            <button className="btn primary" onClick={() => setLevel("city")}>
              この都市を見る <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="city-world-illustration" aria-hidden="true">
            <Building2 size={120} />
            <span>AOBA CITY</span>
          </div>
          <p className="map-note">
            今回は青葉市のみ。都市のデータ構造は複数都市に対応し、都市間移住は未実装です。人口・地価・家賃相場は企業と雇用の動きに応じて毎月更新されます。
          </p>
        </section>
      ) : (
        <>
          <div className="map-filter" aria-label="マップの表示対象">
            <label>
              情報表示{" "}
              <select
                aria-label="マップ情報表示"
                value={overlay}
                onChange={(e) => setOverlay(e.target.value)}
              >
                <option value="places">施設・店舗</option>
                <option value="population">人口密度</option>
                <option value="land">地価</option>
                <option value="demand">顧客需要</option>
                <option value="jobs">求人</option>
              </select>
            </label>
            {filters.map(([id, label]) => (
              <button
                key={id}
                className={filter === id ? "active" : ""}
                onClick={() => {
                  setFilter(id);
                  setSelected(null);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={"city-map-layout" + (p ? " has-selection" : "")}>
            <div className="city-map-column">
              <section
                className="city-map-frame"
                aria-label={
                  level === "city"
                    ? "青葉市の地区マップ"
                    : d.name + "の物件マップ"
                }
              >
                <div className="map-toolbar">
                  <span>
                    <Layers size={15} />
                    {level === "city" ? "CITY VIEW" : "DISTRICT VIEW"}
                  </span>
                  <b>{level === "city" ? city.name : d.name}</b>
                  {level === "district" && (
                    <button
                      onClick={() => {
                        setLevel("city");
                        setSelected(null);
                      }}
                    >
                      都市全体へ
                    </button>
                  )}
                </div>
                <svg
                  className="city-map-canvas"
                  viewBox={"0 0 " + canvasWidth + " " + canvasHeight}
                  style={{ aspectRatio: canvasWidth + "/" + canvasHeight }}
                  role="group"
                  aria-label="地点を選択できる都市地図"
                >
                  <defs>
                    <pattern
                      id="city-grid"
                      width="40"
                      height="40"
                      patternUnits="userSpaceOnUse"
                    >
                      <path
                        d="M 40 0 H 0 V 40"
                        fill="none"
                        stroke="#e5e9df"
                        strokeWidth="1"
                      />
                    </pattern>
                  </defs>
                  <rect width="1000" height="720" fill="#f1f3eb" />
                  <rect width="1000" height="720" fill="url(#city-grid)" />
                  {level === "city" && (
                    <>
                      <path
                        d="M 0 440 C 250 390, 350 580, 620 480 S 850 550,1000 460"
                        fill="none"
                        stroke="#d4e4e0"
                        strokeWidth="58"
                      />
                      <path
                        d="M 0 440 C 250 390, 350 580, 620 480 S 850 550,1000 460"
                        fill="none"
                        stroke="#e4eeeb"
                        strokeWidth="35"
                      />
                      {districts.slice(1).map((x) => {
                        const a = point(districts[0]),
                          b = point(x);
                        return (
                          <path
                            key={x.id}
                            d={"M " + a.x + " " + a.y + " L " + b.x + " " + b.y}
                            fill="none"
                            stroke="#fff"
                            strokeWidth="13"
                          />
                        );
                      })}
                    </>
                  )}
                  {level === "city" ? (
                    districts.map((x) => {
                      const q = point(x),
                        count = properties.filter(
                          (p) =>
                            p.districtId === x.id && filtered(g, p, filter),
                        ).length;
                      return (
                        <g
                          key={x.id}
                          role="button"
                          tabIndex={0}
                          aria-label={x.name + "を開く"}
                          onClick={() => {
                            setDistrict(x.id);
                            setLevel("district");
                            setSelected(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setDistrict(x.id);
                              setLevel("district");
                              setSelected(null);
                            }
                          }}
                          className="map-district-pin"
                        >
                          <rect
                            x={q.x - (compact ? 65 : 95)}
                            y={q.y - 65}
                            width={compact ? 130 : 190}
                            height="130"
                            rx="20"
                            fill={
                              overlay !== "places"
                                ? `hsl(100 20% ${92 - Math.min(30, overlay === "population" ? districtState(g, x.id).population / 1200 : overlay === "land" ? (x.landPrice * districtState(g, x.id).land) / 20000 : districtState(g, x.id).demand * 15)}%)`
                                : x.id === homeProperty(g).districtId
                                  ? "#e0e9db"
                                  : "#e8eade"
                            }
                            stroke="#d2dbcb"
                          />
                          <circle
                            cx={q.x}
                            cy={q.y - 15}
                            r="20"
                            fill={
                              x.kind === "商業地"
                                ? "#c49c62"
                                : x.kind === "物流・工業地"
                                  ? "#81908c"
                                  : "#729078"
                            }
                          />
                          <text
                            x={q.x}
                            y={q.y - 10}
                            textAnchor="middle"
                            fill="white"
                            fontSize="15"
                          >
                            {x.id === homeProperty(g).districtId ? "住" : "●"}
                          </text>
                          <text
                            x={q.x}
                            y={q.y + 24}
                            textAnchor="middle"
                            fontSize="22"
                            fontWeight="600"
                            fill="#375242"
                          >
                            {x.name}
                          </text>
                          <text
                            x={q.x}
                            y={q.y + 46}
                            textAnchor="middle"
                            fontSize="11"
                            fill="#7d8c78"
                          >
                            {x.kind} · {count}地点
                          </text>
                        </g>
                      );
                    })
                  ) : (
                    <>
                      <path
                        d="M 0 405 H 1000 M 510 0 V 720"
                        stroke="white"
                        strokeWidth="28"
                      />
                      {list.map((p) => {
                        const q = point(p),
                          t = tenant(g, p),
                          isOwn =
                            t === "player" ||
                            g.ventures.some((v) => v.id === t) ||
                            g.companies.some((c) => c.id === t);
                        return (
                          <g
                            key={p.id}
                            role="button"
                            tabIndex={0}
                            aria-label={markerName(p) + "を選択"}
                            onClick={() => select(p)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                select(p);
                              }
                            }}
                            className="map-property-pin"
                          >
                            <circle
                              cx={q.x}
                              cy={q.y}
                              r={compact ? 46 : 32}
                              fill="transparent"
                            />
                            <circle
                              cx={q.x}
                              cy={q.y}
                              r={isOwn ? 23 : 19}
                              fill={
                                g.simulation.firms.some(
                                  (f) =>
                                    f.status === "active" &&
                                    f.sites.includes(p.id),
                                )
                                  ? "#bc7770"
                                  : colors[p.kind]
                              }
                              stroke={selected === p.id ? "#223f31" : "white"}
                              strokeWidth={selected === p.id ? 5 : 3}
                            />
                            <text
                              x={q.x}
                              y={q.y + 5}
                              textAnchor="middle"
                              fill="white"
                              fontSize="20"
                              fontWeight="700"
                            >
                              {isOwn
                                ? "●"
                                : g.simulation.firms.some(
                                      (f) =>
                                        f.status === "active" &&
                                        f.sites.includes(p.id),
                                    )
                                  ? "競"
                                  : glyphs[p.kind]}
                            </text>
                            {!compact && (
                              <text
                                x={q.x}
                                y={q.y + 43}
                                textAnchor="middle"
                                fill="#51634d"
                                fontSize="18"
                              >
                                {p.kind === "home"
                                  ? p.homeStyle === "share"
                                    ? "シェアハウス"
                                    : p.homeStyle === "studio"
                                      ? "ワンルーム"
                                      : "アパート"
                                  : p.jobId
                                    ? jobs
                                        .find((j) => j.id === p.jobId)
                                        ?.company.slice(0, 12)
                                    : p.kind === "facility"
                                      ? p.facility === "park"
                                        ? "公園"
                                        : "図書室"
                                      : p.kind === "competitor"
                                        ? "競合雑貨店"
                                        : kindNames[p.kind]}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </>
                  )}
                  <g transform={"translate(" + (canvasWidth - 45) + " 55)"}>
                    <path d="M 0 -20 L -7 5 L 0 0 L 7 5 Z" fill="#809178" />
                    <text
                      y="24"
                      textAnchor="middle"
                      fill="#809178"
                      fontSize="12"
                    >
                      N
                    </text>
                  </g>
                </svg>
                <div className="map-legend">
                  {[
                    ["#537f69", "自宅・住居"],
                    ["#547ba1", "勤務先"],
                    ["#d3a15b", "事業用物件"],
                    ["#bc7770", "競合"],
                    ["#7b9685", "施設"],
                  ].map(([color, name]) => (
                    <span key={name}>
                      <i style={{ background: color }} />
                      {name}
                    </span>
                  ))}
                </div>
                <p className="map-caption">
                  {level === "city"
                    ? "地区を選んで物件へ。道路・水路は概略図です。"
                    : "● は自分の入居物件。地点を選ぶと詳細と契約操作を表示します。"}
                  <br />
                  経路は地点間距離と平均速度による概算。道路網・鉄道ダイヤの経路探索は未実装です。
                </p>
              </section>
              <section className="card map-locations">
                <h3>
                  <House size={17} /> あなたの生活圏
                </h3>
                <button onClick={() => select(homeProperty(g))}>
                  {homeProperty(g).name}
                  <span>自宅</span>
                </button>
                {g.employments.map((e) => {
                  const p = property("work-" + e.jobId);
                  return (
                    <button key={e.id} onClick={() => select(p)}>
                      {jobs.find((j) => j.id === e.jobId)?.company}
                      <span>片道 {e.commute}h</span>
                    </button>
                  );
                })}
                {g.spatial.leases
                  .filter((l) => l.tenantId !== "player")
                  .map((l) => (
                    <button
                      key={l.propertyId}
                      onClick={() => select(property(l.propertyId))}
                    >
                      {property(l.propertyId).name}
                      <span>
                        {g.ventures.find((v) => v.id === l.tenantId)?.name ??
                          g.companies.find((c) => c.id === l.tenantId)?.name}
                      </span>
                    </button>
                  ))}
                {g.spatial.favorites.map((id) => (
                  <button key={id} onClick={() => select(property(id))}>
                    {property(id).name}
                    <span>日常の施設</span>
                  </button>
                ))}
                <div className="map-buttons">
                  <button
                    className="btn secondary"
                    onClick={() => go("career")}
                  >
                    求人を比較する
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => go("business")}
                  >
                    事業を管理する
                  </button>
                </div>
              </section>
            </div>
            <aside className="city-map-detail">
              {p ? (
                <PropertyDetail
                  key={p.id}
                  g={g}
                  p={p}
                  onClose={() => setSelected(null)}
                />
              ) : (
                <section className="map-district-detail">
                  <span className="eyebrow">
                    {level === "city"
                      ? "EXPLORE THE CITY"
                      : "NEIGHBORHOOD PROFILE"}
                  </span>
                  <h2>{level === "city" ? "次の場所を選ぶ。" : d.name}</h2>
                  {level === "city" ? (
                    <>
                      <p>
                        家賃だけでなく、仕事までの距離や事業の客層も見比べる。6つの地区には異なる日常があります。
                      </p>
                      {districts.map((x) => (
                        <button
                          className="district-list-item"
                          key={x.id}
                          onClick={() => {
                            setDistrict(x.id);
                            setLevel("district");
                          }}
                        >
                          <span>
                            <b>{x.name}</b>
                            <small>
                              {x.kind} /{" "}
                              {overlay === "population"
                                ? districtState(
                                    g,
                                    x.id,
                                  ).population.toLocaleString() + "人"
                                : overlay === "land"
                                  ? yen(
                                      x.landPrice * districtState(g, x.id).land,
                                    ) + " / ㎡"
                                  : overlay === "demand"
                                    ? "需要 ×" +
                                      districtState(g, x.id).demand.toFixed(3)
                                    : overlay === "jobs"
                                      ? g.vacancies
                                          .filter(
                                            (v) =>
                                              properties.find(
                                                (p) => p.jobId === v.jobId,
                                              )?.districtId === x.id,
                                          )
                                          .reduce((n, v) => n + v.openings, 0) +
                                        "枠"
                                      : x.customers.join("・")}
                            </small>
                          </span>
                          <strong>家賃 ×{x.rentIndex.toFixed(2)}</strong>
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      <p>
                        {d.kind} / 主な客層 {d.customers.join("・")}
                      </p>
                      <Stats
                        items={[
                          ["昼人口", d.dayPopulation.toLocaleString() + "人"],
                          [
                            "夜人口",
                            districtState(g, d.id).population.toLocaleString() +
                              "人",
                          ],
                          ["人通り指数", String(d.footfall)],
                          [
                            "家賃水準",
                            "×" +
                              (
                                d.rentIndex * districtState(g, d.id).rent
                              ).toFixed(2),
                          ],
                          [
                            "地価 / ㎡",
                            yen(d.landPrice * districtState(g, d.id).land),
                          ],
                          ["治安", d.safety + " / 100"],
                          ["ブランド適性", "×" + d.brandFit.toFixed(2)],
                          ["競合密度", "×" + d.competition.toFixed(2)],
                          [
                            "所得 / 賃金",
                            "×" + d.incomeIndex + " / ×" + d.wageIndex,
                          ],
                        ]}
                      />
                      <h3>この地区の地点</h3>
                      <div className="district-property-list">
                        {list.map((p) => (
                          <button key={p.id} onClick={() => select(p)}>
                            <i style={{ background: colors[p.kind] }}>
                              {glyphs[p.kind]}
                            </i>
                            <span>
                              {markerName(p)}
                              <small>
                                {kindNames[p.kind]} /{" "}
                                {tenant(g, p)
                                  ? "入居中"
                                  : yen(quotedRent(g, p)) + "・月"}
                              </small>
                            </span>
                            <ArrowUpRight size={15} />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
