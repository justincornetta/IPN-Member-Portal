export const PROFILE_COMPLETION_TOTAL = 7

export type ProfileCompletionField =
  | "avatar"
  | "bio"
  | "role"
  | "organization"
  | "interests"
  | "about"
  | "linkedin"

export type ProfileCompletionInput = {
  avatarUrl: string | null
  bio: string
  role: string
  requiresEducation: boolean
  affiliation: string
  education: Array<{
    institution: string
    degreeCredential: string
    areaOfStudy: string
  }>
  interests: string[]
  roleAndGoals: string
  inspiration: string
  supportNeeds: string
  linkedinUrl: string
  linkedinOptOut: boolean
}

export type ProfileCompletionItem = {
  field: ProfileCompletionField
  label: string
  actionLabel: string
  complete: boolean
  detailLabel?: string
  completedLabel?: string
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim())
}

export function getProfileCompletion(input: ProfileCompletionInput) {
  const aboutYouAnsweredCount = [
    input.roleAndGoals,
    input.inspiration,
    input.supportNeeds,
  ].filter(hasText).length
  const hasCompleteEducation = input.education.some((entry) => (
    hasText(entry.institution)
    && hasText(entry.degreeCredential)
    && hasText(entry.areaOfStudy)
  ))

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
      actionLabel: "Complete education",
      complete: input.requiresEducation
        ? hasCompleteEducation
        : hasText(input.affiliation) || hasCompleteEducation,
    },
    {
      field: "interests",
      label: "Interests",
      actionLabel: "Add interests",
      complete: input.interests.some(hasText),
    },
    {
      field: "about",
      label: "About you",
      actionLabel: "Continue",
      complete: aboutYouAnsweredCount === 3,
      detailLabel: `${aboutYouAnsweredCount} of 3 answered`,
    },
    {
      field: "linkedin",
      label: "LinkedIn",
      actionLabel: "Add or opt out",
      complete: hasText(input.linkedinUrl) || input.linkedinOptOut,
      completedLabel: input.linkedinOptOut && !hasText(input.linkedinUrl) ? "Not used" : "Complete",
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
