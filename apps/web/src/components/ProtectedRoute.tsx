import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="panel p-6">Loading account...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
