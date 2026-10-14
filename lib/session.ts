import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Data pengguna untuk header dashboard -- dibungkus React cache() supaya
 * dalam SATU request hanya memanggil Supabase sekali walau dipakai di
 * beberapa komponen server.
 */
export const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, nama")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.nama || profile?.username || user.email?.split("@")[0] || "Admin";
  const initials =
    displayName
      .split(/\s+/)
      .map((w: string) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "AD";

  return { userId: user.id, displayName, initials };
});
