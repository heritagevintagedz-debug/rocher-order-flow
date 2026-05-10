import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, UtensilsCrossed } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { signIn, user, loading, role } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: role === "admin" ? "/admin" : "/serveur" });
  }, [user, loading, role, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
      toast.success("Connexion réussie");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg.includes("Invalid") ? "Identifiants invalides" : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
            <UtensilsCrossed className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Le Rocher Noir</h1>
          <p className="mt-1 text-sm text-muted-foreground">Connexion à l'espace équipe</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
          </div>
          <Button type="submit" disabled={submitting} className="h-12 w-full bg-brand-gradient text-base font-semibold shadow-glow">
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Se connecter"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Pas de compte ?{" "}
          <Link to="/signup" className="font-medium text-primary">Créer un compte</Link>
        </p>
      </div>
    </main>
  );
}
