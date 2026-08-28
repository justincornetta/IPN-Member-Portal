export function conferenceNotificationMessage(
  customMessage: string | null | undefined,
  description: string | null | undefined,
) {
  return customMessage?.trim() || description?.trim() || null
}
