export type ActivationProgressInput = {
  whatsapp_completed_at: string | null
  whatsapp_current_step?: string | null
  profile_completed_at: string | null
  event_rsvp_completed_at: string | null
  connection_request_completed_at: string | null
  invite_completed_at: string | null
}

export const ACTIVATION_MILESTONE_ORDER = [
  "whatsapp",
  "profile",
  "event",
  "community",
  "invite",
] as const

export type ActivationMilestoneId = (typeof ACTIVATION_MILESTONE_ORDER)[number]

export function activationSummary(progress: ActivationProgressInput | null): {
  completedCount: number
  totalCount: number
  nextMilestone: ActivationMilestoneId | null
} {
  const completed: Record<ActivationMilestoneId, boolean> = {
    whatsapp: Boolean(progress?.whatsapp_completed_at),
    profile: Boolean(progress?.profile_completed_at),
    event: Boolean(progress?.event_rsvp_completed_at),
    community: Boolean(progress?.connection_request_completed_at),
    invite: Boolean(progress?.invite_completed_at),
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
