"use client"

import { useEffect, useRef, useState } from "react"
import { activeUserWindowStart, buildActiveUserDetails, type ActiveUserWindow } from "@/lib/admin/analytics/active-users"
import type { PortalUtilizationData } from "@/lib/admin/analytics/portal-utilization"

function timestamp(value: string) {
  return `${new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }).format(new Date(value))} UTC`
}

export function ActiveUserDetailsModal({ data, cohortIds, date, window, focusReturnLabel, onClose }: {
  data: PortalUtilizationData; cohortIds: Set<string>; date: string; window: ActiveUserWindow; focusReturnLabel: string | null; onClose: () => void
}) {
  const [search, setSearch] = useState("")
  const dialogRef = useRef<HTMLElement>(null)
  const members = buildActiveUserDetails(data, cohortIds, date, window)
  const query = search.trim().toLowerCase()
  const visible = members.filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(query))
  useEffect(() => {
    const previous = document.activeElement as (Element & { focus?: () => void }) | null
    const previousLabel = focusReturnLabel ?? previous?.getAttribute("aria-label")
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus()
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key !== "Tab") return
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]')
      if (!controls?.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", keyHandler)
    return () => {
      document.removeEventListener("keydown", keyHandler)
      document.body.style.overflow = previousOverflow
      // Recharts can replace SVG point nodes when the dialog state changes.
      queueMicrotask(() => {
        const replacement = previousLabel ? Array.from(document.querySelectorAll<HTMLElement>('[role="button"]')).find((node) => node.getAttribute("aria-label") === previousLabel) : null
        if (replacement) replacement.focus()
        else if (previous?.isConnected) previous.focus?.()
      })
    }
  }, [onClose, focusReturnLabel])
  const activityCell = (activity: { occurredAt: string; label: string } | null) => activity
    ? <><span className="block text-zinc-800">{activity.label}</span><span className="text-xs text-zinc-500">{timestamp(activity.occurredAt)}</span></>
    : "No retained record"
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-zinc-950/40 sm:items-center sm:px-4" onClick={onClose}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="active-user-details-title" className="flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 id="active-user-details-title" className="text-lg font-semibold text-zinc-900">{window === "monthly" ? "Monthly" : "Weekly"} active users · {date}</h2>
            <p className="mt-1 text-sm text-zinc-500">{members.length} members with a qualifying action from {activeUserWindowStart(date, window)} through {date}.</p>
            <p className="mt-1 text-xs text-zinc-500">Details are as of the selected day (UTC), not today. Older sign-ins may not have retained records.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50">Close</button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <input aria-label="Search active users" placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} className="mb-4 w-full max-w-sm rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr className="border-b border-zinc-200">{["Name", "Email", "Last sign-in", "Last qualifying activity"].map((label) => <th key={label} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</th>)}</tr></thead>
            <tbody>{visible.map((member) => <tr key={member.userId} className="border-b border-zinc-100 align-top"><td className="px-3 py-3 font-medium">{member.name}</td><td className="px-3 py-3">{member.email || "—"}</td><td className="px-3 py-3">{member.lastSignIn ? timestamp(member.lastSignIn) : "No retained record"}</td><td className="px-3 py-3">{activityCell(member.lastQualifyingActivity)}</td></tr>)}</tbody>
          </table></div>
          {!visible.length && <p className="py-8 text-center text-sm text-zinc-500">{members.length ? "No matching members. Try another name or email." : "No eligible members had a qualifying action in this rolling window."}</p>}
        </div>
      </section>
    </div>
  )
}
