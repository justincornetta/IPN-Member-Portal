function key(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

const FIELD_ALIASES = new Map<string, string>([
  ["science, technology, engineering, & mathematics", "Science, Technology, Engineering, Mathematics (STEM)"],
  ["science, technology, engineering, and mathematics", "Science, Technology, Engineering, Mathematics (STEM)"],
  ["science, technology, engineering, mathematics (stem)", "Science, Technology, Engineering, Mathematics (STEM)"],
  ["science, technology, engineering, & mathematics (stem)", "Science, Technology, Engineering, Mathematics (STEM)"],
  ["law and policy", "Law & Policy"],
  ["law & policy", "Law & Policy"],
  ["trade and personal services", "Skilled Trades & Personal Services"],
  ["trade & personal services", "Skilled Trades & Personal Services"],
  ["skilled trades & personal services", "Skilled Trades & Personal Services"],
])

export function canonicalMemberField(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  return FIELD_ALIASES.get(key(raw)) ?? raw
}

export function canonicalPsychedelicFieldStatus(value: string | null | undefined) {
  const raw = String(value ?? "").trim()
  const normalized = key(raw)
  if (!normalized) return ""
  if (normalized.startsWith("yes - i currently work in the field")) {
    return "Yes — I currently work in the field"
  }
  if (normalized.startsWith("no - i don't plan to work in the field")) {
    return "No — I don't plan to work in the field"
  }
  if (normalized.startsWith("not yet - i'm interested in working in the field")) {
    return "Not yet — I'm interested in working in the field"
  }
  if (normalized === "i'm not sure") return "I'm not sure"
  return raw
}
