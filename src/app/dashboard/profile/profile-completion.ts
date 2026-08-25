export const PROFILE_COMPLETION_TOTAL = 5

export type ProfileCompletionField =
  | "avatar"
  | "bio"
  | "role"
  | "organization"
  | "interests"

export type ProfileCompletionInput = {
  avatarUrl: string | null
  bio: string
  role: string
  affiliation: string
  legacySchool: string
  educationInstitutions: string[]
  interests: string[]
}

export type ProfileCompletionItem = {
  field: ProfileCompletionField
  label: string
  actionLabel: string
  complete: boolean
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim())
}

export function getProfileCompletion(input: ProfileCompletionInput) {
  const items: ProfileCompletionItem[] = [
    {
      field: "avatar",
      label: "Profile photo",
      actionLabel: "Add photo",
      complete: hasText(input.avatarUrl),
    },
    {
      field: "bio",
      label: "Short bio",
      actionLabel: "Add bio",
      complete: hasText(input.bio),
    },
    {
      field: "role",
      label: "Current role",
      actionLabel: "Add role",
      complete: hasText(input.role),
    },
    {
      field: "organization",
      label: "School or organization",
      actionLabel: "Add school or organization",
      complete: [
        input.affiliation,
        input.legacySchool,
        ...input.educationInstitutions,
      ].some(hasText),
    },
    {
      field: "interests",
      label: "Interests",
      actionLabel: "Add interests",
      complete: input.interests.some(hasText),
    },
  ]

  const completedCount = items.filter((item) => item.complete).length

  return {
    items,
    completedCount,
    totalCount: PROFILE_COMPLETION_TOTAL,
    isComplete: completedCount === PROFILE_COMPLETION_TOTAL,
  }
}
