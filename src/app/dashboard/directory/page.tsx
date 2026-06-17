import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import DirectoryClient from "./DirectoryClient"
import type {
  ConnectionEntry,
  DirectoryMapCity,
  DirectoryMapMember,
  DirectoryMember,
  DirectoryParams,
} from "@/lib/directory/types"

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
      "id, first_name, last_name, persona, school, affiliation, field, city, state, bio, interest_tags, linkedin_url, avatar_url, admin_role, team",
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

  const { data: connRows } = await supabase
    .from("connections")
    .select("requester_id, addressee_id, status")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)

  const connectionMap: Record<string, ConnectionEntry> = {}
  const acceptedConnectionIds: string[] = []
  for (const c of connRows ?? []) {
    const otherId = c.requester_id === user.id ? c.addressee_id : c.requester_id
    connectionMap[otherId] = {
      status: c.status as ConnectionEntry["status"],
      amRequester: c.requester_id === user.id,
    }
    if (c.status === "accepted") acceptedConnectionIds.push(otherId)
  }

  const { data: contacts } = acceptedConnectionIds.length > 0
    ? await supabase
      .from("member_contacts")
      .select("user_id, email, whatsapp_url")
      .in("user_id", acceptedConnectionIds)
    : { data: [] }

  const contactMap = new Map(
    (contacts ?? []).map((c) => [
      c.user_id as string,
      {
        email: (c.email as string | null) ?? null,
        whatsapp_url: (c.whatsapp_url as string | null) ?? null,
      },
    ]),
  )

  const membersWithContacts = ((members ?? []) as DirectoryMember[]).map((member) => ({
    ...member,
    contact: contactMap.get(member.id) ?? null,
  }))

  let mapQuery = supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, persona, school, affiliation, field, city, state, country, city_lat, city_lng, bio, interest_tags, linkedin_url, avatar_url, admin_role, team",
    )
    .eq("is_discoverable", true)
    .eq("share_location", true)
    .not("city", "is", null)
    .not("city_lat", "is", null)
    .not("city_lng", "is", null)
    .neq("id", user.id)
    .order("first_name", { ascending: true })

  if (tab === "school" && userSchool) {
    mapQuery = mapQuery.eq("school", userSchool)
  }

  if (q) {
    mapQuery = mapQuery.or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,school.ilike.%${q}%,affiliation.ilike.%${q}%,field.ilike.%${q}%,bio.ilike.%${q}%`,
    )
  }

  if (personas.length > 0) {
    mapQuery = mapQuery.in("persona", personas)
  }

  if (schoolFilter) {
    mapQuery = mapQuery.or(
      `school.ilike.%${schoolFilter}%,affiliation.ilike.%${schoolFilter}%`,
    )
  }

  if (fieldFilter) {
    mapQuery = mapQuery.ilike("field", `%${fieldFilter}%`)
  }

  if (tagFilter.length > 0) {
    mapQuery = mapQuery.overlaps("interest_tags", tagFilter)
  }

  const { data: mapRows } = await mapQuery
  const cityMap = new Map<string, DirectoryMapCity>()

  for (const row of (mapRows ?? []) as DirectoryMapMember[]) {
    if (!row.city || row.city_lat == null || row.city_lng == null) continue

    const lat = Number(row.city_lat)
    const lng = Number(row.city_lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    const id = [
      row.city.trim().toLowerCase(),
      row.state?.trim().toLowerCase() ?? "",
      row.country?.trim().toLowerCase() ?? "",
      lat.toFixed(2),
      lng.toFixed(2),
    ].join(":")

    const member = {
      ...row,
      city_lat: lat,
      city_lng: lng,
      contact: contactMap.get(row.id) ?? null,
    }

    const existing = cityMap.get(id)
    if (existing) {
      existing.members.push(member)
      existing.memberCount += 1
    } else {
      cityMap.set(id, {
        id,
        city: row.city,
        state: row.state,
        country: row.country,
        lat,
        lng,
        memberCount: 1,
        members: [member],
      })
    }
  }

  const mapCities = [...cityMap.values()].sort((a, b) => b.memberCount - a.memberCount)

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
      members={membersWithContacts}
      mapCities={mapCities}
      showSchoolTab={showSchoolTab}
      currentParams={currentParams}
      schools={schools}
      availableTags={availableTags}
      connectionMap={connectionMap}
    />
  )
}
