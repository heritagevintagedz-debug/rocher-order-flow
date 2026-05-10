import { useAuth, type AppRole } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export function RoleGate({ allow, children }: { allow: AppRole; children: React.ReactNode }) {
  const { loading, user, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
    else if (role && role !== allow) navigate({ to: role === "admin" ? "/admin" : "/serveur" });
  }, [loading, user, role, allow, navigate]);

  if (loading || !user || role !== allow) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return <>{children}</>;
}
