"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { searchMembersForAdmin, assignAdminAccess, setTeamPermission, updateFeedbackStatus, deleteFeedbackSubmission, banMember, unbanMember, getMemberDetail, deleteMemberAccount } from "@/lib/admin/actions"
import type { AdminMemberProfile, AdminMemberDetail, AdminContentType, TeamPermissionsMap, FeedbackSubmission } from "@/lib/admin/actions"
import AnalyticsDashboardShell from "./AnalyticsDashboardShell"
import type { MemberInsightsData, PortalUtilizationData } from "./AnalyticsDashboardShell"
import type { LegacyAnalyticsSnapshot } from "@/lib/admin/analytics/types"
import ContentIntakeForm from "./ContentIntakeForm"

const TEAMS = ["Strategy and Operations", "Media", "PsychedelX", "Community", "IPN Labs"] as const
type TeamName = typeof TEAMS[number]

// ── Shared helpers ───────────────────────────────────────────────────────────

function getInitials(first: string | null, last: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?"
}

function formatAdminDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value))
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
        <div className="flex flex-col gap-3 px-6 py-5">
          {member.email && (
            <div className="flex items-center gap-2 rounded-lg bg-zinc-50 border border-zinc-200 px-4 py-2.5">
              <svg className="h-4 w-4 flex-shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <a href={`mailto:${member.email}`} className="text-sm text-zinc-600 hover:text-ipn hover:underline">{member.email}</a>
            </div>
          )}
          {member.whatsapp_url && (
            <a href={member.whatsapp_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 transition hover:bg-emerald-100"
            >
              <svg className="h-4 w-4 flex-shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
              <span className="text-sm text-emerald-700">WhatsApp</span>
            </a>
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

type Props = {
  isSuperadmin: boolean
  leadership: AdminMemberProfile[]
  memberInsights: MemberInsightsData | null
  portalUtilization: PortalUtilizationData
  analyticsSnapshot: LegacyAnalyticsSnapshot
  teamPermissions: TeamPermissionsMap
  feedback: FeedbackSubmission[]
  bannedMembers: AdminMemberProfile[]
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

function ModerationMemberModal({
  member: initialMember,
  onBanToggle,
  onDelete,
  onClose,
}: {
  member: AdminMemberProfile
  onBanToggle: (member: AdminMemberProfile, banned: boolean) => void
  onDelete: (memberId: string) => void
  onClose: () => void
}) {
  const [detail, setDetail] = useState<AdminMemberDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [banning, setBanning] = useState(false)
  const [banError, setBanError] = useState<string | null>(null)
  const [isBanned, setIsBanned] = useState(initialMember.is_banned ?? false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  useEffect(() => {
    startTransition(async () => {
      const d = await getMemberDetail(initialMember.id)
      setDetail(d)
      setLoading(false)
    })
  }, [initialMember.id])

  function handleBanToggle() {
    setBanning(true)
    setBanError(null)
    startTransition(async () => {
      const result = isBanned ? await unbanMember(initialMember.id) : await banMember(initialMember.id)
      setBanning(false)
      if (result.error) {
        setBanError(result.error)
      } else {
        const newBanned = !isBanned
        setIsBanned(newBanned)
        onBanToggle(initialMember, newBanned)
      }
    })
  }

  const deleteConfirmed = deleteConfirmation === (detail?.email ?? "")

  async function handleDelete() {
    if (!deleteConfirmed || deleting || !detail?.email) return
    setDeleting(true)
    setDeleteError(null)
    const res = await deleteMemberAccount(initialMember.id, detail.email)
    setDeleting(false)
    if (res.error) {
      setDeleteError(res.error)
    } else {
      setDeleteSuccess("Member deleted successfully.")
      setTimeout(() => {
        onDelete(initialMember.id)
        onClose()
        router.refresh()
      }, 1200)
    }
  }

  const displayMember = detail ?? initialMember

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4" onClick={onClose}>
      <div
        className="relative w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl max-h-[90vh]"
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
          <MemberAvatar member={displayMember} size="lg" />
          <h2 className="mt-4 text-xl font-semibold text-zinc-900">
            {displayMember.first_name} {displayMember.last_name}
          </h2>
          {displayMember.persona && (
            <p className="mt-1 text-sm text-zinc-500">{displayMember.persona}</p>
          )}
          {isBanned && (
            <span className="mt-2 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-600">
              Banned
            </span>
          )}
        </div>

        <div className="border-t border-zinc-100" />

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-zinc-400">Loading profile…</div>
        ) : (
          <div className="flex flex-col gap-5 px-6 py-5">
            {/* Contact */}
            <div className="flex flex-col gap-2">
              {detail?.email && (
                <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5">
                  <svg className="h-4 w-4 flex-shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                  </svg>
                  <a href={`mailto:${detail.email}`} className="text-sm text-zinc-600 hover:text-ipn hover:underline">{detail.email}</a>
                </div>
              )}
              {detail?.whatsapp_url && (
                <a href={detail.whatsapp_url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 transition hover:bg-emerald-100"
                >
                  <svg className="h-4 w-4 flex-shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                  </svg>
                  <span className="text-sm text-emerald-700">WhatsApp</span>
                </a>
              )}
            </div>

            {detail?.bio && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Bio</p>
                <p className="mt-1 text-sm leading-6 text-zinc-700">{detail.bio}</p>
              </div>
            )}

            {(detail?.city || detail?.state || detail?.country) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Location</p>
                <p className="mt-1 text-sm text-zinc-700">
                  {[detail.city, detail.state, detail.country].filter(Boolean).join(", ")}
                </p>
              </div>
            )}

            {detail?.field && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Field</p>
                <p className="mt-1 text-sm text-zinc-700">{detail.field}</p>
              </div>
            )}

            {(detail?.school || detail?.affiliation) && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {detail.school ? "School" : "Affiliation"}
                </p>
                <p className="mt-1 text-sm text-zinc-700">{detail.school ?? detail.affiliation}</p>
              </div>
            )}

            {detail?.interest_tags && detail.interest_tags.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Interests</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.interest_tags.map((t) => (
                    <span key={t} className="rounded-full bg-ipn/10 px-3 py-1 text-xs font-medium text-ipn">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {detail?.role_and_goals && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Role &amp; goals</p>
                <p className="mt-1 text-sm leading-6 text-zinc-700">{detail.role_and_goals}</p>
              </div>
            )}

            {detail?.linkedin_url && (
              <a href={detail.linkedin_url} target="_blank" rel="noreferrer" className="text-sm text-ipn hover:underline">
                LinkedIn profile
              </a>
            )}
          </div>
        )}

        <div className="border-t border-zinc-100 px-6 py-5">
          {banError && <p className="mb-3 text-xs text-red-600">{banError}</p>}
          <button
            type="button"
            onClick={handleBanToggle}
            disabled={banning || loading}
            className={`w-full cursor-pointer rounded-lg py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isBanned
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
            }`}
          >
            {banning ? "…" : isBanned ? "Unban member" : "Ban member"}
          </button>
        </div>

        {detail?.email && (
          <div className="border-t border-red-100 bg-red-50/40 px-6 py-5">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Delete member</p>
              <p className="text-xs leading-5 text-red-700">
                Permanently removes this member from Supabase Auth, portal data, and Mailchimp.
              </p>
              <label className="text-xs text-zinc-600">
                Type <span className="font-medium">{detail.email}</span> to confirm
              </label>
              <input
                type="email"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={detail.email}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-200"
              />
              {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
              {deleteSuccess && <p className="text-xs text-emerald-600">{deleteSuccess}</p>}
              <button
                type="button"
                onClick={handleDelete}
                disabled={!deleteConfirmed || deleting}
                className="w-full cursor-pointer rounded-lg border border-red-300 bg-red-600 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete member"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ModerationTab({
  initialBanned,
}: {
  initialBanned: AdminMemberProfile[]
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<AdminMemberProfile[]>([])
  const [searching, setSearching] = useState(false)
  const [bannedMembers, setBannedMembers] = useState(initialBanned)
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

  function handleBanToggle(member: AdminMemberProfile, banned: boolean) {
    if (banned) {
      setBannedMembers((prev) => [{ ...member, is_banned: true }, ...prev.filter((m) => m.id !== member.id)])
    } else {
      setBannedMembers((prev) => prev.filter((m) => m.id !== member.id))
    }
    setResults((prev) => prev.map((m) => m.id === member.id ? { ...m, is_banned: banned } : m))
    setSelectedMember(null)
  }

  function handleDelete(memberId: string) {
    setBannedMembers((prev) => prev.filter((m) => m.id !== memberId))
    setResults((prev) => prev.filter((m) => m.id !== memberId))
    setSelectedMember(null)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Search */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Search members</p>
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
        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <p className="text-sm text-zinc-400">No members found.</p>
        )}
        {results.length > 0 && (
          <div className="flex flex-col gap-3">
            {results.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <MemberAvatar member={m} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">{m.first_name} {m.last_name}</p>
                  <p className="truncate text-xs text-zinc-400">{m.email}</p>
                </div>
                {m.is_banned && (
                  <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                    Banned
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedMember(m)}
                  className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-ipn hover:text-ipn"
                >
                  View profile
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Banned list */}
      <div className="flex flex-col gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Banned members{bannedMembers.length > 0 ? ` (${bannedMembers.length})` : ""}
        </p>
        {bannedMembers.length === 0 ? (
          <p className="text-sm text-zinc-400">No banned members.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {bannedMembers.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4">
                <MemberAvatar member={m} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">{m.first_name} {m.last_name}</p>
                  <p className="truncate text-xs text-zinc-500">{m.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMember({ ...m, is_banned: true })}
                  className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-ipn hover:text-ipn"
                >
                  View profile
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign roles */}
      <div className="flex flex-col gap-4 border-t border-zinc-200 pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Assign roles</p>
        <MemberSearch isSuperadmin={true} />
      </div>

      {selectedMember && (
        <ModerationMemberModal
          member={selectedMember}
          onBanToggle={handleBanToggle}
          onDelete={handleDelete}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  )
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
                  {formatAdminDate(s.created_at)}
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

export default function AdminClient({ isSuperadmin, leadership, memberInsights, portalUtilization, analyticsSnapshot, teamPermissions, feedback: initialFeedback, bannedMembers }: Props) {
  type Tab = "analytics" | "content" | "leadership" | "feedback" | "moderation"
  const [tab, setTab] = useState<Tab>("analytics")
  const [selectedMember, setSelectedMember] = useState<AdminMemberProfile | null>(null)
  const [feedback, setFeedback] = useState(initialFeedback)
  const [, startTransition] = useTransition()

  function handleFeedbackStatusChange(id: string, status: "new" | "in_progress" | "resolved") {
    setFeedback((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)))
    startTransition(async () => { await updateFeedbackStatus(id, status) })
  }

  function handleFeedbackDelete(id: string) {
    setFeedback((prev) => prev.filter((s) => s.id !== id))
    startTransition(async () => { await deleteFeedbackSubmission(id) })
  }

  const newFeedbackCount = feedback.filter((f) => f.status === "new").length

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "analytics", label: "Analytics" },
    { id: "content", label: "Content" },
    { id: "leadership", label: "Leadership" },
    ...(isSuperadmin ? [{ id: "feedback" as Tab, label: "Feedback", badge: newFeedbackCount || undefined }] : []),
    ...(isSuperadmin ? [{ id: "moderation" as Tab, label: "Moderation" }] : []),
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
      <div className="overflow-x-auto border-b border-zinc-200">
        <div className="flex min-w-max">
          {tabs.map(({ id, label, badge }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative flex cursor-pointer items-center gap-1.5 whitespace-nowrap px-5 py-2.5 text-sm font-medium transition ${
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
      </div>

      {tab === "analytics" && (
        <AnalyticsDashboardShell
          memberInsights={memberInsights}
          portalUtilization={portalUtilization}
          analyticsSnapshot={analyticsSnapshot}
          onSelectMember={setSelectedMember}
        />
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

      {/* ── Moderation tab ── */}
      {tab === "moderation" && isSuperadmin && (
        <ModerationTab initialBanned={bannedMembers} />
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
