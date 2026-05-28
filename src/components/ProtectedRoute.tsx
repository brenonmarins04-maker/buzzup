import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, workspaceId } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!workspaceId && location.pathname !== "/welcome") {
    return <Navigate to="/welcome" replace />;
  }
  return <>{children}</>;
}
