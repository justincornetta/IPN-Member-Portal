"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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

function youtubeId(url: string | null) {
  if (!url) return null
  return (
    url.match(/[?&]v=([^&]+)/)?.[1] ??
    url.match(/youtu\.be\/([^?]+)/)?.[1] ??
    null
  )
}

async function canPublishContent(
  userId: string,
  role: string,
  contentType: AdminContentType,
) {
  if (role === "superadmin") return true

  const admin = createAdminClient()
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
    const startsAt =
      toIso(payload.startsAt) ??
      toIso(payload.publishedAt) ??
      (isRecording ? now : null)

    if (!startsAt) return { error: "Start date is required" }

    const eventPayload = {
      slug,
      title,
      event_type: clean(payload.eventType) ?? (isRecording ? "PsychedelX" : "IPN Lab"),
      starts_at: startsAt,
      ends_at: toIso(payload.endsAt),
      timezone: clean(payload.timezone) ?? "America/New_York",
      summary,
      description,
      speakers: clean(payload.speakers),
      location_label: clean(payload.locationLabel) ?? (isRecording ? "YouTube" : "Online"),
      location_details: clean(payload.locationDetails),
      join_url: isRecording ? null : clean(payload.joinUrl),
      thumbnail_url: imageUrl,
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
