"use client"

import { useEffect, useId, useRef, useState } from "react"
import type { LocationCandidate } from "@/lib/location/geocoding"

export type VerifiedLocation = {
  city: string
  state: string | null
  country: string
  lat: number
  lng: number
  label: string
}

export type LocationVerificationStatus = "unverified" | "verified" | "no_results"

type Props = {
  city: string
  state: string
  country: string
  onCityChange: (city: string) => void
  onVerifiedLocationChange: (location: VerifiedLocation | null) => void
  onStatusChange: (status: LocationVerificationStatus) => void
  error?: string
  required?: boolean
  inputClassName?: string
}

export default function CityVerificationField({
  city,
  state,
  country,
  onCityChange,
  onVerifiedLocationChange,
  onStatusChange,
  error,
  required,
  inputClassName,
}: Props) {
  const listboxId = useId()
  const [candidates, setCandidates] = useState<LocationCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const verifiedLocationRef = useRef(onVerifiedLocationChange)
  const statusRef = useRef(onStatusChange)
  // Track previous values so the reset effect only fires on genuine user changes,
  // not on initial mount (including React Strict Mode's double-invoke).
  const prevValuesRef = useRef({ city, country, state })
  const skipNextResetRef = useRef(false)
  // Pre-populate with the loaded city so the search effect skips on first render.
  const selectedLabelRef = useRef<string | null>(city || null)

  useEffect(() => {
    verifiedLocationRef.current = onVerifiedLocationChange
    statusRef.current = onStatusChange
  }, [onStatusChange, onVerifiedLocationChange])

  useEffect(() => {
    const prev = prevValuesRef.current
    prevValuesRef.current = { city, country, state }

    // Values haven't changed — this is either initial mount or Strict Mode's second invoke.
    if (prev.city === city && prev.country === country && prev.state === state) return

    if (skipNextResetRef.current) {
      skipNextResetRef.current = false
      return
    }

    selectedLabelRef.current = null
    setCandidates([])
    setOpen(false)
    setMessage(null)
    if (city.trim()) {
      verifiedLocationRef.current(null)
      statusRef.current("unverified")
    }
  }, [city, country, state])

  useEffect(() => {
    const trimmedCity = city.trim()
    // selectedLabelRef is pre-populated on mount, so this skips the initial search.
    if (!country || trimmedCity.length < 2 || selectedLabelRef.current) {
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setMessage(null)

      try {
        const response = await fetch("/api/locations/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city: trimmedCity, state, country }),
          signal: controller.signal,
        })
        const result = (await response.json()) as {
          candidates?: LocationCandidate[]
          error?: string
        }

        if (!response.ok) {
          setCandidates([])
          setOpen(false)
          setMessage(result.error ?? "Could not search for cities.")
          onStatusChange("unverified")
          return
        }

        const nextCandidates = result.candidates ?? []
        setCandidates(nextCandidates)
        setHighlightedIndex(0)
        setOpen(nextCandidates.length > 0)
        if (nextCandidates.length === 0) {
          setMessage("No matching city found. You can continue without map coordinates.")
          onVerifiedLocationChange(null)
          onStatusChange("no_results")
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        setCandidates([])
        setOpen(false)
        setMessage("City search is unavailable right now. You can continue without map coordinates.")
        onStatusChange("unverified")
      } finally {
        setLoading(false)
      }
    }, 220)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [city, country, onStatusChange, onVerifiedLocationChange, state])

  function selectCandidate(candidate: LocationCandidate) {
    selectedLabelRef.current = candidate.label
    skipNextResetRef.current = true
    onCityChange(candidate.city)
    onVerifiedLocationChange({
      city: candidate.city,
      state: candidate.state,
      country: candidate.country,
      lat: candidate.lat,
      lng: candidate.lng,
      label: candidate.label,
    })
    onStatusChange("verified")
    setCandidates([])
    setOpen(false)
    setMessage(`Selected: ${candidate.label}`)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || candidates.length === 0) return

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlightedIndex((index) => (index + 1) % candidates.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlightedIndex((index) => (index - 1 + candidates.length) % candidates.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      selectCandidate(candidates[highlightedIndex])
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <input
          id="city"
          name="city"
          type="text"
          value={city}
          required={required}
          autoComplete="address-level2"
          placeholder="Your current city or town"
          onChange={(event) => onCityChange(event.target.value)}
          onFocus={() => {
            if (candidates.length > 0) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && candidates[highlightedIndex]
              ? `${listboxId}-${candidates[highlightedIndex].id}`
              : undefined
          }
          className={
            inputClassName ??
            "rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
          }
        />

        {open && candidates.length > 0 && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg"
          >
            {candidates.map((candidate, index) => (
              <button
                id={`${listboxId}-${candidate.id}`}
                key={candidate.id}
                type="button"
                role="option"
                aria-selected={index === highlightedIndex}
                onMouseDown={(event) => {
                  event.preventDefault()
                  selectCandidate(candidate)
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={`block w-full px-3 py-2.5 text-left text-sm transition ${
                  index === highlightedIndex
                    ? "bg-ipn/5 text-zinc-900"
                    : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <span className="block font-medium">{candidate.city}</span>
                <span className="mt-0.5 block text-xs text-zinc-400">
                  {[candidate.state, candidate.country].filter(Boolean).join(", ")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {message && (
        <p className={`text-xs ${message.startsWith("Selected") ? "text-green-700" : "text-zinc-500"}`}>
          {message}
        </p>
      )}
      {!message && !loading && city.trim().length > 0 && country && (
        <p className="text-xs text-zinc-400">
          Select a city from the list to appear on the member map.
        </p>
      )}
      {loading && <p className="text-xs text-zinc-400">Searching cities...</p>}
      {!country && (
        <p className="text-xs text-zinc-400">Choose a country before searching cities.</p>
      )}
    </div>
  )
}
