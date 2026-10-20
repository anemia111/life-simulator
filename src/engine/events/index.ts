import type { GameState } from "../types";
import { profile } from "../social/selectors";
export function remember(
  s: GameState,
  id: string,
  kind: string,
  text: string,
  relatedIds: string[] = [],
  major = true,
) {
  const p = profile(s, id);
  if (!p) return;
  const event = { id: ++s.sequence, date: s.date, kind, text, relatedIds };
  p.memories.push(event);
  p.memories = p.memories.slice(-24);
  if (major) p.timeline.push(event);
  if (kind === "closure") p.riskTolerance = Math.max(10, p.riskTolerance - 8);
  if (kind === "support") p.stress = Math.max(0, p.stress - 5);
}
export function observeLife(s: GameState) {
  for (const p of s.social.profiles) {
    const r = s.simulation.residents.find((r) => r.id === p.id);
    const jobs =
      p.id === "player"
        ? s.employments.map((e) => e.id)
        : [r?.jobId ?? ""].filter(Boolean);
    const businesses =
      p.id === "player"
        ? [
            ...s.ventures.filter((v) => v.status !== "closed").map((v) => v.id),
            ...s.companies
              .filter((c) => c.status === "active")
              .map((c) => c.id),
          ]
        : s.simulation.firms
            .filter((f) => f.ownerId === p.id && f.status === "active")
            .map((f) => f.id);
    for (const id of jobs.filter((id) => !p.jobIds.includes(id)))
      remember(s, p.id, "career", "新しい仕事を始めた", [id]);
    for (const id of p.jobIds.filter((id) => !jobs.includes(id)))
      remember(s, p.id, "career", "仕事を離れ、次の選択へ進んだ", [id]);
    for (const id of businesses.filter((id) => !p.businessIds.includes(id)))
      remember(s, p.id, "enterprise", "自分の事業・会社を始めた", [id]);
    p.jobIds = jobs;
    p.businessIds = businesses;
  }
  const events = s.simulation.news
    .filter((n) => n.id > s.social.lastWorldEvent)
    .reverse();
  for (const e of events) {
    const who = profile(s, e.entityId)
      ? e.entityId
      : s.simulation.firms.find((f) => f.id === e.entityId)?.ownerId;
    if (who && ["closure", "move", "credit"].includes(e.kind))
      remember(s, who, e.kind, e.text, [e.entityId]);
  }
  s.social.lastWorldEvent = Math.max(
    s.social.lastWorldEvent,
    ...s.simulation.news.map((n) => n.id),
    0,
  );
}
