import type { IndustryModule } from "./types";
import { freelance } from "./freelance";
import { retail } from "./retail";
import { software } from "./software";
export const industryModules = new Map<string, IndustryModule>();
export function registerIndustry(module: IndustryModule) {
  if (industryModules.has(module.id)) throw Error("業界IDが重複しています");
  industryModules.set(module.id, module);
}
[freelance, retail, software].forEach(registerIndustry);
