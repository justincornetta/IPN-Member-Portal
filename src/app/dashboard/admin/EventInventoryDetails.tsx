"use client"

import { useState } from "react"
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { inventoryRegistrationTrend, type InventoryRegistration } from "@/lib/admin/analytics/event-inventory"

export function EventInventoryDetails({ title, registrations, dailySales, count, coverageNote }: {
  title: string; registrations: InventoryRegistration[]; dailySales?: { date: string; tickets: number }[]; count: number | null; coverageNote: string
}) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const trend = inventoryRegistrationTrend(registrations, dailySales)
  const query = search.trim().toLowerCase()
  const filtered = registrations.filter((row) => `${row.name} ${row.email}`.toLowerCase().includes(query))
  const totalPages = Math.max(1, Math.ceil(filtered.length / 25))
  const currentPage = Math.min(page, totalPages - 1)
  const rows = filtered.slice(currentPage * 25, (currentPage + 1) * 25)
  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-xs leading-5 text-zinc-500">{coverageNote} {count != null && `${count} reported registrations; ${registrations.length} named records available.`} Timeline includes only records with known registration dates (UTC).</p>
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h4 className="mb-3 text-sm font-semibold text-zinc-800">Registrations over time</h4>
        {trend.length ? <div className="h-[220px] w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trend}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip /><Legend />
          <Bar dataKey="daily" name="Daily registrations" fill="#2563eb" maxBarSize={64} radius={[6, 6, 0, 0]} />
          <Line type="monotone" dataKey="cumulative" name="Cumulative registrations" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
        </ComposedChart></ResponsiveContainer></div> : <p className="py-8 text-center text-sm text-zinc-400">Registration timestamps are unavailable for this event.</p>}
      </div>
      <input aria-label={`Search registrants for ${title}`} placeholder="Search name or email" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0) }} className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" />
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white"><table className="w-full min-w-[600px] text-left text-xs">
        <thead><tr className="border-b border-zinc-100">{["Name", "Email", "Registered"].map((label) => <th key={label} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-zinc-100">{rows.length ? rows.map((row, index) => <tr key={`${row.email}:${row.registeredAt}:${index}`}><td className="px-3 py-2 text-zinc-700">{row.name || "—"}</td><td className="break-all px-3 py-2 text-zinc-600">{row.email || "—"}</td><td className="whitespace-nowrap px-3 py-2 text-zinc-600">{row.registeredAt && Number.isFinite(Date.parse(row.registeredAt)) ? `${new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" }).format(new Date(row.registeredAt))} UTC` : "Unavailable"}</td></tr>) : <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-zinc-400">{registrations.length ? "No matching registrants." : "Names and emails are unavailable in the current registration source. Attendance records are not substituted."}</td></tr>}</tbody>
      </table></div>
      {filtered.length > 25 && <div className="flex items-center justify-end gap-3 text-xs text-zinc-500"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 disabled:opacity-40">Previous registrants</button><span>Page {currentPage + 1} of {totalPages}</span><button type="button" disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 disabled:opacity-40">Next registrants</button></div>}
    </div>
  )
}
