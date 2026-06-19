import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      if (mode === "login") {
        await login(email, password);
        navigate("/");
      } else {
        const verificationToken = await register(name, email, password);
        setMessage(verificationToken ? `Demo verification token: ${verificationToken}` : "Check your email for a verification link.");
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setError(apiError.response?.data?.message ?? "Request failed");
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <form className="panel p-6" onSubmit={submit}>
        <p className="text-sm font-semibold uppercase tracking-wide text-campus">{mode === "login" ? "Welcome back" : "Student access"}</p>
        <h1 className="mt-1 text-2xl font-semibold">{mode === "login" ? "Sign in" : "Create account"}</h1>
        {mode === "register" && (
          <label className="field mt-5">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </label>
        )}
        <label className="field mt-4">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="student@gmail.com" />
        </label>
        <label className="field mt-4">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </label>
        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-danger">{error}</p>}
        {message && <p className="mt-4 break-words rounded-md bg-green-50 p-3 text-sm text-campus">{message}</p>}
        <button className="button-primary mt-5 w-full" type="submit">{mode === "login" ? "Sign in" : "Register"}</button>
        <p className="mt-4 text-center text-sm text-ink/60">
          {mode === "login" ? "No account?" : "Already registered?"}{" "}
          <Link className="font-semibold text-campus" to={mode === "login" ? "/register" : "/login"}>
            {mode === "login" ? "Create one" : "Sign in"}
          </Link>
        </p>
      </form>
    </div>
  );
}
