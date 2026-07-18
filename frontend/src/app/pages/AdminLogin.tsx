import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ShieldCheck, ArrowLeft, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { getApiErrorMessage } from "../../utils/errors";

export function AdminLogin() {
  const navigate = useNavigate();
  const { login, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser.role === "ADMIN") {
        navigate("/admin");
      } else {
        await logout();
        setError("Access denied: You do not have administrator privileges.");
      }
    } catch (err) {
      console.error("Request failed");
      setError(getApiErrorMessage(err, "Invalid credentials."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 relative text-white">
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <Button variant="ghost" onClick={() => navigate("/")} className="gap-2 text-slate-400 hover:text-white hover:bg-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to Store
        </Button>
      </div>
      
      <div className="max-w-md w-full space-y-8 bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="text-center relative z-10">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-primary text-white flex items-center justify-center rounded-xl font-bold text-xl">
              I
            </div>
            <span className="font-bold text-2xl text-white">IntiTrade</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <Lock className="w-6 h-6 text-primary" /> Admin Portal
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to access campus moderation dashboard
          </p>
        </div>

        {error && (
          <div className="bg-red-950/50 text-red-400 p-4 rounded-xl text-sm border border-red-900/50 text-center relative z-10 font-medium">
            {error}
          </div>
        )}
        
        <form className="mt-8 space-y-6 relative z-10" onSubmit={handleAdminLogin}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-slate-300 mb-1">
                Admin Email
              </label>
              <Input
                id="email-address"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-primary focus:ring-primary h-11"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
                Security Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-slate-950 border-slate-800 text-white placeholder-slate-600 focus:border-primary focus:ring-primary h-11 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary h-12 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Authorize & Access"
              )}
            </Button>
          </div>
        </form>
        
        <div className="mt-6 border-t border-slate-800 pt-6 relative z-10">
          <div className="bg-slate-950/80 p-4 rounded-xl flex gap-3 items-start border border-slate-800">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-slate-200">Restricted Access</h4>
              <p className="text-xs text-slate-400 mt-1">This portal is strictly for IntiTrade marketplace administrators. Unauthorized attempts are logged.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
