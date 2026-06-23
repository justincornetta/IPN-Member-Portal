import type { DirectoryMember } from "./types"

const SEARCHABLE_PROFILE_FIELDS = [
  "school",
  "affiliation",
  "field",
  "bio",
] as const

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

export function directorySearchTerms(query: string): string[] {
  return normalizeSearchText(query).split(/\s+/).filter(Boolean)
}

function databaseSearchTerms(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/[,%*()]/g, "").trim())
    .filter(Boolean)
}

export function buildDirectorySearchOrFilter(query: string): string | null {
  const terms = databaseSearchTerms(query)
  if (terms.length === 0) return null

  return terms
    .flatMap((term) => [
      `first_name.ilike.%${term}%`,
      `last_name.ilike.%${term}%`,
      `school.ilike.%${term}%`,
      `affiliation.ilike.%${term}%`,
      `field.ilike.%${term}%`,
      `bio.ilike.%${term}%`,
    ])
    .join(",")
}

export function memberMatchesDirectorySearch(member: DirectoryMember, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query)
  if (!normalizedQuery) return true

  const firstName = member.first_name ?? ""
  const lastName = member.last_name ?? ""
  const fullName = [firstName, lastName].filter(Boolean).join(" ")
  const reversedName = [lastName, firstName].filter(Boolean).join(" ")

  const searchableText = normalizeSearchText(
    [
      fullName,
      reversedName,
      ...SEARCHABLE_PROFILE_FIELDS.map((field) => member[field] ?? ""),
      ...(member.interest_tags ?? []),
    ].join(" "),
  )

  if (searchableText.includes(normalizedQuery)) return true

  const terms = directorySearchTerms(query)
  return terms.length > 0 && terms.every((term) => searchableText.includes(term))
}
