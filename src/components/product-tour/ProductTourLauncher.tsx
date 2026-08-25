"use client"

import { useProductTour } from "./ProductTourProvider"

export default function ProductTourLauncher() {
  const { ready, progress, startOrResume } = useProductTour()
  if (!ready) return null

  const label = progress?.status === "paused" || progress?.status === "active"
    ? "Resume portal tour"
    : progress?.status === "completed"
      ? "Retake portal tour"
      : "Take a portal tour"

  return (
    <button
      type="button"
      onClick={startOrResume}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ipn/20 bg-white px-3 py-2 text-sm font-semibold text-ipn transition hover:border-ipn/35 hover:bg-ipn-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ipn"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6M4.5 4.5v15h15" />
      </svg>
      {label}
    </button>
  )
}
