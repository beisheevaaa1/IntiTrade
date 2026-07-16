import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ShieldCheck, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "../../state/AuthContext";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(account, password, rememberMe);
      navigate("/");
    } catch (err: any) {
      console.error("Request failed");
      setError(err.response?.data?.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
      
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-border">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <img src="/assets/logo.png" alt="INTI Logo" className="w-12 h-12 object-contain rounded-xl" />
            <span className="font-bold text-3xl text-foreground">IntiTrade</span>
          </Link>
          <h2 className="text-3xl font-extrabold text-gray-900">Welcome back</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Log in to your campus marketplace account
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100 text-center">
            {error}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <label htmlFor="account" className="block text-sm font-medium text-gray-700 mb-1">
                INTI account
              </label>
              <Input
                id="account"
                name="account"
                type="text"
                inputMode="email"
                autoComplete="username"
                required
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="i00008872@student.newinti.edu.my"
              />
              <p className="mt-1 text-xs text-muted-foreground">You can also enter only your student ID, for example i00008872.</p>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 cursor-pointer">
                Remember me
              </label>
            </div>

            <Link
              to={`/verify-email${account.trim() ? `?email=${encodeURIComponent(account.trim())}` : ""}`}
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              Check Email Verification
            </Link>
          </div>

          <div>
            <Button 
              type="submit" 
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary h-12"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Log In"
              )}
            </Button>
          </div>
        </form>
        
        <div className="mt-6 border-t border-border pt-6">
          <div className="bg-red-50 p-4 rounded-xl flex gap-3 items-start border border-red-100">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Safer campus trading</h4>
              <p className="text-xs text-gray-600 mt-1">Contact details stay private unless you choose to show them, and every listing is reviewed before publication.</p>
            </div>
          </div>
          
          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{" "}
            <Link to="/register" className="font-medium text-primary hover:text-primary/80">
              Sign up now
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
