import { supabase } from "./supabaseClient";

export type ModuleName = "invoicing" | "recurring" | "scheduling";

export async function getActiveModules(): Promise<ModuleName[]> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return [];

  const { data } = await supabase
    .from("user_modules")
    .select("module")
    .eq("user_id", sessionData.session.user.id)
    .eq("status", "active");

  return (data ?? []).map((r) => r.module as ModuleName);
}

export async function hasModule(module: ModuleName): Promise<boolean> {
  const active = await getActiveModules();
  return active.includes(module);
}
