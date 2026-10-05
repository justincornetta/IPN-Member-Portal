import { createHmac, timingSafeEqual } from "node:crypto"
export function verifySlack(
  raw: string,
  signature: string | null,
  timestamp: string | null,
  secret: string,
  now = Date.now()
) {
  if (
    !secret ||
    !signature ||
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300
  )
    return false
  const expected =
    "v0=" +
    createHmac("sha256", secret).update(`v0:${timestamp}:${raw}`).digest("hex")
  const a = Buffer.from(expected),
    b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}
