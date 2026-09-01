export const EDUCATION_STATUS_OPTIONS = [
  { value: "currently_enrolled", label: "Currently enrolled" },
  { value: "completed", label: "Completed / alumni" },
] as const

export const EDUCATION_LEVEL_OPTIONS = [
  { value: "high_school", label: "High school / pre-college" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "graduate", label: "Graduate" },
  { value: "professional_degree", label: "Professional degree" },
  { value: "certificate", label: "Certificate / continuing education" },
  { value: "other", label: "Other" },
] as const

export type EducationStatus = (typeof EDUCATION_STATUS_OPTIONS)[number]["value"]
export type EducationLevel = (typeof EDUCATION_LEVEL_OPTIONS)[number]["value"]

export type MemberEducationInput = {
  id?: string | null
  institution: string
  education_level: EducationLevel | ""
  degree_credential: string
  area_of_study: string
  status: EducationStatus | ""
  graduation_year: number | null
}

export function validateEducationEntries(
  entries: MemberEducationInput[],
  { required }: { required: boolean },
) {
  const populated = entries.filter((entry) => (
    entry.institution.trim()
    || entry.education_level
    || entry.degree_credential.trim()
    || entry.area_of_study.trim()
    || entry.status
    || entry.graduation_year != null
  ))

  if (required && populated.length === 0) {
    return "Add at least one school or university."
  }

  for (const entry of populated) {
    if (!entry.institution.trim()) return "Every education entry needs a school or university."
    if (!entry.degree_credential.trim()) return "Every education entry needs a degree or credential."
    if (!entry.area_of_study.trim()) return "Every education entry needs an area of study."
    if (!entry.status) return "Every education entry needs an enrollment or completion status."
    if (entry.graduation_year != null && (entry.graduation_year < 1900 || entry.graduation_year > 2200)) {
      return "Graduation year must be between 1900 and 2200."
    }
  }

  return null
}

export function compactEducationEntries(entries: MemberEducationInput[]) {
  return entries
    .filter((entry) => entry.institution.trim())
    .map((entry) => ({
      id: entry.id ?? null,
      institution: entry.institution.trim(),
      education_level: entry.education_level || null,
      degree_credential: entry.degree_credential.trim(),
      area_of_study: entry.area_of_study.trim(),
      status: entry.status,
      graduation_year: entry.graduation_year,
    }))
}

export function educationLevelForPersona(persona: string): EducationLevel | null {
  if (persona === "High school / pre-college") return "high_school"
  if (persona === "Undergraduate student") return "undergraduate"
  if (persona === "Graduate student (Master's or PhD)") return "graduate"
  if (persona === "Professional degree student (MD, JD, MBA, etc.)") return "professional_degree"
  return null
}

export function educationLevelLabel(level: EducationLevel | string | null | undefined) {
  return EDUCATION_LEVEL_OPTIONS.find((option) => option.value === level)?.label ?? ""
}

export function normalizeInstitutionName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
}
