import {
  STATUS_LABELS,
  mediaFormats,
  type MediaSlackChange,
  type Status,
  type WorkflowRequest
} from "./domain.ts"

export const DIRECTOR_SLACK_ID = "U0C5PPBBEK1"
export const MEDIA_TYPE_LABELS: Record<
  NonNullable<WorkflowRequest["media"]>["type"],
  string
> = {
  event: "Event",
  announcement: "Announcement",
  campaign: "Campaign",
  educational: "Educational content"
}
export const MEDIA_STATUS_EMOJI: Partial<Record<Status, string>> = {
  submitted: ":inbox_tray:",
  accepted: ":white_check_mark:",
  assigned: ":hammer_and_wrench:",
  in_production: ":hammer_and_wrench:",
  director_review: ":eyes:",
  ready_to_post: ":large_green_circle:",
  posted: ":tada:",
  needs_information: ":raising_hand:",
  cancelled: ":no_entry_sign:"
}
const BROADCAST_STATUSES = new Set<Status>([
  "needs_information",
  "cancelled",
  "posted"
])
export type SlackPersonRef = { name: string; slackId?: string }
export type MediaJobSpec = { target: string; recipientId?: string }

export function escapeSlack(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function mediaRequestUrl(r: WorkflowRequest) {
  const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://members.intercollegiatepsychedelics.net"
  return `${site}/dashboard/admin/media?request=${encodeURIComponent(r.id)}`
}

export function mediaScheduledDate(r?: WorkflowRequest | null) {
  return r?.media?.deliverables?.[0]?.scheduledDate || ""
}

export function mediaOwnerId(r?: WorkflowRequest | null) {
  return r?.media?.productionOwnerId || ""
}

export function mediaPublishedUrl(r?: WorkflowRequest | null) {
  const items = r?.media?.deliverables || []
  return items.find((d) => d.publishedUrl)?.publishedUrl || ""
}

export function displayField(value?: string | null) {
  const text = value?.trim()
  return text ? text : "Not set"
}

export function formatMediaDate(value?: string | null) {
  const text = value?.trim()
  if (!text) return "Not set"
  const date = new Date(`${text}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return text
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  })
}

export function mediaStatusEmoji(status: Status) {
  return MEDIA_STATUS_EMOJI[status] || ""
}

export function mediaStatusLabel(status: Status) {
  const emoji = mediaStatusEmoji(status)
  const label = STATUS_LABELS[status]
  return emoji ? `${emoji} ${label}` : label
}

export function mentionOrName(person?: SlackPersonRef | null, empty = "Not set") {
  if (!person?.name && !person?.slackId) return empty
  if (person.slackId) return `<@${person.slackId}>`
  return escapeSlack(person.name)
}

export function detectMediaSlackChange(
  previous: WorkflowRequest | undefined,
  next: WorkflowRequest,
  event: string,
  note = ""
): MediaSlackChange {
  return {
    event,
    statusChanged: !!previous && previous.status !== next.status,
    previousStatus: previous?.status,
    status: next.status,
    ownerChanged: !!previous && mediaOwnerId(previous) !== mediaOwnerId(next),
    previousOwnerId: mediaOwnerId(previous),
    ownerId: mediaOwnerId(next),
    scheduledDateChanged:
      !!previous && mediaScheduledDate(previous) !== mediaScheduledDate(next),
    previousScheduledDate: mediaScheduledDate(previous),
    scheduledDate: mediaScheduledDate(next),
    note,
    publishedUrl: mediaPublishedUrl(next)
  }
}

export function shouldNotifyMediaSlack(
  event: string,
  change?: MediaSlackChange | null
) {
  if (event === "comment" || event === "edit") return false
  if (event === "submitted") return true
  return !!(
    change &&
    (change.statusChanged ||
      change.ownerChanged ||
      change.scheduledDateChanged)
  )
}

export function shouldBroadcastMediaReply(change?: MediaSlackChange | null) {
  return !!(change?.statusChanged && BROADCAST_STATUSES.has(change.status))
}

export function shouldUpdateMediaParent(change?: MediaSlackChange | null) {
  return !!(
    change &&
    (change.statusChanged ||
      change.ownerChanged ||
      change.scheduledDateChanged)
  )
}

export function mediaJobsFor(
  r: WorkflowRequest,
  event: string,
  previous?: WorkflowRequest,
  note = ""
): MediaJobSpec[] {
  if (r.kind !== "media" || r.deletedAt) return []
  if (event === "comment" || event === "edit") return []
  const change =
    event === "submitted"
      ? null
      : r.slackChange || detectMediaSlackChange(previous, r, event, note)
  const jobs: MediaJobSpec[] = []
  if (shouldNotifyMediaSlack(event, change))
    jobs.push({ target: "slack_media" })
  if (
    change?.statusChanged &&
    change.status === "needs_information" &&
    r.requesterId
  )
    jobs.push({ target: "slack_dm", recipientId: r.requesterId })
  return jobs
}

export function withMediaSlackChange(
  r: WorkflowRequest,
  event: string,
  previous?: WorkflowRequest,
  note = ""
): WorkflowRequest {
  if (r.kind !== "media") return r
  const next = { ...r }
  if (event === "submitted" || !previous) {
    delete next.slackChange
    return next
  }
  const slackChange = detectMediaSlackChange(previous, r, event, note)
  if (shouldNotifyMediaSlack(event, slackChange)) next.slackChange = slackChange
  else delete next.slackChange
  return next
}

function parentLines(
  r: WorkflowRequest,
  options: { tagDirector?: boolean; ownerName?: string } = {}
) {
  const m = r.media!
  const lines: string[] = []
  if (m.urgent) lines.push(":triangular_flag_on_post: URGENT")
  lines.push(
    options.tagDirector
      ? `<@${DIRECTOR_SLACK_ID}>, new media request`
      : "Media request"
  )
  lines.push("")
  lines.push(`*Status:* ${mediaStatusLabel(r.status)}`)
  lines.push(`*Owner:* ${displayField(options.ownerName)}`)
  lines.push(`*${escapeSlack(r.title)}*`)
  lines.push(
    `${MEDIA_TYPE_LABELS[m.type] || displayField(m.type)} · ${escapeSlack(m.team) || "Not set"}`
  )
  lines.push(`From ${escapeSlack(r.requesterName) || "Not set"}`)
  lines.push(
    `:calendar: *Requested post by:* ${formatMediaDate(m.postedBy)}`
  )
  lines.push(
    `:calendar: *Planned post date:* ${formatMediaDate(mediaScheduledDate(r))}`
  )
  lines.push(`*Platforms:* ${displayField(m.platforms?.join(", "))}`)
  lines.push(`*Formats:* ${displayField(mediaFormats(m).join(", "))}`)
  lines.push(
    `:link: *Link to include:* ${
      m.destinationUrl ? escapeSlack(m.destinationUrl) : "Not set"
    }`
  )
  lines.push(`*Where:* ${displayField(m.linkPlacement)}`)
  lines.push("")
  lines.push(displayField(m.brief?.slice(0, 1800)))
  return lines
}

export function renderMediaParentText(
  r: WorkflowRequest,
  options: { tagDirector?: boolean; ownerName?: string } = {}
) {
  return `${parentLines(r, options).join("\n")}\n\nOpen request: ${mediaRequestUrl(r)}`
}

export function mediaParentMessage(
  r: WorkflowRequest,
  options: { tagDirector?: boolean; ownerName?: string } = {}
) {
  const body = parentLines(r, options).join("\n")
  return {
    text: renderMediaParentText(r, options),
    parse: "none" as const,
    unfurl_links: false,
    unfurl_media: false,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: body }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open request" },
            url: mediaRequestUrl(r)
          }
        ]
      }
    ]
  }
}

export function renderMediaThreadReply(
  change: MediaSlackChange,
  options: { submitter?: SlackPersonRef; owner?: SlackPersonRef } = {}
) {
  const lines = [mentionOrName(options.submitter, "Submitter")]
  if (change.ownerChanged && change.ownerId)
    lines.push(
      `:hammer_and_wrench: Assigned to ${mentionOrName(options.owner, "Unassigned")}`
    )
  else if (change.ownerChanged)
    lines.push("Owner cleared")
  if (change.statusChanged) {
    const from = change.previousStatus
      ? mediaStatusLabel(change.previousStatus)
      : "Not set"
    lines.push(
      `${mediaStatusEmoji(change.status)} Status: ${from} → ${mediaStatusLabel(change.status)}`.trim()
    )
  }
  if (change.scheduledDateChanged) {
    if (!change.scheduledDate)
      lines.push(":calendar: Planned post date cleared")
    else if (!change.previousScheduledDate)
      lines.push(
        `:calendar: Planned post date set to ${formatMediaDate(change.scheduledDate)}`
      )
    else
      lines.push(
        `:calendar: Planned post date: ${formatMediaDate(change.previousScheduledDate)} → ${formatMediaDate(change.scheduledDate)}`
      )
  }
  if (change.status === "posted" && change.publishedUrl)
    lines.push(`:tada: Published: ${escapeSlack(change.publishedUrl)}`)
  if (
    (change.status === "needs_information" || change.status === "cancelled") &&
    change.note
  )
    lines.push(escapeSlack(change.note).slice(0, 1800))
  return lines.join("\n")
}

export function mediaThreadReplyMessage(
  change: MediaSlackChange,
  options: { submitter?: SlackPersonRef; owner?: SlackPersonRef } = {}
) {
  const text = renderMediaThreadReply(change, options)
  return {
    text,
    parse: "none" as const,
    unfurl_links: false,
    unfurl_media: false
  }
}
