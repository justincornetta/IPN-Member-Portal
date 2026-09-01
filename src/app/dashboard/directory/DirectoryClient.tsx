"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useTransition, useCallback, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { PERSONA_OPTIONS } from "@/lib/constants/registration"
import type {
  ConnectionEntry,
  DirectoryMapCity,
  DirectoryMember,
  DirectoryParams,
} from "@/lib/directory/types"
import { memberMatchesDirectorySearch } from "@/lib/directory/search"
import { loadMoreDirectoryMembers } from "@/lib/directory/actions"
import MemberProfileModal, { getInitials, AvatarCircle, PersonaBadge } from "@/components/directory/MemberProfileModal"
import RequestsPanel, { type ConnectionRow } from "./RequestsPanel"

const MapDirectoryView = dynamic(() => import("./MapDirectoryView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[680px] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm font-medium text-zinc-500">
      Loading map...
    </div>
  ),
})

const PERSONAS = PERSONA_OPTIONS.map((o) => o.value)
type DirectoryView = "list" | "map"

// DB values are the display labels — this is an identity map kept for future flexibility
const PERSONA_LABEL: Record<string, string> = Object.fromEntries(
  PERSONA_OPTIONS.map((o) => [o.value, o.value]),
)

function directoryViewFromParam(value: string | null): DirectoryView {
  return value === "map" || value === "globe" ? "map" : "list"
}

