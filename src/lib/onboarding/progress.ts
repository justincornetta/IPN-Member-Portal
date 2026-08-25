import type { SupabaseClient } from "@supabase/supabase-js"

export type OnboardingStep =
  | "welcome"
  | "profile"
  | "whatsapp"
  | "product_tour"
  | "connection_request"
  | "invite"
  | "event_rsvp"

const ONBOARDING_STEPS = new Set<string>([
  "welcome",
  "profile",
  "whatsapp",
  "product_tour",
  "connection_request",
  "invite",
  "event_rsvp",
])

export type OnboardingProgress = {
  welcome_started_at: string | null
  welcome_current_step: string | null
  welcome_completed_at: string | null
  profile_started_at: string | null
  profile_current_step: string | null
  profile_completed_at: string | null
  whatsapp_started_at: string | null
  whatsapp_current_step: string | null
  whatsapp_completed_at: string | null
  product_tour_started_at: string | null
  product_tour_current_step: string | null
  product_tour_completed_at: string | null
  connection_request_completed_at: string | null
  invite_completed_at: string | null
  event_rsvp_completed_at: string | null
}

export type OnboardingFlow = "welcome" | "whatsapp" | "profile" | "product_tour"

export type OnboardingFlowState = {
  status: "not_started" | "in_progress" | "completed"
  currentStep: string | null
  startedAt: string | null
  completedAt: string | null
}

export type ProfileCompletionFields = {
  photoUrl?: string | null
  shortBio?: string | null
  currentRole?: string | null
  schoolOrOrganization?: string | null
  interests?: string[] | null
  /** @deprecated UI compatibility only; migrate callers to photoUrl. */
  avatar_url?: string | null
  /** @deprecated UI compatibility only; migrate callers to shortBio. */
  bio?: string | null
  /** @deprecated UI compatibility only; migrate callers to interests. */
  interest_tags?: string[] | null
}

export type ProfileCompletionRecord = {
  avatar_url: string | null
  bio: string | null
  role_and_goals: string | null
  school: string | null
  affiliation: string | null
  interest_tags: string[] | null
}

const STEP_COLUMNS: Record<OnboardingStep, keyof OnboardingProgress> = {
  welcome: "welcome_completed_at",
  profile: "profile_completed_at",
  whatsapp: "whatsapp_completed_at",
  product_tour: "product_tour_completed_at",
  connection_request: "connection_request_completed_at",
  invite: "invite_completed_at",
  event_rsvp: "event_rsvp_completed_at",
}

export function isProfileOnboardingComplete(profile: ProfileCompletionFields): boolean {
  const photoUrl = profile.photoUrl ?? profile.avatar_url
  const shortBio = profile.shortBio ?? profile.bio
  const interests = profile.interests ?? profile.interest_tags
  return Boolean(
    photoUrl?.trim() &&
      shortBio?.trim() &&
      profile.currentRole?.trim() &&
      profile.schoolOrOrganization?.trim() &&
      interests?.some((interest) => interest.trim()),
  )
}

export function profileCompletionFieldsFromRecord(
  profile: ProfileCompletionRecord,
): ProfileCompletionFields {
  return {
    photoUrl: profile.avatar_url,
    shortBio: profile.bio,
    currentRole: profile.role_and_goals,
    schoolOrOrganization: profile.school?.trim() || profile.affiliation,
    interests: profile.interest_tags,
  }
}

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === "string" && ONBOARDING_STEPS.has(value)
}

export function isOnboardingFlow(value: unknown): value is OnboardingFlow {
  return value === "welcome" || value === "whatsapp" || value === "profile" || value === "product_tour"
}

function normalizeCurrentStep(value: unknown) {
  if (value === undefined || value === null || value === "") return value
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)) {
    throw new Error("Invalid onboarding step identifier")
  }
  return value
}

const FLOW_COLUMNS: Record<
  OnboardingFlow,
  { started: keyof OnboardingProgress; current: keyof OnboardingProgress; completed: keyof OnboardingProgress }
