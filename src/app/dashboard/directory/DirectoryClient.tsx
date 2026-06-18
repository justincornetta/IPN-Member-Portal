"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useTransition, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { PERSONA_OPTIONS } from "@/lib/constants/registration"
import type {
  ConnectionEntry,
  DirectoryMapCity,
  DirectoryMember,
  DirectoryParams,
} from "@/lib/directory/types"
import { sendConnectionRequest, acceptConnection, removeConnection } from "@/lib/connections/actions"

const GlobeDirectoryView = dynamic(() => import("./GlobeDirectoryView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[620px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-950 text-sm font-medium text-white">
      Loading map...
    </div>
  ),
})

const PERSONAS = PERSONA_OPTIONS.map((o) => o.value)
type DirectoryView = "list" | "globe"

// DB values are the display labels — this is an identity map kept for future flexibility
const PERSONA_LABEL: Record<string, string> = Object.fromEntries(
  PERSONA_OPTIONS.map((o) => [o.value, o.value]),
)

function directoryViewFromParam(value: string | null): DirectoryView {
  return value === "globe" ? "globe" : "list"
}

function getInitials(first: string | null, last: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?"
}

function AvatarCircle({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null
  initials: string
}) {
  return (
    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-ipn text-lg font-semibold text-white">
          {initials}
        </div>
      )}
    </div>
  )
}

function PersonaBadge({ persona }: { persona: string | null }) {
  if (!persona) return null
  return (
    <span className="inline-block rounded-full bg-ipn-light px-2.5 py-0.5 text-xs font-medium text-ipn">
      {PERSONA_LABEL[persona] ?? persona}
    </span>
  )
}

function MemberCard({
  member,
  connectionEntry,
  onOpen,
}: {
  member: DirectoryMember
  connectionEntry?: ConnectionEntry
  onOpen: (m: DirectoryMember) => void
}) {
  const initials = getInitials(member.first_name, member.last_name)
  const institution = member.school ?? member.affiliation
  const tags = member.interest_tags ?? []
  const isConnected = connectionEntry?.status === "accepted"

  return (
    <button
      type="button"
      onClick={() => onOpen(member)}
      className="group flex w-full flex-col items-center rounded-xl border border-zinc-200 bg-white px-4 pb-5 pt-6 shadow-sm transition duration-150 ease-out hover:[transform:translateY(-6px)] hover:border-ipn hover:shadow-lg text-left cursor-pointer"
    >
      <div className="relative">
        <AvatarCircle avatarUrl={member.avatar_url} initials={initials} />
        {isConnected && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 ring-2 ring-white">
            <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          </span>
        )}
      </div>
      <p className="mt-3 text-center text-sm font-semibold text-zinc-900 group-hover:text-ipn">
        {member.first_name} {member.last_name}
      </p>
      <div className="mt-1.5">
        <PersonaBadge persona={member.persona} />
      </div>
      {institution && (
        <p className="mt-1.5 text-center text-xs font-medium text-zinc-600">
          {institution}
        </p>
      )}
      <p className="mt-1.5 text-center text-xs text-zinc-400">
        {tags.length > 0 ? tags.join(" · ") : " "}
      </p>
    </button>
  )
}

function ConfirmRemoveModal({
  name,
  onConfirm,
  onCancel,
}: {
  name: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/40 px-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-zinc-900">Remove connection?</h2>
        <p className="mt-2 text-sm text-zinc-500">
          You and <span className="font-medium text-zinc-700">{name}</span> will no longer be connected.
        </p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel}
            className="flex-1 rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition">
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className="flex-1 rounded-lg border border-ipn bg-transparent py-2 text-sm font-medium text-ipn hover:bg-ipn/5 transition">
            Remove connection
          </button>
        </div>
      </div>
    </div>
  )
}

