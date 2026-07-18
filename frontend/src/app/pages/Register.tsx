import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ShieldCheck, ArrowLeft, Eye, EyeOff, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../state/AuthContext";

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountType, setAccountType] = useState<"STUDENT" | "STAFF">("STUDENT");
  const [faculty, setFaculty] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | undefined>();
  const [verificationCode, setVerificationCode] = useState<string | undefined>();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (accountType === "STUDENT" && !faculty) {
      setError("Please select your Faculty or Academic Program");
      return;
    }

    setLoading(true);
    try {
      const res = await register(name, email, phone, password, accountType, faculty);
      if (res.requiresVerification) {
        setVerificationToken(res.verificationToken);
        setVerificationCode(res.verificationCode);
        setIsSubmitted(true);
      } else {
        navigate("/");
      }
    } catch (err: any) {
      console.error("Request failed");
      setError(err.response?.data?.message || "Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-border text-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <Mail className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">Verify your account</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            We've generated an account verification requirement for <strong>{email}</strong>. Only verified INTI campus members can trade.
          </p>
          {verificationCode && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" /> Instant Verification Code
                </span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-mono font-bold">READY</span>
              </div>
              <div className="text-3xl font-mono font-black tracking-widest text-center text-amber-950 bg-white py-3 rounded-lg border border-amber-200 shadow-inner">
                {verificationCode}
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                Click below to go to the verification page and complete your signup instantly!
              </p>
            </div>
          )}
          <div className="pt-4 space-y-3">
            <Link to={`/verify-email?email=${encodeURIComponent(email)}&token=${verificationToken || ""}&code=${verificationCode || ""}`}>
              <Button className="w-full rounded-xl h-12 font-bold shadow-md">
                Enter Verification Page Now &rarr;
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => setIsSubmitted(false)} className="w-full text-xs text-muted-foreground hover:text-foreground">
              &larr; Back to Registration
            </Button>
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
          <Link to="/" className="inline-flex items-center gap-3 mb-6">
            <img src="/assets/logo.png" alt="INTI Logo" className="w-12 h-12 object-contain rounded-xl" />
            <span className="font-bold text-3xl text-foreground">IntiTrade</span>
          </Link>
          <h2 className="text-3xl font-extrabold text-gray-900">Create an account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Join the exclusive campus marketplace
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100 text-center font-medium">
            {error}
          </div>
        )}
        
        <form className="mt-8 space-y-5" onSubmit={handleRegister}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-gray-700">Account Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccountType("STUDENT")}
                  className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${accountType === "STUDENT" ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-border bg-gray-50 text-gray-700 hover:bg-gray-100"}`}
                >
                  🎓 INTI Student
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType("STAFF")}
                  className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-center gap-2 transition-all ${accountType === "STAFF" ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-border bg-gray-50 text-gray-700 hover:bg-gray-100"}`}
                >
                  👔 INTI Staff
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="faculty" className="block text-sm font-medium text-gray-700 mb-1">
                {accountType === "STUDENT" ? "Faculty / Academic Program *" : "Department / Faculty (Optional)"}
              </label>
              <select
                id="faculty"
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                required={accountType === "STUDENT"}
                className="w-full h-11 px-3 rounded-xl border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Select your Faculty or Division...</option>
                <option value="Faculty of Business & Communications">Faculty of Business & Communications (FBC)</option>
                <option value="Faculty of Computing & Information Technologies">Faculty of Computing & Information Technologies (FCI)</option>
                <option value="Faculty of Engineering & Quantitative Studies">Faculty of Engineering & Quantitative Studies (FEQS)</option>
                <option value="Faculty of Health & Life Sciences">Faculty of Health & Life Sciences (FHLS)</option>
                <option value="Faculty of Art & Design">Faculty of Art & Design (FAD)</option>
                <option value="American Degree Transfer Program">American Degree Transfer Program (AUP)</option>
                <option value="Center of Pre-University Studies">Center of Pre-University Studies (CPUS)</option>
                <option value="Campus Staff / Administration">Campus Staff / Administration</option>
              </select>
            </div>

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
                INTI Institutional Email (@student.newinti.edu.my / @newinti.edu.my)
              </label>
              <Input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={accountType === "STAFF" ? "name@newinti.edu.my" : "i00008872@student.newinti.edu.my"}
              />
              <p className="text-xs font-medium text-amber-700 mt-1.5 bg-amber-50 p-2 rounded-lg border border-amber-200">
                ⚠️ Must be an official institutional email (@student.newinti.edu.my or @newinti.edu.my). Personal emails like @gmail.com cannot be registered.
              </p>
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone number
              </label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+60 12-345 6789"
              />
              <p className="text-xs text-muted-foreground mt-1">It stays private unless you enable it for a listing.</p>
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
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  aria-describedby="password-requirement"
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
              <p
                id="password-requirement"
                className={`mt-1 text-xs ${password.length === 0 ? "text-muted-foreground" : password.length >= 8 ? "text-green-600" : "text-red-600"}`}
                aria-live="polite"
              >
                {password.length === 0
                  ? "Use at least 8 characters"
                  : password.length >= 8
                    ? "Password length is valid"
                    : `${8 - password.length} more character${8 - password.length === 1 ? "" : "s"} required`}
              </p>
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  name="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
                  aria-pressed={showConfirmPassword}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <p className={`mt-1 text-xs ${confirmPassword === password ? "text-green-600" : "text-red-600"}`} aria-live="polite">
                  {confirmPassword === password ? "Passwords match" : "Passwords do not match"}
                </p>
              )}
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
                "Create account"
              )}
            </Button>
          </div>
        </form>
        
        <div className="mt-6 border-t border-border pt-6">
          <div className="bg-blue-50 p-4 rounded-xl flex gap-3 items-start border border-blue-100">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Your phone is private by default</h4>
              <p className="text-xs text-gray-600 mt-1">You decide separately for every listing whether buyers can see it.</p>
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
