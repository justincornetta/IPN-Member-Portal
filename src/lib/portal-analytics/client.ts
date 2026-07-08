"use client"

import type { PortalAnalyticsEventName } from "./events"

const SESSION_KEY = "ipn_portal_analytics_session_id"
const ANONYMOUS_KEY = "ipn_portal_analytics_anonymous_id"

function randomId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function getDeviceMetadata() {
  if (typeof window === "undefined") return {}
  const width = window.innerWidth
  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false
  const userAgent = navigator.userAgent.toLowerCase()
  const deviceType = /ipad|tablet/.test(userAgent)
    ? "tablet"
    : /android|iphone|ipod|mobile/.test(userAgent) || (coarsePointer && width < 768)
      ? "mobile"
      : "desktop"

  return {
    deviceType,
    viewportWidth: width,
  }
}

export function getPortalAnalyticsContext() {
  if (typeof window === "undefined") {
    return {
      sessionId: "",
      anonymousId: "",
      pagePath: "",
      pageTitle: "",
      referrer: "",
    }
  }

  let sessionId = window.sessionStorage.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = randomId("session")
    window.sessionStorage.setItem(SESSION_KEY, sessionId)
  }

  let anonymousId = window.localStorage.getItem(ANONYMOUS_KEY)
  if (!anonymousId) {
    anonymousId = randomId("anon")
    window.localStorage.setItem(ANONYMOUS_KEY, anonymousId)
  }

  return {
    sessionId,
    anonymousId,
    pagePath: `${window.location.pathname}${window.location.search}`,
    pageTitle: document.title,
    referrer: document.referrer,
  }
}

export function trackPortalEvent(
  eventName: PortalAnalyticsEventName,
  payload: Record<string, unknown> = {},
  options: { beacon?: boolean } = {},
) {
  if (typeof window === "undefined") return

  const context = getPortalAnalyticsContext()
  const payloadMetadata = payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
    ? payload.metadata as Record<string, unknown>
    : {}
  const body = JSON.stringify({
    eventName,
    ...context,
    ...payload,
    metadata: {
      ...getDeviceMetadata(),
      ...payloadMetadata,
    },
  })

  if (options.beacon && "sendBeacon" in navigator) {
    const blob = new Blob([body], { type: "application/json" })
    navigator.sendBeacon("/api/portal-analytics", blob)
    return
  }

  fetch("/api/portal-analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {})
}
