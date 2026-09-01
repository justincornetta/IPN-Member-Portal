import type { WhatsAppChannel } from "./types"

export const whatsappChannels: WhatsAppChannel[] = [
  {
    id: "general",
    name: "General",
    shortName: "General",
    description:
      "Introductions, ask questions, and general topic discussions.",
    previewDescription:
      "Introductions, ask questions, and general topic discussions.",
    previewMessages: [
      "Welcome to IPN! This is the place to introduce yourself, ask questions, and connect with fellow members around the world.",
      "Start by sharing a bit about yourself so others can get to know you.",
    ],
    promptLabel: "Your first message",
    prompt:
      "Share your name, where you’re based, your background, and what you’re studying or working on.",
    redirectPath: "/go/whatsapp/general?source=onboarding",
    recommended: true,
  },
  {
    id: "labs",
    name: "Labs Events",
    shortName: "Labs",
    description:
      "Discussions specific to IPN Labs events and seminar series.",
    previewDescription:
      "Discuss IPN Labs events, seminars, and emerging ideas.",
    previewMessages: [
      "Today’s seminar thread is open for questions and takeaways.",
      "Share a paper, idea, or connection you want to explore with the group.",
    ],
    promptLabel: "Join the discussion",
    prompt:
      "Introduce yourself, name the session you joined, and share one question or takeaway.",
    redirectPath: "/go/whatsapp/labs?source=onboarding",
  },
  {
    id: "conferences",
    name: "Conferences",
    shortName: "Conferences",
    description:
      "Conference attendance, planning, and coordinating IPN meetups.",
    previewDescription:
      "Coordinate conference plans, meetups, and shared experiences.",
    previewMessages: [
      "Planning to attend an upcoming conference? Connect before you arrive.",
      "Coordinate meetups, compare sessions, and share practical details with the group.",
    ],
    promptLabel: "Plan together",
    prompt:
      "Share which conference you’re attending, where you’re traveling from, and what you hope to explore.",
    redirectPath: "/go/whatsapp/conferences?source=onboarding",
  },
]
