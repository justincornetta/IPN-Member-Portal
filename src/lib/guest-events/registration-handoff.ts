import { parseGuestInput } from "./domain"

const KEY = "ipn-event-registration-handoff"
type Identity = { firstName: string; lastName: string; email: string }

// Convenience-only prefill. It never verifies ownership or creates an account.
// Keep personal details out of URLs, and expire this tab-local copy after 30 minutes.
export function saveRegistrationHandoff(identity: Identity, slug: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ identity, eventPath: "/events/" + slug, expires: Date.now() + 30 * 60_000 }))
  } catch { /* Registration remains available when browser storage is disabled. */ }
}
export function readRegistrationHandoff() {
  try { return sessionStorage.getItem(KEY) } catch { return null }
}
export function clearRegistrationHandoff() {
  try { sessionStorage.removeItem(KEY) } catch { /* Optional prefill only. */ }
}
export function parseRegistrationHandoff(raw: string | null): {identity: Identity; eventPath: string} | null {
  try {
    if (!raw || raw.length > 2000) return null
    const value = JSON.parse(raw)
    if (!Number.isFinite(value.expires) || value.expires <= Date.now() || !/^\/events\/[a-z0-9-]+$/.test(value.eventPath)) return null
    return { identity: parseGuestInput(value.identity), eventPath: value.eventPath }
  } catch { return null }
}
