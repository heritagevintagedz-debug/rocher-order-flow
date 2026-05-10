import { supabase } from "@/integrations/supabase/client";

export type Room = { id: string; name: string; position: number };
export type Tbl = { id: string; room_id: string; label: string; position: number };
export type Category = { id: string; name: string; position: number };
export type Product = { id: string; category_id: string; name: string; price: number; available: boolean; position: number };
export type OrderRow = {
  id: string;
  server_id: string;
  server_name: string;
  table_id: string;
  table_label: string;
  room_name: string;
  status: "pending" | "received" | "completed";
  total: number;
  note: string | null;
  created_at: string;
};
export type OrderItem = {
  id: string;
  order_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
};

export const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export async function fetchRooms() {
  const { data, error } = await supabase.from("rooms").select("*").order("position").order("name");
  if (error) throw error;
  return (data ?? []) as Room[];
}
export async function fetchTables(roomId?: string) {
  let q = supabase.from("restaurant_tables").select("*").order("position").order("label");
  if (roomId) q = q.eq("room_id", roomId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Tbl[];
}
export async function fetchCategories() {
  const { data, error } = await supabase.from("categories").select("*").order("position").order("name");
  if (error) throw error;
  return (data ?? []) as Category[];
}
export async function fetchProducts() {
  const { data, error } = await supabase.from("products").select("*").order("position").order("name");
  if (error) throw error;
  return (data ?? []) as Product[];
}
