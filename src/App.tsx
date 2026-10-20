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
import { netWorth } from "./engine/finance";
import { listSaves } from "./persistence";
import type { SaveSlot } from "./persistence";
const yen = (v: number) => "¥" + Math.round(v).toLocaleString("ja-JP");
const nav = [
  { id: "overview", label: "ダッシュボード", icon: LayoutDashboard },
  { id: "career", label: "仕事を探す", icon: BriefcaseBusiness },
  { id: "business", label: "事業を営む", icon: Store },
  { id: "finance", label: "資産と収支", icon: Wallet },
  { id: "skills", label: "学びとスキル", icon: BookOpen },
  { id: "life", label: "暮らし", icon: House },
];
const actions: { id: Action; label: string; description: string }[] = [
  { id: "rest", label: "ゆっくり休む", description: "体力 +20 / 健康 +1" },
  { id: "service", label: "接客を学ぶ", description: "接客スキルを磨く" },
  {
    id: "digital",
    label: "デジタルを学ぶ",
    description: "制作の基礎を身につける",
  },
  { id: "craft", label: "ものづくりを学ぶ", description: "制作スキルを磨く" },
  {
    id: "business",
    label: "事業に取り組む",
    description: "商品・サービスを生産する",
  },
];
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
        ? history.map((h) => h.cash)
        : [history[0]?.cash ?? game.cash, history[0]?.cash ?? game.cash];
  const min = Math.min(...values) * 0.8,
    max = Math.max(...values) * 1.1 + 1;
  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1 || 1)) * 600},${135 - ((v - min) / (max - min)) * 105}`,
    )
    .join(" ");
  return (
    <div className="chart" aria-label="直近30日の現金残高推移">
      <div className="chart-labels">
        <span>{yen(max)}</span>
        <span>{yen((max + min) / 2)}</span>
        <span>{yen(min)}</span>
      </div>
      <svg
        viewBox="0 0 600 155"
        preserveAspectRatio="none"
        role="img"
        aria-label={`現金残高 ${yen(game.cash)}`}
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
              <option value="standard">標準 — 所持金 ¥50,000</option>
              <option value="challenge">挑戦 — 所持金 ¥20,000</option>
              <option value="comfortable">余裕 — 所持金 ¥100,000</option>
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
                  {s.state.date} / {yen(s.state.cash)}
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
            所持金
          </span>
          <strong data-testid="cash">{yen(g.cash)}</strong>
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
          <strong>{yen(g.employment?.accrued ?? 0)}</strong>
          <small>
            <span className="dot" />
            毎月25日に入金
          </small>
        </Card>
        <Card>
          <span className="stat-label">
            <TrendingUp size={16} />
            事業の累計利益
          </span>
          <strong>{yen(g.totals.businessProfit)}</strong>
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
      <div className="dashboard-grid">
        <div className="main-column">
          <Card>
            <div className="section-head">
              <div>
                <span className="eyebrow">YOUR NEXT STEP</span>
                <h2>今日を、どう過ごす？</h2>
              </div>
              <span className="quiet-label">余暇の過ごし方</span>
            </div>
            <p className="muted description">
              仕事の予定に合わせて、余暇の行動を毎日続けます。
            </p>
            <div className="action-grid">
              {actions.map((a) => (
                <button
                  key={a.id}
                  className={
                    "action-choice " + (g.action === a.id ? "selected" : "")
                  }
                  disabled={a.id === "business" && !b}
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
                  {g.action === a.id && <Check size={16} />}
                </button>
              ))}
            </div>
            <div className="time-note">
              <Clock size={15} />
              <span>
                {j
                  ? "平日 " +
                    j.hours +
                    "時間勤務 ＋ 余暇2時間 / 休日は余暇5〜6時間"
                  : "学習5時間、事業6時間を目安に行動します"}
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
              <strong>{yen(g.cash)}</strong>
              <span>現金残高</span>
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
              <button className="outline full" onClick={() => go("career")}>
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
              <b>{j?.name ?? "自由な暮らし"}</b>
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
  const { act } = useGame();
  const [confirm, setConfirm] = useState(false);
  const current = jobs.find((j) => j.id === g.employment?.jobId);
  return (
    <>
      <PageTitle
        eyebrow="FIND YOUR PLACE"
        title="毎日の仕事を、見つける。"
        description="経験を積みながら、暮らしの土台をつくろう。"
      />
      {current && (
        <Card className="employment">
          <Tag>現在の仕事</Tag>
          <h2>{current.name}</h2>
          <p>
            {current.company} · 平日 {current.hours}時間 · 時給{" "}
            {yen(current.wage)}
          </p>
          <div className="detail-grid">
            <div>
              <small>働いた日数</small>
              <strong>{g.employment?.workedDays} 日</strong>
            </div>
            <div>
              <small>未払給与 · 25日入金</small>
              <strong>{yen(g.employment?.accrued ?? 0)}</strong>
            </div>
          </div>
          <p className="muted">
            時間を進めると平日に自動で勤務します。体力不足の日は勤務時間が減ります。
          </p>
          <button
            className="outline"
            onClick={() =>
              confirm
                ? (act({ type: "quit" }), setConfirm(false))
                : setConfirm(true)
            }
          >
            {confirm ? "退職して未払給与を精算する" : "この仕事を辞める"}
          </button>
          {confirm && (
            <button className="text-button" onClick={() => setConfirm(false)}>
              キャンセル
            </button>
          )}
        </Card>
      )}
      <h2 className="list-title">
        青葉市の求人 <span>3件</span>
      </h2>
      <div className="listing-grid">
        {jobs.map((j) => {
          const eligible = g.person.skills[j.skill] >= j.requirement;
          return (
            <Card key={j.id}>
              <span className="square-icon">
                <Building2 />
              </span>
              <div className="listing-tags">
                <Tag>アルバイト</Tag>
                <Tag>
                  {j.requirement === 0
                    ? "未経験歓迎"
                    : `${skillNames[j.skill]} Lv.${j.requirement}〜`}
                </Tag>
              </div>
              <h2>{j.name}</h2>
              <p className="company">{j.company}</p>
              <p>{j.description}</p>
              <div className="job-rate">
                {yen(j.wage)}
                <span> / 時間</span>
              </div>
              <p className="muted">
                平日週5日 · 1日{j.hours}時間 · 毎月25日払い
              </p>
              <button
                className="primary full"
                disabled={!!g.employment || !eligible}
                onClick={() => act({ type: "apply", jobId: j.id })}
              >
                {g.employment?.jobId === j.id
                  ? "勤務中"
                  : !eligible
                    ? "スキル条件が不足しています"
                    : g.employment
                      ? "現在の仕事を退職後に応募"
                      : "応募する"}
                <ArrowRight size={16} />
              </button>
            </Card>
          );
        })}
      </div>
    </>
  );
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
                disabled={g.cash < i.setup}
                onClick={() => act({ type: "open", industryId: i.id })}
              >
                {g.cash < i.setup
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
          現在の余暇は「{actions.find((a) => a.id === g.action)?.label}
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
            販売数は注文・生産能力・材料費を払える資金で決まります。勤務日は余暇2時間、休日は6時間。未稼働日は0件です。
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
            disabled={g.cash < investmentCost(g)}
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
  return (
    <>
      <PageTitle
        eyebrow="KNOW YOUR NUMBERS"
        title="暮らしと、お金のこと。"
        description="積み重ねた仕事も、日々の支出も。ここで見渡せます。"
      />
      <div className="stats three">
        <Card>
          <span className="stat-label">現金残高</span>
          <strong>{yen(g.cash)}</strong>
          <small>未払給与 {yen(g.employment?.accrued ?? 0)}</small>
        </Card>
        <Card>
          <span className="stat-label">純資産</span>
          <strong>{yen(netWorth(g))}</strong>
          <small>現金 ＋ 未払給与 ＋ 設備取得額 − 債務</small>
        </Card>
        <Card>
          <span className="stat-label">未払債務</span>
          <strong>{yen(g.debt)}</strong>
          <small>次回の収入で自動返済・無利息</small>
        </Card>
      </div>
      <div className="two-cards">
        <Card>
          <h2>暮らしの収支 · 累計</h2>
          <div className="business-spec">
            <span>
              給与の発生額 <b>{yen(g.totals.wages)}</b>
            </span>
            <span>
              事業売上 <b>{yen(g.totals.revenue)}</b>
            </span>
            <span>
              事業営業利益 <b>{yen(g.totals.businessProfit)}</b>
            </span>
            <span>
              生活費・家賃 <b>{yen(g.totals.living)}</b>
            </span>
          </div>
          <p className="muted">
            営業利益は税引前。設備投資・給与の未入金により、現金の増減とは異なります。
          </p>
        </Card>
        <Card>
          <h2>保有する設備</h2>
          {g.assets.length ? (
            g.assets.map((a) => (
              <div className="asset" key={a.id}>
                <Store />
                <span>
                  {a.name}
                  <small>自分の事業が所有 · Lv.{a.level}</small>
                </span>
                <b>{yen(a.cost)}</b>
              </div>
            ))
          ) : (
            <p className="empty">
              まだ設備を持っていません。
              <br />
              自分のペースで資産を育てていきましょう。
            </p>
          )}
          <p className="muted">
            取得原価で評価。減価償却・設備売却は未実装です。
          </p>
        </Card>
      </div>
      <Card className="ledger-card">
        <div className="section-head">
          <h2>入出金の記録</h2>
          <Tag>直近50件</Tag>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>日付</th>
                <th>内容</th>
                <th>区分</th>
                <th>金額</th>
              </tr>
            </thead>
            <tbody>
              {g.ledger
                .slice(-50)
                .reverse()
                .map((e) => (
                  <tr key={e.id}>
                    <td>{e.date}</td>
                    <td>{e.label}</td>
                    <td>
                      {e.category === "debt"
                        ? "債務発生"
                        : e.amount >= 0
                          ? "入金"
                          : "支出"}
                    </td>
                    <td className={e.category === "income" ? "positive" : ""}>
                      {e.amount > 0 ? "+" : ""}
                      {yen(e.amount)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
function Skills({ g }: { g: GameState }) {
  const { act } = useGame();
  return (
    <>
      <PageTitle
        eyebrow="GROW AT YOUR OWN PACE"
        title="学んだ分だけ、世界が広がる。"
        description="学習は無料。時間を進めると、選んだスキルが少しずつ育ちます。"
      />
      <div className="listing-grid">
        {Object.entries(skillNames).map(([id, label]) => (
          <Card key={id}>
            <span className="square-icon">
              <BookOpen />
            </span>
            <h2>{label}</h2>
            <div className="skill-value">
              Lv. {Math.floor(g.person.skills[id as keyof typeof skillNames])}
              <small> / 100</small>
            </div>
            <Meter value={g.person.skills[id as keyof typeof skillNames]} />
            <p>
              {id === "service"
                ? "人と関わる仕事の応募条件に。勤務でも経験を積めます。"
                : id === "digital"
                  ? "制作アシスタントへの応募や、文章制作の品質・生産能力に。"
                  : "焼き菓子づくりの品質と生産能力に。"}
            </p>
            <p className="muted">
              勤務日 +0.36 / 休日 +0.90
              <br />
              学習による体力消費：毎時2
            </p>
            <button
              className="primary full"
              onClick={() => act({ type: "action", action: id as Action })}
            >
              {g.action === id ? "現在の学習方針" : "このスキルを学ぶ"}
              {g.action === id ? <Check size={17} /> : <ArrowRight size={17} />}
            </button>
          </Card>
        ))}
      </div>
    </>
  );
}
function Life({ g }: { g: GameState }) {
  const { act } = useGame();
  return (
    <>
      <PageTitle
        eyebrow="A PLACE TO CALL HOME"
        title="暮らしを、整える。"
        description="住む場所と休む時間。毎日の土台を大切に。"
      />
      <div className="info-panel">
        <House />
        <p>
          家賃は毎月1日、食費・日用品は毎日支払います。住み替え時は家賃の増額分だけ精算します。減額分の返金はありません。
        </p>
      </div>
      <div className="listing-grid">
        {housing.map((h) => (
          <Card key={h.id}>
            <span className="square-icon">
              <House />
            </span>
            <h2>{h.name}</h2>
            <p>{h.description}</p>
            <div className="job-rate">
              {yen(h.rent)}
              <span> / 月</span>
            </div>
            <div className="business-spec">
              <span>
                食費・日用品 <b>{yen(h.daily)} / 日</b>
              </span>
              <span>
                日次の体力回復 <b>+{h.recovery}</b>
              </span>
              <span>
                住み替え差額 <b>{yen(Math.max(0, h.rent - home(g).rent))}</b>
              </span>
            </div>
            <button
              className="primary full"
              disabled={
                h.id === g.housingId ||
                g.cash < Math.max(0, h.rent - home(g).rent)
              }
              onClick={() => act({ type: "housing", housingId: h.id })}
            >
              {h.id === g.housingId ? "現在の住まい" : "ここへ住み替える"}
              <House size={16} />
            </button>
          </Card>
        ))}
      </div>
      <Card className="mt">
        <h2>ひと息つく時間も、人生の一部。</h2>
        <p>
          休養を選ぶと、住居の回復に加えて体力が20、健康が1回復します。勤務の予定は続きます。
        </p>
        <button
          className="outline"
          onClick={() => act({ type: "action", action: "rest" })}
        >
          <Coffee size={16} /> 余暇はゆっくり休む
        </button>
      </Card>
    </>
  );
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
                    ? `${s.state.date} · ${yen(s.state.cash)}`
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
              if (file.size > 2000000) {
                setMessage("ファイルは2MB以内にしてください");
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
          v0.1 ·
          仕事、生活、学習、個人事業、設備所有、ローカル保存を実装しています。
        </p>
        <p className="muted">
          法人設立、株式売買、融資、税・社会保険、交友関係、複数都市は未実装です。年齢や事業の赤字による強制終了はありません。
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
            <span>v0.1</span>
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
            <Overview g={g} go={go} />
          ) : page === "career" ? (
            <Career g={g} />
          ) : page === "business" ? (
            <Business key={g.business?.industryId ?? "none"} g={g} />
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
            <span>LIFE SIMULATOR · EARLY ACCESS</span>
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
                余暇：{actions.find((a) => a.id === g.action)?.label}
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
