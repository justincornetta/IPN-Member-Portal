import type {
  OnboardingFoundationAdapter,
  QrTargetInput,
  QrTargetResult,
  WhatsAppHandoffInput,
  WhatsAppHandoffResult,
} from "./types"

const fixtureLabels = {
  general: "General",
  labs: "Labs Events",
  conferences: "Conferences",
} as const

/**
 * UI-only fixture for the onboarding foundation boundary.
 *
 * Integration replaces this fixture with issueWhatsAppHandoff() from the
 * foundation client. Issuance prepares a short-lived public handoff; it does
 * not record join intent until the returned `/go` path is consumed.
 */
async function issueWhatsAppHandoff(
  input: WhatsAppHandoffInput,
): Promise<WhatsAppHandoffResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 260))

  window.dispatchEvent(
    new CustomEvent("ipn:onboarding-whatsapp-handoff", { detail: input }),
  )

  return {
    handoffPath: `/go/whatsapp/${input.slug}?source=onboarding`,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    channel: {
      kind: "permanent",
      slug: input.slug,
      label: fixtureLabels[input.slug],
      featured: input.slug === "general",
    },
  }
}

/**
 * UI-only QR fixture. The foundation may replace this with a dynamic,
 * scan-safe first-party QR image without changing the presentational UI.
 */
async function resolveWhatsAppQrTarget(
  input: QrTargetInput,
): Promise<QrTargetResult> {
  const handoff = await issueWhatsAppHandoff(input)
  return {
    imageSrc: `/onboarding/qr-${input.slug}.svg`,
    handoffPath: handoff.handoffPath,
    expiresAt: handoff.expiresAt,
  }
}

export const onboardingFoundationAdapter: OnboardingFoundationAdapter = {
  issueWhatsAppHandoff,
  resolveWhatsAppQrTarget,
}
