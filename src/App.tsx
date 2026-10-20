import { lazy, Suspense } from "react";
import { LocationSummary } from "./ui/LocationSummary";
const LifeJourney = lazy(() => import("./ui/LifeJourney"));
const SecuritiesPanel = lazy(() => import("./ui/SecuritiesPanel"));
const WorldPanel = lazy(() => import("./ui/WorldPanel"));
const CityMap = lazy(() => import("./ui/CityMap"));
import { personalEnterpriseProfit } from "./engine/enterprise/accounting";
import { EnterprisePanel, CompanyPanel } from "./ui/Phase2";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight,
  Sun,
  Leaf,
  LayoutDashboard,
  BriefcaseBusiness,
  Store,
  Wallet,
  BookOpen,
  House,
  Settings,
  ChevronRight,
  CalendarDays,
  Play,
  Check,
  Plus,
  Pause,
  Download,
  Upload,
  TrendingUp,
  Heart,
  Zap,
  Menu,
  MapPin,
  X,
  Coffee,
  Sprout,
  Building2,
  Clock,
  ArrowLeft,
} from "lucide-react";
import type { ReactNode } from "react";
import type { Action, GameState } from "./engine/types";
import { useGame } from "./store";
import { age, skillNames } from "./engine/person";
import { jobs } from "./engine/career";
import { industries, investmentCost } from "./engine/business";
import { housing, home } from "./engine/life";
import { netWorth, liquid } from "./engine/finance";
import {
  CareerPanel,
  ShiftsPanel,
  CalendarPanel,
  FinancePanel,
  SkillsPanel,
  RelationsPanel,
  LifePanel,
  ActionsPanel,
  ReportsPanel,
  PhaseSummary,
} from "./ui/Phase1";
import { dailyActions, actionUnavailable } from "./engine/actions";
import { weekday } from "./engine/time";
import { listSaves } from "./persistence";
import type { SaveSlot } from "./persistence";
const yen = (v: number) => "¥" + Math.round(v).toLocaleString("ja-JP");
const nav = [
  { id: "overview", label: "ダッシュボード", icon: LayoutDashboard },
  { id: "world", label: "世界・都市経済", icon: TrendingUp },
  { id: "map", label: "都市マップ", icon: MapPin },
  { id: "career", label: "仕事を探す", icon: BriefcaseBusiness },
  { id: "shifts", label: "仕事・シフト管理", icon: Clock },
  { id: "calendar", label: "カレンダー", icon: CalendarDays },
  { id: "business", label: "事業を営む", icon: Store },
  { id: "companies", label: "会社・所有権", icon: Building2 },
  { id: "securities", label: "証券・投資", icon: TrendingUp },
  { id: "finance", label: "資産と収支", icon: Wallet },
  { id: "skills", label: "学びとスキル", icon: BookOpen },
  { id: "life", label: "暮らし", icon: House },
  { id: "journey", label: "人生・目標", icon: Sprout },
  { id: "relations", label: "人間関係", icon: Heart },
  { id: "actions", label: "行動メニュー", icon: Plus },
  { id: "reports", label: "日次・月次レポート", icon: BookOpen },
];
const actions = dailyActions().map((a) => ({
  id: a.id,
  label: a.label,
  description: a.result,
}));
const currentAction = (g: GameState) =>
  [0, 6].includes(weekday(g.date))
    ? g.routine.weekendAction
    : g.routine.weekdayAction;

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={"card " + className}>{children}</section>;
}
function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}
function Meter({ value, color = "green" }: { value: number; color?: string }) {
  return (
    <div className={"meter " + color}>
      <span style={{ width: value + "%" }} />
    </div>
  );
}
function Chart({ game }: { game: GameState }) {
  const history = game.history.slice(-30),
    values =
      history.length > 1
        ? history.map((h) => h.cash + h.bank)
        : [
            history[0] ? history[0].cash + history[0].bank : liquid(game),
            history[0] ? history[0].cash + history[0].bank : liquid(game),
          ];
  const min = Math.min(...values) * 0.8,
    max = Math.max(...values) * 1.1 + 1;
  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1 || 1)) * 600},${135 - ((v - min) / (max - min)) * 105}`,
    )
    .join(" ");
  return (
    <div className="chart" aria-label="直近30日の生活資金推移">
      <div className="chart-labels">
        <span>{yen(max)}</span>
        <span>{yen((max + min) / 2)}</span>
        <span>{yen(min)}</span>
      </div>
      <svg
        viewBox="0 0 600 155"
        preserveAspectRatio="none"
        role="img"
        aria-label={`生活資金残高 ${yen(liquid(game))}`}
      >
        <defs>
          <linearGradient id="chartfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#53856c" stopOpacity=".22" />
            <stop offset="100%" stopColor="#53856c" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[30, 80, 130].map((y) => (
          <line
            key={y}
            x1="0"
            x2="600"
            y1={y}
            y2={y}
            stroke="#e7ebe5"
            strokeDasharray="3 5"
          />
        ))}
        <polygon points={`0,155 ${points} 600,155`} fill="url(#chartfill)" />
        <polyline
          points={points}
          fill="none"
          stroke="#4e8066"
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="chart-dates">
        <span>
          {history[0]?.date.slice(5).replace("-", " / ") ?? "記録開始"}
        </span>
        <span>直近30日</span>
        <span>
          {history.at(-1)?.date.slice(5).replace("-", " / ") ?? "今日"}
        </span>
      </div>
    </div>
  );
}
function Start({ onStart = () => {} }: { onStart?: () => void }) {
  const { start, load, error, clearError } = useGame();
  const [name, setName] = useState("青葉 はる");
  const [condition, setCondition] = useState<
    "standard" | "challenge" | "comfortable"
  >("standard");
  const [slot, setSlot] = useState(1);
  const [saves, setSaves] = useState<SaveSlot[]>([]);
  const [replace, setReplace] = useState(false);
  useEffect(() => {
    listSaves()
      .then(setSaves)
      .catch(() => {});
  }, []);
  return (
    <div className="start-screen">
      <div className="start-story">
        <div className="brand">
          <span className="brand-mark">
            <Sprout />
          </span>
          life<span className="brand-thin">simulator</span>
          <small>小さな選択から、大きな人生へ。</small>
        </div>
        <div className="start-copy">
          <span className="eyebrow">YOUR LIFE, YOUR PACE</span>
          <h1>
            まだ何者でもない。
            <br />
            だから、<em>何にでもなれる。</em>
          </h1>
          <p>
            働く、学ぶ、小さな夢を始める。
            <br />
            決まった正解のない、あなただけの人生。
          </p>
          <div className="scene">
            <div className="scene-sun" />
            <div className="scene-hill hill-back" />
            <div className="scene-hill hill-front" />
            <div className="scene-house">
              <div className="roof" />
              <div className="windows">
                <i />
                <i />
                <i />
              </div>
              <div className="door" />
            </div>
            <div className="scene-tree tree1" />
            <div className="scene-tree tree2" />
            <span className="scene-road" />
          </div>
        </div>
        <small className="start-foot">
          LIFE SIMULATOR <span>青葉市から、はじまる。</span>
        </small>
      </div>
      <main className="start-form">
        <span className="eyebrow">A NEW CHAPTER</span>
        <h2>新しい人生をはじめる</h2>
        <p className="muted">急がなくて大丈夫。ここから、少しずつ。</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (saves.some((s) => s.id === slot) && !replace) {
              setReplace(true);
              return;
            }
            start(name, condition, slot);
            if (useGame.getState().game && !useGame.getState().error) onStart();
          }}
        >
          <label>
            あなたの名前
            <input
              aria-label="あなたの名前"
              value={name}
              maxLength={24}
              required
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            はじめの暮らし
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as typeof condition)}
            >
              <option value="standard">標準 — 生活資金 ¥50,000</option>
              <option value="challenge">挑戦 — 生活資金 ¥20,000</option>
              <option value="comfortable">余裕 — 生活資金 ¥100,000</option>
            </select>
          </label>
          <div className="start-note">
            <House size={18} />
            <span>
              18歳・青葉市のシェアハウスから。
              <br />
              開始時に入居月の家賃 ¥24,000 を精算します。
            </span>
          </div>
          <label>
            セーブスロット
            <select
              value={slot}
              onChange={(e) => {
                setSlot(Number(e.target.value));
                setReplace(false);
              }}
            >
              {[1, 2, 3].map((id) => (
                <option key={id} value={id}>
                  スロット {id}
                  {saves.some((s) => s.id === id)
                    ? "（保存データあり）"
                    : "（空き）"}
                </option>
              ))}
            </select>
          </label>
          {replace && (
            <p className="warning">
              スロット {slot}{" "}
              の保存データを上書きします。もう一度「人生をはじめる」を押すと開始します。
            </p>
          )}
          <button className="primary full" type="submit">
            人生をはじめる <ArrowRight size={18} />
          </button>
        </form>
        {error && (
          <div role="alert" className="warning">
            {error}
            <button onClick={clearError}>閉じる</button>
          </div>
        )}
        <div className="saved-list">
          {saves.map((s) => (
            <button
              key={s.id}
              onClick={async () => {
                await load(s.id);
                if (!useGame.getState().error) onStart();
              }}
            >
              <span>
                スロット {s.id} · {s.state.person.name}
                <small>
                  {s.state.date} / {yen(s.state.cash + s.state.bank)}
                </small>
              </span>
              <span>
                つづきから <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>
        <p className="start-bottom">
          <Leaf size={15} /> 目標も、期限もない。あなたのペースで。
        </p>
      </main>
    </div>
  );
}
function Overview({ g, go }: { g: GameState; go: (s: string) => void }) {
  const { act } = useGame(),
    j = jobs.find((j) => j.id === g.employment?.jobId),
    b = g.business,
    i = industries.find((i) => i.id === b?.industryId),
    last = g.history.at(-1);
  return (
    <>
      <div className="welcome">
        <div>
          <span className="eyebrow">EVERY DAY IS A NEW POSSIBILITY</span>
          <h1>おかえりなさい、{g.person.name.split(" ")[0]}さん。</h1>
          <p>小さな一歩が、これからの人生をつくります。</p>
        </div>
        <div className="weather">
          <Sun size={30} />
          <span>
            青葉市
            <small>
              {
                [
                  "冬",
                  "冬",
                  "春",
                  "春",
                  "春",
                  "夏",
                  "夏",
                  "夏",
                  "秋",
                  "秋",
                  "秋",
                  "冬",
                ][Number(g.date.slice(5, 7)) - 1]
              }
              の暮らし
            </small>
          </span>
        </div>
      </div>
      <div className="stats">
        <Card>
          <span className="stat-label">
            <Wallet size={16} />
            生活資金
          </span>
          <strong data-testid="cash">{yen(liquid(g))}</strong>
          <small>
            {g.debt > 0
              ? `未払債務 ${yen(g.debt)}`
              : "毎日の積み重ねを、大切に。"}
          </small>
        </Card>
        <Card>
          <span className="stat-label">
            <BriefcaseBusiness size={16} />
            未払給与
          </span>
          <strong>
            {yen(g.employments.reduce((sum, e) => sum + e.accrued, 0))}
          </strong>
          <small>
            <span className="dot" />
            契約別の給与日に銀行へ入金
          </small>
        </Card>
        <Card>
          <span className="stat-label">
            <TrendingUp size={16} />
            事業の累計利益
          </span>
          <strong>
            {yen(g.totals.businessProfit + personalEnterpriseProfit(g))}
          </strong>
          <small>{b ? i?.name : "あなたの可能性は、これから。"}</small>
        </Card>
        <Card>
          <span className="stat-label">
            <Heart size={16} />
            コンディション
          </span>
          <div className="condition">
            <span>
              健康 <b>{Math.round(g.person.health)}</b>
            </span>
            <Meter value={g.person.health} />
            <span>
              体力 <b>{Math.round(g.person.energy)}</b>
            </span>
            <Meter value={g.person.energy} color="orange" />
          </div>
        </Card>
      </div>
      <PhaseSummary g={g} go={go} />
      <div className="dashboard-grid">
        <div className="main-column">
          <Card>
            <div className="section-head">
              <div>
                <span className="eyebrow">YOUR NEXT STEP</span>
                <h2>今日を、どう過ごす？</h2>
              </div>
              <span className="quiet-label">平日・休日の一括設定</span>
            </div>
            <p className="muted description">
              選ぶと平日・休日の方針をまとめて変更します。詳細は行動メニューへ。
            </p>
            <div className="action-grid">
              {actions.map((a) => (
                <button
                  key={a.id}
                  className={
                    "action-choice " +
                    (currentAction(g) === a.id ? "selected" : "")
                  }
                  disabled={!!actionUnavailable(g, a.id)}
                  onClick={() => act({ type: "action", action: a.id })}
                >
                  <span className="action-icon">
                    {a.id === "rest" ? (
                      <Coffee size={20} />
                    ) : a.id === "business" ? (
                      <Store size={20} />
                    ) : (
                      <BookOpen size={20} />
                    )}
                  </span>
                  <span>
                    {a.label}
                    <small>{a.description}</small>
                  </span>
                  {currentAction(g) === a.id && <Check size={16} />}
                </button>
              ))}
            </div>
            <div className="time-note">
              <Clock size={15} />
              <span>
                {"勤務契約 " +
                  g.employments.length +
                  "件 / 余暇は平日 " +
                  g.routine.activityHours +
                  "h・土日 " +
                  g.routine.weekendHours +
                  "h（空き時間まで）"}
              </span>
            </div>
          </Card>
          <Card>
            <div className="section-head">
              <div>
                <span className="eyebrow">A LITTLE MORE EACH DAY</span>
                <h2>お金の歩み</h2>
              </div>
              <button className="text-button" onClick={() => go("finance")}>
                収支の詳細 <ArrowUpRight size={15} />
              </button>
            </div>
            <div className="chart-heading">
              <strong>{yen(liquid(g))}</strong>
              <span>生活資金残高</span>
            </div>
            <Chart game={g} />
          </Card>
          <div className="two-cards">
            <Card>
              <div className="mini-head">
                <span className="square-icon">
                  <BriefcaseBusiness size={20} />
                </span>
                <Tag>{j ? "就業中" : "これから"}</Tag>
              </div>
              <h3>{j?.name ?? "最初の仕事を見つけよう"}</h3>
              <p>{j ? j.company : "あなたにできることから、一歩ずつ。"}</p>
              <div className="mini-value">
                {j ? (
                  <>
                    <b>{yen(j.wage)}</b>
                    <span> / 時間</span>
                  </>
                ) : (
                  <span>未経験から応募できます</span>
                )}
              </div>
              <button
                className="outline full"
                onClick={() => go(j ? "shifts" : "career")}
              >
                {j ? "勤務状況を見る" : "求人を探す"}
                <ArrowRight size={16} />
              </button>
            </Card>
            <Card>
              <div className="mini-head">
                <span className="square-icon orange">
                  <Store size={20} />
                </span>
                <Tag>
                  {b ? (b.active ? "運営中" : "休業中") : "可能性を広げる"}
                </Tag>
              </div>
              <h3>{i?.name ?? "小さな事業、大きな一歩。"}</h3>
              <p>
                {b
                  ? "自分のアイデアを、誰かの価値に。"
                  : "得意なことを、あなたの仕事に。"}
              </p>
              <div className="mini-value">
                {b ? (
                  <>
                    <b>{yen(b.last.revenue)}</b>
                    <span> / 前日の売上</span>
                  </>
                ) : (
                  <span>開業資金 ¥20,000 から</span>
                )}
              </div>
              <button className="outline full" onClick={() => go("business")}>
                {b ? "事業を管理する" : "事業をはじめる"}
                <ArrowRight size={16} />
              </button>
            </Card>
          </div>
        </div>
        <aside className="right-column">
          <Card className="profile-card">
            <div className="profile-top">
              <div className="avatar">{g.person.name.slice(0, 1)}</div>
              <div>
                <h3>{g.person.name}</h3>
                <p>{age(g.person, g.date)}歳 · 青葉市</p>
              </div>
              <Leaf size={20} />
            </div>
            <div className="profile-detail">
              <span>住まい</span>
              <b>{home(g).name}</b>
            </div>
            <div className="profile-detail">
              <span>仕事</span>
              <b>
                {j
                  ? j.name +
                    (g.employments.length > 1
                      ? " ほか" + (g.employments.length - 1) + "件"
                      : "")
                  : "自由な暮らし"}
              </b>
            </div>
            <div className="profile-detail">
              <span>人生の歩み</span>
              <b>{g.days} 日目</b>
            </div>
            <div className="skills-head">
              <h4>身につけたスキル</h4>
              <button
                className="text-button"
                aria-label="スキルを見る"
                onClick={() => go("skills")}
              >
                <ArrowUpRight size={16} />
              </button>
            </div>
            {Object.entries(skillNames).map(([key, label]) => (
              <div className="skill-mini" key={key}>
                <div>
                  <span>{label}</span>
                  <span>
                    Lv.{" "}
                    {Math.floor(
                      g.person.skills[key as keyof typeof skillNames],
                    )}
                  </span>
                </div>
                <Meter
                  value={g.person.skills[key as keyof typeof skillNames]}
                />
              </div>
            ))}
          </Card>
          <Card className="journal">
            <div className="section-head">
              <h3>日々の記録</h3>
              <BookOpen size={17} />
            </div>
            {last && (
              <div className="journal-entry">
                <span className="journal-dot" />
                <div>
                  <small>{last.date}</small>
                  <p>
                    {last.earned
                      ? `仕事に取り組み、${yen(last.earned)} の給与が発生しました。`
                      : "自分のペースで、一日を過ごしました。"}
                  </p>
                  {last.sales > 0 && (
                    <p>事業で {yen(last.sales)} を売り上げました。</p>
                  )}
                </div>
              </div>
            )}
            {g.notices.slice(0, 3).map((n, index) => (
              <div className="journal-entry" key={index}>
                <span className="journal-dot" />
                <div>
                  <small>
                    {index === 0 ? "最近の出来事" : "これまでの歩み"}
                  </small>
                  <p>{n}</p>
                </div>
              </div>
            ))}
          </Card>
          <div className="quote">
            <Sprout size={25} />
            <p>
              大きな変化も、
              <br />
              小さな日々の積み重ねから。
            </p>
            <small>TAKE YOUR TIME.</small>
          </div>
        </aside>
      </div>
    </>
  );
}
function Career({ g }: { g: GameState }) {
  return <CareerPanel g={g} />;
}
function Business({ g }: { g: GameState }) {
  const { act } = useGame(),
    b = g.business;
  const [price, setPrice] = useState(String(b?.price ?? 2500));
  const [closing, setClosing] = useState(false);
  const i = industries.find((i) => i.id === b?.industryId);
  if (!b || !i)
    return (
      <>
        <PageTitle
          eyebrow="BUILD SOMETHING OF YOUR OWN"
          title="得意なことを、仕事に。"
          description="小さく始めて、少しずつ育てる。仕事との両立もできます。"
        />
        <div className="listing-grid business-list">
          {industries.map((i) => (
            <Card key={i.id}>
              <div className={"industry-art " + i.id}>
                {i.id === "writing" ? (
                  <BookOpen size={65} />
                ) : (
                  <Coffee size={65} />
                )}
                <span>
                  {i.id === "writing" ? "WORDS TO VALUE" : "BAKED WITH CARE"}
                </span>
              </div>
              <Tag>個人事業</Tag>
              <h2>{i.name}</h2>
              <p>{i.description}</p>
              <div className="business-spec">
                <span>
                  開業費 <b>{yen(i.setup)}</b>
                </span>
                <span>
                  商品・サービス <b>{i.product}</b>
                </span>
                <span>
                  基準単価 <b>{yen(i.basePrice)}</b>
                </span>
                <span>
                  材料費 / 固定費{" "}
                  <b>
                    {yen(i.unitCost)} / {yen(i.fixedCost)}・稼働日
                  </b>
                </span>
              </div>
              <button
                className="primary full"
                disabled={liquid(g) < i.setup}
                onClick={() => act({ type: "open", industryId: i.id })}
              >
                {liquid(g) < i.setup
                  ? "開業資金が不足しています"
                  : "この事業をはじめる"}
                <Plus size={17} />
              </button>
            </Card>
          ))}
        </div>
        <div className="info-panel">
          <Sprout />
          <p>
            開業すると余暇の行動が「事業に取り組む」に切り替わります。価格・品質・地域需要・生産能力に応じて商品が売れます。開業費は設備として保有し、売上や営業利益とは分けて記録します。
          </p>
        </div>
      </>
    );
  return (
    <>
      <PageTitle
        eyebrow="YOUR SMALL BUSINESS"
        title={i.name}
        description="誰かの役に立つことを、少しずつ大きく。"
      />
      <div className="business-status">
        <Tag>{b.active ? "運営中" : "休業中"}</Tag>
        <span>
          設備 Lv.{b.level} · {i.product}
        </span>
        <button className="outline" onClick={() => act({ type: "toggle" })}>
          {b.active ? <Pause size={15} /> : <Play size={15} />}{" "}
          {b.active ? "休業する" : "再開する"}
        </button>
      </div>
      {g.action !== "business" && (
        <div className="warning">
          現在の余暇は「{actions.find((a) => a.id === currentAction(g))?.label}
          」です。販売には事業の行動が必要です。
          <button onClick={() => act({ type: "action", action: "business" })}>
            事業に取り組む
          </button>
        </div>
      )}
      <div className="stats three">
        <Card>
          <span className="stat-label">累計売上</span>
          <strong>{yen(b.revenue)}</strong>
          <small>{b.units} 件を販売</small>
        </Card>
        <Card>
          <span className="stat-label">累計営業利益</span>
          <strong>{yen(b.revenue - b.costs)}</strong>
          <small>売上 − 材料費 − 運営費（税引前）</small>
        </Card>
        <Card>
          <span className="stat-label">前日の利益</span>
          <strong>{yen(b.last.profit)}</strong>
          <small>開業費・設備投資は含みません</small>
        </Card>
      </div>
      <div className="two-cards">
        <Card>
          <h2>前日の販売レポート</h2>
          <div className="business-spec">
            <span>
              地域からの注文 <b>{b.last.demand} 件</b>
            </span>
            <span>
              生産能力 <b>{b.last.capacity} 件</b>
            </span>
            <span>
              実際の販売 <b>{b.last.units} 件</b>
            </span>
            <span>
              売上 <b>{yen(b.last.revenue)}</b>
            </span>
            <span>
              材料費・運営費 <b>{yen(b.last.costs)}</b>
            </span>
            <span>
              営業利益 <b>{yen(b.last.profit)}</b>
            </span>
          </div>
          <p className="muted">
            販売数は注文・生産能力・材料費を払える資金で決まります。生活スケジュールで設定した余暇時間を使います。未稼働日は0件です。
          </p>
        </Card>
        <Card>
          <h2>事業を育てる</h2>
          <label>
            販売価格（円）
            <div className="input-row">
              <input
                aria-label="販売価格"
                type="number"
                value={price}
                min="100"
                max="100000"
                onChange={(e) => setPrice(e.target.value)}
              />
              <button
                className="outline"
                onClick={() => act({ type: "price", price: Number(price) })}
              >
                価格を変更
              </button>
            </div>
          </label>
          <p className="muted">
            現在の単価 {yen(b.price)}。基準価格 {yen(i.basePrice)}{" "}
            より上げると需要が下がります。
          </p>
          <hr />
          <h3>設備へ再投資</h3>
          <p>
            生産能力を初期値の50%分追加。需要が供給を上回るときに効果があります。
          </p>
          <button
            className="primary full"
            disabled={liquid(g) < investmentCost(g)}
            onClick={() => act({ type: "invest" })}
          >
            設備を拡張する · {yen(investmentCost(g))}
            <TrendingUp size={17} />
          </button>
          <hr />
          <button
            className="text-button danger"
            onClick={() =>
              closing
                ? (act({ type: "close" }), setClosing(false))
                : setClosing(true)
            }
          >
            {closing ? "設備を手放し、廃業する" : "この事業を廃業する"}
          </button>
          {closing && (
            <>
              <p className="warning">
                設備の売却収入はありません。これまでの収益記録は資産画面に残ります。
              </p>
              <button className="text-button" onClick={() => setClosing(false)}>
                キャンセル
              </button>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-title">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function Finance({ g }: { g: GameState }) {
  return <FinancePanel g={g} />;
}
function Skills({ g }: { g: GameState }) {
  return <SkillsPanel g={g} />;
}
function Life({ g }: { g: GameState }) {
  return <LifePanel g={g} />;
}
function Saves({ g, onBack }: { g: GameState; onBack: () => void }) {
  const { slot, save, load, importGame } = useGame();
  const [saves, setSaves] = useState<SaveSlot[]>([]);
  const [target, setTarget] = useState(slot);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const refresh = () =>
    listSaves()
      .then(setSaves)
      .catch(() => setMessage("保存一覧を取得できませんでした"));
  useEffect(() => {
    void refresh();
  }, []);
  const download = () => {
    const blob = new Blob([JSON.stringify(g, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `life-${g.person.name}-${g.date}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <>
      <PageTitle
        eyebrow="KEEP YOUR STORY"
        title="人生の記録を、残す。"
        description="このブラウザに自動保存します。大切な記録はJSONでも保管できます。"
      />
      <Card>
        <h2>セーブスロット</h2>
        <p>現在はスロット {slot} に操作ごとに自動保存しています。</p>
        {[1, 2, 3].map((id) => {
          const s = saves.find((s) => s.id === id);
          return (
            <div className="save-row" key={id}>
              <span className="square-icon">{id}</span>
              <div>
                <b>
                  {s?.state.person.name ?? "空のスロット"}{" "}
                  {id === slot && <Tag>使用中</Tag>}
                </b>
                <small>
                  {s
                    ? `${s.state.date} · ${yen(s.state.cash + s.state.bank)}`
                    : "新しい人生の開始画面で選べます"}
                </small>
              </div>
              <button
                className="outline"
                disabled={!s}
                onClick={async () => {
                  if (confirm !== id) {
                    setConfirm(id);
                    return;
                  }
                  await load(id);
                  onBack();
                }}
              >
                {confirm === id ? "読み込みを確定" : "読み込む"}
              </button>
            </div>
          );
        })}
        <button
          className="primary"
          onClick={async () => {
            await save();
            await refresh();
            setMessage(
              "保存処理を実行しました。画面左下の保存状態を確認してください。",
            );
          }}
        >
          今すぐ保存
        </button>
        <p className="muted">
          読み込みは現在の人生を切り替えます。消去や上書きが必要な場合は、先にJSONを書き出してください。
        </p>
      </Card>
      <Card className="mt">
        <h2>バックアップ</h2>
        <p>
          端末やブラウザを変える場合は、ファイルを書き出して読み込んでください。
        </p>
        <button className="outline" onClick={download}>
          <Download size={16} /> JSONを書き出す
        </button>
        <label className="import-label">
          読み込み先
          <select
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          >
            {[1, 2, 3].map((id) => (
              <option key={id} value={id}>
                スロット {id}
              </option>
            ))}
          </select>
        </label>
        <label className="file-upload">
          <Upload size={16} /> JSONを選択して取り込む
          <input
            aria-label="JSONを取り込む"
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 16000000) {
                setMessage("ファイルは16MB以内にしてください");
                return;
              }
              setMessage(
                "取り込み先のスロットは、ファイルの選択で上書きされます。",
              );
              await importGame(await file.text(), target);
              await refresh();
              e.target.value = "";
            }}
          />
        </label>
        <p className="warning">
          ファイルを選択すると、読み込み先のスロットを上書きします。
        </p>
        {message && <p role="status">{message}</p>}
      </Card>
      <Card className="mt">
        <h2>実装範囲について</h2>
        <p>
          v0.7 ·
          24時間の生活、掛け持ち勤務、学習・昇給・昇格、交流、借入、個人事業、会社、都市マップ、企業AI、人生目標、年表、交際・結婚・基本的な子育てと共同会計、225社・45業界の証券売買・指数・ファンド・IPO、旧セーブ移行を実装しています。
        </p>
        <p className="muted">
          2000〜3000社への世界拡張・為替、M&A、税・社会保険、共同創業、離婚・相続・学校制度、複数都市への移住は未実装です。年齢や事業の赤字による強制終了はありません。
        </p>
      </Card>
    </>
  );
}
export default function App() {
  const { game: g, act, error, clearError, saving, saved } = useGame();
  const [page, setPage] = useState("overview"),
    [mobile, setMobile] = useState(false),
    [newLife, setNewLife] = useState(false);
  if (!g || newLife)
    return (
      <>
        {g && (
          <button
            className="back-floating outline"
            onClick={() => setNewLife(false)}
          >
            <ArrowLeft size={16} /> 今の人生に戻る
          </button>
        )}
        <Start
          onStart={() => {
            setNewLife(false);
            setPage("overview");
            window.scrollTo(0, 0);
          }}
        />
      </>
    );
  const go = (id: string) => {
    setPage(id);
    setMobile(false);
    window.scrollTo(0, 0);
  };
  const d = new Date(g.date + "T00:00:00Z");
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <div className="brand">
          <span className="brand-mark">
            <Sprout size={24} />
          </span>
          <span>
            life<span className="brand-thin">simulator</span>
          </span>
          <small>自分らしい人生を、少しずつ。</small>
        </div>
        <span className="nav-caption">MY LIFE</span>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={19} />
              {n.label}
              {page === n.id && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="city-note">
            <span className="dot" />
            青葉市の経済<small>景況感は安定しています</small>
          </div>
          <button
            className={page === "settings" ? "active" : ""}
            onClick={() => go("settings")}
          >
            <Settings size={18} />
            セーブ・設定
          </button>
          <button
            onClick={() => {
              setNewLife(true);
              setMobile(false);
            }}
          >
            <Plus size={18} />
            別の人生をはじめる
          </button>
          <div className="save-status">
            <span className="dot" />
            {saving ? "保存中…" : saved ? "自動保存済み" : "未保存"}
            <span>v0.7</span>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-overlay"
          aria-label="メニューを閉じる"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              aria-label="メニュー"
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X /> : <Menu />}
            </button>
            <span>マイライフ</span>
            <ChevronRight size={13} />
            <b>{nav.find((n) => n.id === page)?.label ?? "セーブ・設定"}</b>
          </div>
          <div className="top-date">
            <CalendarDays size={16} />
            {d.getUTCFullYear()}年 {d.getUTCMonth() + 1}月 {d.getUTCDate()}日{" "}
            <span>（{"日月火水木金土"[d.getUTCDay()]}）</span>
            <Tag>DAY {g.days + 1}</Tag>
          </div>
        </header>
        <main className="content">
          {error && (
            <div className="warning error-banner" role="alert">
              {error}
              <button aria-label="エラーを閉じる" onClick={clearError}>
                <X size={17} />
              </button>
            </div>
          )}
          {page === "overview" ? (
            <>
              <LocationSummary g={g} onMap={() => go("map")} />
              <Overview g={g} go={go} />
            </>
          ) : page === "map" ? (
            <Suspense fallback={<p>都市マップを読み込んでいます…</p>}>
              <CityMap g={g} go={go} />
            </Suspense>
          ) : page === "world" ? (
            <Suspense fallback={<p>世界の情報を読み込んでいます…</p>}>
              <WorldPanel g={g} go={go} />
            </Suspense>
          ) : page === "securities" ? (
            <Suspense fallback={<p>市場を読み込み中…</p>}>
              <SecuritiesPanel g={g} />
            </Suspense>
          ) : page === "career" ? (
            <Career g={g} />
          ) : page === "shifts" ? (
            <ShiftsPanel g={g} />
          ) : page === "calendar" ? (
            <CalendarPanel g={g} />
          ) : page === "journey" ? (
            <Suspense fallback={<p>人生の記録を読み込んでいます…</p>}>
              <LifeJourney g={g} go={go} />
            </Suspense>
          ) : page === "relations" ? (
            <RelationsPanel g={g} />
          ) : page === "actions" ? (
            <ActionsPanel
              key={
                g.date +
                g.routine.sleepHours +
                g.routine.weekdayAction +
                g.routine.weekendAction +
                g.routine.socialTarget
              }
              g={g}
            />
          ) : page === "reports" ? (
            <ReportsPanel g={g} />
          ) : page === "business" ? (
            <>
              <EnterprisePanel g={g} onMap={() => go("map")} />
              <div className="legacy-business">
                <span className="eyebrow">PHASE 0 / 1 COMPATIBILITY</span>
                <p>
                  既存の制作・食品事業：従来の自動行動「事業に取り組む」で運営します。新しい副業とは別の予定を選択できます。
                </p>
                <Business key={g.business?.industryId ?? "none"} g={g} />
              </div>
            </>
          ) : page === "companies" ? (
            <CompanyPanel g={g} onMap={() => go("map")} />
          ) : page === "finance" ? (
            <Finance g={g} />
          ) : page === "skills" ? (
            <Skills g={g} />
          ) : page === "life" ? (
            <Life g={g} />
          ) : (
            <Saves g={g} onBack={() => go("overview")} />
          )}
          <footer className="page-footer">
            <span>あなたのペースで、あなたの人生を。</span>
            <span>LIFE SIMULATOR · PHASE 6</span>
          </footer>
        </main>
        <div className="time-dock">
          <div>
            <span className="dock-icon">
              <Sun size={20} />
            </span>
            <span>
              <b>明日へ、一歩。</b>
              <small>
                余暇：{actions.find((a) => a.id === currentAction(g))?.label}
              </small>
            </span>
          </div>
          <div className="time-buttons">
            <button
              className="outline"
              onClick={() => act({ type: "advance", days: 7 })}
            >
              7日進める
            </button>
            <button
              className="outline"
              onClick={() => act({ type: "advance", days: 30 })}
            >
              30日進める
            </button>
            <button
              className="primary"
              onClick={() => act({ type: "advance", days: 1 })}
            >
              <Play size={15} fill="currentColor" />
              1日進める
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
