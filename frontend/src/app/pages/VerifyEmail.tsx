import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ShieldCheck, Mail, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "../../state/AuthContext";
import { getApiErrorMessage } from "../../utils/errors";

export function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { verifyEmail, resendVerification } = useAuth();
  const [token, setToken] = useState(params.get("token") || params.get("code") || "");
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const tokenParam = params.get("token");
    if (tokenParam) {
      setLoading(true);
      verifyEmail(tokenParam, params.get("email") || undefined)
        .then(() => navigate("/"))
        .catch(() => setError("Invalid or expired verification token"))
        .finally(() => setLoading(false));
    }
  }, [params, verifyEmail, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await verifyEmail(token, email);
      navigate("/");
    } catch (err) {
      setError(getApiErrorMessage(err, "Verification failed. Check your token."));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!email.trim()) {
      setError("Enter your INTI account email first.");
      return;
    }
    setResending(true);
    try {
      const challenge = await resendVerification(email);
      const nextToken = challenge.verificationToken || challenge.verificationCode;
      if (nextToken) setToken(nextToken);
      setMessage(challenge.message);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not send verification email. Try again later."));
    } finally {
      setResending(false);
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
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">Verify your account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the verification code generated for your INTI account
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100 text-center">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-50 text-green-700 p-3 rounded-xl text-sm border border-green-100 text-center">
            {message}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="verification-email" className="block text-sm font-medium text-gray-700 mb-1">
              INTI account email
            </label>
            <Input
              id="verification-email"
              name="verification-email"
              type="text"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="i00008872@student.newinti.edu.my"
            />
          </div>
          <div>
            <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
              Verification Code
            </label>
            <Input
              id="token"
              name="token"
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="e.g. 123456"
              className="text-center tracking-widest text-lg font-mono"
            />
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
                  Verifying...
                </>
              ) : (
                "Verify Account"
              )}
            </Button>
          </div>
        </form>

        <div className="mt-6 border-t border-border pt-6 text-center">
          <form className="space-y-3" onSubmit={handleResend}>
            <Button
              type="submit"
              variant="outline"
              disabled={resending || !email.trim()}
              className="w-full rounded-xl h-12"
            >
              {resending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Check Email Verification"
              )}
            </Button>
          </form>
          <p className="mt-4 text-sm text-gray-600">
            Need a new account?{" "}
            <Link to="/register" className="font-medium text-primary hover:text-primary/80">
              Register again
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
