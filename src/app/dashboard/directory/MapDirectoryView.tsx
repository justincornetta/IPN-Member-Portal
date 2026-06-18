"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import mapboxgl, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type Map as MapboxMap,
  type MapLayerMouseEvent,
} from "mapbox-gl"
import type { FeatureCollection, Point } from "geojson"
import type {
  ConnectionEntry,
  DirectoryMapCity,
  DirectoryMember,
} from "@/lib/directory/types"

const MAPBOX_STYLE = "mapbox://styles/mapbox/light-v11"
const CITY_SOURCE_ID = "directory-cities"
const CLUSTER_LAYER_ID = "directory-city-clusters"
const CLUSTER_COUNT_LAYER_ID = "directory-city-cluster-count"
const CITY_PIN_LAYER_ID = "directory-city-pins"
const CITY_COUNT_LAYER_ID = "directory-city-count"

type CityFeatureProperties = {
  id: string
  label: string
  memberCount: number
}

function initials(member: DirectoryMember) {
  return `${member.first_name?.[0] ?? ""}${member.last_name?.[0] ?? ""}`.toUpperCase() || "?"
}

function cityLabel(city: DirectoryMapCity) {
  return [city.city, city.state || city.country].filter(Boolean).join(", ")
}

function buildCityGeoJson(cities: DirectoryMapCity[]): FeatureCollection<Point, CityFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: cities.map((city) => ({
      type: "Feature",
      id: city.id,
      properties: {
        id: city.id,
        label: cityLabel(city),
        memberCount: city.memberCount,
      },
      geometry: {
        type: "Point",
        coordinates: [city.lng, city.lat],
      },
    })),
  }
}

function getMapPadding(map: MapboxMap) {
  const canvas = map.getCanvas()
  const width = canvas.clientWidth || 1
  const height = canvas.clientHeight || 1
  const basePadding = width < 1024
    ? { top: 72, right: 24, bottom: 220, left: 24 }
    : { top: 72, right: 380, bottom: 72, left: 72 }
  const maxHorizontalPadding = Math.max(24, Math.floor((width - 120) / 2))
  const maxVerticalPadding = Math.max(24, Math.floor((height - 120) / 2))

  return {
    top: Math.min(basePadding.top, maxVerticalPadding),
    right: Math.min(basePadding.right, maxHorizontalPadding),
    bottom: Math.min(basePadding.bottom, maxVerticalPadding),
    left: Math.min(basePadding.left, maxHorizontalPadding),
  }
}

function fitToCities(map: MapboxMap, cities: DirectoryMapCity[], duration = 450) {
  if (cities.length === 0) return

  map.resize()

  if (cities.length === 1) {
    map.easeTo({
      center: [cities[0].lng, cities[0].lat],
      zoom: Math.max(map.getZoom(), 4.8),
      duration,
    })
    return
  }

  const bounds = new mapboxgl.LngLatBounds()
  for (const city of cities) {
    bounds.extend([city.lng, city.lat])
  }

  map.fitBounds(bounds as LngLatBoundsLike, {
    padding: getMapPadding(map),
    maxZoom: 5,
    duration,
  })
}

function ConnectionPill({ entry }: { entry?: ConnectionEntry }) {
  if (entry?.status === "accepted") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700">
        Connected
      </span>
    )
  }

  if (entry?.status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
        {entry.amRequester ? "Request sent" : "Respond"}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center rounded-full bg-ipn-light px-2 py-0.5 text-[11px] font-semibold text-ipn">
      Connect
    </span>
  )
}

