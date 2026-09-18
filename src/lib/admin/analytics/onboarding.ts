export const ONBOARDING_MILESTONES = [
  { id: "whatsapp", label: "Choose WhatsApp preference" },
  { id: "profile", label: "Complete profile" },
  { id: "tour", label: "Take the Portal tour" },
  { id: "participate", label: "Participate in IPN" },
] as const

export type OnboardingMilestoneId = (typeof ONBOARDING_MILESTONES)[number]["id"]

export type AnalyticsEligibilityProfile = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  created_at?: string | null
  last_sign_in_at?: string | null
  is_banned?: boolean | null
  exclude_from_analytics?: boolean | null
  whatsapp_url?: string | null
}

export type OnboardingProgressInput = {
  user_id: string
  whatsapp_current_step?: string | null
  whatsapp_completed_at: string | null
  profile_completed_at: string | null
  product_tour_completed_at: string | null
  connection_request_completed_at?: string | null
  event_rsvp_completed_at?: string | null
}

export type ParticipationActivityInput = {
  id?: string
  user_id: string
  activity_type:
    | "portal_event_rsvp"
    | "conference_rsvp"
    | "conference_meetup_rsvp"
    | "eventbrite_ticket"
    | "connection_request_sent"
  action: "completed" | "cancelled"
  source_system?: string
  source_record_id?: string
  occurred_at: string
  metadata?: Record<string, unknown> | null
}

export type OnboardingAnalyticsData = {
  generatedAt: string
  eligibleMembers: number
  excludedMembers: number
  completedMembers: number
  completionRate: number
  progressDistribution: { completed: number; members: number }[]
  outstandingMilestones: { id: OnboardingMilestoneId; label: string; members: number }[]
  participationAttribution: {
    type: ParticipationActivityInput["activity_type"] | "unknown"
    label: string
    members: number
    activities: number
  }[]
  members: {
    userId: string
    name: string
    email: string
    registrationDate: string | null
    lastSignedInAt: string | null
    completedCount: number
    completedAt: string | null
    lastStepCompletedAt: string | null
    milestone4Activity: string
    milestone4Type: ParticipationActivityInput["activity_type"] | "unknown" | null
    milestone4OccurredAt: string | null
    whatsappStatus: "already_in" | "not_interested" | "completed" | "pending"
    whatsappContactProvided: boolean
    milestones: Record<OnboardingMilestoneId, string | null>
    participation: ParticipationActivityInput[]
  }[]
}

const PARTICIPATION_LABELS: Record<ParticipationActivityInput["activity_type"], string> = {
  portal_event_rsvp: "Portal event RSVP",
  conference_rsvp: "Conference RSVP",
  conference_meetup_rsvp: "Conference meetup RSVP",
  eventbrite_ticket: "Synced Eventbrite ticket",
  connection_request_sent: "Connection request sent",
}

function validTimestamp(value: string | null | undefined) {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : value
}

function earliest(...values: (string | null | undefined)[]) {
  return values
    .map(validTimestamp)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null
}

function latest(...values: (string | null | undefined)[]) {
  return values
    .map(validTimestamp)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null
}

