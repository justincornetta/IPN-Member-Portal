"use client"

import { Suspense, useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { trackPortalEvent } from "@/lib/portal-analytics/client"
import type { PortalAnalyticsEventName } from "@/lib/portal-analytics/events"

function pathEvent(pathname: string): PortalAnalyticsEventName | null {
  if (pathname === "/register") return "registration_view"
  if (pathname === "/login") return "sign_in_view"
  return null
}

function InnerPortalAnalyticsTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentPathRef = useRef("")
  const pageStartedAtRef = useRef<number | null>(null)
  const clickCountRef = useRef(0)

  useEffect(() => {
    const search = searchParams.toString()
    const pagePath = `${pathname}${search ? `?${search}` : ""}`
    const previousPath = currentPathRef.current

    if (previousPath) {
      const durationSeconds = Math.max(0, Math.round((Date.now() - (pageStartedAtRef.current ?? Date.now())) / 1000))
      trackPortalEvent("page_duration", {
        pagePath: previousPath,
        durationSeconds,
        clickCount: clickCountRef.current,
      })
      trackPortalEvent("session_summary", {
        pagePath: previousPath,
        durationSeconds,
        clickCount: clickCountRef.current,
      })
    }

    currentPathRef.current = pagePath
    pageStartedAtRef.current = Date.now()
    clickCountRef.current = 0

    trackPortalEvent("page_view", { pagePath })
    const funnelEvent = pathEvent(pathname)
    if (funnelEvent) trackPortalEvent(funnelEvent, { pagePath })
  }, [pathname, searchParams])

  useEffect(() => {
    function flush(beacon = false) {
      if (!currentPathRef.current) return
      const durationSeconds = Math.max(0, Math.round((Date.now() - (pageStartedAtRef.current ?? Date.now())) / 1000))
      trackPortalEvent("page_duration", {
        pagePath: currentPathRef.current,
        durationSeconds,
        clickCount: clickCountRef.current,
      }, { beacon })
      trackPortalEvent("session_summary", {
        pagePath: currentPathRef.current,
        durationSeconds,
        clickCount: clickCountRef.current,
      }, { beacon })
    }

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") flush(true)
    }

    function onPageHide() {
      flush(true)
    }

    function onClick(event: MouseEvent) {
      const target = event.target instanceof Element
        ? event.target.closest("a, button, input, select, textarea, [data-analytics-event]")
        : null
      if (!target) return
      clickCountRef.current += 1

      const analyticsTarget = target.closest("[data-analytics-event]")
      if (!analyticsTarget) return
      const eventName = analyticsTarget?.getAttribute("data-analytics-event") as PortalAnalyticsEventName | null
      if (!eventName) return

      trackPortalEvent(eventName, {
        targetId: analyticsTarget.getAttribute("data-analytics-id"),
        targetLabel: analyticsTarget.getAttribute("data-analytics-label") ??
          analyticsTarget.textContent?.trim() ??
          analyticsTarget.getAttribute("aria-label"),
        metadata: {
          href: analyticsTarget instanceof HTMLAnchorElement ? analyticsTarget.href : undefined,
        },
      })
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pagehide", onPageHide)
    document.addEventListener("click", onClick, true)

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pagehide", onPageHide)
      document.removeEventListener("click", onClick, true)
    }
  }, [])

  return null
}

export default function PortalAnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <InnerPortalAnalyticsTracker />
    </Suspense>
  )
}
