"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

export function LoginScreen() {
  const { login, error, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
        <div className="text-sm text-[var(--muted-foreground)]">Loading...</div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--background)]">
      <div className="text-center max-w-sm w-full px-4">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Market Intelligence Radar</h1>
        <p className="text-xs text-[var(--muted-foreground)] mb-8">AI-powered market intelligence</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm"
            required
          />
          <button
            type="submit"
            className="w-full px-6 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Sign In
          </button>
        </form>

        {error && <p className="mt-4 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
