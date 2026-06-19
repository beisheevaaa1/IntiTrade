import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { verifyEmail } = useAuth();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (params.get("token")) {
      verifyEmail(params.get("token")!).then(() => navigate("/")).catch(() => setError("Verification failed"));
    }
  }, [navigate, params, verifyEmail]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await verifyEmail(token);
      navigate("/");
    } catch {
      setError("Verification failed");
    }
  }

  return (
    <form className="panel mx-auto max-w-md p-6" onSubmit={submit}>
      <h1 className="text-2xl font-semibold">Verify email</h1>
      <label className="field mt-4">
        <span>Verification token</span>
        <input value={token} onChange={(e) => setToken(e.target.value)} required />
      </label>
      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-danger">{error}</p>}
      <button className="button-primary mt-5 w-full" type="submit">Verify</button>
    </form>
  );
}
