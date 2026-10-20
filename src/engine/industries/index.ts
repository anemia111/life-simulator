import type { IndustryDefinition } from "../types";
import { writing } from "./writing";
import { bakery } from "./bakery";
// Register new independent industry modules here.
export const industries: IndustryDefinition[] = [writing, bakery];
