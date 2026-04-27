"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useCallback, useEffect } from "react";
import { ExternalLink, BookOpen, Search, Loader2, Linkedin, Mail, Phone, Building2, MapPin, ChevronDown, ChevronUp, X, Calendar, Ban, CheckCircle, XCircle, RotateCcw, Play, Square, Download } from "lucide-react";
import { useDivision } from "@/lib/division";
import { RangeSlider } from "@/components/ui/range-slider";
import { Pagination } from "@/components/ui/pagination";
import { useAuth } from "@/lib/auth";

interface Person {
  id: string;
  name: string;
  title: string;
  company: string;
  seniority: string;
  is_decision_maker: boolean;
  is_author: boolean;
  context: string;
  source_name: string;
  division: string;
  divisions?: string[];
  extracted_at: string;
  article_id: string;
  article_url: string;
  article_title: string;
  apollo_id: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
  headline: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  org_name: string | null;
  org_industry: string | null;
  org_size: string | null;
  org_linkedin_url: string | null;
  org_website: string | null;
  enrichment_status: string | null;
  enriched_at: string | null;
  sf_contact_id: string | null;
  sf_match_type: string | null;
  sf_match_score: number | null;
  canonical_id: string | null;
  article_ids: string | null;
  exclusion_rule_id: string | null;
  lead_status: string | null;
  lead_status_at: string | null;
  lead_status_by: string | null;
  reprove_category?: string | null;
  reprove_reason?: string | null;

  source_type: string | null;
  mention_count: number | null;
  canonical_article_ids: string | null;
  canonical_divisions: string | null;
  quality_score: number | null;
  icp_match_pct: number | null;
  icp_match_dims: string[] | null;
  category_of_operation: string | null;
  sectors: string | null;
  geo_region: string | null;
}

type LeadActionType =
  | "approve"
  | "reprove"
  | "unapprove"
  | "mark_not_relevant";

import { DIVISION_LABELS } from "@/lib/divisions";
const DIV_LABELS: Record<string, string> = {
  ...DIVISION_LABELS,
  global: "Global", unclassified: "Unclassified",
};

const SENIORITY_COLORS: Record<string, string> = {
  "c-level": "bg-[var(--foreground)] text-[var(--background)]",
  "vp": "bg-[var(--accent)]",
  "director": "bg-[var(--accent)]",
  "manager": "bg-[var(--muted)]",
};

/* ── Exclude Modal ───────────────────────────────────────────── */

const HARD_EXCLUSION_TYPES = [
  { value: "custom", label: "Exact person name" },
  { value: "title_pattern", label: "Job title contains" },
  { value: "sector", label: "Sector contains" },
  { value: "country", label: "Country contains" },
  { value: "company_pattern", label: "Company (advanced, wide impact)" },
] as const;

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return value.trim() ? [value.trim()] : [];
  }
}

