"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type {
  ConnectionEntry,
  DirectoryMapCity,
  DirectoryMember,
} from "@/lib/directory/types"

type MapLibre = any

declare global {
  interface Window {
    maplibregl?: MapLibre
  }
}

const MAPLIBRE_VERSION = "5.24.0"
const MAPLIBRE_JS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`
const MAPLIBRE_CSS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`

let maplibrePromise: Promise<MapLibre> | null = null

function loadMapLibre() {
  if (typeof window === "undefined") return Promise.reject(new Error("Browser required"))
  if (window.maplibregl) return Promise.resolve(window.maplibregl)
  if (maplibrePromise) return maplibrePromise

  maplibrePromise = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${MAPLIBRE_CSS}"]`)) {
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = MAPLIBRE_CSS
      document.head.appendChild(link)
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${MAPLIBRE_JS}"]`)
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.maplibregl))
      existingScript.addEventListener("error", () => reject(new Error("Map failed to load")))
      return
    }

    const script = document.createElement("script")
    script.src = MAPLIBRE_JS
    script.async = true
    script.onload = () => resolve(window.maplibregl)
    script.onerror = () => reject(new Error("Map failed to load"))
    document.head.appendChild(script)
  })

  return maplibrePromise
}

function initials(member: DirectoryMember) {
  return `${member.first_name?.[0] ?? ""}${member.last_name?.[0] ?? ""}`.toUpperCase() || "?"
}

function cityLabel(city: DirectoryMapCity) {
  return [city.city, city.state || city.country].filter(Boolean).join(", ")
}

function buildFeatures(cities: DirectoryMapCity[]) {
  return {
    type: "FeatureCollection",
    features: cities.map((city) => ({
      type: "Feature",
      id: city.id,
      properties: {
        id: city.id,
        memberCount: city.memberCount,
        label: city.city,
      },
      geometry: {
        type: "Point",
        coordinates: [city.lng, city.lat],
      },
    })),
  }
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
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const cityByIdRef = useRef(new Map<string, DirectoryMapCity>())
  const [selectedCityId, setSelectedCityId] = useState<string | null>(cities[0]?.id ?? null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const totalMembers = useMemo(
    () => cities.reduce((sum, city) => sum + city.memberCount, 0),
    [cities],
  )

  useEffect(() => {
    cityByIdRef.current = new Map(cities.map((city) => [city.id, city]))
    setSelectedCityId((current) => {
      if (current && cityByIdRef.current.has(current)) return current
      return cities[0]?.id ?? null
    })
  }, [cities])

  useEffect(() => {
    let cancelled = false

    async function initMap() {
      if (!containerRef.current || mapRef.current) return

      try {
        const maplibregl = await loadMapLibre()
        if (cancelled || !containerRef.current) return

        const map = new maplibregl.Map({
          container: containerRef.current,
          center: [-20, 20],
          zoom: 1.15,
          minZoom: 1,
          maxZoom: 9,
          attributionControl: false,
          projection: { type: "globe" },
          style: {
            version: 8,
            glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
            sources: {
              satellite: {
                type: "raster",
                tiles: [
                  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/g/{z}/{y}/{x}.jpg",
                ],
                tileSize: 256,
                attribution: "EOX Sentinel-2 cloudless",
              },
            },
            layers: [
              { id: "satellite", type: "raster", source: "satellite" },
            ],
          },
        })

        map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left")
        mapRef.current = map

        map.on("load", () => {
          map.addSource("cities", {
            type: "geojson",
            data: buildFeatures(cities),
            cluster: true,
            clusterMaxZoom: 5,
            clusterRadius: 46,
            clusterProperties: {
              member_sum: ["+", ["get", "memberCount"]],
            },
          })

          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "cities",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#ffffff",
              "circle-opacity": 0.92,
              "circle-stroke-color": "#664fa1",
              "circle-stroke-width": 2,
              "circle-radius": [
                "step",
                ["get", "member_sum"],
                19,
                5,
                24,
                15,
                30,
              ],
            },
          })

          map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "cities",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["to-string", ["get", "member_sum"]],
              "text-font": ["Open Sans Bold"],
              "text-size": 12,
            },
            paint: {
              "text-color": "#18181b",
            },
          })

          map.addLayer({
            id: "city-pins",
            type: "circle",
            source: "cities",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": "#664fa1",
              "circle-opacity": 0.94,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["get", "memberCount"],
                1,
                10,
                10,
                20,
              ],
            },
          })

          map.addLayer({
            id: "city-count",
            type: "symbol",
            source: "cities",
            filter: ["!", ["has", "point_count"]],
            layout: {
              "text-field": ["to-string", ["get", "memberCount"]],
              "text-font": ["Open Sans Bold"],
              "text-size": 11,
            },
            paint: {
              "text-color": "#ffffff",
            },
          })
        })

        map.on("click", "clusters", async (event: MapLibre) => {
          const feature = map.queryRenderedFeatures(event.point, { layers: ["clusters"] })[0]
          const clusterId = feature.properties.cluster_id
          const source = map.getSource("cities")
          const zoom = await source.getClusterExpansionZoom(clusterId)
          map.easeTo({ center: feature.geometry.coordinates, zoom, duration: 450 })
        })

        map.on("click", "city-pins", (event: MapLibre) => {
          const feature = event.features?.[0]
          const cityId = feature?.properties?.id
          if (!cityId) return

          setSelectedCityId(cityId)
          map.easeTo({
            center: feature.geometry.coordinates,
            zoom: Math.max(map.getZoom(), 4),
            duration: 450,
          })
        })

        map.on("mouseenter", "clusters", () => { map.getCanvas().style.cursor = "pointer" })
        map.on("mouseleave", "clusters", () => { map.getCanvas().style.cursor = "" })
        map.on("mouseenter", "city-pins", () => { map.getCanvas().style.cursor = "pointer" })
        map.on("mouseleave", "city-pins", () => { map.getCanvas().style.cursor = "" })
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Map failed to load")
      }
    }

    void initMap()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
    // The map is created once; city updates are handled by the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const source = mapRef.current?.getSource("cities")
    if (source?.setData) source.setData(buildFeatures(cities))
  }, [cities])

  const selectedCity = selectedCityId ? cityByIdRef.current.get(selectedCityId) : null

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
    <div className="relative h-[680px] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 shadow-sm">
      <div ref={containerRef} className="absolute inset-0" />

      <div className="absolute left-4 top-4 rounded-xl border border-white/15 bg-zinc-950/75 px-4 py-3 text-white shadow-lg backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-wide text-white/60">Live membership map</p>
        <p className="mt-1 text-sm font-semibold">{totalMembers} members · {cities.length} cities</p>
      </div>

      {loadError && (
        <div className="absolute inset-x-4 top-24 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-700 shadow-lg">
          {loadError}
        </div>
      )}

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
