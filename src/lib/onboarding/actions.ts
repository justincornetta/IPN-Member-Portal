"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  markOnboardingStepsComplete,
  type OnboardingStep,
} from "@/lib/onboarding/progress"

export async function completeOnboardingStep(step: OnboardingStep): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  await markOnboardingStepsComplete(supabase, user.id, [step])
  revalidatePath("/dashboard")
}
