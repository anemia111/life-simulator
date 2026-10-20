import type { Person, Job } from "../types";
export function applicantScore(
  p: Person,
  j: Job,
  competition: number,
  trust = 0,
) {
  return (
    Math.round(
      (50 +
        p.skills[j.skill] * 1.5 +
        p.experience[j.skill] / 20 +
        trust / 10 -
        competition * 5) *
        10,
    ) / 10
  );
}
