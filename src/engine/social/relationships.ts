import type { GameState } from "../types";
import type { Bond } from "./types";
import {
  actor,
  profile,
  bondFor,
  bondId,
  compatibility,
  npcFree,
  household,
  npcScheduledLoad,
  areKin,
} from "./selectors";
import { age } from "../person";
import { remember } from "../events";
const clamp = (n: number) => Math.max(0, Math.min(100, n));
export function ensureBond(s: GameState, a: string, b: string) {
  if (a === b || !actor(s, a) || !actor(s, b))
    throw Error("交流相手が不正です");
  let bond = bondFor(s, a, b);
  if (bond) return bond;
  const ids = [a, b].sort();
  const old =
    a === "player" || b === "player"
      ? s.relationships.find((r) => r.npcId === (a === "player" ? b : a))
      : undefined;
  bond = {
    id: bondId(a, b),
    a: ids[0],
    b: ids[1],
    affinityA: old?.affinity ?? 10,
    affinityB: old?.affinity ?? 10,
    trustA: old?.trust ?? 10,
    trustB: old?.trust ?? 10,
    attraction: compatibility(s, a, b),
    status: "acquaintance",
    met: old?.met ?? s.date,
    since: s.date,
    lastContact: s.date,
    interactions: old?.interactions ?? 0,
  };
  s.social.bonds.push(bond);
  return bond;
}
export function syncLegacy(s: GameState, b: Bond) {
  if (b.a !== "player" && b.b !== "player") return;
  const id = b.a === "player" ? b.b : b.a;
  let r = s.relationships.find((r) => r.npcId === id);
  if (!r) {
    r = { npcId: id, affinity: 0, trust: 0, met: b.met, interactions: 0 };
    s.relationships.push(r);
  }
  r.affinity = b.a === "player" ? b.affinityA : b.affinityB;
  r.trust = b.a === "player" ? b.trustA : b.trustB;
  r.interactions = b.interactions;
}
export function refreshBond(s: GameState, b: Bond) {
  const previous = b.status;
  if (["acquaintance", "friend", "close"].includes(b.status)) {
    b.status =
      Math.min(b.affinityA, b.affinityB) >= 70 &&
      Math.min(b.trustA, b.trustB) >= 55
        ? "close"
        : Math.min(b.affinityA, b.affinityB) >= 35 &&
            Math.min(b.trustA, b.trustB) >= 20
          ? "friend"
          : "acquaintance";
  }
  if (previous === "acquaintance" && b.status !== "acquaintance") {
    s.social.stats.friendships++;
    for (const id of [b.a, b.b])
      remember(
        s,
        id,
        "friendship",
        actor(s, id === b.a ? b.b : b.a).name + "と友人になった",
        [id === b.a ? b.b : b.a],
      );
  }
  syncLegacy(s, b);
}
export function converse(
  s: GameState,
  a: string,
  b: string,
  hours = 1,
  mode = "chat",
) {
  const bond = ensureBond(s, a, b),
    score = compatibility(s, a, b);
  const gain = (mode === "support" ? 3 : 4) + (score >= 75 ? 1 : 0);
  bond.affinityA = clamp(bond.affinityA + gain * hours);
  bond.affinityB = clamp(
    bond.affinityB + (gain - (profile(s, b).stress > 75 ? 1 : 0)) * hours,
  );
  bond.trustA = clamp(bond.trustA + (mode === "support" ? 4 : 2) * hours);
  bond.trustB = clamp(bond.trustB + (mode === "support" ? 4 : 2) * hours);
  bond.interactions++;
  bond.lastContact = s.date;
  for (const id of [a, b]) {
    const p = profile(s, id);
    if (id !== "player") {
      const person = actor(s, id);
      person.energy = clamp(person.energy - hours);
      person.satisfaction = clamp(person.satisfaction + hours * 2);
    }
    p.stress = clamp(p.stress - hours * (mode === "support" ? 5 : 2));
    remember(
      s,
      id,
      mode === "support" ? "support" : "conversation",
      actor(s, id === a ? b : a).name +
        "と" +
        (mode === "support" ? "相談して支え合った" : "話した"),
      [id === a ? b : a],
      false,
    );
  }
  s.social.stats.conversations++;
  refreshBond(s, bond);
  return bond;
}
export function prepareSocialDay(s: GameState) {
  if (s.social.today.date !== s.date)
    s.social.today = {
      date: s.date,
      npcHours: {},
      playerCosts: 0,
      npcProcessed: false,
    };
}
export function reserveConversation(s: GameState, id: string, hours: number) {
  prepareSocialDay(s);
  if (npcFree(s, id) + 1e-9 < hours)
    throw Error(
      "相手の勤務・生活予定が埋まっています。別の日に交流してください",
    );
  const r = s.simulation.residents.find((r) => r.id === id)!;
  if (s.social.today.npcProcessed) {
    if (r.hours.free < hours) throw Error("相手の自由時間が足りません");
    r.hours.free -= hours;
    r.hours.social += hours;
  }
  s.social.today.npcHours[id] = (s.social.today.npcHours[id] ?? 0) + hours;
}
export function romanceReason(
  s: GameState,
  a: string,
  b: string,
  marry = false,
) {
  const x = profile(s, a),
    y = profile(s, b),
    bond = bondFor(s, a, b);
  if (!x || !y || a === b) return "相手を選択してください";
  if (age(actor(s, a), s.date) < 18 || age(actor(s, b), s.date) < 18)
    return "交際・結婚は成人同士で行います";
  if (areKin(s, a, b)) return "家族との交際はできません";
  if (x.romance !== "open" || y.romance !== "open")
    return "相手は友情を希望しています";
  if ((x.partnerId && x.partnerId !== b) || (y.partnerId && y.partnerId !== a))
    return "どちらかに交際相手がいます";
  if (!bond) return "まず知り合ってください";
  if (
    Math.min(bond.affinityA, bond.affinityB) < (marry ? 80 : 65) ||
    Math.min(bond.trustA, bond.trustB) < (marry ? 65 : 45) ||
    bond.attraction < 60
  )
    return "双方の親密度・信頼・価値観がまだ整っていません";
  if (marry) {
    const ha = household(s, a),
      hb = household(s, b);
    if (
      ha === hb ||
      ha.adults.length !== 1 ||
      hb.adults.length !== 1 ||
      ha.children.length ||
      hb.children.length
    )
      return "既存の家族世帯の再編は今後の拡張です";
    const funds =
      a === "player" || b === "player"
        ? s.cash + s.bank
        : Math.max(
            ...[a, b].map(
              (id) =>
                s.simulation.residents.find((r) => r.id === id)?.book.cash ?? 0,
            ),
          );
    if (funds < 5000) return "共同生活の準備費5,000円を確保してください";
    const home = (
      a === "player"
        ? household(s, a)
        : b === "player"
          ? household(s, b)
          : household(s, a)
    ).homeId;
    if (
      [a, b].some(
        (id) => id !== "player" && npcScheduledLoad(s, id, home) + 8 + 2 > 24,
      )
    )
      return "共同生活後の通勤・生活時間を確保できません";
    if (bond.status !== "dating") return "交際している相手を選んでください";
    if (Date.parse(s.date) - Date.parse(bond.since) < 90 * 86400000)
      return "交際を90日以上続けてから相談してください";
  } else if (bond.status === "dating" || bond.status === "married")
    return "すでにパートナーです";
  return null;
}
export function startDating(s: GameState, a: string, b: string) {
  const reason = romanceReason(s, a, b);
  if (reason) throw Error(reason);
  const bond = bondFor(s, a, b)!;
  bond.status = "dating";
  bond.since = s.date;
  profile(s, a).partnerId = b;
  profile(s, b).partnerId = a;
  s.social.stats.partnerships++;
  for (const id of [a, b])
    remember(
      s,
      id,
      "partnership",
      actor(s, id === a ? b : a).name + "と話し合い、交際を始めた",
      [id === a ? b : a],
    );
  syncLegacy(s, bond);
}

export function endDating(s: GameState, a: string, b: string) {
  const bond = bondFor(s, a, b);
  if (bond?.status !== "dating") throw Error("交際中の相手を選んでください");
  bond.status = "friend";
  bond.since = s.date;
  profile(s, a).partnerId = null;
  profile(s, b).partnerId = null;
  for (const id of [a, b])
    remember(
      s,
      id,
      "separation",
      actor(s, id === a ? b : a).name + "との交際を終え、別々の人生を選んだ",
      [id === a ? b : a],
    );
  syncLegacy(s, bond);
}
