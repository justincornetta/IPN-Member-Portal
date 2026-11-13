import type { AnalyticsPoint } from "./types"

export function categoryWithoutDetails(category: string) {
  return `${category} (no additional detail)`
}

export const OTHER_WITHOUT_DETAILS = categoryWithoutDetails("Other")

export type OtherVariantEntry = {
  canonicalLabel: string
  rawValues: string[]
}

function normalizeWhitespace(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim()
}

function displayRawVariant(value: string, category: string) {
  const cleaned = normalizeWhitespace(value)
  if (!cleaned || cleaned.toLowerCase() === category.toLowerCase()) {
    return categoryWithoutDetails(category)
  }
  return cleaned
}

function mostCommonCasing(casings: Map<string, number>) {
  return Array.from(casings.entries())
    .sort((a, b) => b[1] - a[1])[0][0]
}

export function buildOtherVariantItems(
  entries: OtherVariantEntry[],
  category = "Other",
): AnalyticsPoint[] {
  const groups = new Map<string, { casings: Map<string, number>; total: number }>()

  for (const entry of entries) {
    if (entry.canonicalLabel !== category) continue
    const variants = entry.rawValues.length ? entry.rawValues : [""]
    const unique = new Map<string, string>()
    for (const value of variants) {
      const display = displayRawVariant(value, category)
      const key = display.toLowerCase()
      if (!unique.has(key)) unique.set(key, display)
    }
    for (const [key, display] of unique) {
      const group = groups.get(key) ?? { casings: new Map<string, number>(), total: 0 }
      group.casings.set(display, (group.casings.get(display) ?? 0) + 1)
      group.total += 1
      groups.set(key, group)
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      label: mostCommonCasing(group.casings),
      value: group.total,
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

export function buildCategoryVariantMap(
  entries: OtherVariantEntry[],
  categories: readonly string[] = ["Other"],
): Record<string, AnalyticsPoint[]> {
  const result: Record<string, AnalyticsPoint[]> = {}
  for (const category of categories) {
    const items = buildOtherVariantItems(entries, category)
    if (items.length) result[category] = items
  }
  return result
}
