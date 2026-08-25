"use client"

import { useState } from "react"
import { issueWhatsAppHandoff } from "@/lib/whatsapp/client"
import { getPortalAnalyticsContext } from "@/lib/portal-analytics/client"

export default function WhatsAppHandoffAction({ kind, slug, source, label, className }: {
  kind: "permanent" | "event"
  slug: string
  source: string
  label: string
  className: string
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function openHandoff() {
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const mobile = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches
      const result = await issueWhatsAppHandoff({
        kind,
        slug,
        source,
        surface: mobile ? "mobile_direct" : "desktop_direct",
        sessionId: getPortalAnalyticsContext().sessionId,
      })
      window.location.assign(result.handoffPath)
    } catch (caught) {
      setPending(false)
      setError(caught instanceof Error ? caught.message : "The WhatsApp channel could not be opened")
    }
  }

  return (
    <span className="inline-flex flex-col items-stretch gap-1">
      <button type="button" className={className} disabled={pending} onClick={openHandoff}>
        {pending ? "Opening…" : label}
      </button>
      {error && <span role="alert" className="max-w-64 text-xs text-red-700">{error} Try again.</span>}
    </span>
  )
}
