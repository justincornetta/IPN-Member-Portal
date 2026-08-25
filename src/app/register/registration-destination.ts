export const STANDARD_REGISTRATION_DESTINATION = "/dashboard/welcome"

export function registrationDestination(next: string): string {
  return next || STANDARD_REGISTRATION_DESTINATION
}
