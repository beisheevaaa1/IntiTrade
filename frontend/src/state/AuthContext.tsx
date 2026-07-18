import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { AuthUserResponse, RegisterResponse } from "../api/responses";
import type { User } from "../types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<User>;
  register: (name: string, email: string, phone: string, password: string, accountType?: string, faculty?: string) => Promise<{ requiresVerification: boolean; verificationToken?: string; verificationCode?: string }>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updated: Partial<User>) => void;
  reloadUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    localStorage.removeItem("marketplace_token");
    localStorage.removeItem("isLoggedIn");
    api.get<AuthUserResponse>("/auth/me")
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
      const response = await api.post<AuthUserResponse>("/auth/login", { email, password, rememberMe });
      setUser(response.data.user);
      return response.data.user;
    },
    async register(name, email, phone, password, accountType = "STUDENT", faculty = "") {
      const response = await api.post<RegisterResponse>("/auth/register", { name, email, phone, password, accountType, faculty });
      if (!response.data.requiresVerification) {
        setUser(response.data.user);
      }
      return {
        requiresVerification: Boolean(response.data.requiresVerification),
        verificationToken: response.data.verificationToken,
        verificationCode: response.data.verificationCode
      };
    },
    async verifyEmail(verificationToken) {
      const response = await api.post<AuthUserResponse>("/auth/verify-email", { token: verificationToken });
      setUser(response.data.user);
    },
    async resendVerification(email) {
      await api.post("/auth/resend-verification", { email });
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
      const response = await api.get<AuthUserResponse>("/auth/me");
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
