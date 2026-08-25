import assert from "node:assert/strict"
import test from "node:test"

import {
  getProfileCompletion,
  PROFILE_COMPLETION_TOTAL,
} from "../src/app/dashboard/profile/profile-completion.ts"

function profile(overrides = {}) {
  return {
    avatarUrl: null,
    bio: "",
    role: "",
    affiliation: "",
    legacySchool: "",
    educationInstitutions: [],
    interests: [],
    ...overrides,
  }
}

test("profile completion has five stable, member-facing criteria", () => {
  const completion = getProfileCompletion(profile())

  assert.equal(PROFILE_COMPLETION_TOTAL, 5)
  assert.equal(completion.totalCount, 5)
  assert.deepEqual(
    completion.items.map(({ field, label }) => ({ field, label })),
    [
      { field: "avatar", label: "Profile photo" },
      { field: "bio", label: "Short bio" },
      { field: "role", label: "Current role" },
      { field: "organization", label: "School or organization" },
      { field: "interests", label: "Interests" },
    ],
  )
  assert.equal(completion.completedCount, 0)
  assert.equal(completion.isComplete, false)
})

test("profile completion ignores whitespace and counts each criterion once", () => {
  const completion = getProfileCompletion(profile({
    avatarUrl: " https://example.com/avatar.jpg ",
    bio: " A short bio ",
    role: "Graduate student (Master's or PhD)",
    affiliation: "  ",
    educationInstitutions: ["  Princeton University  ", "Another school"],
    interests: ["  ", "Neuroscience"],
  }))

  assert.equal(completion.completedCount, 5)
  assert.equal(completion.isComplete, true)
})

test("school or organization supports affiliation, legacy school, and education records", () => {
  for (const candidate of [
    { affiliation: "MAPS" },
    { legacySchool: "Brown University" },
    { educationInstitutions: ["UC Berkeley"] },
  ]) {
    const organization = getProfileCompletion(profile(candidate)).items.find(
      (item) => item.field === "organization",
    )
    assert.equal(organization?.complete, true)
  }

  const educationDetailsOnly = getProfileCompletion(profile({
    educationInstitutions: ["  "],
  }))
  assert.equal(
    educationDetailsOnly.items.find((item) => item.field === "organization")?.complete,
    false,
  )
})
