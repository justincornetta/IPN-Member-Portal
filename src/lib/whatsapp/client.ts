import type { WhatsAppChannelKind } from "./channels"

export type WhatsAppHandoffRequest = {
  kind: WhatsAppChannelKind
  slug: string
  source: string
  surface: string
  sessionId?: string | null
}

export type WhatsAppHandoffResponse = {
  handoffPath: string
  expiresAt: string
  channel: {
    kind: WhatsAppChannelKind
    slug: string
    label: string
    featured: boolean
  }
}

export async function issueWhatsAppHandoff(
  input: WhatsAppHandoffRequest,
): Promise<WhatsAppHandoffResponse> {
  const query = new URLSearchParams({
    source: input.source,
    surface: input.surface,
  })
  if (input.sessionId) query.set("sessionId", input.sessionId)

  const response = await fetch(
    `/api/whatsapp/handoffs/${encodeURIComponent(input.kind)}/${encodeURIComponent(input.slug)}?${query}`,
    { method: "POST", credentials: "same-origin" },
  )
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body
      ? String(body.error)
      : "Could not prepare WhatsApp handoff"
    throw new Error(message)
  }
  if (!body || typeof body !== "object") throw new Error("Invalid WhatsApp handoff response")

  const candidate = body as Partial<WhatsAppHandoffResponse>
  if (
    typeof candidate.handoffPath !== "string"
    || !candidate.handoffPath.startsWith("/go/whatsapp/")
    || typeof candidate.expiresAt !== "string"
    || Number.isNaN(Date.parse(candidate.expiresAt))
    || !candidate.channel
    || (candidate.channel.kind !== "permanent" && candidate.channel.kind !== "event")
    || typeof candidate.channel.slug !== "string"
    || typeof candidate.channel.label !== "string"
    || typeof candidate.channel.featured !== "boolean"
  ) {
    throw new Error("Invalid WhatsApp handoff response")
  }
  return {
    handoffPath: candidate.handoffPath,
    expiresAt: candidate.expiresAt,
    channel: {
      kind: candidate.channel.kind,
      slug: candidate.channel.slug,
      label: candidate.channel.label,
      featured: candidate.channel.featured,
    },
  }
}
