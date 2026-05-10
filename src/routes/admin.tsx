import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RoleGate } from "@/components/app/RoleGate";
import { AppHeader } from "@/components/app/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { fmt, fetchRooms, fetchTables, fetchCategories, fetchProducts, type OrderRow, type OrderItem } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Check, Clock, Loader2, MapPin, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({ component: () => <RoleGate allow="admin"><AdminApp /></RoleGate> });

function AdminApp() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader title="Caisse — Le Rocher Noir" />
      <Tabs defaultValue="orders" className="flex flex-1 flex-col">
        <TabsList className="grid grid-cols-4 rounded-none border-b border-border bg-card/40 p-0">
          <TabsTrigger value="orders" className="h-12 rounded-none">Commandes</TabsTrigger>
          <TabsTrigger value="rooms" className="h-12 rounded-none">Salles</TabsTrigger>
          <TabsTrigger value="menu" className="h-12 rounded-none">Menu</TabsTrigger>
          <TabsTrigger value="team" className="h-12 rounded-none">Équipe</TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="flex-1 p-0"><OrdersPanel /></TabsContent>
        <TabsContent value="rooms" className="flex-1 p-4"><RoomsPanel /></TabsContent>
        <TabsContent value="menu" className="flex-1 p-4"><MenuPanel /></TabsContent>
        <TabsContent value="team" className="flex-1 p-4"><TeamPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- ORDERS (REALTIME) ---------------- */

function OrdersPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"active" | "all">("active");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data: orders, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      const ids = (orders ?? []).map((o) => o.id);
      if (!ids.length) return { orders: [] as OrderRow[], items: {} as Record<string, OrderItem[]> };
      const { data: items } = await supabase.from("order_items").select("*").in("order_id", ids);
      const grouped: Record<string, OrderItem[]> = {};
      (items ?? []).forEach((it) => { (grouped[it.order_id] ||= []).push(it as OrderItem); });
      return { orders: orders as OrderRow[], items: grouped };
    },
  });

  // initialize seenIds with current orders to avoid sound on first load
  useEffect(() => {
    if (data?.orders && seenIds.current.size === 0) {
      data.orders.forEach((o) => seenIds.current.add(o.id));
    }
  }, [data?.orders]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        qc.invalidateQueries({ queryKey: ["orders"] });
        if (payload.eventType === "INSERT") {
          const id = (payload.new as { id?: string }).id;
          if (id && !seenIds.current.has(id)) {
            seenIds.current.add(id);
            try { void audioRef.current?.play(); } catch {}
            toast.success("Nouvelle commande !", { description: `${(payload.new as OrderRow).table_label} · ${(payload.new as OrderRow).server_name}` });
            if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(200);
          }
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => {
        qc.invalidateQueries({ queryKey: ["orders"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [qc]);

  const updateStatus = async (id: string, status: "received" | "completed") => {
    const { error } = await supabase.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
  };

  const orders = (data?.orders ?? []).filter((o) => filter === "all" ? true : o.status !== "completed");

  return (
    <div className="px-4 py-3">
      {/* base64 short beep */}
      <audio ref={audioRef} preload="auto" src="data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYxLjcuMTAwAAAAAAAAAAAAAAD/+0DAAAAAAAAAAAAAAAAAAAAAAABJbmZvAAAADwAAAAIAAALsADQ0NDQ0NDRoaGhoaGhoaJ2dnZ2dnZ2dnenp6enp6enp//////////////////////////////////8AAAAATGF2YzYxLjE5AAAAAAAAAAAAAAAAJAJAAAAAAAAACz4LWLcRAAAA//uQRAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAACWAA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0+Pj4+Pj4+Pj4+Pj4+Pj7///////////////////////////////////////////////////////////////////////////////////8AAABMYXZjNjEuMzEAAAAAAAAAAAAAAAAkA0AAAAAAAAAA" />
      <div className="mb-3 flex items-center gap-2">
        <Button variant={filter === "active" ? "default" : "secondary"} size="sm" onClick={() => setFilter("active")} className={filter === "active" ? "bg-brand-gradient" : ""}>En cours</Button>
        <Button variant={filter === "all" ? "default" : "secondary"} size="sm" onClick={() => setFilter("all")} className={filter === "all" ? "bg-brand-gradient" : ""}>Toutes</Button>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-success animate-pulse-ring" /> Temps réel</span>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : orders.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Aucune commande {filter === "active" ? "en cours" : ""}.</p>
      ) : (
        <ul className="space-y-3 pb-6">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} items={data?.items[o.id] ?? []} onUpdate={updateStatus} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderCard({ order, items, onUpdate }: { order: OrderRow; items: OrderItem[]; onUpdate: (id: string, s: "received" | "completed") => void }) {
  const time = new Date(order.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const isPending = order.status === "pending";
  return (
    <li className={`bg-card-gradient overflow-hidden rounded-xl border shadow-card transition ${isPending ? "border-primary shadow-glow" : "border-border"}`}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-3.5 w-3.5 opacity-60" />
            <span className="truncate font-semibold">{order.room_name} · {order.table_label}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-3 w-3" /> {order.server_name}
            <span className="opacity-50">·</span>
            <Clock className="h-3 w-3" /> {time}
          </div>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <ul className="divide-y divide-border">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className="flex items-center gap-3">
              <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-primary/15 px-2 text-sm font-bold text-primary">×{it.quantity}</span>
              <span>{it.product_name}</span>
            </span>
            <span className="text-muted-foreground">{fmt(it.unit_price * it.quantity)} €</span>
          </li>
        ))}
      </ul>
      {order.note && (
        <div className="border-t border-border bg-warning/10 px-4 py-2 text-sm">
          <span className="font-medium text-warning">Remarque : </span>
          <span>{order.note}</span>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <div className="flex-1">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-lg font-bold">{fmt(order.total)} €</div>
        </div>
        {order.status === "pending" && (
          <Button onClick={() => onUpdate(order.id, "received")} className="h-11 bg-brand-gradient shadow-glow">
            <Bell className="mr-2 h-4 w-4" /> Reçue
          </Button>
        )}
        {order.status !== "completed" && (
          <Button onClick={() => onUpdate(order.id, "completed")} variant="secondary" className="h-11">
            <Check className="mr-2 h-4 w-4" /> Terminée
          </Button>
        )}
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: OrderRow["status"] }) {
  if (status === "pending")
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-2.5 py-1 text-xs font-semibold text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-ring" />Nouvelle</span>;
  if (status === "received")
    return <span className="rounded-full bg-warning/20 px-2.5 py-1 text-xs font-semibold text-warning">Reçue</span>;
  return <span className="rounded-full bg-success/20 px-2.5 py-1 text-xs font-semibold text-success">Terminée</span>;
}

/* ---------------- ROOMS / TABLES ---------------- */

function RoomsPanel() {
  const qc = useQueryClient();
  const rooms = useQuery({ queryKey: ["rooms"], queryFn: fetchRooms });
  const allTables = useQuery({ queryKey: ["all-tables"], queryFn: () => fetchTables() });
  const [newRoom, setNewRoom] = useState("");

  const grouped = useMemo(() => {
    const m: Record<string, { id: string; label: string }[]> = {};
    (allTables.data ?? []).forEach((t) => { (m[t.room_id] ||= []).push({ id: t.id, label: t.label }); });
    return m;
  }, [allTables.data]);

  const addRoom = async () => {
    const name = newRoom.trim(); if (!name) return;
    const { error } = await supabase.from("rooms").insert({ name });
    if (error) return toast.error(error.message);
    setNewRoom(""); qc.invalidateQueries({ queryKey: ["rooms"] });
  };
  const renameRoom = async (id: string, current: string) => {
    const name = window.prompt("Nom de la salle", current)?.trim(); if (!name) return;
    const { error } = await supabase.from("rooms").update({ name }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] });
  };
  const delRoom = async (id: string) => {
    if (!window.confirm("Supprimer cette salle et toutes ses tables ?")) return;
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["rooms"] }); qc.invalidateQueries({ queryKey: ["all-tables"] });
  };
  const addTable = async (roomId: string) => {
    const label = window.prompt("Label de la table (ex: T1)")?.trim(); if (!label) return;
    const { error } = await supabase.from("restaurant_tables").insert({ room_id: roomId, label });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["all-tables"] });
  };
  const renameTable = async (id: string, current: string) => {
    const label = window.prompt("Label", current)?.trim(); if (!label) return;
    const { error } = await supabase.from("restaurant_tables").update({ label }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["all-tables"] });
  };
  const delTable = async (id: string) => {
    if (!window.confirm("Supprimer cette table ?")) return;
    const { error } = await supabase.from("restaurant_tables").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["all-tables"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Nouvelle salle (ex: Terrasse)" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} className="h-11" />
        <Button onClick={addRoom} className="h-11 bg-brand-gradient"><Plus className="h-4 w-4" /></Button>
      </div>
      <ul className="space-y-3">
        {(rooms.data ?? []).map((r) => (
          <li key={r.id} className="bg-card-gradient rounded-xl border border-border p-3 shadow-card">
            <div className="flex items-center gap-2">
              <span className="flex-1 font-semibold">{r.name}</span>
              <Button size="icon" variant="ghost" onClick={() => renameRoom(r.id, r.name)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => delRoom(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(grouped[r.id] ?? []).map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-3 py-1 text-sm">
                  {t.label}
                  <button onClick={() => renameTable(t.id, t.label)} className="ml-1 opacity-60 hover:opacity-100"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => delTable(t.id)} className="opacity-60 hover:opacity-100"><Trash2 className="h-3 w-3 text-destructive" /></button>
                </span>
              ))}
              <Button size="sm" variant="secondary" onClick={() => addTable(r.id)} className="h-7"><Plus className="mr-1 h-3 w-3" /> Table</Button>
            </div>
          </li>
        ))}
        {rooms.data?.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucune salle. Créez-en une ci-dessus.</p>}
      </ul>
    </div>
  );
}

