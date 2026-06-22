"use client"

import { useState, useTransition, useEffect } from "react"
import { searchMembersForAdmin, assignAdminAccess, setTeamPermission, updateFeedbackStatus, deleteFeedbackSubmission } from "@/lib/admin/actions"
import type { AdminMemberProfile, AdminContentType, TeamPermissionsMap, FeedbackSubmission } from "@/lib/admin/actions"
import type { MailchimpStatus } from "@/lib/mailchimp/status"
import ContentIntakeForm from "./ContentIntakeForm"

const TEAMS = ["Strategy and Operations", "Media", "PsychedelX", "Community", "IPN Labs"] as const
type TeamName = typeof TEAMS[number]

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
  teamPermissions: TeamPermissionsMap
  feedback: FeedbackSubmission[]
}

function TeamPermissionsMatrix({ initialPerms }: { initialPerms: TeamPermissionsMap }) {
  const [perms, setPerms] = useState<TeamPermissionsMap>(initialPerms)
  const [saving, setSaving] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function isEnabled(team: TeamName, contentType: AdminContentType): boolean {
    const val = perms[team]?.[contentType]
    return val === undefined ? true : val
  }

  function handleToggle(team: TeamName, contentType: AdminContentType, value: boolean) {
    const key = `${team}:${contentType}`
    setSaving(key)
    setPerms((prev) => ({
      ...prev,
      [team]: { ...prev[team], [contentType]: value },
    }))
    startTransition(async () => {
      await setTeamPermission(team, contentType, value)
      setSaving(null)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">Team</th>
              {CONTENT_TYPES.map(({ id, label }) => (
                <th key={id} className="px-3 pb-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {TEAMS.map((team) => (
              <tr key={team}>
                <td className="py-2.5 pr-4 text-sm font-medium text-zinc-700 whitespace-nowrap">{team}</td>
                {CONTENT_TYPES.map(({ id }) => {
                  const key = `${team}:${id}`
                  return (
                    <td key={id} className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={isEnabled(team, id)}
                        disabled={saving === key}
                        onChange={(e) => handleToggle(team, id, e.target.checked)}
                        className="h-4 w-4 cursor-pointer accent-ipn disabled:cursor-wait"
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-400">All permissions are on by default. Uncheck to restrict a team from publishing that content type.</p>
    </div>
  )
}

// ── Main client component ────────────────────────────────────────────────────

const TEAM_ORDER = ["Strategy and Operations", "Media", "PsychedelX", "Community", "IPN Labs"] as const

const CONTENT_TYPES: { id: AdminContentType; label: string }[] = [
  { id: "upcoming_event", label: "Events" },
  { id: "past_recording", label: "Recordings" },
  { id: "member_resource", label: "Benefits" },
  { id: "blog_post", label: "Blog posts" },
  { id: "partner", label: "Partners" },
]

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

function FeedbackStatusBadge({ status }: { status: string }) {
  const cfg =
    status === "resolved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "in_progress"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-zinc-200 bg-zinc-50 text-zinc-500"
  const label =
    status === "resolved" ? "Resolved" : status === "in_progress" ? "In progress" : "New"
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg}`}>
      {label}
    </span>
  )
}

function FeedbackTypeBadge({ type }: { type: string }) {
  const cfg =
    type === "bug"
      ? "border-red-200 bg-red-50 text-red-600"
      : type === "suggestion"
        ? "border-ipn/30 bg-ipn/5 text-ipn"
        : "border-zinc-200 bg-zinc-50 text-zinc-500"
  const label = type === "bug" ? "Bug" : type === "suggestion" ? "Suggestion" : "Feedback"
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg}`}>
      {label}
    </span>
  )
}

function FeedbackTab({
  submissions,
  onStatusChange,
  onDelete,
}: {
  submissions: FeedbackSubmission[]
  onStatusChange: (id: string, status: "new" | "in_progress" | "resolved") => void
  onDelete: (id: string) => void
}) {
  const newCount = submissions.filter((s) => s.status === "new").length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {submissions.length} submission{submissions.length !== 1 ? "s" : ""}
        </p>
        {newCount > 0 && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            {newCount} new
          </span>
        )}
      </div>

      {submissions.length === 0 ? (
        <p className="text-sm text-zinc-400">No submissions yet.</p>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm divide-y divide-zinc-100">
          {submissions.map((s) => (
            <div key={s.id} className="flex flex-col gap-2 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <FeedbackTypeBadge type={s.type} />
                <FeedbackStatusBadge status={s.status} />
                <span className="ml-auto text-xs text-zinc-400">
                  {new Date(s.created_at).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </span>
              </div>
              <p className="text-sm text-zinc-800 whitespace-pre-wrap">{s.message}</p>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-zinc-400">
                  <span className="font-medium text-zinc-600">{s.user_name ?? "Unknown"}</span>
                  {s.user_email && <> · {s.user_email}</>}
                  {s.page && <> · <span className="font-mono">{s.page}</span></>}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={s.status}
                    onChange={(e) => onStatusChange(s.id, e.target.value as "new" | "in_progress" | "resolved")}
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 outline-none focus:border-ipn focus:ring-1 focus:ring-ipn/20"
                  >
                    <option value="new">New</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onDelete(s.id)}
                    className="rounded-lg border border-zinc-200 p-1.5 text-zinc-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                    aria-label="Delete submission"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminClient({ isSuperadmin, leadership, analytics, teamPermissions, feedback: initialFeedback }: Props) {
  type Tab = "analytics" | "content" | "leadership" | "feedback"
  const defaultTab: Tab = analytics ? "analytics" : "content"
  const [tab, setTab] = useState<Tab>(defaultTab)
  const [selectedMember, setSelectedMember] = useState<AdminMemberProfile | null>(null)
  const [signupsPage, setSignupsPage] = useState(0)
  const [feedback, setFeedback] = useState(initialFeedback)
  const [, startTransition] = useTransition()

  function handleFeedbackStatusChange(id: string, status: "new" | "in_progress" | "resolved") {
    setFeedback((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)))
    startTransition(() => { updateFeedbackStatus(id, status) })
  }

  function handleFeedbackDelete(id: string) {
    setFeedback((prev) => prev.filter((s) => s.id !== id))
    startTransition(() => { deleteFeedbackSubmission(id) })
  }

  const newFeedbackCount = feedback.filter((f) => f.status === "new").length

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    ...(analytics ? [{ id: "analytics" as Tab, label: "Analytics" }] : []),
    { id: "content", label: "Content" },
    { id: "leadership", label: "Leadership" },
    ...(isSuperadmin ? [{ id: "feedback" as Tab, label: "Feedback", badge: newFeedbackCount || undefined }] : []),
  ]

  const rosterByTeam = TEAM_ORDER.map((team) => ({
    team,
    members: sortDirectorsFirst(leadership.filter((m) => m.team === team)),
  })).filter((g) => g.members.length > 0)

  const knownTeams = new Set(TEAM_ORDER as readonly string[])
  const ungrouped = sortDirectorsFirst(
    leadership.filter((m) => !m.team || !knownTeams.has(m.team)),
  )

  const superadminsWithoutTeam = ungrouped.filter((m) => m.role === "superadmin")
  const adminsWithoutTeam = ungrouped.filter((m) => m.role !== "superadmin")

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Admin</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isSuperadmin ? "Superadmin: full access" : "Leadership: analytics access"}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-zinc-200">
        {tabs.map(({ id, label, badge }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`relative flex cursor-pointer items-center gap-1.5 px-5 py-2.5 text-sm font-medium transition ${
              tab === id
                ? "-mb-px border-b-2 border-ipn text-ipn"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {label}
            {badge ? (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
                {badge > 9 ? "9+" : badge}
              </span>
            ) : null}
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

          {analytics.recent && (() => {
            const PAGE_SIZE = 5
            const totalPages = Math.ceil(analytics.recent.length / PAGE_SIZE)
            const pageItems = analytics.recent.slice(signupsPage * PAGE_SIZE, (signupsPage + 1) * PAGE_SIZE)
            return (
              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
                  <h2 className="text-sm font-semibold text-zinc-800">Recent signups</h2>
                  <span className="text-xs text-zinc-400">{analytics.recent.length} most recent</span>
                </div>
                <div className="divide-y divide-zinc-100">
                  {pageItems.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMember({
                        id: m.id,
                        first_name: m.first_name,
                        last_name: m.last_name,
                        email: m.email,
                        avatar_url: null,
                        role: null,
                        admin_role: null,
                        team: null,
                        persona: m.persona,
                        bio: null,
                      })}
                      className="flex w-full cursor-pointer items-center justify-between px-5 py-3 text-left transition hover:bg-zinc-50"
                    >
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
                          <details className="max-w-xs text-left text-[11px] text-zinc-500" onClick={(e) => e.stopPropagation()}>
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
                    </button>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-zinc-100 px-5 py-3">
                    <button
                      type="button"
                      onClick={() => setSignupsPage((p) => Math.max(0, p - 1))}
                      disabled={signupsPage === 0}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-zinc-400">
                      Page {signupsPage + 1} of {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSignupsPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={signupsPage === totalPages - 1}
                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {tab === "content" && <ContentIntakeForm />}

      {/* ── Leadership tab ── */}
      {tab === "leadership" && (
        <div className="flex flex-col gap-8">
          {/* Roster */}
          <div className="flex flex-col gap-6">
            {rosterByTeam.length === 0 && superadminsWithoutTeam.length === 0 && adminsWithoutTeam.length === 0 && (
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

            {adminsWithoutTeam.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Other</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {adminsWithoutTeam.map((m) => (
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
                      <svg className="h-4 w-4 flex-shrink-0 text-zinc-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

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

          {/* Team permissions (superadmin only) */}
          {isSuperadmin && (
            <div className="flex flex-col gap-4 border-t border-zinc-200 pt-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Team permissions</p>
                <p className="mt-1 text-xs text-zinc-500">Control which teams can publish each content type.</p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <TeamPermissionsMatrix initialPerms={teamPermissions} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Feedback tab ── */}
      {tab === "feedback" && isSuperadmin && (
        <FeedbackTab
          submissions={feedback}
          onStatusChange={handleFeedbackStatusChange}
          onDelete={handleFeedbackDelete}
        />
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
