"use client";
import { apiFetch } from "@/lib/api-client";
import type { DivisionIcp, GlobalIcpRules } from "@/lib/icp-types";

import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDown, ChevronRight, X, Plus, Save, RotateCcw, Check, Loader2, ShieldOff, Shield, Trash2 } from "lucide-react";

import { DIVISIONS } from "@/lib/divisions";
const DIV_ORDER = [
  ...DIVISIONS, "global",
];

interface ExclusionRule {
  id: string;
  rule_type: string;
  pattern: string;
  division: string;
  reason: string;
  created_by: string;
  created_at: string;
  source_person_name: string | null;
  matches_count: number;
  active: boolean;
}

const RULE_TYPE_LABELS: Record<string, string> = {
  company_pattern: "Company (Advanced)",
  title_pattern: "Job Title",
  sector: "Sector",
  country: "Country",
  custom: "Exact Person",
  contact_not_relevant: "Person Pattern (Legacy)",
};

const RULE_TYPE_OPTIONS = [
  { value: "custom", label: "Exact Person" },
  { value: "title_pattern", label: "Job Title" },
  { value: "sector", label: "Sector" },
  { value: "country", label: "Country" },
  { value: "company_pattern", label: "Company (advanced, wide impact)" },
];

interface Taxonomy {
  categories?: string[];
  sectors?: Record<string, string[]>;
  geo_regions?: Record<string, string[]>;
}

type EditableField = "target_roles" | "target_categories" | "conditional_categories" | "excluded_categories" | "target_sectors" | "target_countries" | "languages"
  | "excluded_titles" | "excluded_companies" | "excluded_sectors" | "excluded_countries";

const FIELD_CONFIG: { key: EditableField; label: string; taxonomyKey?: string }[] = [
  { key: "target_roles", label: "Target Roles" },
  { key: "target_categories", label: "Target Categories", taxonomyKey: "categories" },
  { key: "target_sectors", label: "Target Sectors", taxonomyKey: "sectors" },
  { key: "target_countries", label: "Target Countries", taxonomyKey: "geo_regions" },
  { key: "languages", label: "Languages" },
];

const EXCLUDED_FIELD_CONFIG: { key: EditableField; label: string; taxonomyKey?: string }[] = [
  { key: "conditional_categories", label: "Conditional Categories", taxonomyKey: "categories" },
  { key: "excluded_categories", label: "Excluded Categories", taxonomyKey: "categories" },
  { key: "excluded_titles", label: "Excluded Titles" },
  { key: "excluded_companies", label: "Excluded Companies (Advanced)" },
  { key: "excluded_sectors", label: "Excluded Sectors", taxonomyKey: "sectors" },
  { key: "excluded_countries", label: "Excluded Countries", taxonomyKey: "geo_regions" },
];

function getSuggestions(taxonomyKey: string | undefined, taxonomy: Taxonomy): string[] {
  if (!taxonomyKey || !taxonomy) return [];
  if (taxonomyKey === "categories") return taxonomy.categories || [];
  if (taxonomyKey === "sectors") {
    return Object.values(taxonomy.sectors || {}).flat();
  }
  if (taxonomyKey === "geo_regions") {
    return Object.values(taxonomy.geo_regions || {}).flat();
  }
  return [];
}

