import { PersonalBusinessFinance } from "./Phase2";
import { enterpriseWealth } from "../engine/enterprise/accounting";
import { useState } from "react";
import type { GameState, EmploymentContract, Routine } from "../engine/types";
import { jobs, hiringAssessment } from "../engine/career";
import { useGame } from "../store";
import { skillNames, age } from "../engine/person";
import {
  dailyActions,
  actionRegistry,
  actionUnavailable,
} from "../engine/actions";
import { buildDayPlan, availableHours, isShiftDay } from "../engine/schedule";
import { liquid, netWorth, reconcile } from "../engine/finance";
import { home, housing, standards } from "../engine/life";
import { nextDate, weekday } from "../engine/time";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Clock,
  Users,
  Wallet,
  Heart,
  Check,
  TrendingUp,
  BookOpen,
  House,
  Sun,
  Plus,
  ArrowUpRight,
} from "lucide-react";
const yen = (n: number) => "¥" + Math.round(n).toLocaleString("ja-JP");
const days = ["日", "月", "火", "水", "木", "金", "土"];
const clock = (h: number) =>
  Math.floor(h).toString().padStart(2, "0") + ":" + (h % 1 ? "30" : "00");
function Title({
  top,
  title,
  children,
}: {
  top: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-title">
      <span className="eyebrow">{top}</span>
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="tag">{children}</span>;
}
export function PhaseSummary({
  g,
  go,
}: {
  g: GameState;
  go: (page: string) => void;
}) {
  const plan = buildDayPlan(g),
    work = plan
      .filter((b) => b.kind === "work")
      .reduce((a, b) => a + b.hours, 0),
    commute = plan
      .filter((b) => b.kind === "commute")
      .reduce((a, b) => a + b.hours, 0);
  return (
    <section className="phase-summary">
      <div>
        <Badge>PHASE 2</Badge>
        <h3>暮らしの24時間</h3>
        <p>
          睡眠 {g.routine.sleepHours}h · 勤務 {work}h · 移動 {commute}h · 食事等
          2h
        </p>
        <button className="text-button" onClick={() => go("calendar")}>
          今日の予定を見る <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="summary-bank">
        <Wallet size={19} />
        <small>銀行預金</small>
        <strong>{yen(g.bank)}</strong>
        <span>
          勤務契約 {g.employments.length}件 / 満足度{" "}
          {Math.round(g.person.satisfaction)}
        </span>
      </div>
    </section>
  );
}
export function CareerPanel({ g }: { g: GameState }) {
  const { act } = useGame();
  const [query, setQuery] = useState(""),
    [industry, setIndustry] = useState("all"),
    [sort, setSort] = useState("default");
  let list = jobs.filter(
    (j) =>
      (industry === "all" || j.industry === industry) &&
      [j.name, j.company, j.location].some((v) => v.includes(query)),
  );
  if (sort === "wage") list = [...list].sort((a, b) => b.wage - a.wage);
  if (sort === "hours") list = [...list].sort((a, b) => a.hours - b.hours);
  return (
    <>
      <Title top="FIND YOUR PLACE" title="毎日の仕事を、見つける。">
        企業の条件と、自分の時間を見比べる。応募1件に1時間を使います。
      </Title>
      <div className="phase-toolbar">
        <label>
          求人検索
          <input
            aria-label="求人検索"
            placeholder="職種・企業・勤務地"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label>
          業界
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            <option value="all">すべての業界</option>
            {[...new Set(jobs.map((j) => j.industry))].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          並び順
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="default">おすすめ順</option>
            <option value="wage">換算時給が高い順</option>
            <option value="hours">勤務時間が短い順</option>
          </select>
        </label>
      </div>
      {g.employments.length > 0 && (
        <div className="info-panel">
          <BriefcaseBusiness />
          <p>
            現在 {g.employments.length}
            件の仕事に就いています。シフト管理で勤務曜日・開始時刻の変更、欠勤予約、退職を選べます。通勤を含む重複は採用時に防止します。
          </p>
        </div>
      )}
      <h2 className="list-title">
        青葉市の求人 <span>{list.length}件</span>
      </h2>
      <div className="phase-jobs">
        {list.map((j) => {
          const assessment = hiringAssessment(g, j.id),
            active = g.employments.some((e) => e.jobId === j.id),
            o = g.organizations.find((o) => o.id === j.employerId)!,
            v = g.vacancies.find((v) => v.jobId === j.id);
          return (
            <article
              className="card job-card"
              key={j.id}
              data-testid={"job-" + j.id}
            >
              <div className="section-head">
                <span className="square-icon">
                  <BriefcaseBusiness size={20} />
                </span>
                <Badge>
                  {j.industry} · {j.payMode === "monthly" ? "月給制" : "時給制"}
                </Badge>
              </div>
              <h2>{j.name}</h2>
              <p className="job-company">{j.company}</p>
              <p>{j.description}</p>
              <div className="job-rate">
                {yen(j.payMode === "monthly" ? j.salary : j.wage)}
                <span>
                  {" "}
                  / {j.payMode === "monthly" ? "月（所定勤務）" : "時間"}
                </span>
              </div>
              <dl className="job-spec">
                <div>
                  <dt>勤務地</dt>
                  <dd>{j.location}</dd>
                </div>
                <div>
                  <dt>勤務・通勤</dt>
                  <dd>
                    {clock(j.start)}–{clock(j.start + j.hours)} / 片道
                    {j.commute}h
                  </dd>
                </div>
                <div>
                  <dt>シフト</dt>
                  <dd>
                    {j.weekdays.map((d) => days[d]).join("・")} / {j.hours}h
                  </dd>
                </div>
                <div>
                  <dt>必要能力</dt>
                  <dd>
                    {skillNames[j.skill]} Lv.{j.requirement}〜
                  </dd>
                </div>
                <div>
                  <dt>採用基準</dt>
                  <dd>
                    {assessment.score}点 / 基準{assessment.threshold} · 倍率
                    {v?.competition}倍
                  </dd>
                </div>
                <div>
                  <dt>企業の状況</dt>
                  <dd>
                    {o.cash < 0
                      ? "資金不足・募集停止"
                      : o.cash < 100000
                        ? "採用に慎重"
                        : "経営安定"}{" "}
                    / 募集{v?.openings}名
                  </dd>
                </div>
                <div>
                  <dt>給与日</dt>
                  <dd>
                    毎月{j.payDay}日 / 交通費 {yen(j.fare)}・出勤日
                  </dd>
                </div>
              </dl>
              <p className="job-promotion">{j.promotion}</p>
              <p
                className={"assessment " + (assessment.hired ? "positive" : "")}
              >
                {active
                  ? "採用済み"
                  : assessment.hired
                    ? "現在の能力・経験は採用基準を満たします"
                    : assessment.reason}
              </p>
              <button
                className="primary full"
                disabled={active || !v?.openings}
                onClick={() => act({ type: "apply", jobId: j.id })}
              >
                {active ? "勤務中" : "応募する"}
                <ArrowRight size={15} />
              </button>
            </article>
          );
        })}
      </div>
      {!list.length && (
        <div className="card empty">
          条件に合う求人はありません。検索条件を変えてみましょう。
        </div>
      )}
      <section className="card mt">
        <h2>応募履歴</h2>
        {g.applications.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>応募日</th>
                  <th>職種</th>
                  <th>点数 / 基準</th>
                  <th>結果</th>
                </tr>
              </thead>
              <tbody>
                {g.applications
                  .slice(-12)
                  .reverse()
                  .map((a, i) => (
                    <tr key={i}>
                      <td>{a.date}</td>
                      <td>
                        {jobs.find((j) => j.id === a.jobId)?.name}
                        <small className="block-muted">{a.reason}</small>
                      </td>
                      <td>
                        {a.score} / {a.threshold}
                      </td>
                      <td>{a.hired ? "採用" : "不採用"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">
            まだ応募していません。採否は能力・経験・倍率・同社での信頼から決まり、無根拠な抽選はありません。
          </p>
        )}
      </section>
    </>
  );
}
function ContractCard({ g, e }: { g: GameState; e: EmploymentContract }) {
  const { act } = useGame(),
    j = jobs.find((j) => j.id === e.jobId)!;
  const [start, setStart] = useState(e.start),
    [week, setWeek] = useState(e.weekdays),
    [quit, setQuit] = useState(false);
  return (
    <article className="card contract-card" data-testid={"contract-" + j.id}>
      <div className="section-head">
        <Badge>勤務中 · 役割 Lv.{e.rank}</Badge>
        <span className="quiet-label">{e.started}〜</span>
      </div>
      <h2>{j.name}</h2>
      <p>
        {j.company} · 時給換算 {yen(e.wage)} · 給与日 {j.payDay}日
      </p>
      <div className="contract-metrics">
        <div>
          <small>勤務実績</small>
          <b>
            {e.workedDays}日 / {e.workedHours}h
          </b>
        </div>
        <div>
          <small>未払給与</small>
          <b>{yen(e.accrued)}</b>
        </div>
        <div>
          <small>勤務評価</small>
          <b>{Math.round(e.rating)} / 100</b>
        </div>
        <div>
          <small>欠勤</small>
          <b>{e.absences}日</b>
        </div>
      </div>
      <div className="shift-editor">
        <label>
          開始時刻
          <select
            aria-label={j.name + "の開始時刻"}
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
          >
            {Array.from({ length: 35 }, (_, i) => i * 0.5 + 6)
              .filter((v) => v + j.hours + j.commute <= 24)
              .map((v) => (
                <option key={v} value={v}>
                  {clock(v)}
                </option>
              ))}
          </select>
        </label>
        <fieldset>
          <legend>勤務する曜日</legend>
          <div className="weekday-buttons">
            {days.map((day, n) => (
              <button
                type="button"
                key={day}
                aria-pressed={week.includes(n)}
                aria-label={j.name + " " + day + "曜日"}
                className={week.includes(n) ? "selected" : ""}
                onClick={() =>
                  setWeek(
                    week.includes(n)
                      ? week.filter((v) => v !== n)
                      : [...week, n].sort(),
                  )
                }
              >
                {day}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
      <p className="muted">
        勤務 {e.hours}h ＋ 往復通勤 {e.commute * 2}
        h。睡眠と食事を確保できる範囲で変更できます。
      </p>
      <div className="button-row">
        <button
          className="outline"
          onClick={() =>
            act({ type: "shift", contractId: e.id, start, weekdays: week })
          }
        >
          シフトを保存
        </button>
        <button
          className="outline"
          aria-pressed={e.absentNext}
          onClick={() => act({ type: "absence", contractId: e.id })}
        >
          {e.absentNext ? "次回欠勤の予約を取り消す" : "次回の勤務を欠勤する"}
        </button>
      </div>
      <hr />
      <button
        className="text-button danger"
        onClick={() =>
          quit
            ? (act({ type: "quit", contractId: e.id }), setQuit(false))
            : setQuit(true)
        }
      >
        {quit ? "退職して未払給与を精算する" : "この仕事を辞める"}
      </button>
      {quit && (
        <>
          <p className="warning">
            この勤務契約を終了し、未払給与を銀行へ入金します。経歴と経験は残ります。
          </p>
          <button className="text-button" onClick={() => setQuit(false)}>
            キャンセル
          </button>
        </>
      )}
    </article>
  );
}
export function ShiftsPanel({ g }: { g: GameState }) {
  return (
    <>
      <Title top="WORK, ON YOUR TERMS" title="仕事と時間を、組み立てる。">
        最大4件の契約を管理。勤務・通勤・睡眠の重複を防止します。
      </Title>
      <div className="phase-contracts">
        {g.employments.map((e) => (
          <ContractCard key={e.id} e={e} g={g} />
        ))}
      </div>
      {!g.employments.length && (
        <div className="card empty">
          現在の仕事はありません。「仕事を探す」から応募できます。
        </div>
      )}
      <div className="info-panel">
        <TrendingUp />
        <p>
          30勤務日ごとに評価65以上なら時給が3%上昇（初期時給の2倍まで）、90勤務日ごとに役割が昇格します。欠勤・短時間勤務は無給または実働分のみの給与となり、評価に影響します。月給職は当月所定時間で実働を按分します。
        </p>
      </div>
    </>
  );
}
export function RoutineEditor({ g }: { g: GameState }) {
  const { act } = useGame();
  const [r, setR] = useState<Routine>(g.routine);
  const options = dailyActions();
  return (
    <form
      className="routine-form"
      onSubmit={(e) => {
        e.preventDefault();
        act({ type: "routine", routine: r });
      }}
    >
      <div className="routine-fields">
        <label>
          毎日の睡眠時間
          <select
            aria-label="睡眠時間"
            value={r.sleepHours}
            onChange={(e) => setR({ ...r, sleepHours: Number(e.target.value) })}
          >
            {[4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n}時間（0時〜{n}時）
              </option>
            ))}
          </select>
        </label>
        <label>
          余暇の行動時間
          <select
            aria-label="余暇の行動時間"
            value={r.activityHours}
            onChange={(e) =>
              setR({ ...r, activityHours: Number(e.target.value) })
            }
          >
            {[0, 0.5, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}時間 / 日（空き時間まで）
              </option>
            ))}
          </select>
        </label>
        <label>
          休日の行動時間
          <select
            aria-label="休日の行動時間"
            value={r.weekendHours}
            onChange={(e) =>
              setR({ ...r, weekendHours: Number(e.target.value) })
            }
          >
            {[0, 0.5, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}時間 / 土日
              </option>
            ))}
          </select>
        </label>
        <label>
          平日の自動行動
          <select
            aria-label="平日の自動行動"
            value={r.weekdayAction}
            onChange={(e) => setR({ ...r, weekdayAction: e.target.value })}
          >
            {options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          土日の自動行動
          <select
            aria-label="休日の自動行動"
            value={r.weekendAction}
            onChange={(e) => setR({ ...r, weekendAction: e.target.value })}
          >
            {options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          自動交流の相手
          <select
            aria-label="自動交流の相手"
            value={r.socialTarget ?? ""}
            onChange={(e) =>
              setR({ ...r, socialTarget: e.target.value || null })
            }
          >
            <option value="">未選択</option>
            {g.relationships.map((rel) => (
              <option key={rel.npcId} value={rel.npcId}>
                {g.npcs.find((p) => p.id === rel.npcId)?.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">
        勤務日でも休日でも自動実行します。時間・資金・交流相手などの条件を満たせない行動は見送り、日次レポートに記録します。
      </p>
      <button className="primary" type="submit">
        生活スケジュールを保存 <Check size={15} />
      </button>
    </form>
  );
}
export function ActionsPanel({ g }: { g: GameState }) {
  const { act } = useGame();
  return (
    <>
      <Title
        top="MAKE ROOM FOR WHAT MATTERS"
        title="毎日の選択を、自分らしく。"
      >
        一度決めた生活方針を、時間を進めるたびに自動で続けます。
      </Title>
      <section className="card">
        <h2>自動スケジュール</h2>
        <RoutineEditor g={g} />
      </section>
      <section className="card mt">
        <div className="section-head">
          <h2>今日の自由行動</h2>
          <Badge>
            未使用の余白{" "}
            {Math.max(
              0,
              availableHours(g) -
                g.manualActions.reduce((a, b) => a + b.hours, 0),
            )}
            h
          </Badge>
        </div>
        <p>
          即時行動は今日の空き時間を使います。進行前に行った学習や交流も、24時間の予定に記録します。
        </p>
        <div className="manual-action-grid">
          {dailyActions().map((a) => {
            const reason = actionUnavailable(g, a.id);
            return (
              <article key={a.id}>
                <span className="eyebrow">{a.category.toUpperCase()}</span>
                <h3>{a.label}</h3>
                <p>{a.result}</p>
                <small>
                  {a.hours}時間 / {yen(a.cost(g, {}))} / 対象{" "}
                  {
                    {
                      person: "自分",
                      npc: "知人",
                      job: "求人",
                      contract: "勤務先",
                      business: "事業",
                      account: "口座",
                      housing: "住まい",
                      none: "指定なし",
                    }[a.target]
                  }
                </small>
                <button
                  className="outline full"
                  disabled={!a.manual || !!reason}
                  onClick={() => act({ type: "execute", actionId: a.id })}
                >
                  {!a.manual
                    ? "自動スケジュールで実行"
                    : (reason ?? "今すぐ実行")}
                  <ArrowRight size={14} />
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
function TimePlan({ blocks }: { blocks: ReturnType<typeof buildDayPlan> }) {
  return (
    <>
      <div className="time-strip" aria-label="24時間の時間配分">
        {blocks.map((b, i) => (
          <span
            key={i}
            className={"block-" + b.kind}
            style={{ flex: b.hours }}
            title={clock(b.start) + " " + b.label + " " + b.hours + "h"}
          />
        ))}
      </div>
      <div className="time-axis">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
      <div className="schedule-list">
        {blocks.map((b, i) => (
          <div key={i}>
            <time>
              {clock(b.start)}–{clock(b.start + b.hours)}
            </time>
            <span className={"schedule-dot block-" + b.kind} />
            <span>
              {b.kind === "work"
                ? b.label
                : (actionRegistry.get(b.label)?.label ?? b.label)}
            </span>
            <b>{b.hours}h</b>
          </div>
        ))}
      </div>
      <p className="muted">
        合計 {blocks.reduce((a, b) => a + b.hours, 0)}
        時間。食事・身支度を含みます。
      </p>
    </>
  );
}
export function CalendarPanel({ g }: { g: GameState }) {
  const [month, setMonth] = useState(g.date.slice(0, 7)),
    [selected, setSelected] = useState(g.date);
  const first = month + "-01",
    list: string[] = [];
  let d = first;
  while (d.startsWith(month)) {
    list.push(d);
    d = nextDate(d);
  }
  const record = g.history.find((h) => h.date === selected);
  const forecast = {
    ...g,
    date: selected,
    employments: g.employments.map((e) => {
      let next = g.date;
      while (!isShiftDay(e, next)) next = nextDate(next);
      return { ...e, absentNext: e.absentNext && selected === next };
    }),
    manualActions: selected === g.date ? g.manualActions : [],
  };
  const blocks = record?.blocks ?? buildDayPlan(forecast);
  const move = (offset: number) => {
    const date = new Date(month + "-01T00:00:00Z");
    date.setUTCMonth(date.getUTCMonth() + offset);
    const next = date.toISOString().slice(0, 7);
    setMonth(next);
    setSelected(next + "-01");
  };
  return (
    <>
      <Title top="ONE DAY AT A TIME" title="今日も、これからの日も。">
        カレンダーで勤務・支払日・時間配分を見渡せます。将来の日付は現在の契約に基づく予定です。
      </Title>
      <div className="calendar-layout">
        <section className="card">
          <div className="section-head">
            <button
              className="outline"
              aria-label="前の月"
              onClick={() => move(-1)}
            >
              ←
            </button>
            <h2>{month.replace("-", "年 ")}月</h2>
            <button
              className="outline"
              aria-label="次の月"
              onClick={() => move(1)}
            >
              →
            </button>
          </div>
          <div className="calendar-grid">
            {days.map((day) => (
              <span className="calendar-weekday" key={day}>
                {day}
              </span>
            ))}
            {Array.from({ length: weekday(first) }, (_, i) => (
              <span key={"blank" + i} />
            ))}
            {list.map((date) => {
              const shifts = g.employments.filter((e) => isShiftDay(e, date));
              const day = Number(date.slice(8));
              const pay = g.employments.some(
                (e) => jobs.find((j) => j.id === e.jobId)!.payDay === day,
              );
              return (
                <button
                  className={
                    (date === selected ? "selected " : "") +
                    (date === g.date ? "today" : "")
                  }
                  key={date}
                  onClick={() => setSelected(date)}
                >
                  <b>{day}</b>
                  {shifts.length > 0 && <span>{shifts.length}件勤務</span>}
                  {pay && <small>給与日</small>}
                  {day === 1 && <small>家賃・利息</small>}
                  {day === 10 && <small>光熱費</small>}
                  {day === 15 && <small>通信費</small>}
                </button>
              );
            })}
          </div>
          <div className="info-panel">
            <CalendarDays size={18} />
            <p>
              休日は土日ですが、シフトに指定した曜日は勤務します。欠勤予約は次の該当勤務日に一度だけ適用されます。カレンダーの勤務件数は所定予定を表示します。
            </p>
          </div>
        </section>
        <section className="card">
          <div className="section-head">
            <h2>
              {selected} の{record ? "記録" : "予定"}
            </h2>
            <Badge>{record ? "実績" : "プレビュー"}</Badge>
          </div>
          <TimePlan blocks={blocks} />
          {record && (
            <>
              <hr />
              <h3>実際の一日</h3>
              <p>
                勤務 {record.workHours}h / 学習 {record.studyHours}h / 満足度{" "}
                {Math.round(record.satisfaction)}
              </p>
              {record.events.map((e, i) => (
                <p className="day-event" key={i}>
                  {e}
                </p>
              ))}
            </>
          )}
        </section>
      </div>
    </>
  );
}
export function FinancePanel({ g }: { g: GameState }) {
  const { act } = useGame();
  const [amount, setAmount] = useState(10000),
    [selected, setSelected] = useState(
      g.reports.at(-1)?.month ?? g.date.slice(0, 7),
    );
  const report = g.reports.find((r) => r.month === selected);
  return (
    <>
      <Title top="KNOW YOUR NUMBERS" title="暮らしと、お金のこと。">
        現金、銀行預金、未払給与、設備、債務を分けて管理します。
      </Title>
      <div className="phase-money-grid">
        {[
          ["現金", g.cash],
          ["銀行預金", g.bank],
          ["純資産", netWorth(g)],
          ["未払債務・借入", g.debt],
        ].map(([label, value]) => (
          <section className="card" key={label}>
            <span className="stat-label">{label}</span>
            <strong>{yen(Number(value))}</strong>
          </section>
        ))}
      </div>
      <div className="two-cards phase-finance">
        <section className="card">
          <h2>口座と負債を管理</h2>
          <p>
            支払いは現金→預金の順。不足額は未払いになります。入金時には未払いを自動精算します。
          </p>
          <label>
            取引金額（円）
            <input
              aria-label="取引金額"
              type="number"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <div className="finance-buttons">
            {[
              ["deposit", "銀行へ預ける"],
              ["withdraw", "現金を引き出す"],
              ["borrow", "生活資金を借りる"],
              ["repay", "ローンを返す"],
              ["repay-unpaid", "未払いを精算"],
            ].map(([actionId, label]) => (
              <button
                className="outline"
                key={actionId}
                onClick={() =>
                  act({ type: "execute", actionId, target: { amount } })
                }
              >
                {label}
              </button>
            ))}
          </div>
          <p className="muted">
            借入残高 {yen(g.loan)} / 未払い {yen(g.debt - g.loan)}
            。新規借入は残高10万円まで。月初に残高の1%を利息として加算し、借入は自分で返済します。
          </p>
        </section>
        <section className="card">
          <div className="section-head">
            <h2>資産の内訳</h2>
            <Badge>{reconcile(g) ? "元帳と残高が一致" : "照合エラー"}</Badge>
          </div>
          <div className="business-spec">
            <span>
              生活資金（現金＋預金）<b>{yen(liquid(g))}</b>
            </span>
            <span>
              未払給与
              <b>{yen(g.employments.reduce((a, e) => a + e.accrued, 0))}</b>
            </span>
            <span>
              設備・事業純資産・株式
              <b>
                {yen(
                  g.assets.reduce((a, e) => a + e.cost, 0) +
                    enterpriseWealth(g),
                )}
              </b>
            </span>
            <span>
              生活・ローン債務<b>−{yen(g.debt)}</b>
            </span>
            <span>
              純資産<b>{yen(netWorth(g))}</b>
            </span>
          </div>
          <p className="muted">
            口座間の振替や借入は収入に数えません。事業の分別口座・在庫・設備・売掛金・債務と保有株式の簿価を純資産に含めます。個人事業の資金回収は振替です。減価償却・税・社会保険は未実装です。
          </p>
        </section>
      </div>
      <PersonalBusinessFinance g={g} />
      <section className="card mt">
        <div className="section-head">
          <h2>月次レポート</h2>
          <select
            aria-label="月次レポートの月"
            className="month-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {g.reports.map((r) => (
              <option key={r.month}>{r.month}</option>
            ))}
          </select>
        </div>
        {report && (
          <>
            <div className="report-grid">
              {[
                ["給与発生（実働）", report.earned],
                ["給与入金（銀行）", report.wages],
                ["副業・事業売上", report.sales],
                ["事業営業利益", report.sales - report.businessCosts],
                ["生活支出（発生）", report.living],
                ["設備投資", report.capital],
                ["ローン利息", report.interest],
                ["資金増減", report.cashFlow],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{yen(Number(value))}</strong>
                </div>
              ))}
            </div>
            <p className="report-equation">
              月初資金 {yen(report.opening.cash + report.opening.bank)} ＋
              資金増減 {yen(report.cashFlow)} ＝ 月末・現在資金{" "}
              {yen(report.closing.cash + report.closing.bank)}
            </p>
            <p className="muted">
              発生額と実際の支払額は未払い・給与日によって異なります。資金増減には借入・返済も含みます。過去120か月の集計を保持します。
            </p>
          </>
        )}
      </section>
      <section className="card ledger-card">
        <div className="section-head">
          <h2>取引履歴と残高</h2>
          <Badge>直近80件 / 保存上限5000件</Badge>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>日付・内容</th>
                <th>現金増減</th>
                <th>預金増減</th>
                <th>債務増減</th>
                <th>取引後の現金 / 預金</th>
              </tr>
            </thead>
            <tbody>
              {g.ledger
                .slice(-80)
                .reverse()
                .map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.date}
                      <small className="block-muted">{e.label}</small>
                    </td>
                    <td>{yen(e.cashDelta)}</td>
                    <td>{yen(e.bankDelta)}</td>
                    <td>{yen(e.debtDelta)}</td>
                    <td>
                      {yen(e.cashAfter)} / {yen(e.bankAfter)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
export function SkillsPanel({ g }: { g: GameState }) {
  const { act } = useGame();
  return (
    <>
      <Title top="GROW AT YOUR OWN PACE" title="学んだ分だけ、世界が広がる。">
        学習・勤務・交流で能力が育ちます。経験は退職後も残ります。
      </Title>
      <div className="listing-grid">
        {Object.entries(skillNames).map(([id, label]) => (
          <section className="card" key={id}>
            <span className="square-icon">
              <BookOpen />
            </span>
            <h2>{label}</h2>
            <div className="skill-value">
              Lv. {Math.floor(g.person.skills[id as keyof typeof skillNames])}
              <small> / 100</small>
            </div>
            <div className="meter">
              <span
                style={{
                  width: g.person.skills[id as keyof typeof skillNames] + "%",
                }}
              />
            </div>
            <p>
              関連する実務経験{" "}
              {g.person.experience[id as keyof typeof skillNames]}
              時間。能力と経験は応募点、能力は事業の品質・生産能力に反映します。
            </p>
            <button
              className="primary full"
              onClick={() => act({ type: "action", action: id })}
            >
              {g.action === id ? "現在の学習方針" : "このスキルを学ぶ"}
              <Check size={15} />
            </button>
          </section>
        ))}
      </div>
      <section className="card mt">
        <h2>職務経歴</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>企業 / 期間</th>
                <th>勤務</th>
                <th>役割</th>
                <th>評価</th>
              </tr>
            </thead>
            <tbody>
              {g.employments.map((e) => (
                <tr key={e.id}>
                  <td>
                    {jobs.find((j) => j.id === e.jobId)?.company}
                    <small className="block-muted">{e.started}〜現在</small>
                  </td>
                  <td>
                    {e.workedDays}日 / {e.workedHours}h
                  </td>
                  <td>Lv.{e.rank}</td>
                  <td>{Math.round(e.rating)}</td>
                </tr>
              ))}
              {g.careerHistory
                .slice()
                .reverse()
                .map((e, i) => (
                  <tr key={i}>
                    <td>
                      {e.company}
                      <small className="block-muted">
                        {e.started}〜{e.ended}
                      </small>
                    </td>
                    <td>
                      {e.workedDays}日 / {e.workedHours}h
                    </td>
                    <td>Lv.{e.rank}</td>
                    <td>{Math.round(e.rating)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!g.employments.length && !g.careerHistory.length && (
          <p className="empty">ここから、あなたの経歴が増えていきます。</p>
        )}
      </section>
    </>
  );
}
export function RelationsPanel({ g }: { g: GameState }) {
  const { act } = useGame();
  return (
    <>
      <Title top="PEOPLE ALONG THE WAY" title="人との出会いも、人生の資産。">
        職場で知り合った人と交流すると、親密度・信頼・満足度が育ちます。
      </Title>
      <div className="phase-people">
        {g.relationships.map((r) => {
          const p = g.npcs.find((p) => p.id === r.npcId)!;
          return (
            <section className="card" key={p.id}>
              <div className="profile-top">
                <div className="avatar">{p.name.slice(0, 1)}</div>
                <div>
                  <h2>{p.name}</h2>
                  <p>
                    {age(p, g.date)}歳 /{" "}
                    {p.personality === "steady"
                      ? "穏やかで堅実"
                      : p.personality === "outgoing"
                        ? "社交的"
                        : "好奇心旺盛"}
                  </p>
                </div>
              </div>
              <p className="person-work">
                {g.organizations.find((o) => o.id === p.employerId)?.name} ·{" "}
                {p.occupation}
              </p>
              <div className="relationship-values">
                <span>
                  親密度 <b>{Math.round(r.affinity)}</b>
                </span>
                <div className="meter">
                  <span style={{ width: r.affinity + "%" }} />
                </div>
                <span>
                  信頼 <b>{Math.round(r.trust)}</b>
                </span>
                <div className="meter">
                  <span style={{ width: r.trust + "%" }} />
                </div>
              </div>
              <p>
                能力：接客{Math.floor(p.skills.service)} / 制作
                {Math.floor(p.skills.craft)} / デジタル
                {Math.floor(p.skills.digital)}
              </p>
              <p className="muted">
                出会い {r.met} / 交流 {r.interactions}回
              </p>
              <div className="button-row">
                <button
                  className="primary"
                  onClick={() =>
                    act({
                      type: "execute",
                      actionId: "socialize",
                      target: { id: p.id },
                    })
                  }
                >
                  交流する（1h）
                </button>
                <button
                  className="outline"
                  onClick={() =>
                    act({ type: "routine", routine: { socialTarget: p.id } })
                  }
                >
                  {g.routine.socialTarget === p.id
                    ? "自動交流の相手"
                    : "自動交流の相手に選ぶ"}
                </button>
              </div>
            </section>
          );
        })}
      </div>
      {!g.relationships.length && (
        <section className="card empty">
          <Users size={32} />
          <h2>新しい出会いは、毎日の中に。</h2>
          <p>
            仕事に応募し、勤務すると職場の人物と知り合います。知り合う前の人物には交流できません。
          </p>
        </section>
      )}
      <div className="info-panel">
        <Users />
        <p>
          同じ会社の人への信頼は、その会社の応募点に最大10点加算します。退職後も関係は残ります。共同創業や従業員採用への利用は次の拡張対象です。
        </p>
      </div>
    </>
  );
}
export function LifePanel({ g }: { g: GameState }) {
  const { act } = useGame();
  return (
    <>
      <Title top="BUILD A LIFE THAT FITS" title="暮らしを、整える。">
        住まい、睡眠、食事の選び方が、毎日の支出と体調を変えます。
      </Title>
      <div className="phase-vitals">
        {[
          ["健康", g.person.health],
          ["体力", g.person.energy],
          ["生活満足度", g.person.satisfaction],
        ].map(([label, value]) => (
          <section className="card" key={label}>
            <span>{label}</span>
            <strong>
              {Math.round(Number(value))}
              <small>/100</small>
            </strong>
            <div className="meter">
              <span style={{ width: value + "%" }} />
            </div>
          </section>
        ))}
      </div>
      <section className="card mt">
        <h2>生活水準</h2>
        <p>
          蓄積した睡眠不足：{g.person.sleepDebt.toFixed(1)}
          時間。7時間未満の睡眠で蓄積し、8時間以上の睡眠で解消。睡眠不足は体力の回復上限を下げます。
        </p>
        <div className="standards-grid">
          {Object.entries(standards).map(([id, level]) => (
            <button
              className={g.livingStandard === id ? "selected" : ""}
              key={id}
              onClick={() =>
                act({
                  type: "standard",
                  standard: id as GameState["livingStandard"],
                })
              }
            >
              <b>{level.name}</b>
              <span>
                食費・日用品{" "}
                {yen(home(g).daily * level.factor * g.world.costIndex)}/日
              </span>
              <small>
                満足度 {level.satisfaction > 0 ? "+" : ""}
                {level.satisfaction}/日
              </small>
            </button>
          ))}
        </div>
        <p className="muted">
          資金不足時も変更できます。住居・都市物価係数{" "}
          {g.world.costIndex.toFixed(2)}{" "}
          に応じて変わります。月初の家賃、10日の光熱費、15日の通信費（
          {yen(2500 * g.world.costIndex)}）、出勤日の交通費は別途発生します。
        </p>
        <button
          className="outline"
          onClick={() => act({ type: "execute", actionId: "shopping" })}
        >
          日用品を買って気分転換 · 1h / ¥1,500
        </button>
      </section>
      <h2 className="list-title">住まいを選ぶ</h2>
      <div className="listing-grid">
        {housing.map((h) => (
          <section className="card" key={h.id}>
            <span className="square-icon">
              <House />
            </span>
            <h2>{h.name}</h2>
            <p>{h.description}</p>
            <div className="job-rate">
              {yen(h.rent * g.world.costIndex)}
              <span>/ 月</span>
            </div>
            <p>
              光熱費 {yen(h.utilities * g.world.costIndex)} / 月<br />
              睡眠時の追加回復 +{(h.recovery * 0.3).toFixed(1)}
              <br />
              住み替えは2時間、家賃増額差分を精算
            </p>
            <button
              className="primary full"
              disabled={h.id === g.housingId}
              onClick={() => act({ type: "housing", housingId: h.id })}
            >
              {h.id === g.housingId ? "現在の住まい" : "ここへ住み替える"}
              <ArrowRight size={15} />
            </button>
          </section>
        ))}
      </div>
      <section className="card mt">
        <h2>睡眠と生活の自動設定</h2>
        <RoutineEditor g={g} />
      </section>
    </>
  );
}
export function ReportsPanel({ g }: { g: GameState }) {
  const [date, setDate] = useState(g.history.at(-1)?.date ?? g.date);
  const r = g.history.find((r) => r.date === date);
  return (
    <>
      <Title
        top="YOUR DAYS, IN PERSPECTIVE"
        title="積み重ねた日々を、振り返る。"
      >
        日次実績と月次の発生・入出金を区別して見られます。
      </Title>
      <section className="card">
        <div className="section-head">
          <h2>日次レポート</h2>
          <select
            aria-label="日次レポートの日"
            className="month-select"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          >
            {g.history
              .slice()
              .reverse()
              .map((h) => (
                <option key={h.date}>{h.date}</option>
              ))}
          </select>
        </div>
        {r ? (
          <>
            <div className="report-grid">
              {[
                ["実働", r.workHours + "h"],
                ["睡眠", r.sleepHours + "h"],
                ["学習", r.studyHours + "h"],
                ["給与発生", yen(r.earned)],
                ["事業売上", yen(r.sales)],
                ["事業利益", yen(r.profit)],
                ["生活費発生", yen(r.spending)],
                ["生活資金", yen(r.cash + r.bank)],
              ].map(([label, value]) => (
                <div key={label}>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <TimePlan blocks={r.blocks} />
            <div className="day-events">
              {r.events.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          </>
        ) : (
          <p className="empty">時間を進めると、一日の実績が記録されます。</p>
        )}
      </section>
      <section className="card mt">
        <h2>月次一覧</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>月</th>
                <th>給与発生 / 入金</th>
                <th>事業利益</th>
                <th>生活費発生</th>
                <th>資金増減</th>
              </tr>
            </thead>
            <tbody>
              {g.reports
                .slice()
                .reverse()
                .map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td>
                      {yen(m.earned)} / {yen(m.wages)}
                    </td>
                    <td>{yen(m.sales - m.businessCosts)}</td>
                    <td>{yen(m.living)}</td>
                    <td>{yen(m.cashFlow)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
