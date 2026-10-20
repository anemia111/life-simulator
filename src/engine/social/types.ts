import type { Accounts } from "../enterprise/types";
export type BondStatus =
  "acquaintance" | "friend" | "close" | "dating" | "married" | "estranged";
export interface Bond {
  id: string;
  a: string;
  b: string;
  affinityA: number;
  affinityB: number;
  trustA: number;
  trustB: number;
  attraction: number;
  status: BondStatus;
  met: string;
  since: string;
  lastContact: string;
  interactions: number;
}
export interface LifeEvent {
  id: number;
  date: string;
  kind: string;
  text: string;
  relatedIds: string[];
}
export interface LifeGoal {
  id: string;
  actorId: string;
  definitionId: string;
  target: number;
  progress: number;
  status: "active" | "achieved" | "paused";
  created: string;
  completed: string | null;
}
export interface LifeProfile {
  id: string;
  values: {
    security: number;
    ambition: number;
    connection: number;
    independence: number;
  };
  interests: string[];
  riskTolerance: number;
  stress: number;
  romance: "open" | "friendship";
  partnerId: string | null;
  householdId: string;
  parents: string[];
  children: string[];
  timeline: LifeEvent[];
  memories: LifeEvent[];
  jobIds: string[];
  businessIds: string[];
  lastFamilyDate: string;
  birthRecorded: boolean;
}
export interface Household extends Accounts {
  id: string;
  name: string;
  adults: string[];
  children: string[];
  homeId: string;
  claims: Record<string, number>;
  contribution: Record<string, number>;
  paid: Record<string, string>;
}
export interface SocialState {
  profiles: LifeProfile[];
  bonds: Bond[];
  goals: LifeGoal[];
  households: Household[];
  lastWorldEvent: number;
  today: {
    date: string;
    npcHours: Record<string, number>;
    playerCosts: number;
    npcProcessed: boolean;
  };
  policy: { npcRelationships: boolean; npcFamily: boolean };
  stats: {
    conversations: number;
    friendships: number;
    partnerships: number;
    marriages: number;
    births: number;
    adoptions: number;
  };
}
