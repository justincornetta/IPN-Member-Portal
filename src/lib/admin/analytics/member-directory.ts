import "server-only"

import type {
  MemberDirectoryData,
  MemberDirectoryDetail,
  MemberDirectoryRow,
  MemberDirectorySources,
} from "./member-directory-types"

export type PortalDirectoryProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  persona?: string | null
  affiliation?: string | null
  school?: string | null
  field: string | null
  interest_tags: string[] | null
  country: string | null
  state?: string | null
  city?: string | null
  city_lat?: number | null
  city_lng?: number | null
  is_discoverable: boolean | null
  whatsapp_url: string | null
  linkedin_url?: string | null
  bio?: string | null
  psychedelic_field_status?: string | null
  psychedelic_field_barriers?: string[] | null
  role_and_goals?: string | null
  inspiration?: string | null
  referral_source?: string | null
  mailchimp_status?: string | null
  created_at: string | null
}

export type LegacyMemberSotRow = {
  id: string
  import_id: string | null
  legacy_person_id: string | null
  normalized_email: string
  original_email: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  affiliation: string | null
  country: string | null
  state: string | null
  city: string | null
  self_description: string | null
  primary_field: string | null
  psychedelic_field_status: string | null
  psychedelic_field_barriers: string | null
  current_role_and_goals: string | null
  ipn_inspiration: string | null
  referral_source: string | null
  channels_present: string | null
  channel_count: number | null
  in_form: boolean
  in_mailchimp: boolean
  in_eventbrite: boolean
  in_zoom: boolean
  in_oldapp: boolean
  in_drive_historical: boolean
  first_seen_at: string | null
  last_seen_at: string | null
  mailchimp_id: string | null
  mailchimp_audiences: string | null
  mailchimp_status: string | null
  eventbrite_event_count: number | null
  eventbrite_last_event_date: string | null
  zoom_registrations: number | null
  zoom_attended: number | null
  zoom_last_event_date: string | null
  zoom_total_minutes: number | null
  zoom_attendance_status: string | null
  oldapp_user_id: string | null
  date_of_birth: string | null
  gender: string | null
  race: string | null
  oldapp_signup_location: string | null
  engagement_status: string | null
  notes: string | null
  raw_legacy: Record<string, unknown> | null
  imported_at: string | null
}

export type LegacyMemberSotImportRow = {
  created_at: string | null
  source_pulled_at: string | null
  imported_row_count: number | null
  metadata?: Record<string, unknown> | null
}

const SOURCE_LABELS: { id: keyof MemberDirectorySources; label: string }[] = [
  { id: "portal", label: "Member Portal" },
  { id: "form", label: "Google Form" },
  { id: "mailchimp", label: "Mailchimp" },
  { id: "oldapp", label: "IPN App" },
]

