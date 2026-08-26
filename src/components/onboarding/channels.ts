import type { WhatsAppChannel } from "./types"

export const whatsappChannels: WhatsAppChannel[] = [
  {
    id: "general",
    name: "General",
    shortName: "General",
    description:
      "Introductions, ask questions, and general topic discussions.",
    redirectPath: "/go/whatsapp/general?source=onboarding",
    recommended: true,
  },
  {
    id: "labs",
    name: "Labs Events",
    shortName: "Labs",
    description:
      "Discussions specific to IPN Labs events and seminar series.",
    redirectPath: "/go/whatsapp/labs?source=onboarding",
  },
  {
    id: "conferences",
    name: "Conferences",
    shortName: "Conferences",
    description:
      "Conference attendance, planning, and coordinating IPN meetups.",
    redirectPath: "/go/whatsapp/conferences?source=onboarding",
  },
]
