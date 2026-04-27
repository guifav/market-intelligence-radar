"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { ExternalLink, Plus, Trash2, ToggleLeft, ToggleRight, Loader2, Upload, RefreshCw, X } from "lucide-react";

import { DIVISION_LABELS, DIVISIONS as _DIVS } from "@/lib/divisions";
const DIV_LABELS: Record<string, string> = {
  ...DIVISION_LABELS,
  global: "Global",
};

const DIVISIONS = [..._DIVS, "global"];

interface Source {
  id: string;
  name: string;
  url: string;
  division: string;
  active: boolean;
  added_by?: string;
  added_at?: string;
  _static?: boolean;
}
interface TopSource { source_name: string; division: string; articles: number }

/* ── Add Source Modal ─────────────────────────────────────── */
function AddSourceModal({ onClose, onAdded, userEmail }: {
  onClose: () => void;
  onAdded: (source: Source) => void;
  userEmail: string;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [division, setDivision] = useState(DIVISIONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim() || !url.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_source", name: name.trim(), url: url.trim(), division, user: userEmail }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to add source");
        return;
      }
      onAdded(json.source);
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-sm mx-4 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Add Source</h3>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bloomberg"
              className="w-full text-xs px-3 py-2 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">URL *</label>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..."
              className="w-full text-xs px-3 py-2 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]" />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-[var(--muted-foreground)] mb-1">Division</label>
            <select value={division} onChange={(e) => setDivision(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]">
              {DIVISIONS.map((d) => <option key={d} value={d}>{DIV_LABELS[d]}</option>)}
            </select>
          </div>

          {error && <p className="text-[11px] text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-3 py-1.5 rounded border border-[var(--border)] text-xs hover:bg-[var(--accent)]">Cancel</button>
            <button onClick={handleSubmit} disabled={saving || !name.trim() || !url.trim()}
              className="px-3 py-1.5 rounded bg-[var(--foreground)] text-[var(--background)] text-xs font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
              {saving && <Loader2 size={11} className="animate-spin" />}
              Add Source
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Source Manager ───────────────────────────────────────── */
export function SourceManager({ sources: initialSources, topSources, seeded, onRefresh, userEmail }: {
  sources: Source[];
  topSources: TopSource[];
  seeded?: boolean;
  onRefresh?: () => void;
  userEmail?: string;
}) {
  const [sources, setSources] = useState(initialSources);
  const [divFilter, setDivFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [seeding, setSeeding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ added: number; skipped: number } | null>(null);

  // Keep local state in sync when parent reloads (e.g. after Sync)
  useEffect(() => { setSources(initialSources); }, [initialSources]);

  const divisions = useMemo(() => {
    const s = new Set(sources.map((s) => s.division));
    return Array.from(s).sort();
  }, [sources]);

  const articleMap = useMemo(() => {
    const m: Record<string, number> = {};
    topSources.forEach((t) => { m[`${t.source_name}|${t.division}`] = t.articles; });
    return m;
  }, [topSources]);

  const activeSources = useMemo(() => sources.filter((s) => s.active), [sources]);

  const filtered = useMemo(() => {
    const base = showInactive ? sources : activeSources;
    return base
      .filter((s) => (!divFilter || s.division === divFilter) && (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.url.toLowerCase().includes(search.toLowerCase())))
      .sort((a, b) => {
        // Inactive last
        if (a.active !== b.active) return a.active ? -1 : 1;
        const ac = articleMap[`${a.name}|${a.division}`] || 0;
        const bc = articleMap[`${b.name}|${b.division}`] || 0;
        return bc - ac;
      });
  }, [sources, activeSources, showInactive, divFilter, search, articleMap]);

  const divCounts = useMemo(() => {
    const c: Record<string, number> = {};
    activeSources.forEach((s) => { c[s.division] = (c[s.division] || 0) + 1; });
    return c;
  }, [activeSources]);

  const inactiveCount = useMemo(() => sources.filter((s) => !s.active).length, [sources]);

  const handleToggle = useCallback(async (source: Source) => {
    setTogglingIds((p) => new Set(p).add(source.id));
    try {
      const res = await apiFetch("/api/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_source", id: source.id, updates: { active: !source.active } }),
      });
      if (res.ok) {
        setSources((prev) => prev.map((s) => s.id === source.id ? { ...s, active: !s.active } : s));
      }
    } catch { /* ignore */ }
    finally {
      setTogglingIds((p) => { const n = new Set(p); n.delete(source.id); return n; });
    }
  }, []);

  const handleDelete = useCallback(async (source: Source) => {
    if (!confirm(`Delete "${source.name}" permanently?`)) return;
    setDeletingIds((p) => new Set(p).add(source.id));
    try {
      const res = await apiFetch("/api/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_source", id: source.id }),
      });
      if (res.ok) {
        setSources((prev) => prev.filter((s) => s.id !== source.id));
      }
    } catch { /* ignore */ }
    finally {
      setDeletingIds((p) => { const n = new Set(p); n.delete(source.id); return n; });
    }
  }, []);

  const handleSeed = useCallback(async () => {
    setSeeding(true);
    try {
      const res = await apiFetch("/api/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed_sources" }),
      });
      if (res.ok) {
        onRefresh?.();
      }
    } catch { /* ignore */ }
    finally {
      setSeeding(false);
    }
  }, [onRefresh]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await apiFetch("/api/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_sources" }),
      });
      if (res.ok) {
        const data = await res.json();
        setSyncResult({ added: data.added, skipped: data.skipped });
        if (data.added > 0) onRefresh?.();
      }
    } catch { /* ignore */ }
    finally {
      setSyncing(false);
    }
  }, [onRefresh]);

  const handleAdded = useCallback((source: Source) => {
    setSources((prev) => [...prev, source]);
  }, []);

  return (
    <div className="rounded-lg border border-[var(--border)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center gap-2">
        <h3 className="text-xs font-semibold flex-1">
          Source Registry ({activeSources.length} active{inactiveCount > 0 ? `, ${inactiveCount} inactive` : ""})
        </h3>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 rounded border border-[var(--border)] bg-[var(--muted)] px-2 text-[11px] w-40"
          />
          <select
            value={divFilter}
            onChange={(e) => setDivFilter(e.target.value)}
            className="h-7 rounded border border-[var(--border)] bg-[var(--muted)] px-2 text-[11px]"
          >
            <option value="">All ({activeSources.length})</option>
            {divisions.map((d) => (
              <option key={d} value={d}>{DIV_LABELS[d] || d} ({divCounts[d] || 0})</option>
            ))}
          </select>
          {inactiveCount > 0 && (
            <button
              onClick={() => setShowInactive(!showInactive)}
              className={`h-7 px-2 rounded border text-[11px] ${showInactive ? "border-yellow-600 text-yellow-500" : "border-[var(--border)] text-[var(--muted-foreground)]"}`}
            >
              {showInactive ? "Hide" : "Show"} inactive
            </button>
          )}
          {!seeded && (
            <button onClick={handleSeed} disabled={seeding}
              className="h-7 px-2 rounded border border-blue-600 text-blue-400 text-[11px] hover:bg-blue-950/30 flex items-center gap-1 disabled:opacity-50">
              {seeding ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
              Seed Sources
            </button>
          )}
          {seeded && (
            <button onClick={handleSync} disabled={syncing}
              className="h-7 px-2 rounded border border-[var(--border)] text-[var(--muted-foreground)] text-[11px] hover:bg-[var(--muted)] flex items-center gap-1 disabled:opacity-50"
              title="Add sources from sources.json that are missing in the database">
              {syncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              {syncResult ? `Synced (+${syncResult.added})` : "Sync"}
            </button>
          )}
          <button onClick={() => setShowAddModal(true)}
            className="h-7 px-2 rounded bg-[var(--foreground)] text-[var(--background)] text-[11px] font-medium hover:opacity-90 flex items-center gap-1">
            <Plus size={11} /> Add
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-[11px] min-w-[600px]">
          <thead className="sticky top-0 bg-[var(--muted)]">
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-4 py-2 font-medium">Source</th>
              <th className="text-left px-3 py-2 font-medium">Division</th>
              <th className="text-right px-3 py-2 font-medium">Articles</th>
              <th className="text-center px-3 py-2 font-medium w-8">Link</th>
              <th className="text-center px-3 py-2 font-medium w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const articles = articleMap[`${s.name}|${s.division}`] || 0;
              const toggling = togglingIds.has(s.id);
              const deleting = deletingIds.has(s.id);
              return (
                <tr key={s.id} className={`border-b border-[var(--border)] hover:bg-[var(--accent)] ${!s.active ? "opacity-40" : ""}`}>
                  <td className="px-4 py-1.5 font-medium">
                    {s.name}
                    {s.added_by && s.added_by !== "seed" && (
                      <span className="ml-1.5 text-[9px] text-[var(--muted-foreground)]">by {s.added_by}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-[var(--muted-foreground)]">{DIV_LABELS[s.division] || s.division}</td>
                  <td className="text-right px-3 py-1.5">
                    {articles > 0 ? (
                      <span className="inline-block bg-[var(--accent)] px-1.5 py-0.5 rounded text-[10px]">{articles}</span>
                    ) : (
                      <span className="text-[var(--muted-foreground)]">0</span>
                    )}
                  </td>
                  <td className="text-center px-3 py-1.5">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                      <ExternalLink size={11} className="inline" />
                    </a>
                  </td>
                  <td className="text-center px-3 py-1.5">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleToggle(s)} disabled={toggling}
                        className="p-1 rounded hover:bg-[var(--accent)]" title={s.active ? "Deactivate" : "Activate"}>
                        {toggling ? <Loader2 size={12} className="animate-spin" /> : s.active ? <ToggleRight size={12} className="text-green-500" /> : <ToggleLeft size={12} className="text-[var(--muted-foreground)]" />}
                      </button>
                      <button onClick={() => handleDelete(s)} disabled={deleting}
                        className="p-1 rounded hover:bg-red-950/30" title="Delete permanently">
                        {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} className="text-[var(--muted-foreground)] hover:text-red-500" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <p className="text-center py-6 text-[11px] text-[var(--muted-foreground)]">No sources match your filter</p>
      )}

      {showAddModal && (
        <AddSourceModal
          onClose={() => setShowAddModal(false)}
          onAdded={handleAdded}
          userEmail={userEmail || "unknown"}
        />
      )}
    </div>
  );
}
