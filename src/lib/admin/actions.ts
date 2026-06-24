"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { EventSpeakerResources } from "@/lib/events/types"

export type AdminContentType =
  | "upcoming_event"
  | "past_recording"
  | "member_resource"
  | "blog_post"
  | "partner"

export type AdminContentPayload = {
  contentType: AdminContentType
  title: string
  slug?: string
  summary?: string
  description?: string
  url?: string
  imageUrl?: string
  category?: string
  startsAt?: string
  endsAt?: string
  timezone?: string
  eventType?: string
  speakers?: string
  locationLabel?: string
  locationDetails?: string
  joinUrl?: string
  chatExternalUrl?: string
  registrationUrl?: string
  registrationProvider?: string
  externalEventId?: string
  requiresVerifiedTicket?: boolean
  recordingProvider?: string
  recordingCategory?: string
  sourceId?: string
  sourceName?: string
  author?: string
  publishedAt?: string
  benefitNote?: string
  detailBody?: string
  speakerResources?: EventSpeakerResources
}

async function verifySuperadmin(): Promise<{ error: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (data?.role !== "superadmin") return { error: "Unauthorized" }
  return null
}

async function verifyAdmin(): Promise<
  { userId: string; role: string } | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (data?.role !== "superadmin" && data?.role !== "admin") {
    return { error: "Unauthorized" }
  }

  return { userId: user.id, role: data.role }
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
}

function toIso(value: string | null | undefined) {
  const trimmed = clean(value)
  if (!trimmed) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function isValidTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function parseDateTimeLocal(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  )
  if (!match) return null

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? "0"),
  }
}

function timeZoneOffsetMs(timezone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>

  const asUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  )

  return asUtc - date.getTime()
}

function toIsoInTimeZone(
  value: string | null | undefined,
  timezone: string,
): string | null {
  const trimmed = clean(value)
  if (!trimmed) return null

  if (!parseDateTimeLocal(trimmed)) return toIso(trimmed)

  const local = parseDateTimeLocal(trimmed)
  if (!local) return null

  let utcMs = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  )

  utcMs -= timeZoneOffsetMs(timezone, new Date(utcMs))
  utcMs =
    Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    ) - timeZoneOffsetMs(timezone, new Date(utcMs))

  const date = new Date(utcMs)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function youtubeId(url: string | null) {
  if (!url) return null
  return (
    url.match(/[?&]v=([^&]+)/)?.[1] ??
    url.match(/youtu\.be\/([^?&]+)/)?.[1] ??
    url.match(/youtube\.com\/embed\/([^?&]+)/)?.[1] ??
    null
  )
}

function youtubeThumbnailUrl(videoId: string | null) {
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null
}

async function canPublishContent(
  userId: string,
  role: string,
  contentType: AdminContentType,
) {
  if (role === "superadmin") return true

  const admin = createAdminClient()

  // Check team-level permissions first
  const { data: profile } = await admin
    .from("profiles")
    .select("team")
    .eq("id", userId)
    .single()

  const team = (profile as { team?: string | null } | null)?.team

  if (team) {
    const { data: teamPerms } = await admin
      .from("team_content_permissions")
      .select("content_type, can_publish")
      .eq("team", team)

    // Only block when there is an explicit can_publish = false row
    const blocked = (teamPerms ?? []).some(
      (row) =>
        (row as { content_type: string; can_publish: boolean }).content_type === contentType &&
        !(row as { content_type: string; can_publish: boolean }).can_publish,
    )
    return !blocked
  }

  // Fall back to legacy per-user permissions for users without a team
  const { data } = await admin
    .from("admin_content_permissions")
    .select("content_type, can_publish")
    .eq("profile_id", userId)

  if (!data?.length) return true
  return data.some(
    (row) =>
      (row as { content_type?: string; can_publish?: boolean }).content_type ===
        contentType &&
      (row as { can_publish?: boolean }).can_publish,
  )
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
  whatsapp_url?: string | null
  is_banned?: boolean | null
}

export type AdminMemberDetail = AdminMemberProfile & {
  whatsapp_url: string | null
  linkedin_url: string | null
  country: string | null
  state: string | null
  city: string | null
  field: string | null
  psychedelic_field_status: string | null
  affiliation: string | null
  school: string | null
  interest_tags: string[] | null
  role_and_goals: string | null
}

const MEMBER_PROFILE_SELECT = "id, first_name, last_name, email, avatar_url, role, admin_role, team, persona, bio, whatsapp_url, is_banned"

