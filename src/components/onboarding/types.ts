export type WhatsAppChannelId = "general" | "labs" | "conferences"

export type WhatsAppChannel = {
  id: WhatsAppChannelId
  name: string
  shortName: string
  description: string
  redirectPath: `/go/whatsapp/${WhatsAppChannelId}?source=onboarding`
  recommended?: boolean
}

export type WhatsAppHandoffSurface =
  | "desktop_qr_scan"
  | "desktop_direct"
  | "mobile_direct"

export type WhatsAppHandoffInput = {
  kind: "permanent"
  slug: WhatsAppChannelId
  source: "onboarding"
  surface: WhatsAppHandoffSurface
  sessionId?: string | null
}

export type WhatsAppHandoffResult = {
  handoffPath: string
  expiresAt: string
  channel: {
    kind: "permanent"
    slug: WhatsAppChannelId
    label: string
    featured: boolean
  }
}

export type QrTargetInput = {
  kind: "permanent"
  slug: WhatsAppChannelId
  source: "onboarding"
  surface: "desktop_qr_scan"
  sessionId?: string | null
}

export type QrTargetResult = {
  imageSrc: string
  handoffPath: string
  expiresAt: string
}

export type OnboardingFoundationAdapter = {
  issueWhatsAppHandoff(input: WhatsAppHandoffInput): Promise<WhatsAppHandoffResult>
  resolveWhatsAppQrTarget(input: QrTargetInput): Promise<QrTargetResult>
}
