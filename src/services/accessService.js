import { supabase } from "../lib/supabase.js";

export async function getAccessContext() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("לא ניתן לקבל את פרטי המשתמש המחובר");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw new Error("לא נמצא פרופיל למשתמש המחובר");

  if (profile.role !== "admin") {
    return { userId: user.id, role: profile.role, businessOwnerId: null };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("business_admins")
    .select("business_owner_id")
    .eq("member_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError) throw membershipError;

  return {
    userId: user.id,
    role: profile.role,
    businessOwnerId: membership?.business_owner_id ?? null,
  };
}

export async function getBusinessOwnerId() {
  const context = await getAccessContext();

  if (context.role !== "admin" || !context.businessOwnerId) {
    throw new Error("למשתמש אין הרשאת ניהול פעילה");
  }

  return context.businessOwnerId;
}
