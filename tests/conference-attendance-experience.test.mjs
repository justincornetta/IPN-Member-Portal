import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

test("conference attendance controls share the compact overview footer", () => {
  const overview = read("src/components/conferences/ConferenceDetailOverview.tsx")
  const page = read("src/app/dashboard/conferences/[slug]/page.tsx")
  const interactive = read("src/components/conferences/ConferenceInteractive.tsx")

  assert.match(page, /<ConferenceDetailOverview conference=\{conference\} withAttendance/)
  assert.match(overview, /withAttendance \? "rounded-t-lg border-b-0"/)
  assert.match(interactive, /IPN members attending this conference/)
  assert.match(interactive, /Show me in the conference attendee list/)
  assert.match(interactive, /RSVP to conference/)
  assert.match(interactive, /Hidden members still count toward the total\./)
})

test("meetup attendance has independent RSVP, attendee list, and privacy", () => {
  const interactive = read("src/components/conferences/ConferenceInteractive.tsx")
  const actions = read("src/lib/conferences/actions.ts")
  const queries = read("src/lib/conferences/queries.ts")

  assert.match(interactive, /IPN members going to this meetup/)
  assert.match(interactive, /Show me in the meetup attendee list/)
  assert.match(interactive, /RSVP to meetup/)
  assert.match(interactive, /updateMeetupRsvpVisibility/)
  assert.match(actions, /conference_meetup_rsvps[\s\S]*update\(\{ is_visible: isVisible \}\)/)
  assert.match(queries, /getMeetupAttendeeStates/)
  assert.match(queries, /get_conference_meetup_attendance_counts/)
})

test("meetup cover images open in an accessible enlarged preview", () => {
  const interactive = read("src/components/conferences/ConferenceInteractive.tsx")

  assert.match(interactive, /aria-label=\{`Enlarge \$\{meetup\.title\} image`\}/)
  assert.match(interactive, /role="dialog"/)
  assert.match(interactive, /aria-modal="true"/)
  assert.match(interactive, /event\.key === "Escape"/)
  assert.match(interactive, /if \(event\.target === event\.currentTarget\) onClose\(\)/)
})

test("meetup privacy hides identities without hiding aggregate attendance", () => {
  const migration = read("supabase/migrations/20260901000737_conference_meetup_attendance_privacy.sql")

  assert.match(migration, /is_visible boolean not null default true/)
  assert.match(migration, /\(select auth\.uid\(\)\) = user_id or is_visible = true/)
  assert.match(migration, /for update[\s\S]*using \(\(select auth\.uid\(\)\) = user_id\)[\s\S]*with check \(\(select auth\.uid\(\)\) = user_id\)/)
  assert.match(migration, /count\(\*\) as total_count/)
  assert.match(migration, /count\(\*\) filter \(where r\.is_visible\) as visible_count/)
  assert.match(migration, /function private\.get_conference_meetup_attendance_counts/)
  assert.match(migration, /security invoker/)
  assert.match(migration, /grant execute[\s\S]*to authenticated/)
})
