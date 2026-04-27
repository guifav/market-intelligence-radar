"use client";
import { apiFetch } from "@/lib/api-client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { StatsCards } from "./_components/stats-cards";
import { PipelineMetrics } from "./_components/pipeline-metrics";
import { DivisionBreakdown } from "./_components/division-breakdown";
import { DivisionICPs } from "./_components/division-icps";
import { SourceManager } from "./_components/source-manager";
import { ScanHistory } from "./_components/scan-history";
import { SentimentChart } from "./_components/sentiment-chart";
import { TopSources } from "./_components/top-sources";
import { ExclusionRules } from "./_components/exclusion-rules";
import { ExclusionSuggestions } from "./_components/exclusion-suggestions";
import { Loader2, RefreshCw } from "lucide-react";
import { Component, type ReactNode, type ErrorInfo } from "react";
import type { GlobalIcpRules } from "@/lib/icp-types";

/* eslint-disable @typescript-eslint/no-explicit-any */

class ErrorBoundary extends Component<{ children: ReactNode; fallback?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("AdminError:", error, info); }
  render() {
    if (this.state.error) {
      return <div className="p-4 border border-red-500 rounded text-xs text-red-500">
        <p className="font-bold">Render error{this.props.fallback ? ` in ${this.props.fallback}` : ""}</p>
        <pre className="mt-1 whitespace-pre-wrap">{this.state.error.message}</pre>
      </div>;
    }
    return this.props.children;
  }
}

export default function AdminPageWrapper() {
  return (
    <AuthProvider>
      <AdminPage />
    </AuthProvider>
  );
}

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [sourcesSeeded, setSourcesSeeded] = useState(true);
  const [icps, setIcps] = useState<any>({});
  const [globalRules, setGlobalRules] = useState<GlobalIcpRules>({
    blocked_categories: [],
    conditional_categories: [],
    notes: "",
  });
  const [exclusionRules, setExclusionRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const res = await apiFetch("/api/exclusion?includeInactive=true");
      if (res.ok) {
        const data = await res.json();
        setExclusionRules(data.rules || []);
      }
    } catch (err) {
      console.error("Failed to load exclusion rules:", err);
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [statsRes, sourcesRes, icpsRes] = await Promise.all([
        apiFetch("/api/admin?action=stats"),
        apiFetch("/api/admin?action=sources"),
        apiFetch("/api/admin?action=icps"),
      ]);
      const statsData = await statsRes.json();
      const sourcesData = await sourcesRes.json();
      const icpsData = await icpsRes.json();
      setData(statsData);
      setSources(sourcesData.sources || []);
      setSourcesSeeded(sourcesData.seeded !== false);
      setIcps(icpsData.icps || {});
      setGlobalRules(icpsData.globalRules || { blocked_categories: [], conditional_categories: [], notes: "" });
      await loadRules();
    } catch (err) {
      console.error("Admin load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadRules]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
      return;
    }
    if (user) loadAll();
  }, [user, authLoading, router, loadAll]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAll();
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Authenticating...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-auto pt-12 md:pt-0">
        <header className="sticky top-12 md:top-0 z-10 border-b border-[var(--border)] bg-[var(--background)] px-4 md:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base md:text-lg font-semibold tracking-tight">Admin Panel</h1>
            <p className="text-[11px] text-[var(--muted-foreground)]">Pipeline monitoring and source management</p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8 px-3 rounded border border-[var(--border)] bg-[var(--muted)] text-xs flex items-center gap-1.5 hover:bg-[var(--accent)] disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        <div className="p-4 md:p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-[var(--muted-foreground)] text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading admin data...
            </div>
          ) : (
            <>
              <ErrorBoundary fallback="StatsCards">
                <StatsCards totals={data?.totals} />
              </ErrorBoundary>

              <ErrorBoundary fallback="PipelineMetrics">
                <PipelineMetrics
                  totals={data?.totals}
                  enrichment={data?.enrichment?.[0] || data?.enrichment}
                  sfMatching={data?.sfMatching?.[0] || data?.sfMatching}
                  dedup={data?.dedup?.[0] || data?.dedup}
                />
              </ErrorBoundary>

              <DivisionBreakdown
                articles={data?.articles || []}
                people={data?.people || []}
                companies={data?.companies || []}
                deals={data?.deals || []}
                signals={data?.signals || []}
              />

              <ErrorBoundary fallback="DivisionICPs">
                <DivisionICPs
                  icps={icps}
                  globalRules={globalRules}
                  sourceCounts={Object.fromEntries(
                    sources.reduce((acc: Map<string, number>, s: any) => {
                      if (s.active === false) return acc;
                      acc.set(s.division, (acc.get(s.division) || 0) + 1);
                      return acc;
                    }, new Map())
                  )}
                  exclusionRules={exclusionRules}
                  onRulesChanged={loadRules}
                />
              </ErrorBoundary>

              <div className="grid gap-6 md:grid-cols-2">
                <SentimentChart data={data?.sentimentBreakdown || []} />
                <TopSources data={data?.topSources || []} />
              </div>

              <ErrorBoundary fallback="ExclusionSuggestions">
                <ExclusionSuggestions onRuleCreated={loadRules} />
              </ErrorBoundary>

              <ErrorBoundary fallback="ExclusionRules">
                <ExclusionRules
                  rules={exclusionRules}
                  onRulesChanged={loadRules}
                />
              </ErrorBoundary>

              <SourceManager sources={sources} topSources={data?.topSources || []} seeded={sourcesSeeded} onRefresh={loadAll} userEmail={user?.email || ""} />

              <ScanHistory recentScans={data?.recentScans || []} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/** Minimal sidebar for admin — links back to dashboard */
function AdminSidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <aside className="hidden md:flex w-56 border-r border-[var(--border)] bg-[var(--background)] flex-col shrink-0">
      <div className="px-4 py-4 border-b border-[var(--border)]">
        <h2 className="text-sm font-bold tracking-tight">MIR</h2>
        <p className="text-[10px] text-[var(--muted-foreground)]">Administration</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        <button
          onClick={() => router.push("/dashboard")}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        >
          Back to Dashboard
        </button>
        <div className="px-3 py-2 rounded text-xs font-medium bg-[var(--accent)] text-[var(--foreground)]">
          Admin Panel
        </div>
      </nav>
      <div className="px-4 py-3 border-t border-[var(--border)]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--muted-foreground)] truncate">
            {user?.email?.split("@")[0] || ""}
          </span>
          <button onClick={logout} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]" title="Sign out">
            <span className="text-[10px]">Logout</span>
          </button>
        </div>
        <div className="text-[9px] text-[var(--muted-foreground)]/50 mt-1">
          v{process.env.NEXT_PUBLIC_VERSION || "dev"} · {(process.env.NEXT_PUBLIC_COMMIT || "local").slice(0, 7)}
        </div>
      </div>
    </aside>
  );
}
