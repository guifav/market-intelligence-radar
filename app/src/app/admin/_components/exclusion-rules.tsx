"use client";
import { apiFetch } from "@/lib/api-client";

import { useState } from "react";
import { Loader2, Trash2, ShieldOff, Shield, Plus } from "lucide-react";

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

const TYPE_LABELS: Record<string, string> = {
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

export function ExclusionRules({
  rules: allRules = [],
  onRulesChanged,
}: {
  rules?: ExclusionRule[];
  onRulesChanged?: () => void;
}) {
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [ruleType, setRuleType] = useState("custom");
  const [pattern, setPattern] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Filter to only global rules (or rules without a division)
  const rules = allRules.filter((r) => !r.division || r.division === "global");

  const handleDeactivate = async (id: string) => {
    setDeactivating(id);
    try {
      const res = await apiFetch(`/api/exclusion?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        onRulesChanged?.();
      }
    } catch (err) {
      console.error("Failed to deactivate rule:", err);
    } finally {
      setDeactivating(null);
    }
  };

  const handleCreate = async () => {
    if (!pattern.trim()) {
      setFormError("Pattern is required");
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const res = await apiFetch("/api/exclusion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_type: ruleType,
          pattern: pattern.trim(),
          division: "global",
          reason: reason.trim(),
          created_by: "admin",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.error || "Failed to create rule");
        return;
      }
      setPattern("");
      setReason("");
      setRuleType("custom");
      setShowAddForm(false);
      onRulesChanged?.();
    } catch {
      setFormError("Network error");
    } finally {
      setCreating(false);
    }
  };

  const activeCount = rules.filter((r) => r.active).length;
  const totalMatches = rules.reduce((sum, r) => sum + (r.matches_count || 0), 0);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldOff size={14} />
            Global Hard Exclusions
          </h3>
          <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
            {activeCount} active global rule{activeCount !== 1 ? "s" : ""} · {totalMatches} total matches
            <span className="ml-2 text-[var(--muted-foreground)]/70">
              — Prefer division ICP review rules for titles, sectors, and countries. Reserve hard exclusions for exceptional cases.
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="h-6 px-2 rounded border border-red-500/30 bg-red-500/10 text-[10px] text-red-400 flex items-center gap-1 hover:bg-red-500/20 transition-colors"
        >
          <Plus size={10} />
          Create Hard Exclusion
        </button>
      </div>

      {/* Inline Add Global Hard Exclusion Form */}
      {showAddForm && (
        <div className="mx-4 mt-3 p-2 rounded border border-red-500/20 bg-red-500/5 space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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
                placeholder={ruleType === "company_pattern" ? "e.g. Consulting Inc" : "e.g. Jane Doe"}
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
          </div>
          {formError && <p className="text-[9px] text-red-500">{formError}</p>}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="h-5 px-2 rounded bg-red-600 text-white text-[9px] font-medium flex items-center gap-1 hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {creating ? <Loader2 size={8} className="animate-spin" /> : <Plus size={8} />}
              Create Hard Exclusion
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="h-5 px-2 rounded border border-[var(--border)] text-[9px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="p-6 text-center text-sm text-[var(--muted-foreground)]">
          No global exclusion rules yet. Use the button above to create one, or use the Exclude button on people cards.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Pattern</th>
                <th className="px-4 py-2 text-left font-medium">Reason</th>
                <th className="px-4 py-2 text-left font-medium">Source</th>
                <th className="px-4 py-2 text-right font-medium">Matches</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
                <th className="px-4 py-2 text-center font-medium">Status</th>
                <th className="px-4 py-2 text-center font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className={`border-b border-[var(--border)] ${!rule.active ? "opacity-40" : ""}`}>
                  <td className="px-4 py-2">
                    <span className="px-1.5 py-0.5 rounded bg-[var(--muted)] text-[10px]">
                      {TYPE_LABELS[rule.rule_type] || rule.rule_type}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono">{rule.pattern}</td>
                  <td className="px-4 py-2 text-[var(--muted-foreground)] max-w-[200px] truncate">{rule.reason || "—"}</td>
                  <td className="px-4 py-2 text-[var(--muted-foreground)]">{rule.source_person_name || "—"}</td>
                  <td className="px-4 py-2 text-right">{rule.matches_count || 0}</td>
                  <td className="px-4 py-2 text-[var(--muted-foreground)]">
                    {rule.created_at ? new Date(rule.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {rule.active ? (
                      <span className="inline-flex items-center gap-1 text-green-500">
                        <Shield size={10} /> Active
                      </span>
                    ) : (
                      <span className="text-[var(--muted-foreground)]">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {rule.active && (
                      <button
                        onClick={() => handleDeactivate(rule.id)}
                        disabled={deactivating === rule.id}
                        className="p-1 rounded hover:bg-red-950/30 transition-colors disabled:opacity-50"
                        title="Deactivate rule"
                      >
                        {deactivating === rule.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} className="text-red-500" />
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
