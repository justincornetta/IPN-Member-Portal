export type LocationGeocode = {
  city: string | null
  state: string | null
  country: string
  latitude: number
  longitude: number
  precision: "city" | "country"
}

export function analyticsLocationKey(city: string, state: string, country: string) {
  return [city, state, country].map((part) => part.trim().toLowerCase()).join("|")
}

export function buildAnalyticsGeocodeLookup(rows: LocationGeocode[]) {
  const exact = new Map<string, { lat: number; lng: number }>()
  const countries = new Map<string, { lat: number; lng: number }>()
  for (const row of rows) {
    const coords = { lat: Number(row.latitude), lng: Number(row.longitude) }
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) continue
    if (row.precision === "country" || !row.city) {
      countries.set(row.country.trim().toLowerCase(), coords)
    } else {
      exact.set(analyticsLocationKey(row.city, row.state ?? "", row.country), coords)
    }
  }
  return { exact, countries }
}

export function resolveAnalyticsLocation(
  lookup: ReturnType<typeof buildAnalyticsGeocodeLookup>,
  city: string,
  state: string,
  country: string,
) {
  return lookup.exact.get(analyticsLocationKey(city, state, country))
    ?? lookup.countries.get(country.trim().toLowerCase())
    ?? null
}
