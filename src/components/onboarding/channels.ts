import type { WhatsAppChannel } from "./types"

export const whatsappChannels: WhatsAppChannel[] = [
  {
    id: "general",
    name: "General",
    shortName: "General",
    description:
      "Introductions, questions, opportunities, and everyday community conversation.",
    redirectPath: "/go/whatsapp/general?source=onboarding",
    qrAsset: "/onboarding/qr-general.svg",
    recommended: true,
  },
  {
    id: "labs",
    name: "Labs Events",
    shortName: "Labs",
    description:
      "A permanent, ongoing conversation for the IPN Labs seminar series.",
    redirectPath: "/go/whatsapp/labs?source=onboarding",
    qrAsset: "/onboarding/qr-labs.svg",
  },
  {
    id: "conferences",
    name: "Conferences",
    shortName: "Conferences",
    description:
      "A permanent channel for conference planning, meetups, and connection.",
    redirectPath: "/go/whatsapp/conferences?source=onboarding",
    qrAsset: "/onboarding/qr-conferences.svg",
  },
]
