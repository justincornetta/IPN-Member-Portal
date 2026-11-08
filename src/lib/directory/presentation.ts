import type { DirectoryMember } from "./types"

/** A current affiliation must not be displaced by a historical education row. */
export function memberAffiliation(member: DirectoryMember): string | null {
  const affiliation = member.affiliation?.trim()
  if (affiliation) return affiliation
  const currentSchool = member.education?.find((entry) =>
    entry.status === "currently_enrolled" && entry.institution.trim(),
  )?.institution.trim()
  if (currentSchool) return currentSchool
  // Legacy student profiles may predate structured education. Do not label
  // alumni/professionals with an old school as their current affiliation.
  const isStudent = /student|high school|pre-college/i.test(member.persona ?? "")
  return isStudent && !member.education?.length ? member.school?.trim() || null : null
}

const STAGE_LABELS: Record<string, string> = {
  "High school / pre-college": "Pre-college",
  "Undergraduate student": "Undergraduate student",
  "Graduate student (Master's or PhD)": "Graduate student",
  "Professional degree student (MD, JD, MBA, etc.)": "Professional student",
  "Professional in psychedelics": "Psychedelic professional",
  "Professional in another field": "Professional",
}

export function memberStage(persona: string | null): string | null {
  if (!persona || persona === "Other") return null
  return STAGE_LABELS[persona] ?? persona
}

export function memberLocation(member: DirectoryMember): string | null {
  if (!member.share_location) return null
  return [member.city, member.state || member.country].filter(Boolean).join(", ") || null
}
