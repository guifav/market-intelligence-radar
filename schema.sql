-- Market Intelligence Radar — PostgreSQL Schema

CREATE TABLE IF NOT EXISTS articles (
    article_id       TEXT PRIMARY KEY,
    url              TEXT NOT NULL,
    title            TEXT DEFAULT '',
    summary          TEXT DEFAULT '',
    content_preview  TEXT DEFAULT '',
    full_content     TEXT DEFAULT '',
    source_name      TEXT DEFAULT '',
    source_url       TEXT DEFAULT '',
    division         TEXT DEFAULT '',
    language         TEXT DEFAULT '',
    sentiment        TEXT DEFAULT '',
    word_count       INTEGER DEFAULT 0,
    published_date   TEXT DEFAULT '',
    scraped_at       TIMESTAMPTZ DEFAULT NOW(),
    extracted_at     TIMESTAMPTZ DEFAULT NOW(),
    extraction_status TEXT DEFAULT 'pending',
    extraction_error TEXT,
    people_count     INTEGER DEFAULT 0,
    companies_count  INTEGER DEFAULT 0,
    deals_count      INTEGER DEFAULT 0,
    signals_count    INTEGER DEFAULT 0,
    topics_count     INTEGER DEFAULT 0,
    sectors          JSONB DEFAULT '[]',
    countries        JSONB DEFAULT '[]',
    geo_regions      JSONB DEFAULT '[]',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS people (
    canonical_id         TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    title                TEXT DEFAULT '',
    company              TEXT DEFAULT '',
    context              TEXT DEFAULT '',
    seniority            TEXT DEFAULT 'unknown',
    is_decision_maker    BOOLEAN DEFAULT FALSE,
    is_author            BOOLEAN DEFAULT FALSE,
    enrichment_status    TEXT DEFAULT 'pending',
    exclusion_rule_id    TEXT,
    source_type          TEXT DEFAULT 'article_mention',
    source_name          TEXT DEFAULT '',
    division             TEXT DEFAULT '',
    divisions            JSONB DEFAULT '[]',
    category_of_operation TEXT,
    category_of_interest TEXT,
    sectors              JSONB DEFAULT '[]',
    countries            JSONB DEFAULT '[]',
    cities               JSONB DEFAULT '[]',
    geo_region           TEXT,
    -- Enrichment fields
    email                TEXT,
    phone                TEXT,
    linkedin_url         TEXT,
    photo_url            TEXT,
    headline             TEXT,
    city                 TEXT,
    state                TEXT,
    country              TEXT,
    org_name             TEXT,
    org_industry         TEXT,
    org_size             TEXT,
    org_linkedin_url     TEXT,
    org_website          TEXT,
    enriched_at          TIMESTAMPTZ,
    -- CRM matching
    crm_contact_id       TEXT,
    crm_match_type       TEXT DEFAULT 'pending',
    crm_match_score      REAL,
    -- Lead workflow
    lead_status          TEXT,
    lead_status_at       TIMESTAMPTZ,
    lead_status_by       TEXT,
    reprove_category     TEXT,
    -- Tracking
    article_ids          JSONB DEFAULT '[]',
    mention_count        INTEGER DEFAULT 1,
    quality_score        INTEGER DEFAULT 0,
    first_seen           TIMESTAMPTZ DEFAULT NOW(),
    last_seen            TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
    canonical_id         TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    sector               TEXT DEFAULT '',
    context              TEXT DEFAULT '',
    deal_involvement     BOOLEAN DEFAULT FALSE,
    source_name          TEXT DEFAULT '',
    division             TEXT DEFAULT '',
    divisions            JSONB DEFAULT '[]',
    category_of_operation TEXT,
    category_of_interest TEXT,
    sectors              JSONB DEFAULT '[]',
    countries            JSONB DEFAULT '[]',
    cities               JSONB DEFAULT '[]',
    geo_region           TEXT,
    crm_account_id       TEXT,
    crm_match_type       TEXT,
    article_ids          JSONB DEFAULT '[]',
    mention_count        INTEGER DEFAULT 1,
    first_seen           TIMESTAMPTZ DEFAULT NOW(),
    last_seen            TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deals (
    id           TEXT PRIMARY KEY,
    article_id   TEXT REFERENCES articles(article_id),
    deal_type    TEXT DEFAULT 'other',
    parties      JSONB DEFAULT '[]',
    value        TEXT DEFAULT '',
    description  TEXT DEFAULT '',
    stage        TEXT DEFAULT 'announced',
    division     TEXT DEFAULT '',
    divisions    JSONB DEFAULT '[]',
    deal_size    TEXT,
    sectors      JSONB DEFAULT '[]',
    countries    JSONB DEFAULT '[]',
    cities       JSONB DEFAULT '[]',
    geo_region   TEXT,
    extracted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signals (
    id                  TEXT PRIMARY KEY,
    article_id          TEXT REFERENCES articles(article_id),
    signal_type         TEXT DEFAULT 'market_shift',
    capital_action      TEXT DEFAULT 'none',
    portfolio_strategy  TEXT DEFAULT 'none',
    investment_strategy TEXT DEFAULT 'none',
    description         TEXT DEFAULT '',
    impact              TEXT DEFAULT 'medium',
    affected_sectors    JSONB DEFAULT '[]',
    division            TEXT DEFAULT '',
    divisions           JSONB DEFAULT '[]',
    sectors             JSONB DEFAULT '[]',
    countries           JSONB DEFAULT '[]',
    regions             JSONB DEFAULT '[]',
    geo_region          TEXT,
    extracted_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS topics (
    id           TEXT PRIMARY KEY,
    article_id   TEXT REFERENCES articles(article_id),
    topic        TEXT DEFAULT '',
    category     TEXT DEFAULT '',
    relevance    TEXT DEFAULT 'medium',
    division     TEXT DEFAULT '',
    divisions    JSONB DEFAULT '[]',
    sectors      JSONB DEFAULT '[]',
    thematic     JSONB DEFAULT '[]',
    countries    JSONB DEFAULT '[]',
    cities       JSONB DEFAULT '[]',
    geo_region   TEXT,
    extracted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exclusion_rules (
    id                    TEXT PRIMARY KEY,
    rule_type             TEXT NOT NULL,
    pattern               TEXT NOT NULL,
    division              TEXT DEFAULT 'global',
    reason                TEXT DEFAULT '',
    active                BOOLEAN DEFAULT TRUE,
    blocks_company_search BOOLEAN DEFAULT TRUE,
    matches_count         INTEGER DEFAULT 0,
    created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_contacts (
    id      TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    email   TEXT,
    company TEXT,
    title   TEXT,
    imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_articles_division ON articles(division);
CREATE INDEX IF NOT EXISTS idx_articles_scraped_at ON articles(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_people_enrichment ON people(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_people_division ON people USING gin(divisions);
CREATE INDEX IF NOT EXISTS idx_people_lead_status ON people(lead_status);
CREATE INDEX IF NOT EXISTS idx_people_quality ON people(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_companies_division ON companies USING gin(divisions);
CREATE INDEX IF NOT EXISTS idx_deals_article ON deals(article_id);
CREATE INDEX IF NOT EXISTS idx_signals_article ON signals(article_id);
CREATE INDEX IF NOT EXISTS idx_topics_article ON topics(article_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_name ON crm_contacts(name);