> = {
  welcome: {
    started: "welcome_started_at",
    current: "welcome_current_step",
    completed: "welcome_completed_at",
  },
  whatsapp: {
    started: "whatsapp_started_at",
    current: "whatsapp_current_step",
    completed: "whatsapp_completed_at",
  },
  profile: {
    started: "profile_started_at",
    current: "profile_current_step",
    completed: "profile_completed_at",
  },
  product_tour: {
    started: "product_tour_started_at",
    current: "product_tour_current_step",
    completed: "product_tour_completed_at",
  },
}

export function getOnboardingFlowState(
  progress: Partial<OnboardingProgress> | null,
  flow: OnboardingFlow,
): OnboardingFlowState {
  const columns = FLOW_COLUMNS[flow]
  const startedAt = (progress?.[columns.started] as string | null | undefined) ?? null
  const completedAt = (progress?.[columns.completed] as string | null | undefined) ?? null
  const currentStep = (progress?.[columns.current] as string | null | undefined) ?? null

  return {
    status: completedAt ? "completed" : startedAt ? "in_progress" : "not_started",
    currentStep,
    startedAt,
    completedAt,
  }
}

export async function advanceOnboardingFlow(
  supabase: SupabaseClient,
  userId: string,
  input: { flow: OnboardingFlow; currentStep?: string | null; complete?: boolean },
) {
  if (!isOnboardingFlow(input.flow)) throw new Error("Invalid onboarding flow")
  if (input.complete !== undefined && typeof input.complete !== "boolean") {
    throw new Error("Invalid onboarding completion value")
  }
  const currentStep = normalizeCurrentStep(input.currentStep)
  const columns = FLOW_COLUMNS[input.flow]
  const { data: existing, error: selectError } = await supabase
    .from("member_onboarding_progress")
    .select(["user_id", columns.started, columns.current, columns.completed].join(", "))
    .eq("user_id", userId)
    .maybeSingle()

  if (selectError) throw new Error(`Could not read onboarding progress: ${selectError.message}`)

  const row = existing as Partial<OnboardingProgress> | null
  const now = new Date().toISOString()
  const updates: Record<string, string | null> = { updated_at: now }
  if (!row?.[columns.started]) updates[columns.started] = now
  if (input.currentStep !== undefined) {
    updates[columns.current] = currentStep || null
  }
  if (input.complete && !row?.[columns.completed]) updates[columns.completed] = now

  const { error: upsertError } = await supabase
    .from("member_onboarding_progress")
    .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" })

  if (upsertError) throw new Error(`Could not save onboarding progress: ${upsertError.message}`)
}

export async function markOnboardingStepsComplete(
  supabase: SupabaseClient,
  userId: string,
  steps: OnboardingStep[],
) {
  const uniqueSteps = [...new Set(steps)]
  if (uniqueSteps.length === 0) return

  const columns = uniqueSteps.map((step) => STEP_COLUMNS[step])
  const { data: existing, error: selectError } = await supabase
    .from("member_onboarding_progress")
    .select(["user_id", ...columns].join(", "))
    .eq("user_id", userId)
    .maybeSingle()
  if (selectError) {
    console.error("[onboarding] failed to read progress:", selectError.message)
    return
  }
  const existingProgress = existing as Partial<OnboardingProgress> | null

  const now = new Date().toISOString()
  const updates: Record<string, string> = {}

  for (const column of columns) {
    if (!existingProgress || !existingProgress[column]) {
      updates[column] = now
    }
  }

  if (Object.keys(updates).length === 0) return

  // Upsert (rather than select-then-insert/update) so two steps completing
  // concurrently for a brand-new user both land instead of the second one
  // hitting a unique-constraint conflict on a plain insert and being lost.
  const { error: upsertError } = await supabase
    .from("member_onboarding_progress")
    .upsert(
      { user_id: userId, ...updates, updated_at: now },
      { onConflict: "user_id" },
    )
  if (upsertError) {
    console.error("[onboarding] failed to save progress:", upsertError.message)
  }
}
