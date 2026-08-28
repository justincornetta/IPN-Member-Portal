import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

import {
  STANDARD_REGISTRATION_DESTINATION,
  registrationDestination,
} from "../src/app/register/registration-destination.ts"
import {
  ACTIVATION_MILESTONE_ORDER,
  activationSummary,
  isProfileMilestoneComplete,
} from "../src/app/dashboard/activation-model.ts"
import {
  PRODUCT_TOUR_STEPS,
  PRODUCT_TOUR_VERSION,
  nextTourProgress,
  parseProductTourProgress,
} from "../src/components/product-tour/tour-state.ts"

test("standard registration starts the progressive onboarding route", () => {
  assert.equal(registrationDestination(""), STANDARD_REGISTRATION_DESTINATION)
  assert.equal(STANDARD_REGISTRATION_DESTINATION, "/onboarding/welcome?motion=editorial")
})

test("event-first registration preserves the complete next destination", () => {
  const destination = "/events/psychedelx-opening?source=public#rsvp"
  assert.equal(registrationDestination(destination), destination)
})

test("welcome onboarding centers its primary continue action", async () => {
  const [welcomeContinue, onboardingStyles] = await Promise.all([
    readFile(new URL("../src/components/onboarding/WelcomeContinue.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/onboarding/onboarding.module.css", import.meta.url), "utf8"),
  ])

  assert.match(welcomeContinue, /className=\{styles\.continueAction\}/)
  assert.match(welcomeContinue, /<Link href=\{destination\}/)
  assert.match(welcomeContinue, /onClick=\{saveWelcomeProgress\}/)
  assert.doesNotMatch(welcomeContinue, /await saveOnboardingFlowProgress/)
  assert.doesNotMatch(welcomeContinue, /router\.push/)
  assert.doesNotMatch(welcomeContinue, /Saving…/)
  assert.match(onboardingStyles, /\.continueAction \{ display: flex; justify-content: center; \}/)
  assert.match(onboardingStyles, /\.featureItem \{[\s\S]*?place-items: center;[\s\S]*?align-content: center;/)
  assert.match(onboardingStyles, /\.featureCopy \{[^}]*justify-items: center;[^}]*align-content: center;/)
  assert.match(onboardingStyles, /grid-template-rows: 42px 84px;/)
  assert.match(onboardingStyles, /grid-template-rows: 30px 54px;/)

  const welcomePage = await readFile(
    new URL("../src/app/onboarding/welcome/page.tsx", import.meta.url),
    "utf8",
  )
  assert.match(
    welcomePage,
    /Find events, useful resources, and the people shaping the future of psychedelic medicine\./,
  )
})

test("dashboard header uses one invite button for the native share flow", async () => {
  const inviteCard = await readFile(
    new URL("../src/components/InviteFriendsCard.tsx", import.meta.url),
    "utf8",
  )
  const headerVariant = inviteCard.slice(
    inviteCard.indexOf("if (isHeader)"),
    inviteCard.indexOf("if (isChecklist)"),
  )

  assert.match(headerVariant, /onClick=\{shareInviteLink\}/)
  assert.match(headerVariant, /Invite Your Friends to IPN/)
  assert.doesNotMatch(headerVariant, /aria-label="Share IPN invite link"/)
  assert.equal(headerVariant.match(/<button/g)?.length, 1)
})

test("activation summary follows durable milestone priority without counting exploration suggestions", () => {
  const summary = activationSummary({
    whatsapp_completed_at: "2026-08-25T12:00:00.000Z",
    profile_completed_at: null,
    product_tour_completed_at: null,
    event_rsvp_completed_at: null,
    connection_request_completed_at: null,
  })

  assert.deepEqual(ACTIVATION_MILESTONE_ORDER, ["whatsapp", "profile", "tour", "participate"])
  assert.deepEqual(summary, {
    completedCount: 1,
    totalCount: 4,
    nextMilestone: "profile",
  })
})

test("activation summary uses authoritative profile progress and advances to events", () => {
  const summary = activationSummary({
    whatsapp_completed_at: "done",
    profile_completed_at: "done",
    product_tour_completed_at: null,
    event_rsvp_completed_at: null,
    connection_request_completed_at: null,
  })

  assert.equal(summary.nextMilestone, "tour")
})

test("continuing past optional WhatsApp keeps profile as the foreground priority", () => {
  const summary = activationSummary({
    whatsapp_current_step: "continued",
    whatsapp_completed_at: null,
    profile_completed_at: null,
    product_tour_completed_at: null,
    event_rsvp_completed_at: null,
    connection_request_completed_at: null,
  })
  assert.equal(summary.completedCount, 0)
  assert.equal(summary.nextMilestone, "profile")
})

