import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<string | undefined>;
  verifyEmail: (token: string) => Promise<void>;
  logout: () => void;
  updateUser: (updated: Partial<User>) => void;
  reloadUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("marketplace_token"));
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    api.get("/auth/me")
      .then((response) => {
        setUser(response.data.user);
        localStorage.setItem("isLoggedIn", "true");
      })
      .catch(() => {
        localStorage.removeItem("marketplace_token");
        localStorage.removeItem("isLoggedIn");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    loading,
    async login(email, password) {
      const response = await api.post("/auth/login", { email, password });
      localStorage.setItem("marketplace_token", response.data.token);
      localStorage.setItem("isLoggedIn", "true");
      setToken(response.data.token);
      setUser(response.data.user);
    },
    async register(name, email, password) {
      const response = await api.post("/auth/register", { name, email, password });
      return response.data.verificationToken as string | undefined;
    },
    async verifyEmail(verificationToken) {
      const response = await api.post("/auth/verify-email", { token: verificationToken });
      localStorage.setItem("marketplace_token", response.data.token);
      localStorage.setItem("isLoggedIn", "true");
      setToken(response.data.token);
      setUser(response.data.user);
    },
    logout() {
      localStorage.removeItem("marketplace_token");
      localStorage.removeItem("isLoggedIn");
      setToken(null);
      setUser(null);
    },
    updateUser(updated) {
      setUser((prev) => (prev ? { ...prev, ...updated } : null));
    },
    async reloadUser() {
      const response = await api.get("/auth/me");
      setUser(response.data.user);
    }
  }), [loading, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
