import type { Person, Skill } from "./types";
export const skillNames: Record<Skill, string> = {
  service: "接客",
  craft: "制作",
  digital: "デジタル",
};
export function createPerson(name: string): Person {
  if (!name.trim() || name.trim().length > 24)
    throw Error("名前は1〜24文字で入力してください");
  return {
    id: "player",
    name: name.trim(),
    birthDate: "2008-04-01",
    energy: 100,
    health: 100,
    sleepDebt: 0,
    satisfaction: 70,
    skills: { service: 0, craft: 0, digital: 0 },
    experience: { service: 0, craft: 0, digital: 0 },
    occupation: "自由な暮らし",
    employerId: null,
    personality: "curious",
  };
}
export function age(person: Person, date: string) {
  const d = new Date(date),
    b = new Date(person.birthDate);
  return (
    d.getUTCFullYear() -
    b.getUTCFullYear() -
    (d.toISOString().slice(5, 10) < person.birthDate.slice(5, 10) ? 1 : 0)
  );
}
