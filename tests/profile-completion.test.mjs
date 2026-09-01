import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

import {
  getProfileCompletion,
  PROFILE_COMPLETION_TOTAL,
} from "../src/app/dashboard/profile/profile-completion.ts"

function profile(overrides = {}) {
  return {
    avatarUrl: null,
    bio: "",
    role: "",
    requiresEducation: false,
    affiliation: "",
    education: [],
    interests: [],
    roleAndGoals: "",
    inspiration: "",
    supportNeeds: "",
    linkedinUrl: "",
    linkedinOptOut: false,
    whatsappUrl: null,
    whatsappOptOut: false,
    ...overrides,
  }
}

test("profile form offers save controls beneath the checklist and at the end", async () => {
  const profileForm = await readFile(
    new URL("../src/app/dashboard/profile/ProfileForm.tsx", import.meta.url),
    "utf8",
  )

  const mainProfileForm = profileForm.slice(profileForm.indexOf("export default function ProfileForm"))

  assert.equal(mainProfileForm.match(/onClick=\{handleSave\}/g)?.length, 2)
  assert.match(
    mainProfileForm,
    /<ProfileCompletionStatus[\s\S]*?<\/div>\s*<\/div>\s*\{saved &&/,
  )
})

test("profile form persists and restores the WhatsApp opt-out choice", async () => {
  const [profileForm, profilePage, profileActions] = await Promise.all([
    readFile(new URL("../src/app/dashboard/profile/ProfileForm.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/profile/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/profile/actions.ts", import.meta.url), "utf8"),
  ])

  assert.match(profileForm, /I don&apos;t use WhatsApp/)
  assert.match(profileForm, /whatsappOptOut: data\.whatsapp_opt_out/)
  assert.match(profileForm, /disabled=\{data\.whatsapp_opt_out\}/)
  assert.match(profilePage, /whatsappOptOut=\{user\.user_metadata\?\.whatsapp_opt_out === true\}/)
  assert.match(profileActions, /whatsapp_opt_out: details\.whatsappOptOut/)
  assert.match(profileActions, /whatsAppOptOut: details\.whatsappOptOut/)
})

test("profile completion has eight stable, member-facing criteria", () => {
  const completion = getProfileCompletion(profile())

  assert.equal(PROFILE_COMPLETION_TOTAL, 8)
  assert.equal(completion.totalCount, 8)
  assert.deepEqual(
    completion.items.map(({ field, label }) => ({ field, label })),
    [
      { field: "avatar", label: "Profile photo" },
      { field: "bio", label: "Short bio" },
      { field: "role", label: "Current role" },
      { field: "organization", label: "School or organization" },
      { field: "interests", label: "Interests" },
      { field: "about", label: "About you" },
      { field: "linkedin", label: "LinkedIn" },
      { field: "whatsapp", label: "WhatsApp" },
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
    requiresEducation: true,
    affiliation: "  ",
    education: [{
      institution: "  Princeton University  ",
      degreeCredential: " BA ",
      areaOfStudy: " Neuroscience ",
    }],
    interests: ["  ", "Neuroscience"],
    roleAndGoals: " Research and policy ",
    inspiration: " Community ",
    supportNeeds: " Mentorship ",
    linkedinUrl: " https://linkedin.com/in/member ",
    whatsappUrl: " https://wa.me/15551234567 ",
  }))

  assert.equal(completion.completedCount, 8)
  assert.equal(completion.isComplete, true)
})

test("about you is one grouped criterion with partial progress", () => {
  const partial = getProfileCompletion(profile({
    roleAndGoals: "Research",
    inspiration: "Community",
  })).items.find((item) => item.field === "about")

  assert.equal(partial?.complete, false)
  assert.equal(partial?.detailLabel, "2 of 3 answered")

  const complete = getProfileCompletion(profile({
    roleAndGoals: "Research",
    inspiration: "Community",
    supportNeeds: "Mentorship",
  })).items.find((item) => item.field === "about")

  assert.equal(complete?.complete, true)
  assert.equal(complete?.detailLabel, "3 of 3 answered")
})

test("LinkedIn is complete with a URL or an intentional opt-out", () => {
  const withUrl = getProfileCompletion(profile({
    linkedinUrl: "https://linkedin.com/in/member",
  })).items.find((item) => item.field === "linkedin")
  assert.equal(withUrl?.complete, true)
  assert.equal(withUrl?.completedLabel, "Complete")

  const optedOut = getProfileCompletion(profile({
    linkedinOptOut: true,
  })).items.find((item) => item.field === "linkedin")
  assert.equal(optedOut?.complete, true)
  assert.equal(optedOut?.completedLabel, "Not used")
})

test("WhatsApp is complete with a phone link or an intentional opt-out", () => {
  const withNumber = getProfileCompletion(profile({
    whatsappUrl: "https://wa.me/15551234567",
  })).items.find((item) => item.field === "whatsapp")
  assert.equal(withNumber?.complete, true)
  assert.equal(withNumber?.completedLabel, "Complete")

  const optedOut = getProfileCompletion(profile({
    whatsappOptOut: true,
  })).items.find((item) => item.field === "whatsapp")
  assert.equal(optedOut?.complete, true)
  assert.equal(optedOut?.completedLabel, "Not used")
})

test("school or organization requires affiliation or complete education details", () => {
  const affiliation = getProfileCompletion(profile({ affiliation: "MAPS" }))
  assert.equal(affiliation.items.find((item) => item.field === "organization")?.complete, true)

  const studentAffiliationOnly = getProfileCompletion(profile({
    role: "Undergraduate student",
    requiresEducation: true,
    affiliation: "University of Pennsylvania",
  }))
  assert.equal(
    studentAffiliationOnly.items.find((item) => item.field === "organization")?.complete,
    false,
  )

  for (const education of [
    [{ institution: "UC Berkeley", degreeCredential: "", areaOfStudy: "" }],
    [{ institution: "UC Berkeley", degreeCredential: "BA", areaOfStudy: "" }],
    [{ institution: "UC Berkeley", degreeCredential: "", areaOfStudy: "Psychology" }],
  ]) {
    const incomplete = getProfileCompletion(profile({ education, requiresEducation: true }))
    assert.equal(incomplete.items.find((item) => item.field === "organization")?.complete, false)
  }

  const complete = getProfileCompletion(profile({
    education: [{
      institution: "UC Berkeley",
      degreeCredential: "BA",
      areaOfStudy: "Psychology",
    }],
    requiresEducation: true,
  }))
  assert.equal(complete.items.find((item) => item.field === "organization")?.complete, true)
})
