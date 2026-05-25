import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import DirectoryClient from "./DirectoryClient"
import type { DirectoryMember, DirectoryParams } from "@/lib/directory/types"

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: userProfile } = await supabase
    .from("profiles")
    .select("school")
    .eq("id", user.id)
    .single()

  const userSchool = userProfile?.school ?? null

  const q = (typeof params.q === "string" ? params.q : "").trim()
  const personaParam = params.persona
  const personas = Array.isArray(personaParam)
    ? personaParam
    : personaParam
      ? [personaParam]
      : []
  const schoolFilter = (typeof params.school === "string" ? params.school : "").trim()
  const fieldFilter = (typeof params.field === "string" ? params.field : "").trim()
  const tagParam = params.tag
  const tagFilter = Array.isArray(tagParam) ? tagParam : tagParam ? [tagParam] : []
  const tab = params.tab === "school" && userSchool ? "school" : "all"

  let query = supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, persona, school, affiliation, field, city, state, bio, interest_tags, linkedin_url, avatar_url",
    )
    .eq("is_discoverable", true)
    .neq("id", user.id)
    .order("first_name", { ascending: true })

  if (tab === "school" && userSchool) {
    query = query.eq("school", userSchool)
  }

  if (q) {
    query = query.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,school.ilike.%${q}%,affiliation.ilike.%${q}%,field.ilike.%${q}%,bio.ilike.%${q}%`,
    )
  }

  if (personas.length > 0) {
    query = query.in("persona", personas)
  }

  if (schoolFilter) {
    query = query.or(
      `school.ilike.%${schoolFilter}%,affiliation.ilike.%${schoolFilter}%`,
    )
  }

  if (fieldFilter) {
    query = query.ilike("field", `%${fieldFilter}%`)
  }

  if (tagFilter.length > 0) {
    query = query.overlaps("interest_tags", tagFilter)
  }

  const { data: members } = await query

  let showSchoolTab = false
  if (userSchool) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("school", userSchool)
      .eq("is_discoverable", true)
      .neq("id", user.id)
    showSchoolTab = (count ?? 0) > 0
  }

  const { data: schoolRows } = await supabase
    .from("profiles")
    .select("school")
    .eq("is_discoverable", true)
    .not("school", "is", null)

  const schools = [...new Set(
    (schoolRows ?? []).map((r) => r.school as string).filter(Boolean)
  )].sort()

  const { data: tagRows } = await supabase
    .from("profiles")
    .select("interest_tags")
    .eq("is_discoverable", true)
    .not("interest_tags", "is", null)

  const availableTags = [...new Set(
    (tagRows ?? []).flatMap((r) => (r.interest_tags as string[]) ?? [])
  )].sort()

  const currentParams: DirectoryParams = {
    q,
    personas,
    school: schoolFilter,
    field: fieldFilter,
    tab,
    tags: tagFilter,
  }

  return (
    <DirectoryClient
      members={(members ?? []) as DirectoryMember[]}
      showSchoolTab={showSchoolTab}
      currentParams={currentParams}
      schools={schools}
      availableTags={availableTags}
    />
  )
}
