import { useAuth } from "@/lib/auth";
import { LogOut, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const { signOut, fullName, role } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
          <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight">{title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {subtitle ?? `${fullName ?? "—"} · ${role === "admin" ? "Admin" : "Serveur"}`}
          </div>
        </div>
        {right}
        <Button variant="ghost" size="icon" onClick={() => signOut()} aria-label="Déconnexion">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
