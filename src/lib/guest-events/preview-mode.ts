// This non-secret flag is fixed by Next at build time, never by a request/cookie.
export function hostedGuestPreview() {
  return process.env.IPN_GUEST_SANDBOX_ENABLED === "1"
}

export const previewEventSlug = "global-psychedelic-week-so-you-want-to-be-a-psychedelic-professional"
export function previewOrigin() {
  return process.env.IPN_GUEST_SANDBOX_ORIGIN || "http://127.0.0.1:4331"
}

export function previewPathAllowed(pathname: string) {
  return ["/events/" + previewEventSlug, "/events/guest-rsvp-preview", "/join", "/event-preview/emails",
    "/api/events/" + previewEventSlug + "/rsvp", "/api/events/guest-rsvp-preview/rsvp",
    "/api/events/membership", "/api/events/guest-preferences"].includes(pathname)
    || /^\/events\/rsvp\/[a-f0-9-]{36}\.[A-Za-z0-9_-]+$/.test(pathname)
}
