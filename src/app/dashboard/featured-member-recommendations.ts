import type { DirectoryMapMember } from "@/lib/directory/types"

export type FeaturedMemberViewer = {
  persona: string | null
  school: string | null
  affiliation: string | null
  field: string | null
  interest_tags: string[] | null
  educationInstitutions?: string[]
}

function normalize(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase() ?? ""
}

function memberSeed(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function relatedTextScore(a: string | null, b: string | null, weight: number) {
  const left = normalize(a)
  const right = normalize(b)
  if (!left || !right) return 0
  if (left === right) return weight
  if (left.includes(right) || right.includes(left)) return Math.ceil(weight / 2)
  return 0
}

export function featuredMemberSimilarity(
  member: DirectoryMapMember,
  viewer: FeaturedMemberViewer,
) {
  const viewerInterests = new Set(
    (viewer.interest_tags ?? []).map(normalize).filter(Boolean),
  )
  const sharedInterests = (member.interest_tags ?? [])
    .map(normalize)
    .filter((interest) => viewerInterests.has(interest)).length

  const viewerBackgrounds = [
    viewer.school,
    viewer.affiliation,
    ...(viewer.educationInstitutions ?? []),
  ].map(normalize).filter(Boolean)
  const memberBackgrounds = [member.school, member.affiliation]
    .map(normalize)
    .filter(Boolean)
  const sharesBackground = memberBackgrounds.some((background) =>
    viewerBackgrounds.includes(background),
  )

  return (
    sharedInterests * 6
    + relatedTextScore(member.persona, viewer.persona, 4)
    + relatedTextScore(member.field, viewer.field, 4)
    + (sharesBackground ? 5 : 0)
  )
}

export function recommendFeaturedMembers(
  members: DirectoryMapMember[],
  currentUserId: string,
  viewer: FeaturedMemberViewer,
  excludedMemberIds: ReadonlySet<string>,
  day = new Date().toISOString().slice(0, 10),
) {
  const eligibleMembers = members.filter(
      (member) =>
        member.id !== currentUserId
        && !excludedMemberIds.has(member.id)
        && Boolean(member.first_name),
    )
  const membersWithPhotos = eligibleMembers.filter((member) => member.avatar_url)
  const recommendationPool = membersWithPhotos.length >= 3
    ? membersWithPhotos
    : eligibleMembers

  return recommendationPool
    .sort((a, b) => {
      const scoreDifference =
        featuredMemberSimilarity(b, viewer) - featuredMemberSimilarity(a, viewer)
      if (scoreDifference !== 0) return scoreDifference

      const photoDifference = Number(Boolean(b.avatar_url)) - Number(Boolean(a.avatar_url))
      if (photoDifference !== 0) return photoDifference

      return (
        memberSeed(`${day}:${currentUserId}:${a.id}`)
        - memberSeed(`${day}:${currentUserId}:${b.id}`)
      )
    })
    .slice(0, 3)
}
