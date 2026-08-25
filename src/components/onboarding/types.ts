export type WhatsAppChannelId = "general" | "labs" | "conferences"

export type WhatsAppChannel = {
  id: WhatsAppChannelId
  name: string
  shortName: string
  description: string
  redirectPath: `/go/whatsapp/${WhatsAppChannelId}?source=onboarding`
  qrAsset: `/onboarding/qr-${WhatsAppChannelId}.svg`
  recommended?: boolean
}

export type JoinIntentInput = {
  channel: WhatsAppChannelId
  source: "onboarding"
  surface: "desktop_qr" | "mobile_direct"
}

export type JoinIntentResult = {
  accepted: boolean
  intentId?: string
}

export type OnboardingFoundationAdapter = {
  recordWhatsAppJoinIntent(input: JoinIntentInput): Promise<JoinIntentResult>
}
