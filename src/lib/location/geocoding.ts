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

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
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
