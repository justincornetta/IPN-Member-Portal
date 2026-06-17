"use client"

import { useEffect, useMemo, useState } from "react"
import type {
  ConnectionEntry,
  DirectoryMapCity,
  DirectoryMember,
} from "@/lib/directory/types"

const DEG_TO_RAD = Math.PI / 180
const MIN_ZOOM = 0.85
const MAX_ZOOM = 1.8

function initials(member: DirectoryMember) {
  return `${member.first_name?.[0] ?? ""}${member.last_name?.[0] ?? ""}`.toUpperCase() || "?"
}

function cityLabel(city: DirectoryMapCity) {
  return [city.city, city.state || city.country].filter(Boolean).join(", ")
}

function getGlobeCenter(cities: DirectoryMapCity[]) {
  if (cities.length === 0) return { lat: 20, lng: 0 }

  let x = 0
  let y = 0
  let z = 0

  for (const city of cities) {
    const lat = city.lat * DEG_TO_RAD
    const lng = city.lng * DEG_TO_RAD
    x += Math.cos(lat) * Math.cos(lng)
    y += Math.cos(lat) * Math.sin(lng)
    z += Math.sin(lat)
  }

  const total = cities.length
  x /= total
  y /= total
  z /= total

  return {
    lat: Math.atan2(z, Math.sqrt(x * x + y * y)) / DEG_TO_RAD,
    lng: Math.atan2(y, x) / DEG_TO_RAD,
  }
}

function projectPoint(
  lat: number,
  lng: number,
  center: { lat: number; lng: number },
  radius: number,
) {
  const latRad = lat * DEG_TO_RAD
  const lngRad = lng * DEG_TO_RAD
  const centerLat = center.lat * DEG_TO_RAD
  const centerLng = center.lng * DEG_TO_RAD
  const deltaLng = lngRad - centerLng

  const x = radius * Math.cos(latRad) * Math.sin(deltaLng)
  const y = -radius * (
    Math.cos(centerLat) * Math.sin(latRad) -
    Math.sin(centerLat) * Math.cos(latRad) * Math.cos(deltaLng)
  )
  const z =
    Math.sin(centerLat) * Math.sin(latRad) +
    Math.cos(centerLat) * Math.cos(latRad) * Math.cos(deltaLng)

  return { x: 360 + x, y: 340 + y, visible: z > -0.05, depth: z }
}

function GlobeGrid({ radius }: { radius: number }) {
  const latitudes = [-60, -30, 0, 30, 60]
  const longitudes = [-60, -30, 0, 30, 60]

  return (
    <g opacity="0.34">
      {latitudes.map((lat) => {
        const ry = radius * Math.cos(lat * DEG_TO_RAD)
        const y = 340 - radius * Math.sin(lat * DEG_TO_RAD)
        return (
          <ellipse
            key={`lat-${lat}`}
            cx="360"
            cy={y}
            rx={ry}
            ry={Math.max(7, ry * 0.18)}
            fill="none"
            stroke="rgba(255,255,255,0.42)"
            strokeWidth="1"
          />
        )
      })}
      {longitudes.map((lng) => (
        <ellipse
          key={`lng-${lng}`}
          cx="360"
          cy="340"
          rx={radius * Math.abs(Math.cos(lng * DEG_TO_RAD))}
          ry={radius}
          fill="none"
          stroke="rgba(255,255,255,0.32)"
          strokeWidth="1"
          transform={`rotate(${lng / 6} 360 340)`}
        />
      ))}
    </g>
  )
}

