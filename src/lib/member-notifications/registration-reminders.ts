export const REGISTRATION_REMINDER_KIND = "event_registration_reminder" as const
export const REGISTRATION_REMINDER_TEMPLATE_VERSION = "v1"
export const REGISTRATION_REMINDER_LOOKAHEAD_HOURS = 72
export const REGISTRATION_REMINDER_WINDOW_HOURS = 6
export const NEW_EVENT_FATIGUE_GUARD_HOURS = 48

export type RegistrationReminderEventState = {
  id: string
  status: string
  is_recording: boolean
  registration_reminder_enabled: boolean
  starts_at: string
}

export type RegistrationReminderSuppressionInput = {
  hasPortalRegistration: boolean
  hasVerifiedExternalTicket: boolean
  newEventAnnouncementSentAt?: string | null
  now: Date
}

export type RegistrationReminderNotificationMode = "off" | "test" | "live"

export function registrationReminderFeatureEnabled(value: string | null | undefined) {
  return value?.trim().toLowerCase() === "true"
}

export function registrationReminderRecipientIsEnabled(
  mode: RegistrationReminderNotificationMode,
  email: string,
  testRecipients: Iterable<string>,
) {
  if (mode === "live") return true
  if (mode === "off") return false
  const normalizedEmail = email.trim().toLowerCase()
  return new Set(
    [...testRecipients].map((recipient) => recipient.trim().toLowerCase()),
  ).has(normalizedEmail)
}

export function registrationReminderWindow(now: Date) {
  const windowEnd = new Date(
    now.getTime() + REGISTRATION_REMINDER_LOOKAHEAD_HOURS * 60 * 60 * 1000,
  )
  const windowStart = new Date(
    windowEnd.getTime() - REGISTRATION_REMINDER_WINDOW_HOURS * 60 * 60 * 1000,
  )
  return { windowStart, windowEnd }
}

export function registrationReminderEventIsDue(
  event: RegistrationReminderEventState,
  now: Date,
) {
  const startsAt = new Date(event.starts_at).getTime()
  const { windowStart, windowEnd } = registrationReminderWindow(now)
  return (
    event.status === "published" &&
    !event.is_recording &&
    event.registration_reminder_enabled &&
    Number.isFinite(startsAt) &&
    startsAt > windowStart.getTime() &&
    startsAt <= windowEnd.getTime()
  )
}

export function registrationReminderDedupeKey(eventId: string, recipientUserId: string) {
  return [
    REGISTRATION_REMINDER_KIND,
    REGISTRATION_REMINDER_TEMPLATE_VERSION,
    eventId,
    recipientUserId,
  ].join("/")
}

export function registrationReminderSuppressionReason({
  hasPortalRegistration,
  hasVerifiedExternalTicket,
  newEventAnnouncementSentAt,
  now,
}: RegistrationReminderSuppressionInput) {
  if (hasPortalRegistration) return "recipient has already RSVP'd"
  if (hasVerifiedExternalTicket) return "recipient has a verified external ticket"
  if (newEventAnnouncementSentAt) {
    const sentAt = new Date(newEventAnnouncementSentAt).getTime()
    const fatigueCutoff =
      now.getTime() - NEW_EVENT_FATIGUE_GUARD_HOURS * 60 * 60 * 1000
    if (Number.isFinite(sentAt) && sentAt >= fatigueCutoff) {
      return "new-event announcement was sent within the fatigue window"
    }
  }
  return null
}
