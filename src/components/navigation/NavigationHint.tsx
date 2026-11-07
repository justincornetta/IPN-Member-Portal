"use client"

import { useLinkStatus } from "next/link"

/** Fixed-size feedback also covers slow/missing prefetches without a layout shift. */
export default function NavigationHint({ label }: { label: string }) {
  const { pending } = useLinkStatus()
  return (
    <span className={`inline-flex h-3 w-3 shrink-0 items-center justify-center ${pending ? "opacity-100" : "opacity-0"}`} role="status">
      {pending && <span className="sr-only">Opening {label}</span>}
      <span aria-hidden="true" className={`h-2 w-2 rounded-full bg-current ${pending ? "motion-safe:animate-pulse" : ""}`} />
    </span>
  )
}
