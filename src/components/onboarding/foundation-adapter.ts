import type {
  JoinIntentInput,
  JoinIntentResult,
  OnboardingFoundationAdapter,
} from "./types"

/**
 * UI-only fixture for the onboarding foundation boundary.
 *
 * The foundation implementation should replace the body of this method with an
 * authenticated mutation. It must resolve only after intent is recorded. The
 * public `/go/whatsapp/*` redirect remains separate and must not require portal
 * authentication because a different phone may scan the desktop QR.
 */
async function recordWhatsAppJoinIntent(
  input: JoinIntentInput,
): Promise<JoinIntentResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 260))

  window.dispatchEvent(
    new CustomEvent("ipn:onboarding-whatsapp-intent", { detail: input }),
  )

  return {
    accepted: true,
    intentId: `ui-fixture-${input.channel}-${Date.now()}`,
  }
}

export const onboardingFoundationAdapter: OnboardingFoundationAdapter = {
  recordWhatsAppJoinIntent,
}
