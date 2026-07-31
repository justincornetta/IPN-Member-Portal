import type {
  MemberDirectoryData,
  MemberDirectoryRow,
} from "./member-directory-types"

export const UNKNOWN_CITY_LABEL = "Unknown city"

type Geography = MemberDirectoryData["geography"]
type GeographyLocation = Geography[number]

function rawGeographyKey(city: string, state: string, country: string) {
  return [city, state, country].map((part) => part.trim().toLowerCase()).join("|")
}

function normalizeGroupingPart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function normalizeCityForGrouping(value: string) {
  return normalizeGroupingPart(value)
    .replace(/^city and county of /, "")
    .replace(/^city of /, "")
    .replace(/\bst\b/g, "saint")
}

function isPlaceholderCity(value: string) {
  const normalized = normalizeGroupingPart(value)
  return value.trim().startsWith("*") || ["city", "unknown", "none", "na", "n a"].includes(normalized)
}

function cityCountryKey(city: string, country: string) {
  return `${normalizeCityForGrouping(city)}|${normalizeGroupingPart(country)}`
}

export function membershipGeographyKey(city: string, state: string, country: string) {
  return [normalizeCityForGrouping(city), normalizeGroupingPart(state), normalizeGroupingPart(country)].join("|")
}

function preferredCoordinates(
  current: Pick<GeographyLocation, "lat" | "lng" | "coordinatePrecision">,
  candidate: Pick<GeographyLocation, "lat" | "lng" | "coordinatePrecision"> | undefined,
) {
  if (!candidate || candidate.lat == null || candidate.lng == null) return current
  if (current.lat == null || current.lng == null || (candidate.coordinatePrecision === "city" && current.coordinatePrecision !== "city")) {
    return candidate
  }
  return current
}

export function buildFilteredMemberGeography(
  rows: MemberDirectoryRow[],
  directory: MemberDirectoryData,
): Geography {
  const baseById = new Map(directory.geography.map((location) => [location.id, location]))
  const statesByCityCountry = new Map<string, Set<string>>()

  for (const row of rows) {
    if (!row.city || isPlaceholderCity(row.city) || !row.country || !row.state) continue
    const key = cityCountryKey(row.city, row.country)
    const states = statesByCityCountry.get(key) ?? new Set<string>()
    states.add(row.state)
    statesByCityCountry.set(key, states)
  }

  const groups = new Map<string, GeographyLocation>()
  for (const row of rows) {
    if (!row.country) continue
    const hasUsableCity = Boolean(row.city) && !isPlaceholderCity(row.city)
    const city = hasUsableCity ? row.city : UNKNOWN_CITY_LABEL
    const knownStates = hasUsableCity ? statesByCityCountry.get(cityCountryKey(row.city, row.country)) : undefined
    const inferredState = !row.state && knownStates?.size === 1 ? Array.from(knownStates)[0] : ""
    const state = row.state || inferredState
    const id = membershipGeographyKey(city, state, row.country)
    const base = baseById.get(rawGeographyKey(row.city || UNKNOWN_CITY_LABEL, row.state, row.country))
    const current = groups.get(id) ?? {
      id,
      city,
      state,
      country: row.country,
      lat: base?.lat ?? null,
      lng: base?.lng ?? null,
      countryLat: base?.countryLat ?? null,
      countryLng: base?.countryLng ?? null,
      coordinatePrecision: base?.coordinatePrecision ?? null,
      memberCount: 0,
      identifiableCount: 0,
      sourceCounts: directory.sourceTotals.map((source) => ({ id: source.id, label: source.label, value: 0 })),
      members: [],
    }
    const coordinates = preferredCoordinates(current, base)
    current.lat = coordinates.lat
    current.lng = coordinates.lng
    current.coordinatePrecision = coordinates.coordinatePrecision
    if (current.countryLat == null && current.countryLng == null && base?.countryLat != null && base.countryLng != null) {
      current.countryLat = base.countryLat
      current.countryLng = base.countryLng
    }
    current.memberCount += 1
    current.identifiableCount += 1
    current.members.push({ id: row.id, name: row.name, email: row.email, sources: row.sources })
    for (const source of current.sourceCounts) {
      if (row.sources[source.id]) source.value += 1
    }
    groups.set(id, current)
  }

  return Array.from(groups.values()).sort((a, b) => b.memberCount - a.memberCount || a.city.localeCompare(b.city))
}

