"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, Users, Building2, Handshake, AlertTriangle, Newspaper, LogOut, Menu, X, Sun, Moon, Settings, HelpCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

const TABS = [
  { href: "/dashboard", label: "Overview", icon: BarChart3 },
  { href: "/dashboard/articles", label: "Articles", icon: Newspaper },
  { href: "/dashboard/people", label: "People", icon: Users },
  { href: "/dashboard/companies", label: "Companies", icon: Building2 },
  { href: "/dashboard/deals", label: "Deals", icon: Handshake },
  { href: "/dashboard/signals", label: "Signals", icon: AlertTriangle },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const nav = (
    <>
      <div className="px-4 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-tight">MIR</h2>
          <p className="text-[10px] text-[var(--muted-foreground)]">Market Intelligence Radar</p>
        </div>
        <button onClick={() => setOpen(false)} className="md:hidden text-[var(--muted-foreground)]">
          <X size={18} />
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = pathname === t.href || (t.href !== "/dashboard" && pathname.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => setOpen(false)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors ${
                active
                  ? "bg-[var(--accent)] text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon size={14} strokeWidth={active ? 2 : 1.5} />
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-2 pb-1 space-y-0.5">
        <Link
          href="/dashboard/help"
          onClick={() => setOpen(false)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors ${
            pathname === "/dashboard/help"
              ? "bg-[var(--accent)] text-[var(--foreground)]"
              : "text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
          }`}
        >
          <HelpCircle size={14} strokeWidth={pathname === "/dashboard/help" ? 2 : 1.5} />
          Help
        </Link>
        <button
          onClick={() => { router.push("/admin"); setOpen(false); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
        >
          <Settings size={14} strokeWidth={1.5} />
          Admin
        </button>
      </div>
      <div className="px-4 py-3 border-t border-[var(--border)]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--muted-foreground)] truncate">
            {user?.email?.split("@")[0] || "User"}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]" title={theme === "dark" ? "Light mode" : "Dark mode"}>
              {theme === "dark" ? <Sun size={12} /> : <Moon size={12} />}
            </button>
            <button onClick={logout} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]" title="Sign out">
              <LogOut size={12} />
            </button>
          </div>
        </div>
        <div className="text-[9px] text-[var(--muted-foreground)]/50 mt-1">
          v{process.env.NEXT_PUBLIC_VERSION || "dev"} · {(process.env.NEXT_PUBLIC_COMMIT || "local").slice(0, 7)}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-12 border-b border-[var(--border)] bg-[var(--background)] flex items-center px-4 gap-3">
        <button onClick={() => setOpen(true)} className="text-[var(--foreground)]">
          <Menu size={18} />
        </button>
        <span className="text-sm font-bold tracking-tight">MIR</span>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-56 bg-[var(--background)] flex flex-col z-50">
            {nav}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 border-r border-[var(--border)] bg-[var(--background)] flex-col shrink-0">
        {nav}
      </aside>
    </>
  );
}
