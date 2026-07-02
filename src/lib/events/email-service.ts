import { Resend } from "resend"
import { buildGoogleCalendarUrl, formatEventDateTime } from "./calendar"
import type { EventRecord } from "./types"
import { createAdminClient } from "../supabase/admin"

export type EventEmailKind =
  | "rsvp_confirmation"
  | "reminder_24h"
  | "reminder_1h"

type ProfileRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
}

type RegistrationRow = {
  event_id: string
  user_id: string
  created_at: string
}

type DeliveryRow = {
  id: string
  status: "pending" | "sent" | "failed" | "skipped"
  attempt_count: number
  created_at: string
}

type DeliveryReservation =
  | { ok: true; id: string }
  | { ok: false; reason: "already_sent" | "pending" | "missing_email" }

type EmailDetail = {
  label: string
  value: string
  href?: string | null
}

type EmailLink = {
  label: string
  href: string
}

export type EventEmailResult = {
  kind: EventEmailKind
  eventId: string
  userId: string
  status: "sent" | "skipped" | "failed"
  error?: string
}

export type EventReminderRunResult = {
  checkedEvents: number
  checkedRegistrations: number
  sent: number
  skipped: number
  failed: number
  results: EventEmailResult[]
}

const DEFAULT_EVENT_EMAIL_FROM =
  "IPN Events <events@members.intercollegiatepsychedelics.net>"
const DEFAULT_EVENT_EMAIL_REPLY_TO = "info@intercollegiatepsychedelics.net"

function getEnv(name: string) {
  return process.env[name]?.trim() || null
}

function siteUrl() {
  const explicit = getEnv("NEXT_PUBLIC_SITE_URL")
  const deployUrl = getEnv("DEPLOY_PRIME_URL") ?? getEnv("URL")
  return (explicit ?? deployUrl ?? "http://localhost:3000").replace(/\/$/, "")
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ""
}

