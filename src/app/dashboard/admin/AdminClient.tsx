"use client"

import { useState, useTransition, useEffect } from "react"
import { searchMembersForAdmin, assignAdminAccess } from "@/lib/admin/actions"
import type { AdminMemberProfile } from "@/lib/admin/actions"
import type { MailchimpStatus } from "@/lib/mailchimp/status"
import ContentIntakeForm from "./ContentIntakeForm"

const TEAMS = ["Strategy", "Media", "PsychedelX", "Community", "IPN Labs"] as const

// ── Shared helpers ───────────────────────────────────────────────────────────

function getInitials(first: string | null, last: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?"
}

function MemberAvatar({ member, size = "md" }: { member: AdminMemberProfile; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-20 w-20 text-xl" : size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs"
  const initials = getInitials(member.first_name, member.last_name)
  return (
    <div className={`${cls} flex-shrink-0 overflow-hidden rounded-full`}>
      {member.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-ipn font-semibold text-white">
          {initials}
        </div>
      )}
    </div>
  )
}


// ── Member modal (profile view + optional edit) ──────────────────────────────

function AdminMemberModal({
  member: initialMember,
  isSuperadmin,
  onClose,
}: {
  member: AdminMemberProfile
  isSuperadmin: boolean
  onClose: () => void
}) {
  const [member, setMember] = useState(initialMember)
  const [adminRole, setAdminRole] = useState(member.admin_role ?? "")
  const [team, setTeam] = useState(member.team ?? "")
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  function handleSave() {
    setSaved(false)
    setError(null)
    startTransition(async () => {
      const result = await assignAdminAccess(member.id, adminRole.trim() || null, team || null)
      if (result.error) {
        setError(result.error)
      } else {
        const newRole = member.role === "superadmin" ? "superadmin" : (adminRole || team) ? "admin" : null
        setMember((m) => ({ ...m, admin_role: adminRole || null, team: team || null, role: newRole }))
        setSaved(true)
      }
    })
  }

  function handleRemove() {
    setAdminRole("")
    setTeam("")
    startTransition(async () => {
      await assignAdminAccess(member.id, null, null)
      setMember((m) => ({ ...m, admin_role: null, team: null, role: null }))
      setSaved(true)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4" onClick={onClose}>
      <div
        className="relative w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex flex-col items-center px-6 pb-4 pt-8">
          <MemberAvatar member={member} size="lg" />
          <h2 className="mt-4 text-xl font-semibold text-zinc-900">
            {member.first_name} {member.last_name}
          </h2>
          {member.persona && (
            <p className="mt-1 text-sm text-zinc-500">{member.persona}</p>
          )}
          {member.admin_role && (
            <p className="mt-1.5 text-xs font-medium text-ipn">{member.admin_role}</p>
          )}
        </div>

        <div className="border-t border-zinc-100" />

        {/* Body */}
        <div className="flex flex-col gap-4 px-6 py-5">
          {member.email && (
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-2.5">
              <svg className="h-4 w-4 flex-shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <span className="text-sm text-zinc-600">{member.email}</span>
            </div>
          )}
          {member.bio && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">About</p>
              <p className="mt-1 text-sm leading-6 text-zinc-700">{member.bio}</p>
            </div>
          )}
        </div>

        {/* Edit form (superadmin only) */}
        {isSuperadmin && (
          <div className="border-t border-zinc-100 px-6 py-5 flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {member.role ? "Edit role" : "Assign role"}
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600">Role title</label>
              <input
                type="text"
                value={adminRole}
                onChange={(e) => { setAdminRole(e.target.value); setSaved(false) }}
                placeholder="e.g. Director of Strategy"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600">Team</label>
              <select
                value={team}
                onChange={(e) => { setTeam(e.target.value); setSaved(false) }}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
              >
                <option value="">No team</option>
                {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {saved && <p className="text-xs text-green-600">Saved</p>}
            <div className="flex gap-2">
              <button type="button" onClick={handleSave}
                className="flex-1 cursor-pointer rounded-lg bg-ipn py-2 text-sm font-medium text-white hover:bg-ipn/90 transition"
              >
                Save
              </button>
              {member.role && member.role !== "superadmin" && (
                <button type="button" onClick={handleRemove}
                  className="cursor-pointer rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-400 hover:border-red-200 hover:text-red-500 transition"
                >
                  Remove access
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Analytics components ─────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-3xl font-semibold text-zinc-900">{value}</p>
      <p className="text-sm text-zinc-500">{label}</p>
    </div>
  )
}

function BreakdownList({ title, items, total }: { title: string; items: [string, number][]; total: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
      <div className="flex flex-col gap-2">
        {items.map(([label, count]) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0
          return (
            <div key={label} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-zinc-600">
                <span className="truncate pr-2">{label}</span>
                <span className="flex-shrink-0 tabular-nums">{count} ({pct}%)</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full bg-ipn" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Member search (used inline in Leadership tab) ────────────────────────────

function MemberSearch({ isSuperadmin }: { isSuperadmin: boolean }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<AdminMemberProfile[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedMember, setSelectedMember] = useState<AdminMemberProfile | null>(null)
  const [, startTransition] = useTransition()

  function handleSearch(value: string) {
    setQuery(value)
    if (value.trim().length < 2) { setResults([]); return }
    setSearching(true)
    startTransition(async () => {
      const res = await searchMembersForAdmin(value)
      setResults(res)
      setSearching(false)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search members by name…"
          className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm placeholder:text-zinc-400 focus:border-ipn focus:outline-none focus:ring-1 focus:ring-ipn"
        />
      </div>

      {searching && <p className="text-xs text-zinc-400">Searching…</p>}

      {results.length > 0 && (
        <div className="flex flex-col gap-3">
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMember(m)}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm text-left transition hover:border-ipn hover:shadow-md cursor-pointer"
            >
              <MemberAvatar member={m} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900">{m.first_name} {m.last_name}</p>
                <p className="truncate text-xs text-zinc-400">{m.email}</p>
                {m.persona && <p className="text-xs text-zinc-400">{m.persona}</p>}
              </div>
              <svg className="h-4 w-4 flex-shrink-0 text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-sm text-zinc-400">No members found.</p>
      )}

      {selectedMember && (
        <AdminMemberModal
          member={selectedMember}
          isSuperadmin={isSuperadmin}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  )
}

// ── Props from server ────────────────────────────────────────────────────────

export type AnalyticsData = {
  total: number
  discoverable: number
  withTags: number
  personaItems: [string, number][]
  fieldItems: [string, number][]
  topTags: [string, number][]
  topSchools: [string, number][]
  topCountries: [string, number][]
  recent: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    persona: string | null
    created_at: string
    mailchimp_status: MailchimpStatus | null
    mailchimp_last_error_raw: unknown
    mailchimp_last_error_description: string | null
  }[] | null
}

type Props = {
  isSuperadmin: boolean
  leadership: AdminMemberProfile[]
  analytics: AnalyticsData | null
}

// ── Main client component ────────────────────────────────────────────────────

const TEAM_ORDER = ["Strategy", "Media", "PsychedelX", "Community"] as const

function sortDirectorsFirst(members: AdminMemberProfile[]) {
  return [...members].sort((a, b) => {
    const aDir = a.admin_role?.toLowerCase().includes("director") ?? false
    const bDir = b.admin_role?.toLowerCase().includes("director") ?? false
    if (aDir && !bDir) return -1
    if (!aDir && bDir) return 1
    return (a.first_name ?? "").localeCompare(b.first_name ?? "")
  })
}

function mailchimpBadge(status: MailchimpStatus | null) {
  switch (status) {
    case "subscribed":
      return {
        label: "Subscribed",
        className: "border-green-200 bg-green-50 text-green-700",
      }
    case "unsubscribed":
      return {
        label: "Unsubscribed",
        className: "border-zinc-200 bg-zinc-50 text-zinc-500",
      }
    case "pending":
      return {
        label: "Pending",
        className: "border-blue-200 bg-blue-50 text-blue-700",
      }
    case "cleaned":
      return {
        label: "Cleaned",
        className: "border-orange-200 bg-orange-50 text-orange-700",
      }
    case "transactional":
      return {
        label: "Transactional",
        className: "border-violet-200 bg-violet-50 text-violet-700",
      }
    case "sync_failed":
      return {
        label: "Sync failed",
        className: "border-red-200 bg-red-50 text-red-700",
      }
    case "not_found":
      return {
        label: "Not found",
        className: "border-zinc-200 bg-zinc-50 text-zinc-500",
      }
    default:
      return {
        label: "Unknown",
        className: "border-amber-200 bg-amber-50 text-amber-700",
      }
  }
}

export default function AdminClient({ isSuperadmin, leadership, analytics }: Props) {
  type Tab = "analytics" | "content" | "leadership"
  const defaultTab: Tab = analytics ? "analytics" : "content"
  const [tab, setTab] = useState<Tab>(defaultTab)
  const [selectedMember, setSelectedMember] = useState<AdminMemberProfile | null>(null)

  const tabs: { id: Tab; label: string }[] = [
    ...(analytics ? [{ id: "analytics" as Tab, label: "Analytics" }] : []),
    { id: "content", label: "Content" },
    { id: "leadership", label: "Leadership" },
  ]

  const rosterByTeam = TEAM_ORDER.map((team) => ({
    team,
    members: sortDirectorsFirst(leadership.filter((m) => m.team === team)),
  })).filter((g) => g.members.length > 0)

  const superadminsWithoutTeam = sortDirectorsFirst(
    leadership.filter((m) => m.role === "superadmin" && !m.team),
  )

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Admin</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isSuperadmin ? "Superadmin — full access" : "Leadership — analytics access"}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-zinc-200">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`cursor-pointer px-5 py-2.5 text-sm font-medium transition ${
              tab === id
                ? "-mb-px border-b-2 border-ipn text-ipn"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Analytics tab ── */}
      {tab === "analytics" && analytics && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total members" value={analytics.total} />
            <StatCard label="Discoverable" value={analytics.discoverable} />
            <StatCard label="Hidden" value={analytics.total - analytics.discoverable} />
            <StatCard label="With interest tags" value={analytics.withTags} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <BreakdownList title="Stage breakdown" items={analytics.personaItems} total={analytics.total} />
            <BreakdownList title="Field breakdown" items={analytics.fieldItems} total={analytics.total} />
            <BreakdownList title="Top interest tags" items={analytics.topTags} total={analytics.withTags} />
            <BreakdownList title="Top schools" items={analytics.topSchools} total={analytics.topSchools.reduce((s, [, n]) => s + n, 0)} />
            <BreakdownList title="Top countries" items={analytics.topCountries} total={analytics.total} />
          </div>

          {analytics.recent && (
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-zinc-800">Recent signups</h2>
              </div>
              <div className="divide-y divide-zinc-100">
                {analytics.recent.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-zinc-800">{m.first_name} {m.last_name}</p>
                      <p className="text-xs text-zinc-400">{m.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      {m.persona && <p className="text-xs text-zinc-500">{m.persona}</p>}
                      {(() => {
                        const badge = mailchimpBadge(m.mailchimp_status)
                        return (
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                        )
                      })()}
                      {m.mailchimp_status === "sync_failed" && (
                        <details className="max-w-xs text-left text-[11px] text-zinc-500">
                          <summary className="cursor-pointer text-right text-zinc-400 hover:text-zinc-600">
                            Mailchimp details
                          </summary>
                          <div className="mt-1 rounded-lg border border-red-100 bg-red-50 p-2 text-red-700">
                            <p>{m.mailchimp_last_error_description ?? "No canonical error description was stored."}</p>
                            {m.mailchimp_last_error_raw ? (
                              <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded bg-white/70 p-2 font-mono text-[10px] text-red-900">
                                {JSON.stringify(m.mailchimp_last_error_raw, null, 2)}
                              </pre>
                            ) : (
                              <p className="mt-1 text-red-500">No raw Mailchimp error was stored.</p>
                            )}
                          </div>
                        </details>
                      )}
                      <p className="text-xs text-zinc-400">
                        {new Date(m.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "content" && <ContentIntakeForm />}

      {/* ── Leadership tab ── */}
      {tab === "leadership" && (
        <div className="flex flex-col gap-8">
          {/* Roster */}
          <div className="flex flex-col gap-6">
            {rosterByTeam.length === 0 && superadminsWithoutTeam.length === 0 && (
              <p className="text-sm text-zinc-400">No team members assigned yet.</p>
            )}

            {rosterByTeam.map(({ team, members }) => (
              <div key={team} className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{team}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMember(m)}
                      className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm text-left transition hover:border-ipn hover:shadow-md cursor-pointer"
                    >
                      <MemberAvatar member={m} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900">{m.first_name} {m.last_name}</p>
                        {m.admin_role && <p className="text-xs text-zinc-500">{m.admin_role}</p>}
                      </div>
                      {m.role === "superadmin" && (
                        <span className="flex-shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                          Superadmin
                        </span>
                      )}
                      <svg className="h-4 w-4 flex-shrink-0 text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {superadminsWithoutTeam.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Superadmins</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {superadminsWithoutTeam.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMember(m)}
                      className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm text-left transition hover:border-ipn hover:shadow-md cursor-pointer"
                    >
                      <MemberAvatar member={m} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900">{m.first_name} {m.last_name}</p>
                        {m.admin_role && <p className="text-xs text-zinc-500">{m.admin_role}</p>}
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                        Superadmin
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Search (superadmin only) */}
          {isSuperadmin && (
            <div className="flex flex-col gap-4 border-t border-zinc-200 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Assign roles</p>
              <MemberSearch isSuperadmin={isSuperadmin} />
            </div>
          )}
        </div>
      )}

      {/* Shared member modal */}
      {selectedMember && (
        <AdminMemberModal
          member={selectedMember}
          isSuperadmin={isSuperadmin}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  )
}