export async function searchMembersForAdmin(query: string): Promise<AdminMemberProfile[]> {
  const authError = await verifySuperadmin()
  if (authError) return []

  const q = query.trim()
  if (!q) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from("profiles")
    .select(MEMBER_PROFILE_SELECT)
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
    .limit(10)

  return (data ?? []) as AdminMemberProfile[]
}

export async function getMemberDetail(userId: string): Promise<AdminMemberDetail | null> {
  const auth = await verifyAdmin()
  if ("error" in auth) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from("profiles")
    .select("id, first_name, last_name, email, avatar_url, role, admin_role, team, persona, bio, whatsapp_url, linkedin_url, country, state, city, field, psychedelic_field_status, affiliation, school, interest_tags, role_and_goals, is_banned")
    .eq("id", userId)
    .single()
  return (data as AdminMemberDetail | null)
}

export async function listBannedMembers(): Promise<AdminMemberProfile[]> {
  const authError = await verifySuperadmin()
  if (authError) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from("profiles")
    .select(MEMBER_PROFILE_SELECT)
    .eq("is_banned", true)
    .order("first_name", { ascending: true })
    .limit(200)
  return (data ?? []) as AdminMemberProfile[]
}

export async function banMember(userId: string): Promise<{ error?: string }> {
  const authError = await verifySuperadmin()
  if (authError) return authError
  const admin = createAdminClient()
  const { error: authBanError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "876000h",
  })
  if (authBanError) return { error: authBanError.message }
  await admin.from("profiles").update({ is_banned: true }).eq("id", userId)
  revalidatePath("/dashboard/admin")
  return {}
}

export async function unbanMember(userId: string): Promise<{ error?: string }> {
  const authError = await verifySuperadmin()
  if (authError) return authError
  const admin = createAdminClient()
  const { error: authUnbanError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  })
  if (authUnbanError) return { error: authUnbanError.message }
  await admin.from("profiles").update({ is_banned: false }).eq("id", userId)
  revalidatePath("/dashboard/admin")
  return {}
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

