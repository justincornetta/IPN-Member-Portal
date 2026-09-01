import test from "node:test"
import assert from "node:assert/strict"

import {
  featuredMemberSimilarity,
  recommendFeaturedMembers,
} from "../src/app/dashboard/featured-member-recommendations.ts"

const viewer = {
  persona: "Graduate student (Master's or PhD)",
  school: "University of Wisconsin - Madison",
  affiliation: null,
  field: "Neuroscience",
  interest_tags: ["Drug policy", "Clinical research"],
  educationInstitutions: ["University of Wisconsin - Madison"],
}

function member(id, overrides = {}) {
  return {
    id,
    first_name: id,
    last_name: "Member",
    persona: "Professional in psychedelics",
    school: null,
    affiliation: null,
    field: null,
    city: "New York",
    state: "NY",
    country: "United States",
    city_lat: 40.7,
    city_lng: -74,
    bio: null,
    interest_tags: [],
    linkedin_url: null,
    avatar_url: `/avatars/${id}.jpg`,
    admin_role: null,
    team: null,
    ...overrides,
  }
}

test("featured member recommendations exclude accepted connections", () => {
  const connected = member("connected", { interest_tags: ["Drug policy"] })
  const eligible = member("eligible", { interest_tags: ["Clinical research"] })

  const recommendations = recommendFeaturedMembers(
    [connected, eligible],
    "viewer",
    viewer,
    new Set(["connected"]),
    "2026-08-31",
  )

  assert.deepEqual(recommendations.map((candidate) => candidate.id), ["eligible"])
})

test("shared interests and background rank ahead of unrelated members", () => {
  const unrelated = member("unrelated")
  const similar = member("similar", {
    persona: viewer.persona,
    school: viewer.school,
    field: viewer.field,
    interest_tags: ["Drug policy"],
  })

  assert.ok(
    featuredMemberSimilarity(similar, viewer)
      > featuredMemberSimilarity(unrelated, viewer),
  )
  assert.equal(
    recommendFeaturedMembers(
      [unrelated, similar],
      "viewer",
      viewer,
      new Set(),
      "2026-08-31",
    )[0].id,
    "similar",
  )
})

test("a complete photo pool is preferred before similarity ranking", () => {
  const noPhotoSharedInterest = member("interest", {
    avatar_url: null,
    interest_tags: ["Drug policy"],
  })
  const photoA = member("photo-a")
  const photoB = member("photo-b", { persona: viewer.persona })
  const photoC = member("photo-c", { field: viewer.field })

  const recommendations = recommendFeaturedMembers(
    [noPhotoSharedInterest, photoA, photoB, photoC],
    "viewer",
    viewer,
    new Set(),
    "2026-08-31",
  )

  assert.deepEqual(
    recommendations.map((candidate) => candidate.id),
    ["photo-b", "photo-c", "photo-a"],
  )
})

test("recommendations fall back to relevant members when fewer than three have photos", () => {
  const noPhotoSharedInterest = member("interest", {
    avatar_url: null,
    interest_tags: ["Drug policy"],
  })
  const photoProfile = member("photo")

  assert.equal(
    recommendFeaturedMembers(
      [photoProfile, noPhotoSharedInterest],
      "viewer",
      viewer,
      new Set(),
      "2026-08-31",
    )[0].id,
    "interest",
  )
})
