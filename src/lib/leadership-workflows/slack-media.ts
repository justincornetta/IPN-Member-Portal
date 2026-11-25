import {
  EVENT_FIELD_LABELS,
  STATUS_LABELS,
  mediaFormats,
  mediaPostCaption,
  type MediaEdit,
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
  delivered: ":package:",
  needs_information: ":raising_hand:",
  cancelled: ":no_entry_sign:"
}
const BROADCAST_STATUSES = new Set<Status>([
  "needs_information",
  "cancelled",
  "posted",
  "delivered"
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

// "Requested post by" / "Needed by" value: TBD, a formatted date, or "Not set".
export function formatMediaDeadline(media: {
  postedBy?: string
  postedByTbd?: boolean
}) {
  return media.postedByTbd ? "TBD" : formatMediaDate(media.postedBy)
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

const list = (values?: string[]) => (values || []).filter(Boolean).join(", ")
const linkList = (r: WorkflowRequest) =>
  (r.media?.links || []).map((l) => l.url).join("\n")

// Compare the fields a requester can edit and describe each change.
export function detectMediaEdits(
  previous: WorkflowRequest,
  next: WorkflowRequest
): MediaEdit[] {
  const a = previous.media
  const b = next.media
  if (!a || !b) return []
  const edits: MediaEdit[] = []
  const short = (label: string, from: string, to: string) => {
    if (from.trim() !== to.trim())
      edits.push({ label, from: from.trim(), to: to.trim() })
  }
  const long = (label: string, from: string, to: string) => {
    if (from.trim() !== to.trim()) edits.push({ label, text: to.trim() })
  }
  const isEvent = b.type === "event"
  short("Idea name", previous.title, next.title)
  short("Request type", MEDIA_TYPE_LABELS[a.type] || a.type, MEDIA_TYPE_LABELS[b.type] || b.type)
  short("Team / project", a.team, b.team)
  short(
    b.assetOnly ? "Needed by" : "Requested post by",
    formatMediaDeadline(a),
    formatMediaDeadline(b)
  )
  short(
    "Use",
    a.assetOnly ? "Asset for partner/internal use" : "Posted by IPN",
    b.assetOnly ? "Asset for partner/internal use" : "Posted by IPN"
  )
  short("Priority", a.urgent ? "Urgent" : "Standard", b.urgent ? "Urgent" : "Standard")
  short(
    "Placeholder",
    a.placeholder ? "Yes, not ready for production" : "No",
    b.placeholder ? "Yes, not ready for production" : "No"
  )
  short("Platforms", list(a.platforms), list(b.platforms))
  short("Formats", list(mediaFormats(a)), list(mediaFormats(b)))
  for (const [key, label] of EVENT_FIELD_LABELS)
    short(label, a.eventFields?.[key] || "", b.eventFields?.[key] || "")
  if (!b.eventFields) long("Event details", a.eventDetails || "", b.eventDetails || "")
  long(isEvent ? "Event description" : "Brief", a.brief, b.brief)
  short(
    "Copywriting",
    a.needsCopyHelp ? "Media team drafts" : "Requester writes",
    b.needsCopyHelp ? "Media team drafts" : "Requester writes"
  )
  long(b.assetOnly ? "Partner captions" : "Caption", mediaPostCaption(a), mediaPostCaption(b))
  long("Usage notes", a.usageNotes || "", b.usageNotes || "")
  short("Link to include", a.destinationUrl || "", b.destinationUrl || "")
  short("Where to include it", a.linkPlacement || "", b.linkPlacement || "")
  long("Files", linkList(previous), linkList(next))
  long("Additional details", a.additionalDetails || "", b.additionalDetails || "")
  return edits
}

export function detectMediaSlackChange(
  previous: WorkflowRequest | undefined,
  next: WorkflowRequest,
  event: string,
  note = "",
  actorName = ""
): MediaSlackChange {
  const edits =
    event === "edit" && previous ? detectMediaEdits(previous, next) : []
  return {
    ...(edits.length ? { edits, editedBy: actorName } : {}),
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
    publishedUrl: mediaPublishedUrl(next),
    ...(next.media?.assetOnly ? { assetOnly: true } : {})
  }
}

export function shouldNotifyMediaSlack(
  event: string,
  change?: MediaSlackChange | null
) {
  if (event === "comment") return false
  if (event === "submitted") return true
  return shouldUpdateMediaParent(change)
}

export function shouldBroadcastMediaReply(change?: MediaSlackChange | null) {
  return !!(change?.statusChanged && BROADCAST_STATUSES.has(change.status))
}

export function shouldUpdateMediaParent(change?: MediaSlackChange | null) {
  return !!(
    change &&
    (change.statusChanged ||
      change.ownerChanged ||
      change.scheduledDateChanged ||
      change.edits?.length)
  )
}

export function mediaJobsFor(
  r: WorkflowRequest,
  event: string,
  previous?: WorkflowRequest,
  note = ""
): MediaJobSpec[] {
  if (r.kind !== "media" || r.deletedAt) return []
  if (event === "comment") return []
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
  note = "",
  actorName = ""
): WorkflowRequest {
  if (r.kind !== "media") return r
  const next = { ...r }
  if (event === "submitted" || !previous) {
    delete next.slackChange
    return next
  }
  const slackChange = detectMediaSlackChange(previous, r, event, note, actorName)
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
  if (m.placeholder)
    lines.push(":construction: Placeholder, not ready for production")
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
  if (m.assetOnly)
    lines.push("*Use:* Asset for partner/internal use, not posted by IPN")
  lines.push(
    `:calendar: *${m.assetOnly ? "Needed by" : "Requested post by"}:* ${formatMediaDeadline(m)}`
  )
  lines.push(
    `:calendar: *${m.assetOnly ? "Planned delivery date" : "Planned post date"}:* ${formatMediaDate(mediaScheduledDate(r))}`
  )
  lines.push(`*Platforms:* ${displayField(m.platforms?.join(", "))}`)
  lines.push(`*Formats:* ${displayField(mediaFormats(m).join(", "))}`)
  lines.push(
    `:link: *Link to include:* ${
      m.destinationUrl ? escapeSlack(m.destinationUrl) : "Not set"
    }`
  )
  lines.push(`*Where:* ${displayField(m.linkPlacement)}`)
  // Slack section text is capped at 3,000 characters, so event fields share
  // the brief's 1,800-character budget.
  let briefBudget = 1800
  if (m.eventFields) {
    lines.push("")
    for (const [key, label] of EVENT_FIELD_LABELS) {
      const value = m.eventFields[key]
      if (!value) continue
      const line = `*${label}:* ${escapeSlack(
        value.length > 200 ? `${value.slice(0, 199)}…` : value
      )}`
      lines.push(line)
      briefBudget -= line.length + 1
    }
  }
  lines.push("")
  lines.push(displayField(m.brief?.slice(0, Math.max(500, briefBudget))))
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
  const mentions = [mentionOrName(options.submitter, "Submitter")]
  // Edits matter most to whoever is producing the content.
  if (
    change.edits?.length &&
    !change.ownerChanged &&
    options.owner &&
    (options.owner.slackId || options.owner.name) &&
    mentionOrName(options.owner) !== mentions[0]
  )
    mentions.push(mentionOrName(options.owner))
  const lines = [mentions.join(" ")]
  if (change.edits?.length) {
    lines.push(
      `:pencil2: *Request edited${change.editedBy ? ` by ${escapeSlack(change.editedBy)}` : ""}*`
    )
    let budget = 2400
    for (const edit of change.edits) {
      const label = `*${escapeSlack(edit.label)}*`
      if (edit.text !== undefined) {
        if (!edit.text) {
          lines.push(`• ${label}: _removed_`)
          continue
        }
        const limit = Math.max(200, Math.min(1500, budget))
        const body =
          edit.text.length > limit ? `${edit.text.slice(0, limit - 1)}…` : edit.text
        budget -= body.length
        lines.push(`• ${label} updated:`)
        lines.push(
          escapeSlack(body)
            .split("\n")
            .map((line) => `>${line ? ` ${line}` : ""}`)
            .join("\n")
        )
      } else {
        const from = edit.from ? `~${escapeSlack(edit.from)}~ → ` : ""
        const to = edit.to ? escapeSlack(edit.to) : "_removed_"
        lines.push(`• ${label}: ${from}${to}`)
      }
    }
  }
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
    const planned = change.assetOnly
      ? "Planned delivery date"
      : "Planned post date"
    if (!change.scheduledDate)
      lines.push(`:calendar: ${planned} cleared`)
    else if (!change.previousScheduledDate)
      lines.push(
        `:calendar: ${planned} set to ${formatMediaDate(change.scheduledDate)}`
      )
    else
      lines.push(
        `:calendar: ${planned}: ${formatMediaDate(change.previousScheduledDate)} → ${formatMediaDate(change.scheduledDate)}`
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
