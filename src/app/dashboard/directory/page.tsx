import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import DirectoryClient from "./DirectoryClient"
import type { ConnectionRow } from "./RequestsPanel"
import type {
  ConnectionEntry,
  DirectoryMapCity,
  DirectoryMapMember,
  DirectoryMember,
  DirectoryParams,
} from "@/lib/directory/types"
import { resolveDirectoryMapState } from "@/lib/directory/location"
import { memberMatchesDirectorySearch } from "@/lib/directory/search"
import { buildDirectoryProfilesQuery, attachContacts, getContactMapForMembers, DIRECTORY_MEMBER_SELECT, DIRECTORY_PAGE_SIZE } from "@/lib/directory/queries"

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

  const { count: pendingRequestCount } = await supabase
    .from("connections")
    .select("id", { count: "exact", head: true })
    .eq("addressee_id", user.id)
    .eq("status", "pending")

  const tab = params.tab === "school" && userSchool
    ? "school"
    : params.tab === "connections"
      ? "connections"
      : "all"

  if (tab === "connections") {
    const { data: rows } = await supabase
      .from("connections")
      .select(`
        id, requester_id, addressee_id, status, created_at,
        requester:profiles!connections_requester_id_fkey(${DIRECTORY_MEMBER_SELECT}),
        addressee:profiles!connections_addressee_id_fkey(${DIRECTORY_MEMBER_SELECT})
      `)
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order("created_at", { ascending: false })

    const connections = (rows ?? []) as unknown as ConnectionRow[]
    const memberIds = [...new Set(connections.flatMap((c) => [c.requester.id, c.addressee.id]))]
    const contactMap = await getContactMapForMembers(supabase, memberIds)
    const withContacts = connections.map((c) => ({
      ...c,
      requester: { ...c.requester, contact: contactMap.get(c.requester.id) ?? null },
      addressee: { ...c.addressee, contact: contactMap.get(c.addressee.id) ?? null },
    }))

    const connectionsData = {
      accepted: withContacts.filter((c) => c.status === "accepted"),
      incoming: withContacts.filter((c) => c.status === "pending" && c.addressee_id === user.id),
      outgoing: withContacts.filter((c) => c.status === "pending" && c.requester_id === user.id),
    }

    let showSchoolTab = false
    if (userSchool) {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("school", userSchool)
        .eq("is_discoverable", true)
      showSchoolTab = (count ?? 0) > 0
    }

    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-10">
        <DirectoryClient
          members={[]}
          hasMore={false}
          mapCities={[]}
          showSchoolTab={showSchoolTab}
          currentParams={{ q: "", personas: [], school: "", field: "", tab, tags: [] }}
          schools={[]}
          availableTags={[]}
          connectionMap={{}}
          currentUserId={user.id}
          pendingRequestCount={pendingRequestCount ?? 0}
          connections={connectionsData}
        />
      </div>
    )
  }

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
  const view = params.view === "map" ? "map" : "list"

  const filters = { tab, userSchool, personas, school: schoolFilter, field: fieldFilter, tags: tagFilter }

  let membersWithContacts: DirectoryMember[] = []
  let hasMore = false
  let mapCities: DirectoryMapCity[] = []

  if (view === "map") {
    // Map view is only ever fetched when it's actually being rendered — the
    // old code always ran this near-duplicate query even on list view.
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
      .order("first_name", { ascending: true })

    if (tab === "school" && userSchool) mapQuery = mapQuery.eq("school", userSchool)
    if (personas.length > 0) mapQuery = mapQuery.in("persona", personas)
    if (schoolFilter) mapQuery = mapQuery.or(`school.ilike.%${schoolFilter}%,affiliation.ilike.%${schoolFilter}%`)
    if (fieldFilter) mapQuery = mapQuery.ilike("field", `%${fieldFilter}%`)
    if (tagFilter.length > 0) mapQuery = mapQuery.overlaps("interest_tags", tagFilter)

    const { data: mapRows } = await mapQuery
    const filteredMapRows = ((mapRows ?? []) as DirectoryMapMember[]).filter((member) =>
      memberMatchesDirectorySearch(member, q),
    )
    const contactMap = await getContactMapForMembers(supabase, filteredMapRows.map((r) => r.id))
    const cityMap = new Map<string, DirectoryMapCity>()

    for (const row of filteredMapRows) {
      if (!row.city || row.city_lat == null || row.city_lng == null) continue

      const lat = Number(row.city_lat)
      const lng = Number(row.city_lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

      const member = {
        ...row,
        city_lat: lat,
        city_lng: lng,
        contact: contactMap.get(row.id) ?? null,
      }
      const displayState = resolveDirectoryMapState(member)

      const id = [
        row.city.trim().toLowerCase(),
        row.country?.trim().toLowerCase() ?? "",
        lat.toFixed(2),
        lng.toFixed(2),
      ].join(":")

      const existing = cityMap.get(id)
      if (existing) {
        existing.members.push({ ...member, state: existing.state })
        existing.memberCount += 1
      } else {
        cityMap.set(id, {
          id,
          city: row.city,
          state: displayState,
          country: row.country,
          lat,
          lng,
          memberCount: 1,
          members: [{ ...member, state: displayState }],
        })
      }
    }

    mapCities = [...cityMap.values()].sort((a, b) => b.memberCount - a.memberCount)
  } else {
    // Free-text search needs the full filtered set to fuzzy-match against
    // (accent-insensitive, reversed-name, multi-term — see lib/directory/search.ts),
    // so only the plain "just browsing" case gets capped.
    let query = buildDirectoryProfilesQuery(supabase, filters)
    if (!q) query = query.range(0, DIRECTORY_PAGE_SIZE - 1)

    const { data: members, count } = await query
    const filteredMembers = ((members ?? []) as DirectoryMember[]).filter((member) =>
      memberMatchesDirectorySearch(member, q),
    )
    membersWithContacts = await attachContacts(supabase, filteredMembers)
    hasMore = !q && (count ?? 0) > DIRECTORY_PAGE_SIZE
  }

  let showSchoolTab = false
  if (userSchool) {
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("school", userSchool)
      .eq("is_discoverable", true)
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
  for (const c of connRows ?? []) {
    const otherId = c.requester_id === user.id ? c.addressee_id : c.requester_id
    connectionMap[otherId] = {
      status: c.status as ConnectionEntry["status"],
      amRequester: c.requester_id === user.id,
    }
  }

  const currentParams: DirectoryParams = {
    q,
    personas,
    school: schoolFilter,
    field: fieldFilter,
    tab,
    tags: tagFilter,
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-10">
      <DirectoryClient
        members={membersWithContacts}
        hasMore={hasMore}
        mapCities={mapCities}
        showSchoolTab={showSchoolTab}
        currentParams={currentParams}
        schools={schools}
        availableTags={availableTags}
        connectionMap={connectionMap}
        currentUserId={user.id}
        pendingRequestCount={pendingRequestCount ?? 0}
      />
    </div>
  )
}