test("activation checklist supports explicit WhatsApp self-attestation", async () => {
  const checklist = await readFile(
    new URL("../src/app/dashboard/ActivationChecklist.tsx", import.meta.url),
    "utf8",
  )

  assert.match(checklist, /I’m already in/)
  assert.match(checklist, /Not interested/)
  assert.match(checklist, /completeWhatsAppChoice\("self_attested"\)/)
  assert.match(checklist, /CheckIcon/)
  assert.match(checklist, /Getting started progress/)
  assert.match(checklist, /currentStep: choice/)
  assert.match(checklist, /"not_interested"/)
  assert.match(checklist, /complete: true/)
  assert.match(checklist, /We couldn’t save that confirmation\. Try again\./)
})

test("activation checklist foregrounds the next getting-started action", async () => {
  const checklist = await readFile(
    new URL("../src/app/dashboard/ActivationChecklist.tsx", import.meta.url),
    "utf8",
  )

  assert.match(checklist, /Continue getting started/)
  assert.match(checklist, /nextItem/)
  assert.match(checklist, /Continue setup/)
  assert.match(checklist, /productTourProgress\?\.status === "completed"/)
  assert.match(checklist, /productTourProgress\?\.status === "active"\) return null/)
  assert.match(checklist, /participationCompleted/)
  assert.match(checklist, /role="progressbar"/)
  assert.match(checklist, /summary\.completedCount \/ items\.length/)
  assert.match(checklist, /displayedItem\.completed \? \(/)
  assert.doesNotMatch(checklist, /Back to/)
  assert.doesNotMatch(checklist, /goBack/)
  assert.doesNotMatch(checklist, /resetWhatsAppOnboardingChoice/)
  assert.match(checklist, /ipn_getting_started_success_seen_/)
  assert.match(checklist, /Take the portal tour/)
  assert.match(checklist, /Participate in IPN/)
  assert.match(checklist, /Attend an event, RSVP to a conference, or connect with another member\./)
  assert.match(checklist, /Choose how you’d like to participate/)
  assert.match(checklist, /href="\/dashboard\/events"/)
  assert.match(checklist, /href="\/dashboard\/conferences"/)
  assert.match(checklist, /href="\/dashboard\/directory"/)
  assert.doesNotMatch(checklist, /Invite a friend/)
  assert.doesNotMatch(checklist, /Four quick steps to feel at home/)
  assert.doesNotMatch(checklist, /xl:grid-cols-4/)
})

test("participation completion accepts any active member action", () => {
  for (const participationCompleted of [true]) {
    const summary = activationSummary({
      whatsapp_completed_at: "done",
      profile_completed_at: "done",
      product_tour_completed_at: "done",
      event_rsvp_completed_at: null,
      connection_request_completed_at: null,
      participation_completed: participationCompleted,
    })

    assert.equal(summary.completedCount, 4)
    assert.equal(summary.nextMilestone, null)
  }
})

test("dashboard derives participation from event, conference, or connection records", async () => {
  const dashboard = await readFile(
    new URL("../src/app/dashboard/page.tsx", import.meta.url),
    "utf8",
  )
  const conferenceActions = await readFile(
    new URL("../src/lib/conferences/actions.ts", import.meta.url),
    "utf8",
  )

  assert.match(dashboard, /from\("event_registrations"\)/)
  assert.match(dashboard, /from\("conference_rsvps"\)/)
  assert.match(dashboard, /from\("connections"\)/)
  assert.match(dashboard, /participation_completed: participationCompleted/)
  assert.match(conferenceActions, /markOnboardingStepsComplete\(supabase, user\.id, \["event_rsvp"\]\)/)
})