function displayName(profile: ProfileRow) {
  const name = [profile.first_name, profile.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
  return name || "there"
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function tagValue(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "unknown"
}

function eventUrl(event: Pick<EventRecord, "slug">) {
  return `${siteUrl()}/dashboard/events/${event.slug}`
}

function subjectFor(kind: EventEmailKind, event: EventRecord) {
  if (kind === "reminder_24h") return `Tomorrow: ${event.title}`
  if (kind === "reminder_1h") return `Starting soon: ${event.title}`
  return `RSVP confirmed: ${event.title}`
}

function htmlEmail({
  preview,
  greeting,
  headline,
  body,
  details,
  closingBeforeLinks,
  links,
  closingAfterLinks,
}: {
  preview: string
  greeting: string
  headline: string | null
  body: string[]
  details: EmailDetail[]
  closingBeforeLinks?: string[]
  links: EmailLink[]
  closingAfterLinks?: string[]
}) {
  const paragraphs = body
    .map((paragraph) => `<p style="margin:0 0 16px;color:#3f3f46;line-height:1.6;">${escapeHtml(paragraph)}</p>`)
    .join("")
  const headlineHtml = headline
    ? `<h1 style="margin:0 0 18px;color:#18181b;font-size:24px;line-height:1.25;">${escapeHtml(headline)}</h1>`
    : ""
  const detailRows = details
    .map((detail) => {
      const value = detail.href
        ? `<a href="${escapeHtml(detail.href)}" style="color:#5b3f8c;text-decoration:underline;">${escapeHtml(detail.value)}</a>`
        : escapeHtml(detail.value)
      return `<li style="margin:0 0 8px;color:#3f3f46;line-height:1.5;"><strong>${escapeHtml(detail.label)}:</strong> ${value}</li>`
    })
    .join("")
  const ctas = links
    .map(
      (link) =>
        `<p style="margin:0 12px 12px 0;display:inline-block;"><a href="${escapeHtml(link.href)}" style="display:inline-block;background:#5b3f8c;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:600;">${escapeHtml(link.label)}</a></p>`,
    )
    .join("")
  const closingBeforeLinksParagraphs = (closingBeforeLinks ?? [])
    .map((paragraph) => `<p style="margin:4px 0 16px;color:#3f3f46;line-height:1.6;">${escapeHtml(paragraph)}</p>`)
    .join("")
  const closingAfterLinksParagraphs = (closingAfterLinks ?? [])
    .map((paragraph) => `<p style="margin:4px 0 16px;color:#3f3f46;line-height:1.6;">${escapeHtml(paragraph)}</p>`)
    .join("")

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 14px;color:#71717a;font-size:14px;">${escapeHtml(greeting)}</p>
                ${headlineHtml}
                ${paragraphs}
                <ul style="margin:18px 0 22px;padding-left:20px;">${detailRows}</ul>
                ${closingBeforeLinksParagraphs}
                <div style="margin:0 0 18px;">${ctas}</div>
                ${closingAfterLinksParagraphs}
                <p style="margin:26px 0 0;color:#71717a;font-size:12px;line-height:1.5;">You are receiving this because you RSVP'd for this IPN event in the member portal.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function textEmail({
  greeting,
  headline,
  body,
  details,
  closingBeforeLinks,
  links,
  closingAfterLinks,
}: {
  greeting: string
  headline: string | null
  body: string[]
  details: EmailDetail[]
  closingBeforeLinks?: string[]
  links: EmailLink[]
  closingAfterLinks?: string[]
}) {
  return [
    greeting,
    "",
    ...(headline ? [headline, ""] : []),
    ...body.flatMap((paragraph) => [paragraph, ""]),
    ...details.map((detail) =>
      `- ${detail.label}: ${detail.href ? `${detail.value} (${detail.href})` : detail.value}`,
    ),
    "",
    ...(closingBeforeLinks ?? []).flatMap((paragraph) => [paragraph, ""]),
    ...links.map((link) => `${link.label}: ${link.href}`),
    "",
    ...(closingAfterLinks ?? []).flatMap((paragraph) => [paragraph, ""]),
    "",
    "You are receiving this because you RSVP'd for this IPN event in the member portal.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n")
}

function emailContent(
  kind: EventEmailKind,
  event: EventRecord,
  profile: ProfileRow,
) {
  const formattedTime = formatEventDateTime(
    event.starts_at,
    event.ends_at,
    event.timezone,
  )
  const portalUrl = eventUrl(event)
  const calendarEvent =
    kind === "rsvp_confirmation" ? { ...event, join_url: null } : event
  const calendarUrl = buildGoogleCalendarUrl(calendarEvent)
  const greeting = `Hi ${displayName(profile)},`
  const whatsappUrl =
    event.chat_platform === "whatsapp" &&
    event.chat_status === "active" &&
    event.chat_external_url
      ? event.chat_external_url
      : null
  const details: EmailDetail[] = [
    { label: "Event", value: event.title },
    { label: "When", value: formattedTime },
    {
      label: "Location",
      value: event.location_label ?? event.location_details ?? "Online",
    },
    {
      label: "Zoom Link",
      value: event.join_url ?? "Available on the event page before the session starts",
      href: event.join_url,
    },
  ]
  const detailsWithCalendar: EmailDetail[] = [
    ...details,
    { label: "Add to Calendar", value: "Add to Calendar", href: calendarUrl },
  ]

  if (kind === "rsvp_confirmation") {
    return {
      subject: subjectFor(kind, event),
      preview: `You're RSVP'd for ${event.title}.`,
      greeting,
      headline: "Your RSVP is confirmed!",
      body: [
        "Thanks for registering through the IPN member portal.",
        "We will send reminders 24 hours and 1 hour before the event. You can join either via the IPN Member Portal directly or via the Zoom link below.",
      ],
      details: detailsWithCalendar,
      closingBeforeLinks: [
        "Make sure to check out the event page in the member portal for event resources, speaker details, and join the WhatsApp Event Group to join in discussions with other members before and after the event to make the most of your experience.",
      ],
      links: [
        ...(whatsappUrl ? [{ label: "WhatsApp Join Link", href: whatsappUrl }] : []),
        { label: "Open event page", href: portalUrl },
      ],
      closingAfterLinks: [
        "Reach out to us on WhatsApp or via email at info@intercollegiatepsychedelics.net with any questions or feedback.",
        "Looking forward to seeing you there!",
      ],
    }
  }

  const startsSoon = kind === "reminder_1h"
  const body = startsSoon
    ? [
        "This IPN event starts soon.",
        event.join_url
          ? "Use the join link below when you're ready, or open the event page in the member portal."
          : "Open the event page in the member portal for the latest join details.",
      ]
    : [
        "This is a reminder that your IPN event is coming up tomorrow.",
        "You can join either via the IPN Member Portal directly or via the Zoom link below.",
      ]

  return {
    subject: subjectFor(kind, event),
    preview: `${event.title} is ${startsSoon ? "starting soon" : "coming up tomorrow"}.`,
    greeting,
    headline: null,
    body,
    details: startsSoon ? details : detailsWithCalendar,
    closingBeforeLinks: startsSoon
      ? undefined
      : [
          "Make sure to check out the event page in the member portal for event resources, speaker details, and join the WhatsApp Event Group to join in discussions with other members before and after the event to make the most of your experience.",
        ],
    links: startsSoon
      ? [
          { label: event.join_url ? "Join event" : "Open event page", href: event.join_url ?? portalUrl },
          ...(event.join_url ? [{ label: "Open event page", href: portalUrl }] : []),
        ]
      : [
          ...(whatsappUrl ? [{ label: "WhatsApp Join Link", href: whatsappUrl }] : []),
          { label: "Open event page", href: portalUrl },
        ],
    closingAfterLinks: startsSoon
      ? undefined
      : [
          "Reach out to us on WhatsApp or via email at info@intercollegiatepsychedelics.net with any questions or feedback.",
          "Looking forward to seeing you there!",
        ],
  }
}

async function reserveDelivery({
  event,
  registration,
  profile,
  kind,
}: {
  event: EventRecord
  registration: RegistrationRow
  profile: ProfileRow
  kind: EventEmailKind
}): Promise<DeliveryReservation> {
  const admin = createAdminClient()
  const toEmail = normalizeEmail(profile.email)
  if (!toEmail) return { ok: false, reason: "missing_email" }

  const { data: existing, error: existingError } = await admin
    .from("event_email_deliveries")
    .select("id, status, attempt_count, created_at")
    .eq("event_id", event.id)
    .eq("user_id", registration.user_id)
    .eq("registration_created_at", registration.created_at)
    .eq("kind", kind)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)

  const existingDelivery = existing as DeliveryRow | null
  if (existingDelivery?.status === "sent" || existingDelivery?.status === "skipped") {
    return { ok: false, reason: "already_sent" }
  }

  if (existingDelivery?.status === "pending") {
    const createdAt = new Date(existingDelivery.created_at).getTime()
    if (Date.now() - createdAt < 5 * 60 * 1000) {
      return { ok: false, reason: "pending" }
    }
  }

  if (existingDelivery) {
    const { error } = await admin
      .from("event_email_deliveries")
      .update({
        status: "pending",
        to_email: toEmail,
        attempt_count: existingDelivery.attempt_count + 1,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingDelivery.id)
    if (error) throw new Error(error.message)
    return { ok: true, id: existingDelivery.id }
  }

  const { data, error } = await admin
    .from("event_email_deliveries")
    .insert({
      event_id: event.id,
      user_id: registration.user_id,
      registration_created_at: registration.created_at,
      kind,
      to_email: toEmail,
      status: "pending",
      attempt_count: 1,
    })
    .select("id")
    .single()

  if (error) {
    if (error.code === "23505") return { ok: false, reason: "pending" }
    throw new Error(error.message)
  }

  return { ok: true, id: (data as { id: string }).id }
}

async function markDelivery(
  id: string,
  payload: {
    status: "sent" | "failed" | "skipped"
    resend_email_id?: string | null
    last_error?: string | null
    sent_at?: string | null
  },
) {
  const admin = createAdminClient()
  const { error } = await admin
    .from("event_email_deliveries")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
  if (error) throw new Error(error.message)
}

async function sendEventEmail({
  kind,
  event,
  registration,
  profile,
}: {
  kind: EventEmailKind
  event: EventRecord
  registration: RegistrationRow
  profile: ProfileRow
}): Promise<EventEmailResult> {
  const reservation = await reserveDelivery({ event, registration, profile, kind })
  if (!reservation.ok) {
    return {
      kind,
      eventId: event.id,
      userId: registration.user_id,
      status: "skipped",
      error: reservation.reason,
    }
  }

  const apiKey = getEnv("RESEND_API_KEY")
  if (!apiKey) {
    await markDelivery(reservation.id, {
      status: "failed",
      last_error: "RESEND_API_KEY is not configured",
    })
    return {
      kind,
      eventId: event.id,
      userId: registration.user_id,
      status: "failed",
      error: "RESEND_API_KEY is not configured",
    }
  }

  const toEmail = normalizeEmail(profile.email)
  const content = emailContent(kind, event, profile)
  const resend = new Resend(apiKey)
  const idempotencyKey = [
    kind,
    event.id,
    registration.user_id,
    registration.created_at,
  ].join("/")

  const { data, error } = await resend.emails.send(
    {
      from: getEnv("EVENT_EMAIL_FROM") ?? DEFAULT_EVENT_EMAIL_FROM,
      to: [toEmail],
      replyTo: getEnv("EVENT_EMAIL_REPLY_TO") ?? DEFAULT_EVENT_EMAIL_REPLY_TO,
      subject: content.subject,
      html: htmlEmail(content),
      text: textEmail(content),
      tags: [
        { name: "event", value: tagValue(event.slug) },
        { name: "kind", value: kind },
      ],
    },
    { idempotencyKey },
  )

  if (error) {
    const message = error.message ?? JSON.stringify(error)
    await markDelivery(reservation.id, {
      status: "failed",
      last_error: message,
    })
    return {
      kind,
      eventId: event.id,
      userId: registration.user_id,
      status: "failed",
      error: message,
    }
  }

  await markDelivery(reservation.id, {
    status: "sent",
    resend_email_id: data?.id ?? null,
    sent_at: new Date().toISOString(),
  })

  return {
    kind,
    eventId: event.id,
    userId: registration.user_id,
    status: "sent",
  }
}

async function loadEventRegistrationContext(eventId: string, userId: string) {
  const admin = createAdminClient()
  const [{ data: event }, { data: registration }, { data: profile }] =
    await Promise.all([
      admin
        .from("events")
        .select("*")
        .eq("id", eventId)
        .eq("status", "published")
        .eq("is_recording", false)
        .single(),
      admin
        .from("event_registrations")
        .select("event_id, user_id, created_at")
        .eq("event_id", eventId)
        .eq("user_id", userId)
        .single(),
      admin
        .from("profiles")
        .select("id, email, first_name, last_name")
        .eq("id", userId)
        .single(),
    ])

  if (!event || !registration || !profile) return null
  return {
    event: event as EventRecord,
    registration: registration as RegistrationRow,
    profile: profile as ProfileRow,
  }
}

export async function sendEventRegistrationConfirmation(
  eventId: string,
  userId: string,
): Promise<EventEmailResult | null> {
  try {
    const context = await loadEventRegistrationContext(eventId, userId)
    if (!context) return null
    return await sendEventEmail({
      ...context,
      kind: "rsvp_confirmation",
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn("[event-email] confirmation failed:", message)
    return {
      kind: "rsvp_confirmation",
      eventId,
      userId,
      status: "failed",
      error: message,
    }
  }
}

function dueReminderKinds(event: EventRecord, now: Date): EventEmailKind[] {
  const startsAt = new Date(event.starts_at).getTime()
  const nowMs = now.getTime()
  if (!Number.isFinite(startsAt) || startsAt <= nowMs) return []

  const oneHourBefore = startsAt - 60 * 60 * 1000
  const dayBefore = startsAt - 24 * 60 * 60 * 1000

  if (nowMs >= oneHourBefore) return ["reminder_1h"]
  if (nowMs >= dayBefore) return ["reminder_24h"]
  return []
}

export async function processDueEventReminders(
  now = new Date(),
): Promise<EventReminderRunResult> {
  const admin = createAdminClient()
  const nowIso = now.toISOString()
  const horizonIso = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString()

  const { data: eventRows, error: eventError } = await admin
    .from("events")
    .select("*")
    .eq("status", "published")
    .eq("is_recording", false)
    .gt("starts_at", nowIso)
    .lte("starts_at", horizonIso)
    .order("starts_at", { ascending: true })

  if (eventError) throw new Error(eventError.message)

  const events = ((eventRows ?? []) as EventRecord[]).filter(
    (event) => dueReminderKinds(event, now).length > 0,
  )
  if (!events.length) {
    return {
      checkedEvents: 0,
      checkedRegistrations: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      results: [],
    }
  }

  const { data: registrationRows, error: registrationError } = await admin
    .from("event_registrations")
    .select("event_id, user_id, created_at")
    .in(
      "event_id",
      events.map((event) => event.id),
    )

  if (registrationError) throw new Error(registrationError.message)

  const registrations = (registrationRows ?? []) as RegistrationRow[]
  const userIds = Array.from(new Set(registrations.map((row) => row.user_id)))
  const { data: profileRows, error: profileError } = userIds.length
    ? await admin
        .from("profiles")
        .select("id, email, first_name, last_name")
        .in("id", userIds)
    : { data: [], error: null }

  if (profileError) throw new Error(profileError.message)

  const eventById = new Map(events.map((event) => [event.id, event]))
  const profileById = new Map(
    ((profileRows ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  )
  const results: EventEmailResult[] = []

  for (const registration of registrations) {
    const event = eventById.get(registration.event_id)
    const profile = profileById.get(registration.user_id)
    if (!event || !profile) {
      results.push({
        kind: "reminder_24h",
        eventId: registration.event_id,
        userId: registration.user_id,
        status: "skipped",
        error: "missing event or profile",
      })
      continue
    }

    for (const kind of dueReminderKinds(event, now)) {
      try {
        results.push(
          await sendEventEmail({
            kind,
            event,
            registration,
            profile,
          }),
        )
      } catch (error) {
        results.push({
          kind,
          eventId: event.id,
          userId: registration.user_id,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return {
    checkedEvents: events.length,
    checkedRegistrations: registrations.length,
    sent: results.filter((result) => result.status === "sent").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    failed: results.filter((result) => result.status === "failed").length,
    results,
  }
}
