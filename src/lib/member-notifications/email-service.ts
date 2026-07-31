import { createHash } from "node:crypto"
import { Resend } from "resend"
import { formatEventDateTime } from "@/lib/events/calendar"
import type { EventRecord } from "@/lib/events/types"
import { createAdminClient } from "@/lib/supabase/admin"

type NetlifyRuntime = {
  env?: {
    get(name: string): string | undefined
  }
}

declare const Netlify: NetlifyRuntime | undefined

export type MemberNotificationKind =
  | "new_event"
  | "connection_request_received"
  | "connection_request_accepted"

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
  connection_id: string | null
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
      `${requesterName} is interested in connecting with you through the IPN community.`,
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
          connection_id: null,
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
        connection_id: connectionId,
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
  const connectionIds = [
    ...new Set(
      deliveries.flatMap((delivery) =>
        delivery.connection_id ? [delivery.connection_id] : [],
      ),
    ),
  ]

  const [profilesResult, eventsResult, connectionsResult] = await Promise.all([
    profileIds.length
      ? admin
          .from("profiles")
          .select("id, email, first_name, last_name, is_banned")
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? admin.from("events").select("*").in("id", eventIds)
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
  if (connectionsResult.error) throw new Error(connectionsResult.error.message)

  const profileById = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
  )
  const eventById = new Map(
    ((eventsResult.data ?? []) as EventRecord[]).map((event) => [event.id, event]),
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
    await upsertDeliveries(
      batch.map(({ delivery }) => ({
        ...delivery,
        status: "failed",
        attempt_count: delivery.attempt_count + 1,
        last_error: "RESEND_API_KEY is not configured",
        updated_at: now,
      })),
    )
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
    await upsertDeliveries(
      batch.map(({ delivery }) => ({
        ...delivery,
        status: "failed",
        attempt_count: delivery.attempt_count + 1,
        last_error: error.message,
        updated_at: now,
      })),
    )
    return { sent: 0, failed: batch.length }
  }

  await upsertDeliveries(
    batch.map(({ delivery }, index) => ({
      ...delivery,
      status: "sent",
      resend_email_id: data?.data[index]?.id ?? null,
      attempt_count: delivery.attempt_count + 1,
      last_error: null,
      sent_at: now,
      updated_at: now,
    })),
  )
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
