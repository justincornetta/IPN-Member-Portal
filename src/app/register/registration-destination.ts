export const STANDARD_REGISTRATION_DESTINATION = "/onboarding/welcome?motion=editorial"

export function registrationDestination(next: string): string {
  return next || STANDARD_REGISTRATION_DESTINATION
}
