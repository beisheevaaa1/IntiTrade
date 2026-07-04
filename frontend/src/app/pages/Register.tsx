import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ShieldCheck, ArrowLeft, Mail, Loader2 } from "lucide-react";
import { useAuth } from "../../state/AuthContext";

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [verificationToken, setVerificationToken] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const token = await register(name, email, password);
      if (token) {
        setVerificationToken(token);
      }
      setIsSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-border text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">Check your email</h2>
          <p className="mt-2 text-muted-foreground">
            We've sent a verification code to your email address to verify your account.
          </p>
          {verificationToken && (
            <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 rounded-xl font-mono text-sm border border-yellow-200 break-all select-all">
              Demo Code: <span className="font-bold">{verificationToken}</span>
            </div>
          )}
          <div className="pt-6">
            <Link to={`/verify-email?token=${verificationToken}`}>
              <Button className="w-full rounded-xl h-12">
                Enter Verification Page
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute top-4 left-4 sm:top-8 sm:left-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border border-border">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 bg-primary text-white flex items-center justify-center rounded-xl font-bold text-xl">
              I
            </div>
            <span className="font-bold text-2xl text-foreground">IntiTrade</span>
          </Link>
          <h2 className="text-3xl font-extrabold text-gray-900">Create an account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Join the exclusive campus marketplace
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100 text-center">
            {error}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleRegister}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
                INTI Institutional Email
              </label>
              <Input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@student.newinti.edu.my"
              />
              <p className="text-xs text-muted-foreground mt-1">Must be an active @inti.edu.my or @student.newinti.edu.my address</p>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <Input
                id="confirm-password"
                name="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
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
                  Creating account...
                </>
              ) : (
                "Register & Verify Email"
              )}
            </Button>
          </div>
        </form>
        
        <div className="mt-6 border-t border-border pt-6">
          <div className="bg-blue-50 p-4 rounded-xl flex gap-3 items-start border border-blue-100">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Why do we need this?</h4>
              <p className="text-xs text-gray-600 mt-1">To maintain a safe and trustworthy environment, we require all users to verify they are active members of INTI International University.</p>
            </div>
          </div>
          
          <p className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:text-primary/80">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