function MemberModal({
  member,
  connectionEntry,
  onConnectionChange,
  onClose,
}: {
  member: DirectoryMember
  connectionEntry: ConnectionEntry | undefined
  onConnectionChange: (entry: ConnectionEntry) => void
  onClose: () => void
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const initials = getInitials(member.first_name, member.last_name)
  const location = [member.city, member.state].filter(Boolean).join(", ")
  const institution = member.school ?? member.affiliation
  const isConnected = connectionEntry?.status === "accepted"

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex flex-col items-center px-6 pb-4 pt-8">
          <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-full">
            {member.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-ipn text-2xl font-semibold text-white">
                {initials}
              </div>
            )}
          </div>
          <h2 className="mt-4 text-xl font-semibold text-zinc-900">
            {member.first_name} {member.last_name}
          </h2>
          {member.persona && (
            <div className="mt-2">
              <PersonaBadge persona={member.persona} />
            </div>
          )}
          {(institution || location) && (
            <div className="mt-2 flex flex-col items-center gap-0.5">
              {institution && (
                <p className="text-sm font-medium text-zinc-600">{institution}</p>
              )}
              {location && (
                <p className="text-xs text-zinc-400">{location}</p>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-100" />

        {/* Body */}
        <div className="flex flex-col gap-5 px-6 py-5">
          {member.field && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Field</p>
              <p className="mt-1 text-sm text-zinc-700">{member.field}</p>
            </div>
          )}
          {member.bio && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">About</p>
              <p className="mt-1 text-sm leading-6 text-zinc-700">{member.bio}</p>
            </div>
          )}
          {member.interest_tags && member.interest_tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Interests</p>
              <p className="mt-1 text-sm text-zinc-700">{member.interest_tags.join(" · ")}</p>
            </div>
          )}
          {isConnected && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Contact</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {member.contact?.email && (
                  <a
                    href={`mailto:${member.contact.email}`}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:border-ipn hover:text-ipn"
                  >
                    Email
                  </a>
                )}
                {member.contact?.whatsapp_url && (
                  <a
                    href={member.contact.whatsapp_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
                  >
                    WhatsApp
                  </a>
                )}
                {!member.contact?.email && !member.contact?.whatsapp_url && (
                  <p className="text-sm text-zinc-500">No contact details added yet.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-4">
          {isConnected ? (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="rounded-lg border border-ipn bg-transparent px-4 py-2 text-sm font-medium text-ipn hover:bg-ipn/5 transition"
            >
              Remove connection
            </button>
          ) : member.linkedin_url ? (
            <a
              href={member.linkedin_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.27c-.97 0-1.75-.79-1.75-1.76s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.76-1.75 1.76zm13.5 11.27h-3v-5.6c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97v5.7h-3v-10h2.88v1.36h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.59v5.61z" />
              </svg>
              LinkedIn
            </a>
          ) : (
            <span />
          )}
          {(() => {
            const { status, amRequester } = connectionEntry ?? {}

            if (status === "accepted") {
              return (
                <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Connected
                </span>
              )
            }

            if (status === "pending" && amRequester) {
              return (
                <button type="button" disabled className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-400 cursor-default">
                  Request Sent
                </button>
              )
            }

            if (status === "pending" && !amRequester) {
              return (
                <button
                  type="button"
                  onClick={() => {
                    onConnectionChange({ status: "accepted", amRequester: false })
                    startTransition(async () => {
                      const result = await acceptConnection(member.id)
                      if (!result.error) router.refresh()
                    })
                  }}
                  className="rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white hover:bg-ipn/90 transition"
                >
                  Accept Request
                </button>
              )
            }

            return (
              <button
                type="button"
                onClick={() => {
                  onConnectionChange({ status: "pending", amRequester: true })
                  startTransition(async () => {
                    const result = await sendConnectionRequest(member.id)
                    if (!result.error) router.refresh()
                  })
                }}
                className="rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white hover:bg-ipn/90 transition"
              >
                Connect
              </button>
            )
          })()}
        </div>

        {(!connectionEntry || connectionEntry.status === "declined") && (
          <p className="px-6 pb-4 text-center text-xs text-zinc-400">
            Connecting lets you share email and WhatsApp details with each other.
          </p>
        )}
      </div>

      {confirmRemove && (
        <ConfirmRemoveModal
          name={`${member.first_name ?? ""} ${member.last_name ?? ""}`.trim()}
          onConfirm={() => {
            onConnectionChange({ status: "declined", amRequester: true })
            startTransition(async () => {
              const result = await removeConnection(member.id)
              if (!result.error) router.refresh()
            })
            setConfirmRemove(false)
          }}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
    </div>
  )
}

function SchoolCombobox({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)

  const filtered = query.length >= 1
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []

  return (
    <div>
      <input
        type="text"
        value={query}
        placeholder="e.g. MIT, MAPS…"
        autoComplete="off"
        onChange={(e) => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => { if (query.length >= 1) setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-ipn focus:outline-none focus:ring-1 focus:ring-ipn"
      />
      {open && filtered.length > 0 && (
        <ul className="mt-1 max-h-40 overflow-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          {filtered.map((o) => (
            <li
              key={o}
              onMouseDown={() => { onChange(o); setQuery(o); setOpen(false) }}
              className="cursor-pointer px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50"
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}


function FilterDrawer({
  open,
  onClose,
  personas,
  onTogglePersona,
  school,
  onSchool,
  schools,
  field,
  onField,
  tags,
  onToggleTag,
  availableTags,
  onApply,
  onClear,
  hasActiveFilters,
}: {
  open: boolean
  onClose: () => void
  personas: string[]
  onTogglePersona: (p: string) => void
  school: string
  onSchool: (v: string) => void
  schools: string[]
  field: string
  onField: (v: string) => void
  tags: string[]
  onToggleTag: (t: string) => void
  availableTags: string[]
  onApply: () => void
  onClear: () => void
  hasActiveFilters: boolean
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-50 flex h-full w-80 flex-col overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <p className="text-sm font-semibold text-zinc-900">Filters</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 px-5 py-5">
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Stage
            </p>
            <div className="flex flex-col gap-2">
              {PERSONAS.map((p) => (
                <label key={p} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={personas.includes(p)}
                    onChange={() => onTogglePersona(p)}
                    className="h-4 w-4 rounded border-zinc-300 accent-[#664fa1]"
                  />
                  <span className="text-sm text-zinc-700">{PERSONA_LABEL[p] ?? p}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              School / Affiliation
            </p>
            <SchoolCombobox value={school} onChange={onSchool} options={schools} />
          </div>

          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Field
            </p>
            <input
              type="text"
              placeholder="e.g. Neuroscience…"
              value={field}
              onChange={(e) => onField(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-ipn focus:outline-none focus:ring-1 focus:ring-ipn"
            />
          </div>

          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Interests
            </p>
            {availableTags.length > 0 ? (
              <div className="max-h-52 overflow-y-auto flex flex-col gap-2 pr-1">
                {availableTags.map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={tags.includes(t)}
                      onChange={() => onToggleTag(t)}
                      className="h-4 w-4 rounded border-zinc-300 accent-[#664fa1]"
                    />
                    <span className="text-sm text-zinc-700">{t}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">No members have added interests yet.</p>
            )}
          </div>
        </div>

        <div className="border-t border-zinc-100 px-5 py-4">
          <div className="flex gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClear}
                className="flex-1 cursor-pointer rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onApply}
              className="flex-1 cursor-pointer rounded-lg bg-ipn py-2 text-sm font-medium text-white transition hover:bg-ipn-dark"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type Props = {
  members: DirectoryMember[]
  mapCities: DirectoryMapCity[]
  showSchoolTab: boolean
  currentParams: DirectoryParams
  schools: string[]
  availableTags: string[]
  connectionMap: Record<string, ConnectionEntry>
}

export default function DirectoryClient({
  members,
  mapCities,
  showSchoolTab,
  currentParams,
  schools,
  availableTags,
  connectionMap: initialConnectionMap,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [view, setView] = useState<DirectoryView>(() =>
    directoryViewFromParam(searchParams.get("view")),
  )
  const [searchInput, setSearchInput] = useState(currentParams.q)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerPersonas, setDrawerPersonas] = useState<string[]>(currentParams.personas)
  const [drawerSchool, setDrawerSchool] = useState(currentParams.school)
  const [drawerField, setDrawerField] = useState(currentParams.field)
  const [drawerTags, setDrawerTags] = useState<string[]>(currentParams.tags)
  const [selectedMember, setSelectedMember] = useState<DirectoryMember | null>(null)
  const [connMap, setConnMap] = useState<Record<string, ConnectionEntry>>(initialConnectionMap)
  const closeModal = useCallback(() => setSelectedMember(null), [])

  useEffect(() => {
    setConnMap(initialConnectionMap)
  }, [initialConnectionMap])

  useEffect(() => {
    setView(directoryViewFromParam(searchParams.get("view")))
  }, [searchParams])

  useEffect(() => {
    if (!selectedMember) return

    const refreshed = members.find((member) => member.id === selectedMember.id)
    if (refreshed) setSelectedMember(refreshed)
  }, [members, selectedMember])

  function buildUrl(
    overrides: Partial<DirectoryParams>,
    viewOverride: DirectoryView = view,
  ) {
    const merged = { ...currentParams, searchInput, ...overrides }
    const p = new URLSearchParams()
    if (merged.q) p.set("q", merged.q)
    merged.personas.forEach((v) => p.append("persona", v))
    if (merged.school) p.set("school", merged.school)
    if (merged.field) p.set("field", merged.field)
    if (merged.tab && merged.tab !== "all") p.set("tab", merged.tab)
    merged.tags.forEach((v) => p.append("tag", v))
    if (viewOverride === "globe") p.set("view", "globe")
    const qs = p.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  // Debounce search input → URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const url = buildUrl({ q: searchInput })
      startTransition(() => router.replace(url))
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  function setTab(tab: string) {
    startTransition(() => router.replace(buildUrl({ tab })))
  }

  function setDirectoryView(nextView: DirectoryView) {
    setView(nextView)
    startTransition(() => router.replace(buildUrl({}, nextView), { scroll: false }))
  }

  function openDrawer() {
    setDrawerPersonas(currentParams.personas)
    setDrawerSchool(currentParams.school)
    setDrawerField(currentParams.field)
    setDrawerTags(currentParams.tags)
    setDrawerOpen(true)
  }

  function toggleDrawerPersona(p: string) {
    setDrawerPersonas((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    )
  }

  function applyFilters() {
    startTransition(() =>
      router.replace(
        buildUrl({ personas: drawerPersonas, school: drawerSchool, field: drawerField, tags: drawerTags }),
      ),
    )
    setDrawerOpen(false)
  }

  function clearFilters() {
    setDrawerPersonas([])
    setDrawerSchool("")
    setDrawerField("")
    setDrawerTags([])
    startTransition(() => router.replace(buildUrl({ personas: [], school: "", field: "", tags: [] })))
    setDrawerOpen(false)
  }

  function removePersonaChip(p: string) {
    const next = currentParams.personas.filter((x) => x !== p)
    startTransition(() => router.replace(buildUrl({ personas: next })))
  }

  function removeTagChip(t: string) {
    const next = currentParams.tags.filter((x) => x !== t)
    startTransition(() => router.replace(buildUrl({ tags: next })))
  }

  const hasActiveFilters =
    currentParams.personas.length > 0 || !!currentParams.school || !!currentParams.field || currentParams.tags.length > 0
  const activeFilterCount =
    currentParams.personas.length +
    (currentParams.school ? 1 : 0) +
    (currentParams.field ? 1 : 0) +
    currentParams.tags.length
  const drawerHasChanges =
    drawerPersonas.length > 0 || !!drawerSchool || !!drawerField || drawerTags.length > 0

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6">
        <p className="text-sm font-medium text-ipn">Directory</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-900">Member Directory</h1>
      </div>

      {/* Search + filter */}
      <div className="mb-4 flex gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by name, school, or field…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-9 text-sm shadow-sm placeholder:text-zinc-400 focus:border-ipn focus:outline-none focus:ring-1 focus:ring-ipn"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              aria-label="Clear search"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={openDrawer}
          className={`relative flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition ${
            hasActiveFilters
              ? "border-ipn bg-ipn-light text-ipn"
              : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
          }`}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"
            />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ipn text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-zinc-200">
        {(["all", ...(showSchoolTab ? ["school"] : [])] as string[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setTab(tab)}
            className={`cursor-pointer px-4 py-2.5 text-sm font-medium transition ${
              currentParams.tab === tab
                ? "-mb-px border-b-2 border-ipn text-ipn"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {tab === "all" ? "All Members" : "Your School"}
          </button>
        ))}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {currentParams.personas.map((p) => (
            <span
              key={p}
              className="flex items-center gap-1 rounded-full bg-ipn-light px-2.5 py-1 text-xs font-medium text-ipn"
            >
              {PERSONA_LABEL[p] ?? p}
              <button
                type="button"
                onClick={() => removePersonaChip(p)}
                className="ml-0.5 text-ipn/60 hover:text-ipn"
              >
                ×
              </button>
            </span>
          ))}
          {currentParams.school && (
            <span className="flex items-center gap-1 rounded-full bg-ipn-light px-2.5 py-1 text-xs font-medium text-ipn">
              {currentParams.school}
              <button
                type="button"
                onClick={() => startTransition(() => router.replace(buildUrl({ school: "" })))}
                className="ml-0.5 text-ipn/60 hover:text-ipn"
              >
                ×
              </button>
            </span>
          )}
          {currentParams.field && (
            <span className="flex items-center gap-1 rounded-full bg-ipn-light px-2.5 py-1 text-xs font-medium text-ipn">
              {currentParams.field}
              <button
                type="button"
                onClick={() => startTransition(() => router.replace(buildUrl({ field: "" })))}
                className="ml-0.5 text-ipn/60 hover:text-ipn"
              >
                ×
              </button>
            </span>
          )}
          {currentParams.tags.map((t) => (
            <span
              key={t}
              className="flex items-center gap-1 rounded-full bg-ipn-light px-2.5 py-1 text-xs font-medium text-ipn"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTagChip(t)}
                className="ml-0.5 text-ipn/60 hover:text-ipn"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-zinc-400 underline hover:text-zinc-600"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Count + view switch */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-sm text-zinc-500 transition-opacity ${isPending ? "opacity-50" : ""}`}>
          {members.length} member{members.length !== 1 ? "s" : ""} · {mapCities.length} cit{mapCities.length === 1 ? "y" : "ies"}
        </p>
        <div className="inline-flex self-start rounded-xl border border-zinc-200 bg-white p-1 shadow-sm sm:self-auto">
          {(["list", "globe"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDirectoryView(option)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                view === option
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {option === "list" ? "List" : "Globe"}
            </button>
          ))}
        </div>
      </div>

      {view === "globe" ? (
        <div className={`transition-opacity ${isPending ? "opacity-50" : ""}`}>
          <GlobeDirectoryView
            cities={mapCities}
            connectionMap={connMap}
            onOpenMember={setSelectedMember}
          />
        </div>
      ) : members.length > 0 ? (
        <div className={`grid grid-cols-2 gap-5 sm:grid-cols-3 xl:grid-cols-4 transition-opacity ${isPending ? "opacity-50" : ""}`}>
          {members.map((member) => (
            <MemberCard key={member.id} member={member} connectionEntry={connMap[member.id]} onOpen={setSelectedMember} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-zinc-900">
            {hasActiveFilters || currentParams.q ? "No members match these filters" : "No members yet"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {hasActiveFilters || currentParams.q
              ? "Try adjusting your search or filters."
              : "Members who set their profile to discoverable will appear here."}
          </p>
        </div>
      )}

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        personas={drawerPersonas}
        onTogglePersona={toggleDrawerPersona}
        school={drawerSchool}
        onSchool={setDrawerSchool}
        schools={schools}
        field={drawerField}
        onField={setDrawerField}
        tags={drawerTags}
        onToggleTag={(t) =>
          setDrawerTags((prev) =>
            prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
          )
        }
        availableTags={availableTags}
        onApply={applyFilters}
        onClear={clearFilters}
        hasActiveFilters={drawerHasChanges}
      />

      {selectedMember && (
        <MemberModal
          member={selectedMember}
          connectionEntry={connMap[selectedMember.id]}
          onConnectionChange={(entry) =>
            setConnMap((prev) => ({ ...prev, [selectedMember.id]: entry }))
          }
          onClose={closeModal}
        />
      )}
    </div>
  )
}
