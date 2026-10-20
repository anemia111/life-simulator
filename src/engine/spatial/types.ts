export type PropertyKind =
  | "home"
  | "shop"
  | "office"
  | "warehouse"
  | "workplace"
  | "competitor"
  | "facility";
export interface City {
  id: string;
  name: string;
  population: number;
  income: number;
  rentIndex: number;
  wageIndex: number;
  unemployment: number;
  economy: number;
  growth: number;
  demand: Record<string, number>;
}
export interface District {
  id: string;
  cityId: string;
  name: string;
  kind: string;
  x: number;
  y: number;
  dayPopulation: number;
  nightPopulation: number;
  footfall: number;
  rentIndex: number;
  landPrice: number;
  safety: number;
  brandFit: number;
  competition: number;
  customers: string[];
  incomeIndex: number;
  wageIndex: number;
  livingIndex: number;
  demand: Record<string, number>;
}
export interface Property {
  id: string;
  districtId: string;
  name: string;
  kind: PropertyKind;
  x: number;
  y: number;
  area: number;
  monthlyRent: number;
  purchasePrice: number;
  condition: number;
  visibility: number;
  allowedIndustries: string[];
  ownerId: string;
  tenantId: string | null;
  homeStyle?: "share" | "studio" | "suburb";
  jobId?: string;
  industry?: string;
  facility?: "library" | "park" | "clinic" | "bank";
}
export interface Lease {
  propertyId: string;
  tenantId: string;
  started: string;
  rent: number;
  paidMonth: string;
}
export interface SpatialState {
  cityId: string;
  homePropertyId: string;
  leases: Lease[];
  favorites: string[];
}