function MemberPreviewRow({
  member,
  connectionEntry,
  onOpen,
}: {
  member: DirectoryMember
  connectionEntry?: ConnectionEntry
  onOpen: (member: DirectoryMember) => void
}) {
  const institution = member.school ?? member.affiliation
  const tags = member.interest_tags?.slice(0, 2) ?? []
  const field = member.field
  const bio = member.bio?.trim()

  return (
    <button
      type="button"
      onClick={() => onOpen(member)}
      className="group w-full rounded-lg px-2 py-2 text-left transition hover:bg-zinc-100"
    >
      <div className="flex items-start gap-3">
        <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full">
          {member.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-ipn text-sm font-semibold text-white">
              {initials(member)}
            </div>
          )}
          {connectionEntry?.status === "accepted" && (
            <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 ring-2 ring-white">
              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900 group-hover:text-ipn">
                {member.first_name} {member.last_name}
              </p>
              {institution && (
                <p className="truncate text-xs text-zinc-500">{institution}</p>
              )}
            </div>
            <ConnectionPill entry={connectionEntry} />
          </div>
          {(member.persona || field || tags.length > 0) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {member.persona && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                  {member.persona}
                </span>
              )}
              {field && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                  {field}
                </span>
              )}
              {tags.map((tag) => (
                <span key={tag} className="rounded-full bg-ipn-light px-2 py-0.5 text-[11px] font-medium text-ipn">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {bio && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-500">
              {bio}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}

function CityDrawer({
  cities,
  selectedCity,
  connectionMap,
  onSelectCity,
  onOpenMember,
}: {
  cities: DirectoryMapCity[]
  selectedCity: DirectoryMapCity | null
  connectionMap: Record<string, ConnectionEntry>
  onSelectCity: (city: DirectoryMapCity) => void
  onOpenMember: (member: DirectoryMember) => void
}) {
  return (
    <aside className="absolute inset-x-3 bottom-3 z-10 flex max-h-[48%] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white/95 shadow-2xl backdrop-blur lg:inset-x-auto lg:bottom-4 lg:right-4 lg:top-4 lg:max-h-none lg:w-[390px]">
      <div className="border-b border-zinc-100 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-900">
          {selectedCity ? cityLabel(selectedCity) : "Select a city"}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {selectedCity
            ? `${selectedCity.memberCount} member${selectedCity.memberCount === 1 ? "" : "s"}`
            : "Choose a pin or browse visible cities."}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {selectedCity ? (
          selectedCity.members.map((member) => (
            <MemberPreviewRow
              key={member.id}
              member={member}
              connectionEntry={connectionMap[member.id]}
              onOpen={onOpenMember}
            />
          ))
        ) : (
          <div className="flex flex-col gap-1">
            {cities.slice(0, 20).map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => onSelectCity(city)}
                className="flex items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-zinc-100"
              >
                <span className="min-w-0 truncate text-sm font-medium text-zinc-800">
                  {cityLabel(city)}
                </span>
                <span className="ml-3 rounded-full bg-ipn-light px-2 py-0.5 text-xs font-semibold text-ipn">
                  {city.memberCount}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function MapFallback({
  cities,
  reason,
  onSelectCity,
}: {
  cities: DirectoryMapCity[]
  reason: string
  onSelectCity: (city: DirectoryMapCity) => void
}) {
  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,#f3eeff_0%,#ffffff_42%,#f8fafc_100%)]">
      <div className="flex h-full items-center justify-center px-6 pb-56 pt-28 lg:pr-[430px]">
        <div className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white/90 p-6 text-center shadow-sm backdrop-blur">
          <p className="text-sm font-semibold text-zinc-900">Map unavailable</p>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{reason}</p>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cities.slice(0, 6).map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => onSelectCity(city)}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm transition hover:border-ipn hover:text-ipn"
              >
                <span className="truncate">{cityLabel(city)}</span>
                <span className="ml-2 font-semibold">{city.memberCount}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MapDirectoryView({
  cities,
  connectionMap,
  onOpenMember,
}: {
  cities: DirectoryMapCity[]
  connectionMap: Record<string, ConnectionEntry>
  onOpenMember: (member: DirectoryMember) => void
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const citiesRef = useRef(cities)
  const previousSelectedCityIdRef = useRef<string | null>(null)
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const totalMembers = useMemo(
    () => cities.reduce((sum, city) => sum + city.memberCount, 0),
    [cities],
  )
  const selectedCity = useMemo(
    () => cities.find((city) => city.id === selectedCityId) ?? null,
    [cities, selectedCityId],
  )

  function selectCity(city: DirectoryMapCity) {
    setSelectedCityId(city.id)
    mapRef.current?.flyTo({
      center: [city.lng, city.lat],
      zoom: Math.max(mapRef.current.getZoom(), 5),
      duration: 500,
    })
  }

  useEffect(() => {
    citiesRef.current = cities

    const source = mapRef.current?.getSource(CITY_SOURCE_ID) as GeoJSONSource | undefined
    source?.setData(buildCityGeoJson(cities))

    if (mapRef.current && cities.length > 0) {
      fitToCities(mapRef.current, cities)
    }
  }, [cities])

  useEffect(() => {
    const map = mapRef.current
    const previousSelectedCityId = previousSelectedCityIdRef.current

    if (!map?.getSource(CITY_SOURCE_ID)) {
      previousSelectedCityIdRef.current = selectedCityId
      return
    }

    if (previousSelectedCityId) {
      map.setFeatureState(
        { source: CITY_SOURCE_ID, id: previousSelectedCityId },
        { selected: false },
      )
    }

    if (selectedCityId) {
      map.setFeatureState(
        { source: CITY_SOURCE_ID, id: selectedCityId },
        { selected: true },
      )
    }

    previousSelectedCityIdRef.current = selectedCityId
  }, [selectedCityId])

  useEffect(() => {
    if (!mapboxToken || mapRef.current || !mapContainerRef.current) return

    let cancelled = false

    try {
      mapContainerRef.current.replaceChildren()

      const map = new mapboxgl.Map({
        accessToken: mapboxToken,
        container: mapContainerRef.current,
        style: MAPBOX_STYLE,
        center: [-20, 25],
        zoom: 1.15,
        minZoom: 1,
        maxZoom: 10,
        cooperativeGestures: true,
        attributionControl: true,
      })

      mapRef.current = map
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-left")

      map.on("error", (event) => {
        if (!cancelled) {
          setMapError(event.error?.message ?? "Mapbox could not load the map.")
        }
      })

      map.on("load", () => {
        if (cancelled) return
        setMapError(null)

        map.addSource(CITY_SOURCE_ID, {
          type: "geojson",
          data: buildCityGeoJson(citiesRef.current),
          cluster: true,
          clusterMaxZoom: 6,
          clusterRadius: 46,
          clusterProperties: {
            member_sum: ["+", ["get", "memberCount"]],
          },
        })

        map.addLayer({
          id: CLUSTER_LAYER_ID,
          type: "circle",
          source: CITY_SOURCE_ID,
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#664fa1",
            "circle-opacity": 0.9,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-radius": [
              "step",
              ["get", "member_sum"],
              18,
              5,
              24,
              15,
              32,
            ],
          },
        })

        map.addLayer({
          id: CLUSTER_COUNT_LAYER_ID,
          type: "symbol",
          source: CITY_SOURCE_ID,
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["to-string", ["get", "member_sum"]],
            "text-size": 12,
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          },
          paint: {
            "text-color": "#ffffff",
          },
        })

        map.addLayer({
          id: CITY_PIN_LAYER_ID,
          type: "circle",
          source: CITY_SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              "#16a34a",
              "#664fa1",
            ],
            "circle-opacity": 0.94,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "memberCount"],
              1,
              11,
              10,
              22,
            ],
          },
        })

        map.addLayer({
          id: CITY_COUNT_LAYER_ID,
          type: "symbol",
          source: CITY_SOURCE_ID,
          filter: ["!", ["has", "point_count"]],
          layout: {
            "text-field": ["to-string", ["get", "memberCount"]],
            "text-size": 11,
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          },
          paint: {
            "text-color": "#ffffff",
          },
        })

        fitToCities(map, citiesRef.current, 0)

        map.on("click", CLUSTER_LAYER_ID, (event: MapLayerMouseEvent) => {
          const feature = map.queryRenderedFeatures(event.point, { layers: [CLUSTER_LAYER_ID] })[0]
          const clusterId = feature?.properties?.cluster_id
          const coordinates = feature?.geometry.type === "Point" ? feature.geometry.coordinates : null
          const source = map.getSource(CITY_SOURCE_ID) as GeoJSONSource | undefined

          if (clusterId == null || !coordinates || !source) return

          source.getClusterExpansionZoom(Number(clusterId), (error, zoom) => {
            if (error || zoom == null) return
            map.easeTo({
              center: coordinates as [number, number],
              zoom,
              duration: 450,
            })
          })
        })

        map.on("click", CITY_PIN_LAYER_ID, (event: MapLayerMouseEvent) => {
          const feature = event.features?.[0]
          const id = feature?.properties?.id as string | undefined
          const city = id ? citiesRef.current.find((item) => item.id === id) : null
          if (city) selectCity(city)
        })

        map.on("mouseenter", CLUSTER_LAYER_ID, () => { map.getCanvas().style.cursor = "pointer" })
        map.on("mouseleave", CLUSTER_LAYER_ID, () => { map.getCanvas().style.cursor = "" })
        map.on("mouseenter", CITY_PIN_LAYER_ID, () => { map.getCanvas().style.cursor = "pointer" })
        map.on("mouseleave", CITY_PIN_LAYER_ID, () => { map.getCanvas().style.cursor = "" })
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mapbox could not initialize."
      queueMicrotask(() => setMapError(message))
    }

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [mapboxToken])

  if (cities.length === 0) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-xl border border-zinc-200 bg-white text-center shadow-sm">
        <div>
          <p className="text-sm font-semibold text-zinc-900">No shared city locations</p>
          <p className="mt-1 text-sm text-zinc-500">Members who share a city will appear on the map.</p>
        </div>
      </div>
    )
  }

  const fallbackReason = !mapboxToken
    ? "Mapbox is not configured for this environment. The city list is still available, and the map will load once NEXT_PUBLIC_MAPBOX_TOKEN is set."
    : (mapError ?? "")

  return (
    <div className="relative h-[680px] overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm" data-testid="directory-map-shell">
      <div className="absolute left-4 top-4 z-10 rounded-xl border border-zinc-200 bg-white/90 px-4 py-3 text-zinc-900 shadow-lg backdrop-blur">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Live membership map</p>
        <p className="mt-1 text-sm font-semibold">{totalMembers} members · {cities.length} cit{cities.length === 1 ? "y" : "ies"}</p>
      </div>

      {mapboxToken && !mapError ? (
        <div
          ref={mapContainerRef}
          className="absolute inset-0"
          data-testid="directory-map"
          style={{ position: "absolute", inset: 0 }}
        />
      ) : (
        <MapFallback cities={cities} reason={fallbackReason} onSelectCity={selectCity} />
      )}

      <CityDrawer
        cities={cities}
        selectedCity={selectedCity}
        connectionMap={connectionMap}
        onSelectCity={selectCity}
        onOpenMember={onOpenMember}
      />
    </div>
  )
}