function TagInput({
  values,
  suggestions,
  onChange,
}: {
  values: string[];
  suggestions: string[];
  onChange: (newValues: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = suggestions.length > 0
    ? suggestions.filter(
        (s) => !values.includes(s) && s.toLowerCase().includes(input.toLowerCase())
      ).slice(0, 12)
    : [];

  const addValue = (val: string) => {
    const trimmed = val.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeValue = (val: string) => {
    onChange(values.filter((v) => v !== val));
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={containerRef}>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-0.5 bg-[var(--background)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[10px] group"
          >
            {v}
            <button
              onClick={() => removeValue(v)}
              className="text-[var(--muted-foreground)] hover:text-red-500 transition-colors ml-0.5"
              title="Remove"
            >
              <X size={8} />
            </button>
          </span>
        ))}
      </div>
      <div className="relative">
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                e.preventDefault();
                if (filtered.length > 0) {
                  addValue(filtered[0]);
                } else {
                  addValue(input);
                }
              }
              if (e.key === "Escape") {
                setShowSuggestions(false);
              }
            }}
            placeholder="Add..."
            className="flex-1 min-w-0 bg-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[10px] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--foreground)] transition-colors"
          />
          <button
            onClick={() => {
              if (input.trim()) {
                if (filtered.length > 0) addValue(filtered[0]);
                else addValue(input);
              }
            }}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors shrink-0"
            title="Add"
          >
            <Plus size={10} />
          </button>
        </div>
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-[var(--background)] border border-[var(--border)] rounded shadow-lg max-h-40 overflow-auto">
            {filtered.map((s) => (
              <button
                key={s}
                onClick={() => addValue(s)}
                className="w-full text-left px-2 py-1 text-[10px] hover:bg-[var(--accent)] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function DivisionICPs({
  icps: initialIcps,
  globalRules: initialGlobalRules,
  sourceCounts,
  exclusionRules = [],
  onRulesChanged,
}: {
  icps: Record<string, DivisionIcp>;
  globalRules: GlobalIcpRules;
  sourceCounts: Record<string, number>;
  exclusionRules?: ExclusionRule[];
  onRulesChanged?: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [icps, setIcps] = useState<Record<string, DivisionIcp>>(initialIcps);
  const [globalRules, setGlobalRules] = useState<GlobalIcpRules>(initialGlobalRules);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [globalDirty, setGlobalDirty] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [savedGlobal, setSavedGlobal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [taxonomy, setTaxonomy] = useState<Taxonomy>({});
  const [error, setError] = useState<string | null>(null);
  const [addingRuleFor, setAddingRuleFor] = useState<string | null>(null);
  const [deactivatingRule, setDeactivatingRule] = useState<string | null>(null);

  // Sync if parent re-fetches
  useEffect(() => {
    setIcps(initialIcps);
    setGlobalRules(initialGlobalRules);
    setDirty(new Set());
    setGlobalDirty(false);
  }, [initialIcps, initialGlobalRules]);

  // Load taxonomy once
  useEffect(() => {
    apiFetch("/api/admin?action=taxonomy")
      .then((r) => r.json())
      .then((d) => setTaxonomy(d.taxonomy || {}))
      .catch(() => {});
  }, []);

  const updateField = useCallback((div: string, field: EditableField, values: string[]) => {
    setIcps((prev) => ({
      ...prev,
      [div]: { ...prev[div], [field]: values },
    }));
    setDirty((prev) => new Set(prev).add(div));
    setError(null);
  }, []);

  const updateNotes = useCallback((div: string, notes: string) => {
    setIcps((prev) => ({
      ...prev,
      [div]: { ...prev[div], notes },
    }));
    setDirty((prev) => new Set(prev).add(div));
    setError(null);
  }, []);

  const updateGlobalField = useCallback((field: keyof GlobalIcpRules, values: string[] | string) => {
    setGlobalRules((prev) => ({
      ...prev,
      [field]: values,
    }));
    setGlobalDirty(true);
    setError(null);
  }, []);

  const saveDivision = async (div: string) => {
    setSaving(div);
    setError(null);
    try {
      const res = await apiFetch("/api/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_icp", division: div, data: icps[div] }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.details?.join("; ") || json.error || "Save failed");
        return;
      }
      setDirty((prev) => {
        const next = new Set(prev);
        next.delete(div);
        return next;
      });
      setSaved(div);
      setTimeout(() => setSaved((prev) => (prev === div ? null : prev)), 2000);
    } catch {
      setError("Network error saving ICP");
    } finally {
      setSaving(null);
    }
  };

  const saveGlobalRules = async () => {
    setSavingGlobal(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_icp_global_rules", data: globalRules }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.details?.join("; ") || json.error || "Save failed");
        return;
      }
      setGlobalDirty(false);
      setSavedGlobal(true);
      setTimeout(() => setSavedGlobal(false), 2000);
    } catch {
      setError("Network error saving global rules");
    } finally {
      setSavingGlobal(false);
    }
  };

  const resetAll = async () => {
    if (!confirm("Reset all ICPs to defaults from the JSON file? This will overwrite any custom changes.")) return;
    setResetting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_icps" }),
      });
      if (!res.ok) {
        setError("Reset failed");
        return;
      }
      // Reload ICPs
      const icpsRes = await apiFetch("/api/admin?action=icps");
      const icpsData = await icpsRes.json();
      setIcps(icpsData.icps || {});
      setGlobalRules(icpsData.globalRules || { blocked_categories: [], conditional_categories: [], notes: "" });
      setDirty(new Set());
      setGlobalDirty(false);
    } catch {
      setError("Network error resetting ICPs");
    } finally {
      setResetting(false);
    }
  };

  const handleDeactivateRule = async (id: string) => {
    setDeactivatingRule(id);
    try {
      const res = await apiFetch(`/api/exclusion?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        onRulesChanged?.();
      }
    } catch (err) {
      console.error("Failed to deactivate rule:", err);
    } finally {
      setDeactivatingRule(null);
    }
  };

  const getRulesForDivision = (divKey: string): ExclusionRule[] => {
    return exclusionRules.filter(
      (r) => r.division === divKey
    );
  };

  if (!icps || Object.keys(icps).length === 0) {
    return null;
  }

  const toggle = (div: string) => setExpanded(expanded === div ? null : div);
  const ordered = DIV_ORDER.filter((d) => icps[d]);

  return (
    <div className="rounded-lg border border-[var(--border)]">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold">Division ICPs</h3>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
            Ideal Contact Profile per division — click to expand and edit
          </p>
        </div>
        <button
          onClick={resetAll}
          disabled={resetting}
          className="h-6 px-2 rounded border border-[var(--border)] bg-[var(--muted)] text-[10px] flex items-center gap-1 hover:bg-[var(--accent)] disabled:opacity-50 transition-colors"
          title="Reset all ICPs to defaults from JSON file"
        >
          <RotateCcw size={10} className={resetting ? "animate-spin" : ""} />
          Reset to defaults
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-2 px-2 py-1.5 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-500">
          {error}
        </div>
      )}

      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/20">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
              Global Blocked Categories ({globalRules.blocked_categories.length})
            </h4>
            <TagInput
              values={globalRules.blocked_categories}
              suggestions={getSuggestions("categories", taxonomy)}
              onChange={(vals) => updateGlobalField("blocked_categories", vals)}
            />
          </div>
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
              Global Conditional Categories ({globalRules.conditional_categories.length})
            </h4>
            <TagInput
              values={globalRules.conditional_categories}
              suggestions={getSuggestions("categories", taxonomy)}
              onChange={(vals) => updateGlobalField("conditional_categories", vals)}
            />
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-[var(--border)]">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
            Global Notes
          </h4>
          <textarea
            value={globalRules.notes || ""}
            onChange={(e) => updateGlobalField("notes", e.target.value)}
            className="w-full bg-[var(--muted)] border border-[var(--border)] rounded px-2 py-1 text-[10px] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--foreground)] transition-colors resize-none"
            rows={2}
            placeholder="Global ICP gate notes..."
          />
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          {savedGlobal && (
            <span className="flex items-center gap-1 text-[10px] text-green-500">
              <Check size={10} /> Saved
            </span>
          )}
          <button
            onClick={saveGlobalRules}
            disabled={!globalDirty || savingGlobal}
            className="h-6 px-2.5 rounded border border-[var(--border)] bg-[var(--foreground)] text-[var(--background)] text-[10px] font-medium flex items-center gap-1 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {savingGlobal ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
            Save Global Rules
          </button>
        </div>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {ordered.map((div) => {
          const icp = icps[div];
          const isOpen = expanded === div;
          const sources = sourceCounts[div] || 0;
          const isDirty = dirty.has(div);
          const isSaving = saving === div;
          const isSaved = saved === div;

          return (
            <div key={div}>
              {/* Header row */}
              <button
                onClick={() => toggle(div)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--accent)] transition-colors"
              >
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-xs font-medium">{icp.label}</span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">{icp.segment}</span>
                  {isDirty && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-[var(--muted-foreground)] shrink-0">
                  <span>{sources} sources</span>
                  <span>{icp.target_countries.length > 0 ? icp.target_countries.length + " countries" : "All countries"}</span>
                  <span>{icp.target_sectors.length} sectors</span>
                  <span>{icp.target_categories.length} categories</span>
                </div>
              </button>

              {/* Expanded detail — editable */}
              {isOpen && (
                <div className="px-4 pb-4 pt-1 bg-[var(--muted)]/30">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {FIELD_CONFIG.filter((f) => f.key !== "languages").map((field) => {
                      const suggestions = getSuggestions(field.taxonomyKey, taxonomy);
                      return (
                        <div key={field.key}>
                          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
                            {field.label} ({(icp[field.key] as string[]).length})
                          </h4>
                          <TagInput
                            values={icp[field.key] as string[]}
                            suggestions={suggestions}
                            onChange={(vals) => updateField(div, field.key, vals)}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {EXCLUDED_FIELD_CONFIG.map((field) => {
                      const suggestions = getSuggestions(field.taxonomyKey, taxonomy);
                      return (
                        <div key={field.key}>
                          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1.5">
                            {field.label} ({(icp[field.key] as string[]).length})
                          </h4>
                          <TagInput
                            values={icp[field.key] as string[]}
                            suggestions={suggestions}
                            onChange={(vals) => updateField(div, field.key, vals)}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Notes — editable */}
                  <div className="mt-3 pt-2 border-t border-[var(--border)]">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1">
                      Notes
                    </h4>
                    <textarea
                      value={icp.notes || ""}
                      onChange={(e) => updateNotes(div, e.target.value)}
                      className="w-full bg-[var(--muted)] border border-[var(--border)] rounded px-2 py-1 text-[10px] placeholder:text-[var(--muted-foreground)] outline-none focus:border-[var(--foreground)] transition-colors resize-none"
                      rows={2}
                      placeholder="Division notes..."
                    />
                  </div>

                  {/* Languages + Save */}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-[var(--muted-foreground)]">Languages:</span>
                      {icp.languages.map((l) => (
                        <span key={l} className="inline-block bg-[var(--accent)] rounded px-1.5 py-0.5 text-[10px] font-medium uppercase">
                          {l}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      {isSaved && (
                        <span className="flex items-center gap-1 text-[10px] text-green-500">
                          <Check size={10} /> Saved
                        </span>
                      )}
                      <button
                        onClick={() => saveDivision(div)}
                        disabled={!isDirty || isSaving}
                        className="h-6 px-2.5 rounded border border-[var(--border)] bg-[var(--foreground)] text-[var(--background)] text-[10px] font-medium flex items-center gap-1 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        {isSaving ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Save size={10} />
                        )}
                        Save
                      </button>
                    </div>
                  </div>

                  {/* ⛔ Exclusion Rules Section */}
                  <ExclusionRulesSection
                    divKey={div}
                    rules={getRulesForDivision(div)}
                    isAddingRule={addingRuleFor === div}
                    onToggleAdd={() => setAddingRuleFor(addingRuleFor === div ? null : div)}
                    onDeactivate={handleDeactivateRule}
                    deactivatingId={deactivatingRule}
                    onRuleCreated={() => {
                      setAddingRuleFor(null);
                      onRulesChanged?.();
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Inline Exclusion Rules Section (inside ICP card) ── */

function ExclusionRulesSection({
  divKey,
  rules,
  isAddingRule,
  onToggleAdd,
  onDeactivate,
  deactivatingId,
  onRuleCreated,
}: {
  divKey: string;
  rules: ExclusionRule[];
  isAddingRule: boolean;
  onToggleAdd: () => void;
  onDeactivate: (id: string) => void;
  deactivatingId: string | null;
  onRuleCreated: () => void;
}) {
  const activeRules = rules.filter((r) => r.active);
  const inactiveRules = rules.filter((r) => !r.active);

  return (
    <div className="mt-3 pt-3 border-t border-red-500/20">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
          <ShieldOff size={10} />
          Exclusion Rules ({activeRules.length} active)
        </h4>
        <button
          onClick={onToggleAdd}
          className="h-5 px-2 rounded border border-red-500/30 bg-red-500/10 text-[9px] text-red-400 flex items-center gap-1 hover:bg-red-500/20 transition-colors"
        >
          <Plus size={8} />
          Add Rule
        </button>
      </div>

      {/* Inline Add Rule Form */}
      {isAddingRule && (
        <AddRuleForm divKey={divKey} onCreated={onRuleCreated} onCancel={onToggleAdd} />
      )}

      {/* Rules mini-table */}
      {rules.length > 0 ? (
        <div className="overflow-x-auto rounded border border-red-500/10">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-red-500/10 text-[var(--muted-foreground)] bg-red-500/5">
                <th className="px-2 py-1.5 text-left font-medium">Type</th>
                <th className="px-2 py-1.5 text-left font-medium">Pattern</th>
                <th className="px-2 py-1.5 text-left font-medium">Reason</th>
                <th className="px-2 py-1.5 text-left font-medium">Source</th>
                <th className="px-2 py-1.5 text-right font-medium">Matches</th>
                <th className="px-2 py-1.5 text-center font-medium">Status</th>
                <th className="px-2 py-1.5 text-center font-medium w-8"></th>
              </tr>
            </thead>
            <tbody>
              {[...activeRules, ...inactiveRules].map((rule) => {
                const isGlobal = rule.division === "global";
                return (
                  <tr
                    key={rule.id}
                    className={`border-b border-red-500/5 ${!rule.active ? "opacity-40" : ""}`}
                  >
                    <td className="px-2 py-1.5">
                      <span className="px-1 py-0.5 rounded bg-[var(--muted)] text-[9px]">
                        {RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 font-mono flex items-center gap-1">
                      {rule.pattern}
                      {isGlobal && (
                        <span className="px-1 py-0 rounded bg-amber-500/20 text-amber-500 text-[8px] font-semibold leading-tight">
                          Global
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-[var(--muted-foreground)] max-w-[140px] truncate">
                      {rule.reason || "—"}
                    </td>
                    <td className="px-2 py-1.5 text-[var(--muted-foreground)]">
                      {rule.source_person_name || rule.created_by || "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right">{rule.matches_count || 0}</td>
                    <td className="px-2 py-1.5 text-center">
                      {rule.active ? (
                        <span className="inline-flex items-center gap-0.5 text-green-500">
                          <Shield size={8} /> Active
                        </span>
                      ) : (
                        <span className="text-[var(--muted-foreground)]">Off</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {rule.active && !isGlobal && (
                        <button
                          onClick={() => onDeactivate(rule.id)}
                          disabled={deactivatingId === rule.id}
                          className="p-0.5 rounded hover:bg-red-950/30 transition-colors disabled:opacity-50"
                          title="Deactivate rule"
                        >
                          {deactivatingId === rule.id ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <Trash2 size={10} className="text-red-500" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[10px] text-[var(--muted-foreground)] italic">No exclusion rules for this division.</p>
      )}
    </div>
  );
}

/* ── Inline Add Rule Form ── */

function AddRuleForm({
  divKey,
  onCreated,
  onCancel,
}: {
  divKey: string;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [ruleType, setRuleType] = useState("custom");
  const [pattern, setPattern] = useState("");
  const [reason, setReason] = useState("");
  const [division, setDivision] = useState(divKey);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!pattern.trim()) {
      setError("Pattern is required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch("/api/exclusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_type: ruleType,
          pattern: pattern.trim(),
          division: division || "global",
          reason: reason.trim(),
          created_by: "admin",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create rule");
        return;
      }
      onCreated();
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mb-2 p-2 rounded border border-red-500/20 bg-red-500/5 space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label className="text-[9px] text-[var(--muted-foreground)] uppercase font-semibold">Type</label>
          <select
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value)}
            className="w-full mt-0.5 bg-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] outline-none focus:border-[var(--foreground)]"
          >
            {RULE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[9px] text-[var(--muted-foreground)] uppercase font-semibold">Pattern</label>
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="e.g. Consulting Inc"
            className="w-full mt-0.5 bg-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] outline-none focus:border-[var(--foreground)]"
          />
        </div>
        <div>
          <label className="text-[9px] text-[var(--muted-foreground)] uppercase font-semibold">Reason (optional)</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why exclude?"
            className="w-full mt-0.5 bg-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] outline-none focus:border-[var(--foreground)]"
          />
        </div>
        <div>
          <label className="text-[9px] text-[var(--muted-foreground)] uppercase font-semibold">Division</label>
          <select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="w-full mt-0.5 bg-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-1 text-[10px] outline-none focus:border-[var(--foreground)]"
          >
            <option value={divKey}>{divKey}</option>
            <option value="global">global</option>
          </select>
        </div>
      </div>
      {error && (
        <p className="text-[9px] text-red-500">{error}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCreate}
          disabled={creating}
          className="h-5 px-2 rounded bg-red-600 text-white text-[9px] font-medium flex items-center gap-1 hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {creating ? <Loader2 size={8} className="animate-spin" /> : <Plus size={8} />}
          Create Rule
        </button>
        <button
          onClick={onCancel}
          className="h-5 px-2 rounded border border-[var(--border)] text-[9px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
