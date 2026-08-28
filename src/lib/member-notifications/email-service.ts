import { createHash } from "node:crypto"
import { Resend } from "resend"
import type { ConferenceDiscount, ConferenceMeetup, ConferenceRecord } from "@/lib/conferences/types"
import { formatEventDateTime } from "@/lib/events/calendar"
import type { EventRecord } from "@/lib/events/types"
import {
  buildConferenceDiscountEmailContent,
  buildConferenceMeetupEmailContent,
  buildNewConferenceEmailContent,
} from "@/lib/member-notifications/conference-email-content"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendOpsAlert } from "@/lib/slack/ops-alert-core"
import {
  NEW_EVENT_FATIGUE_GUARD_HOURS,
  REGISTRATION_REMINDER_KIND,
  registrationReminderDedupeKey,
  registrationReminderEventIsAdHocEligible,
  registrationReminderFeatureEnabled,
  registrationReminderRecipientIsEnabled,
  registrationReminderSuppressionReason,
  registrationReminderWindow,
} from "./registration-reminders"

type NetlifyRuntime = {
  env?: {
    get(name: string): string | undefined
  }
}

declare const Netlify: NetlifyRuntime | undefined

export type MemberNotificationKind =
  | "new_event"
  | typeof REGISTRATION_REMINDER_KIND
  | "new_conference"
  | "conference_meetup_added"
  | "conference_discount_added"
  | "connection_request_received"
  | "connection_request_accepted"

type ConferenceNotificationKind = Extract<
  MemberNotificationKind,
  "new_conference" | "conference_meetup_added" | "conference_discount_added"
>

type NotificationMode = "off" | "test" | "live"
type DeliveryStatus = "pending" | "processing" | "sent" | "failed" | "skipped"

type ProfileRow = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  is_banned?: boolean | null
}

type ConnectionRow = {
  id: string
  requester_id: string
  addressee_id: string
  status: "pending" | "accepted" | "declined"
  updated_at: string
}

type DeliveryRow = {
  id: string
  kind: MemberNotificationKind
  recipient_user_id: string
  actor_user_id: string | null
  event_id: string | null
  conference_id: string | null
  connection_id: string | null
  source_key: string | null
  dedupe_key: string
  to_email: string
  status: DeliveryStatus
  resend_email_id: string | null
  attempt_count: number
  last_error: string | null
  sent_at: string | null
  created_at: string
  updated_at: string
}

type EmailDetail = {
  label: string
  value: string
}

type EmailContent = {
  subject: string
  preview: string
  greeting: string
  body: string[]
  details?: EmailDetail[]
  afterDetails?: string[]
  buttonLabel: string
  buttonUrl: string
  closing?: string[]
  receiptReason: string
}

type BuiltNotification = {
  delivery: DeliveryRow
  content: EmailContent
  tagSource: string
}

export type QueueResult = {
  mode: NotificationMode
  queued: number
  skipped: number
  reason?: string
}

export type MemberNotificationRunResult = {
  mode: NotificationMode
  checked: number
  reserved: number
  sent: number
  skipped: number
  failed: number
}

const DEFAULT_MEMBER_EMAIL_FROM =
  "IPN Member Portal <members@members.intercollegiatepsychedelics.net>"
const DEFAULT_MEMBER_EMAIL_REPLY_TO = "info@intercollegiatepsychedelics.net"
const NEW_EVENT_TEMPLATE_VERSION = "v2"
const NEW_CONFERENCE_TEMPLATE_VERSION = "v1"
const CONFERENCE_MEETUP_TEMPLATE_VERSION = "v1"
const CONFERENCE_DISCOUNT_TEMPLATE_VERSION = "v1"
const MAX_ATTEMPTS = 5
const BATCH_SIZE = 100
const RUN_LIMIT = 100

function getEnv(name: string) {
  const value =
    (typeof Netlify !== "undefined" ? Netlify.env?.get(name) : undefined) ??
    process.env[name]
  return value?.trim() || null
}

function siteUrl() {
  const explicit = getEnv("NEXT_PUBLIC_SITE_URL")
  const deployUrl = getEnv("DEPLOY_PRIME_URL") ?? getEnv("URL")
  // Netlify exposes DEPLOY_PRIME_URL for the exact deploy, including PR
  // previews. Prefer it so test notification links stay on the preview that
  // produced them instead of falling through to the production site URL.
  return (deployUrl ?? explicit ?? "http://localhost:3000").replace(/\/$/, "")
}

export function memberNotificationMode(): NotificationMode {
  const value = getEnv("MEMBER_NOTIFICATION_MODE")?.toLowerCase()
  if (value === "test" || value === "live") return value
  return "off"
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ""
}

function testRecipients() {
  return new Set(
    (getEnv("MEMBER_NOTIFICATION_TEST_RECIPIENTS") ?? "")
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  )
}

