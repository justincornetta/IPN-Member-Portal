import type { createClient } from "@/lib/supabase/server"
import type { DirectoryEducation, DirectoryMember } from "./types"

export const DIRECTORY_PAGE_SIZE = 60

export const DIRECTORY_MEMBER_SELECT =
  "id, first_name, last_name, persona, school, affiliation, field, city, state, country, bio, interest_tags, linkedin_url, avatar_url, admin_role, team"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type DirectoryFilters = {
  tab: string
  userSchool: string | null
  personas: string[]
  school: string
  field: string
  tags: string[]
}

/**
 * Shared filter-building for the directory profiles query — used both for the
 * initial page load and for "Load more" so the two never drift apart.
 */
export function buildDirectoryProfilesQuery(supabase: SupabaseClient, filters: DirectoryFilters) {
  let query = supabase
    .from("profiles")
    .select(DIRECTORY_MEMBER_SELECT, { count: "exact" })
    .eq("is_discoverable", true)
    .order("first_name", { ascending: true })

  if (filters.tab === "school" && filters.userSchool) {
    query = query.eq("school", filters.userSchool)
  }
  if (filters.personas.length > 0) {
    query = query.in("persona", filters.personas)
  }
  if (filters.school) {
    query = query.or(`school.ilike.%${filters.school}%,affiliation.ilike.%${filters.school}%`)
  }
  if (filters.field) {
    query = query.ilike("field", `%${filters.field}%`)
  }
  if (filters.tags.length > 0) {
    query = query.overlaps("interest_tags", filters.tags)
  }

  return query
}

/**
 * Contact details are RLS-gated (accepted connections + self only), so it's
 * always safe to query member_contacts for any set of profile ids — rows the
 * caller isn't authorized to see are simply omitted, not errored.
 */
export async function getContactMapForMembers(
  supabase: SupabaseClient,
  memberIds: string[],
): Promise<Map<string, { email: string | null; whatsapp_url: string | null }>> {
  if (memberIds.length === 0) return new Map()

  const { data: contacts } = await supabase
    .from("member_contacts")
    .select("user_id, email, whatsapp_url")
    .in("user_id", memberIds)

  return new Map(
    (contacts ?? []).map((c) => [
      c.user_id as string,
      {
        email: (c.email as string | null) ?? null,
        whatsapp_url: (c.whatsapp_url as string | null) ?? null,
      },
    ]),
  )
}

export async function getEducationMapForMembers(
  supabase: SupabaseClient,
  memberIds: string[],
): Promise<Map<string, DirectoryEducation[]>> {
  if (memberIds.length === 0) return new Map()

  const { data: educationRows } = await supabase
    .from("member_education")
    .select("id, user_id, institution, education_level, degree_credential, area_of_study, status, graduation_year, sort_order")
    .in("user_id", memberIds)
    .order("sort_order", { ascending: true })

  const educationByUser = new Map<string, DirectoryEducation[]>()
  for (const entry of educationRows ?? []) {
    const userId = entry.user_id as string
    const current = educationByUser.get(userId) ?? []
    current.push({
      id: entry.id as string,
      institution: entry.institution as string,
      education_level: entry.education_level as DirectoryEducation["education_level"],
      degree_credential: entry.degree_credential as string | null,
      area_of_study: entry.area_of_study as string | null,
      status: entry.status as DirectoryEducation["status"],
      graduation_year: entry.graduation_year as number | null,
      sort_order: entry.sort_order as number,
    })
    educationByUser.set(userId, current)
  }

  return educationByUser
}

export async function attachEducation(
  supabase: SupabaseClient,
  members: DirectoryMember[],
): Promise<DirectoryMember[]> {
  const educationMap = await getEducationMapForMembers(supabase, members.map((member) => member.id))
  return members.map((member) => ({
    ...member,
    education: educationMap.get(member.id) ?? [],
  }))
}

export async function attachContacts(
  supabase: SupabaseClient,
  members: DirectoryMember[],
): Promise<DirectoryMember[]> {
  const contactMap = await getContactMapForMembers(supabase, members.map((m) => m.id))
  return members.map((member) => ({ ...member, contact: contactMap.get(member.id) ?? null }))
}