function ExcludeModal({ person, onClose, onExcluded }: {
  person: Person;
  onClose: () => void;
  onExcluded: (personId: string) => void;
}) {
  const [ruleType, setRuleType] = useState<string>("custom");
  const [pattern, setPattern] = useState(person.name || "");
  const [scope, setScope] = useState<"division" | "global">("division");
  const [reason, setReason] = useState("");
  const [confirmCompanyScope, setConfirmCompanyScope] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Auto-fill pattern when type changes
  useEffect(() => {
    const fills: Record<string, string> = {
      custom: person.name || "",
      company_pattern: person.company || "",
      title_pattern: person.title || "",
      sector: parseJsonArray(person.sectors)[0] || "",
      country: person.country || "",
    };
    setPattern(fills[ruleType] || "");
    if (ruleType !== "company_pattern") {
      setConfirmCompanyScope(false);
    }
  }, [ruleType, person]);

  const handleSubmit = async () => {
    if (!pattern.trim()) {
      setError("Pattern is required");
      return;
    }
    if (ruleType === "company_pattern" && !confirmCompanyScope) {
      setError("Confirm the company-wide impact before creating this hard exclusion");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await apiFetch("/api/exclusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_type: ruleType,
          pattern: pattern.trim(),
          division: scope === "global" ? "global" : person.division,
          reason: reason.trim(),
          source_person_id: person.id,
          source_person_name: person.name,
          created_by: "dashboard",
          origin: "dashboard_hard_exclusion",
          confirm_company_scope: confirmCompanyScope,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create exclusion rule");
        return;
      }
      onExcluded(person.id);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-md mx-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Create Hard Exclusion</h3>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X size={16} />
          </button>
        </div>

        {/* Person info */}
        <div className="mb-4 p-3 rounded bg-[var(--muted)] text-[11px] space-y-0.5">
          <div className="font-medium">{person.name}</div>
          {person.title && <div className="text-[var(--muted-foreground)]">{person.title}</div>}
          {person.company && <div className="text-[var(--muted-foreground)]">{person.company}</div>}
          <div className="text-[var(--muted-foreground)]">{DIV_LABELS[person.division] || person.division}</div>
        </div>

        <div className="mb-3 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-200/90">
          Use hard exclusion only for strong cases. For normal prospect filtering, prefer Reprove and create a division review rule by title, sector, or country.
        </div>

        {/* Exclusion type */}
        <div className="mb-3">
          <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">Hard exclusion type</label>
          <select
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
          >
            {HARD_EXCLUSION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Pattern */}
        <div className="mb-3">
          <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">
            Pattern {ruleType === "custom" ? "(exact name match)" : "(contains match)"}
          </label>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            className="w-full text-xs px-3 py-2 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            placeholder={ruleType === "company_pattern" ? "e.g. Example Holdings" : ""}
          />
        </div>

        {/* Scope */}
        <div className="mb-3">
          <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">Scope</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="radio" name="scope" checked={scope === "division"} onChange={() => setScope("division")}
                className="accent-[var(--foreground)]" />
              This division only
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="radio" name="scope" checked={scope === "global"} onChange={() => setScope("global")}
                className="accent-[var(--foreground)]" />
              All divisions
            </label>
          </div>
        </div>

        {ruleType === "company_pattern" && (
          <div className="mb-3 rounded border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] text-red-300 space-y-2">
            <p>
              Company-wide hard exclusions can block future prospects from the entire company and may also affect executive search coverage.
            </p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmCompanyScope}
                onChange={(e) => setConfirmCompanyScope(e.target.checked)}
                className="accent-red-500"
              />
              <span>I understand this has wide impact and should be used only as an exception.</span>
            </label>
          </div>
        )}

        {/* Reason */}
        <div className="mb-4">
          <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full text-xs px-3 py-2 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] resize-none"
            placeholder="Why should this pattern be excluded?"
          />
        </div>

        {error && <p className="text-[11px] text-red-500 mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-[var(--border)] text-xs hover:bg-[var(--accent)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !pattern.trim() || (ruleType === "company_pattern" && !confirmCompanyScope)}
            className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {submitting && <Loader2 size={11} className="animate-spin" />}
            Create Hard Exclusion
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Reprove Modal ───────────────────────────────────────────── */

const REPROVE_CATEGORIES = [
  { value: "wrong_seniority", label: "Wrong seniority / Not senior enough" },
  { value: "wrong_sector", label: "Wrong sector / industry" },
  { value: "wrong_geography", label: "Wrong geography / country" },
  { value: "company_not_relevant", label: "Company not relevant" },
  { value: "contact_not_relevant", label: "Contact not relevant (wrong person, politician, celebrity...)" },
  { value: "not_decision_maker", label: "Not a decision maker" },
  { value: "not_in_icp", label: "Does not match ICP" },
  { value: "duplicate", label: "Duplicate contact" },
  { value: "insufficient_data", label: "Not enough data to qualify" },
  { value: "other", label: "Other" },
] as const;

type ReviewRuleType = "excluded_titles" | "excluded_sectors" | "excluded_countries";

// Categories that auto-create division review rules (must match API-side AUTO_REVIEW_RULE_CATEGORIES)
const AUTO_REVIEW_RULE_CATEGORIES: Record<string, { ruleType: ReviewRuleType; ruleTypeLabel: string; getValue: (person: Person) => string }> = {
  wrong_seniority: { ruleType: "excluded_titles", ruleTypeLabel: "Excluded Titles", getValue: (person) => person.title || "" },
  wrong_sector: { ruleType: "excluded_sectors", ruleTypeLabel: "Excluded Sectors", getValue: (person) => parseJsonArray(person.sectors)[0] || "" },
  wrong_geography: { ruleType: "excluded_countries", ruleTypeLabel: "Excluded Countries", getValue: (person) => person.country || "" },
  not_decision_maker: { ruleType: "excluded_titles", ruleTypeLabel: "Excluded Titles", getValue: (person) => person.title || "" },
};

// Categories where user can OPTIONALLY create a division review rule (no auto-fill)
const OPTIONAL_REVIEW_RULE_CATEGORIES = new Set(["not_in_icp", "other"]);

// Categories that are reprove-only (no rule is created by default)
const NO_RULE_CATEGORIES = new Set(["duplicate", "insufficient_data", "company_not_relevant", "contact_not_relevant"]);

// Available division review rule types for manual selection
const REVIEW_RULE_OPTIONS = [
  { value: "excluded_titles", label: "Excluded Titles" },
  { value: "excluded_sectors", label: "Excluded Sectors" },
  { value: "excluded_countries", label: "Excluded Countries" },
];

interface ReproveData {
  category: string;
  reason: string;
  rulePattern?: string;
  ruleType?: ReviewRuleType;
}

interface LeadActionResult {
  id: string;
  status: string;
  error?: string;
  webhook_http?: number;
}

function ReproveModal({ person, personIds, onClose, onReproved }: {
  person: Person | null;
  personIds?: string[];
  onClose: () => void;
  onReproved: (reproveData: ReproveData) => void;
}) {
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [rulePattern, setRulePattern] = useState("");
  const [manualRuleType, setManualRuleType] = useState<ReviewRuleType | "">("");
  const [wantsRule, setWantsRule] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isBulk = !!personIds && personIds.length > 1;
  const displayName = person?.name || `${personIds?.length || 0} prospects`;

  // Determine rule mode for the selected category
  const autoRule = category ? AUTO_REVIEW_RULE_CATEGORIES[category] : undefined;
  const isOptionalRule = OPTIONAL_REVIEW_RULE_CATEGORIES.has(category);
  const isNoRule = NO_RULE_CATEGORIES.has(category);

  // Auto-fill rule pattern when category changes
  useEffect(() => {
    if (!person || !category) return;
    const rule = AUTO_REVIEW_RULE_CATEGORIES[category];
    if (rule) {
      setRulePattern(rule.getValue(person));
    } else {
      setRulePattern("");
    }
    setManualRuleType("");
    setWantsRule(false);
  }, [category, person]);

  const handleSubmit = () => {
    if (!category) return;
    setSubmitting(true);

    const data: ReproveData = { category, reason };

    if (autoRule && rulePattern.trim()) {
      data.rulePattern = rulePattern.trim();
      data.ruleType = autoRule.ruleType;
    } else if (isOptionalRule && wantsRule && manualRuleType && rulePattern.trim()) {
      data.rulePattern = rulePattern.trim();
      data.ruleType = manualRuleType;
    }

    onReproved(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-md mx-4 p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Reprove Prospect{isBulk ? "s" : ""}</h3>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X size={16} />
          </button>
        </div>

        {/* Person info */}
        <div className="mb-4 p-3 rounded bg-[var(--muted)] text-[11px] space-y-0.5">
          <div className="font-medium">{displayName}</div>
          {!isBulk && person && (
            <>
              {person.title && <div className="text-[var(--muted-foreground)]">{person.title}</div>}
              {person.company && <div className="text-[var(--muted-foreground)]">{person.company}</div>}
              <div className="text-[var(--muted-foreground)]">{DIV_LABELS[person.division] || person.division}</div>
            </>
          )}
          {isBulk && <div className="text-[var(--muted-foreground)]">{personIds!.length} prospects selected</div>}
        </div>

        {/* Category (required) */}
        <div className="mb-3">
          <label className="block text-[10px] font-medium text-red-400 mb-1.5">
            Reason category <span className="text-red-500">*</span>
          </label>
          <div className="space-y-1.5">
            {REPROVE_CATEGORIES.map((cat) => (
              <label key={cat.value} className="flex items-center gap-2 text-xs cursor-pointer hover:text-[var(--foreground)]">
                <input
                  type="radio"
                  name="reprove-category"
                  value={cat.value}
                  checked={category === cat.value}
                  onChange={() => setCategory(cat.value)}
                  className="accent-red-500"
                />
                <span className={category === cat.value ? "text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}>
                  {cat.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Rule section: auto-review categories ── */}
        {autoRule && (
          <div className={`mb-4 p-3 rounded border space-y-2.5 ${rulePattern.trim() ? "border-yellow-800/40 bg-yellow-950/20" : "border-orange-800/40 bg-orange-950/20"}`}>
            {rulePattern.trim() ? (
              <p className="text-[11px] text-yellow-200/90">
                This will also update <span className="font-medium">{person ? (DIV_LABELS[person.division] || person.division) : "this division"}</span> → <span className="font-mono font-medium">{autoRule.ruleTypeLabel}</span> with <span className="font-mono font-medium">&apos;{rulePattern}&apos;</span>. Similar prospects will stop appearing in New Prospect for this division.
              </p>
            ) : (
              <p className="text-[11px] text-orange-300/90">
                No suggested value was found for this prospect. Type a value below to create a division review rule, or leave empty to reprove without a rule.
              </p>
            )}

            {/* Editable pattern */}
            <div>
              <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">Review rule value</label>
              <input
                type="text"
                value={rulePattern}
                onChange={(e) => setRulePattern(e.target.value)}
                placeholder={`Enter ${autoRule.ruleTypeLabel.toLowerCase()} value...`}
                className="w-full text-xs px-3 py-2 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
              />
            </div>
          </div>
        )}

        {/* ── Rule section: optional division review rules ── */}
        {isOptionalRule && (
          <div className="mb-4 p-3 rounded border border-[var(--border)] bg-[var(--muted)]/30 space-y-2.5">
            <label className="flex items-center gap-2 text-[11px] cursor-pointer">
              <input
                type="checkbox"
                checked={wantsRule}
                onChange={(e) => setWantsRule(e.target.checked)}
                className="accent-[var(--foreground)]"
              />
              <span className="text-[var(--muted-foreground)]">Also create a division review rule for similar prospects</span>
            </label>

            {wantsRule && (
              <div className="space-y-2 pt-1">
                {/* Rule type selector */}
                <div>
                  <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">Division review rule</label>
                  <select
                    value={manualRuleType}
                    onChange={(e) => setManualRuleType(e.target.value as ReviewRuleType | "")}
                    className="w-full text-xs px-3 py-2 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                  >
                    <option value="">Select rule type...</option>
                    {REVIEW_RULE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Pattern input */}
                {manualRuleType && (
                  <div>
                    <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">Rule value</label>
                    <input
                      type="text"
                      value={rulePattern}
                      onChange={(e) => setRulePattern(e.target.value)}
                      placeholder={`Enter ${REVIEW_RULE_OPTIONS.find((option) => option.value === manualRuleType)?.label.toLowerCase() || "rule value"}...`}
                      className="w-full text-xs px-3 py-2 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                    />
                  </div>
                )}

                {manualRuleType && rulePattern.trim() && (
                  <p className="text-[10px] text-yellow-200/70">
                    This will update <span className="font-medium">{person ? (DIV_LABELS[person.division] || person.division) : "this division"}</span> → <span className="font-mono">{REVIEW_RULE_OPTIONS.find((option) => option.value === manualRuleType)?.label}</span> with <span className="font-mono">&apos;{rulePattern.trim()}&apos;</span>.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── No-rule categories: info only ── */}
        {isNoRule && (
          <div className="mb-4 p-2.5 rounded border border-[var(--border)] bg-[var(--muted)]/20">
            <p className="text-[10px] text-[var(--muted-foreground)]">
              {category === "duplicate" && "This category reproves the prospect only. Duplicates are data quality issues, not profile mismatches."}
              {category === "insufficient_data" && "This category reproves the prospect only. Sparse profiles may become relevant after enrichment."}
              {category === "company_not_relevant" && "This category reproves the prospect only. Prefer sector/category review rules over banning an entire company."}
              {category === "contact_not_relevant" && "This category reproves the prospect only. Use hard exclusion only for repeated false positives tied to a specific person."}
            </p>
          </div>
        )}

        {/* Details (optional) */}
        <div className="mb-4">
          <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">Details (optional)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full text-xs px-3 py-2 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)] resize-none"
            placeholder="Additional details about why this prospect is not relevant..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-[var(--border)] text-xs hover:bg-[var(--accent)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !category}
            className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {submitting && <Loader2 size={11} className="animate-spin" />}
            Reprove{isBulk ? ` (${personIds!.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Person Card ─────────────────────────────────────────────── */

function PersonCard({ person, viewMode, onEnrich, enriching, onReadArticle, onExclude, showExclude, showLeadActions, selected, onSelect, onLeadAction, onReprove, leadActioning }: {
  person: Person;
  viewMode: ViewMode;
  onEnrich: (id: string) => void;
  enriching: boolean;
  onReadArticle: (articleId: string) => void;
  onExclude?: (person: Person) => void;
  showExclude?: boolean;
  showLeadActions?: boolean;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  onLeadAction?: (id: string, action: LeadActionType) => void;
  onReprove?: (person: Person) => void;
  leadActioning?: LeadActionType | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isEnriched = person.enrichment_status === "enriched";
  const notFound = person.enrichment_status === "not_found";
  const isApproved = person.lead_status === "approved";
  const isReproved = person.lead_status === "reproved";
  const hasLeadStatus = isApproved || isReproved;

  // Card border style based on lead_status
  const cardBorder = isApproved
    ? "border-l-2 border-l-green-500/50 border-t border-r border-b border-[var(--border)]"
    : "border border-[var(--border)]";
  const cardOpacity = isReproved ? "opacity-60" : "";

  return (
    <div className={`rounded-lg bg-[var(--card)] ${cardBorder} ${cardOpacity}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Checkbox for bulk selection */}
          {onSelect && (
            <div className="flex items-center pt-1 shrink-0">
              <input
                type="checkbox"
                checked={selected || false}
                onChange={(e) => onSelect(person.id, e.target.checked)}
                className="w-3.5 h-3.5 accent-green-500 cursor-pointer"
              />
            </div>
          )}

          <div className="w-10 h-10 rounded-full bg-[var(--muted)] flex items-center justify-center shrink-0 overflow-hidden">
            {person.photo_url ? (
              <img src={person.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-[var(--muted-foreground)]">
                {person.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-semibold">{person.name}</h3>
              {person.seniority && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded ${SENIORITY_COLORS[person.seniority] || "bg-[var(--muted)]"}`}>
                  {person.seniority}
                </span>
              )}
              {person.is_decision_maker && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--foreground)] text-[var(--background)]">DM</span>
              )}
              {person.sf_contact_id && (
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-[var(--border)] bg-[var(--muted)]"
                  title={`CRM Match: ${person.sf_match_type || "matched"} (${Math.round((person.sf_match_score || 0) * 100)}%)`}>
                  In CRM
                </span>
              )}
              {!person.sf_contact_id && person.enrichment_status === "enriched" && !hasLeadStatus && (
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-dashed border-[var(--border)]"
                  title="Not found in CRM — potential new contact">
                  NEW
                </span>
              )}
              {/* Mention count badge */}
              {(person.mention_count ?? 0) > 1 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400"
                  title={`Mentioned in ${person.mention_count} articles`}>
                  {person.mention_count}x cited
                </span>
              )}
              {/* Source type badge */}
              {person.source_type === "company_drill_down" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400" title="Found via company drill-down">
                  Drill-down
                </span>
              )}
              {person.source_type === "company_executive_search" && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400" title="Found via executive search">
                  Exec Search
                </span>
              )}
              {/* Lead status badges */}
              {isApproved && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-500 font-medium flex items-center gap-0.5"
                  title={`Approved by ${person.lead_status_by || "unknown"} ${person.lead_status_at ? `on ${new Date(person.lead_status_at).toLocaleDateString()}` : ""}`}>
                  <CheckCircle size={9} /> Approved
                </span>
              )}

              {isReproved && (
                <span className="text-[9px] px-1.5 py-0.5 rounded text-[var(--muted-foreground)]"
                  title={`Reproved by ${person.lead_status_by || "unknown"} ${person.lead_status_at ? `on ${new Date(person.lead_status_at).toLocaleDateString()}` : ""}`}>
                  Reproved
                </span>
              )}
              {/* Quality score badge */}
              {person.quality_score != null && person.quality_score > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                  person.quality_score >= 8 ? "bg-emerald-500/20 text-emerald-400" :
                  person.quality_score >= 6 ? "bg-blue-500/20 text-blue-400" :
                  "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`} title={`Quality score: ${person.quality_score}/10 — email ${person.email ? "+2" : "0"}, LinkedIn ${person.linkedin_url ? "+2" : "0"}, seniority ${person.seniority === "c-level" ? "+3" : person.seniority === "director" ? "+2" : person.seniority === "manager" ? "+1" : "0"}, sector ${person.sectors && person.sectors !== "[]" ? "+2" : "0"}, company ${person.company ? "+1" : "0"}`}>
                  Score {person.quality_score}
                </span>
              )}
              {/* ICP match badge */}
              {person.icp_match_pct != null && person.icp_match_pct > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                  person.icp_match_pct >= 75 ? "bg-amber-500/20 text-amber-400" :
                  person.icp_match_pct >= 50 ? "bg-orange-500/20 text-orange-400" :
                  "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`} title={`ICP match: ${person.icp_match_pct}% — ${(person.icp_match_dims || []).join(", ") || "no dims"}`}>
                  ICP {person.icp_match_pct}%
                </span>
              )}
            </div>

            <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
              {person.headline || person.title}{person.company ? ` · ${person.company}` : ""}
            </p>

            {isEnriched && (
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {person.linkedin_url && (
                  <a href={person.linkedin_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                    <Linkedin size={10} /> LinkedIn
                  </a>
                )}
                {person.email && (
                  <a href={`mailto:${person.email}`}
                    className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                    <Mail size={10} /> {person.email}
                  </a>
                )}
                {person.phone && (
                  <span className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                    <Phone size={10} /> {person.phone}
                  </span>
                )}
                {(person.city || person.country) && (
                  <span className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
                    <MapPin size={10} /> {[person.city, person.state, person.country].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[var(--muted-foreground)] flex-wrap">
              {(() => {
                const divs = person.divisions ? (typeof person.divisions === "string" ? JSON.parse(person.divisions) : person.divisions) : [person.division];
                return (
                  <span className="flex items-center gap-1 flex-wrap">
                    {divs.map((d: string) => (
                      <span key={d} className="px-1.5 py-0.5 rounded bg-blue-600/10 text-blue-500 text-[9px] font-medium">
                        {DIV_LABELS[d] || d}
                      </span>
                    ))}
                  </span>
                );
              })()}
              <span>{person.source_name}</span>
              {(() => {
                try {
                  const ids = person.article_ids ? JSON.parse(person.article_ids) : [];
                  if (ids.length > 1) return <span className="font-medium">{ids.length} articles</span>;
                } catch {}
                return null;
              })()}
              <button
                onClick={() => onReadArticle(person.article_id)}
                className="flex items-center gap-1 hover:text-[var(--foreground)]"
                title="Read article in MIR"
              >
                <BookOpen size={10} /> Read article
              </button>
              <a href={person.article_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 hover:text-[var(--foreground)]">
                <ExternalLink size={10} /> Source
              </a>
            </div>
          </div>

          <div className={`${viewMode === "approved" && isApproved ? "flex flex-wrap justify-end gap-1 shrink-0 max-w-[240px]" : "flex flex-col gap-1 shrink-0"}`}>
            {/* Approve / Reprove buttons */}
            {showLeadActions && !hasLeadStatus && onLeadAction && (
              <>
                <button
                  onClick={() => onLeadAction(person.id, "approve")}
                  disabled={!!leadActioning}
                  className="p-1.5 rounded border border-[var(--border)] hover:bg-green-950/30 hover:border-green-800 transition-colors disabled:opacity-50"
                  title="Approve — move to Approved"
                >
                  {leadActioning === "approve" ? <Loader2 size={12} className="animate-spin text-green-500" /> : <CheckCircle size={12} className="text-green-500" />}
                </button>
                <button
                  onClick={() => onReprove ? onReprove(person) : onLeadAction?.(person.id, "reprove")}
                  disabled={!!leadActioning}
                  className="p-1.5 rounded border border-[var(--border)] hover:bg-red-950/30 hover:border-red-800 transition-colors disabled:opacity-50"
                  title="Reprove — not relevant"
                >
                  {leadActioning === "reprove" ? <Loader2 size={12} className="animate-spin text-red-500" /> : <XCircle size={12} className="text-red-500" />}
                </button>
              </>
            )}
            {viewMode === "approved" && isApproved && onLeadAction && (
              <>
                <button
                  onClick={() => onLeadAction(person.id, "unapprove")}
                  disabled={!!leadActioning}
                  className="px-2.5 py-1.5 rounded border border-[var(--border)] text-[11px] font-medium hover:bg-[var(--accent)] transition-colors disabled:opacity-50"
                  title="Unapprove — return to New Prospect"
                >
                  {leadActioning === "unapprove" ? <Loader2 size={12} className="animate-spin mx-auto" /> : <span className="text-[var(--muted-foreground)]">Unapprove</span>}
                </button>
                <button
                  onClick={() => onLeadAction(person.id, "mark_not_relevant")}
                  disabled={!!leadActioning}
                  className="px-2.5 py-1.5 rounded border border-[var(--border)] text-[11px] font-medium hover:bg-red-950/30 hover:border-red-800 transition-colors disabled:opacity-50"
                  title="Mark as not relevant"
                >
                  {leadActioning === "mark_not_relevant" ? <Loader2 size={12} className="animate-spin text-red-500 mx-auto" /> : <span className="text-red-500">Not relevant</span>}
                </button>
              </>
            )}
            {!isEnriched && !notFound && person.enrichment_status !== "excluded" && (
              <button
                onClick={() => onEnrich(person.id)}
                disabled={enriching}
                className="p-1.5 rounded border border-[var(--border)] hover:bg-[var(--accent)] transition-colors disabled:opacity-50"
                title="Enrich with Apollo"
              >
                {enriching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
              </button>
            )}
            {isEnriched && !showLeadActions && (
              <span className="text-[9px] text-green-500 px-1.5" title={`Enriched ${person.enriched_at ? new Date(person.enriched_at).toLocaleDateString() : ""}`}>
                Enriched
              </span>
            )}
            {notFound && (
              <span className="text-[9px] text-[var(--muted-foreground)] px-1.5">Not found</span>
            )}
            {person.enrichment_status === "excluded" && (
              <span className="text-[9px] text-red-500 px-1.5">Excluded</span>
            )}
            {showExclude && person.enrichment_status !== "excluded" && onExclude && (
              <button
                onClick={() => onExclude(person)}
                className="p-1.5 rounded border border-[var(--border)] hover:bg-red-950/30 hover:border-red-800 transition-colors"
                title="Create hard exclusion for this prospect"
              >
                <Ban size={12} className="text-[var(--muted-foreground)]" />
              </button>
            )}
          </div>
        </div>

        {isEnriched && person.org_name && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expanded ? "Hide details" : "Company details"}
            </button>
            {expanded && (
              <div className="mt-2 p-3 rounded bg-[var(--muted)] text-[11px] space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 size={11} className="text-[var(--muted-foreground)]" />
                  <span className="font-medium">{person.org_name}</span>
                  {person.org_website && (
                    <a href={person.org_website} target="_blank" rel="noopener noreferrer"
                      className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                      <ExternalLink size={10} />
                    </a>
                  )}
                  {person.org_linkedin_url && (
                    <a href={person.org_linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                      <Linkedin size={10} />
                    </a>
                  )}
                </div>
                {person.org_industry && <p className="text-[var(--muted-foreground)]">Industry: {person.org_industry}</p>}
                {person.org_size && <p className="text-[var(--muted-foreground)]">Employees: {person.org_size}</p>}
              </div>
            )}
          </>
        )}

        {/* ICP match details (shown when score available) */}
        {person.icp_match_pct != null && person.icp_match_pct > 0 && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-[var(--muted-foreground)]">ICP Match:</span>
            {/* Match bar */}
            <div className="flex-1 max-w-[120px] h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  person.icp_match_pct >= 75 ? "bg-amber-500" :
                  person.icp_match_pct >= 50 ? "bg-orange-500" :
                  "bg-[var(--muted-foreground)]"
                }`}
                style={{ width: `${person.icp_match_pct}%` }}
              />
            </div>
            <span className={`text-[10px] font-medium ${
              person.icp_match_pct >= 75 ? "text-amber-400" :
              person.icp_match_pct >= 50 ? "text-orange-400" :
              "text-[var(--muted-foreground)]"
            }`}>{person.icp_match_pct}%</span>
            {/* Dimension pills */}
            {(person.icp_match_dims || []).map((dim) => (
              <span key={dim} className="text-[8px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-400/80">
                {dim}
              </span>
            ))}
          </div>
        )}

        {/* Taxonomy info (sector, category, geo) */}
        {(person.category_of_operation || (person.sectors && person.sectors !== "[]") || person.geo_region) && (
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap text-[9px] text-[var(--muted-foreground)]">
            {person.category_of_operation && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--muted)]">{person.category_of_operation}</span>
            )}
            {person.sectors && person.sectors !== "[]" && (() => {
              try {
                const sectorList = JSON.parse(person.sectors);
                return sectorList.slice(0, 2).map((s: string) => (
                  <span key={s} className="px-1.5 py-0.5 rounded bg-[var(--muted)]">{s}</span>
                ));
              } catch { return null; }
            })()}
            {person.geo_region && (
              <span className="px-1.5 py-0.5 rounded bg-[var(--muted)]">{person.geo_region}</span>
            )}
          </div>
        )}

        {person.context && (
          <p className="mt-2 text-[10px] text-[var(--muted-foreground)] italic border-l-2 border-[var(--border)] pl-2">
            {person.context}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Article Reader ──────────────────────────────────────────── */

function InlineArticleReader({ articleId, onBack }: { articleId: string; onBack: () => void }) {
  const [content, setContent] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/article/${articleId}`)
      .then((r) => r.json())
      .then((data) => {
        setContent(data.full_content || data.content_preview || "Content not available");
        setTitle(data.title || "");
      })
      .catch(() => setContent("Failed to load article"))
      .finally(() => setLoading(false));
  }, [articleId]);

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-4">
        ← Back to people
      </button>
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-bold mb-4">{title}</h2>
          <div className="text-sm leading-relaxed whitespace-pre-line">{content}</div>
        </div>
      )}
    </div>
  );
}

/* ── Bulk Action Bar ─────────────────────────────────────────── */

type BulkActionButton = {
  key: string;
  label: string;
  tone: "green" | "red" | "blue" | "sky" | "amber";
  icon: "approve" | "reprove" | "unapprove" | "not_relevant";
  onClick: () => void;
};

function BulkActionBar({ count, actions, onClear, loading }: {
  count: number;
  actions: BulkActionButton[];
  onClear: () => void;
  loading: boolean;
}) {
  if (count === 0 || actions.length === 0) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--card)] border-t border-[var(--border)] py-3 px-6 flex items-center justify-center gap-4 shadow-lg">
      <span className="text-xs text-[var(--muted-foreground)]">{count} selected</span>
      {actions.map((action) => {
        const toneClass =
          action.tone === "green" ? "bg-green-600 hover:bg-green-700" :
          action.tone === "red" ? "bg-red-600 hover:bg-red-700" :
          action.tone === "blue" ? "bg-blue-600 hover:bg-blue-700" :
          action.tone === "sky" ? "bg-sky-600 hover:bg-sky-700" :
          "bg-amber-600 hover:bg-amber-700";

        const icon = loading ? (
          <Loader2 size={11} className="animate-spin" />
        ) : action.icon === "approve" ? (
          <CheckCircle size={11} />
        ) : action.icon === "reprove" ? (
          <XCircle size={11} />
        ) : action.icon === "not_relevant" ? (
          <Ban size={11} />
        ) : (
          <RotateCcw size={11} />
        );

        return (
          <button
            key={action.key}
            onClick={action.onClick}
            disabled={loading}
            className={`px-4 py-1.5 rounded text-white text-xs font-medium disabled:opacity-50 flex items-center gap-1.5 ${toneClass}`}
          >
            {icon}
            {action.label} ({count})
          </button>
        );
      })}
      <button onClick={onClear} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline">
        Clear
      </button>
    </div>
  );
}

/* ── Tab Component ──────────────────────────────────────────── */

interface PeopleData {
  people?: Person[];
  total?: number;
  page?: number;
  pageSize?: number;
}

interface EnrichStatus {
  total: number;
  enriched: number;
  not_found: number;
  pending: number;
  processed: number;
  running?: boolean;
  stopRequested?: boolean;
  startedAt?: string | null;
  lastBatchAt?: string | null;
  batchesProcessed?: number;
  lastBatchResults?: Array<{ id: string; name: string; status: string }>;
  error?: string | null;
  division?: string | null;
  leaseExpired?: boolean;
  done?: boolean;
  batch_processed?: number;
  batch_results?: Array<{ id: string; name: string; status: string }>;
}

type ViewMode = "new_contacts" | "all" | "enriched" | "approved" | "reproved" | "not_found" | "not_relevant";

function filterToViewMode(filter?: string): ViewMode {
  switch (filter) {
    case "enriched":
    case "all":
    case "approved":
    case "reproved":
    case "not_found":
    case "not_relevant":
    case "new_contacts":
      return filter;
    default:
      return "new_contacts";
  }
}

function viewModeToFilter(mode: ViewMode): string {
  return mode;
}

/* ── Export CSV Button ──────────────────────────────────────── */
function ExportCsvButton({ division }: { division: string }) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ tab: "new_contacts" });
      if (division) params.set("division", division);
      const res = await apiFetch(`/api/export-leads?${params}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mir-leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export CSV. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [division]);

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="h-7 px-3 rounded border border-[var(--border)] bg-[var(--card)] text-[11px] font-medium flex items-center gap-1.5 hover:bg-[var(--muted)] transition-colors disabled:opacity-60"
    >
      {exporting ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
      {exporting ? "Exporting..." : "Export CSV"}
    </button>
  );
}

export function PeopleTab({ data, loading, currentFilter, onPageChange, onTabParams, onRefresh, search, onSearchChange, dateFrom, dateTo, onDateFromChange, onDateToChange, scoreMin, scoreMax, icpMin, icpMax, onScoreMinChange, onScoreMaxChange, onIcpMinChange, onIcpMaxChange }: {
  data: PeopleData | null;
  loading?: boolean;
  currentFilter?: string;
  onPageChange: (page: number) => void;
  onTabParams?: (params: Record<string, string>) => void;
  onRefresh?: () => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateFromChange?: (value: string) => void;
  onDateToChange?: (value: string) => void;
  scoreMin?: string;
  scoreMax?: string;
  icpMin?: string;
  icpMax?: string;
  onScoreMinChange?: (value: string) => void;
  onScoreMaxChange?: (value: string) => void;
  onIcpMinChange?: (value: string) => void;
  onIcpMaxChange?: (value: string) => void;
}) {
  const { user } = useAuth();
  const { division } = useDivision();
  const [viewMode, setViewMode] = useState<ViewMode>(() => filterToViewMode(currentFilter));
  const [readingArticleId, setReadingArticleId] = useState<string | null>(null);
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [excludingPerson, setExcludingPerson] = useState<Person | null>(null);
  const [reprovingPerson, setReprovingPerson] = useState<Person | null>(null);
  const [bulkReproving, setBulkReproving] = useState(false);
  const [recentExclusions, setRecentExclusions] = useState(0);
  const [recentApprovals, setRecentApprovals] = useState(0);

  // Lead action state
  const [leadActioningIds, setLeadActioningIds] = useState<Map<string, LeadActionType>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [leadActionError, setLeadActionError] = useState<string | null>(null);

  // Local people state for in-place updates after enrichment
  const [localPeople, setLocalPeople] = useState<Person[]>([]);
  useEffect(() => {
    setLocalPeople(data?.people ?? []);
  }, [data?.people]);

  // Clear selection when view mode changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [viewMode]);

  useEffect(() => {
    setViewMode(filterToViewMode(currentFilter));
  }, [currentFilter]);

  // Enrichment job state
  const [enrichStatus, setEnrichStatus] = useState<EnrichStatus | null>(null);
  const [enrichRunning, setEnrichRunning] = useState(false);
  const [lastBatchNames, setLastBatchNames] = useState<string[]>([]);
  const [enrichActionError, setEnrichActionError] = useState<string | null>(null);

  // Check enrichment status from server
  const checkStatus = useCallback(async () => {
    try {
      const res = await apiFetch("/api/enrich-job");
      if (res.ok) {
        const status = await res.json();
        setEnrichStatus(status);
        setEnrichRunning(Boolean(status.running));
        if (status.lastBatchResults?.length) {
          setLastBatchNames(status.lastBatchResults.map((r: { name: string; status: string }) => `${r.name} → ${r.status}`));
        } else {
          setLastBatchNames([]);
        }
        setEnrichActionError(status.error || null);
        return status;
      }
      const data = await res.json().catch(() => ({}));
      setEnrichActionError((data as { error?: string }).error || "Failed to load enrichment status");
    } catch {
      setEnrichActionError("Failed to load enrichment status");
    }
    return null;
  }, []);

  // Poll server status every 3s (picks up server-side progress regardless of tab focus)
  useEffect(() => {
    if (viewMode !== "all") return;

    checkStatus(); // immediate check on mount

    const pollTimer = setInterval(() => {
      checkStatus();
    }, 3000);

    return () => clearInterval(pollTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Update a single person in local state
  const updatePersonLocally = useCallback((id: string, updates: Partial<Person>) => {
    setLocalPeople((prev) => prev.map((p) => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const handleViewChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === "not_relevant") setRecentExclusions(0);
    if (mode === "approved") setRecentApprovals(0);
    if (onTabParams) {
      onTabParams({ people_filter: viewModeToFilter(mode) });
    }
  }, [onTabParams]);

  // Single person enrich with in-place update
  const handleEnrich = useCallback(async (personId: string) => {
    setEnrichingIds((prev) => new Set(prev).add(personId));
    try {
      const res = await apiFetch("/api/enrich-person", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId }),
      });
      if (res.ok) {
        const json = await res.json();
        const result = json.results?.[0];
        if (result) {
          // Fetch the updated person data from intelligence API
          const personRes = await apiFetch(`/api/intelligence?tab=people&pageSize=1&person_id=${personId}`);
          if (personRes.ok) {
            const personData = await personRes.json();
            const updated = personData.people?.[0];
            if (updated) {
              updatePersonLocally(personId, updated);
            } else {
              // Fallback: mark the status locally
              updatePersonLocally(personId, { enrichment_status: result.status });
            }
          } else {
            updatePersonLocally(personId, { enrichment_status: result.status });
          }
        }
        checkStatus();
      }
    } catch (err) {
      console.error("Enrich error:", err);
    } finally {
      setEnrichingIds((prev) => { const s = new Set(prev); s.delete(personId); return s; });
    }
  }, [checkStatus, updatePersonLocally]);

  const expectedStatusesForAction = useCallback((action: LeadActionType): string[] => {
    switch (action) {
      case "approve":
        return ["approved"];
      case "reprove":
        return ["reproved"];
      case "unapprove":
        return ["unapproved"];
      case "mark_not_relevant":
        return ["not_relevant"];
    }
  }, []);

  const applyActionLocally = useCallback((result: LeadActionResult, action: LeadActionType) => {
    const now = new Date().toISOString();
    if (action === "approve") {
      updatePersonLocally(result.id, {
        lead_status: "approved",
        lead_status_at: now,
        lead_status_by: user?.email || null,
      });
      return;
    }
    if (action === "reprove") {
      updatePersonLocally(result.id, {
        lead_status: "reproved",
        lead_status_at: now,
        lead_status_by: user?.email || null,
      });
      return;
    }
    if (action === "unapprove") {
      updatePersonLocally(result.id, {
        lead_status: null,
        lead_status_at: null,
        lead_status_by: null,
        reprove_category: null,
        reprove_reason: null,
      });
      return;
    }
    if (action === "mark_not_relevant") {
      updatePersonLocally(result.id, {
        enrichment_status: "not_relevant",
        lead_status: null,
        lead_status_at: null,
        lead_status_by: null,
        reprove_category: null,
        reprove_reason: null,
      });
    }
  }, [updatePersonLocally, user?.email]);

  const applyFailureLocally = useCallback((_result: LeadActionResult, _action: LeadActionType) => {
    // No delivery-specific failure handling needed in the open-source version
  }, []);

  const actionErrorMessage = useCallback((action: LeadActionType, failedCount: number): string => {
    switch (action) {
      case "approve":
        return failedCount === 1 ? "Failed to approve the prospect." : `${failedCount} prospects could not be approved.`;
      case "reprove":
        return failedCount === 1 ? "Failed to reprove the prospect." : `${failedCount} prospects could not be reproved.`;
      case "unapprove":
        return failedCount === 1 ? "Failed to unapprove the prospect." : `${failedCount} prospects could not be unapproved.`;
      case "mark_not_relevant":
        return failedCount === 1 ? "Failed to mark the prospect as not relevant." : `${failedCount} prospects could not be marked as not relevant.`;
    }
  }, []);

  // Lead action for a single person or bulk
  const handleLeadAction = useCallback(async (
    personId: string | string[],
    action: LeadActionType,
    reproveData?: ReproveData,
  ) => {
    if (!user?.email) return;
    const ids = Array.isArray(personId) ? personId : [personId];
    const isBulk = Array.isArray(personId);

    if (!isBulk) {
      setLeadActioningIds((prev) => new Map(prev).set(ids[0], action));
    }
    setLeadActionError(null);

    try {
      const payload: Record<string, unknown> = {
        action,
        user: user.email,
      };
      if (isBulk) {
        payload.personIds = ids;
      } else {
        payload.personId = ids[0];
      }

      // Attach reprove data
      if (action === "reprove" && reproveData) {
        payload.reproveCategory = reproveData.category;
        payload.reproveReason = reproveData.reason;
        if (reproveData.rulePattern) {
          payload.rulePattern = reproveData.rulePattern;
        }
        if (reproveData.ruleType) {
          payload.ruleType = reproveData.ruleType;
        }
      }

      const res = await apiFetch("/api/lead-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLeadActionError((json as { error?: string }).error || "Lead action failed");
        return;
      }

      const results: LeadActionResult[] = Array.isArray((json as { results?: LeadActionResult[] }).results)
        ? ((json as { results: LeadActionResult[] }).results)
        : [json as LeadActionResult];
      const expectedStatuses = expectedStatusesForAction(action);
      const successful = results.filter((result) => expectedStatuses.includes(result.status));
      const failed = results.filter((result) => !expectedStatuses.includes(result.status));

      if (successful.length > 0) {
        for (const result of successful) {
          applyActionLocally(result, action);
        }
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const result of successful) next.delete(result.id);
          return next;
        });
        if (action === "approve") setRecentApprovals((prev) => prev + successful.length);
      }

      if (failed.length > 0) {
        for (const result of failed) {
          applyFailureLocally(result, action);
        }
      }

      if (!isBulk && failed.length === 0 && successful.length > 0) {
        if (viewMode === "new_contacts" && action === "approve") {
          handleViewChange("approved");
        }
        if (viewMode === "approved" && action === "unapprove") {
          handleViewChange("new_contacts");
        }
        if (viewMode === "approved" && action === "mark_not_relevant") {
          handleViewChange("not_relevant");
        }
      }

      if (successful.length > 0 || failed.length > 0) {
        setTimeout(() => onRefresh?.(), 400);
      }

      if (failed.length > 0) {
        setLeadActionError(actionErrorMessage(action, failed.length));
      }
    } catch (err) {
      console.error("Lead action error:", err);
      setLeadActionError("Network error running lead action");
    } finally {
      if (!isBulk) {
        setLeadActioningIds((prev) => { const m = new Map(prev); m.delete(ids[0]); return m; });
      }
    }
  }, [user, expectedStatusesForAction, applyActionLocally, applyFailureLocally, viewMode, handleViewChange, onRefresh, actionErrorMessage]);

  // Bulk lead action
  const handleBulkAction = useCallback(async (action: LeadActionType, reproveData?: ReproveData) => {
    if (!user?.email || selectedIds.size === 0) return;

    // For reprove, open modal instead of direct action
    if (action === "reprove" && !reproveData) {
      setBulkReproving(true);
      return;
    }

    setBulkLoading(true);
    setLeadActionError(null);
    try {
      const payload: Record<string, unknown> = {
        personIds: Array.from(selectedIds),
        action,
        user: user.email,
      };
      if (action === "reprove" && reproveData) {
        payload.reproveCategory = reproveData.category;
        payload.reproveReason = reproveData.reason;
        if (reproveData.rulePattern) {
          payload.rulePattern = reproveData.rulePattern;
        }
        if (reproveData.ruleType) {
          payload.ruleType = reproveData.ruleType;
        }
      }

      const res = await apiFetch("/api/lead-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLeadActionError((json as { error?: string }).error || "Bulk lead action failed");
        return;
      }

      const results: LeadActionResult[] = Array.isArray((json as { results?: LeadActionResult[] }).results)
        ? ((json as { results: LeadActionResult[] }).results)
        : [];
      const expectedStatuses = expectedStatusesForAction(action);
      const successful = results.filter((result) => expectedStatuses.includes(result.status));
      const failed = results.filter((result) => !expectedStatuses.includes(result.status));

      if (successful.length > 0) {
        for (const result of successful) {
          applyActionLocally(result, action);
        }
        if (action === "approve") setRecentApprovals((prev) => prev + successful.length);
      }

      if (failed.length > 0) {
        for (const result of failed) {
          applyFailureLocally(result, action);
        }
      }

      setSelectedIds(new Set(failed.map((result) => result.id)));

      if (successful.length > 0 || failed.length > 0) {
        setTimeout(() => onRefresh?.(), 400);
      }

      if (failed.length > 0) {
        setLeadActionError(`${actionErrorMessage(action, failed.length)} They remain selected.`);
      }
    } catch (err) {
      console.error("Bulk action error:", err);
      setLeadActionError("Network error running bulk lead action");
    } finally {
      setBulkLoading(false);
    }
  }, [user, selectedIds, expectedStatusesForAction, applyActionLocally, applyFailureLocally, onRefresh, actionErrorMessage]);

  // Start server-side enrichment job
  const handleEnrichAll = useCallback(async () => {
    if (enrichRunning) return;
    setEnrichActionError(null);
    try {
      const res = await apiFetch("/api/enrich-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEnrichActionError((result as { error?: string }).error || "Failed to start enrichment");
        return;
      }
      setEnrichRunning(Boolean((result as { running?: boolean }).running ?? true));
      setEnrichStatus(result as EnrichStatus);
      setLastBatchNames([]);
    } catch (err) {
      console.error("Failed to start enrichment:", err);
      setEnrichActionError("Network error starting enrichment");
    }
  }, [enrichRunning]);

  // Stop server-side enrichment job
  const handleStopEnrich = useCallback(async () => {
    setEnrichActionError(null);
    try {
      const res = await apiFetch("/api/enrich-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop" }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEnrichActionError((result as { error?: string }).error || "Failed to stop enrichment");
        return;
      }
      setEnrichStatus((prev) => prev ? { ...prev, stopRequested: true } : prev);
    } catch (err) {
      console.error("Failed to stop enrichment:", err);
      setEnrichActionError("Network error stopping enrichment");
    }
  }, []);

  const handleExcluded = useCallback((personId: string) => {
    // Mark person as excluded locally
    updatePersonLocally(personId, { enrichment_status: "excluded" } as Partial<Person>);
    setRecentExclusions((prev) => prev + 1);
    // Refresh after a short delay to allow the update to propagate
    setTimeout(() => onRefresh?.(), 1500);
  }, [updatePersonLocally, onRefresh]);

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  // Determine which tabs should show lead action buttons
  const showLeadActionsForMode = viewMode === "new_contacts" || viewMode === "all" || viewMode === "enriched";
  // Show bulk checkboxes in New Prospect and Approved
  const showBulkSelect = viewMode === "new_contacts" || viewMode === "approved";

  const selectedPeople = localPeople.filter((p) => selectedIds.has(p.id));
  const bulkActions: BulkActionButton[] =
    viewMode === "new_contacts"
      ? [
          { key: "approve", label: "Approve Selected", tone: "green", icon: "approve", onClick: () => handleBulkAction("approve") },
          { key: "reprove", label: "Reprove Selected", tone: "red", icon: "reprove", onClick: () => handleBulkAction("reprove") },
        ]
      : viewMode === "approved"
        ? [
            { key: "unapprove", label: "Unapprove", tone: "amber", icon: "unapprove", onClick: () => handleBulkAction("unapprove") },
            { key: "mark_not_relevant", label: "Not Relevant", tone: "red", icon: "not_relevant", onClick: () => handleBulkAction("mark_not_relevant") },
          ]
        : [];

  if (readingArticleId) {
    return <InlineArticleReader articleId={readingArticleId} onBack={() => setReadingArticleId(null)} />;
  }

  const pending = enrichStatus?.pending ?? 0;
  const total = enrichStatus?.total ?? 0;
  const processed = enrichStatus?.processed ?? 0;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  const enrichDivisionLabel = enrichStatus?.division ? (DIV_LABELS[enrichStatus.division] || enrichStatus.division) : null;
  const enrichLastBatchTime = enrichStatus?.lastBatchAt ? new Date(enrichStatus.lastBatchAt).toLocaleTimeString() : null;
  const enrichStartedTime = enrichStatus?.startedAt ? new Date(enrichStatus.startedAt).toLocaleTimeString() : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {/* Pipeline tabs */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--muted)]">
            {(["new_contacts", "enriched", "all", "not_found", "not_relevant"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleViewChange(mode)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  viewMode === mode ? "bg-[var(--background)] shadow-sm" : "text-[var(--muted-foreground)]"
                }`}
              >
                {mode === "new_contacts" ? "New Prospect" : mode === "all" ? "All Identified" : mode === "enriched" ? "Enriched" : mode === "not_found" ? "Not Found in Enrichment" : "Not Relevant"}
                {mode === "not_relevant" && recentExclusions > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-red-600 text-white text-[9px] font-bold">
                    +{recentExclusions}
                  </span>
                )}
              </button>
            ))}
          </div>
          {/* Review tabs */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--muted)]">
            {(["approved", "reproved"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => handleViewChange(mode)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  viewMode === mode ? "bg-[var(--background)] shadow-sm" : "text-[var(--muted-foreground)]"
                }`}
              >
                {mode === "approved" ? "Approved" : "Reproved"}
                {mode === "approved" && recentApprovals > 0 && (
                  <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-green-600 text-white text-[9px] font-bold">
                    +{recentApprovals}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {viewMode === "new_contacts" && (
          <ExportCsvButton division={division} />
        )}

        {viewMode === "all" && (
          <div className="flex items-center gap-2 flex-wrap">
            {pending > 0 && !enrichRunning && (
              <>
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                  <Search size={11} />
                  <span>
                    {pending} pending enrichment
                    {enrichDivisionLabel ? ` · ${enrichDivisionLabel}` : ""}
                    {enrichStatus?.leaseExpired ? " · previous lease expired, safe to resume" : " · runs daily at 6pm BRT"}
                  </span>
                </div>
                <button
                  onClick={handleEnrichAll}
                  className="h-7 px-3 rounded border border-[var(--border)] bg-[var(--card)] text-[11px] font-medium flex items-center gap-1.5 hover:bg-[var(--muted)]"
                >
                  <Play size={11} />
                  {enrichStatus?.leaseExpired ? "Resume Enrichment" : "Start Enrichment"}
                </button>
              </>
            )}
            {enrichRunning && (
              <>
                <span className="h-7 px-3 rounded border border-[var(--border)] bg-[var(--muted)] text-[11px] flex items-center gap-1.5">
                  <Loader2 size={11} className="animate-spin" />
                  {enrichStatus?.stopRequested ? `Stopping after current batch... (${pending} remaining)` : `Enriching... (${pending} remaining)`}
                </span>
                <button
                  onClick={handleStopEnrich}
                  disabled={Boolean(enrichStatus?.stopRequested)}
                  className="h-7 px-3 rounded border border-red-500/30 bg-red-500/10 text-[11px] font-medium text-red-300 flex items-center gap-1.5 hover:bg-red-500/15 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Square size={11} />
                  {enrichStatus?.stopRequested ? "Stopping..." : "Stop Enrichment"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Search + Date filters */}
      {onSearchChange && (
        <div className="mb-4 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              type="text"
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search people — name, company, title, email, country..."
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
            {search && (
              <button onClick={() => onSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                <X size={14} />
              </button>
            )}
          </div>
          {onDateFromChange && (
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar size={12} className="text-[var(--muted-foreground)]" />
              <span className="text-[10px] text-[var(--muted-foreground)]">Extracted</span>
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] text-[var(--muted-foreground)]">From</label>
                <input type="date" value={dateFrom ?? ""} onChange={(e) => onDateFromChange(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] text-[var(--muted-foreground)]">To</label>
                <input type="date" value={dateTo ?? ""} onChange={(e) => onDateToChange?.(e.target.value)}
                  className="text-xs px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]" />
              </div>
              {(dateFrom || dateTo) && (
                <button onClick={() => { onDateFromChange(""); onDateToChange?.(""); }}
                  className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] underline">Clear dates</button>
              )}
            </div>
          )}
          {/* Score & ICP range sliders */}
          {(viewMode === "new_contacts" || viewMode === "enriched") && onScoreMinChange && (
            <div className="flex items-center gap-4 flex-wrap">
              <RangeSlider
                label="Score"
                min={0}
                max={10}
                step={1}
                valueMin={parseInt(scoreMin || "0", 10)}
                valueMax={parseInt(scoreMax || "10", 10)}
                onChange={(lo, hi) => { onScoreMinChange(lo === 0 ? "" : String(lo)); onScoreMaxChange?.(hi === 10 ? "" : String(hi)); }}
                accentClass="bg-emerald-500"
              />
              <RangeSlider
                label="ICP %"
                min={0}
                max={100}
                step={5}
                valueMin={parseInt(icpMin || "0", 10)}
                valueMax={parseInt(icpMax || "100", 10)}
                onChange={(lo, hi) => { onIcpMinChange?.(lo === 0 ? "" : String(lo)); onIcpMaxChange?.(hi === 100 ? "" : String(hi)); }}
                formatValue={(v) => `${v}%`}
                accentClass="bg-amber-500"
              />
              {(scoreMin || scoreMax || icpMin || icpMax) && (
                <button onClick={() => { onScoreMinChange(""); onScoreMaxChange?.(""); onIcpMinChange?.(""); onIcpMaxChange?.(""); }}
                  className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  title="Reset filters">
                  <RotateCcw size={10} />
                  <span>Reset</span>
                </button>
              )}
            </div>
          )}
          {(search || dateFrom || dateTo || scoreMin || scoreMax || icpMin || icpMax) && data && (
            <div className="text-[11px] text-[var(--muted-foreground)]">
              {data.total === 0 ? "No people found" : `${(data.total ?? 0).toLocaleString()} result${data.total === 1 ? "" : "s"}`}
              {search ? ` for "${search}"` : ""}
              {dateFrom || dateTo ? ` · ${dateFrom || "∞"} → ${dateTo || "today"}` : ""}
              {scoreMin || scoreMax ? ` · Score ${scoreMin || "0"}–${scoreMax || "10"}` : ""}
              {icpMin || icpMax ? ` · ICP ${icpMin || "0"}–${icpMax || "100"}%` : ""}
            </div>
          )}
        </div>
      )}

      {viewMode === "all" && enrichRunning && enrichStatus && (
        <div className="mb-4 rounded-lg border border-[var(--border)] p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px] flex-wrap gap-1">
            <div className="flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-[var(--muted-foreground)]" />
              <span className="font-medium">
                {enrichStatus.stopRequested ? "Stopping enrichment after current batch..." : "Enriching contacts server-side (safe to switch tabs)..."}
              </span>
            </div>
            <span className="text-[var(--muted-foreground)]">
              {processed} / {total} ({pct}%) · {enrichStatus.enriched} found · {enrichStatus.not_found} not found{pending > 0 ? ` · ${pending} remaining` : ""}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--muted-foreground)] flex-wrap">
            <span>
              {enrichDivisionLabel ? `${enrichDivisionLabel} · ` : ""}
              {typeof enrichStatus.batchesProcessed === "number" ? `${enrichStatus.batchesProcessed} batches` : "0 batches"}
            </span>
            <span>
              {enrichStartedTime ? `Started ${enrichStartedTime}` : ""}
              {enrichLastBatchTime ? `${enrichStartedTime ? " · " : ""}Last batch ${enrichLastBatchTime}` : ""}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--foreground)] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {lastBatchNames.length > 0 && (
            <div className="text-[10px] text-[var(--muted-foreground)] space-y-0.5 max-h-20 overflow-y-auto">
              {lastBatchNames.map((n, i) => (
                <div key={i}>{n}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewMode === "all" && enrichActionError && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          {enrichActionError}
        </div>
      )}

      {leadActionError && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
          {leadActionError}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
        </div>
      ) : localPeople.length === 0 ? (
        <div className="text-sm text-[var(--muted-foreground)] py-8 text-center">
          {search ? "No people match your search." : `No ${viewMode === "not_relevant" ? "not relevant contacts" : viewMode === "not_found" ? "contacts not found in enrichment" : viewMode === "enriched" ? "enriched contacts" : viewMode === "approved" ? "approved contacts" : viewMode === "reproved" ? "reproved contacts" : viewMode === "new_contacts" ? "new prospects" : "people"} found.`}
        </div>
      ) : (
        <div className="space-y-3">
          {localPeople.map((p) => (
            <PersonCard
              key={p.id}
              person={p}
              viewMode={viewMode}
              onEnrich={handleEnrich}
              enriching={enrichingIds.has(p.id)}
              onReadArticle={setReadingArticleId}
              showExclude={viewMode !== "not_relevant" && viewMode !== "approved" && viewMode !== "reproved"}
              onExclude={setExcludingPerson}
              showLeadActions={showLeadActionsForMode && !p.lead_status}
              selected={selectedIds.has(p.id)}
              onSelect={
                showBulkSelect && (
                  (viewMode === "new_contacts" && !p.lead_status) ||
                  (viewMode === "approved" && p.lead_status === "approved")
                ) ? handleSelect : undefined
              }
              onLeadAction={handleLeadAction}
              onReprove={setReprovingPerson}
              leadActioning={leadActioningIds.get(p.id) || null}
            />
          ))}
        </div>
      )}

      <Pagination
        page={data?.page ?? 1}
        pageSize={data?.pageSize ?? 30}
        total={data?.total ?? 0}
        onPageChange={onPageChange}
      />

      {excludingPerson && (
        <ExcludeModal
          person={excludingPerson}
          onClose={() => setExcludingPerson(null)}
          onExcluded={handleExcluded}
        />
      )}

      {/* Single reprove modal */}
      {reprovingPerson && (
        <ReproveModal
          person={reprovingPerson}
          onClose={() => setReprovingPerson(null)}
          onReproved={async (reproveData) => {
            await handleLeadAction(reprovingPerson.id, "reprove", reproveData);
            setReprovingPerson(null);
          }}
        />
      )}

      {/* Bulk reprove modal */}
      {bulkReproving && selectedIds.size > 0 && (
        <ReproveModal
          person={localPeople.find((p) => selectedIds.has(p.id)) || null}
          personIds={Array.from(selectedIds)}
          onClose={() => setBulkReproving(false)}
          onReproved={async (reproveData) => {
            setBulkReproving(false);
            await handleBulkAction("reprove", reproveData);
          }}
        />
      )}

      {/* Bulk action bar */}
      <BulkActionBar
        count={selectedIds.size}
        actions={bulkActions}
        onClear={() => setSelectedIds(new Set())}
        loading={bulkLoading}
      />
    </div>
  );
}
