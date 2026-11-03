import { createHmac, timingSafeEqual } from "node:crypto"
import previewBuild from "./preview-build.json" with { type: "json" }

function secret() {
  // Sandbox tokens only address browser-local fixtures; never production data.
  if (previewBuild.enabled) return "isolated-pr70-preview-token-not-an-auth-secret"
  const value = process.env.GUEST_EVENT_TOKEN_SECRET
  if (!value || value.length < 32) throw new Error("Guest event tokens are not configured.")
  return value
}
export function guestToken(id: string) {
  return id + "." + createHmac("sha256", secret()).update("guest-event-v1:" + id).digest("base64url")
}
export function readGuestToken(token: string): string | null {
  const [id, signature, extra] = token.split(".")
  if (extra || !/^[a-f0-9-]{36}$/i.test(id ?? "") || !signature) return null
  const expected = Buffer.from(guestToken(id).split(".")[1])
  const actual = Buffer.from(signature)
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? id : null
}
export function rateKey(value: string) {
  return createHmac("sha256", secret()).update("guest-rate:" + value).digest("hex")
}
