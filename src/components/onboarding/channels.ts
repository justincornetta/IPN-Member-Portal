import type { WhatsAppChannel } from "./types"

export const whatsappChannels: WhatsAppChannel[] = [
  {
    id: "general",
    name: "General",
    shortName: "General",
    description:
      "Introduce yourself, ask questions in everyday community conversation.",
    redirectPath: "/go/whatsapp/general?source=onboarding",
    recommended: true,
  },
  {
    id: "labs",
    name: "Labs Events",
    shortName: "Labs",
    description:
      "A permanent, ongoing conversation for the IPN Labs seminar series.",
    redirectPath: "/go/whatsapp/labs?source=onboarding",
  },
  {
    id: "conferences",
    name: "Conferences",
    shortName: "Conferences",
    description:
      "A permanent channel for conference planning, meetups, and connection.",
    redirectPath: "/go/whatsapp/conferences?source=onboarding",
  },
]
