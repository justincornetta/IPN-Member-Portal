import type { EventRecord, EventWithRegistration } from "./types"

export function normalizeTicketEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? ""
}

export function hasTicketJoinAccess(event: EventRecord, hasVerifiedTicket: boolean) {
  return !event.requires_verified_ticket || hasVerifiedTicket
}

export function protectTicketedJoinUrl<T extends EventRecord>(
  event: T,
  hasVerifiedTicket: boolean,
): T {
  if (hasTicketJoinAccess(event, hasVerifiedTicket)) return event
  return { ...event, join_url: null }
}

export function withTicketRegistrationState(
  event: EventRecord,
  isRegistered: boolean,
  hasVerifiedTicket: boolean,
): EventWithRegistration {
  return {
    ...protectTicketedJoinUrl(event, hasVerifiedTicket),
    is_registered: event.requires_verified_ticket ? hasVerifiedTicket : isRegistered,
    has_verified_ticket: hasVerifiedTicket,
  }
}