function memberName(profile: AnalyticsEligibilityProfile) {
  return [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
    || profile.email
    || "Unknown member"
}

export function isAnalyticsEligible(profile: Pick<AnalyticsEligibilityProfile, "is_banned" | "exclude_from_analytics">) {
  return profile.is_banned !== true && profile.exclude_from_analytics !== true
}

function whatsappStatus(progress: OnboardingProgressInput | undefined): OnboardingAnalyticsData["members"][number]["whatsappStatus"] {
  if (progress?.whatsapp_current_step === "self_attested") return "already_in"
  if (progress?.whatsapp_current_step === "not_interested") return "not_interested"
  if (progress?.whatsapp_completed_at) return "completed"
  return "pending"
}

export function buildOnboardingAnalyticsData({
  profiles,
  progressRows,
  participationRows,
  now = new Date(),
}: {
  profiles: AnalyticsEligibilityProfile[]
  progressRows: OnboardingProgressInput[]
  participationRows: ParticipationActivityInput[]
  now?: Date
}): OnboardingAnalyticsData {
  const eligibleProfiles = profiles.filter(isAnalyticsEligible)
  const progressByUser = new Map(progressRows.map((row) => [row.user_id, row]))
  const participationByUser = new Map<string, ParticipationActivityInput[]>()

  for (const row of participationRows) {
    const current = participationByUser.get(row.user_id) ?? []
    current.push(row)
    participationByUser.set(row.user_id, current)
  }
  for (const rows of participationByUser.values()) {
    rows.sort((a, b) => (validTimestamp(a.occurred_at) ? Date.parse(a.occurred_at) : Infinity)
      - (validTimestamp(b.occurred_at) ? Date.parse(b.occurred_at) : Infinity)
      || `${a.activity_type}:${a.source_record_id ?? a.id ?? ""}`.localeCompare(`${b.activity_type}:${b.source_record_id ?? b.id ?? ""}`))
  }

  const members = eligibleProfiles.map<OnboardingAnalyticsData["members"][number]>((profile) => {
    const progress = progressByUser.get(profile.id)
    const participation = participationByUser.get(profile.id) ?? []
    const completedParticipation = participation.filter((row) => row.action === "completed" && validTimestamp(row.occurred_at))
    const firstRecordedParticipation = completedParticipation[0]
    const fallbackParticipation = earliest(
      progress?.event_rsvp_completed_at,
      progress?.connection_request_completed_at,
    )
    // An earlier retained milestone timestamp must not be replaced by a later
    // ledger action when historical source detail is missing.
    const firstParticipation = fallbackParticipation && firstRecordedParticipation
      && Date.parse(fallbackParticipation) < Date.parse(firstRecordedParticipation.occurred_at)
      ? undefined : firstRecordedParticipation
    const milestones: Record<OnboardingMilestoneId, string | null> = {
      whatsapp: validTimestamp(progress?.whatsapp_completed_at),
      profile: validTimestamp(progress?.profile_completed_at),
      tour: validTimestamp(progress?.product_tour_completed_at),
      participate: validTimestamp(firstParticipation?.occurred_at) ?? fallbackParticipation,
    }
    const completedCount = Object.values(milestones).filter(Boolean).length
    const allMilestoneDates = Object.values(milestones)
    const lastStepCompletedAt = latest(...allMilestoneDates)
    const milestone4Activity = firstParticipation
      ? PARTICIPATION_LABELS[firstParticipation.activity_type]
      : fallbackParticipation
        ? "Completed · activity detail unavailable"
        : "Not completed"

    return {
      userId: profile.id,
      name: memberName(profile),
      email: profile.email ?? "",
      registrationDate: validTimestamp(profile.created_at),
      lastSignedInAt: validTimestamp(profile.last_sign_in_at),
      completedCount,
      completedAt: completedCount === ONBOARDING_MILESTONES.length ? lastStepCompletedAt : null,
      lastStepCompletedAt,
      milestone4Activity,
      milestone4Type: firstParticipation?.activity_type ?? (fallbackParticipation ? "unknown" : null),
      milestone4OccurredAt: milestones.participate,
      whatsappStatus: whatsappStatus(progress),
      whatsappContactProvided: Boolean(profile.whatsapp_url?.trim()),
      milestones,
      participation,
    }
  }).sort((a, b) => (
    (b.registrationDate ?? "").localeCompare(a.registrationDate ?? "")
    || a.name.localeCompare(b.name)
  ))

  const completedMembers = members.filter((member) => member.completedAt).length
  const progressDistribution = Array.from({ length: ONBOARDING_MILESTONES.length + 1 }, (_, completed) => ({
    completed,
    members: members.filter((member) => member.completedCount === completed).length,
  }))
  const outstandingMilestones = ONBOARDING_MILESTONES.map((milestone) => ({
    ...milestone,
    members: members.filter((member) => !member.milestones[milestone.id]).length,
  }))
  const attribution = buildFirstParticipationAttribution(members)

  return {
    generatedAt: now.toISOString(),
    eligibleMembers: members.length,
    excludedMembers: profiles.length - members.length,
    completedMembers,
    completionRate: members.length ? Math.round((completedMembers / members.length) * 1000) / 10 : 0,
    progressDistribution,
    outstandingMilestones,
    participationAttribution: attribution,
    members,
  }
}

export function participationLabel(type: ParticipationActivityInput["activity_type"]) {
  return PARTICIPATION_LABELS[type]
}

export function buildFirstParticipationAttribution(members: OnboardingAnalyticsData["members"], from = "", to = ""): OnboardingAnalyticsData["participationAttribution"] {
  const start = from ? Date.parse(`${from}T00:00:00.000Z`) : -Infinity
  const end = to ? Date.parse(`${to}T23:59:59.999Z`) : Infinity
  const included = members.filter((member) => member.milestone4OccurredAt
    && Date.parse(member.milestone4OccurredAt) >= start && Date.parse(member.milestone4OccurredAt) <= end)
  const rows: OnboardingAnalyticsData["participationAttribution"] = Object.entries(PARTICIPATION_LABELS).map(([type, label]) => {
    const count = included.filter((member) => member.milestone4Type === type).length
    return { type: type as ParticipationActivityInput["activity_type"], label, members: count, activities: count }
  })
  if (members.some((member) => member.milestone4Type === "unknown")) {
    const count = included.filter((member) => member.milestone4Type === "unknown").length
    rows.push({ type: "unknown", label: "Earlier completion · source unavailable", members: count, activities: count })
  }
  return rows
}
