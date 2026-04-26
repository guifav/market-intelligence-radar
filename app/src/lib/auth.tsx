"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthCtx {
  user: { email: string } | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  error: null,
});

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mir_token");
}

function getStoredUser(): { email: string } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("mir_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    const stored = getStoredUser();
    if (token && stored) {
      setUser(stored);
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      localStorage.setItem("mir_token", data.token);
      localStorage.setItem("mir_user", JSON.stringify({ email: data.email }));
      setUser({ email: data.email });
    } catch {
      setError("Login failed. Please try again.");
    }
  };

  const logout = () => {
    localStorage.removeItem("mir_token");
    localStorage.removeItem("mir_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
