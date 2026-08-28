"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { trackPortalEvent } from "@/lib/portal-analytics/client"

type FeedbackType = "bug" | "feedback" | "suggestion"

const TYPE_OPTIONS: { id: FeedbackType; label: string; description: string }[] = [
  { id: "bug", label: "Bug", description: "Something is broken" },
  { id: "feedback", label: "Feedback", description: "General thoughts" },
  { id: "suggestion", label: "Suggestion", description: "An idea or request" },
]

export function FeedbackForm({
  onComplete,
  embedded = false,
  autoFocus = true,
}: {
  onComplete?: () => void
  embedded?: boolean
  autoFocus?: boolean
}) {
  const pathname = usePathname()
  const [type, setType] = useState<FeedbackType>("feedback")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (embedded || !autoFocus) return
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [autoFocus, embedded, type])

  async function handleSubmit() {
    if (!message.trim()) return
    setStatus("submitting")
    setErrorMsg(null)

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message: message.trim(), page: pathname }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Something went wrong")
      }
      trackPortalEvent("curated_click", {
        targetId: "feedback-submitted",
        targetLabel: "Feedback submitted",
        metadata: { feedbackType: type },
      })
      setStatus("success")
    } catch (err) {
      setStatus("error")
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong")
    }
  }

  if (status === "success") {
    return (
      <div className={`flex flex-col items-center gap-3 text-center ${embedded ? "py-6" : "px-6 py-10"}`}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl">
              ✓
            </div>
            <p className="text-sm font-medium text-zinc-900">Thanks for sharing!</p>
            <p className="text-xs text-zinc-400">We read every submission.</p>
            {onComplete && (
              <button type="button" onClick={onComplete}
                className="mt-2 min-h-11 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50">
                Close
              </button>
            )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-4 ${embedded ? "" : "px-5 py-5"}`}>
            {/* Type selector */}
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setType(opt.id)}
                  className={`min-h-16 rounded-lg border px-2 py-2 text-center transition ${
                    type === opt.id
                      ? "border-ipn bg-ipn/5 text-ipn"
                      : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
                  }`}
                >
                  <p className="text-xs font-semibold">{opt.label}</p>
                  <p className="mt-0.5 text-[10px] text-current opacity-60">{opt.description}</p>
                </button>
              ))}
            </div>

            {/* Message */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                type === "bug"
                  ? "What happened? What did you expect?"
                  : type === "suggestion"
                    ? "What would make the portal better?"
                    : "What's on your mind?"
              }
              rows={5}
              className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
            />

            {errorMsg && (
              <p className="text-xs text-red-500" role="alert">{errorMsg}</p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="truncate text-xs text-zinc-400">{pathname}</p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!message.trim() || status === "submitting"}
                className="min-h-11 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn/90 disabled:opacity-50"
              >
                {status === "submitting" ? "Sending…" : "Send"}
              </button>
            </div>
    </div>
  )
}

function FeedbackModal({ onClose, guided = false }: { onClose: () => void; guided?: boolean }) {
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 md:items-center md:px-4" onClick={onClose}>
      <div
        data-tour-guided-feedback={guided ? "true" : undefined}
        role={guided ? "region" : "dialog"}
        aria-label="Share feedback"
        aria-modal={guided ? undefined : true}
        className={`${guided ? "max-h-[calc(100dvh-18rem)]" : "max-h-[calc(100dvh-1rem)]"} w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-xl md:max-h-[calc(100dvh-1rem)] md:rounded-2xl`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <p className="text-sm font-semibold text-zinc-900">Share feedback</p>
          <button type="button" onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 transition hover:text-zinc-600"
            aria-label="Close">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <FeedbackForm onComplete={onClose} autoFocus={!guided} />
      </div>
    </div>
  )
}

export default function FeedbackFooter() {
  const [open, setOpen] = useState(false)
  const [guidedOpen, setGuidedOpen] = useState(false)
  useEffect(() => {
    function handleOpenFeedback(event: Event) {
      setGuidedOpen(event instanceof CustomEvent && event.detail?.guided === true)
      setOpen(true)
    }
    function handleCloseFeedback() {
      setOpen(false)
      setGuidedOpen(false)
    }

    window.addEventListener("ipn:open-feedback", handleOpenFeedback)
    window.addEventListener("ipn:close-feedback", handleCloseFeedback)
    return () => {
      window.removeEventListener("ipn:open-feedback", handleOpenFeedback)
      window.removeEventListener("ipn:close-feedback", handleCloseFeedback)
    }
  }, [])

  return (
    <>
      <footer className="mt-auto px-3 py-5 sm:px-6">
        <div className="mx-auto flex max-w-md justify-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 shadow-sm transition hover:border-ipn/30 hover:bg-ipn/5 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-ipn/20 sm:w-auto"
            aria-label="Send feedback or report a bug"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition group-hover:bg-white group-hover:text-ipn">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.7}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.625 9.75h6.75m-6.75 3h4.5m8.625-.75c0 4.142-4.03 7.5-9 7.5a10.6 10.6 0 0 1-3.45-.566L3 20.25l1.316-3.95A6.9 6.9 0 0 1 3 12c0-4.142 4.03-7.5 9-7.5s9 3.358 9 7.5Z"
                />
              </svg>
            </span>
            <span>Found an issue?</span>
            <span className="font-semibold text-ipn">Send feedback</span>
          </button>
        </div>
      </footer>

      {open && <FeedbackModal onClose={() => {
        setOpen(false)
        setGuidedOpen(false)
      }} guided={guidedOpen} />}
    </>
  )
}
