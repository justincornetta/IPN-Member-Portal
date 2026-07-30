function categoryKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

const PERSONA_ALIASES = new Map([
  ["high school", "High School"],
  ["high school student", "High School"],
  ["high school/pre-college", "High School"],
  ["undergraduate", "Undergraduate"],
  ["undergraduate student", "Undergraduate"],
  ["undergraduate student (b.a./b.s.)", "Undergraduate"],
  ["graduate student", "Graduate Student"],
  ["graduate student (master's or phd)", "Graduate Student"],
  // This historical option did not store the selected degree. Current MBA
  // registrations use Professional Degree Student; the mixed legacy option
  // stays with its primary Graduate Student label.
  ["graduate student (m.a./m.s./ph.d/mba)", "Graduate Student"],
  ["professional degree student", "Professional Degree Student"],
  ["professional degree student (md, jd, mba, etc.)", "Professional Degree Student"],
  ["professional student (m.d./j.d./d.o)", "Professional Degree Student"],
  ["psychedelic professional", "Psychedelic Professional"],
  ["professional in psychedelics", "Psychedelic Professional"],
  ["professional in the psychedelic field (e.g., clinician, researcher, policy advocate)", "Psychedelic Professional"],
  ["current industry professional", "Psychedelic Professional"],
  ["professional", "Professional"],
  ["professional in another field", "Professional"],
  ["professional in a related field (e.g., healthcare, education, nonprofit, tech, law)", "Professional"],
  ["other", "Other"],
])

const FIELD_ALIASES = new Map([
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

const REFERRAL_ALIASES = new Map([
  ["social media", "Social Media"],
  ["a friend/colleague", "Friend / Colleague"],
  ["friend/colleague", "Friend / Colleague"],
  ["google/search engine", "Google / Search Engine"],
  ["email/newsletter", "Email / Newsletter"],
  ["event/conference", "Event / Conference"],
  ["academic/professional organization", "Academic / Professional Organization"],
  ["other", "Other"],
])

export function canonicalMemberPersona(value) {
  const normalized = categoryKey(value)
  if (!normalized) return ""
  return PERSONA_ALIASES.get(normalized) ?? "Other"
}

export function canonicalMemberField(value) {
  const raw = String(value ?? "").trim()
  return FIELD_ALIASES.get(categoryKey(raw)) ?? raw
}

export function canonicalReferralSource(value) {
  const normalized = categoryKey(value)
  if (!normalized) return ""
  return REFERRAL_ALIASES.get(normalized) ?? "Other"
}

export function canonicalPsychedelicFieldStatus(value) {
  const raw = String(value ?? "").trim()
  const normalized = categoryKey(raw)
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

export function normalizeLegacyBarrierText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .trim()
}