export async function publishAdminContent(
  payload: AdminContentPayload,
): Promise<{ error?: string; slug?: string }> {
  const auth = await verifyAdmin()
  if ("error" in auth) return auth

  const title = clean(payload.title)
  if (!title) return { error: "Title is required" }

  const allowed = await canPublishContent(auth.userId, auth.role, payload.contentType)
  if (!allowed) return { error: "You do not have access to publish this content type" }

  const admin = createAdminClient()
  const slug = clean(payload.slug) ?? slugify(title)
  const now = new Date().toISOString()
  const imageUrl = clean(payload.imageUrl)
  const description = clean(payload.description) ?? clean(payload.summary)
  const summary = clean(payload.summary) ?? description

  if (payload.contentType === "upcoming_event" || payload.contentType === "past_recording") {
    const recordingUrl = clean(payload.url)
    const sourceId = clean(payload.sourceId) ?? youtubeId(recordingUrl)
    const isRecording = payload.contentType === "past_recording"
    const timezone = clean(payload.timezone) ?? "America/New_York"
    if (!isValidTimeZone(timezone)) return { error: "Timezone is invalid" }

    const startsAt =
      toIsoInTimeZone(payload.startsAt, timezone) ??
      toIsoInTimeZone(payload.publishedAt, timezone) ??
      (isRecording ? now : null)
    const endsAt = toIsoInTimeZone(payload.endsAt, timezone)
    const chatExternalUrl = isRecording ? null : clean(payload.chatExternalUrl)

    if (!startsAt) return { error: "Start date is required" }
    if (payload.endsAt && !endsAt) return { error: "End date is invalid" }

    const eventPayload = {
      slug,
      title,
      event_type: clean(payload.eventType) ?? (isRecording ? "PsychedelX" : "IPN Labs"),
      starts_at: startsAt,
      ends_at: endsAt,
      timezone,
      summary,
      description,
      speakers: clean(payload.speakers),
      location_label: clean(payload.locationLabel) ?? (isRecording ? "YouTube" : "Online"),
      location_details: clean(payload.locationDetails),
      join_url: isRecording ? null : clean(payload.joinUrl),
      chat_platform: chatExternalUrl ? "whatsapp" : null,
      chat_external_url: chatExternalUrl,
      chat_status: chatExternalUrl ? "active" : "draft",
      thumbnail_url: imageUrl ?? (isRecording ? youtubeThumbnailUrl(sourceId) : null),
      registration_url: isRecording ? null : clean(payload.registrationUrl),
      registration_provider: isRecording ? null : clean(payload.registrationProvider),
      external_event_id: isRecording ? null : clean(payload.externalEventId),
      requires_verified_ticket: isRecording ? false : Boolean(payload.requiresVerifiedTicket),
      is_recording: isRecording,
      recording_url: isRecording ? recordingUrl : null,
      recording_provider: isRecording ? clean(payload.recordingProvider) ?? "YouTube" : null,
      recording_category: isRecording ? clean(payload.recordingCategory) : null,
      recording_source_id: isRecording ? sourceId : null,
      recording_published_at: isRecording ? startsAt : null,
      speaker_resources: !isRecording && payload.speakerResources
        ? payload.speakerResources
        : null,
      status: "published",
    }

    const { error } = await admin
      .from("events")
      .upsert(eventPayload, { onConflict: "slug" })
    if (error) return { error: error.message }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/events")
    revalidatePath(`/dashboard/events/${slug}`)
    return { slug }
  }

  const url = clean(payload.url)
  if (!url) return { error: "URL is required" }

  const resourceType =
    payload.contentType === "blog_post"
      ? "blog_post"
      : payload.contentType === "partner"
        ? "partner"
        : "affiliate_benefit"

  const resourcePayload = {
    slug,
    resource_type: resourceType,
    title,
    description,
    url,
    category:
      clean(payload.category) ??
      (resourceType === "blog_post"
        ? "IPN Blog"
        : resourceType === "partner"
          ? "Partner"
          : "Member benefits"),
    image_url: imageUrl,
    image_alt: imageUrl ? `${title} image` : null,
    thumbnail_url: imageUrl,
    benefit_note: resourceType === "affiliate_benefit" ? clean(payload.benefitNote) : null,
    detail_body: clean(payload.detailBody),
    author: clean(payload.author),
    published_at: toIso(payload.publishedAt) ?? now,
    source_id: clean(payload.sourceId) ?? (resourceType === "blog_post" ? url : null),
    source_name:
      clean(payload.sourceName) ?? (resourceType === "blog_post" ? "IPN Blog" : null),
    status: "published",
  }

  const { error } = await admin
    .from("resources")
    .upsert(resourcePayload, { onConflict: "slug" })
  if (error) return { error: error.message }

  revalidatePath("/dashboard/resources")
  revalidatePath(`/dashboard/resources/${slug}`)
  return { slug }
}

export type AdminEventSummary = {
  id: string
  slug: string
  title: string
  event_type: string
  starts_at: string
  ends_at: string | null
  timezone: string
  summary: string | null
  description: string | null
  speakers: string | null
  location_label: string | null
  location_details: string | null
  join_url: string | null
  chat_platform: string | null
  chat_external_url: string | null
  chat_status: string | null
  thumbnail_url: string | null
  registration_url: string | null
  registration_provider: string | null
  external_event_id: string | null
  requires_verified_ticket: boolean
  is_recording: boolean
  recording_url: string | null
  recording_provider: string | null
  recording_category: string | null
  recording_published_at: string | null
  speaker_resources: EventSpeakerResources | null
  status: string
}

export type AdminResourceSummary = {
  id: string
  slug: string
  title: string
  resource_type: string
  description: string | null
  url: string
  category: string | null
  image_url: string | null
  detail_body: string | null
  author: string | null
  benefit_note: string | null
  published_at: string | null
  status: string
}

export async function listAdminEvents(): Promise<AdminEventSummary[]> {
  const auth = await verifyAdmin()
  if ("error" in auth) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from("events")
    .select("id, slug, title, event_type, starts_at, ends_at, timezone, summary, description, speakers, location_label, location_details, join_url, chat_platform, chat_external_url, chat_status, thumbnail_url, registration_url, registration_provider, external_event_id, requires_verified_ticket, is_recording, recording_url, recording_provider, recording_category, recording_published_at, speaker_resources, status")
    .order("starts_at", { ascending: true })
    .limit(200)
  return (data ?? []) as AdminEventSummary[]
}

export async function listAdminResources(): Promise<AdminResourceSummary[]> {
  const auth = await verifyAdmin()
  if ("error" in auth) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from("resources")
    .select("id, slug, title, resource_type, description, url, category, image_url, detail_body, author, benefit_note, published_at, status")
    .order("published_at", { ascending: false })
    .limit(200)
  return (data ?? []) as AdminResourceSummary[]
}

