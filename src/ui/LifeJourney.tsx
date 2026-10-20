import { useState } from "react";
import type { GameState, ActionTarget } from "../engine/types";
import { useGame } from "../store";
import { goalRegistry } from "../engine/goals";
import {
  actor,
  profile,
  household,
  householdClaim,
  careHours,
  bondFor,
  statusNames,
} from "../engine/social/selectors";
import { actionRegistry, actionUnavailable } from "../engine/actions";
import { age } from "../engine/person";
import { property } from "../engine/spatial/selectors";
import "../phase5.css";
const yen = (n: number) => "¥" + Math.round(n).toLocaleString("ja-JP");
export default function LifeJourney({
  g,
  go,
}: {
  g: GameState;
  go: (id: string) => void;
}) {
  const act = useGame((s) => s.act);
  const [tab, setTab] = useState("goals"),
    [personId, setPerson] = useState("player"),
    [goalId, setGoal] = useState("reserve"),
    [target, setTarget] = useState(180000),
    [npcId, setNpc] = useState(g.relationships[0]?.npcId ?? g.npcs[0].id),
    [amount, setAmount] = useState(10000),
    [childName, setChildName] = useState("青葉 そら"),
    [limit, setLimit] = useState(40);
  const p = profile(g, personId),
    h = household(g, "player"),
    npc = actor(g, npcId),
    bond = bondFor(g, "player", npcId),
    x = profile(g, npcId),
    active = g.social.goals.filter((v) => v.actorId === personId);
  const events = [...p.timeline].reverse(),
    goals = [...goalRegistry.values()];
  const perform = (id: string, t: ActionTarget = {}) =>
    act({ type: "execute", actionId: id, target: t });
  function button(id: string, label: string, t: ActionTarget = {}) {
    const reason = actionUnavailable(g, id, t);
    return (
      <div className="journey-action" key={id}>
        <button
          className="btn"
          disabled={!!reason}
          onClick={() => perform(id, t)}
        >
          {label}
        </button>
        {reason && <small>{reason}</small>}
      </div>
    );
  }
  return (
    <div className="journey">
      <div className="page-title">
        <span className="eyebrow">YOUR LIFE, YOUR CHOICES · v0.6</span>
        <h1>人生・目標</h1>
        <p>
          仕事の先にも、自分らしい毎日を。目標を選ぶことも、決めずに暮らすこともできます。
        </p>
      </div>
      <div className="journey-summary">
        <div>
          <small>今の暮らし</small>
          <strong>
            {age(g.person, g.date)}歳 · {property(h.homeId).name}
          </strong>
        </div>
        <div>
          <small>信頼を育てた関係</small>
          <strong>
            {
              g.social.bonds.filter(
                (b) =>
                  (b.a === "player" || b.b === "player") &&
                  b.status !== "acquaintance",
              ).length
            }
            人
          </strong>
        </div>
        <div>
          <small>あなたのストレス</small>
          <strong>{profile(g, "player").stress.toFixed(0)} / 100</strong>
        </div>
        <div>
          <small>家族との時間</small>
          <strong>毎日 {careHours(g, "player")}時間</strong>
        </div>
      </div>
      <div className="journey-tabs" role="tablist" aria-label="人生の表示">
        {[
          ["goals", "目標"],
          ["timeline", "人生年表"],
          ["people", "交流・交際"],
          ["family", "家族・共同資金"],
        ].map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {(tab === "goals" || tab === "timeline") && (
        <label className="journey-select">
          人物を選択
          <select
            aria-label="人生を見る人物"
            value={personId}
            onChange={(e) => {
              setPerson(e.target.value);
              setLimit(40);
            }}
          >
            {g.social.profiles.map((v) => (
              <option key={v.id} value={v.id}>
                {actor(g, v.id).name}
                {v.id === "player" ? "（あなた）" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {tab === "goals" && (
        <div className="journey-grid">
          <section className="card">
            <span className="eyebrow">LIFE DIRECTIONS</span>
            <h2>{actor(g, personId).name}の目標</h2>
            {!active.length && (
              <p className="journey-muted">
                まだ目標はありません。自分で選んだことだけを、少しずつ。
              </p>
            )}
            {active.map((v) => {
              const d = goalRegistry.get(v.definitionId)!;
              return (
                <article className="journey-goal" key={v.id}>
                  <span className="tag">
                    {v.status === "achieved"
                      ? "達成"
                      : v.status === "paused"
                        ? "休止中"
                        : "取り組み中"}
                  </span>
                  <h3>{d.name}</h3>
                  <p>{d.description}</p>
                  <progress
                    max={v.target}
                    value={Math.min(v.target, v.progress)}
                    aria-label={d.name + "の進捗"}
                  />
                  <div>
                    {Math.floor(v.progress).toLocaleString()} /{" "}
                    {v.target.toLocaleString()} {d.unit}
                  </div>
                  {v.completed && <small>{v.completed} 達成</small>}
                  {personId === "player" && v.status !== "achieved" && (
                    <button
                      className="btn secondary"
                      onClick={() => perform("life-goal-pause", { id: v.id })}
                    >
                      {v.status === "paused" ? "再開する" : "休止する"}
                    </button>
                  )}
                </article>
              );
            })}
          </section>
          <section className="card">
            <span className="eyebrow">CHOOSE YOUR OWN PATH</span>
            <h2>
              {personId === "player" ? "あなたの目標を追加" : "価値観と選択"}
            </h2>
            {personId === "player" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  perform("life-goal", { id: goalId, amount: target });
                }}
              >
                <label>
                  目標の種類
                  <select
                    aria-label="目標の種類"
                    value={goalId}
                    onChange={(e) => {
                      setGoal(e.target.value);
                      setTarget(goalRegistry.get(e.target.value)!.target);
                    }}
                  >
                    {goals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  目標値
                  <input
                    aria-label="目標値"
                    type="number"
                    min="1"
                    max="1000000000000"
                    step="1"
                    value={target}
                    onChange={(e) => setTarget(Number(e.target.value))}
                  />
                </label>
                <p>{goalRegistry.get(goalId)!.description}</p>
                <button
                  className="btn primary"
                  disabled={active.some(
                    (v) => v.status === "active" && v.definitionId === goalId,
                  )}
                >
                  この目標を選ぶ
                </button>
                <p className="journey-muted">
                  達成によるエンディングはありません。目標の休止や追加はいつでも自由です。
                </p>
              </form>
            ) : (
              <>
                <p>
                  安定 {p.values.security} / 向上 {p.values.ambition} / つながり{" "}
                  {p.values.connection} / 自立 {p.values.independence}
                </p>
                <p>
                  関心：{p.interests.join("・")}　リスク許容{" "}
                  {p.riskTolerance.toFixed(0)}
                </p>
                <p>
                  学習目標は勉強する技能に、失敗の記憶は次の起業資金の備えに影響します。
                </p>
                <button
                  className="btn"
                  onClick={() => {
                    setNpc(personId);
                    setTab("people");
                  }}
                >
                  この人物との関係を見る
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {tab === "timeline" && (
        <div className="journey-grid">
          <section className="card">
            <span className="eyebrow">A LIFE IN MOMENTS</span>
            <h2>{actor(g, personId).name}の人生年表</h2>
            <p>
              就職、創業、友人、交際、家族、目標達成。実際に起きた出来事が残ります。
            </p>
            {!events.length && (
              <p className="journey-muted">
                これからの出来事を、ここに記録していきます。旧セーブの過去は推測して作成しません。
              </p>
            )}
            <ol className="journey-timeline">
              {events.slice(0, limit).map((e) => (
                <li key={e.id}>
                  <time>{e.date}</time>
                  <p>{e.text}</p>
                </li>
              ))}
            </ol>
            {events.length > limit && (
              <button className="btn" onClick={() => setLimit(limit + 40)}>
                さらに40件表示
              </button>
            )}
          </section>
          <section className="card">
            <h2>最近の記憶</h2>
            <p className="journey-muted">
              最近24件の交流や出来事。大きな節目は年表に残ります。
            </p>
            {[...p.memories]
              .reverse()
              .slice(0, 12)
              .map((e) => (
                <div className="journey-memory" key={e.id}>
                  <small>{e.date}</small>
                  <p>{e.text}</p>
                </div>
              ))}
          </section>
        </div>
      )}
      {tab === "people" && (
        <div className="journey-grid">
          <section className="card">
            <span className="eyebrow">PEOPLE AROUND YOU</span>
            <h2>交流・交際</h2>
            <label>
              交流相手
              <select
                aria-label="交流相手"
                value={npcId}
                onChange={(e) => setNpc(e.target.value)}
              >
                {g.npcs.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} · {age(n, g.date)}歳
                  </option>
                ))}
              </select>
            </label>
            <h3>{npc.name}</h3>
            <p>
              {npc.occupation} · {age(npc, g.date)}歳
            </p>
            <p>
              {property(household(g, npcId).homeId).name} / 関心：
              {x.interests.join("・")}
            </p>
            <span className="tag">
              {bond ? statusNames[bond.status] : "まだ知り合っていません"}
            </span>
            <p>
              {bond
                ? `あなたの親密度 ${Math.round(bond.a === "player" ? bond.affinityA : bond.affinityB)} / 信頼 ${Math.round(bond.a === "player" ? bond.trustA : bond.trustB)}`
                : "地域で出会い、互いを知るところから。"}
            </p>
            {bond && (
              <p>
                相手の親密度{" "}
                {Math.round(
                  bond.a === "player" ? bond.affinityB : bond.affinityA,
                )}{" "}
                / 信頼{" "}
                {Math.round(bond.a === "player" ? bond.trustB : bond.trustA)} ·
                価値観の相性 {bond.attraction}
              </p>
            )}
            <p className="journey-muted">
              交際は双方の親密度65・信頼45以上、結婚は80・65以上と交際90日が必要です。成人同士で、希望・家族関係・既存のパートナーも確認します。
            </p>
            <div className="journey-actions">
              {button(
                "meet-npc",
                `会いに行く（往復込み ${actionRegistry.get("meet-npc")!.duration!(g, { id: npcId })}時間 / ${yen(actionRegistry.get("meet-npc")!.cost(g, { id: npcId }))}）`,
                { id: npcId },
              )}
              {button("socialize", "話をする · 1時間", { id: npcId })}
              {button("support-npc", "相談して支え合う · 1時間", { id: npcId })}
              {button("date-npc", "交際を相談する · 1時間", { id: npcId })}
              {button("marry-npc", "結婚・共同生活 · 2時間 / ¥5,000", {
                id: npcId,
              })}
              {bond?.status === "dating" &&
                button("end-dating", "交際を終える · 1時間", { id: npcId })}
            </div>
          </section>
          <section className="card">
            <h2>自分のペースで</h2>
            <label>
              交際への希望
              <select
                aria-label="交際への希望"
                value={profile(g, "player").romance}
                onChange={(e) =>
                  perform("romance-preference", { value: e.target.value })
                }
              >
                <option value="open">交際にも前向き</option>
                <option value="friendship">友情を大切にしたい</option>
              </select>
            </label>
            <p>
              交流には相手の時間も必要です。会いに行く場合は、移動と交通費もかかります。話をする・相談は移動を伴わない交流です。
            </p>
            <h3>街でも、人生が進んでいます</h3>
            <dl className="journey-facts">
              <dt>NPCを含む交流</dt>
              <dd>{g.social.stats.conversations}回</dd>
              <dt>育った友情</dt>
              <dd>{g.social.stats.friendships}組</dd>
              <dt>始まった交際</dt>
              <dd>{g.social.stats.partnerships}組</dd>
              <dt>成立した結婚</dt>
              <dd>{g.social.stats.marriages}組</dd>
              <dt>迎えた子ども</dt>
              <dd>{g.social.stats.births + g.social.stats.adoptions}人</dd>
            </dl>
            <p className="journey-muted">
              人数は実際の関係成立の累計です。都市全体の住民は引き続き集計モデルで表します。
            </p>
            {(["npcRelationships", "npcFamily"] as const).map((key) => (
              <label className="journey-check" key={key}>
                <input
                  type="checkbox"
                  checked={g.social.policy[key]}
                  onChange={(e) =>
                    perform("npc-life-policy", {
                      id: key,
                      value: e.target.checked ? "on" : "off",
                    })
                  }
                />
                {key === "npcRelationships"
                  ? "NPC同士の交際・結婚を進める"
                  : "NPC家族の住み替え・子育てを進める"}
              </label>
            ))}
          </section>
        </div>
      )}
      {tab === "family" && (
        <div className="journey-grid">
          <section className="card">
            <span className="eyebrow">A HOME TOGETHER</span>
            <h2>家族と暮らし</h2>
            <p>
              {property(h.homeId).name} · {h.adults.length}人の成人 /{" "}
              {h.children.length}人の子ども
            </p>
            {[...h.adults, ...h.children].map((id) => (
              <div className="journey-member" key={id}>
                <div>
                  <strong>{actor(g, id).name}</strong>
                  <small>
                    {age(actor(g, id), g.date)}歳 ·{" "}
                    {h.children.includes(id)
                      ? "子ども"
                      : id === "player"
                        ? "あなた"
                        : "家族"}
                  </small>
                </div>
                <span>養育 {careHours(g, id)}時間 / 日</span>
              </div>
            ))}
            <button className="btn secondary" onClick={() => go("map")}>
              地図で住居を探す
            </button>
            <p>
              養育は子ども1人につき毎日0.5時間を成人で分担します。これはゲーム向けの簡略モデルです。
            </p>
            <label>
              迎える子どもの名前
              <input
                aria-label="迎える子どもの名前"
                maxLength={24}
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
              />
            </label>
            {button("adopt-child", "家族で子どもを迎える · 2時間", {
              value: childName,
            })}
            <p className="journey-muted">
              独立した広さのある住居、双方20歳以上、共同資金6万円以上、養育時間が必要です。準備費1万5千円と日用品費が発生します。現実の制度を再現したものではありません。
            </p>
          </section>
          <section className="card">
            <span className="eyebrow">SHARED HOUSEHOLD ACCOUNTS</span>
            <h2>共同資金</h2>
            <dl className="journey-facts">
              <dt>世帯の現金</dt>
              <dd data-testid="household-cash">{yen(h.book.cash)}</dd>
              <dt>世帯の未払い</dt>
              <dd>{yen(h.book.debt)}</dd>
              <dt>あなたの持分</dt>
              <dd data-testid="household-claim">{yen(householdClaim(g))}</dd>
              <dt>今月の共同支出</dt>
              <dd>
                {yen(
                  h.months.find((m) => m.month === g.date.slice(0, 7))
                    ?.expenses ?? 0,
                )}
              </dd>
            </dl>
            <p>
              積立は収入・費用にせず資金を移します。共同生活費は成人で等分し、足りない分も持分と未払いに残します。会社資金は使いません。
            </p>
            <label>
              金額（円）
              <input
                aria-label="共同資金の金額"
                type="number"
                min="1"
                step="1000"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </label>
            <div className="journey-actions">
              {button("household-deposit", "この金額を積み立てる", { amount })}
              {button("household-withdraw", "自分の持分から返還する", {
                amount,
              })}
            </div>
            <label>
              毎月1日の自動積立（0で停止）
              <input
                aria-label="毎月の共同積立"
                type="number"
                min="0"
                max="1000000"
                defaultValue={h.contribution.player ?? 0}
                onBlur={(e) =>
                  perform("household-auto", { amount: Number(e.target.value) })
                }
              />
            </label>
            <p className="journey-muted">
              毎月1日に確保できる範囲で積立。NPCの配偶者は個人の手元資金1万5千円を残し、月3万5千円まで積み立てます。
            </p>
            <h3>共同資金の履歴</h3>
            {[...h.journal]
              .reverse()
              .slice(0, 10)
              .map((e) => (
                <div className="journey-memory" key={e.id}>
                  <small>{e.date}</small>
                  <p>
                    {e.label} · 現金 {e.delta.cash >= 0 ? "+" : ""}
                    {yen(e.delta.cash)} / 費用 {yen(e.delta.expenses)}
                  </p>
                </div>
              ))}
          </section>
        </div>
      )}
    </div>
  );
}
