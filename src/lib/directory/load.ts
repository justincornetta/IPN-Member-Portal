import { DataReadError } from "../data-read-error.ts"
import type { createClient } from "@/lib/supabase/server"
import type { ConnectionRow } from "@/app/dashboard/directory/RequestsPanel"
import type { ConnectionEntry, DirectoryMapCity, DirectoryMapMember, DirectoryMember, DirectoryParams } from "./types"
import { normalizeInstitutionName } from "../members/education.ts"
import { resolveDirectoryMapState } from "./location.ts"
import { memberMatchesDirectorySearch } from "./search.ts"
import { directoryCityKey, summarizeDirectory, type DirectoryLocation } from "./summary.ts"
import { readRows } from "./read-rows.ts"
import { buildDirectoryProfilesQuery, DIRECTORY_MEMBER_SELECT, DIRECTORY_PAGE_SIZE, getContactMapForMembers, getEducationMapForMembers } from "./queries.ts"

type Client = Awaited<ReturnType<typeof createClient>>
type SearchParams = Record<string, string | string[] | undefined>
const value = (input: string | string[] | undefined) => typeof input === "string" ? input.trim() : ""
const values = (input: string | string[] | undefined) => Array.isArray(input) ? input : input ? [input] : []

/** Per-request only: all reads retain the signed-in user's RLS context. */
export async function loadDirectory(supabase: Client, userId: string, params: SearchParams) {
  const q = value(params.q), school = value(params.school), field = value(params.field)
  const personas = values(params.persona), tags = values(params.tag)
  const isConnections = params.tab === "connections"
  const isMap = params.view === "map" || params.view === "globe"
  const needsFullSet = isMap || Boolean(q || school) || params.tab === "school"
  const filters = { tab: "all", userSchool: null, school: "", field, personas, tags }
  const profilesQuery = () => buildDirectoryProfilesQuery(supabase, filters)

  // Independent metadata no longer waits behind member enrichment. Reuse the
  // connection rows for the pending badge instead of making a separate count.
  const [profileResult, educationResult, visibleEducation, metadata, connRows, candidates, locations, joinedRows] = await Promise.all([
    supabase.from("profiles").select("school").eq("id", userId).single(),
    supabase.from("member_education").select("institution").eq("user_id", userId).order("sort_order"),
    readRows((from, to) => supabase.from("member_education").select("id, user_id, institution").order("id").range(from, to)),
    isConnections ? Promise.resolve([]) : readRows((from, to) => supabase.from("profiles")
      .select("id, school, interest_tags").eq("is_discoverable", true).order("id").range(from, to)),
    readRows((from, to) => supabase.from("connections").select("id, requester_id, addressee_id, status")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`).order("id").range(from, to)),
    isConnections ? Promise.resolve([] as DirectoryMember[]) : needsFullSet
      ? readRows<DirectoryMember>((from, to) => profilesQuery().range(from, to))
      : (async () => {
        const result = await profilesQuery().range(0, DIRECTORY_PAGE_SIZE - 1)
        if (result.error || !result.data) throw new DataReadError("Directory data could not be loaded")
        return result.data as DirectoryMember[]
      })(),
    // Full-result geography needs only this small projection on paginated lists.
    // Search and map already have every candidate and reuse that data instead.
    isConnections || needsFullSet ? Promise.resolve([] as DirectoryLocation[])
      : readRows<DirectoryLocation>((from, to) => profilesQuery()
        .select("id, city, country, city_lat, city_lng, share_location").range(from, to)),
    !isConnections ? Promise.resolve([] as ConnectionRow[]) : readRows<ConnectionRow>((from, to) => supabase.from("connections")
      .select(`id, requester_id, addressee_id, status, created_at,
        requester:profiles!connections_requester_id_fkey(${DIRECTORY_MEMBER_SELECT}),
        addressee:profiles!connections_addressee_id_fkey(${DIRECTORY_MEMBER_SELECT})`)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .order("created_at", { ascending: false }).order("id").range(from, to) as unknown as PromiseLike<{ data: ConnectionRow[] | null; error: { message: string } | null }>),
  ])
  if (profileResult.error || educationResult.error) throw new DataReadError("Directory data could not be loaded")
  const schoolsByName = new Map<string, string>()
  for (const name of [...(educationResult.data ?? []).map(row => row.institution as string), profileResult.data?.school]) {
    if (name?.trim()) schoolsByName.set(normalizeInstitutionName(name), name.trim())
  }
  const sharedSchoolIds = new Set(visibleEducation
    .filter(row => schoolsByName.has(normalizeInstitutionName(row.institution)))
    .map(row => row.user_id as string))
  const tab = isConnections ? "connections" : params.tab === "school" && schoolsByName.size ? "school" : "all"
  const currentParams: DirectoryParams = { q, school, field, personas, tags, tab }
  const connectionMap: Record<string, ConnectionEntry> = {}
  for (const row of connRows) {
    connectionMap[row.requester_id === userId ? row.addressee_id : row.requester_id] = {
      status: row.status as ConnectionEntry["status"], amRequester: row.requester_id === userId,
    }
  }
  const common = {
    currentParams, currentUserId: userId, connectionMap,
    pendingRequestCount: connRows.filter(row => row.addressee_id === userId && row.status === "pending").length,
    showSchoolTab: schoolsByName.size > 0 && [...sharedSchoolIds].some(id => id !== userId),
    schools: [...new Set([...metadata.map(row => row.school as string), ...visibleEducation.map(row => row.institution as string)].filter(Boolean))].sort(),
    availableTags: [...new Set(metadata.flatMap(row => (row.interest_tags as string[]) ?? []))].sort(),
  }

  if (isConnections) {
    const rows = joinedRows.filter(row => row.requester && row.addressee)
    const ids = [...new Set(rows.flatMap(row => [row.requester.id, row.addressee.id]))]
    const [contacts, education] = await Promise.all([getContactMapForMembers(supabase, ids), getEducationMapForMembers(supabase, ids)])
    const enrich = (member: DirectoryMember) => ({ ...member, contact: contacts.get(member.id) ?? null, education: education.get(member.id) ?? [] })
    const connections = rows.map(row => ({ ...row, requester: enrich(row.requester), addressee: enrich(row.addressee) }))
    return {
      ...common, members: [], hasMore: false, mapCities: [], totalMemberCount: 0,
      connections: {
        accepted: connections.filter(row => row.status === "accepted"),
        incoming: connections.filter(row => row.status === "pending" && row.addressee_id === userId),
        outgoing: connections.filter(row => row.status === "pending" && row.requester_id === userId),
      },
    }
  }

  const ids = candidates.map(member => member.id)
  // Browsing education and contacts are independent. Search/school contacts are
  // deferred until filtering, so excluded profiles' contacts never reach props.
  const [education, earlyContacts] = await Promise.all([
    getEducationMapForMembers(supabase, ids),
    !needsFullSet ? getContactMapForMembers(supabase, ids) : Promise.resolve(null),
  ])
  const normalizedSchool = school.toLocaleLowerCase()
  const matches = candidates.map(member => ({ ...member, education: education.get(member.id) ?? [] })).filter(member => {
    if (tab === "school" && !sharedSchoolIds.has(member.id)) return false
    if (school && ![member.school, member.affiliation, ...member.education.map(entry => entry.institution)]
      .some(name => name?.toLocaleLowerCase().includes(normalizedSchool))) return false
    return memberMatchesDirectorySearch(member, q)
  })
  const directorySummary = summarizeDirectory(needsFullSet ? matches : locations)
  const visible = isMap ? matches.filter(member => directoryCityKey(member)) : matches
  const contacts = earlyContacts ?? await getContactMapForMembers(supabase, visible.map(member => member.id))
  const members = visible.map(member => ({ ...member, contact: contacts.get(member.id) ?? null }))
  const cities = new Map<string, DirectoryMapCity>()
  if (isMap) for (const row of members) {
    const id = directoryCityKey(row)!
    const member: DirectoryMapMember = { ...row, country: row.country ?? null, city_lat: Number(row.city_lat), city_lng: Number(row.city_lng) }
    const existing = cities.get(id)
    if (existing) {
      existing.members.push({ ...member, state: existing.state })
      existing.memberCount++
    } else {
      const state = resolveDirectoryMapState(member)
      cities.set(id, { id, city: row.city!.trim(), state, country: member.country,
        lat: member.city_lat, lng: member.city_lng, memberCount: 1, members: [{ ...member, state }] })
    }
  }
  return {
    ...common, directorySummary, totalMemberCount: directorySummary.totalMembers,
    members: isMap ? [] : members,
    hasMore: !needsFullSet && directorySummary.totalMembers > DIRECTORY_PAGE_SIZE,
    mapCities: [...cities.values()].sort((a, b) => b.memberCount - a.memberCount),
  }
}
