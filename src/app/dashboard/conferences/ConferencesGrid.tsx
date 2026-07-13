"use client"

import { useMemo, useState } from "react"
import ConferenceCard from "@/components/conferences/ConferenceCard"
import type { ConferenceCategory, ConferenceRecord } from "@/lib/conferences/types"

const ALL_CATEGORIES = "all"

function SearchIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  )
}

export default function ConferencesGrid({ conferences }: { conferences: ConferenceRecord[] }) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<ConferenceCategory | typeof ALL_CATEGORIES>(ALL_CATEGORIES)

  const categories = useMemo(
    () => Array.from(new Set(conferences.map((conference) => conference.category))),
    [conferences],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conferences
      .filter((conference) => category === ALL_CATEGORIES || conference.category === category)
      .filter((conference) =>
        q
          ? conference.name.toLowerCase().includes(q) ||
            (conference.city ?? "").toLowerCase().includes(q) ||
            (conference.organizer ?? "").toLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }, [conferences, query, category])

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <label className="relative block">
          <span className="sr-only">Search conferences by name, city, or organizer</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search conferences"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-base text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-ipn/40 focus:ring-2 focus:ring-ipn/10 sm:text-sm"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory(ALL_CATEGORIES)}
            className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition sm:min-h-0 ${
              category === ALL_CATEGORIES
                ? "border-ipn bg-ipn text-white"
                : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition sm:min-h-0 ${
                category === cat
                  ? "border-ipn bg-ipn text-white"
                  : "border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length ? (
        <div className="grid min-w-0 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((conference) => (
            <ConferenceCard key={conference.id} conference={conference} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white px-6 py-10 text-center shadow-sm">
          <h2 className="text-base font-semibold text-zinc-900">No conferences match these filters</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
            Try a different search term or category.
          </p>
        </div>
      )}
    </div>
  )
}
