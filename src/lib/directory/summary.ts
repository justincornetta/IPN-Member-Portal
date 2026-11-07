import type { DirectoryMember, DirectorySummary } from "./types"

export type DirectoryLocation = Pick<DirectoryMember,
  "id" | "city" | "country" | "city_lat" | "city_lng" | "share_location">

/** Same eligibility and city grouping for map markers and aggregate counts. */
export function directoryCityKey(member: DirectoryLocation): string | null {
  if (!member.share_location || !member.city?.trim()
    || member.city_lat == null || member.city_lng == null) return null
  const lat = Number(member.city_lat)
  const lng = Number(member.city_lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)
    || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return [member.city.trim().toLowerCase(), member.country?.trim().toLowerCase() ?? "",
    lat.toFixed(2), lng.toFixed(2)].join(":")
}

export function summarizeDirectory(members: DirectoryLocation[]): DirectorySummary {
  const cities = new Set<string>()
  const countries = new Set<string>()
  const uniqueMembers = new Map(members.map((member) => [member.id, member]))
  let mappedMembers = 0
  for (const member of uniqueMembers.values()) {
    const city = directoryCityKey(member)
    if (!city) continue
    mappedMembers++
    cities.add(city)
    const country = member.country?.trim().toLowerCase()
    if (country) countries.add(country)
  }
  return { totalMembers: uniqueMembers.size, mappedMembers, cities: cities.size, countries: countries.size }
}
