import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { RoleGate } from "@/components/app/RoleGate";
import { AppHeader } from "@/components/app/AppHeader";
import { fetchRooms, fetchTables, fetchCategories, fetchProducts, fmt, type Room, type Tbl, type Product } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Minus, Plus, Send, ShoppingCart, Loader2, MapPin, Hash } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/serveur")({ component: () => <RoleGate allow="server"><ServerApp /></RoleGate> });

type Step = "rooms" | "tables" | "menu" | "review";
type Cart = Record<string, { product: Product; qty: number }>;

function ServerApp() {
  const { user, fullName } = useAuth();
  const [step, setStep] = useState<Step>("rooms");
  const [room, setRoom] = useState<Room | null>(null);
  const [table, setTable] = useState<Tbl | null>(null);
  const [cart, setCart] = useState<Cart>({});
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const rooms = useQuery({ queryKey: ["rooms"], queryFn: fetchRooms });
  const tables = useQuery({ queryKey: ["tables", room?.id], queryFn: () => fetchTables(room!.id), enabled: !!room });
  const categories = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const total = useMemo(
    () => Object.values(cart).reduce((s, l) => s + l.product.price * l.qty, 0),
    [cart]
  );
  const itemCount = useMemo(() => Object.values(cart).reduce((s, l) => s + l.qty, 0), [cart]);

  const addOne = (p: Product) => setCart((c) => ({ ...c, [p.id]: { product: p, qty: (c[p.id]?.qty ?? 0) + 1 } }));
  const subOne = (p: Product) => setCart((c) => {
    const cur = c[p.id]?.qty ?? 0;
    const next = cur - 1;
    const copy = { ...c };
    if (next <= 0) delete copy[p.id];
    else copy[p.id] = { product: p, qty: next };
    return copy;
  });

  const reset = () => {
    setStep("rooms"); setRoom(null); setTable(null); setCart({}); setNote("");
  };

  const sendOrder = async () => {
    if (!user || !table || !room || itemCount === 0) return;
    setSending(true);
    const { data: order, error } = await supabase.from("orders").insert({
      server_id: user.id,
      server_name: fullName ?? "Serveur",
      table_id: table.id,
      table_label: table.label,
      room_name: room.name,
      total,
      note: note.trim() || null,
    }).select().single();
    if (error || !order) { setSending(false); toast.error(error?.message ?? "Erreur envoi"); return; }
    const items = Object.values(cart).map((l) => ({
      order_id: order.id,
      product_id: l.product.id,
      product_name: l.product.name,
      unit_price: l.product.price,
      quantity: l.qty,
    }));
    const { error: e2 } = await supabase.from("order_items").insert(items);
    setSending(false);
    if (e2) { toast.error(e2.message); return; }
    toast.success("Commande envoyée à la caisse");
    reset();
  };

  const goBack = () => {
    if (step === "tables") { setStep("rooms"); setRoom(null); }
    else if (step === "menu") setStep("tables");
    else if (step === "review") setStep("menu");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      <AppHeader
        title="Le Rocher Noir"
        right={step !== "rooms" ? (
          <Button variant="ghost" size="icon" onClick={goBack} aria-label="Retour">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        ) : undefined}
      />

      <div className="border-b border-border bg-card/40 px-4 py-2 text-xs text-muted-foreground">
        {step === "rooms" && "1/4 — Choisir la salle"}
        {step === "tables" && room && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {room.name} · 2/4 Choisir la table</span>}
        {step === "menu" && room && table && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {room.name} · <Hash className="h-3.5 w-3.5" /> {table.label} · 3/4 Menu</span>}
        {step === "review" && "4/4 — Vérifier et envoyer"}
      </div>

      <main className="flex-1 px-4 py-4">
        {step === "rooms" && (
          <SectionGrid loading={rooms.isLoading} empty={!rooms.data?.length} emptyText="Aucune salle. Demandez à l'admin d'en créer.">
            {rooms.data?.map((r) => (
              <BigButton key={r.id} onClick={() => { setRoom(r); setStep("tables"); }}>
                <span className="text-lg font-semibold">{r.name}</span>
              </BigButton>
            ))}
          </SectionGrid>
        )}

        {step === "tables" && (
          <SectionGrid loading={tables.isLoading} empty={!tables.data?.length} emptyText="Aucune table dans cette salle.">
            {tables.data?.map((t) => (
              <BigButton key={t.id} onClick={() => { setTable(t); setStep("menu"); }}>
                <Hash className="h-5 w-5 opacity-60" />
                <span className="text-lg font-semibold">{t.label}</span>
              </BigButton>
            ))}
          </SectionGrid>
        )}

        {step === "menu" && (
          <Menu cart={cart} onAdd={addOne} onSub={subOne} categories={categories.data} products={products.data} loading={categories.isLoading || products.isLoading} />
        )}

        {step === "review" && (
          <Review cart={cart} note={note} setNote={setNote} onAdd={addOne} onSub={subOne} total={total} />
        )}
      </main>

      {/* Sticky bottom bar */}
      {(step === "menu" || step === "review") && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 backdrop-blur shadow-card">
          <div className="mx-auto flex max-w-md items-center gap-3">
            {step === "menu" ? (
              <>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-lg font-bold">{fmt(total)} €</div>
                </div>
                <Button
                  className="h-14 flex-[1.4] bg-brand-gradient text-base font-semibold shadow-glow"
                  disabled={itemCount === 0}
                  onClick={() => setStep("review")}
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Voir ({itemCount})
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" className="h-14 flex-1 text-base" onClick={() => setStep("menu")}>Modifier</Button>
                <Button
                  className="h-14 flex-[1.4] bg-brand-gradient text-base font-semibold shadow-glow"
                  disabled={sending || itemCount === 0}
                  onClick={sendOrder}
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : (<><Send className="mr-2 h-5 w-5" /> Envoyer</>)}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionGrid({ loading, empty, emptyText, children }: { loading: boolean; empty: boolean; emptyText: string; children: React.ReactNode }) {
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (empty) return <p className="py-12 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function BigButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="bg-card-gradient flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-border p-4 text-card-foreground shadow-card transition active:scale-[0.97] active:border-primary">
      {children}
    </button>
  );
}

function Menu({ cart, onAdd, onSub, categories, products, loading }: {
  cart: Cart; onAdd: (p: Product) => void; onSub: (p: Product) => void;
  categories?: ReturnType<typeof useMemo<any>> & any; products?: Product[]; loading: boolean;
}) {
  const cats = (categories ?? []) as { id: string; name: string }[];
  const [activeCat, setActiveCat] = useState<string | null>(null);
  useEffect(() => { if (!activeCat && cats.length) setActiveCat(cats[0].id); }, [cats, activeCat]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (!cats.length) return <p className="py-12 text-center text-sm text-muted-foreground">Aucun produit. L'admin doit créer le menu.</p>;

  const list = (products ?? []).filter((p) => p.category_id === activeCat && p.available);

  return (
    <div>
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {cats.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${activeCat === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}
          >
            {c.name}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {list.map((p) => {
          const qty = cart[p.id]?.qty ?? 0;
          return (
            <li key={p.id} className="bg-card-gradient flex items-center gap-3 rounded-xl border border-border p-3 shadow-card">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="text-sm text-muted-foreground">{fmt(p.price)} €</div>
              </div>
              {qty > 0 ? (
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="secondary" className="h-10 w-10" onClick={() => onSub(p)}><Minus className="h-4 w-4" /></Button>
                  <span className="w-6 text-center text-base font-bold">{qty}</span>
                  <Button size="icon" className="h-10 w-10 bg-brand-gradient" onClick={() => onAdd(p)}><Plus className="h-4 w-4" /></Button>
                </div>
              ) : (
                <Button size="icon" className="h-12 w-12 bg-brand-gradient shadow-glow" onClick={() => onAdd(p)}>
                  <Plus className="h-5 w-5" />
                </Button>
              )}
            </li>
          );
        })}
        {list.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Aucun produit dans cette catégorie.</p>}
      </ul>
    </div>
  );
}

function Review({ cart, note, setNote, onAdd, onSub, total }: {
  cart: Cart; note: string; setNote: (v: string) => void;
  onAdd: (p: Product) => void; onSub: (p: Product) => void; total: number;
}) {
  const lines = Object.values(cart);
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {lines.map((l) => (
          <li key={l.product.id} className="bg-card-gradient flex items-center gap-3 rounded-xl border border-border p-3 shadow-card">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{l.product.name}</div>
              <div className="text-sm text-muted-foreground">{fmt(l.product.price)} € × {l.qty} = <span className="font-medium text-foreground">{fmt(l.product.price * l.qty)} €</span></div>
            </div>
            <Button size="icon" variant="secondary" className="h-10 w-10" onClick={() => onSub(l.product)}><Minus className="h-4 w-4" /></Button>
            <span className="w-6 text-center text-base font-bold">{l.qty}</span>
            <Button size="icon" className="h-10 w-10 bg-brand-gradient" onClick={() => onAdd(l.product)}><Plus className="h-4 w-4" /></Button>
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="note">Remarque (optionnel)</label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: sans oignons, bien cuit, allergie..." rows={3} className="resize-none" />
      </div>
      <div className="bg-card-gradient flex items-center justify-between rounded-xl border border-border p-4 shadow-card">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-2xl font-bold">{fmt(total)} €</span>
      </div>
    </div>
  );
}
