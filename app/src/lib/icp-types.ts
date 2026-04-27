export interface DivisionIcp {
  label: string;
  segment: string;
  region: string;
  target_roles: string[];
  target_categories: string[];
  conditional_categories: string[];
  excluded_categories: string[];
  target_sectors: string[];
  target_countries: string[];
  languages: string[];
  notes: string;
  excluded_titles: string[];
  excluded_companies: string[];
  excluded_sectors: string[];
  excluded_countries: string[];
}

export type DivisionIcpMap = Record<string, DivisionIcp>;

export interface GlobalIcpRules {
  blocked_categories: string[];
  conditional_categories: string[];
  notes: string;
}

export interface IcpConfig {
  icps: DivisionIcpMap;
  globalRules: GlobalIcpRules;
}
