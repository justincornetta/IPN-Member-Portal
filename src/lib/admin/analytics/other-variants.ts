import type { AnalyticsPoint } from "./types"

export const OTHER_WITHOUT_DETAILS = "Other (no additional detail)"

export type OtherVariantEntry = {
  canonicalLabel: string
  rawValues: string[]
}

function displayRawVariant(value: string) {
  const cleaned = value.normalize("NFKC").replace(/\s+/g, " ").trim()
  if (!cleaned || cleaned.toLowerCase() === "other") return OTHER_WITHOUT_DETAILS
  return cleaned
}

export function buildOtherVariantItems(entries: OtherVariantEntry[]): AnalyticsPoint[] {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    if (entry.canonicalLabel !== "Other") continue
    const variants = entry.rawValues.length ? entry.rawValues : [OTHER_WITHOUT_DETAILS]
    const uniqueVariants = new Set(variants.map(displayRawVariant))
    for (const variant of uniqueVariants) {
      counts.set(variant, (counts.get(variant) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}
