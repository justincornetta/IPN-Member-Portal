import QRCode from "qrcode"
import { issueWhatsAppHandoff as issueFoundationHandoff } from "@/lib/whatsapp/client"
import type {
  OnboardingFoundationAdapter,
  QrTargetInput,
  QrTargetResult,
  WhatsAppHandoffInput,
  WhatsAppHandoffResult,
} from "./types"

async function issueWhatsAppHandoff(
  input: WhatsAppHandoffInput,
): Promise<WhatsAppHandoffResult> {
  const result = await issueFoundationHandoff(input)
  if (result.channel.kind !== "permanent" || result.channel.slug !== input.slug) {
    throw new Error("The WhatsApp handoff did not match the selected channel")
  }
  return result as WhatsAppHandoffResult
}

async function resolveWhatsAppQrTarget(
  input: QrTargetInput,
): Promise<QrTargetResult> {
  const handoff = await issueWhatsAppHandoff(input)
  const absoluteHandoffUrl = new URL(handoff.handoffPath, window.location.origin).toString()
  return {
    imageSrc: await QRCode.toDataURL(absoluteHandoffUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 488,
      color: { dark: "#1A1034", light: "#FFFFFF" },
    }),
    handoffPath: handoff.handoffPath,
    expiresAt: handoff.expiresAt,
  }
}

export const onboardingFoundationAdapter: OnboardingFoundationAdapter = {
  issueWhatsAppHandoff,
  resolveWhatsAppQrTarget,
}
