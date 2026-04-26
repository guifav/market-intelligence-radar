/**
 * PostgreSQL Query Layer for MIR Dashboard
 * PostgreSQL query helpers for the MIR dashboard.
 */

import { query, queryOne } from "./db";

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListFilters {
  division?: string;
  geoRegion?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

function arrToJson(val: unknown): string {
  if (!val) return "[]";
  if (typeof val === "string") return val;
  return JSON.stringify(val);
}

// ── Articles ────────────────────────────────────────────────────────────

export async function listArticles(filters: ListFilters): Promise<PaginatedResult<Record<string, unknown>>> {
  const { division, search, page = 1, pageSize = 50 } = filters;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (division) { conditions.push(`division = $${idx++}`); params.push(division); }
  if (search) { conditions.push(`(title ILIKE $${idx} OR summary ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query<{count: string}>(`SELECT COUNT(*) as count FROM articles ${where}`, params);
  const total = parseInt(countResult[0]?.count || "0");

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);
  const rows = await query(
    `SELECT * FROM articles ${where} ORDER BY scraped_at DESC LIMIT $${idx++} OFFSET $${idx}`, params
  );

  const items = rows.map(r => ({
    ...r,
    sectors: arrToJson(r.sectors),
    countries: arrToJson(r.countries),
    geo_regions: arrToJson(r.geo_regions),
  }));

  return { items, total, page, pageSize };
}

export async function getArticle(articleId: string) {
  return queryOne("SELECT * FROM articles WHERE article_id = $1", [articleId]);
}

// ── People ──────────────────────────────────────────────────────────────

export type PeopleFilter = "all" | "enriched" | "new_contacts" | "not_found" | "not_relevant" | "approved" | "reproved";

export async function listPeople(
  filters: ListFilters & { peopleFilter?: PeopleFilter }
): Promise<PaginatedResult<Record<string, unknown>>> {
  const { division, search, page = 1, pageSize = 50, peopleFilter = "all" } = filters;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  switch (peopleFilter) {
    case "enriched":
      conditions.push(`enrichment_status = 'enriched'`);
      break;
    case "new_contacts":
      conditions.push(`enrichment_status = 'enriched' AND crm_contact_id IS NULL AND lead_status IS NULL`);
      break;
    case "not_found":
      conditions.push(`enrichment_status = 'not_found'`);
      break;
    case "not_relevant":
      conditions.push(`(enrichment_status IN ('not_relevant', 'excluded') OR is_author = TRUE)`);
      break;
    case "approved":
      conditions.push(`lead_status = 'approved'`);
      break;
    case "reproved":
      conditions.push(`lead_status = 'reproved'`);
      break;
    default: // "all"
      conditions.push(`is_author = FALSE AND enrichment_status NOT IN ('not_relevant', 'excluded')`);
  }

  if (division) { conditions.push(`divisions @> $${idx}::jsonb`); params.push(JSON.stringify([division])); idx++; }
  if (search) { conditions.push(`(name ILIKE $${idx} OR company ILIKE $${idx} OR email ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await query<{count: string}>(`SELECT COUNT(*) as count FROM people ${where}`, params);
  const total = parseInt(countResult[0]?.count || "0");

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);
  const rows = await query(
    `SELECT * FROM people ${where} ORDER BY quality_score DESC, first_seen DESC LIMIT $${idx++} OFFSET $${idx}`, params
  );

  const items = rows.map(r => ({
    ...r,
    id: r.canonical_id,
    sectors: arrToJson(r.sectors),
    taxonomy_countries: arrToJson(r.countries),
    taxonomy_cities: arrToJson(r.cities),
    divisions: arrToJson(r.divisions),
    article_ids: arrToJson(r.article_ids),
  }));

  return { items, total, page, pageSize };
}

export async function getPerson(canonicalId: string) {
  return queryOne("SELECT * FROM people WHERE canonical_id = $1", [canonicalId]);
}

export async function updatePersonLeadStatus(
  canonicalId: string, status: string | null,
  user?: string | null, reproveCategory?: string
) {
  await query(
    `UPDATE people SET lead_status=$1, lead_status_at=NOW(), lead_status_by=$2,
     reprove_category=$3, updated_at=NOW() WHERE canonical_id=$4`,
    [status, user || null, reproveCategory || null, canonicalId]
  );
}

export async function updatePersonEnrichment(
  canonicalId: string, data: Record<string, unknown>, status = "enriched"
) {
  const fields: string[] = ["enrichment_status = $1", "enriched_at = NOW()", "updated_at = NOW()"];
  const vals: unknown[] = [status];
  let idx = 2;
  const map: Record<string, string> = {
    email: "email", phone: "phone", linkedin_url: "linkedin_url",
    photo_url: "photo_url", headline: "headline", city: "city",
    state: "state", country: "country", org_name: "org_name",
    org_industry: "org_industry", org_size: "org_size",
  };
  for (const [src, dst] of Object.entries(map)) {
    if (data[src]) { fields.push(`${dst} = $${idx++}`); vals.push(data[src]); }
  }
  vals.push(canonicalId);
  await query(`UPDATE people SET ${fields.join(", ")} WHERE canonical_id = $${idx}`, vals);
}

// ── Companies ───────────────────────────────────────────────────────────

export async function listCompanies(filters: ListFilters): Promise<PaginatedResult<Record<string, unknown>>> {
  const { division, search, page = 1, pageSize = 50 } = filters;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (division) { conditions.push(`divisions @> $${idx}::jsonb`); params.push(JSON.stringify([division])); idx++; }
  if (search) { conditions.push(`(name ILIKE $${idx} OR sector ILIKE $${idx})`); params.push(`%${search}%`); idx++; }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countResult = await query<{count: string}>(`SELECT COUNT(*) as count FROM companies ${where}`, params);
  const total = parseInt(countResult[0]?.count || "0");

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);
  const rows = await query(
    `SELECT * FROM companies ${where} ORDER BY mention_count DESC LIMIT $${idx++} OFFSET $${idx}`, params
  );

  return { items: rows.map(r => ({ ...r, sectors: arrToJson(r.sectors), taxonomy_countries: arrToJson(r.countries) })), total, page, pageSize };
}

// ── Deals ───────────────────────────────────────────────────────────────

export async function listDeals(filters: ListFilters): Promise<PaginatedResult<Record<string, unknown>>> {
  const { division, page = 1, pageSize = 50 } = filters;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (division) { conditions.push(`divisions @> $${idx}::jsonb`); params.push(JSON.stringify([division])); idx++; }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countResult = await query<{count: string}>(`SELECT COUNT(*) as count FROM deals ${where}`, params);
  const total = parseInt(countResult[0]?.count || "0");

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);
  const rows = await query(
    `SELECT * FROM deals ${where} ORDER BY extracted_at DESC LIMIT $${idx++} OFFSET $${idx}`, params
  );

  return { items: rows.map(r => ({ ...r, parties: arrToJson(r.parties), sectors: arrToJson(r.sectors) })), total, page, pageSize };
}

// ── Signals ─────────────────────────────────────────────────────────────

export async function listSignals(
  filters: ListFilters & { signalType?: string; capitalAction?: string }
): Promise<PaginatedResult<Record<string, unknown>> & { typeCounts: Record<string, number>; unfilteredTotal: number }> {
  const { division, signalType, capitalAction, page = 1, pageSize = 50 } = filters;
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (division) { conditions.push(`divisions @> $${idx}::jsonb`); params.push(JSON.stringify([division])); idx++; }
  if (signalType) { conditions.push(`signal_type = $${idx++}`); params.push(signalType); }
  if (capitalAction) { conditions.push(`capital_action = $${idx++}`); params.push(capitalAction); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const countResult = await query<{count: string}>(`SELECT COUNT(*) as count FROM signals ${where}`, params);
  const total = parseInt(countResult[0]?.count || "0");

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);
  const rows = await query(
    `SELECT * FROM signals ${where} ORDER BY extracted_at DESC LIMIT $${idx++} OFFSET $${idx}`, params
  );

  const typeCounts: Record<string, number> = {};
  return { items: rows, total, page, pageSize, typeCounts, unfilteredTotal: total };
}

// ── Overview Stats ──────────────────────────────────────────────────────

export async function getOverviewStats(division?: string) {
  const divFilter = division ? `WHERE division = $1` : "";
  const divJsonFilter = division ? `WHERE divisions @> $1::jsonb` : "";
  const p = division ? [division] : [];
  const pj = division ? [JSON.stringify([division])] : [];

  const [articles, people, companies, deals, signals] = await Promise.all([
    query<{count: string}>(`SELECT COUNT(*) as count FROM articles ${divFilter}`, p),
    query<{count: string}>(`SELECT COUNT(*) as count FROM people ${divJsonFilter} AND is_author = FALSE AND enrichment_status NOT IN ('not_relevant','excluded')`.replace("AND", divJsonFilter ? "AND" : "WHERE"), pj),
    query<{count: string}>(`SELECT COUNT(*) as count FROM companies ${divJsonFilter}`, pj),
    query<{count: string}>(`SELECT COUNT(*) as count FROM deals ${divJsonFilter}`, pj),
    query<{count: string}>(`SELECT COUNT(*) as count FROM signals ${divJsonFilter}`, pj),
  ]);

  return {
    articles: { total: parseInt(articles[0]?.count || "0"), sources: 0 },
    people: { total: parseInt(people[0]?.count || "0"), decision_makers: 0, c_level: 0 },
    companies: { total: parseInt(companies[0]?.count || "0"), deal_involved: 0 },
    deals: { total: parseInt(deals[0]?.count || "0") },
    topics: { total: 0, high_relevance: 0 },
    signals: { total: parseInt(signals[0]?.count || "0"), high_impact: 0 },
  };
}

export async function getEnrichmentCounts(division?: string) {
  const filter = division ? `AND divisions @> $1::jsonb` : "";
  const p = division ? [JSON.stringify([division])] : [];

  const result = await query<Record<string, string>>(`
    SELECT
      COUNT(*) FILTER (WHERE is_author = FALSE) as total,
      COUNT(*) FILTER (WHERE enrichment_status = 'enriched') as enriched,
      COUNT(*) FILTER (WHERE enrichment_status = 'not_found') as not_found,
      COUNT(*) FILTER (WHERE enrichment_status IN ('not_relevant','excluded')) as not_relevant,
      COUNT(*) FILTER (WHERE enrichment_status = 'pending' AND is_author = FALSE) as pending
    FROM people WHERE TRUE ${filter}
  `, p);

  const r = result[0] || {};
  return {
    total: parseInt(r.total || "0"),
    enriched: parseInt(r.enriched || "0"),
    not_found: parseInt(r.not_found || "0"),
    not_relevant: parseInt(r.not_relevant || "0"),
    pending: parseInt(r.pending || "0"),
  };
}