function sharedLocationKey(member: DirectoryMember) {
  if (
    !member.share_location
    || !member.city?.trim()
    || member.city_lat == null
    || member.city_lng == null
  ) {
    return null
  }

  const lat = Number(member.city_lat)
  const lng = Number(member.city_lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return [
    member.city.trim().toLocaleLowerCase(),
    member.country?.trim().toLocaleLowerCase() ?? "",
    lat.toFixed(2),
    lng.toFixed(2),
  ].join("|")
}

function MemberCard({
  member,
  connectionEntry,
  isSelf,
  onOpen,
}: {
  member: DirectoryMember
  connectionEntry?: ConnectionEntry
  isSelf: boolean
  onOpen: (m: DirectoryMember) => void
}) {
  const initials = getInitials(member.first_name, member.last_name)
  const institution = member.education?.[0]?.institution ?? member.school ?? member.affiliation
  const tags = member.interest_tags ?? []
  const isConnected = connectionEntry?.status === "accepted"
  const visibleTags = tags.slice(0, 3)

  return (
    <button
      type="button"
      onClick={() => onOpen(member)}
      data-analytics-event="curated_click"
      data-analytics-id={`directory-profile-card-${member.id}`}
      data-analytics-label="Directory profile card"
      className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm transition duration-150 ease-out hover:border-ipn hover:shadow-lg sm:flex-col sm:items-center sm:gap-4 sm:rounded-xl sm:px-4 sm:pb-5 sm:pt-6 sm:hover:[transform:translateY(-6px)]"
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
      <span className="min-w-0 flex-1 sm:w-full">
        <span className="flex min-w-0 items-center gap-2 sm:block">
          <span className="truncate text-base font-semibold leading-tight text-zinc-900 group-hover:text-ipn sm:block sm:text-center sm:text-sm">
            {member.first_name} {member.last_name}
          </span>
          {member.persona && (
            <span className="flex-shrink-0 rounded-full bg-ipn-light px-2 py-0.5 text-[10px] font-semibold text-ipn sm:hidden">
              {member.persona}
            </span>
          )}
        </span>
        <span className="mt-1 hidden flex-wrap gap-1.5 sm:flex sm:justify-center">
          {isSelf && (
            <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500">
              You
            </span>
          )}
          <PersonaBadge persona={member.persona} />
        </span>
        {institution && (
          <span className="mt-0.5 block truncate text-sm text-zinc-500 sm:mt-1.5 sm:text-center sm:text-xs sm:font-medium sm:text-zinc-600">
            {institution}
          </span>
        )}
        <span className="mt-2 flex flex-wrap gap-1.5 sm:mt-2 sm:justify-center">
          {visibleTags.length > 0 ? visibleTags.map((tag) => (
            <span
              key={tag}
              className="max-w-full rounded-full border border-ipn/15 bg-ipn/5 px-2 py-0.5 text-[11px] font-medium leading-tight text-ipn sm:text-xs"
            >
              {tag}
            </span>
          )) : (
            <span className="text-xs text-zinc-400">No interests yet</span>
          )}
        </span>
      </span>
      <svg className="h-5 w-5 flex-shrink-0 text-zinc-400 sm:hidden" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
      </svg>
    </button>
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
      <div className="relative z-50 flex h-full w-[min(22rem,100vw)] flex-col overflow-y-auto bg-white shadow-xl">
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

        <div className="border-t border-zinc-100 px-5 py-4" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}>
          <div className="flex gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onClear}
                className="min-h-11 flex-1 cursor-pointer rounded-lg border border-zinc-200 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onApply}
              className="min-h-11 flex-1 cursor-pointer rounded-lg bg-ipn py-2 text-sm font-medium text-white transition hover:bg-ipn-dark"
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
  hasMore: boolean
  mapCities: DirectoryMapCity[]
  totalMemberCount: number
  showSchoolTab: boolean
  currentParams: DirectoryParams
  schools: string[]
  availableTags: string[]
  connectionMap: Record<string, ConnectionEntry>
  currentUserId: string
  pendingRequestCount: number
  connections?: {
    accepted: ConnectionRow[]
    incoming: ConnectionRow[]
    outgoing: ConnectionRow[]
  }
}

export default function DirectoryClient({
  members,
  hasMore: initialHasMore,
  mapCities,
  totalMemberCount,
  showSchoolTab,
  currentParams,
  schools,
  availableTags,
  connectionMap: initialConnectionMap,
  currentUserId,
  pendingRequestCount,
  connections,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const view = directoryViewFromParam(searchParams.get("view"))
  const [searchInput, setSearchInput] = useState(currentParams.q)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerPersonas, setDrawerPersonas] = useState<string[]>(currentParams.personas)
  const [drawerSchool, setDrawerSchool] = useState(currentParams.school)
  const [drawerField, setDrawerField] = useState(currentParams.field)
  const [drawerTags, setDrawerTags] = useState<string[]>(currentParams.tags)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [loadedMembers, setLoadedMembers] = useState(members)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingMore, setLoadingMore] = useState(false)
  const [prevMembers, setPrevMembers] = useState(members)
  const [connectionState, setConnectionState] = useState(() => ({
    source: initialConnectionMap,
    value: initialConnectionMap,
  }))

  // The server sends a fresh (capped) page whenever filters/search/tab/view
  // change via navigation — reset local "load more" state to match. (Adjusting
  // state during render, not in an effect, per React's guidance for resetting
  // state when a prop changes.)
  if (members !== prevMembers) {
    setPrevMembers(members)
    setLoadedMembers(members)
    setHasMore(initialHasMore)
  }

  const filteredMembers = useMemo(
    () => loadedMembers.filter((member) => memberMatchesDirectorySearch(member, searchInput)),
    [loadedMembers, searchInput],
  )

  async function loadMore() {
    setLoadingMore(true)
    const result = await loadMoreDirectoryMembers(loadedMembers.length, {
      tab: currentParams.tab,
      personas: currentParams.personas,
      school: currentParams.school,
      field: currentParams.field,
      tags: currentParams.tags,
    })
    setLoadedMembers((prev) => [...prev, ...result.members])
    setHasMore(result.hasMore)
    setLoadingMore(false)
  }
  const filteredMapCities = useMemo(() => {
    if (!searchInput.trim()) return mapCities

    return mapCities
      .map((city) => {
        const cityMembers = city.members.filter((member) =>
          memberMatchesDirectorySearch(member, searchInput),
        )

        return {
          ...city,
          members: cityMembers,
          memberCount: cityMembers.length,
        }
      })
      .filter((city) => city.memberCount > 0)
  }, [mapCities, searchInput])
  const filteredMapMembers = useMemo(
    () => filteredMapCities.flatMap((city) => city.members),
    [filteredMapCities],
  )
  const selectedMember = useMemo(
    () =>
      (view === "map" ? filteredMapMembers : filteredMembers)
        .find((member) => member.id === selectedMemberId) ?? null,
    [filteredMapMembers, filteredMembers, selectedMemberId, view],
  )
  const listLocationCounts = useMemo(() => {
    const cities = new Set<string>()
    const countries = new Set<string>()

    for (const member of filteredMembers) {
      const locationKey = sharedLocationKey(member)
      if (!locationKey) continue

      cities.add(locationKey)
      const country = member.country?.trim().toLocaleLowerCase()
      if (country) countries.add(country)
    }

    return { cities: cities.size, countries: countries.size }
  }, [filteredMembers])
  const mapMemberCount = useMemo(
    () => filteredMapCities.reduce((total, city) => total + city.memberCount, 0),
    [filteredMapCities],
  )
  const mapCountryCount = useMemo(
    () =>
      new Set(
        filteredMapCities
          .map((city) => city.country?.trim().toLocaleLowerCase())
          .filter((country): country is string => Boolean(country)),
      ).size,
    [filteredMapCities],
  )
  const mapRenderKey = useMemo(
    () =>
      filteredMapCities
        .map((city) => `${city.id}:${city.memberCount}`)
        .join("|") || "empty",
    [filteredMapCities],
  )
  const connMap = connectionState.source === initialConnectionMap
    ? connectionState.value
    : initialConnectionMap
  const closeModal = useCallback(() => setSelectedMemberId(null), [])
  const openMember = useCallback((member: DirectoryMember) => {
    setSelectedMemberId(member.id)
  }, [])
  const updateConnectionMap = useCallback((memberId: string, entry: ConnectionEntry) => {
    setConnectionState((current) => {
      const base = current.source === initialConnectionMap
        ? current.value
        : initialConnectionMap

      return {
        source: initialConnectionMap,
        value: { ...base, [memberId]: entry },
      }
    })
  }, [initialConnectionMap])

  const buildUrl = useCallback((
    overrides: Partial<DirectoryParams>,
    viewOverride: DirectoryView = view,
  ) => {
    const merged = { ...currentParams, q: searchInput, ...overrides }
    const p = new URLSearchParams()
    if (merged.q) p.set("q", merged.q)
    merged.personas.forEach((v) => p.append("persona", v))
    if (merged.school) p.set("school", merged.school)
    if (merged.field) p.set("field", merged.field)
    if (merged.tab && merged.tab !== "all") p.set("tab", merged.tab)
    merged.tags.forEach((v) => p.append("tag", v))
    if (viewOverride === "map") p.set("view", "map")
    const qs = p.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }, [currentParams, pathname, searchInput, view])

  const clearSearch = useCallback(() => {
    setSearchInput("")
    startTransition(() => router.replace(buildUrl({ q: "" })))
  }, [buildUrl, router])

  // Filtering the already-loaded page is instant, but the loaded page is
  // capped — once the debounced query settles, also re-fetch from the server
  // (uncapped) so search actually reaches the whole directory, not just
  // whatever happened to be loaded already.
  useEffect(() => {
    const trimmed = searchInput.trim()
    if (trimmed === currentParams.q) return

    const timer = setTimeout(() => {
      startTransition(() => router.replace(buildUrl({ q: trimmed })))
    }, 300)
    return () => clearTimeout(timer)
  }, [buildUrl, currentParams.q, searchInput, router])

  function setTab(tab: string) {
    startTransition(() => router.replace(buildUrl({ tab })))
  }

  function setDirectoryView(nextView: DirectoryView) {
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
  const isMapView = view === "map"
  const hasSettledSearch = searchInput.trim() === currentParams.q
  const displayedMemberCount = hasSettledSearch
    ? totalMemberCount
    : (isMapView ? mapMemberCount : filteredMembers.length)
  const displayedCityCount = isMapView ? filteredMapCities.length : listLocationCounts.cities
  const displayedCountryCount = isMapView ? mapCountryCount : listLocationCounts.countries

  return (
    <div>
      <div className={isMapView ? "mb-3 sm:mb-6" : "mb-4 sm:mb-6"}>
        <p className="hidden text-sm font-medium text-ipn sm:block">Community</p>
        <h1 className={`font-semibold text-zinc-900 ${isMapView ? "text-xl sm:mt-1 sm:text-2xl" : "text-2xl sm:mt-1"}`}>Member Directory</h1>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-zinc-500 sm:hidden">
          Search by interests, school, field, or area and connect with members to chat.
        </p>
      </div>

      {/* Search + filter */}
      {currentParams.tab !== "connections" && (
      <div className={isMapView ? "mb-3 flex gap-2 sm:flex-row sm:gap-3" : "mb-4 flex flex-col gap-3 sm:flex-row"}>
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
            placeholder="Search members by name, school, or keywords"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-9 text-base shadow-sm placeholder:text-zinc-400 focus:border-ipn focus:outline-none focus:ring-1 focus:ring-ipn sm:text-sm"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
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
          className={`relative hidden min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm transition sm:flex sm:justify-start ${
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
      )}

      {/* Tabs */}
      <div className={`flex border-b border-zinc-200 ${isMapView ? "mb-3" : "mb-6"}`}>
        {(["all", ...(showSchoolTab ? ["school"] : []), "connections"] as string[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setTab(tab)}
            className={`relative flex min-h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-sm font-medium transition ${
              currentParams.tab === tab
                ? "-mb-px border-b-2 border-ipn text-ipn"
                : "text-zinc-500 hover:text-zinc-800"
            }`}
          >
            {tab === "all" ? "All Members" : tab === "school" ? "Your Schools" : "Connections"}
            {tab === "connections" && pendingRequestCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-semibold text-white">
                {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {currentParams.tab === "connections" ? (
        <RequestsPanel
          userId={currentUserId}
          accepted={connections?.accepted ?? []}
          incoming={connections?.incoming ?? []}
          outgoing={connections?.outgoing ?? []}
        />
      ) : (
      <>
      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className={`flex flex-wrap items-center gap-2 ${isMapView ? "mb-3" : "mb-4"}`}>
          {currentParams.personas.map((p) => (
            <span
              key={p}
              className="flex items-center gap-1 rounded-full bg-ipn-light px-2.5 py-1 text-xs font-medium text-ipn"
            >
              {PERSONA_LABEL[p] ?? p}
              <button
                type="button"
                onClick={() => removePersonaChip(p)}
                className="ml-0.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full text-ipn/60 hover:text-ipn"
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
                className="ml-0.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full text-ipn/60 hover:text-ipn"
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
                className="ml-0.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full text-ipn/60 hover:text-ipn"
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
                className="ml-0.5 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full text-ipn/60 hover:text-ipn"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex min-h-11 items-center text-xs text-zinc-400 underline hover:text-zinc-600 sm:min-h-0"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Count + view switch */}
      <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${isMapView ? "mb-3" : "mb-4 sm:gap-3"}`}>
        <div className="flex items-center justify-between gap-3 sm:block">
          <button
            type="button"
            onClick={openDrawer}
            className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold sm:hidden ${
              hasActiveFilters ? "text-ipn" : "text-zinc-600"
            }`}
          >
            <svg className="h-4 w-4 text-ipn" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
            </svg>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
          {isMapView ? (
            <div className={`rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-zinc-900 shadow-sm transition-opacity ${isPending ? "opacity-50" : ""}`}>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Live membership map</p>
              <p className="mt-1 text-sm font-semibold">
                {displayedMemberCount} member{displayedMemberCount !== 1 ? "s" : ""} · {displayedCityCount} cit{displayedCityCount === 1 ? "y" : "ies"} · {displayedCountryCount} countr{displayedCountryCount === 1 ? "y" : "ies"}
              </p>
            </div>
          ) : (
            <p className={`text-right text-sm text-zinc-500 transition-opacity sm:text-left ${isPending ? "opacity-50" : ""}`}>
              {displayedMemberCount} member{displayedMemberCount !== 1 ? "s" : ""} · {displayedCityCount} cit{displayedCityCount === 1 ? "y" : "ies"} · {displayedCountryCount} countr{displayedCountryCount === 1 ? "y" : "ies"}
            </p>
          )}
        </div>
        <div className="grid w-full grid-cols-2 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm sm:inline-flex sm:w-auto sm:self-auto">
          {(["list", "map"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDirectoryView(option)}
              className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition ${
                view === option
                  ? "bg-ipn text-white"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              {option === "list" ? "List" : "Map"}
            </button>
          ))}
        </div>
      </div>

      {view === "map" ? (
        <div className={`transition-opacity ${isPending ? "opacity-50" : ""}`}>
          <MapDirectoryView
            key={mapRenderKey}
            cities={filteredMapCities}
            connectionMap={connMap}
            currentUserId={currentUserId}
            onOpenMember={openMember}
          />
        </div>
      ) : filteredMembers.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4 transition-opacity ${isPending ? "opacity-50" : ""}`}>
            {filteredMembers.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                connectionEntry={connMap[member.id]}
                isSelf={member.id === currentUserId}
                onOpen={openMember}
              />
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="min-h-11 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-ipn/30 hover:text-ipn disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingMore ? "Loading…" : "Load more members"}
            </button>
          )}
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
      </>
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
        <MemberProfileModal
          member={selectedMember}
          connectionEntry={connMap[selectedMember.id]}
          isSelf={selectedMember.id === currentUserId}
          onConnectionChange={(entry) =>
            updateConnectionMap(selectedMember.id, entry)
          }
          onClose={closeModal}
        />
      )}
    </div>
  )
}