test("event cancellation deletes the member's RSVP and verifies the affected row", async () => {
  const [actions, schema, migration] = await Promise.all([
    readFile(new URL("../src/lib/events/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../supabase/migrations/20260827233341_allow_members_to_delete_own_event_registrations.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ])

  assert.match(actions, /data: deletedRegistration/)
  assert.match(actions, /\.delete\(\)[\s\S]*?\.select\("event_id"\)[\s\S]*?\.maybeSingle\(\)/)
  assert.match(actions, /if \(!deletedRegistration\)/)
  for (const sql of [schema, migration]) {
    assert.match(sql, /Users can delete own event registrations/)
    assert.match(sql, /for delete[\s\S]*?to authenticated[\s\S]*?auth\.uid\(\)[\s\S]*?user_id/i)
  }
})

test("completed getting-started guidance shows once and then retires", async () => {
  const [checklist, dashboard, actions, migration] = await Promise.all([
    readFile(new URL("../src/app/dashboard/ActivationChecklist.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/onboarding/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260826205032_getting_started_completion_state.sql", import.meta.url), "utf8"),
  ])

  assert.match(checklist, /You&apos;re all set/)
  assert.match(checklist, /markGettingStartedSuccessSeen/)
  assert.match(dashboard, /getting_started_success_seen_at/)
  assert.match(dashboard, /whatsapp_current_step: null/)
  assert.match(dashboard, /showGettingStarted/)
  assert.match(actions, /getting_started_completed_at/)
  assert.match(actions, /return \{ fallback: true \}/)
  assert.match(checklist, /result\.fallback/)
  assert.match(migration, /getting_started_success_seen_at timestamptz/)
})

test("a semantically complete profile satisfies the activation milestone", () => {
  assert.equal(isProfileMilestoneComplete(null, 7, 7), true)
  assert.equal(isProfileMilestoneComplete(null, 6, 7), false)
  assert.equal(isProfileMilestoneComplete("2026-08-26T12:00:00.000Z", 6, 7), true)
  assert.equal(isProfileMilestoneComplete(null, 0, 0), false)
})

test("dashboard surfaces matching 16:9 IPN and community event cards", async () => {
  const upcoming = await readFile(
    new URL("../src/app/dashboard/UpcomingEventsCarousel.tsx", import.meta.url),
    "utf8",
  )
  const dashboard = await readFile(
    new URL("../src/app/dashboard/page.tsx", import.meta.url),
    "utf8",
  )

  assert.match(upcoming, /className="relative block aspect-video/)
  assert.match(upcoming, /Upcoming Events at IPN/)
  assert.match(upcoming, /Community/)
  assert.match(upcoming, /horizons-community-meetup\.png/)
  assert.match(upcoming, /Not registered/)
  assert.match(upcoming, /AddToCalendarButton event=\{calendarEvent\}/)
  assert.match(upcoming, /View event/)
  assert.match(upcoming, /MapPinIcon/)
  assert.match(upcoming, /sm:flex-row sm:items-center sm:justify-between/)
  assert.match(dashboard, /from\("conferences"\)/)
  assert.match(dashboard, /conferences=\{/)
  assert.match(dashboard, /Meet members across IPN/)
  assert.match(dashboard, /featuredMembers/)
  assert.match(dashboard, /Connect with students and professionals across our global network\./)
  assert.doesNotMatch(dashboard, /Go to Community/)
  assert.doesNotMatch(dashboard, /Search by school, field, location/)
})

test("events hub and event detail use the standardized full event layout", async () => {
  const [agenda, eventsPage, eventDetailPage, eventCard, communityEvent] = await Promise.all([
    readFile(new URL("../src/app/dashboard/events/UpcomingAgenda.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/events/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/events/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/events/EventCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/events/CommunityEventDetail.tsx", import.meta.url), "utf8"),
  ])

  assert.match(agenda, /flex flex-col gap-4/)
  assert.match(agenda, /aria-label="Upcoming events"/)
  assert.doesNotMatch(agenda, /<h2/)
  assert.doesNotMatch(agenda, /chronological agenda/)
  assert.doesNotMatch(agenda, /MonthCalendar/)
  assert.match(agenda, /variant="full"/)
  assert.match(agenda, /CommunityEventDetail/)
  assert.match(eventDetailPage, /<EventCard event=\{clientEvent\} variant="full" \/>/)
  assert.match(eventsPage, /Browse past recordings/)
  assert.match(eventsPage, /Browse, RSVP to, and join upcoming IPN Labs and community events, or explore past events\./)
  assert.match(eventCard, /sm:grid-cols-\[220px_1fr\]/)
  assert.ok(eventCard.indexOf("Speakers:") < eventCard.indexOf("Location:"))
  assert.ok(eventCard.indexOf("Cancel RSVP", eventCard.indexOf("!registered")) < eventCard.lastIndexOf("You’re registered"))
  assert.match(eventCard, /You’re registered/)
  assert.match(eventCard, /AddToCalendarButton event=\{event\} compact/)
  assert.match(communityEvent, /sm:grid-cols-\[220px_1fr\]/)
  assert.doesNotMatch(communityEvent, /Speakers:/)
  assert.match(communityEvent, /Location:/)
  assert.match(communityEvent, /community-event-rsvp-/)
  assert.match(communityEvent, /pending \? "Saving\.\.\." : "RSVP"/)
  assert.match(communityEvent, /data-analytics-id=\{`community-event-title-\$\{meetup\.id\}`\}/)
  assert.match(communityEvent, /data-analytics-label="View parent conference"/)
  assert.match(communityEvent, /kind="permanent"[\s\S]*slug="conferences"[\s\S]*label="Join chat"/)
  assert.ok(communityEvent.indexOf('label="Join chat"') < communityEvent.indexOf("Cancel RSVP"))
  assert.match(communityEvent, /Cancel RSVP[\s\S]*You’re registered/)
  assert.doesNotMatch(communityEvent, /View event/)
  assert.match(communityEvent, /AddToCalendarButton/)
  assert.match(communityEvent, /You’re registered/)
  assert.match(eventsPage, /conference_meetup_rsvps/)
})

test("product tour visits only active portal routes in the required sequence", () => {
  assert.equal(
    PRODUCT_TOUR_STEPS.find((step) => step.id === "dashboard")?.description,
    "Get the latest on what's happening at IPN",
  )
  assert.equal(
    PRODUCT_TOUR_STEPS.find((step) => step.id === "events")?.description,
    "Learn more, join upcoming events, and find past event recordings.",
  )
  assert.deepEqual(
    PRODUCT_TOUR_STEPS.map((step) => step.id),
    [
      "dashboard",
      "profile",
      "events",
      "community",
      "conferences",
      "resources",
      "feedback",
      "dashboard-return",
    ],
  )
  assert.deepEqual(
    PRODUCT_TOUR_STEPS.map((step) => step.route),
    [
      "/dashboard",
      "/dashboard/profile",
      "/dashboard/events",
      "/dashboard/directory",
      "/dashboard/conferences",
      "/dashboard/resources",
      "/dashboard/resources",
      "/dashboard",
    ],
  )
})

test("feedback is the seventh of eight tour steps and opens the actual guided form", async () => {
  const [sidebar, provider, feedbackFooter] = await Promise.all([
    readFile(new URL("../src/components/Sidebar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/product-tour/ProductTourProvider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/FeedbackFooter.tsx", import.meta.url), "utf8"),
  ])
  const feedbackStepIndex = PRODUCT_TOUR_STEPS.findIndex((step) => step.id === "feedback")
  const feedbackStep = PRODUCT_TOUR_STEPS[feedbackStepIndex]

  assert.equal(PRODUCT_TOUR_STEPS.length, 8)
  assert.equal(feedbackStepIndex, 6)
  assert.equal(feedbackStep?.title, "Help us improve IPN")
  assert.equal(
    feedbackStep?.description,
    "Your feedback is very valuable to us. Share what’s working and what we can improve.",
  )
  assert.match(sidebar, /data-tour-nav="feedback"/)
  assert.match(provider, /ipn:open-feedback/)
  assert.match(provider, /ipn:close-feedback/)
  assert.match(provider, /data-tour-guided-feedback/)
  assert.doesNotMatch(provider, /ipn:open-mobile-navigation/)
  assert.match(feedbackFooter, /addEventListener\("ipn:close-feedback"/)
  assert.match(feedbackFooter, /setOpen\(false\)/)
})

test("conference tour step explains the available member benefits", () => {
  const conferenceStep = PRODUCT_TOUR_STEPS.find((step) => step.id === "conferences")

  assert.equal(
    conferenceStep?.description,
    "Find upcoming conferences, discounts, see who's attending, and RSVP to IPN meetups.",
  )
})

test("conferences page starts with one primary heading", async () => {
  const conferencesPage = await readFile(
    new URL("../src/app/dashboard/conferences/page.tsx", import.meta.url),
    "utf8",
  )

  assert.equal(conferencesPage.match(/>Conferences<\/h1>/g)?.length, 1)
  assert.doesNotMatch(conferencesPage, />Conferences<\/p>/)
  assert.doesNotMatch(conferencesPage, /sm:mt-1/)
})

test("product tour progress parses safely and remains resumable", () => {
  const stored = JSON.stringify({
    version: PRODUCT_TOUR_VERSION,
    status: "paused",
    stepIndex: 3,
  })
  const progress = parseProductTourProgress(stored)
  assert.deepEqual(progress, {
    version: PRODUCT_TOUR_VERSION,
    status: "paused",
    stepIndex: 3,
  })
  assert.deepEqual(nextTourProgress(progress, 1), {
    version: PRODUCT_TOUR_VERSION,
    status: "active",
    stepIndex: 4,
  })
  assert.equal(parseProductTourProgress('{"status":"active"}'), null)
})

test("product tour keeps fallback progress across dashboard route changes", async () => {
  const [provider, actions] = await Promise.all([
    readFile(new URL("../src/components/product-tour/ProductTourProvider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/onboarding/actions.ts", import.meta.url), "utf8"),
  ])

  assert.match(provider, /result\.error \|\| result\.fallback/)
  assert.match(provider, /serverCompletedAt/)
  assert.match(provider, /serverCurrentStep/)
  assert.match(provider, /serverStartedAt/)
  const moveStart = provider.indexOf("const move = useCallback")
  assert.ok(
    provider.indexOf("router.push(PRODUCT_TOUR_STEPS[next.stepIndex].route)", moveStart)
      < provider.indexOf("persist(next)", moveStart),
    "route navigation should begin before asynchronous progress persistence",
  )
  assert.match(actions, /persistedDurably \? \{\} : \{ fallback: true \}/)
})