export function normalizeMemberEmail(value: string | null | undefined) {
  const raw = String(value || "").trim().toLowerCase()
  if (!raw || !raw.includes("@")) return ""
  const [localPart, domain] = raw.split("@")
  if (!domain) return raw
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${localPart.split("+")[0].replaceAll(".", "")}@gmail.com`
  }
  return raw
}

function text(value: string | number | null | undefined) {
  const trimmed = String(value ?? "").trim()
  return trimmed || ""
}

function firstText(...values: (string | number | null | undefined)[]) {
  for (const value of values) {
    const cleaned = text(value)
    if (cleaned) return cleaned
  }
  return ""
}

function portalName(profile: PortalDirectoryProfileRow | null | undefined) {
  return [profile?.first_name, profile?.last_name].map(text).filter(Boolean).join(" ")
}

function legacyName(row: LegacyMemberSotRow | null | undefined) {
  return firstText(row?.full_name, [row?.first_name, row?.last_name].map(text).filter(Boolean).join(" "))
}

function location(country: string, state: string, city: string) {
  return [city, state, country].filter(Boolean).join(", ")
}

function parseDateWithSource(source: string, value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return { source, iso: date.toISOString(), time: date.getTime() }
}

function earliestDateWithSource(...values: { source: string; value: string | null | undefined }[]) {
  const dates = values
    .map(({ source, value }) => parseDateWithSource(source, value))
    .filter((date): date is { source: string; iso: string; time: number } => Boolean(date))
    .sort((a, b) => a.time - b.time)
  return dates[0] ?? null
}

function countSources(sources: MemberDirectorySources) {
  return Object.values(sources).filter(Boolean).length
}

function sourceLabelList(sources: MemberDirectorySources) {
  return SOURCE_LABELS.filter((source) => sources[source.id]).map((source) => source.label)
}

function buildSources(profile: PortalDirectoryProfileRow | null, legacy: LegacyMemberSotRow | null): MemberDirectorySources {
  return {
    portal: Boolean(profile),
    form: Boolean(legacy?.in_form),
    mailchimp: Boolean(legacy?.in_mailchimp || profile?.mailchimp_status && profile.mailchimp_status !== "unknown"),
    oldapp: Boolean(legacy?.in_oldapp),
  }
}

function splitMultiValue(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean)
  return text(value)
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function firstSeenConfidence(legacy: LegacyMemberSotRow | null, selectedSource: string) {
  if (!legacy?.in_mailchimp || legacy.in_form || legacy.in_oldapp || selectedSource === "Portal" || selectedSource === "IPN App") {
    return "high" as const
  }
  const firstSeen = legacy.first_seen_at ? new Date(legacy.first_seen_at) : null
  if (firstSeen && firstSeen >= new Date("2026-05-01T00:00:00Z") && firstSeen < new Date("2026-06-01T00:00:00Z")) {
    return "low" as const
  }
  return "high" as const
}

export function mergeMemberDirectoryRow(
  profile: PortalDirectoryProfileRow | null,
  legacy: LegacyMemberSotRow | null,
): MemberDirectoryRow | null {
  const normalizedEmail = normalizeMemberEmail(profile?.email) || legacy?.normalized_email || normalizeMemberEmail(legacy?.original_email)
  if (!normalizedEmail) return null

  const sources = buildSources(profile, legacy)
  const country = firstText(profile?.country, legacy?.country)
  const state = firstText(profile?.state, legacy?.state)
  const city = firstText(profile?.city, legacy?.city)
  const mailchimpStatus = firstText(profile?.mailchimp_status, legacy?.mailchimp_status, "unknown")
  const eventCount = Math.max(0, Number(legacy?.zoom_attended ?? 0)) + Math.max(0, Number(legacy?.eventbrite_event_count ?? 0))
  const firstSeen = earliestDateWithSource(
    { source: "IPN App", value: legacy?.in_oldapp ? legacy?.first_seen_at : null },
    { source: "Google Form/Mailchimp", value: legacy?.first_seen_at },
    { source: "Portal", value: profile?.created_at },
  )
  const persona = firstText(profile?.persona, legacy?.self_description)
  const primaryField = firstText(profile?.field, legacy?.primary_field, "-")
  const psychedelicFieldStatus = firstText(profile?.psychedelic_field_status, legacy?.psychedelic_field_status)
  const referralSource = firstText(profile?.referral_source, legacy?.referral_source)
  const school = firstText(profile?.school, legacy?.affiliation)

  return {
    id: normalizedEmail,
    normalizedEmail,
    portalId: profile?.id ?? null,
    legacyId: legacy?.id ?? null,
    name: firstText(portalName(profile), legacyName(legacy), profile?.email, legacy?.original_email, normalizedEmail),
    email: firstText(profile?.email, legacy?.original_email, normalizedEmail),
    location: location(country, state, city) || "-",
    country,
    state,
    city,
    persona,
    selfDescription: firstText(legacy?.self_description, profile?.persona),
    primaryField,
    psychedelicFieldStatus,
    psychedelicFieldBarriers: splitMultiValue(profile?.psychedelic_field_barriers?.length ? profile.psychedelic_field_barriers : legacy?.psychedelic_field_barriers),
    referralSource,
    school,
    interestTags: profile?.interest_tags ?? [],
    firstSeenAt: firstSeen?.iso ?? null,
    firstSeenSource: firstSeen?.source ?? "",
    firstSeenConfidence: firstSeenConfidence(legacy, firstSeen?.source ?? ""),
    sources,
    sourceCount: countSources(sources),
    channelsPresent: sourceLabelList(sources).join(", "),
    whatsappConnected: Boolean(profile?.whatsapp_url?.trim()),
    portalDiscoverable: profile?.is_discoverable ?? null,
    portalInterestTagCount: profile?.interest_tags?.length ?? 0,
    mailchimpStatus,
    eventCount,
    engagementStatus: firstText(legacy?.engagement_status, profile ? "active" : ""),
  }
}

function increment(counts: Map<string, number>, label: string | null | undefined, amount = 1) {
  const cleaned = text(label)
  if (!cleaned || cleaned === "-") return
  counts.set(cleaned, (counts.get(cleaned) ?? 0) + amount)
}

function incrementMany(counts: Map<string, number>, values: (string | null | undefined)[], amount = 1) {
  for (const value of values) increment(counts, value, amount)
}

function topItems(counts: Map<string, number>, limit = 12) {
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit)
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function demographicItems(metadata: Record<string, unknown>, key: string) {
  const oldapp = metadataRecord(metadata.oldapp_demographics)
  const bucket = metadataRecord(oldapp[key])
  return Object.entries(bucket)
    .map(([label, value]) => ({ label, value: Number(value) || 0 }))
    .filter((item) => item.label && item.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

function buildChartData(rows: MemberDirectoryRow[], latestImport: LegacyMemberSotImportRow | null): MemberDirectoryData["chartData"] {
  const stage = new Map<string, number>()
  const field = new Map<string, number>()
  const tags = new Map<string, number>()
  const schools = new Map<string, number>()
  const describes = new Map<string, number>()
  const primary = new Map<string, number>()
  const referrals = new Map<string, number>()
  const psychedelic = new Map<string, number>()
  const barriers = new Map<string, number>()

  for (const row of rows) {
    increment(stage, row.persona)
    increment(field, row.primaryField)
    incrementMany(tags, row.interestTags)
    increment(schools, row.school)
    increment(describes, row.persona || row.selfDescription)
    increment(primary, row.primaryField)
    increment(referrals, row.referralSource)
    increment(psychedelic, row.psychedelicFieldStatus)
    incrementMany(barriers, row.psychedelicFieldBarriers)
  }

  const metadata = metadataRecord(latestImport?.metadata)
  return {
    stageBreakdown: topItems(stage),
    fieldBreakdown: topItems(field),
    topInterestTags: topItems(tags, 500),
    topSchools: topItems(schools, 10),
    bestDescribes: topItems(describes),
    primaryField: topItems(primary),
    referralSources: topItems(referrals),
    psychedelicFieldStatus: topItems(psychedelic),
    psychedelicFieldBarriers: topItems(barriers),
    gender: demographicItems(metadata, "gender"),
    age: demographicItems(metadata, "age_bucket"),
    raceEthnicity: demographicItems(metadata, "race"),
  }
}

function normalizeLocationKey(city: string, state: string, country: string) {
  return [city, state, country].map((part) => part.trim().toLowerCase()).join("|")
}

function buildGeography(rows: MemberDirectoryRow[], profilesByEmail: Map<string, PortalDirectoryProfileRow>): MemberDirectoryData["geography"] {
  const coordsByLocation = new Map<string, { lat: number; lng: number }>()
  for (const profile of profilesByEmail.values()) {
    const city = text(profile.city)
    const country = text(profile.country)
    if (!city || !country || profile.city_lat == null || profile.city_lng == null) continue
    const lat = Number(profile.city_lat)
    const lng = Number(profile.city_lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    coordsByLocation.set(normalizeLocationKey(city, text(profile.state), country), { lat, lng })
  }

  const groups = new Map<string, MemberDirectoryData["geography"][number]>()
  for (const row of rows) {
    if (!row.city || !row.country) continue
    const key = normalizeLocationKey(row.city, row.state, row.country)
    const coords = coordsByLocation.get(key) ?? null
    const current = groups.get(key) ?? {
      id: key,
      city: row.city,
      state: row.state,
      country: row.country,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      memberCount: 0,
      identifiableCount: 0,
      sourceCounts: SOURCE_LABELS.map((source) => ({ ...source, value: 0 })),
      members: [],
    }
    current.memberCount += 1
    if (row.name && row.email) {
      current.identifiableCount += 1
      current.members.push({
        id: row.id,
        name: row.name,
        email: row.email,
        sources: row.sources,
      })
    }
    for (const source of current.sourceCounts) {
      if (row.sources[source.id]) source.value += 1
    }
    groups.set(key, current)
  }

  return Array.from(groups.values()).sort((a, b) => b.memberCount - a.memberCount || a.city.localeCompare(b.city))
}

export function buildMemberDirectoryData({
  profiles,
  legacyRows,
  latestImport,
}: {
  profiles: PortalDirectoryProfileRow[]
  legacyRows: LegacyMemberSotRow[]
  latestImport: LegacyMemberSotImportRow | null
}): MemberDirectoryData {
  const profilesByEmail = new Map<string, PortalDirectoryProfileRow>()
  for (const profile of profiles) {
    const email = normalizeMemberEmail(profile.email)
    if (email) profilesByEmail.set(email, profile)
  }

  const legacyByEmail = new Map<string, LegacyMemberSotRow>()
  for (const row of legacyRows) {
    if (row.normalized_email) legacyByEmail.set(row.normalized_email, row)
  }

  const emails = new Set([...profilesByEmail.keys(), ...legacyByEmail.keys()])
  const rows = Array.from(emails)
    .map((email) => mergeMemberDirectoryRow(profilesByEmail.get(email) ?? null, legacyByEmail.get(email) ?? null))
    .filter((row): row is MemberDirectoryRow => Boolean(row))
    .sort((a, b) => {
      const aTime = a.firstSeenAt ? new Date(a.firstSeenAt).getTime() : 0
      const bTime = b.firstSeenAt ? new Date(b.firstSeenAt).getTime() : 0
      return bTime - aTime || a.name.localeCompare(b.name)
    })

  const importMetadata = metadataRecord(latestImport?.metadata)
  const oldappTotal = Number(importMetadata.oldapp_total)
  const sourceTotals = SOURCE_LABELS.map((source) => ({
    ...source,
    value: source.id === "oldapp" && Number.isFinite(oldappTotal) && oldappTotal > 0
      ? oldappTotal
      : rows.filter((row) => row.sources[source.id]).length,
  }))

  return {
    generatedAt: new Date().toISOString(),
    importFreshness: {
      importedAt: latestImport?.created_at ?? null,
      sourcePulledAt: latestImport?.source_pulled_at ?? null,
      rowCount: latestImport?.imported_row_count ?? legacyRows.length,
    },
    rows,
    sourceTotals,
    chartData: buildChartData(rows, latestImport),
    geography: buildGeography(rows, profilesByEmail),
    whatsapp: {
      connected: rows.filter((row) => row.whatsappConnected).length,
      totalPortalMembers: rows.filter((row) => row.sources.portal).length,
    },
  }
}

export function mergeMemberDirectoryDetail(
  profile: PortalDirectoryProfileRow | null,
  legacy: LegacyMemberSotRow | null,
): MemberDirectoryDetail | null {
  const row = mergeMemberDirectoryRow(profile, legacy)
  if (!row) return null

  return {
    ...row,
    portal: {
      id: profile?.id ?? null,
      firstName: text(profile?.first_name),
      lastName: text(profile?.last_name),
      email: text(profile?.email),
      discoverable: profile?.is_discoverable ?? null,
      persona: text(profile?.persona),
      affiliation: text(profile?.affiliation),
      school: text(profile?.school),
      field: text(profile?.field),
      psychedelicFieldStatus: text(profile?.psychedelic_field_status),
      psychedelicFieldBarriers: profile?.psychedelic_field_barriers ?? [],
      roleAndGoals: text(profile?.role_and_goals),
      inspiration: text(profile?.inspiration),
      referralSource: text(profile?.referral_source),
      country: text(profile?.country),
      state: text(profile?.state),
      city: text(profile?.city),
      whatsappUrl: text(profile?.whatsapp_url),
      linkedinUrl: text(profile?.linkedin_url),
      bio: text(profile?.bio),
      interestTags: profile?.interest_tags ?? [],
      createdAt: profile?.created_at ?? null,
      mailchimpStatus: text(profile?.mailchimp_status),
    },
    legacy: {
      personId: text(legacy?.legacy_person_id),
      firstName: text(legacy?.first_name),
      lastName: text(legacy?.last_name),
      fullName: text(legacy?.full_name),
      email: text(legacy?.normalized_email),
      originalEmail: text(legacy?.original_email),
      affiliation: text(legacy?.affiliation),
      country: text(legacy?.country),
      state: text(legacy?.state),
      city: text(legacy?.city),
      selfDescription: text(legacy?.self_description),
      primaryField: text(legacy?.primary_field),
      psychedelicFieldStatus: text(legacy?.psychedelic_field_status),
      psychedelicFieldBarriers: text(legacy?.psychedelic_field_barriers),
      currentRoleAndGoals: text(legacy?.current_role_and_goals),
      ipnInspiration: text(legacy?.ipn_inspiration),
      referralSource: text(legacy?.referral_source),
      channelsPresent: text(legacy?.channels_present),
      channelCount: Number(legacy?.channel_count ?? 0),
      engagementStatus: text(legacy?.engagement_status),
      firstSeenAt: legacy?.first_seen_at ?? null,
      lastSeenAt: legacy?.last_seen_at ?? null,
      mailchimpId: text(legacy?.mailchimp_id),
      mailchimpAudiences: text(legacy?.mailchimp_audiences),
      mailchimpStatus: text(legacy?.mailchimp_status),
      zoomRegistrations: Number(legacy?.zoom_registrations ?? 0),
      zoomAttended: Number(legacy?.zoom_attended ?? 0),
      zoomTotalMinutes: Number(legacy?.zoom_total_minutes ?? 0),
      zoomLastEventDate: text(legacy?.zoom_last_event_date),
      zoomAttendanceStatus: text(legacy?.zoom_attendance_status),
      eventbriteEventCount: Number(legacy?.eventbrite_event_count ?? 0),
      eventbriteLastEventDate: text(legacy?.eventbrite_last_event_date),
      notes: text(legacy?.notes),
    },
    sensitive: {
      oldappUserId: text(legacy?.oldapp_user_id),
      dateOfBirth: text(legacy?.date_of_birth),
      gender: text(legacy?.gender),
      race: text(legacy?.race),
      oldappSignupLocation: text(legacy?.oldapp_signup_location),
    },
  }
}