/* ---------------- MENU ---------------- */

function MenuPanel() {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const prods = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const [newCat, setNewCat] = useState("");

  const addCat = async () => {
    const name = newCat.trim(); if (!name) return;
    const { error } = await supabase.from("categories").insert({ name });
    if (error) return toast.error(error.message);
    setNewCat(""); qc.invalidateQueries({ queryKey: ["categories"] });
  };
  const renameCat = async (id: string, current: string) => {
    const name = window.prompt("Nom de la catégorie", current)?.trim(); if (!name) return;
    const { error } = await supabase.from("categories").update({ name }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["categories"] });
  };
  const delCat = async (id: string) => {
    if (!window.confirm("Supprimer cette catégorie et tous ses produits ?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["categories"] }); qc.invalidateQueries({ queryKey: ["products"] });
  };
  const addProduct = async (catId: string) => {
    const name = window.prompt("Nom du produit")?.trim(); if (!name) return;
    const priceStr = window.prompt("Prix (en €)", "0.00")?.replace(",", "."); if (priceStr == null) return;
    const price = Number(priceStr); if (!Number.isFinite(price) || price < 0) return toast.error("Prix invalide");
    const { error } = await supabase.from("products").insert({ category_id: catId, name, price });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["products"] });
  };
  const editProduct = async (id: string, currentName: string, currentPrice: number) => {
    const name = window.prompt("Nom", currentName)?.trim(); if (!name) return;
    const priceStr = window.prompt("Prix (en €)", String(currentPrice))?.replace(",", "."); if (priceStr == null) return;
    const price = Number(priceStr); if (!Number.isFinite(price) || price < 0) return toast.error("Prix invalide");
    const { error } = await supabase.from("products").update({ name, price }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["products"] });
  };
  const toggleAvail = async (id: string, available: boolean) => {
    const { error } = await supabase.from("products").update({ available: !available }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["products"] });
  };
  const delProduct = async (id: string) => {
    if (!window.confirm("Supprimer ce produit ?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Nouvelle catégorie (ex: Pizza)" value={newCat} onChange={(e) => setNewCat(e.target.value)} className="h-11" />
        <Button onClick={addCat} className="h-11 bg-brand-gradient"><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-4">
        {(cats.data ?? []).map((c) => {
          const list = (prods.data ?? []).filter((p) => p.category_id === c.id);
          return (
            <section key={c.id} className="bg-card-gradient rounded-xl border border-border p-3 shadow-card">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="flex-1 text-base font-semibold">{c.name}</h3>
                <Button size="icon" variant="ghost" onClick={() => renameCat(c.id, c.name)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => delCat(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
              <ul className="space-y-1.5">
                {list.map((p) => (
                  <li key={p.id} className={`flex items-center gap-2 rounded-lg border border-border px-3 py-2 ${p.available ? "bg-background/40" : "bg-background/20 opacity-60"}`}>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{fmt(p.price)} € {!p.available && "· indisponible"}</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => toggleAvail(p.id, p.available)} className="h-8 px-2 text-xs">
                      {p.available ? "Masquer" : "Afficher"}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => editProduct(p.id, p.name, p.price)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => delProduct(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </li>
                ))}
              </ul>
              <Button size="sm" variant="secondary" onClick={() => addProduct(c.id)} className="mt-2 h-9 w-full">
                <Plus className="mr-1 h-4 w-4" /> Ajouter un produit
              </Button>
            </section>
          );
        })}
        {cats.data?.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucune catégorie. Créez-en une ci-dessus.</p>}
      </div>
    </div>
  );
}

/* ---------------- TEAM (promote / demote roles) ---------------- */

function TeamPanel() {
  const qc = useQueryClient();
  const team = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const [{ data: profiles, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, created_at").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (e1) throw e1; if (e2) throw e2;
      const map = new Map<string, Set<string>>();
      (roles ?? []).forEach((r) => {
        if (!map.has(r.user_id)) map.set(r.user_id, new Set());
        map.get(r.user_id)!.add(r.role);
      });
      return (profiles ?? []).map((p) => ({
        id: p.id, full_name: p.full_name,
        roles: Array.from(map.get(p.id) ?? new Set<string>()),
      }));
    },
  });

  const setRole = async (userId: string, target: "admin" | "server") => {
    const other = target === "admin" ? "server" : "admin";
    // ensure target role present
    const { error: e1 } = await supabase.from("user_roles").upsert({ user_id: userId, role: target }, { onConflict: "user_id,role" });
    if (e1) return toast.error(e1.message);
    // remove other role
    const { error: e2 } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", other);
    if (e2) return toast.error(e2.message);
    toast.success(`Rôle mis à jour : ${target === "admin" ? "Admin" : "Serveur"}`);
    qc.invalidateQueries({ queryKey: ["team"] });
  };

  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">Promouvez ou rétrogradez les membres. Au moins un admin doit toujours exister.</p>
      <ul className="space-y-2">
        {(team.data ?? []).map((u) => {
          const isAdmin = u.roles.includes("admin");
          return (
            <li key={u.id} className="bg-card-gradient flex items-center gap-3 rounded-xl border border-border p-3 shadow-card">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{u.full_name}</div>
                <div className="text-xs text-muted-foreground">{isAdmin ? "Admin / Caissier" : "Serveur"}</div>
              </div>
              <Select value={isAdmin ? "admin" : "server"} onValueChange={(v) => setRole(u.id, v as "admin" | "server")}>
                <SelectTrigger className="h-10 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="server">Serveur</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </li>
          );
        })}
        {team.data?.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucun membre.</p>}
      </ul>
    </div>
  );
}
