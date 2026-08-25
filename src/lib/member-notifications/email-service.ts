import { createHash } from "node:crypto"
import { Resend } from "resend"
import { formatConferenceDateRange, formatMeetupDateTime } from "@/lib/conferences/format"
import type {
  ConferenceDiscount,
  ConferenceMeetup,
  ConferenceRecord,
} from "@/lib/conferences/types"
import { formatEventDateTime } from "@/lib/events/calendar"
import type { EventRecord } from "@/lib/events/types"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendOpsAlert } from "@/lib/slack/ops-alert"

type NetlifyRuntime = {
  env?: {
    get(name: string): string | undefined
  }
}

declare const Netlify: NetlifyRuntime | undefined

export type MemberNotificationKind =
  | "new_event"
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
  if (mode === "live") return true
  if (mode === "test") return testRecipients().has(normalizeEmail(email))
  return false
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

function conferenceLocation(conference: ConferenceRecord) {
  return [conference.venue, conference.city, conference.state, conference.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ") || "Location to be announced"
}

function newConferenceEmail(
  conference: ConferenceRecord,
  recipient: ProfileRow,
): EmailContent {
  return {
    subject: `New conference opportunity: ${conference.name}`,
    preview: `${conference.name} is now in the IPN Member Portal.`,
    greeting: `Hi ${firstName(recipient)},`,
    body: [
      "We just added a new conference opportunity to the IPN Member Portal.",
    ],
    details: [
      { label: "Conference", value: conference.name },
      {
        label: "When",
        value: formatConferenceDateRange(
          conference.starts_at,
          conference.ends_at,
          conference.timezone,
        ),
      },
      { label: "Where", value: conferenceLocation(conference) },
      ...(conference.organizer
        ? [{ label: "Organizer", value: conference.organizer }]
        : []),
    ],
    afterDetails: [
      "Open the portal to learn why this conference may be worth attending, see available IPN member discounts and meetups, and find other members who plan to go.",
    ],
    buttonLabel: "View conference",
    buttonUrl: conferenceUrl(conference),
    receiptReason:
      "You are receiving this because you have an IPN Member Portal account.",
  }
}

function conferenceMeetupEmail(
  conference: ConferenceRecord,
  meetup: ConferenceMeetup,
  recipient: ProfileRow,
): EmailContent {
  return {
    subject: `New IPN meetup at ${conference.name}`,
    preview: `${meetup.title} has been added to ${conference.name}.`,
    greeting: `Hi ${firstName(recipient)},`,
    body: [
      `IPN just added a new member meetup during ${conference.name}.`,
    ],
    details: [
      { label: "Meetup", value: meetup.title },
      {
        label: "When",
        value: formatMeetupDateTime(meetup.startsAt, conference.timezone),
      },
      { label: "Where", value: meetup.location ?? "Location to be announced" },
    ],
    afterDetails: [
      ...(meetup.description ? [meetup.description] : []),
      "Open the conference page to learn more, tell other members you’re going, and RSVP to the meetup.",
    ],
    buttonLabel: "View meetup",
    buttonUrl: conferenceUrl(conference),
    receiptReason:
      "You are receiving this because you have an IPN Member Portal account.",
  }
}

function conferenceDiscountEmail(
  conference: ConferenceRecord,
  discount: ConferenceDiscount,
  recipient: ProfileRow,
): EmailContent {
  const expires = discount.expiresAt
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: conference.timezone,
      }).format(new Date(discount.expiresAt))
    : null

  return {
    subject: `New IPN member discount for ${conference.name}`,
    preview: `${discount.label} is now available to IPN members.`,
    greeting: `Hi ${firstName(recipient)},`,
    body: [
      `A new member discount is now available for ${conference.name}.`,
    ],
    details: [
      { label: "Discount", value: discount.label },
      ...(discount.code ? [{ label: "Code", value: discount.code }] : []),
      ...(expires ? [{ label: "Expires", value: expires }] : []),
    ],
    afterDetails: [
      ...(discount.description ? [discount.description] : []),
      ...(discount.howToApply
        ? [`How to apply: ${discount.howToApply}`]
        : []),
      "Open the conference page to see the complete offer and registration details.",
    ],
    buttonLabel: "View member discount",
    buttonUrl: conferenceUrl(conference),
    receiptReason:
      "You are receiving this because you have an IPN Member Portal account.",
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

  const [profilesResult, eventsResult, conferencesResult, connectionsResult] = await Promise.all([
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
  ])

  if (profilesResult.error) throw new Error(profilesResult.error.message)
  if (eventsResult.error) throw new Error(eventsResult.error.message)
  if (conferencesResult.error) throw new Error(conferencesResult.error.message)
  if (connectionsResult.error) throw new Error(connectionsResult.error.message)

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
  for (const batch of chunks(built, BATCH_SIZE)) {
    const result = await sendBatch(batch)
    sent += result.sent
    failed += result.failed
  }

  return {
    mode,
    checked: candidates.length,
    reserved: reserved.length,
    sent,
    skipped: skipped.length,
    failed,
  }
}
