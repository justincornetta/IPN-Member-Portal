export const EXTERNAL_REGISTRATION_PROVIDERS = [
  "Partiful",
  "Eventbrite",
  "Lu.ma",
  "Other",
] as const

export type ExternalRegistrationProvider =
  (typeof EXTERNAL_REGISTRATION_PROVIDERS)[number]

export function externalRegistrationLabel(provider?: string | null) {
  switch (provider?.trim().toLowerCase()) {
    case "partiful":
      return "RSVP on Partiful"
    case "eventbrite":
      return "Register on Eventbrite"
    case "lu.ma":
    case "luma":
      return "Register on Lu.ma"
    default:
      return "Register externally"
  }
}

export function externalRegistrationStatus(provider?: string | null) {
  const name = provider?.trim()
  return name && name.toLowerCase() !== "other"
    ? `Registration on ${name}`
    : "External registration"
}
