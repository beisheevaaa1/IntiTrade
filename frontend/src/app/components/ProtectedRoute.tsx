import React from "react";
import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../state/AuthContext";
import type { Role } from "../../types";

type ProtectedRouteProps = {
  allowedRoles?: readonly Role[];
  unauthorizedTo?: string;
};

export function ProtectedRoute({ allowedRoles, unauthorizedTo = "/" }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={unauthorizedTo} replace />;
  }

  return <Outlet />;
}
