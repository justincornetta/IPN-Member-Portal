"use client"

import { useEffect, useRef, useState } from "react"
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
  const [candidates, setCandidates] = useState<LocationCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const verifiedLocationRef = useRef(onVerifiedLocationChange)
  const statusRef = useRef(onStatusChange)
  const mountedRef = useRef(false)
  const skipNextResetRef = useRef(false)

  useEffect(() => {
    verifiedLocationRef.current = onVerifiedLocationChange
    statusRef.current = onStatusChange
  }, [onStatusChange, onVerifiedLocationChange])

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false
      return
    }

    setCandidates([])
    setMessage(null)
    if (city.trim()) {
      verifiedLocationRef.current(null)
      statusRef.current("unverified")
    }
  }, [city, country, state])

  async function verifyCity() {
    const trimmedCity = city.trim()
    if (!trimmedCity || !country) return

    setLoading(true)
    setMessage(null)
    setCandidates([])

    try {
      const response = await fetch("/api/locations/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: trimmedCity, state, country }),
      })
      const result = (await response.json()) as {
        candidates?: LocationCandidate[]
        error?: string
      }

      if (!response.ok) {
        setMessage(result.error ?? "Could not verify this city.")
        onStatusChange("unverified")
        return
      }

      const nextCandidates = result.candidates ?? []
      setCandidates(nextCandidates)
      if (nextCandidates.length === 0) {
        setMessage("No matching city was found. You can save it without map coordinates.")
        onVerifiedLocationChange(null)
        onStatusChange("no_results")
      }
    } catch {
      setMessage("Could not verify this city right now.")
      onStatusChange("unverified")
    } finally {
      setLoading(false)
    }
  }

  function selectCandidate(candidate: LocationCandidate) {
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
    setMessage(`Verified: ${candidate.label}`)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="city"
          name="city"
          type="text"
          value={city}
          required={required}
          autoComplete="address-level2"
          placeholder="Your current city or town"
          onChange={(event) => onCityChange(event.target.value)}
          className={
            inputClassName ??
            "rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
          }
        />
        <button
          type="button"
          onClick={verifyCity}
          disabled={!city.trim() || !country || loading}
          className="min-h-10 shrink-0 rounded-lg border border-ipn/30 px-3 py-2 text-sm font-medium text-ipn transition hover:bg-ipn/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Checking..." : "Verify city"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {message && (
        <p className={`text-xs ${message.startsWith("Verified") ? "text-green-700" : "text-zinc-500"}`}>
          {message}
        </p>
      )}

      {candidates.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-2 shadow-sm">
          <p className="px-2 pb-1 text-xs font-medium text-zinc-500">Select the matching city</p>
          <div className="flex flex-col gap-1">
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => selectCandidate(candidate)}
                className="rounded-md px-2 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                {candidate.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
