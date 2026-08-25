import type { WhatsAppChannel } from "./types"

export const whatsappChannels: WhatsAppChannel[] = [
  {
    id: "general",
    name: "General",
    shortName: "General",
    description:
      "Introductions, questions, opportunities, and everyday community conversation.",
    recommended: true,
  },
  {
    id: "labs",
    name: "Labs Events",
    shortName: "Labs",
    description:
      "A permanent, ongoing conversation for the IPN Labs seminar series.",
  },
  {
    id: "conferences",
    name: "Conferences",
    shortName: "Conferences",
    description:
      "A permanent channel for conference planning, meetups, and connection.",
  },
]
