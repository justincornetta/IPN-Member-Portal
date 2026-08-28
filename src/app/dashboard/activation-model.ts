export type ActivationProgressInput = {
  whatsapp_completed_at: string | null
  whatsapp_current_step?: string | null
  profile_completed_at: string | null
  product_tour_completed_at: string | null
  event_rsvp_completed_at: string | null
  connection_request_completed_at: string | null
  participation_completed?: boolean
}

export const ACTIVATION_MILESTONE_ORDER = [
  "whatsapp",
  "profile",
  "tour",
  "participate",
] as const

export type ActivationMilestoneId = (typeof ACTIVATION_MILESTONE_ORDER)[number]

export function isProfileMilestoneComplete(
  completedAt: string | null | undefined,
  completedCount: number,
  totalCount: number,
) {
  return Boolean(completedAt) || (totalCount > 0 && completedCount >= totalCount)
}

export function activationSummary(progress: ActivationProgressInput | null): {
  completedCount: number
  totalCount: number
  nextMilestone: ActivationMilestoneId | null
} {
  const completed: Record<ActivationMilestoneId, boolean> = {
    whatsapp: Boolean(progress?.whatsapp_completed_at),
    profile: Boolean(progress?.profile_completed_at),
    tour: Boolean(progress?.product_tour_completed_at),
    participate: progress?.participation_completed ?? Boolean(
      progress?.event_rsvp_completed_at || progress?.connection_request_completed_at,
    ),
  }

  const prioritySatisfied = {
    ...completed,
    whatsapp: completed.whatsapp || progress?.whatsapp_current_step === "continued",
  }

  return {
    completedCount: ACTIVATION_MILESTONE_ORDER.filter((id) => completed[id]).length,
    totalCount: ACTIVATION_MILESTONE_ORDER.length,
    nextMilestone: ACTIVATION_MILESTONE_ORDER.find((id) => !prioritySatisfied[id]) ?? null,
  }
}
