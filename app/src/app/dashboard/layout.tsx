"use client";

import { AuthProvider, useAuth } from "@/lib/auth";
import { LoginScreen } from "@/components/login-screen";
import { Sidebar } from "@/components/layout/sidebar";
import { DivisionProvider, useDivision } from "@/lib/division";

const DIVISIONS = [
  { key: "", label: "All Divisions" },
  { key: "technology", label: "Technology" },
  { key: "finance", label: "Finance" },
  { key: "energy", label: "Energy" },
  { key: "healthcare", label: "Healthcare" },
];

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-[var(--muted-foreground)]">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}

function DivisionFilter() {
  const { division, setDivision } = useDivision();
  return (
    <select
      value={division}
      onChange={(e) => setDivision(e.target.value)}
      className="h-8 rounded border border-[var(--border)] bg-[var(--muted)] px-3 text-xs"
    >
      {DIVISIONS.map((d) => (
        <option key={d.key} value={d.key}>{d.label}</option>
      ))}
    </select>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto pt-12 md:pt-0">
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)] px-4 md:px-6 py-3 flex items-center justify-end">
          <DivisionFilter />
        </header>
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>
        <DivisionProvider>
          <DashboardShell>{children}</DashboardShell>
        </DivisionProvider>
      </AuthGate>
    </AuthProvider>
  );
}
