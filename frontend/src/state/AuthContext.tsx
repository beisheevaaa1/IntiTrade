import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<User>;
  register: (name: string, email: string, phone: string, password: string) => Promise<boolean>;
  verifyEmail: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updated: Partial<User>) => void;
  reloadUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Remove credentials left by older builds. Authentication now uses an
    // HttpOnly, Secure cookie that frontend JavaScript cannot read or export.
    localStorage.removeItem("marketplace_token");
    localStorage.removeItem("isLoggedIn");
    api.get("/auth/me")
      .then((response) => {
        setUser(response.data.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    async login(email, password, rememberMe = false) {
      const response = await api.post("/auth/login", { email, password, rememberMe });
      setUser(response.data.user);
      return response.data.user;
    },
    async register(name, email, phone, password) {
      const response = await api.post("/auth/register", { name, email, phone, password });
      if (!response.data.requiresVerification) {
        setUser(response.data.user);
      }
      return Boolean(response.data.requiresVerification);
    },
    async verifyEmail(verificationToken) {
      const response = await api.post("/auth/verify-email", { token: verificationToken });
      setUser(response.data.user);
    },
    async logout() {
      try {
        await api.post("/auth/logout");
      } catch {
        // Always clear the local session even if the server is unavailable.
      }
      setUser(null);
    },
    updateUser(updated) {
      setUser((prev) => (prev ? { ...prev, ...updated } : null));
    },
    async reloadUser() {
      const response = await api.get("/auth/me");
      setUser(response.data.user);
    }
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
