import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

test("conference cover images are persisted for upcoming and past conferences", () => {
  const migration = read("supabase/migrations/20260825195019_add_conference_cover_images.sql")
  const actions = read("src/lib/admin/conference-actions.ts")
  const queries = read("src/lib/conferences/queries.ts")

  assert.match(migration, /alter table public\.conferences[\s\S]*cover_image_url text/)
  assert.match(migration, /alter table public\.past_conferences[\s\S]*cover_image_url text/)
  assert.equal((actions.match(/cover_image_url/g) ?? []).length >= 4, true)
  assert.equal((queries.match(/cover_image_url/g) ?? []).length >= 2, true)
})

test("both admin conference forms expose the shared 16:9 cover-photo control", () => {
  const form = read("src/app/dashboard/admin/ContentIntakeForm.tsx")

  assert.equal((form.match(/label="Cover photo"/g) ?? []).length, 2)
  assert.equal((form.match(/value=\{f\.coverImageUrl\}/g) ?? []).length, 2)
  assert.match(form, /aspect=\{16 \/ 9\}/)
  assert.match(form, /canvas\.width = 1280/)
  assert.match(form, /canvas\.height = 720/)
})

test("conference cards and detail pages share a responsive 16:9 renderer", () => {
  const cover = read("src/components/conferences/ConferenceCover.tsx")
  const upcomingCard = read("src/components/conferences/ConferenceCard.tsx")
  const pastCard = read("src/components/conferences/PastConferenceCard.tsx")
  const detailPage = read("src/app/dashboard/conferences/[slug]/page.tsx")
  const detailOverview = read("src/components/conferences/ConferenceDetailOverview.tsx")

  assert.match(cover, /aspect-video/)
  assert.match(cover, /className="object-cover"/)
  assert.match(upcomingCard, /conference\.cover_image_url/)
  assert.match(pastCard, /conference\.cover_image_url/)
  assert.match(detailPage, /<ConferenceDetailOverview conference=\{conference\}/)
  assert.match(detailOverview, /conference\.cover_image_url/)
})

test("conference admin previews reuse member portal cards and detail content", () => {
  const form = read("src/app/dashboard/admin/ContentIntakeForm.tsx")
  const interactive = read("src/components/conferences/ConferenceInteractive.tsx")

  assert.match(form, /<ConferenceCard conference=\{conference\} preview/)
  assert.match(form, /<ConferenceDetailOverview conference=\{conference\} preview/)
  assert.match(form, /<ConferenceInteractivePreview/)
  assert.match(form, /<PastConferenceCard conference=\{conference\} preview/)
  assert.match(interactive, /preview \|\| meetupPendingId === meetup\.id/)
  assert.match(form, /label: "Member portal"/)
  assert.match(form, /label: "Member email"/)
  assert.match(form, /label: "Conference card"/)
  assert.match(form, /label: "Detail page"/)
  assert.match(form, /label: "Mobile"/)
  assert.match(form, /label: "Desktop"/)
})

test("saved meetup and discount messages remain visible without claiming they will resend", () => {
  const form = read("src/app/dashboard/admin/ContentIntakeForm.tsx")

  assert.match(form, /function configuredConferenceEmailPreviews/)
  assert.match(form, /configuredEmailPreviews\.filter/)
  assert.match(form, /Configured message previews/)
  assert.match(form, /Editing a saved item does not send its alert again/)
  assert.match(form, /Saving these edits will not queue a new member email/)
})
