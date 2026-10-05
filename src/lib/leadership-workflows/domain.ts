export type Kind = "media" | "expense"
export const MEDIA_STATUSES = [
  "submitted",
  "needs_information",
  "accepted",
  "assigned",
  "in_production",
  "director_review",
  "ready_to_post",
  "posted",
  "cancelled"
] as const
export const EXPENSE_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "purchased",
  "awaiting_reimbursement",
  "reimbursed",
  "cancelled"
] as const
export type Status =
  (typeof MEDIA_STATUSES)[number] | (typeof EXPENSE_STATUSES)[number]
export const STATUS_LABELS: Record<Status, string> = {
  submitted: "Submitted",
  needs_information: "Needs information",
  accepted: "Accepted",
  assigned: "Assigned",
  in_production: "In production",
  director_review: "Director review",
  ready_to_post: "Ready to post",
  posted: "Posted",
  pending: "Pending approval",
  approved: "Awaiting purchase",
  rejected: "Rejected",
  purchased: "Purchased",
  awaiting_reimbursement: "Awaiting reimbursement",
  reimbursed: "Reimbursed",
  cancelled: "Cancelled"
}
export type Person = {
  id: string
  name: string
  email: string
  team: string | null
}
export type AssetLink = { label: string; url: string }
export const MEDIA_FORMATS = [
  "Media to advise",
  "Image",
  "Carousel",
  "Story",
  "Short video",
  "Long video",
  "Blog / article",
  "Newsletter",
  "Email Campaign",
  "Other"
] as const
export function mediaFormats(media: MediaBrief): string[] {
  return media.formats?.length
    ? media.formats
    : [media.format || "Media to advise"]
}
export type Deliverable = {
  id: string
  name: string
  platform: string
  format: string
  assigneeId: string
  publisherId: string
  scheduledDate: string
  status: "planned" | "in_production" | "review" | "ready" | "posted"
  assetUrl: string
  publishedUrl: string
  postedDate: string
}
export type MediaBrief = {
  type: "event" | "announcement" | "campaign" | "educational"
  team: string
  brief: string
  postedBy: string
  urgent: boolean
  platforms: string[]
  format: string
  needsCopyHelp: boolean
  formats?: string[]
  headline: string
  body: string
  caption: string
  links: AssetLink[]
  destinationUrl?: string
  linkPlacement?: string
  linkConfirmedAt?: string
  linkConfirmedBy?: string
  eventId: string
  eventDetails: string
  deliverables: Deliverable[]
  productionOwnerId: string
  publisherId: string
  acceptedBy?: string
  acceptedAt?: string
  reviewedBy?: string
  reviewedAt?: string
}
export type Expense = {
  purpose: string
  amountCents: number
  itemUrl: string
  expectedMonth: string
  approvedBy?: string
  approvedAt?: string
  approvedAmountCents?: number
  paymentMethod?: "ipn_card" | "personal"
  actualAmountCents?: number
  purchaseDate?: string
  paidDate?: string
  account?: string
  receiptUrl: string
  bankTransactionId?: string
}
export type WorkflowRequest = {
  id: string
  kind: Kind
  requesterId: string
  requesterName: string
  requesterEmail: string
  title: string
  status: Status
  revision: number
  submittedAt: string
  updatedAt: string
  media?: MediaBrief
  expense?: Expense
}
export type Activity = {
  id: string
  requestId: string
  actorName: string
  event: string
  note: string
  createdAt: string
}
export type BankEntry = {
  id: string
  date: string
  amountCents: number
  description: string
  account: string
  requestId?: string
}
export type EventOption = {
  id: string
  title: string
  details: string
  postedBy: string
}
export type Cash = {
  relayCents: number
  relayAsOf: string
  reconsiderCents: number
  reconsiderAsOf: string
  reconsiderEstimated: boolean
  source: string
}
export type Bootstrap = {
  user: Person
  approverId: string
  people: Person[]
  events: EventOption[]
  requests: WorkflowRequest[]
  activity: Activity[]
  bankEntries: BankEntry[]
  cash: Cash | null
  demo: boolean
  integrations: { slack: boolean; sheets: boolean; pending: number }
}
export class WorkflowError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new WorkflowError("Invalid request details.")
  return value as Record<string, unknown>
}
export function text(
  value: unknown,
  label: string,
  required = false,
  max = 8000
): string {
  if (value != null && typeof value !== "string")
    throw new WorkflowError(`${label} must be text.`)
  const result = (value as string | undefined)?.trim() ?? ""
  if ((required && !result) || result.length > max)
    throw new WorkflowError(
      `${label} ${!result ? "is required" : "is too long"}.`
    )
  return result
}
export function cents(value: unknown): number {
  const n =
    typeof value === "string" && /^\d+(\.\d{1,2})?$/.test(value)
      ? Math.round(Number(value) * 100)
      : value
  if (!Number.isSafeInteger(n) || Number(n) <= 0 || Number(n) > 100_000_000)
    throw new WorkflowError(
      "Enter a positive USD amount with no more than two decimal places."
    )
  return Number(n)
}
export function date(value: unknown, label = "Date", required = true): string {
  const v = text(value, label, required, 10)
  if (!v && !required) return ""
  const parsed = new Date(v + "T12:00:00Z")
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== v
  )
    throw new WorkflowError(`${label} must be a valid date.`)
  return v
}
export function url(
  value: unknown,
  label = "Link",
  assetsOnly = false
): string {
  const v = text(value, label, false, 2000)
  if (!v) return ""
  let u: URL
  try {
    u = new URL(v)
  } catch {
    throw new WorkflowError(`${label} must be a full HTTPS link.`)
  }
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (assetsOnly &&
      ![
        "drive.google.com",
        "docs.google.com",
        "canva.com",
        "www.canva.com"
      ].includes(u.hostname))
  )
    throw new WorkflowError(
      assetsOnly
        ? `${label} must link to Google Drive or Canva.`
        : `${label} must be a full HTTPS link.`
    )
  return u.href
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 10)
    throw new WorkflowError("Choose the requested platforms.")
  return value.map((v) => text(v, "Platform", true, 80))
}
export function parseMedia(value: unknown): MediaBrief {
  const v = object(value)
  const type = text(v.type, "Request type", true)
  if (!["event", "announcement", "campaign", "educational"].includes(type))
    throw new WorkflowError("Choose a request type.")
  const links = Array.isArray(v.links) ? v.links : []
  if (links.length > 20)
    throw new WorkflowError("Use at most 20 supporting links.")
  const headline = text(v.headline, "Headline", false, 1000)
  const body = text(v.body, "Body")
  const caption = text(v.caption, "Caption")
  if (v.needsCopyHelp !== true && !headline && !body && !caption)
    throw new WorkflowError("Choose copywriting help or provide draft copy.")
  const formats =
    v.formats === undefined
      ? [text(v.format, "Media format", false, 100) || "Media to advise"]
      : strings(v.formats)
  if (
    !formats.length ||
    (v.formats !== undefined &&
      formats.some(
        (f) => !MEDIA_FORMATS.includes(f as (typeof MEDIA_FORMATS)[number])
      ))
  )
    throw new WorkflowError(
      "Choose at least one media format, or Media to advise."
    )
  const destinationUrl = url(v.destinationUrl, "Link to include")
  const linkPlacement = text(
    v.linkPlacement,
    "Where to include the link",
    Boolean(destinationUrl),
    1000
  )
  if (linkPlacement && !destinationUrl)
    throw new WorkflowError(
      "Add the destination URL for the link instructions."
    )
  const uniqueFormats = [...new Set(formats)]
  if (uniqueFormats.includes("Media to advise") && uniqueFormats.length > 1)
    throw new WorkflowError("Choose specific formats or Media to advise.")
  return {
    type: type as MediaBrief["type"],
    team: text(v.team, "Team / project", true, 150),
    brief: text(v.brief, "Idea / brief", true),
    postedBy: date(v.postedBy, "Posted-by date"),
    urgent: v.urgent === true,
    platforms: strings(v.platforms ?? ["Media to advise"]),
    formats: uniqueFormats,
    format: uniqueFormats.join(", "),
    destinationUrl,
    linkPlacement,
    needsCopyHelp: v.needsCopyHelp === true,
    headline,
    body,
    caption,
    links: links
      .map((l) => {
        const x = object(l)
        return {
          label:
            text(x.label, "Link label", false, 150) || "Supporting material",
          url: url(x.url, "Supporting material", true)
        }
      })
      .filter((l) => l.url),
    eventId: text(v.eventId, "Event", false, 200),
    eventDetails: text(v.eventDetails, "Event details"),
    productionOwnerId: "",
    publisherId: "",
    deliverables: []
  }
}
export function parseExpense(value: unknown): Expense {
  const v = object(value)
  return {
    purpose: text(v.purpose, "Purpose", true),
    amountCents: cents(v.amountCents),
    itemUrl: url(v.itemUrl, "Item / expense link"),
    expectedMonth: "",
    receiptUrl: ""
  }
}
export function createRequest(
  input: unknown,
  actor: Person,
  now = new Date()
): WorkflowRequest {
  const v = object(input)
  if (v.kind !== "media" && v.kind !== "expense")
    throw new WorkflowError("Choose a request workflow.")
  const id = text(v.id, "Request ID", true, 36)
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  )
    throw new WorkflowError("Invalid request ID.")
  return {
    id,
    kind: v.kind,
    requesterId: actor.id,
    requesterName: actor.name,
    requesterEmail: actor.email,
    title: text(
      v.title,
      v.kind === "media" ? "Idea name" : "Expense",
      true,
      180
    ),
    status: v.kind === "media" ? "submitted" : "pending",
    revision: 1,
    submittedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    ...(v.kind === "media"
      ? { media: parseMedia(v.media) }
      : { expense: parseExpense(v.expense) })
  }
}
export function canRead(
  r: WorkflowRequest,
  actorId: string,
  approverId: string
) {
  return (
    r.kind === "media" || r.requesterId === actorId || actorId === approverId
  )
}
const transitions: Record<string, string[]> = {
  submitted: ["needs_information", "accepted", "cancelled"],
  needs_information: ["submitted", "accepted", "cancelled"],
  accepted: ["assigned", "needs_information", "cancelled"],
  assigned: ["in_production", "needs_information", "cancelled"],
  in_production: ["director_review", "cancelled"],
  director_review: ["in_production", "ready_to_post", "cancelled"],
  ready_to_post: ["in_production", "posted", "cancelled"],
  cancelled: ["submitted"]
}
export function mediaNextStatuses(status: Status) {
  return (transitions[status] ?? []) as Status[]
}
export function applyChange(
  current: WorkflowRequest,
  input: unknown,
  actor: Person,
  approverId: string,
  people: Person[],
  now = new Date()
): { record: WorkflowRequest; event: string; note: string } {
  if (!canRead(current, actor.id, approverId))
    throw new WorkflowError("You do not have access to this expense.", 403)
  const v = object(input)
  if (v.revision !== current.revision)
    throw new WorkflowError(
      "This request has changed. Reload it before saving.",
      409
    )
  const action = text(v.action, "Action", true)
  const note = text(v.note, "Note")
  const record = structuredClone(current)
  const isApprover = actor.id === approverId
  const member = (id: string) => {
    if (id && !people.some((p) => p.id === id))
      throw new WorkflowError("Choose a current leadership team member.")
    return id
  }
  if (action === "comment") {
    if (record.kind === "expense")
      throw new WorkflowError(
        "Discuss expense requests in Slack. Activity history is recorded automatically."
      )
    if (!note) throw new WorkflowError("Write a comment first.")
  } else if (record.kind === "media") {
    const m = record.media!
    if (record.status === "posted")
      throw new WorkflowError(
        "Posted requests retain their final record. Add a comment or create a follow-up request."
      )
    if (action === "edit") {
      const edited = parseMedia(v.media)
      record.title = text(v.title, "Idea name", true, 180)
      record.media = {
        ...m,
        ...edited,
        productionOwnerId: m.productionOwnerId,
        publisherId: m.publisherId,
        deliverables: m.deliverables
      }
      if (
        edited.destinationUrl !== m.destinationUrl ||
        edited.linkPlacement !== m.linkPlacement
      ) {
        delete record.media.linkConfirmedAt
        delete record.media.linkConfirmedBy
      }
      if (
        !["submitted", "needs_information", "cancelled"].includes(record.status)
      ) {
        record.status = "director_review"
        delete record.media.reviewedAt
        delete record.media.reviewedBy
      }
    } else if (action === "production" || action === "publication") {
      const publication =
        action === "publication" ? object(v.publication) : null
      let publicationPosted = false
      if (publication) {
        if (m.deliverables.length > 1)
          throw new WorkflowError(
            "This older request has several outputs. Retain its records and create separate requests for new work."
          )
        const publishedUrl = url(publication.publishedUrl, "Published link")
        const postedDate = date(publication.postedDate, "Posted date", false)
        if (Boolean(publishedUrl) !== Boolean(postedDate))
          throw new WorkflowError(
            "Add both the published link and actual posting date."
          )
        publicationPosted = Boolean(publishedUrl && postedDate)
        if (
          publicationPosted &&
          m.destinationUrl &&
          publication.linkIncluded !== true
        )
          throw new WorkflowError(
            "Confirm that the requested link was included in the specified location before marking this request Posted."
          )
        const old = m.deliverables[0]
        v.deliverables = [
          {
            ...publication,
            id: old?.id || `publication-${record.id}`,
            name: record.title.slice(0, 150),
            platform: m.platforms.join(", ").slice(0, 80) || "Media to advise",
            format: mediaFormats(m).join(", ").slice(0, 80),
            assigneeId: "",
            status: publicationPosted
              ? "posted"
              : ["director_review", "ready_to_post"].includes(record.status)
                ? "review"
                : "planned"
          }
        ]
      }
      m.productionOwnerId = member(
        text(v.ownerId ?? v.productionOwnerId, "Media owner", false, 36)
      )
      // Retain the legacy keys for stored records; both duties use one owner.
      m.publisherId = m.productionOwnerId
      if (!Array.isArray(v.deliverables) || v.deliverables.length > 30)
        throw new WorkflowError("Use at most 30 deliverables.")
      m.deliverables = v.deliverables.map((value) => {
        const d = object(value)
        const status = text(d.status, "Deliverable status", true)
        if (
          !["planned", "in_production", "review", "ready", "posted"].includes(
            status
          )
        )
          throw new WorkflowError("Invalid deliverable status.")
        const deliverableId = text(d.id, "Deliverable ID", true, 80)
        const old = m.deliverables.find((x) => x.id === deliverableId)
        const assigneeId = member(
          text(d.assigneeId, "Deliverable owner", false, 36)
        )
        const ownerId = assigneeId || m.productionOwnerId
        const result: Deliverable = {
          id: deliverableId,
          name: text(d.name, "Deliverable name", true, 150),
          platform: text(d.platform, "Platform", true, 80),
          format: text(d.format, "Format", false, 80),
          assigneeId,
          publisherId: old?.status === "posted" ? old.publisherId : ownerId,
          scheduledDate: date(d.scheduledDate, "Scheduled date", false),
          status: status as Deliverable["status"],
          assetUrl: url(d.assetUrl, "Final asset", true),
          publishedUrl: url(d.publishedUrl, "Published link"),
          postedDate: date(d.postedDate, "Posted date", false)
        }
        if (
          old?.status === "posted" &&
          JSON.stringify(old) !== JSON.stringify(result)
        )
          throw new WorkflowError(
            "Posted deliverables retain their final record."
          )
        if (["ready", "posted"].includes(status) && !result.assetUrl)
          throw new WorkflowError(
            "Add a final asset link before marking a deliverable ready."
          )
        if (
          status === "posted" &&
          (!result.publishedUrl || !result.postedDate || !result.publisherId)
        )
          throw new WorkflowError(
            "Record the publisher, posted date, and published link."
          )
        if (
          status === "posted" &&
          !["ready_to_post", "posted"].includes(record.status) &&
          old?.status !== "posted"
        )
          throw new WorkflowError(
            "Complete Director review before recording publication."
          )
        if (
          status === "posted" &&
          m.destinationUrl &&
          action !== "publication" &&
          !m.linkConfirmedAt
        )
          throw new WorkflowError(
            "Confirm inclusion of the requested link through the publication record first."
          )
        return result
      })
      if (
        new Set(m.deliverables.map((d) => d.id)).size !== m.deliverables.length
      )
        throw new WorkflowError("Deliverable IDs must be unique.")
      if (
        current.media!.deliverables.some(
          (d) =>
            d.status === "posted" && !m.deliverables.some((n) => n.id === d.id)
        )
      )
        throw new WorkflowError("Retain posted deliverables.")
      if (
        ["director_review", "ready_to_post"].includes(record.status) &&
        m.deliverables.some(
          (d) =>
            d.assetUrl !==
            current.media!.deliverables.find((old) => old.id === d.id)?.assetUrl
        )
      ) {
        record.status = "director_review"
        delete m.reviewedAt
        delete m.reviewedBy
      }
      if (
        ["director_review", "ready_to_post"].includes(record.status) &&
        m.deliverables.some(
          (d) =>
            d.status !== "posted" && !["ready", "review"].includes(d.status)
        )
      ) {
        record.status = "in_production"
        delete m.reviewedAt
        delete m.reviewedBy
      }
      if (publicationPosted) {
        if (record.status !== "ready_to_post")
          throw new WorkflowError(
            "Complete Director review of the final asset before recording publication."
          )
        if (m.destinationUrl) {
          m.linkConfirmedAt = now.toISOString()
          m.linkConfirmedBy = actor.id
        }
        record.status = "posted"
      }
    } else if (action === "status") {
      const status = text(v.status, "Status", true) as Status
      if (!mediaNextStatuses(record.status).includes(status))
        throw new WorkflowError(
          "That status change is not available from the current stage."
        )
      if (status === "needs_information" && !note)
        throw new WorkflowError("Explain what information is needed.")
      if (status === "assigned" && !m.productionOwnerId)
        throw new WorkflowError("Select a media owner first.")
      if (
        status === "ready_to_post" &&
        (!m.deliverables.length || m.deliverables.some((d) => !d.assetUrl))
      )
        throw new WorkflowError(
          "Add a final Drive or Canva link before the request is ready to post."
        )
      if (
        status === "posted" &&
        (!m.deliverables.length ||
          m.deliverables.some((d) => d.status !== "posted"))
      )
        throw new WorkflowError(
          "Record publication for every deliverable first."
        )
      if (status === "posted" && m.destinationUrl && !m.linkConfirmedAt)
        throw new WorkflowError(
          "Confirm inclusion of the requested link through the publication record first."
        )
      record.status = status
      if (status === "accepted") {
        m.acceptedBy = actor.id
        m.acceptedAt = now.toISOString()
      }
      if (status === "ready_to_post") {
        m.reviewedBy = actor.id
        m.reviewedAt = now.toISOString()
      }
    } else throw new WorkflowError("Unknown media action.")
  } else {
    const e = record.expense!
    if (action === "edit") {
      if (!["pending", "approved", "rejected"].includes(record.status))
        throw new WorkflowError(
          "Purchased expenses retain their payment record."
        )
      const edited = parseExpense(v.expense)
      record.title = text(v.title, "Expense", true, 180)
      const material =
        record.title !== current.title ||
        edited.purpose !== e.purpose ||
        edited.amountCents !== e.amountCents ||
        edited.itemUrl !== e.itemUrl
      record.expense = {
        ...e,
        ...edited,
        expectedMonth: e.expectedMonth,
        receiptUrl: e.receiptUrl
      }
      if (material || record.status === "rejected") {
        record.status = "pending"
        delete record.expense.approvedBy
        delete record.expense.approvedAt
        delete record.expense.approvedAmountCents
      }
    } else if (action === "approve" || action === "reject") {
      if (!isApprover)
        throw new WorkflowError("Only Justin can approve expenses.", 403)
      if (record.status !== "pending")
        throw new WorkflowError("This request has already been reviewed.", 409)
      const month = text(v.expectedMonth, "Expected month", false, 7)
      if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        throw new WorkflowError("Choose a valid expected spending month.")
      if (action === "reject" && !note)
        throw new WorkflowError("Add a reason for rejection.")
      record.status = action === "approve" ? "approved" : "rejected"
      e.expectedMonth = month
      if (action === "approve") {
        e.approvedBy = actor.id
        e.approvedAt = now.toISOString()
        e.approvedAmountCents = e.amountCents
      }
    } else if (action === "schedule") {
      if (!isApprover)
        throw new WorkflowError("Only Justin schedules spending.", 403)
      if (!["approved", "awaiting_reimbursement"].includes(record.status))
        throw new WorkflowError("Schedule an approved unpaid expense.")
      const month = text(v.expectedMonth, "Expected month", false, 7)
      if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        throw new WorkflowError("Choose a valid expected month.")
      e.expectedMonth = month
    } else if (action === "purchase") {
      if (record.status !== "approved")
        throw new WorkflowError("Get approval before recording a purchase.")
      if (v.paymentMethod !== "ipn_card" && v.paymentMethod !== "personal")
        throw new WorkflowError("Choose how it was paid.")
      if (v.paymentMethod === "ipn_card" && !isApprover)
        throw new WorkflowError(
          "Justin records payments from IPN accounts.",
          403
        )
      const actual = cents(v.actualAmountCents)
      if (actual > (e.approvedAmountCents ?? 0))
        throw new WorkflowError(
          "The actual cost exceeds approval. Update the request and get approval again."
        )
      const purchased = date(v.purchaseDate, "Purchase date")
      if (
        purchased < e.approvedAt!.slice(0, 10) ||
        purchased > now.toISOString().slice(0, 10)
      )
        throw new WorkflowError(
          "Use a purchase date after approval and no later than today."
        )
      e.actualAmountCents = actual
      e.paymentMethod = v.paymentMethod
      e.purchaseDate = purchased
      e.receiptUrl = url(v.receiptUrl, "Receipt", true)
      e.account =
        v.paymentMethod === "ipn_card"
          ? text(v.account, "Payment account", true, 80)
          : "Personal"
      if (
        e.account !== "Personal" &&
        !["Relay", "Reconsider"].includes(e.account)
      )
        throw new WorkflowError("Choose Relay or Reconsider.")
      e.paidDate = v.paymentMethod === "ipn_card" ? purchased : ""
      record.status =
        v.paymentMethod === "personal" ? "awaiting_reimbursement" : "purchased"
    } else if (action === "reimburse") {
      if (!isApprover)
        throw new WorkflowError(
          "Only Justin records reimbursement payments.",
          403
        )
      if (record.status !== "awaiting_reimbursement")
        throw new WorkflowError("This expense is not awaiting reimbursement.")
      e.paidDate = date(v.paidDate, "Reimbursement date")
      if (
        e.paidDate < e.purchaseDate! ||
        e.paidDate > now.toISOString().slice(0, 10)
      )
        throw new WorkflowError(
          "Use a reimbursement date after the purchase and no later than today."
        )
      e.account = text(v.account, "Payment account", true, 80)
      if (!["Relay", "Reconsider"].includes(e.account))
        throw new WorkflowError("Choose Relay or Reconsider.")
      record.status = "reimbursed"
    } else if (action === "receipt") {
      if (
        !["purchased", "awaiting_reimbursement", "reimbursed"].includes(
          record.status
        )
      )
        throw new WorkflowError(
          "Add a receipt after purchasing the approved expense."
        )
      e.receiptUrl = url(v.receiptUrl, "Receipt", true)
      if (!e.receiptUrl) throw new WorkflowError("Add a receipt link.")
    } else if (action === "cancel") {
      if (!["pending", "approved", "rejected"].includes(record.status))
        throw new WorkflowError("Paid expenses cannot be cancelled.")
      record.status = "cancelled"
    } else if (action === "match") {
      if (!isApprover)
        throw new WorkflowError("Only Justin reconciles bank activity.", 403)
      if (!["purchased", "reimbursed"].includes(record.status))
        throw new WorkflowError(
          "Record the completed IPN payment before matching it."
        )
      e.bankTransactionId = text(
        v.bankTransactionId,
        "Bank transaction",
        true,
        100
      )
    } else throw new WorkflowError("Unknown expense action.")
  }
  record.revision += 1
  record.updatedAt = now.toISOString()
  return { record, event: action, note }
}
export function unpaidCents(r: WorkflowRequest) {
  return r.kind === "expense" &&
    ["approved", "awaiting_reimbursement"].includes(r.status)
    ? (r.expense!.actualAmountCents ?? r.expense!.amountCents)
    : 0
}
export function projectedCash(
  cash: Cash,
  records: WorkflowRequest[],
  request: WorkflowRequest
) {
  const others = records
    .filter((r) => r.id !== request.id)
    .reduce((n, r) => n + unpaidCents(r), 0)
  const amount = request.expense!.amountCents
  return {
    afterRequest: cash.relayCents - amount,
    afterCommitments: cash.relayCents - amount - others,
    otherCommitments: others
  }
}
export function usd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(n / 100)
}
