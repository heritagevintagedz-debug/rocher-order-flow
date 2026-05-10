import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, UtensilsCrossed } from "lucide-react";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const { signUp, user, loading, role, bootstrapFirstAdmin } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [wantAdmin, setWantAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: role === "admin" ? "/admin" : "/serveur" });
  }, [user, loading, role, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { toast.error("Mot de passe : 6 caractères minimum"); return; }
    setSubmitting(true);
    try {
      await signUp(email, password, fullName.trim());
      if (wantAdmin) {
        const ok = await bootstrapFirstAdmin();
        if (ok) toast.success("Compte admin créé");
        else toast.info("Un admin existe déjà — votre compte a été créé en serveur. Demandez à un admin de vous promouvoir.");
      } else {
        toast.success("Compte serveur créé");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
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
          <h1 className="text-2xl font-bold tracking-tight">Créer un compte</h1>
          <p className="mt-1 text-sm text-muted-foreground">Le Rocher Noir — équipe interne</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom complet</Label>
            <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" />
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
            <input type="checkbox" checked={wantAdmin} onChange={(e) => setWantAdmin(e.target.checked)} className="mt-1 h-5 w-5 accent-primary" />
            <div className="text-sm">
              <div className="font-medium">Compte Admin / Caissier</div>
              <div className="text-muted-foreground">Cochez uniquement pour le tout premier compte du restaurant. Sinon, un admin pourra vous promouvoir ensuite.</div>
            </div>
          </label>
          <Button type="submit" disabled={submitting} className="h-12 w-full bg-brand-gradient text-base font-semibold shadow-glow">
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Créer le compte"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Déjà inscrit ? <Link to="/login" className="font-medium text-primary">Se connecter</Link>
        </p>
      </div>
    </main>
  );
}
