import type { DirectoryMapMember } from "./types"

type Bounds = {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

const US_STATE_BOUNDS: Record<string, Bounds> = {
  Alabama: { minLat: 30.1, maxLat: 35.1, minLng: -88.6, maxLng: -84.9 },
  Alaska: { minLat: 51.2, maxLat: 71.6, minLng: -179.2, maxLng: -129.9 },
  Arizona: { minLat: 31.2, maxLat: 37.1, minLng: -114.9, maxLng: -109.0 },
  Arkansas: { minLat: 33.0, maxLat: 36.6, minLng: -94.7, maxLng: -89.6 },
  California: { minLat: 32.4, maxLat: 42.1, minLng: -124.5, maxLng: -114.1 },
  Colorado: { minLat: 36.9, maxLat: 41.1, minLng: -109.1, maxLng: -102.0 },
  Connecticut: { minLat: 40.9, maxLat: 42.1, minLng: -73.8, maxLng: -71.7 },
  Delaware: { minLat: 38.4, maxLat: 39.9, minLng: -75.8, maxLng: -75.0 },
  Florida: { minLat: 24.4, maxLat: 31.1, minLng: -87.7, maxLng: -80.0 },
  Georgia: { minLat: 30.2, maxLat: 35.1, minLng: -85.7, maxLng: -80.8 },
  Hawaii: { minLat: 18.8, maxLat: 22.3, minLng: -160.3, maxLng: -154.7 },
  Idaho: { minLat: 41.9, maxLat: 49.1, minLng: -117.3, maxLng: -111.0 },
  Illinois: { minLat: 36.9, maxLat: 42.6, minLng: -91.6, maxLng: -87.0 },
  Indiana: { minLat: 37.7, maxLat: 41.8, minLng: -88.2, maxLng: -84.7 },
  Iowa: { minLat: 40.3, maxLat: 43.6, minLng: -96.7, maxLng: -90.1 },
  Kansas: { minLat: 36.9, maxLat: 40.1, minLng: -102.1, maxLng: -94.5 },
  Kentucky: { minLat: 36.4, maxLat: 39.2, minLng: -89.6, maxLng: -81.9 },
  Louisiana: { minLat: 28.8, maxLat: 33.1, minLng: -94.1, maxLng: -88.8 },
  Maine: { minLat: 42.9, maxLat: 47.5, minLng: -71.1, maxLng: -66.8 },
  Maryland: { minLat: 37.8, maxLat: 39.8, minLng: -79.6, maxLng: -75.0 },
  Massachusetts: { minLat: 41.2, maxLat: 42.9, minLng: -73.6, maxLng: -69.9 },
  Michigan: { minLat: 41.6, maxLat: 48.4, minLng: -90.5, maxLng: -82.1 },
  Minnesota: { minLat: 43.4, maxLat: 49.4, minLng: -97.3, maxLng: -89.4 },
  Mississippi: { minLat: 30.1, maxLat: 35.1, minLng: -91.7, maxLng: -88.1 },
  Missouri: { minLat: 35.9, maxLat: 40.7, minLng: -95.8, maxLng: -89.0 },
  Montana: { minLat: 44.3, maxLat: 49.1, minLng: -116.1, maxLng: -104.0 },
  Nebraska: { minLat: 39.9, maxLat: 43.1, minLng: -104.1, maxLng: -95.2 },
  Nevada: { minLat: 35.0, maxLat: 42.1, minLng: -120.1, maxLng: -114.0 },
  "New Hampshire": { minLat: 42.6, maxLat: 45.4, minLng: -72.6, maxLng: -70.6 },
  "New Jersey": { minLat: 38.8, maxLat: 41.4, minLng: -75.7, maxLng: -73.8 },
  "New Mexico": { minLat: 31.3, maxLat: 37.1, minLng: -109.1, maxLng: -103.0 },
  "New York": { minLat: 40.4, maxLat: 45.1, minLng: -79.9, maxLng: -71.8 },
  "North Carolina": { minLat: 33.8, maxLat: 36.7, minLng: -84.4, maxLng: -75.3 },
  "North Dakota": { minLat: 45.9, maxLat: 49.1, minLng: -104.1, maxLng: -96.5 },
  Ohio: { minLat: 38.3, maxLat: 42.4, minLng: -84.9, maxLng: -80.5 },
  Oklahoma: { minLat: 33.6, maxLat: 37.1, minLng: -103.1, maxLng: -94.4 },
  Oregon: { minLat: 41.9, maxLat: 46.3, minLng: -124.7, maxLng: -116.4 },
  Pennsylvania: { minLat: 39.7, maxLat: 42.3, minLng: -80.6, maxLng: -74.7 },
  "Rhode Island": { minLat: 41.1, maxLat: 42.1, minLng: -71.9, maxLng: -71.1 },
  "South Carolina": { minLat: 32.0, maxLat: 35.3, minLng: -83.4, maxLng: -78.5 },
  "South Dakota": { minLat: 42.4, maxLat: 45.9, minLng: -104.1, maxLng: -96.4 },
  Tennessee: { minLat: 34.9, maxLat: 36.7, minLng: -90.4, maxLng: -81.6 },
  Texas: { minLat: 25.8, maxLat: 36.6, minLng: -106.7, maxLng: -93.5 },
  Utah: { minLat: 36.9, maxLat: 42.1, minLng: -114.1, maxLng: -109.0 },
  Vermont: { minLat: 42.7, maxLat: 45.1, minLng: -73.5, maxLng: -71.4 },
  Virginia: { minLat: 36.5, maxLat: 39.6, minLng: -83.8, maxLng: -75.2 },
  Washington: { minLat: 45.5, maxLat: 49.1, minLng: -124.8, maxLng: -116.9 },
  "West Virginia": { minLat: 37.1, maxLat: 40.7, minLng: -82.7, maxLng: -77.7 },
  Wisconsin: { minLat: 42.4, maxLat: 47.1, minLng: -92.9, maxLng: -86.7 },
  Wyoming: { minLat: 40.9, maxLat: 45.1, minLng: -111.1, maxLng: -104.0 },
  "District of Columbia": { minLat: 38.8, maxLat: 39.0, minLng: -77.2, maxLng: -76.9 },
}

const KNOWN_US_CITY_STATES: Record<string, string> = {
  arlington: "Virginia",
  columbus: "Ohio",
  orlando: "Florida",
  philadelphia: "Pennsylvania",
  portland: "Oregon",
  "whitehouse station": "New Jersey",
}

function isInsideBounds(lat: number, lng: number, bounds: Bounds) {
  return lat >= bounds.minLat && lat <= bounds.maxLat && lng >= bounds.minLng && lng <= bounds.maxLng
}

function resolveUsStateFromCoordinates(lat: number, lng: number) {
  return Object.entries(US_STATE_BOUNDS).find(([, bounds]) => isInsideBounds(lat, lng, bounds))?.[0] ?? null
}

export function resolveDirectoryMapState(member: DirectoryMapMember) {
  if (member.country === "United States") {
    const knownState = member.city
      ? KNOWN_US_CITY_STATES[member.city.trim().toLowerCase()]
      : null
    const knownStateBounds = knownState ? US_STATE_BOUNDS[knownState] : null
    if (
      knownState &&
      knownStateBounds &&
      isInsideBounds(member.city_lat, member.city_lng, knownStateBounds)
    ) {
      return knownState
    }

    if (member.state) {
      const stateBounds = US_STATE_BOUNDS[member.state]
      if (stateBounds && isInsideBounds(member.city_lat, member.city_lng, stateBounds)) {
        return member.state
      }
    }

    return resolveUsStateFromCoordinates(member.city_lat, member.city_lng) ?? member.state
  }

  return member.state
}
