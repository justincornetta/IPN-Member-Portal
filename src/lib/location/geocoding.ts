export type LocationCandidate = {
  id: string
  label: string
  city: string
  state: string | null
  country: string
  lat: number
  lng: number
}

type SearchParams = {
  city: string
  state?: string
  country: string
}

type MapboxFeature = {
  id?: string
  geometry?: {
    coordinates?: [number, number]
  }
  properties?: {
    mapbox_id?: string
    name?: string
    name_preferred?: string
    full_address?: string
    place_formatted?: string
    context?: {
      country?: { name?: string }
      region?: { name?: string }
      district?: { name?: string }
      place?: { name?: string }
    }
  }
}

type MapboxResponse = {
  features?: MapboxFeature[]
}

type NominatimResult = {
  place_id?: number
  display_name?: string
  lat?: string
  lon?: string
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    hamlet?: string
    state?: string
    region?: string
    county?: string
    country?: string
  }
}

const COUNTRY_CODE_OVERRIDES: Record<string, string> = {
  bolivia: "BO",
  brunei: "BN",
  "cape verde": "CV",
  congo: "CG",
  "czech republic": "CZ",
  iran: "IR",
  kosovo: "XK",
  laos: "LA",
  moldova: "MD",
  myanmar: "MM",
  "north korea": "KP",
  "north macedonia": "MK",
  palestine: "PS",
  russia: "RU",
  "south korea": "KR",
  syria: "SY",
  "taiwan": "TW",
  tanzania: "TZ",
  "united kingdom": "GB",
  "united states": "US",
  venezuela: "VE",
  vietnam: "VN",
}

const countryDisplayNames = new Intl.DisplayNames(["en"], { type: "region" })

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function countryCodeForName(country: string): string | null {
  const normalized = normalizeName(country)
  if (COUNTRY_CODE_OVERRIDES[normalized]) return COUNTRY_CODE_OVERRIDES[normalized]

  for (let first = 65; first <= 90; first += 1) {
    for (let second = 65; second <= 90; second += 1) {
      const code = `${String.fromCharCode(first)}${String.fromCharCode(second)}`
      if (normalizeName(countryDisplayNames.of(code) ?? "") === normalized) return code
    }
  }

  return null
}

function cityFromAddress(address: NominatimResult["address"], fallback: string) {
  return (
    clean(address?.city) ??
    clean(address?.town) ??
    clean(address?.village) ??
    clean(address?.municipality) ??
    clean(address?.hamlet) ??
    fallback
  )
}

function locationLabel(candidate: {
  city: string
  state: string | null
  country: string
  displayName: string | null
}) {
  const parts = [candidate.city, candidate.state, candidate.country].filter(Boolean)
  if (parts.length >= 2) return parts.join(", ")
  return candidate.displayName ?? candidate.city
}

function normalizeMapboxResults(
  features: MapboxFeature[],
  fallbackCity: string,
  fallbackCountry: string,
): LocationCandidate[] {
  const seen = new Set<string>()

  return features.flatMap((feature) => {
    const coordinates = feature.geometry?.coordinates
    const lng = coordinates?.[0]
    const lat = coordinates?.[1]
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []

    const properties = feature.properties
    const context = properties?.context
    const canonicalCity =
      clean(properties?.name_preferred) ??
      clean(properties?.name) ??
      clean(context?.place?.name) ??
      fallbackCity
    const canonicalState =
      clean(context?.region?.name) ?? clean(context?.district?.name)
    const canonicalCountry = clean(context?.country?.name) ?? fallbackCountry
    const label =
      clean(properties?.full_address) ??
      [canonicalCity, clean(properties?.place_formatted)].filter(Boolean).join(", ") ??
      locationLabel({
        city: canonicalCity,
        state: canonicalState,
        country: canonicalCountry,
        displayName: null,
      })
    const key = `${label.toLowerCase()}|${lat!.toFixed(3)}|${lng!.toFixed(3)}`
    if (seen.has(key)) return []
    seen.add(key)

    return [
      {
        id: properties?.mapbox_id ?? feature.id ?? key,
        label,
        city: canonicalCity,
        state: canonicalState,
        country: canonicalCountry,
        lat: lat!,
        lng: lng!,
      },
    ]
  })
}

async function searchMapboxCities({
  searchCity,
  country,
}: {
  searchCity: string
  country: string
}): Promise<LocationCandidate[]> {
  const token = process.env.MAPBOX_TOKEN ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) return []

  const countryCode = countryCodeForName(country)
  const params = new URLSearchParams({
    q: searchCity,
    access_token: token,
    autocomplete: "true",
    country: countryCode ?? country,
    language: "en",
    limit: "5",
    permanent: "true",
    types: "place,locality",
  })

  const response = await fetch(
    `https://api.mapbox.com/search/geocode/v6/forward?${params}`,
    { cache: "no-store" },
  )

  if (!response.ok) return []

  const result = (await response.json()) as MapboxResponse
  return normalizeMapboxResults(result.features ?? [], searchCity, country)
}

async function fetchNominatim(params: URLSearchParams) {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      "User-Agent": "IPN-Member-Portal (members.intercollegiatepsychedelics.net)",
    },
    next: { revalidate: 60 * 60 * 24 },
  })

  if (!response.ok) return []
  return (await response.json()) as NominatimResult[]
}

function normalizeResults(results: NominatimResult[], fallbackCity: string, fallbackCountry: string) {
  const seen = new Set<string>()

  return results.flatMap((result) => {
    const lat = Number(result.lat)
    const lng = Number(result.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []

    const address = result.address
    const canonicalCity = cityFromAddress(address, fallbackCity)
    const canonicalCountry = clean(address?.country) ?? fallbackCountry
    const canonicalState =
      clean(address?.state) ?? clean(address?.region) ?? clean(address?.county)
    const label = locationLabel({
      city: canonicalCity,
      state: canonicalState,
      country: canonicalCountry,
      displayName: clean(result.display_name),
    })
    const key = `${label.toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}`
    if (seen.has(key)) return []
    seen.add(key)

    return [
      {
        id: String(result.place_id ?? key),
        label,
        city: canonicalCity,
        state: canonicalState,
        country: canonicalCountry,
        lat,
        lng,
      },
    ]
  })
}

export async function searchCityCandidates({
  city,
  state,
  country,
}: SearchParams): Promise<LocationCandidate[]> {
  const cleanCity = clean(city)
  const cleanCountry = clean(country)
  if (!cleanCity || !cleanCountry) return []
  const searchCity = cleanCity.split(",")[0]?.trim() || cleanCity
  if (searchCity.length < 2) return []

  const params = new URLSearchParams({
    city: searchCity,
    country: cleanCountry,
    format: "jsonv2",
    addressdetails: "1",
    limit: "5",
  })

  const cleanState = clean(state)
  if (cleanState) params.set("state", cleanState)

  try {
    const mapboxResults = await searchMapboxCities({
      searchCity,
      country: cleanCountry,
    })
    if (mapboxResults.length > 0) return mapboxResults

    const structured = normalizeResults(
      await fetchNominatim(params),
      searchCity,
      cleanCountry,
    )
    if (structured.length > 0) return structured

    const fallbackParams = new URLSearchParams({
      q: [searchCity, cleanState, cleanCountry].filter(Boolean).join(", "),
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
    })

    return normalizeResults(await fetchNominatim(fallbackParams), searchCity, cleanCountry)
  } catch {
    return []
  }
}
