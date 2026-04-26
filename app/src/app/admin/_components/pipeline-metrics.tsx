"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  totals: any;
  enrichment: any;
  sfMatching: any;
  dedup: any;
}

function Metric({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider">{label}</span>
      <span className="text-lg font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</span>
      {sub && <span className="text-[10px] text-[var(--muted-foreground)]">{sub}</span>}
    </div>
  );
}

function StepCard({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-5 h-5 rounded-full bg-[var(--foreground)] text-[var(--background)] text-[10px] font-bold flex items-center justify-center">
          {step}
        </span>
        <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="col-span-full">
      {label && <span className="text-[10px] text-[var(--muted-foreground)]">{label}</span>}
      <div className="w-full h-2 rounded-full bg-[var(--muted)] mt-1">
        <div className="h-2 rounded-full bg-[var(--foreground)]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-[var(--muted-foreground)]">{pct}% ({value.toLocaleString()} / {max.toLocaleString()})</span>
    </div>
  );
}

export function PipelineMetrics({ totals, enrichment, sfMatching, dedup }: Props) {
  if (!totals) return null;

  const enr = enrichment || {};
  const sf = sfMatching || {};
  const dup = dedup || {};
  const totalNonAuthor = (enr.enriched || 0) + (enr.apollo_not_found || 0) + (enr.pending || 0);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold tracking-tight">Pipeline Steps</h2>

      {/* Step 1: Scrape */}
      <StepCard step={1} title="Scrape & Extract">
        <Metric label="Articles" value={totals.articles || 0} />
        <Metric label="Sources" value={totals.sources_used || 0} />
        <Metric label="People Extracted" value={totals.people || 0} />
        <Metric label="Companies Extracted" value={totals.companies || 0} />
        <Metric label="Deals" value={totals.deals || 0} />
        <Metric label="Signals" value={totals.signals || 0} />
      </StepCard>

      {/* Step 2: Dedup */}
      <StepCard step={2} title="Business Contacts">
        <Metric label="Unique Contacts" value={dup.unique_people || 0} sub="Non-authors, excluding not relevant/excluded" />
        <Metric label="Multi-article" value={dup.multi_article_people || 0} sub="Appear in 2+ articles" />
      </StepCard>

      {/* Step 3: Enrichment */}
      <StepCard step={3} title="Apollo Enrichment">
        <Metric label="Enriched" value={enr.enriched || 0} sub={`of ${totalNonAuthor} business contacts`} />
        <Metric label="With Email" value={enr.with_email || 0} sub={enr.enriched ? `${Math.round(((enr.with_email || 0) / enr.enriched) * 100)}% reveal rate` : ""} />
        <Metric label="With LinkedIn" value={enr.with_linkedin || 0} />
        <Metric label="With Photo" value={enr.with_photo || 0} />
        <Metric label="Not Found" value={enr.apollo_not_found || 0} />
        <Metric label="Pending" value={enr.pending || 0} />
        <ProgressBar value={enr.enriched || 0} max={totalNonAuthor} label="Enrichment coverage" />
      </StepCard>

      {/* Step 4: SF Matching */}
      <StepCard step={4} title="CRM Matching">
        <Metric label="In CRM" value={sf.people_in_sf || 0} sub="Already known contacts" />
        <Metric label="New Prospect" value={sf.people_new || 0} sub="Not in CRM" />
        <Metric label="By Email" value={sf.match_by_email || 0} sub="Highest confidence (1.0)" />
        <Metric label="By Name" value={sf.match_by_name || 0} sub="Exact full name (0.8)" />
        <Metric label="By Name Prefix" value={sf.match_by_name_prefix || 0} sub="Abbreviated name (0.7)" />
        <Metric label="By Name+Company" value={sf.match_by_name_company || 0} sub="Fuzzy match (0.6)" />
        <Metric label="Companies in SF" value={sf.companies_in_sf || 0} />
        <Metric label="Companies NEW" value={sf.companies_new || 0} />
        <ProgressBar
          value={sf.people_in_sf || 0}
          max={(sf.people_in_sf || 0) + (sf.people_new || 0)}
          label="SF coverage (people)"
        />
        <ProgressBar
          value={sf.companies_in_sf || 0}
          max={(sf.companies_in_sf || 0) + (sf.companies_new || 0)}
          label="SF coverage (companies)"
        />
      </StepCard>

      {/* Pipeline info */}
      <div className="rounded-lg border border-[var(--border)] border-dashed p-3 text-[10px] text-[var(--muted-foreground)] flex gap-4 flex-wrap">
        <span>Authors excluded: {(enr.authors || 0).toLocaleString()}</span>
        <span>Not relevant / excluded: {(enr.not_relevant || 0).toLocaleString()}</span>
      </div>
    </div>
  );
}
