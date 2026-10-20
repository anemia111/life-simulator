import type { GameState } from "../types";
import type { Household } from "./types";
import {
  actor,
  profile,
  household,
  careHours,
  bondFor,
  npcScheduledLoad,
} from "./selectors";
import {
  book,
  spend,
  settle,
  nav,
  verifyAccounts,
} from "../enterprise/accounting";
import { post, liquid, monthReport, pay } from "../finance";
import { property, district } from "../spatial/selectors";
import { quotedRent } from "../simulation/market";
import { remember } from "../events";
import { romanceReason } from "./relationships";
import { createPerson, age } from "../person";
import { newProfile } from "./initial";
import { assertSchedule } from "../schedule";
export const shared = (h: Household) =>
  h.adults.length > 1 || h.children.length > 0;
export function contribute(
  s: GameState,
  id: string,
  amount: number,
  withdraw = false,
) {
  const h = household(s, id),
    r = s.simulation.residents.find((r) => r.id === id);
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw Error("金額は正の整数です");
  if (withdraw) {
    if (h.book.debt || h.book.cash < amount || (h.claims[id] ?? 0) < amount)
      throw Error("自分の持分・世帯現金が不足、または世帯に未払いがあります");
    book(s, h, "共同資金から返還", { cash: -amount, equity: -amount });
    h.claims[id] -= amount;
    if (id === "player") post(s, "共同資金の返還", "transfer", amount, 0, 0);
    else book(s, r!, "共同資金の返還", { cash: amount, equity: amount });
  } else {
    if (id === "player") {
      if (liquid(s) < amount) throw Error("個人資金が足りません");
      const cash = Math.min(s.cash, amount);
      post(s, "共同資金へ積立", "transfer", -cash, -(amount - cash), 0);
    } else {
      if (!r || r.book.cash < amount) throw Error("個人資金が足りません");
      book(s, r, "共同資金へ積立", { cash: -amount, equity: -amount });
    }
    book(s, h, "共同資金の積立", { cash: amount, equity: amount });
    h.claims[id] = (h.claims[id] ?? 0) + amount;
    settle(s, h);
  }
}
export function householdExpense(
  s: GameState,
  h: Household,
  amount: number,
  label: string,
) {
  spend(s, h, amount, label, true);
  const ids = [...h.adults].sort();
  for (let i = 0; i < ids.length; i++) {
    const cost =
      Math.floor(amount / ids.length) + (i < amount % ids.length ? 1 : 0);
    h.claims[ids[i]] = (h.claims[ids[i]] ?? 0) - cost;
    if (ids[i] === "player") {
      s.totals.living += cost;
      monthReport(s).living += cost;
      s.social.today.playerCosts += cost;
    }
  }
}
export function familyBills(s: GameState) {
  for (const h of s.social.households.filter(shared)) {
    const day = s.date.slice(8),
      month = s.date.slice(0, 7),
      p = property(h.homeId),
      d = district(p.districtId);
    if (day === "01")
      for (const id of h.adults) {
        const r = s.simulation.residents.find((r) => r.id === id);
        const requested = h.contribution[id] ?? 0;
        const available =
          id === "player"
            ? liquid(s)
            : Math.max(0, (r?.book.cash ?? 0) - 15000);
        const amount = Math.min(requested, available);
        if (amount > 0) contribute(s, id, amount);
      }
    const bills: [string, number, boolean][] = [
      [
        "rent",
        s.spatial.leases.find(
          (l) => l.propertyId === h.homeId && l.tenantId === "player",
        )?.rent ?? quotedRent(s, p),
        day === "01",
      ],
      [
        "utilities",
        Math.round(
          (p.homeStyle === "studio"
            ? 6500
            : p.homeStyle === "suburb"
              ? 5500
              : 4500) *
            d.livingIndex *
            s.world.costIndex,
        ),
        day === "10",
      ],
      ["communication", Math.round(2500 * s.world.costIndex), day === "15"],
    ];
    for (const [key, cost, due] of bills)
      if (due && h.paid[key] !== month) {
        householdExpense(
          s,
          h,
          cost,
          {
            rent: "共同家賃",
            utilities: "共同光熱費",
            communication: "共同通信費",
          }[key]!,
        );
        h.paid[key] = month;
      }
    if (h.children.length)
      householdExpense(
        s,
        h,
        Math.round(500 * h.children.length * d.livingIndex * s.world.costIndex),
        "子どもの食費・日用品",
      );
    settle(s, h);
    if (h.journal.length > 60)
      h.opening = {
        ...h.journal.splice(0, h.journal.length - 60).at(-1)!.after,
      };
    h.months = h.months.slice(-120);
  }
}
export function syncHomes(s: GameState) {
  for (const h of s.social.households) {
    if (h.adults.includes("player")) h.homeId = s.spatial.homePropertyId;
    else {
      const head = s.simulation.residents.find((r) => r.id === h.adults[0]);
      if (head) h.homeId = head.homeId;
    }
    for (const id of [...h.adults, ...h.children]) {
      const r = s.simulation.residents.find((r) => r.id === id);
      if (r) r.homeId = h.homeId;
    }
  }
}
export function marry(s: GameState, a: string, b: string) {
  const reason = romanceReason(s, a, b, true);
  if (reason) throw Error(reason);
  if (a === "player" || b === "player") {
    pay(s, 5000, "結婚・共同生活の準備");
    s.totals.living += 5000;
  } else {
    const payer = [a, b]
      .map((id) => s.simulation.residents.find((r) => r.id === id)!)
      .sort((x, y) => y.book.cash - x.book.cash)[0];
    if (!spend(s, payer, 5000, "結婚・共同生活の準備"))
      throw Error("共同生活の資金が足りません");
  }
  const x = household(s, a),
    y = household(s, b);
  if (x === y) throw Error("すでに同じ世帯です");
  if (
    x.adults.length !== 1 ||
    y.adults.length !== 1 ||
    x.children.length ||
    y.children.length
  )
    throw Error("既存の家族世帯の再編は今後の拡張です");
  const destination = a === "player" ? x : b === "player" ? y : x,
    source = destination === x ? y : x;
  // Preserve both opening histories: transfer all balances and each member's claim.
  const delta = { ...source.book };
  book(s, destination, "世帯の統合", delta);
  book(
    s,
    source,
    "世帯の統合",
    Object.fromEntries(Object.entries(delta).map(([k, v]) => [k, -v])),
  ); // zero source: book permits all nonnegative resulting balances
  for (const id of source.adults) {
    destination.adults.push(id);
    destination.claims[id] = source.claims[id] ?? 0;
    source.claims[id] = 0;
    profile(s, id).householdId = destination.id;
    destination.contribution[id] = id === "player" ? 0 : 35000;
  }
  source.adults = [];
  source.contribution = {};
  for (const id of destination.adults)
    if (id !== "player") destination.contribution[id] = 35000;
  const bond = bondFor(s, a, b)!;
  bond.status = "married";
  bond.since = s.date;
  s.social.stats.marriages++;
  syncHomes(s);
  for (const id of [a, b])
    remember(
      s,
      id,
      "marriage",
      actor(s, id === a ? b : a).name + "と結婚し、共同生活を始めた",
      [id === a ? b : a],
    );
}
export function adoptionReason(s: GameState, id = "player") {
  const h = household(s, id);
  if (
    h.adults.length < 2 ||
    !h.adults.every(
      (id) =>
        profile(s, id).partnerId &&
        bondFor(s, id, profile(s, id).partnerId!)?.status === "married",
    )
  )
    return "共に養育する配偶者と相談してください";
  if (property(h.homeId).homeStyle === "share")
    return "子どもと暮らせる独立した住居へ引っ越してください";
  if (property(h.homeId).area < 20 + (h.children.length + 1) * 10)
    return "住居の広さが足りません";
  if (h.book.debt || h.book.cash < 60000)
    return "共同資金に未払いのない6万円以上の備えが必要です";
  for (const adult of h.adults) {
    if (age(actor(s, adult), s.date) < 20) return "養育する成人は20歳以上です";
  }
  const ordered = [...h.adults].sort();
  for (let i = 0; i < ordered.length; i++) {
    const adult = ordered[i],
      units =
        h.children.filter((id) => age(actor(s, id), s.date) < 18).length + 1;
    const care =
      (Math.floor(units / ordered.length) +
        (i < units % ordered.length ? 1 : 0)) *
      0.5;
    if (
      adult !== "player" &&
      npcScheduledLoad(s, adult, h.homeId) + 8 + 2 + care > 24
    )
      return "養育に必要な時間を確保できません";
  }
  if (s.date === s.started) return "生活を始めてから相談してください";
  return null;
}
export function welcomeChild(
  s: GameState,
  id: string,
  name: string,
  newborn = false,
) {
  const reason = adoptionReason(s, id);
  if (reason) throw Error(reason);
  const h = household(s, id),
    p = createPerson(name);
  p.id = "child-" + ++s.sequence;
  p.birthDate =
    Number(s.date.slice(0, 4)) - (newborn ? 0 : 5) + s.date.slice(4);
  if (p.birthDate.endsWith("02-29") && !newborn)
    p.birthDate = p.birthDate.slice(0, 8) + "28";
  p.occupation = "家族と暮らす子ども";
  p.skills = { service: 0, craft: 0, digital: 0 };
  s.npcs.push(p);
  const child = newProfile(s, p, h.id);
  child.parents = [...h.adults];
  child.romance = "friendship";
  s.social.profiles.push(child);
  h.children.push(p.id);
  for (const adult of h.adults) {
    profile(s, adult).children.push(p.id);
    profile(s, adult).lastFamilyDate = s.date;
  }
  // Validate added care time before charging. dispatch is transactional on its clone.
  assertSchedule(s);
  for (const adult of h.adults) {
    const r = s.simulation.residents.find((r) => r.id === adult);
    if (r && r.hours.work + r.hours.commute + 8 + 2 + careHours(s, adult) > 24)
      throw Error("養育に必要な時間を確保できません");
  }
  householdExpense(s, h, 15000, "家族を迎える準備");
  for (const adult of h.adults)
    remember(
      s,
      adult,
      newborn ? "birth" : "adoption",
      p.name + "を家族に迎えた",
      [p.id],
    );
  remember(s, p.id, "family", "家族との暮らしが始まった", [...h.adults]);
  s.social.stats[newborn ? "births" : "adoptions"]++;
  if (newborn) {
    s.world.population++;
    s.simulation.districts.find((d) => d.id === property(h.homeId).districtId)!
      .population++;
  }
}
export function verifyHouseholds(s: GameState) {
  return s.social.households.every(
    (h) =>
      verifyAccounts(h) &&
      Object.values(h.claims).reduce((a, b) => a + b, 0) === nav(h) &&
      [...h.adults, ...h.children].every(
        (id) => profile(s, id)?.householdId === h.id,
      ),
  );
}
