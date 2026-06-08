import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { lookupMailchimpSubscription } from "@/lib/mailchimp/actions"
import { profileMailchimpFields } from "@/lib/mailchimp/status"
import AdminClient from "./AdminClient"
import type { AnalyticsData } from "./AdminClient"
import type { AdminMemberProfile } from "@/lib/admin/actions"

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const userRole = currentProfile?.role
  if (userRole !== "superadmin" && userRole !== "admin") redirect("/dashboard")

  const isSuperadmin = userRole === "superadmin"
  const admin = createAdminClient()

  // Leadership roster
  const { data: leadershipRows } = await admin
    .from("profiles")
    .select("id, first_name, last_name, email, avatar_url, role, admin_role, team, persona, bio")
    .not("role", "is", null)
    .order("first_name", { ascending: true })

  const leadership = (leadershipRows ?? []) as AdminMemberProfile[]

  // Analytics (all admin tiers — recent signups only for superadmin)
  const { data: profileRows } = await admin
    .from("profiles")
    .select("persona, field, interest_tags, school, country, is_discoverable, created_at")

  const allProfiles = profileRows ?? []
  const total = allProfiles.length
  const discoverable = allProfiles.filter((p) => p.is_discoverable).length

  const personaCount: Record<string, number> = {}
  for (const p of allProfiles) {
    if (p.persona) personaCount[p.persona] = (personaCount[p.persona] ?? 0) + 1
  }

  const fieldCount: Record<string, number> = {}
  for (const p of allProfiles) {
    if (p.field) fieldCount[p.field] = (fieldCount[p.field] ?? 0) + 1
  }

  const tagCount: Record<string, number> = {}
  for (const p of allProfiles) {
    for (const tag of (p.interest_tags ?? [])) {
      tagCount[tag] = (tagCount[tag] ?? 0) + 1
    }
  }

  const schoolCount: Record<string, number> = {}
  for (const p of allProfiles) {
    if (p.school) schoolCount[p.school] = (schoolCount[p.school] ?? 0) + 1
  }

  const countryCount: Record<string, number> = {}
  for (const p of allProfiles) {
    if (p.country) countryCount[p.country] = (countryCount[p.country] ?? 0) + 1
  }

  let recent = null
  if (isSuperadmin) {
    const { data } = await admin
      .from("profiles")
      .select("id, first_name, last_name, email, persona, created_at, mailchimp_status, mailchimp_last_error_raw, mailchimp_last_error_description")
      .order("created_at", { ascending: false })
      .limit(10)
    recent = await Promise.all((data ?? []).map(async (profile) => {
      if (profile.mailchimp_status !== "unknown" || !profile.email) {
        return profile
      }

      const result = await lookupMailchimpSubscription(profile.email)
      const fields = profileMailchimpFields(result)
      await admin.from("profiles").update(fields).eq("id", profile.id)
      return { ...profile, ...fields }
    }))
  }

  const analytics: AnalyticsData = {
    total,
    discoverable,
    withTags: allProfiles.filter((p) => (p.interest_tags?.length ?? 0) > 0).length,
    personaItems: Object.entries(personaCount).sort((a, b) => b[1] - a[1]),
    fieldItems: Object.entries(fieldCount).sort((a, b) => b[1] - a[1]),
    topTags: Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 10),
    topSchools: Object.entries(schoolCount).sort((a, b) => b[1] - a[1]).slice(0, 10),
    topCountries: Object.entries(countryCount).sort((a, b) => b[1] - a[1]).slice(0, 10),
    recent,
  }

  return (
    <AdminClient
      isSuperadmin={isSuperadmin}
      leadership={leadership}
      analytics={analytics}
    />
  )
}