export function cityMemberGeography(locations: Geography) {
  return locations.filter((location) => location.city !== UNKNOWN_CITY_LABEL)
}

export function buildCountryMemberGeography(locations: Geography): Geography {
  const countries = new Map<string, GeographyLocation & {
    weightedLat: number
    weightedLng: number
    weightedCount: number
    countryLat: number | null
    countryLng: number | null
  }>()

  for (const location of locations) {
    if (!location.country) continue
    const id = `country:${normalizeGroupingPart(location.country)}`
    const current = countries.get(id) ?? {
      id,
      city: "",
      state: "",
      country: location.country,
      lat: null,
      lng: null,
      countryLat: null,
      countryLng: null,
      coordinatePrecision: null,
      memberCount: 0,
      identifiableCount: 0,
      sourceCounts: location.sourceCounts.map((source) => ({ id: source.id, label: source.label, value: 0 })),
      members: [],
      weightedLat: 0,
      weightedLng: 0,
      weightedCount: 0,
    }
    current.memberCount += location.memberCount
    current.identifiableCount += location.identifiableCount
    current.members.push(...location.members)
    if (location.countryLat != null && location.countryLng != null) {
      current.countryLat = location.countryLat
      current.countryLng = location.countryLng
    }
    if (location.lat != null && location.lng != null) {
      if (location.coordinatePrecision === "country") {
        current.countryLat = location.lat
        current.countryLng = location.lng
      } else {
        current.weightedLat += location.lat * location.memberCount
        current.weightedLng += location.lng * location.memberCount
        current.weightedCount += location.memberCount
      }
    }
    for (const source of current.sourceCounts) {
      const locationSource = location.sourceCounts.find((item) => item.id === source.id)
      source.value += locationSource?.value ?? 0
    }
    countries.set(id, current)
  }

  return Array.from(countries.values())
    .map((country) => ({
      id: country.id,
      city: "",
      state: "",
      country: country.country,
      lat: country.countryLat ?? (country.weightedCount ? country.weightedLat / country.weightedCount : null),
      lng: country.countryLng ?? (country.weightedCount ? country.weightedLng / country.weightedCount : null),
      countryLat: country.countryLat,
      countryLng: country.countryLng,
      coordinatePrecision: country.countryLat != null && country.countryLng != null
        ? "country" as const
        : country.weightedCount
          ? "city" as const
          : null,
      memberCount: country.memberCount,
      identifiableCount: country.identifiableCount,
      sourceCounts: country.sourceCounts,
      members: country.members.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.memberCount - a.memberCount || a.country.localeCompare(b.country))
}

export function memberGeographyCoverage(locations: Geography) {
  const mappedLocations = locations.filter((location) => location.lat != null && location.lng != null)
  const totalMembers = locations.reduce((sum, location) => sum + location.memberCount, 0)
  const mappedMembers = mappedLocations.reduce((sum, location) => sum + location.memberCount, 0)
  return {
    totalLocations: locations.length,
    mappedLocations: mappedLocations.length,
    unmappedLocations: locations.length - mappedLocations.length,
    totalMembers,
    mappedMembers,
    unmappedMembers: totalMembers - mappedMembers,
    countryFallbackLocations: mappedLocations.filter((location) => location.coordinatePrecision === "country").length,
    percent: totalMembers ? mappedMembers / totalMembers * 100 : 0,
  }
}