function LandMasses({ radius }: { radius: number }) {
  const scale = radius / 250

  return (
    <g opacity="0.44" transform={`translate(360 340) scale(${scale}) translate(-360 -340)`}>
      <path
        d="M205 232c42-34 91-43 135-22 27 13 40 34 57 58 16 23 39 42 63 57 34 22 34 58 8 75-31 20-87-8-110-29-21-19-35-23-65-19-42 5-92-3-111-42-14-29-3-58 23-78Z"
        fill="rgba(255,255,255,0.24)"
      />
      <path
        d="M252 405c28-16 67 5 76 35 9 32-14 61-35 84-12 14-17 31-19 49-33-30-51-75-42-115 4-20 8-43 20-53Z"
        fill="rgba(255,255,255,0.18)"
      />
      <path
        d="M430 194c41-16 95-7 129 20 28 22 19 53-5 67-21 13-53 5-75 20-24 17-21 48-45 57-29 11-68-17-78-47-15-44 28-100 74-117Z"
        fill="rgba(255,255,255,0.22)"
      />
      <path
        d="M505 385c50-17 101 6 128 47 13 19 9 45-9 57-19 12-44 2-64 6-27 6-42 33-71 32-30-1-55-29-55-58 0-34 31-70 71-84Z"
        fill="rgba(255,255,255,0.17)"
      />
    </g>
  )
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export default function GlobeDirectoryView({
  cities,
  connectionMap,
  onOpenMember,
}: {
  cities: DirectoryMapCity[]
  connectionMap: Record<string, ConnectionEntry>
  onOpenMember: (member: DirectoryMember) => void
}) {
  const [selectedCityId, setSelectedCityId] = useState<string | null>(cities[0]?.id ?? null)
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState(() => getGlobeCenter(cities))

  const totalMembers = useMemo(
    () => cities.reduce((sum, city) => sum + city.memberCount, 0),
    [cities],
  )

  useEffect(() => {
    setSelectedCityId((current) => {
      if (current && cities.some((city) => city.id === current)) return current
      return cities[0]?.id ?? null
    })
    setCenter(getGlobeCenter(cities))
  }, [cities])

  const selectedCity = useMemo(
    () => cities.find((city) => city.id === selectedCityId) ?? null,
    [cities, selectedCityId],
  )

  const radius = 240 * zoom
  const projectedCities = useMemo(
    () => cities
      .map((city) => ({
        city,
        point: projectPoint(city.lat, city.lng, center, radius),
      }))
      .filter(({ point }) => point.visible)
      .sort((a, b) => a.point.depth - b.point.depth),
    [cities, center, radius],
  )

  function focusCity(city: DirectoryMapCity) {
    setSelectedCityId(city.id)
    setCenter({ lat: city.lat, lng: city.lng })
  }

  if (cities.length === 0) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-xl border border-zinc-200 bg-white text-center shadow-sm">
        <div>
          <p className="text-sm font-semibold text-zinc-900">No shared city locations</p>
          <p className="mt-1 text-sm text-zinc-500">Members who share a city will appear on the globe.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-[680px] overflow-hidden rounded-xl border border-zinc-200 bg-[radial-gradient(circle_at_28%_24%,#172033_0%,#07080d_52%,#020204_100%)] shadow-sm">
      <svg
        data-testid="directory-globe"
        className="absolute inset-y-0 left-0 h-full w-[calc(100%-360px)] min-w-[540px]"
        viewBox="0 0 720 680"
        role="img"
        aria-label="IPN membership globe"
      >
        <defs>
          <radialGradient id="ipn-globe-fill" cx="35%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#8fd3ff" stopOpacity="0.42" />
            <stop offset="38%" stopColor="#315a86" stopOpacity="0.34" />
            <stop offset="72%" stopColor="#121a2b" stopOpacity="0.96" />
            <stop offset="100%" stopColor="#05060a" stopOpacity="1" />
          </radialGradient>
          <filter id="ipn-globe-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="18" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          cx="360"
          cy="340"
          r={radius}
          fill="url(#ipn-globe-fill)"
          stroke="rgba(255,255,255,0.26)"
          strokeWidth="1.5"
          filter="url(#ipn-globe-glow)"
        />
        <circle
          cx="300"
          cy="250"
          r={radius * 0.36}
          fill="rgba(255,255,255,0.12)"
        />
        <GlobeGrid radius={radius} />
        <LandMasses radius={radius} />

        {projectedCities.map(({ city, point }) => {
          const selected = city.id === selectedCityId
          const pinRadius = Math.min(26, 10 + city.memberCount * 2.5)

          return (
            <g
              key={city.id}
              transform={`translate(${point.x} ${point.y})`}
              opacity={0.58 + Math.max(0, point.depth) * 0.42}
              role="button"
              tabIndex={0}
              aria-label={cityLabel(city)}
              data-testid="directory-globe-pin"
              onClick={() => focusCity(city)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  focusCity(city)
                }
              }}
              className="cursor-pointer outline-none"
            >
              <circle
                r={pinRadius + 8}
                fill={selected ? "rgba(22,163,74,0.24)" : "rgba(102,79,161,0.20)"}
              />
              <circle
                r={pinRadius}
                fill={selected ? "#16a34a" : "#664fa1"}
                stroke="white"
                strokeWidth="3"
                className="transition"
              />
              <text
                y="4"
                textAnchor="middle"
                className="pointer-events-none select-none fill-white text-[12px] font-bold"
              >
                {city.memberCount}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="absolute left-4 top-4 rounded-xl border border-white/15 bg-zinc-950/75 px-4 py-3 text-white shadow-lg backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-wide text-white/60">Live membership map</p>
        <p className="mt-1 text-sm font-semibold">{totalMembers} members · {cities.length} cities</p>
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl border border-white/15 bg-zinc-950/70 p-1.5 text-white shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => setZoom((value) => clampZoom(value - 0.18))}
          className="h-8 w-8 rounded-lg text-lg font-semibold transition hover:bg-white/10 disabled:opacity-40"
          disabled={zoom <= MIN_ZOOM}
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          type="button"
          onClick={() => setZoom((value) => clampZoom(value + 0.18))}
          className="h-8 w-8 rounded-lg text-lg font-semibold transition hover:bg-white/10 disabled:opacity-40"
          disabled={zoom >= MAX_ZOOM}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            setZoom(1)
            setCenter(getGlobeCenter(cities))
          }}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition hover:bg-white/10"
        >
          Reset
        </button>
      </div>

      <aside className="absolute bottom-4 right-4 top-4 flex w-[min(360px,calc(100%-2rem))] flex-col overflow-hidden rounded-xl border border-white/15 bg-white/95 shadow-2xl backdrop-blur">
        <div className="border-b border-zinc-100 px-4 py-3">
          <p className="text-sm font-semibold text-zinc-900">
            {selectedCity ? cityLabel(selectedCity) : "Select a city"}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {selectedCity ? `${selectedCity.memberCount} member${selectedCity.memberCount === 1 ? "" : "s"}` : "Choose a pin to view members."}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {(selectedCity?.members ?? []).map((member) => {
            const institution = member.school ?? member.affiliation
            const connected = connectionMap[member.id]?.status === "accepted"

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => onOpenMember(member)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-zinc-100"
              >
                <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full">
                  {member.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-ipn text-sm font-semibold text-white">
                      {initials(member)}
                    </div>
                  )}
                  {connected && (
                    <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 ring-2 ring-white">
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">
                    {member.first_name} {member.last_name}
                  </p>
                  {institution && (
                    <p className="truncate text-xs text-zinc-500">{institution}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