function recipientIsEnabled(email: string) {
  const mode = memberNotificationMode()
  return registrationReminderRecipientIsEnabled(mode, email, testRecipients())
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function firstName(profile: ProfileRow) {
  return profile.first_name?.trim() || "there"
}

function fullName(profile: ProfileRow) {
  return [profile.first_name, profile.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ") || "An IPN member"
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

function publicEventUrl(event: Pick<EventRecord, "slug">) {
  return `${siteUrl()}/events/${encodeURIComponent(event.slug)}`
}

function conferenceUrl(conference: Pick<ConferenceRecord, "slug">) {
  return `${siteUrl()}/dashboard/conferences/${encodeURIComponent(conference.slug)}`
}

function registrationReminderEventUrl(event: Pick<EventRecord, "slug">) {
  const url = new URL(
    `${siteUrl()}/dashboard/events/${encodeURIComponent(event.slug)}`,
  )
  url.searchParams.set("utm_source", "member_portal_email")
  url.searchParams.set("utm_medium", "email")
  url.searchParams.set("utm_campaign", "event_registration_reminder")
  url.searchParams.set("utm_content", "72h")
  return url.toString()
}

function connectionsUrl() {
  return `${siteUrl()}/dashboard/directory?tab=connections`
}

function htmlEmail(content: EmailContent) {
  const paragraphs = content.body
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#3f3f46;line-height:1.6;">${escapeHtml(paragraph)}</p>`,
    )
    .join("")
  const details = (content.details ?? [])
    .map(
      (detail) =>
        `<p style="margin:0 0 10px;color:#3f3f46;line-height:1.5;"><strong>${escapeHtml(detail.label)}:</strong> ${escapeHtml(detail.value)}</p>`,
    )
    .join("")
  const detailsBlock = details
    ? `<div style="margin:18px 0 22px;">${details}</div>`
    : ""
  const afterDetails = (content.afterDetails ?? [])
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#3f3f46;line-height:1.6;">${escapeHtml(paragraph)}</p>`,
    )
    .join("")
  const closing = (content.closing ?? [])
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#3f3f46;line-height:1.6;">${escapeHtml(paragraph)}</p>`,
    )
    .join("")

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(content.preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px;color:#3f3f46;line-height:1.6;">${escapeHtml(content.greeting)}</p>
                ${paragraphs}
                ${detailsBlock}
                ${afterDetails}
                <p style="margin:4px 0 22px;"><a href="${escapeHtml(content.buttonUrl)}" style="display:inline-block;background:#5b3f8c;color:#ffffff;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:600;">${escapeHtml(content.buttonLabel)}</a></p>
                ${closing}
                <p style="margin:24px 0 4px;color:#3f3f46;line-height:1.6;">Sincerely,</p>
                <p style="margin:0;color:#3f3f46;line-height:1.6;">The IPN Team</p>
                <p style="margin:26px 0 0;color:#71717a;font-size:12px;line-height:1.5;">${escapeHtml(content.receiptReason)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function textEmail(content: EmailContent) {
  return [
    content.greeting,
    "",
    ...content.body.flatMap((paragraph) => [paragraph, ""]),
    ...(content.details ?? []).map((detail) => `${detail.label}: ${detail.value}`),
    ...(content.details?.length ? [""] : []),
    ...(content.afterDetails ?? []).flatMap((paragraph) => [paragraph, ""]),
    `${content.buttonLabel}: ${content.buttonUrl}`,
    "",
    ...(content.closing ?? []).flatMap((paragraph) => [paragraph, ""]),
    "Sincerely,",
    "",
    "The IPN Team",
    "",
    content.receiptReason,
  ].join("\n")
}

function eventEmail(event: EventRecord, recipient: ProfileRow): EmailContent {
  const details: EmailDetail[] = [
    {
      label: "Event Title",
      value: event.title,
    },
    {
      label: "Speakers",
      value: event.speakers?.trim() || "To be announced",
    },
    {
      label: "When",
      value: formatEventDateTime(event.starts_at, event.ends_at, event.timezone),
    },
    {
      label: "Location",
      value: event.location_label ?? event.location_details ?? "Online",
    },
  ]

  return {
    subject: `New IPN event: ${event.title}`,
    preview: `${event.title} is now open for registration.`,
    greeting: `Hi ${firstName(recipient)},`,
    body: [
      "We just posted a new event in the IPN Member Portal that we think you’ll enjoy.",
    ],
    details,
    afterDetails: [
      "Read more and RSVP through the link below. After registering, you’ll receive confirmation and reminder emails. If the event has a WhatsApp group, you’ll also be able to join the conversation with other attendees.",
    ],
    buttonLabel: "View event and RSVP",
    buttonUrl: publicEventUrl(event),
    closing: ["We look forward to seeing you there!"],
    receiptReason:
      "You are receiving this because you have an IPN Member Portal account.",
  }
}

function newConferenceEmail(
  conference: ConferenceRecord,
  recipient: ProfileRow,
): EmailContent {
  return buildNewConferenceEmailContent(
    conference,
    firstName(recipient),
    conferenceUrl(conference),
  )
}

function conferenceMeetupEmail(
  conference: ConferenceRecord,
  meetup: ConferenceMeetup,
  recipient: ProfileRow,
): EmailContent {
  return buildConferenceMeetupEmailContent(
    conference,
    meetup,
    firstName(recipient),
    conferenceUrl(conference),
  )
}

function conferenceDiscountEmail(
  conference: ConferenceRecord,
  discount: ConferenceDiscount,
  recipient: ProfileRow,
): EmailContent {
  return buildConferenceDiscountEmailContent(
    conference,
    discount,
    firstName(recipient),
    conferenceUrl(conference),
  )
}

function eventRegistrationReminderEmail(
  event: EventRecord,
  recipient: ProfileRow,
): EmailContent {
  const body = ["There is still time to join other IPN members for this event."]
  const highlight = event.summary?.trim()
  if (highlight) body.push(highlight)

  return {
    subject: `Coming up this week: ${event.title}`,
    preview: `There is still time to RSVP for ${event.title}.`,
    greeting: `Hi ${firstName(recipient)},`,
    body,
    details: [
      {
        label: "When",
        value: formatEventDateTime(event.starts_at, event.ends_at, event.timezone),
      },
      {
        label: "Location",
        value: event.location_label ?? event.location_details ?? "Online",
      },
    ],
    afterDetails: [
      "View the event page and RSVP if you would like to attend.",
    ],
    buttonLabel: "View event and RSVP",
    buttonUrl: registrationReminderEventUrl(event),
    receiptReason:
      "You are receiving this because you have an IPN Member Portal account and have not RSVP'd for this event.",
  }
}

function connectionRequestEmail(
  recipient: ProfileRow,
  requester: ProfileRow,
): EmailContent {
  const requesterName = fullName(requester)
  return {
    subject: `${requesterName} from IPN would like to connect with you`,
    preview: `${requesterName} would like to connect with you through IPN.`,
    greeting: `Hi ${firstName(recipient)},`,
    body: [
      `Looks like ${requesterName} from IPN wants to be your friend!`,
      "Open the Member Portal to view their profile and respond. If you accept, you’ll be able to connect with them directly either via email or WhatsApp.",
    ],
    buttonLabel: "Review connection request",
    buttonUrl: connectionsUrl(),
    receiptReason:
      "You are receiving this because an IPN member sent you a connection request.",
  }
}

function connectionAcceptedEmail(
  recipient: ProfileRow,
  member: ProfileRow,
): EmailContent {
  const memberName = fullName(member)
  return {
    subject: `${memberName} from IPN accepted your connection request`,
    preview: `${memberName} accepted your IPN connection request.`,
    greeting: `Hi ${firstName(recipient)},`,
    body: [
      `Looks like you made a new friend, ${memberName} accepted your connection request!`,
      "Don't be shy, open the IPN Member Portal to find their contact information and send them a message!",
    ],
    buttonLabel: "Open your connection",
    buttonUrl: connectionsUrl(),
    receiptReason:
      "You are receiving this because an IPN member accepted your connection request.",
  }
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function upsertDeliveries(rows: DeliveryRow[]) {
  if (!rows.length) return
  const admin = createAdminClient()
  const { error } = await admin
    .from("member_notification_deliveries")
    .upsert(rows, { onConflict: "id" })
  if (error) throw new Error(error.message)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function upsertDeliveriesWithRetry(rows: DeliveryRow[], attempts = 3) {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await upsertDeliveries(rows)
      return
    } catch (error) {
      lastError = error
      if (attempt < attempts) await sleep(attempt * 300)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function alertIfExhausted(rows: DeliveryRow[]) {
  const exhausted = rows.filter((row) => row.attempt_count >= MAX_ATTEMPTS)
  if (!exhausted.length) return
  await sendOpsAlert("Member notification permanently failed", {
    Count: String(exhausted.length),
    Kinds: [...new Set(exhausted.map((row) => row.kind))].join(", "),
    "Sample dedupe keys": exhausted.slice(0, 5).map((row) => row.dedupe_key).join(", "),
    "Last error": exhausted[0]?.last_error ?? "unknown",
  })
}

export async function queueNewEventAnnouncement(
  eventId: string,
): Promise<QueueResult> {
  const mode = memberNotificationMode()
  if (mode === "off") {
    return { mode, queued: 0, skipped: 0, reason: "notifications are disabled" }
  }

  const admin = createAdminClient()
  const { data: event, error: eventError } = await admin
    .from("events")
    .select("id, slug")
    .eq("id", eventId)
    .eq("status", "published")
    .eq("is_recording", false)
    .single()

  if (eventError || !event) {
    return { mode, queued: 0, skipped: 0, reason: "event is not published" }
  }

  let profileQuery = admin
    .from("profiles")
    .select("id, email, first_name, last_name, is_banned")

  if (mode === "test") {
    const recipients = [...testRecipients()]
    if (!recipients.length) {
      return {
        mode,
        queued: 0,
        skipped: 0,
        reason: "MEMBER_NOTIFICATION_TEST_RECIPIENTS is empty",
      }
    }
    profileQuery = profileQuery.in("email", recipients)
  }

  const { data: profileRows, error: profileError } = await profileQuery
  if (profileError) throw new Error(profileError.message)

  const profiles = (profileRows ?? []) as ProfileRow[]
  const validProfiles = profiles.filter((profile) => {
    const email = normalizeEmail(profile.email)
    return !profile.is_banned && isValidEmail(email) && recipientIsEnabled(email)
  })
  const skipped = profiles.length - validProfiles.length
  let queued = 0

  for (const profileChunk of chunks(validProfiles, 500)) {
    const { data, error } = await admin
      .from("member_notification_deliveries")
      .upsert(
        profileChunk.map((profile) => ({
          kind: "new_event" as const,
          recipient_user_id: profile.id,
          actor_user_id: null,
          event_id: event.id,
          conference_id: null,
          connection_id: null,
          source_key: null,
          dedupe_key: `new-event/${NEW_EVENT_TEMPLATE_VERSION}/${event.id}/${profile.id}`,
          to_email: normalizeEmail(profile.email),
          status: "pending" as const,
        })),
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      )
      .select("id")

    if (error) throw new Error(error.message)
    queued += data?.length ?? 0
  }

  return { mode, queued, skipped }
}

export async function queueNewEventAnnouncementBySlug(eventSlug: string) {
  const admin = createAdminClient()
  const { data: event, error } = await admin
    .from("events")
    .select("id")
    .eq("slug", eventSlug)
    .eq("status", "published")
    .eq("is_recording", false)
    .single()

  if (error || !event) {
    throw new Error(error?.message ?? `Event not found: ${eventSlug}`)
  }
  return queueNewEventAnnouncement(event.id)
}

async function queueConferenceAnnouncement(
  kind: ConferenceNotificationKind,
  conferenceId: string,
  sourceKey: string | null,
): Promise<QueueResult> {
  const mode = memberNotificationMode()
  if (mode === "off") {
    return { mode, queued: 0, skipped: 0, reason: "notifications are disabled" }
  }

  const admin = createAdminClient()
  const { data: conference, error: conferenceError } = await admin
    .from("conferences")
    .select("id, status, meetups, discounts")
    .eq("id", conferenceId)
    .eq("status", "published")
    .single()

  if (conferenceError || !conference) {
    return { mode, queued: 0, skipped: 0, reason: "conference is not published" }
  }

  if (
    kind === "conference_meetup_added" &&
    !(conference.meetups as ConferenceMeetup[]).some((meetup) => meetup.id === sourceKey)
  ) {
    return { mode, queued: 0, skipped: 0, reason: "conference meetup is unavailable" }
  }

  if (
    kind === "conference_discount_added" &&
    !(conference.discounts as ConferenceDiscount[]).some(
      (discount) => discount.id === sourceKey,
    )
  ) {
    return { mode, queued: 0, skipped: 0, reason: "conference discount is unavailable" }
  }

  let profileQuery = admin
    .from("profiles")
    .select("id, email, first_name, last_name, is_banned")

  if (mode === "test") {
    const recipients = [...testRecipients()]
    if (!recipients.length) {
      return {
        mode,
        queued: 0,
        skipped: 0,
        reason: "MEMBER_NOTIFICATION_TEST_RECIPIENTS is empty",
      }
    }
    profileQuery = profileQuery.in("email", recipients)
  }

  const { data: profileRows, error: profileError } = await profileQuery
  if (profileError) throw new Error(profileError.message)
  const profiles = (profileRows ?? []) as ProfileRow[]
  const validProfiles = profiles.filter((profile) => {
    const email = normalizeEmail(profile.email)
    return !profile.is_banned && isValidEmail(email) && recipientIsEnabled(email)
  })
  const skipped = profiles.length - validProfiles.length
  const templateVersion =
    kind === "new_conference"
      ? NEW_CONFERENCE_TEMPLATE_VERSION
      : kind === "conference_meetup_added"
        ? CONFERENCE_MEETUP_TEMPLATE_VERSION
        : CONFERENCE_DISCOUNT_TEMPLATE_VERSION
  let queued = 0

  for (const profileChunk of chunks(validProfiles, 500)) {
    const { data, error } = await admin
      .from("member_notification_deliveries")
      .upsert(
        profileChunk.map((profile) => ({
          kind,
          recipient_user_id: profile.id,
          actor_user_id: null,
          event_id: null,
          conference_id: conference.id,
          connection_id: null,
          source_key: sourceKey,
          dedupe_key: [
            kind,
            templateVersion,
            conference.id,
            ...(sourceKey ? [sourceKey] : []),
            profile.id,
          ].join("/"),
          to_email: normalizeEmail(profile.email),
          status: "pending" as const,
        })),
        { onConflict: "dedupe_key", ignoreDuplicates: true },
      )
      .select("id")

    if (error) throw new Error(error.message)
    queued += data?.length ?? 0
  }

  return { mode, queued, skipped }
}

export async function queueDueEventRegistrationReminders(
  now = new Date(),
): Promise<QueueResult> {
  const mode = memberNotificationMode()
  if (!registrationReminderFeatureEnabled(getEnv("EVENT_REGISTRATION_REMINDERS_ENABLED"))) {
    return {
      mode,
      queued: 0,
      skipped: 0,
      reason: "event registration reminders are disabled",
    }
  }
  if (mode === "off") {
    return { mode, queued: 0, skipped: 0, reason: "notifications are disabled" }
  }

  const admin = createAdminClient()
  const { windowStart, windowEnd } = registrationReminderWindow(now)
  const { data: eventRows, error: eventError } = await admin
    .from("events")
    .select("*")
    .eq("status", "published")
    .eq("is_recording", false)
    .eq("registration_reminder_enabled", true)
    .gt("starts_at", windowStart.toISOString())
    .lte("starts_at", windowEnd.toISOString())
    .order("starts_at", { ascending: true })

  if (eventError) throw new Error(eventError.message)
  const events = (eventRows ?? []) as EventRecord[]
  if (!events.length) return { mode, queued: 0, skipped: 0 }

  return queueEventRegistrationReminders(events, mode, now, admin)
}

export async function queueEventRegistrationReminderNow(
  eventId: string,
  now = new Date(),
): Promise<QueueResult> {
  const mode = memberNotificationMode()
  if (!registrationReminderFeatureEnabled(getEnv("EVENT_REGISTRATION_REMINDERS_ENABLED"))) {
    return {
      mode,
      queued: 0,
      skipped: 0,
      reason: "event registration reminders are disabled",
    }
  }
  if (mode === "off") {
    return { mode, queued: 0, skipped: 0, reason: "notifications are disabled" }
  }

  const admin = createAdminClient()
  const { data: eventRow, error: eventError } = await admin
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle()

  if (eventError) throw new Error(eventError.message)
  const event = eventRow as EventRecord | null
  if (!event || !registrationReminderEventIsAdHocEligible(event, now)) {
    return {
      mode,
      queued: 0,
      skipped: 0,
      reason: "event is not eligible for a registration reminder",
    }
  }

  return queueEventRegistrationReminders([event], mode, now, admin)
}

async function queueEventRegistrationReminders(
  events: EventRecord[],
  mode: NotificationMode,
  now: Date,
  admin: ReturnType<typeof createAdminClient>,
): Promise<QueueResult> {
  let profileQuery = admin
    .from("profiles")
    .select("id, email, first_name, last_name, is_banned")

  if (mode === "test") {
    const recipients = [...testRecipients()]
    if (!recipients.length) {
      return {
        mode,
        queued: 0,
        skipped: 0,
        reason: "MEMBER_NOTIFICATION_TEST_RECIPIENTS is empty",
      }
    }
    profileQuery = profileQuery.in("email", recipients)
  }

  const { data: profileRows, error: profileError } = await profileQuery
  if (profileError) throw new Error(profileError.message)
  const profiles = (profileRows ?? []) as ProfileRow[]
  const validProfiles = profiles.filter((profile) => {
    const email = normalizeEmail(profile.email)
    return !profile.is_banned && isValidEmail(email) && recipientIsEnabled(email)
  })

  let queued = 0
  let skipped = profiles.length - validProfiles.length
  const fatigueSince = new Date(
    now.getTime() - NEW_EVENT_FATIGUE_GUARD_HOURS * 60 * 60 * 1000,
  ).toISOString()

  for (const event of events) {
    for (const profileChunk of chunks(validProfiles, 500)) {
      const profileIds = profileChunk.map((profile) => profile.id)
      const emails = profileChunk.map((profile) => normalizeEmail(profile.email))
      const [registrationsResult, ticketsResult, announcementsResult] =
        await Promise.all([
          admin
            .from("event_registrations")
            .select("user_id")
            .eq("event_id", event.id)
            .in("user_id", profileIds),
          admin
            .from("event_ticket_access")
            .select("attendee_email_normalized")
            .eq("event_id", event.id)
            .in("attendee_email_normalized", emails),
          admin
            .from("member_notification_deliveries")
            .select("recipient_user_id, sent_at")
            .eq("kind", "new_event")
            .eq("event_id", event.id)
            .eq("status", "sent")
            .gte("sent_at", fatigueSince)
            .in("recipient_user_id", profileIds),
        ])

      if (registrationsResult.error) throw new Error(registrationsResult.error.message)
      if (ticketsResult.error) throw new Error(ticketsResult.error.message)
      if (announcementsResult.error) throw new Error(announcementsResult.error.message)

      const registeredUserIds = new Set(
        (registrationsResult.data ?? []).map((row) => row.user_id as string),
      )
      const ticketEmails = new Set(
        (ticketsResult.data ?? []).map((row) =>
          normalizeEmail(row.attendee_email_normalized as string),
        ),
      )
      const announcementByRecipient = new Map(
        (announcementsResult.data ?? []).map((row) => [
          row.recipient_user_id as string,
          row.sent_at as string | null,
        ]),
      )

      const eligibleProfiles = profileChunk.filter((profile) => {
        const reason = registrationReminderSuppressionReason({
          hasPortalRegistration: registeredUserIds.has(profile.id),
          hasVerifiedExternalTicket: ticketEmails.has(normalizeEmail(profile.email)),
          newEventAnnouncementSentAt: announcementByRecipient.get(profile.id),
          now,
        })
        if (reason) skipped += 1
        return !reason
      })

      if (!eligibleProfiles.length) continue
      const { data, error } = await admin
        .from("member_notification_deliveries")
        .upsert(
          eligibleProfiles.map((profile) => ({
            kind: REGISTRATION_REMINDER_KIND,
            recipient_user_id: profile.id,
            actor_user_id: null,
            event_id: event.id,
            conference_id: null,
            connection_id: null,
            source_key: null,
            dedupe_key: registrationReminderDedupeKey(event.id, profile.id),
            to_email: normalizeEmail(profile.email),
            status: "pending" as const,
          })),
          { onConflict: "dedupe_key", ignoreDuplicates: true },
        )
        .select("id")

      if (error) throw new Error(error.message)
      queued += data?.length ?? 0
    }
  }

  return { mode, queued, skipped }
}

export function queueNewConferenceAnnouncement(conferenceId: string) {
  return queueConferenceAnnouncement("new_conference", conferenceId, null)
}

export function queueConferenceMeetupAnnouncement(
  conferenceId: string,
  meetupId: string,
) {
  return queueConferenceAnnouncement(
    "conference_meetup_added",
    conferenceId,
    meetupId,
  )
}

export function queueConferenceDiscountAnnouncement(
  conferenceId: string,
  discountId: string,
) {
  return queueConferenceAnnouncement(
    "conference_discount_added",
    conferenceId,
    discountId,
  )
}

async function queueConnectionNotification({
  kind,
  connectionId,
  recipientUserId,
  actorUserId,
  sourceVersion,
}: {
  kind: "connection_request_received" | "connection_request_accepted"
  connectionId: string
  recipientUserId: string
  actorUserId: string
  sourceVersion: string
}) {
  const mode = memberNotificationMode()
  if (mode === "off") return null

  const admin = createAdminClient()
  const { data: recipient, error: recipientError } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name, is_banned")
    .eq("id", recipientUserId)
    .single()

  if (recipientError || !recipient) return null
  const profile = recipient as ProfileRow
  const email = normalizeEmail(profile.email)
  if (profile.is_banned || !isValidEmail(email) || !recipientIsEnabled(email)) {
    return null
  }

  const dedupeKey = [
    kind,
    connectionId,
    recipientUserId,
    sourceVersion,
  ].join("/")
  const { data, error } = await admin
    .from("member_notification_deliveries")
    .upsert(
      {
        kind,
        recipient_user_id: recipientUserId,
        actor_user_id: actorUserId,
        event_id: null,
        conference_id: null,
        connection_id: connectionId,
        source_key: null,
        dedupe_key: dedupeKey,
        to_email: email,
        status: "pending",
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (data?.id) return data.id as string

  const { data: existing } = await admin
    .from("member_notification_deliveries")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle()
  return (existing?.id as string | undefined) ?? null
}

export async function notifyConnectionRequestReceived(input: {
  connectionId: string
  requesterUserId: string
  addresseeUserId: string
  sourceVersion: string
}) {
  try {
    const deliveryId = await queueConnectionNotification({
      kind: "connection_request_received",
      connectionId: input.connectionId,
      recipientUserId: input.addresseeUserId,
      actorUserId: input.requesterUserId,
      sourceVersion: input.sourceVersion,
    })
    if (deliveryId) await processPendingMemberNotifications({ deliveryId })
  } catch (error) {
    console.warn(
      "[member-notification] connection request email failed:",
      error instanceof Error ? error.message : String(error),
    )
  }
}

export async function notifyConnectionRequestAccepted(input: {
  connectionId: string
  requesterUserId: string
  acceptingUserId: string
  sourceVersion: string
}) {
  try {
    const deliveryId = await queueConnectionNotification({
      kind: "connection_request_accepted",
      connectionId: input.connectionId,
      recipientUserId: input.requesterUserId,
      actorUserId: input.acceptingUserId,
      sourceVersion: input.sourceVersion,
    })
    if (deliveryId) await processPendingMemberNotifications({ deliveryId })
  } catch (error) {
    console.warn(
      "[member-notification] connection accepted email failed:",
      error instanceof Error ? error.message : String(error),
    )
  }
}

async function buildNotifications(deliveries: DeliveryRow[]) {
  const admin = createAdminClient()
  const profileIds = [
    ...new Set(
      deliveries.flatMap((delivery) => [
        delivery.recipient_user_id,
        ...(delivery.actor_user_id ? [delivery.actor_user_id] : []),
      ]),
    ),
  ]
  const eventIds = [
    ...new Set(
      deliveries.flatMap((delivery) =>
        delivery.event_id ? [delivery.event_id] : [],
      ),
    ),
  ]
  const conferenceIds = [
    ...new Set(
      deliveries.flatMap((delivery) =>
        delivery.conference_id ? [delivery.conference_id] : [],
      ),
    ),
  ]
  const connectionIds = [
    ...new Set(
      deliveries.flatMap((delivery) =>
        delivery.connection_id ? [delivery.connection_id] : [],
      ),
    ),
  ]

  const now = new Date()
  const fatigueSince = new Date(
    now.getTime() - NEW_EVENT_FATIGUE_GUARD_HOURS * 60 * 60 * 1000,
  ).toISOString()
  const [
    profilesResult,
    eventsResult,
    conferencesResult,
    connectionsResult,
    registrationsResult,
    ticketsResult,
    announcementsResult,
  ] = await Promise.all([
    profileIds.length
      ? admin
          .from("profiles")
          .select("id, email, first_name, last_name, is_banned")
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? admin.from("events").select("*").in("id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    conferenceIds.length
      ? admin.from("conferences").select("*").in("id", conferenceIds)
      : Promise.resolve({ data: [], error: null }),
    connectionIds.length
      ? admin
          .from("connections")
          .select("id, requester_id, addressee_id, status, updated_at")
          .in("id", connectionIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? admin
          .from("event_registrations")
          .select("event_id, user_id")
          .in("event_id", eventIds)
          .in("user_id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? admin
          .from("event_ticket_access")
          .select("event_id, attendee_email_normalized")
          .in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? admin
          .from("member_notification_deliveries")
          .select("event_id, recipient_user_id, sent_at")
          .eq("kind", "new_event")
          .eq("status", "sent")
          .gte("sent_at", fatigueSince)
          .in("event_id", eventIds)
          .in("recipient_user_id", profileIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (profilesResult.error) throw new Error(profilesResult.error.message)
  if (eventsResult.error) throw new Error(eventsResult.error.message)
  if (conferencesResult.error) throw new Error(conferencesResult.error.message)
  if (connectionsResult.error) throw new Error(connectionsResult.error.message)
  if (registrationsResult.error) throw new Error(registrationsResult.error.message)
  if (ticketsResult.error) throw new Error(ticketsResult.error.message)
  if (announcementsResult.error) throw new Error(announcementsResult.error.message)

  const profileById = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  )
  const eventById = new Map(
    ((eventsResult.data ?? []) as EventRecord[]).map((event) => [event.id, event]),
  )
  const conferenceById = new Map(
    ((conferencesResult.data ?? []) as ConferenceRecord[]).map((conference) => [
      conference.id,
      conference,
    ]),
  )
  const connectionById = new Map(
    ((connectionsResult.data ?? []) as ConnectionRow[]).map((connection) => [
      connection.id,
      connection,
    ]),
  )
  const registrationKeys = new Set(
    (registrationsResult.data ?? []).map(
      (registration) => `${registration.event_id}/${registration.user_id}`,
    ),
  )
  const ticketKeys = new Set(
    (ticketsResult.data ?? []).map(
      (ticket) =>
        `${ticket.event_id}/${normalizeEmail(ticket.attendee_email_normalized as string)}`,
    ),
  )
  const announcementByEventRecipient = new Map(
    (announcementsResult.data ?? []).map((announcement) => [
      `${announcement.event_id}/${announcement.recipient_user_id}`,
      announcement.sent_at as string | null,
    ]),
  )

  const built: BuiltNotification[] = []
  const skipped: DeliveryRow[] = []
  for (const delivery of deliveries) {
    const recipient = profileById.get(delivery.recipient_user_id)
    const actor = delivery.actor_user_id
      ? profileById.get(delivery.actor_user_id)
      : null
    const email = normalizeEmail(recipient?.email)

    if (
      !recipient ||
      recipient.is_banned ||
      !isValidEmail(email) ||
      !recipientIsEnabled(email)
    ) {
      skipped.push({
        ...delivery,
        status: "skipped",
        last_error: "recipient is unavailable or outside the enabled audience",
        updated_at: new Date().toISOString(),
      })
      continue
    }

    if (delivery.kind === "new_event") {
      const event = delivery.event_id ? eventById.get(delivery.event_id) : null
      if (!event || event.status !== "published" || event.is_recording) {
        skipped.push({
          ...delivery,
          status: "skipped",
          last_error: "event is unavailable",
          updated_at: new Date().toISOString(),
        })
        continue
      }
      built.push({
        delivery: { ...delivery, to_email: email },
        content: eventEmail(event, recipient),
        tagSource: event.slug,
      })
      continue
    }

    if (delivery.kind === REGISTRATION_REMINDER_KIND) {
      const event = delivery.event_id ? eventById.get(delivery.event_id) : null
      if (
        !registrationReminderFeatureEnabled(
          getEnv("EVENT_REGISTRATION_REMINDERS_ENABLED"),
        ) ||
        !event ||
        event.status !== "published" ||
        event.is_recording ||
        !event.registration_reminder_enabled ||
        new Date(event.starts_at).getTime() <= now.getTime()
      ) {
        skipped.push({
          ...delivery,
          status: "skipped",
          last_error: "event is no longer eligible for registration reminders",
          updated_at: now.toISOString(),
        })
        continue
      }

      const suppressionReason = registrationReminderSuppressionReason({
        hasPortalRegistration: registrationKeys.has(
          `${event.id}/${delivery.recipient_user_id}`,
        ),
        hasVerifiedExternalTicket: ticketKeys.has(`${event.id}/${email}`),
        newEventAnnouncementSentAt: announcementByEventRecipient.get(
          `${event.id}/${delivery.recipient_user_id}`,
        ),
        now,
      })
      if (suppressionReason) {
        skipped.push({
          ...delivery,
          status: "skipped",
          last_error: suppressionReason,
          updated_at: now.toISOString(),
        })
        continue
      }

      built.push({
        delivery: { ...delivery, to_email: email },
        content: eventRegistrationReminderEmail(event, recipient),
        tagSource: event.slug,
      })
      continue
    }

    if (
      delivery.kind === "new_conference" ||
      delivery.kind === "conference_meetup_added" ||
      delivery.kind === "conference_discount_added"
    ) {
      const conference = delivery.conference_id
        ? conferenceById.get(delivery.conference_id)
        : null
      if (!conference || conference.status !== "published") {
        skipped.push({
          ...delivery,
          status: "skipped",
          last_error: "conference is unavailable",
          updated_at: new Date().toISOString(),
        })
        continue
      }

      if (delivery.kind === "new_conference") {
        built.push({
          delivery: { ...delivery, to_email: email },
          content: newConferenceEmail(conference, recipient),
          tagSource: conference.slug,
        })
        continue
      }

      if (delivery.kind === "conference_meetup_added") {
        const meetup = conference.meetups.find(
          (candidate) => candidate.id === delivery.source_key,
        )
        if (!meetup) {
          skipped.push({
            ...delivery,
            status: "skipped",
            last_error: "conference meetup is unavailable",
            updated_at: new Date().toISOString(),
          })
          continue
        }
        built.push({
          delivery: { ...delivery, to_email: email },
          content: conferenceMeetupEmail(conference, meetup, recipient),
          tagSource: conference.slug,
        })
        continue
      }

      const discount = conference.discounts.find(
        (candidate) => candidate.id === delivery.source_key,
      )
      if (!discount) {
        skipped.push({
          ...delivery,
          status: "skipped",
          last_error: "conference discount is unavailable",
          updated_at: new Date().toISOString(),
        })
        continue
      }
      built.push({
        delivery: { ...delivery, to_email: email },
        content: conferenceDiscountEmail(conference, discount, recipient),
        tagSource: conference.slug,
      })
      continue
    }

    const connection = delivery.connection_id
      ? connectionById.get(delivery.connection_id)
      : null
    const expectedStatus =
      delivery.kind === "connection_request_received" ? "pending" : "accepted"
    if (!actor || !connection || connection.status !== expectedStatus) {
      skipped.push({
        ...delivery,
        status: "skipped",
        last_error: "connection is no longer in the expected state",
        updated_at: new Date().toISOString(),
      })
      continue
    }

    built.push({
      delivery: { ...delivery, to_email: email },
      content:
        delivery.kind === "connection_request_received"
          ? connectionRequestEmail(recipient, actor)
          : connectionAcceptedEmail(recipient, actor),
      tagSource: connection.id,
    })
  }

  return { built, skipped }
}

async function sendBatch(batch: BuiltNotification[]) {
  const now = new Date().toISOString()
  const apiKey = getEnv("RESEND_API_KEY")
  if (!apiKey) {
    const failedRows: DeliveryRow[] = batch.map(({ delivery }) => ({
      ...delivery,
      status: "failed",
      attempt_count: delivery.attempt_count + 1,
      last_error: "RESEND_API_KEY is not configured",
      updated_at: now,
    }))
    await upsertDeliveries(failedRows)
    await alertIfExhausted(failedRows)
    return { sent: 0, failed: batch.length }
  }

  const resend = new Resend(apiKey)
  const idempotencyHash = createHash("sha256")
    .update(batch.map(({ delivery }) => delivery.dedupe_key).sort().join("|"))
    .digest("hex")
    .slice(0, 48)
  const { data, error } = await resend.batch.send(
    batch.map(({ delivery, content, tagSource }) => ({
      from: getEnv("MEMBER_EMAIL_FROM") ?? DEFAULT_MEMBER_EMAIL_FROM,
      to: [delivery.to_email],
      replyTo: getEnv("MEMBER_EMAIL_REPLY_TO") ?? DEFAULT_MEMBER_EMAIL_REPLY_TO,
      subject: content.subject,
      html: htmlEmail(content),
      text: textEmail(content),
      tags: [
        { name: "kind", value: delivery.kind },
        { name: "source", value: tagValue(tagSource) },
      ],
    })),
    { idempotencyKey: `member-notifications/${idempotencyHash}` },
  )

  if (error) {
    const failedRows: DeliveryRow[] = batch.map(({ delivery }) => ({
      ...delivery,
      status: "failed",
      attempt_count: delivery.attempt_count + 1,
      last_error: error.message,
      updated_at: now,
    }))
    await upsertDeliveries(failedRows)
    await alertIfExhausted(failedRows)
    return { sent: 0, failed: batch.length }
  }

  const sentRows: DeliveryRow[] = batch.map(({ delivery }, index) => ({
    ...delivery,
    status: "sent",
    resend_email_id: data?.data[index]?.id ?? null,
    attempt_count: delivery.attempt_count + 1,
    last_error: null,
    sent_at: now,
    updated_at: now,
  }))

  try {
    await upsertDeliveriesWithRetry(sentRows)
  } catch (writeError) {
    // Resend already accepted and sent this batch — losing this write means
    // the stale-lease sweep will eventually flip these rows back to
    // "failed" and a later run could resend them under a different
    // idempotency key (it's derived from the batch's dedupe keys, which can
    // differ between runs). Alert with the resend_email_ids so someone can
    // reconcile the rows by hand before that sweep fires.
    const message = writeError instanceof Error ? writeError.message : String(writeError)
    console.error("[member-notification] sent batch but failed to record delivery status:", message)
    await sendOpsAlert("Member notification delivery status write failed after send", {
      "Delivery IDs": sentRows.map((row) => row.id).join(", "),
      "Resend email IDs": sentRows.map((row) => row.resend_email_id ?? "unknown").join(", "),
      Error: message,
    })
  }

  return { sent: batch.length, failed: 0 }
}

async function registrationReminderSendTimeSuppressionReason(
  delivery: DeliveryRow,
) {
  if (!delivery.event_id) return "event is unavailable"
  if (!registrationReminderFeatureEnabled(getEnv("EVENT_REGISTRATION_REMINDERS_ENABLED"))) {
    return "event registration reminders are disabled"
  }

  const admin = createAdminClient()
  const now = new Date()
  const fatigueSince = new Date(
    now.getTime() - NEW_EVENT_FATIGUE_GUARD_HOURS * 60 * 60 * 1000,
  ).toISOString()
  const [eventResult, registrationResult, ticketResult, announcementResult] =
    await Promise.all([
      admin
        .from("events")
        .select("status, is_recording, registration_reminder_enabled, starts_at")
        .eq("id", delivery.event_id)
        .maybeSingle(),
      admin
        .from("event_registrations")
        .select("user_id")
        .eq("event_id", delivery.event_id)
        .eq("user_id", delivery.recipient_user_id)
        .maybeSingle(),
      admin
        .from("event_ticket_access")
        .select("id")
        .eq("event_id", delivery.event_id)
        .eq("attendee_email_normalized", normalizeEmail(delivery.to_email))
        .maybeSingle(),
      admin
        .from("member_notification_deliveries")
        .select("sent_at")
        .eq("kind", "new_event")
        .eq("event_id", delivery.event_id)
        .eq("recipient_user_id", delivery.recipient_user_id)
        .eq("status", "sent")
        .gte("sent_at", fatigueSince)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  if (eventResult.error) throw new Error(eventResult.error.message)
  if (registrationResult.error) throw new Error(registrationResult.error.message)
  if (ticketResult.error) throw new Error(ticketResult.error.message)
  if (announcementResult.error) throw new Error(announcementResult.error.message)

  const event = eventResult.data
  if (
    !event ||
    event.status !== "published" ||
    event.is_recording ||
    !event.registration_reminder_enabled ||
    new Date(event.starts_at).getTime() <= now.getTime()
  ) {
    return "event is no longer eligible for registration reminders"
  }

  return registrationReminderSuppressionReason({
    hasPortalRegistration: Boolean(registrationResult.data),
    hasVerifiedExternalTicket: Boolean(ticketResult.data),
    newEventAnnouncementSentAt: announcementResult.data?.sent_at,
    now,
  })
}

async function sendRegistrationReminder(notification: BuiltNotification) {
  const { delivery, content, tagSource } = notification
  const now = new Date().toISOString()
  let suppressionReason: string | null
  try {
    suppressionReason = await registrationReminderSendTimeSuppressionReason(delivery)
  } catch (error) {
    const failedRow: DeliveryRow = {
      ...delivery,
      status: "failed",
      attempt_count: delivery.attempt_count + 1,
      last_error: `send-time eligibility check failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      updated_at: now,
    }
    await upsertDeliveries([failedRow])
    await alertIfExhausted([failedRow])
    return { sent: 0, failed: 1, skipped: 0 }
  }
  if (suppressionReason) {
    await upsertDeliveries([
      {
        ...delivery,
        status: "skipped",
        last_error: suppressionReason,
        updated_at: now,
      },
    ])
    return { sent: 0, failed: 0, skipped: 1 }
  }

  const apiKey = getEnv("RESEND_API_KEY")
  if (!apiKey) {
    const failedRow: DeliveryRow = {
      ...delivery,
      status: "failed",
      attempt_count: delivery.attempt_count + 1,
      last_error: "RESEND_API_KEY is not configured",
      updated_at: now,
    }
    await upsertDeliveries([failedRow])
    await alertIfExhausted([failedRow])
    return { sent: 0, failed: 1, skipped: 0 }
  }

  const resend = new Resend(apiKey)
  const idempotencyHash = createHash("sha256")
    .update(delivery.dedupe_key)
    .digest("hex")
    .slice(0, 48)
  const { data, error } = await resend.emails.send(
    {
      from: getEnv("MEMBER_EMAIL_FROM") ?? DEFAULT_MEMBER_EMAIL_FROM,
      to: [delivery.to_email],
      replyTo: getEnv("MEMBER_EMAIL_REPLY_TO") ?? DEFAULT_MEMBER_EMAIL_REPLY_TO,
      subject: content.subject,
      html: htmlEmail(content),
      text: textEmail(content),
      tags: [
        { name: "kind", value: delivery.kind },
        { name: "source", value: tagValue(tagSource) },
      ],
    },
    { idempotencyKey: `member-notifications/${idempotencyHash}` },
  )

  if (error) {
    const failedRow: DeliveryRow = {
      ...delivery,
      status: "failed",
      attempt_count: delivery.attempt_count + 1,
      last_error: error.message,
      updated_at: now,
    }
    await upsertDeliveries([failedRow])
    await alertIfExhausted([failedRow])
    return { sent: 0, failed: 1, skipped: 0 }
  }

  const sentRow: DeliveryRow = {
    ...delivery,
    status: "sent",
    resend_email_id: data?.id ?? null,
    attempt_count: delivery.attempt_count + 1,
    last_error: null,
    sent_at: now,
    updated_at: now,
  }
  try {
    await upsertDeliveriesWithRetry([sentRow])
  } catch (writeError) {
    const message = writeError instanceof Error ? writeError.message : String(writeError)
    console.error(
      "[member-notification] sent registration reminder but failed to record delivery status:",
      message,
    )
    await sendOpsAlert("Event registration reminder status write failed after send", {
      "Delivery ID": delivery.id,
      "Resend email ID": sentRow.resend_email_id ?? "unknown",
      Error: message,
    })
  }
  return { sent: 1, failed: 0, skipped: 0 }
}

export async function processPendingMemberNotifications(
  options: { deliveryId?: string } = {},
): Promise<MemberNotificationRunResult> {
  const mode = memberNotificationMode()
  const empty = {
    mode,
    checked: 0,
    reserved: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  }
  if (mode === "off") return empty

  const admin = createAdminClient()
  if (!options.deliveryId) {
    const staleBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    await admin
      .from("member_notification_deliveries")
      .update({
        status: "failed",
        last_error: "processing lease expired",
        updated_at: new Date().toISOString(),
      })
      .eq("status", "processing")
      .lt("updated_at", staleBefore)
  }

  let candidateQuery = admin
    .from("member_notification_deliveries")
    .select("*")
    .in("status", ["pending", "failed"])
    .lt("attempt_count", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(options.deliveryId ? 1 : RUN_LIMIT)

  if (options.deliveryId) candidateQuery = candidateQuery.eq("id", options.deliveryId)
  const { data: candidateRows, error: candidateError } = await candidateQuery
  if (candidateError) throw new Error(candidateError.message)

  const candidates = (candidateRows ?? []) as DeliveryRow[]
  if (!candidates.length) return empty

  const { data: reservedRows, error: reserveError } = await admin
    .from("member_notification_deliveries")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .in(
      "id",
      candidates.map((candidate) => candidate.id),
    )
    .in("status", ["pending", "failed"])
    .select("*")

  if (reserveError) throw new Error(reserveError.message)
  const reserved = (reservedRows ?? []) as DeliveryRow[]
  if (!reserved.length) return { ...empty, checked: candidates.length }

  const { built, skipped } = await buildNotifications(reserved)
  if (skipped.length) await upsertDeliveries(skipped)

  let sent = 0
  let failed = 0
  let sendTimeSkipped = 0
  const registrationReminders = built.filter(
    ({ delivery }) => delivery.kind === REGISTRATION_REMINDER_KIND,
  )
  const otherNotifications = built.filter(
    ({ delivery }) => delivery.kind !== REGISTRATION_REMINDER_KIND,
  )

  for (const reminderChunk of chunks(registrationReminders, 5)) {
    const results = await Promise.all(
      reminderChunk.map((notification) => sendRegistrationReminder(notification)),
    )
    sent += results.reduce((total, result) => total + result.sent, 0)
    failed += results.reduce((total, result) => total + result.failed, 0)
    sendTimeSkipped += results.reduce((total, result) => total + result.skipped, 0)
  }

  for (const batch of chunks(otherNotifications, BATCH_SIZE)) {
    const result = await sendBatch(batch)
    sent += result.sent
    failed += result.failed
  }

  return {
    mode,
    checked: candidates.length,
    reserved: reserved.length,
    sent,
    skipped: skipped.length + sendTimeSkipped,
    failed,
  }
}