export async function deleteAdminContent(
  id: string,
  table: "events" | "resources",
): Promise<{ error?: string }> {
  const auth = await verifyAdmin()
  if ("error" in auth) return auth
  const admin = createAdminClient()
  const { error } = await admin.from(table).delete().eq("id", id)
  if (error) return { error: error.message }
  if (table === "events") {
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/events")
  } else {
    revalidatePath("/dashboard/resources")
  }
  return {}
}

export async function promoteToRecording(
  id: string,
  recordingUrl: string,
): Promise<{ error?: string }> {
  const auth = await verifyAdmin()
  if ("error" in auth) return auth

  const admin = createAdminClient()
  const trimmedUrl = recordingUrl.trim()

  const sourceId =
    trimmedUrl.match(/[?&]v=([^&]+)/)?.[1] ??
    trimmedUrl.match(/youtu\.be\/([^?]+)/)?.[1] ??
    null
  const provider = sourceId ? "YouTube" : "Other"

  const { error } = await admin
    .from("events")
    .update({
      is_recording: true,
      status: "published",
      recording_url: trimmedUrl,
      recording_provider: provider,
      recording_source_id: sourceId,
      recording_published_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("is_recording", false)
    .eq("status", "ended")

  if (error) return { error: error.message }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/events")
  return {}
}

export type TeamPermissionsMap = Partial<Record<string, Partial<Record<AdminContentType, boolean>>>>

export async function getTeamPermissions(): Promise<TeamPermissionsMap> {
  const authError = await verifySuperadmin()
  if (authError) return {}

  const admin = createAdminClient()
  const { data } = await admin
    .from("team_content_permissions")
    .select("team, content_type, can_publish")

  const result: TeamPermissionsMap = {}
  for (const row of (data ?? []) as { team: string; content_type: AdminContentType; can_publish: boolean }[]) {
    if (!result[row.team]) result[row.team] = {}
    result[row.team]![row.content_type] = row.can_publish
  }
  return result
}

export async function setTeamPermission(
  team: string,
  contentType: AdminContentType,
  canPublish: boolean,
): Promise<{ error?: string }> {
  const authError = await verifySuperadmin()
  if (authError) return authError

  const admin = createAdminClient()
  const { error } = await admin
    .from("team_content_permissions")
    .upsert(
      { team, content_type: contentType, can_publish: canPublish, updated_at: new Date().toISOString() },
      { onConflict: "team,content_type" },
    )

  if (error) return { error: error.message }
  return {}
}

export type FeedbackSubmission = {
  id: string
  user_id: string | null
  user_name: string | null
  user_email: string | null
  page: string | null
  type: string
  message: string
  status: string
  created_at: string
}

export async function listFeedbackSubmissions(): Promise<FeedbackSubmission[]> {
  const authError = await verifySuperadmin()
  if (authError) return []
  const admin = createAdminClient()
  const { data } = await admin
    .from("feedback_submissions")
    .select("id, user_id, user_name, user_email, page, type, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200)
  return (data ?? []) as FeedbackSubmission[]
}

export async function updateFeedbackStatus(
  id: string,
  status: "new" | "in_progress" | "resolved",
): Promise<{ error?: string }> {
  const authError = await verifySuperadmin()
  if (authError) return authError
  const admin = createAdminClient()
  const { error } = await admin
    .from("feedback_submissions")
    .update({ status })
    .eq("id", id)
  if (error) return { error: error.message }
  return {}
}

export async function deleteFeedbackSubmission(id: string): Promise<{ error?: string }> {
  const authError = await verifySuperadmin()
  if (authError) return authError
  const admin = createAdminClient()
  const { error } = await admin.from("feedback_submissions").delete().eq("id", id)
  if (error) return { error: error.message }
  return {}
}

export async function uploadContentImage(
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const auth = await verifyAdmin()
  if ("error" in auth) return auth

  const file = formData.get("file") as File | null
  if (!file) return { error: "No file provided" }

  const admin = createAdminClient()
  const path = `content/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
  const buffer = await file.arrayBuffer()

  const { error } = await admin.storage
    .from("content-images")
    .upload(path, buffer, { contentType: "image/jpeg", upsert: false })

  if (error) return { error: error.message }

  const { data } = admin.storage.from("content-images").getPublicUrl(path)
  return { url: data.publicUrl }
}
