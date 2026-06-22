import { createClient } from "@supabase/supabase-js"

type NetlifyRuntime = {
  env?: {
    get(name: string): string | undefined
  }
}

declare const Netlify: NetlifyRuntime | undefined

const SUBSTACK_FEED_URL = "https://ipnblog.substack.com/feed"
const YOUTUBE_FEED_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCioNwyZTdnV-PsfGPnBVtdA"

type SyncResult = {
  inserted: number
  updated: number
  skipped: number
}

type SyncError = { error: string }

type SyncSummary = {
  substack: SyncResult | SyncError
  youtube: SyncResult | SyncError
  eventbrite: SyncResult | SyncError
  cleanup: { marked: number } | SyncError
}

function catchSync<T>(fn: () => Promise<T>): Promise<T | SyncError> {
  return fn().catch((e: unknown) => ({
    error: e instanceof Error ? e.message : String(e),
  }))
}

type EventbriteAttendee = {
  id?: string
  order_id?: string
  status?: string
  checked_in?: boolean
  cancelled?: boolean
  refunded?: boolean
  ticket_class_name?: string
  profile?: {
    email?: string
    name?: string
  }
}

function env(name: string) {
  if (typeof Netlify !== "undefined") return Netlify.env?.get(name) ?? process.env[name]
  return process.env[name]
}

function syncClient() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL")
  const key = env("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !key) throw new Error("Missing Supabase sync environment variables")
  return createClient(url, key)
}

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripHtml(value: string) {
  return decodeXml(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))
  return match?.[1] ? decodeXml(match[1]).trim() : null
}

