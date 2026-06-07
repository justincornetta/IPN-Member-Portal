"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function verifySuperadmin(): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (data?.role !== "superadmin") return { error: "Unauthorized" }
  return null
}

export type AdminMemberProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  avatar_url: string | null
  role: string | null
  admin_role: string | null
  team: string | null
  persona: string | null
  bio: string | null
}

// Excludes current leadership (role IS NOT NULL)
export async function searchMembersForAdmin(query: string): Promise<AdminMemberProfile[]> {
  const authError = await verifySuperadmin()
  if (authError) return []

  const q = query.trim()
  if (!q) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from("profiles")
    .select("id, first_name, last_name, email, avatar_url, role, admin_role, team, persona, bio")
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    .limit(10)

  return (data ?? []) as AdminMemberProfile[]
}

export async function assignAdminAccess(
  userId: string,
  adminRole: string | null,
  team: string | null,
): Promise<{ error?: string }> {
  const authError = await verifySuperadmin()
  if (authError) return authError

  const admin = createAdminClient()

  const { data: target } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single()

  const newRole =
    target?.role === "superadmin"
      ? "superadmin"
      : adminRole || team
        ? "admin"
        : null

  const { error } = await admin
    .from("profiles")
    .update({ admin_role: adminRole, team, role: newRole })
    .eq("id", userId)

  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin")
  return {}
}
