# Configuration Guide

MIR uses JSON files in `app/data/` for customization. All files are loaded at runtime and can be edited without rebuilding.

## Core Configuration Files

### `sources.json`
News sources to scan. Each entry has:
- `name` — Display name
- `url` — Base URL to scan
- `region_hint` — Division to assign articles to (must match a key in `divisions.ts`)
- `enabled` — Toggle scanning on/off

### `taxonomy.json`
Industry taxonomy used by the LLM extraction prompt. Defines:
- `segments` — Top-level industry verticals
- `sectors` — Specific sectors grouped by segment
- `categories` — Organization types (Corporation, Startup, etc.)
- `investment_strategies` — Investment approach classifications
- `deal_sizes` — Deal size ranges
- `portfolio_strategies` — Portfolio action types
- `regions` / `geo_regions` — Geographic region definitions and country mappings
- `normalisation` — Country name aliases

### `division-icps.json`
Ideal Customer Profile (ICP) per division. Each division defines:
- `target_roles` — Job titles to prioritize (CEO, CTO, etc.)
- `target_categories` — Organization types to target
- `target_sectors` — Sectors of interest
- `excluded_categories` — Organization types to always skip
- `excluded_titles` / `excluded_companies` / `excluded_sectors` / `excluded_countries` — Exclusion lists

### `icp-global-rules.json`
Global ICP rules applied across all divisions:
- `blocked_categories` — Categories blocked everywhere
- `conditional_categories` — Categories that require additional signals to qualify

## Exclusion Configuration

### `excluded-roles.json`
Roles (job titles) that trigger automatic exclusion from lead extraction. Supports multiple languages:
- `excluded_roles` — English role patterns
- `excluded_roles_pt`, `excluded_roles_es`, etc. — Localized patterns

### `exclusion-keywords.json`
Keywords matched case-insensitively against extracted entities:
- `name_keywords` — Names to exclude (e.g., "unnamed", "staff reporter")
- `title_keywords` — Titles to exclude (e.g., "intern", "student")
- `company_keywords` — Company names to exclude (e.g., news agencies)

### `blocked-sectors.json`
Sectors to completely exclude from extraction. Values must match sector names in `taxonomy.json`.

### `excluded-institution-types.json`
Organization types to automatically exclude (e.g., "Government Agency", "Military Organization").

## How Configuration Flows

```
taxonomy.json ──→ LLM extraction prompt (what to look for)
                ──→ classifier.py (how to assign divisions)

division-icps.json ──→ icp_policy.py (who qualifies as a lead)

excluded-*.json ──→ exclusions.py (who to filter out)
blocked-sectors.json ──→ exclusions.py (what sectors to skip)
```

## Tips

- After editing taxonomy, the next pipeline run will use the new values automatically.
- ICPs only affect lead scoring/classification, not extraction. All entities are still extracted and stored.
- Exclusion rules are cached for 5 minutes in the pipeline process.