function attrTag(block: string, name: string, attr: string) {
  const match = block.match(new RegExp(`<${name}[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, "i"))
  return match?.[1] ? decodeXml(match[1]).trim() : null
}

function blocks(xml: string, name: string) {
  return xml.match(new RegExp(`<${name}[\\s\\S]*?<\\/${name}>`, "gi")) ?? []
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

function classifyRecording(title: string) {
  const normalized = title.toLowerCase()
  if (normalized.includes("q&a")) return "Q&A"
  if (normalized.includes("closing ceremony")) return "Closing Ceremony"
  if (normalized.includes("keynote")) return "Keynote Speech"
  if (normalized.includes("panel")) return "Panel"
  return "Participant Talk"
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

async function fetchText(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`Fetch failed ${response.status} for ${url}`)
  return response.text()
}

async function syncSubstack() {
  const supabase = syncClient()
  const xml = await fetchText(SUBSTACK_FEED_URL)
  const result: SyncResult = { inserted: 0, updated: 0, skipped: 0 }

  for (const item of blocks(xml, "item")) {
    const title = tag(item, "title")
    const link = tag(item, "link")
    if (!title || !link) {
      result.skipped += 1
      continue
    }

    const guid = tag(item, "guid") ?? link
    const description = stripHtml(tag(item, "description") ?? tag(item, "content:encoded") ?? "")
    const publishedAt = tag(item, "pubDate")
      ? new Date(tag(item, "pubDate")!).toISOString()
      : null
    const image = attrTag(item, "enclosure", "url")
    const slug = `blog-${slugify(title)}`

    const payload = {
      slug,
      resource_type: "blog_post",
      title,
      description: description || null,
      url: link,
      category: "IPN Blog",
      image_url: image,
      image_alt: `${title} article image`,
      thumbnail_url: image,
      detail_body: description || null,
      author: "Intercollegiate Psychedelics Network (IPN)",
      published_at: publishedAt,
      source_id: guid,
      source_name: "Substack",
      status: "published",
    }

    const { data: existingBySource } = await supabase
      .from("resources")
      .select("id")
      .eq("source_id", guid)
      .maybeSingle()
    let existing = existingBySource
    if (!existing) {
      const { data: existingBySlug } = await supabase
        .from("resources")
        .select("id")
        .eq("slug", slug)
        .maybeSingle()
      existing = existingBySlug
    }

    const query = existing
      ? supabase.from("resources").update(payload).eq("id", existing.id)
      : supabase.from("resources").insert(payload)
    const { error } = await query
    if (error) throw new Error(error.message)
    if (existing) result.updated += 1
    else result.inserted += 1
  }

  return result
}

async function syncYouTube() {
  const supabase = syncClient()
  const xml = await fetchText(YOUTUBE_FEED_URL)
  const result: SyncResult = { inserted: 0, updated: 0, skipped: 0 }

  for (const entry of blocks(xml, "entry")) {
    const videoId = tag(entry, "yt:videoId")
    const title = tag(entry, "title")
    const link = attrTag(entry, "link", "href")
    if (!videoId || !title || !link) {
      result.skipped += 1
      continue
    }

    const publishedAt = tag(entry, "published")
    const description = stripHtml(tag(entry, "media:description") ?? "")
    const thumbnail = attrTag(entry, "media:thumbnail", "url")
    const slug = `psychedelx-${slugify(title)}`
    const payload = {
      slug,
      title,
      event_type: "PsychedelX",
      starts_at: publishedAt ?? new Date().toISOString(),
      timezone: "America/New_York",
      summary: description || title,
      description: description || title,
      speakers: null,
      location_label: "YouTube",
      thumbnail_url: thumbnail,
      is_recording: true,
      recording_url: link,
      recording_provider: "YouTube",
      recording_category: classifyRecording(title),
      recording_source_id: videoId,
      recording_published_at: publishedAt,
      status: "published",
    }

    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("recording_source_id", videoId)
      .maybeSingle()

    const query = existing
      ? supabase.from("events").update(payload).eq("id", existing.id)
      : supabase.from("events").insert(payload)
    const { error } = await query
    if (error) throw new Error(error.message)
    if (existing) result.updated += 1
    else result.inserted += 1
  }

  return result
}

async function syncEventbrite() {
  const supabase = syncClient()
  const token = env("EVENTBRITE_API_TOKEN")
  const externalEventId = env("EVENTBRITE_PSYCHEDELX_2026_EVENT_ID")
  const result: SyncResult = { inserted: 0, updated: 0, skipped: 0 }

  if (!token || !externalEventId) return { ...result, skipped: 1 }

  const { data: portalEvent } = await supabase
    .from("events")
    .select("id")
    .eq("external_event_id", externalEventId)
    .maybeSingle()

  if (!portalEvent) return { ...result, skipped: 1 }

  let continuation: string | null = null
  do {
    const params = new URLSearchParams({ page_size: "200" })
    if (continuation) params.set("continuation", continuation)

    const response = await fetch(
      `https://www.eventbriteapi.com/v3/events/${externalEventId}/attendees/?${params.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(`Eventbrite attendees sync failed: ${response.status}${body ? ` — ${body}` : ""}`)
    }
    const payload = (await response.json()) as {
      attendees?: EventbriteAttendee[]
      pagination?: { has_more_items?: boolean; continuation?: string }
    }

    const rows = (payload.attendees ?? []).flatMap((attendee) => {
      const email = attendee.profile?.email
      if (!email || attendee.cancelled || attendee.refunded) return []
      return {
        event_id: portalEvent.id,
        external_event_id: externalEventId,
        attendee_email: email,
        attendee_email_normalized: normalizeEmail(email),
        attendee_name: attendee.profile?.name ?? null,
        eventbrite_attendee_id: attendee.id ?? null,
        eventbrite_order_id: attendee.order_id ?? null,
        ticket_class_name: attendee.ticket_class_name ?? null,
        status: attendee.status ?? null,
        checked_in: attendee.checked_in ?? false,
        synced_at: new Date().toISOString(),
      }
    })

    if (rows.length) {
      const { data: existingRows } = await supabase
        .from("event_ticket_access")
        .select("attendee_email_normalized")
        .eq("event_id", portalEvent.id)
        .in(
          "attendee_email_normalized",
          rows.map((row) => row.attendee_email_normalized),
        )
      const existingEmails = new Set(
        ((existingRows ?? []) as { attendee_email_normalized: string }[]).map(
          (row) => row.attendee_email_normalized,
        ),
      )

      const { error } = await supabase
        .from("event_ticket_access")
        .upsert(rows, { onConflict: "event_id,attendee_email_normalized" })
      if (error) throw new Error(error.message)

      result.inserted += rows.filter(
        (row) => !existingEmails.has(row.attendee_email_normalized),
      ).length
      result.updated += rows.filter((row) =>
        existingEmails.has(row.attendee_email_normalized),
      ).length
    }

    continuation =
      payload.pagination?.has_more_items && payload.pagination.continuation
        ? payload.pagination.continuation
        : null
  } while (continuation)

  return result
}

async function markEndedEvents() {
  const supabase = syncClient()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()

  const [{ data: expiredByEnd }, { data: expiredByStart }] = await Promise.all([
    // Events with ends_at set and > 1 hour past
    supabase
      .from("events")
      .select("id")
      .eq("is_recording", false)
      .eq("status", "published")
      .not("ends_at", "is", null)
      .lt("ends_at", oneHourAgo),
    // Events with no ends_at where starts_at is > 4 hours past
    supabase
      .from("events")
      .select("id")
      .eq("is_recording", false)
      .eq("status", "published")
      .is("ends_at", null)
      .lt("starts_at", fourHoursAgo),
  ])

  const ids = [...(expiredByEnd ?? []), ...(expiredByStart ?? [])].map(
    (e: { id: string }) => e.id,
  )

  if (!ids.length) return { marked: 0 }

  const { error } = await supabase
    .from("events")
    .update({ status: "ended" })
    .in("id", ids)

  if (error) throw new Error(error.message)
  return { marked: ids.length }
}

export async function runContentSync(): Promise<SyncSummary> {
  const [substack, youtube, eventbrite] = await Promise.all([
    catchSync(syncSubstack),
    catchSync(syncYouTube),
    catchSync(syncEventbrite),
  ])
  const cleanup = await catchSync(markEndedEvents)

  return { substack, youtube, eventbrite, cleanup }
}
