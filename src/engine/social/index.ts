import type { GameState } from "../types";
import { actor, profile, household, bondFor } from "./selectors";
import { converse, romanceReason, startDating } from "./relationships";
import {
  marry,
  contribute,
  adoptionReason,
  welcomeChild,
  syncHomes,
} from "./households";
import { remember } from "../events";
import { age } from "../person";
import { weekday } from "../time";
import { properties } from "../spatial/catalog";
import { property, route } from "../spatial/selectors";
import { spend } from "../enterprise/accounting";
import { quotedRent } from "../simulation/market";
import { activeGoal, seedGoals } from "../goals";
export function socialDay(s: GameState, playerLoad = 0) {
  for (const p of [s.person, ...s.npcs]) {
    const x = profile(s, p.id);
    if (!x) continue;
    const r = s.simulation.residents.find((r) => r.id === p.id),
      load = r
        ? r.hours.work + r.hours.commute + r.hours.business + r.hours.care
        : playerLoad;
    x.stress = Math.max(
      0,
      Math.min(
        100,
        x.stress +
          (load > 10 ? 1 : 0.1) -
          (p.satisfaction > 50 ? 0.25 : 0) -
          (r && r.hours.free >= 2 ? 0.4 : 0),
      ),
    );
    if (s.date.slice(5) === p.birthDate.slice(5)) {
      const text = age(p, s.date) + "歳の誕生日を迎えた";
      if (!x.timeline.some((e) => e.date === s.date && e.kind === "birthday"))
        remember(s, p.id, "birthday", text);
    }
  }
  if (weekday(s.date) !== 0) return;
  if (s.social.policy.npcRelationships) {
    const residents = s.simulation.residents;
    for (let index = 0; index < residents.length; index++) {
      const a = residents[index];
      if (age(actor(s, a.id), s.date) < 18 || a.hours.free < 1) continue;
      const pa = profile(s, a.id);
      const nearby = residents
        .filter((b) => b.id !== a.id && b.homeId === a.homeId)
        .map((b) => b.id);
      const candidates = [
        ...new Set([
          ...(pa.partnerId && pa.partnerId !== "player" ? [pa.partnerId] : []),
          ...a.contacts.filter((id) => id !== "player"),
          ...nearby,
        ]),
      ];
      if (!candidates.length) continue;
      const id =
        pa.partnerId && pa.partnerId !== "player"
          ? pa.partnerId
          : candidates[(Math.floor(s.days / 7) + index) % candidates.length];
      const b = residents.find((r) => r.id === id);
      if (!b || age(actor(s, id), s.date) < 18 || b.hours.free < 1) continue;
      const trip = route(property(a.homeId), property(b.homeId)),
        hours = 1 + trip.hours * 2,
        cost = trip.fare * 2 + 200;
      if (a.hours.free < hours || a.book.cash < cost) continue;
      spend(s, a, cost, "知人との交流・往復交通費");
      a.hours.free -= hours;
      a.hours.social++;
      a.hours.commute += hours - 1;
      b.hours.free--;
      b.hours.social++;
      converse(s, a.id, b.id, 1, pa.stress > 60 ? "support" : "chat");
      a.contacts = [...new Set([...a.contacts, b.id])].slice(-30);
      b.contacts = [...new Set([...b.contacts, a.id])].slice(-30);
      if (
        (activeGoal(s, a.id, "family") || pa.values.connection > 70) &&
        !romanceReason(s, a.id, b.id)
      )
        startDating(s, a.id, b.id);
      else if (
        !romanceReason(s, a.id, b.id, true) &&
        household(s, a.id) !== household(s, b.id)
      )
        marry(s, a.id, b.id);
    }
  }
  if (s.social.policy.npcFamily) {
    for (const h of s.social.households.filter(
      (h) => h.adults.length === 2 && !h.adults.includes("player"),
    )) {
      const parents = h.adults.map((id) => profile(s, id));
      if (
        parents.some(
          (p) =>
            !p.partnerId || bondFor(s, p.id, p.partnerId)?.status !== "married",
        )
      )
        continue;
      const youngest = Math.min(
          ...h.adults.map((id) => age(actor(s, id), s.date)),
        ),
        oldest = Math.max(...h.adults.map((id) => age(actor(s, id), s.date)));
      if (
        youngest < 20 ||
        oldest > 45 ||
        parents.some(
          (p) =>
            Date.parse(s.date) - Date.parse(p.lastFamilyDate) <
            3 * 365 * 86400000,
        )
      )
        continue;
      const members = h.adults.map((id) =>
        s.simulation.residents.find((r) => r.id === id)!,
      );
      if (
        property(h.homeId).homeStyle === "share" &&
        members.every((r) => r.book.cash > 180000 && r.hours.free >= 2)
      ) {
        const home = properties.find(
          (p) =>
            p.kind === "home" &&
            p.id === property(h.homeId).districtId + "-family",
        )!;
        const fee =
          5000 +
          Math.max(0, quotedRent(s, home) - quotedRent(s, property(h.homeId)));
        if (spend(s, members[0], fee, "家族で暮らす住居への引越し")) {
          for (const r of members) {
            r.hours.free -= 2;
            r.hours.social += 2;
          }
          members[0].homeId = home.id;
          syncHomes(s);
          for (const id of h.adults)
            remember(s, id, "move", home.name + "へ家族で引っ越した");
        }
      }
      if (h.book.cash < 75000)
        for (const r of members)
          if (r.book.cash > 100000)
            contribute(s, r.id, Math.min(40000, r.book.cash - 80000));
      if (
        !adoptionReason(s, h.adults[0]) &&
        members.every(
          (r) => r.hours.work + r.hours.commute < 10 && r.hours.free >= 2,
        )
      ) {
        welcomeChild(
          s,
          h.adults[0],
          "青葉 " + (s.social.stats.births + 1),
          true,
        );
        for (const r of members) {
          r.hours.free -= 2;
          r.hours.social += 2;
        }
      }
    }
  }
  seedGoals(s);
}
