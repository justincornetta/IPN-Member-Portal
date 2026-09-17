import "server-only"

import snapshot from "./legacy-snapshot.json"
import { buildMemberDirectoryData, type PortalDirectoryProfileRow } from "./member-directory"
import { buildOnboardingAnalyticsData, type OnboardingProgressInput, type ParticipationActivityInput } from "./onboarding"
import { buildPortalUtilizationData, type PortalUtilizationEventInput } from "./portal-utilization"
import type { LegacyAnalyticsSnapshot } from "./types"
import type { MemberInsightsData, PortalAnalyticsEvent } from "@/app/dashboard/admin/AnalyticsDashboardShell"

type ReviewProfile = PortalDirectoryProfileRow & {
  persona: string | null
  school: string | null
  role: string | null
  last_sign_in_at: string | null
  is_banned: boolean
  exclude_from_analytics: boolean
}

const profiles: ReviewProfile[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    first_name: "Avery",
    last_name: "Chen",
    email: "avery.chen@example.test",
    persona: "Graduate student (Master's or PhD)",
    affiliation: "Northstar University",
    school: "Northstar University",
    field: "Science, Technology, Engineering, Mathematics (STEM)",
    interest_tags: ["Research", "Community building"],
    country: "United States",
    state: "Massachusetts",
    city: "Boston",
    city_lat: 42.3601,
    city_lng: -71.0589,
    is_discoverable: true,
    whatsapp_url: "https://wa.me/15550000001",
    psychedelic_field_status: "Yes — I currently work in the field",
    psychedelic_field_barriers: [],
    role_and_goals: "Researcher building community partnerships",
    inspiration: "Peer learning",
    referral_source: "Friend / Colleague",
    mailchimp_status: "subscribed",
    created_at: "2026-05-02T14:00:00Z",
    last_sign_in_at: "2026-09-14T16:30:00Z",
    role: null,
    is_banned: false,
    exclude_from_analytics: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    first_name: "Jordan",
    last_name: "Rivera",
    email: "jordan.rivera@example.test",
    persona: "Professional in another field",
    affiliation: "Harbor Health",
    school: "State College",
    field: "Healthcare & Medicine",
    interest_tags: ["Policy", "Education"],
    country: "United States",
    state: "New York",
    city: "New York",
    city_lat: 40.7128,
    city_lng: -74.006,
    is_discoverable: true,
    whatsapp_url: null,
    psychedelic_field_status: "Not yet — I'm interested in working in the field",
    psychedelic_field_barriers: ["I haven't found the right opportunity yet", "I need more training or education"],
    role_and_goals: "Program manager exploring the field",
    inspiration: "Education",
    referral_source: "Google / Search Engine",
    mailchimp_status: "subscribed",
    created_at: "2026-07-18T18:00:00Z",
    last_sign_in_at: "2026-09-10T12:00:00Z",
    role: null,
    is_banned: false,
    exclude_from_analytics: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    first_name: "Morgan",
    last_name: "Patel",
    email: "morgan.patel@example.test",
    persona: "Undergraduate student",
    affiliation: "Lakeview College",
    school: "Lakeview College",
    field: "Social Sciences",
    interest_tags: ["Student organizing"],
    country: "Canada",
    state: "Ontario",
    city: "Toronto",
    city_lat: 43.6532,
    city_lng: -79.3832,
    is_discoverable: true,
    whatsapp_url: null,
    psychedelic_field_status: "I'm not sure",
    psychedelic_field_barriers: ["I need more information about career paths"],
    role_and_goals: "Student organizer",
    inspiration: "Campus community",
    referral_source: "Social Media",
    mailchimp_status: "subscribed",
    created_at: "2026-08-28T15:00:00Z",
    last_sign_in_at: "2026-09-13T19:00:00Z",
    role: null,
    is_banned: false,
    exclude_from_analytics: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    first_name: "Riley",
    last_name: "Okafor",
    email: "riley.okafor@example.test",
    persona: "Professional in psychedelics",
    affiliation: "Common Ground Lab",
    school: "",
    field: "Nonprofit & Social Impact",
    interest_tags: ["Fundraising", "Research"],
    country: "United Kingdom",
    state: "",
    city: "London",
    city_lat: 51.5072,
    city_lng: -0.1276,
    is_discoverable: false,
    whatsapp_url: "https://wa.me/15550000004",
    psychedelic_field_status: "Yes — I currently work in the field",
    psychedelic_field_barriers: [],
    role_and_goals: "Partnerships lead",
    inspiration: "Collaboration",
    referral_source: "IPN Event",
    mailchimp_status: "subscribed",
    created_at: "2026-09-01T10:00:00Z",
    last_sign_in_at: "2026-09-12T09:30:00Z",
    role: "leadership",
    is_banned: false,
    exclude_from_analytics: false,
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    first_name: "Taylor",
    last_name: "Nguyen",
    email: "taylor.nguyen@example.test",
    persona: "Recent graduate",
    affiliation: "Sunrise Initiative",
    school: "Western Institute",
    field: "Business & Entrepreneurship",
    interest_tags: ["Entrepreneurship"],
    country: "United States",
    state: "California",
    city: "Los Angeles",
    city_lat: 34.0522,
    city_lng: -118.2437,
    is_discoverable: true,
    whatsapp_url: null,
    psychedelic_field_status: "Not yet — I'm interested in working in the field",
    psychedelic_field_barriers: ["I haven't found the right opportunity yet"],
    role_and_goals: "Founder",
    inspiration: "Mentorship",
    referral_source: "Friend / Colleague",
    mailchimp_status: "pending",
    created_at: "2026-09-09T13:00:00Z",
    last_sign_in_at: "2026-09-09T13:15:00Z",
    role: null,
    is_banned: false,
    exclude_from_analytics: false,
  },
]

const onboardingRows: OnboardingProgressInput[] = [
  { user_id: profiles[0].id, whatsapp_current_step: "completed", whatsapp_completed_at: "2026-05-02T14:10:00Z", profile_completed_at: "2026-05-03T14:00:00Z", product_tour_completed_at: "2026-05-04T14:00:00Z", event_rsvp_completed_at: "2026-05-12T14:00:00Z" },
  { user_id: profiles[1].id, whatsapp_current_step: "not_interested", whatsapp_completed_at: "2026-07-18T18:10:00Z", profile_completed_at: "2026-07-20T18:00:00Z", product_tour_completed_at: "2026-07-21T18:00:00Z", event_rsvp_completed_at: null },
  { user_id: profiles[2].id, whatsapp_current_step: "self_attested", whatsapp_completed_at: "2026-08-28T15:10:00Z", profile_completed_at: "2026-08-30T15:00:00Z", product_tour_completed_at: null, event_rsvp_completed_at: null },
  { user_id: profiles[3].id, whatsapp_current_step: "completed", whatsapp_completed_at: "2026-09-01T10:10:00Z", profile_completed_at: "2026-09-02T10:00:00Z", product_tour_completed_at: "2026-09-03T10:00:00Z", event_rsvp_completed_at: null },
  { user_id: profiles[4].id, whatsapp_current_step: "pending", whatsapp_completed_at: null, profile_completed_at: "2026-09-10T13:00:00Z", product_tour_completed_at: null, event_rsvp_completed_at: null },
]

const participationRows: ParticipationActivityInput[] = [
  { id: "p1", user_id: profiles[0].id, activity_type: "portal_event_rsvp", action: "completed", source_system: "event_registrations", source_record_id: "review-1", occurred_at: "2026-05-12T14:00:00Z" },
  { id: "p2", user_id: profiles[0].id, activity_type: "portal_event_rsvp", action: "cancelled", source_system: "event_registrations", source_record_id: "review-1", occurred_at: "2026-05-15T14:00:00Z" },
  { id: "p3", user_id: profiles[3].id, activity_type: "connection_request_sent", action: "completed", source_system: "connections", source_record_id: "review-2", occurred_at: "2026-09-05T10:00:00Z" },
]

const analyticsEvents: PortalUtilizationEventInput[] = profiles.flatMap((profile, index) => {
  const day = String(9 + index).padStart(2, "0")
  return [
    { event_name: "sign_in_success", user_id: profile.id, session_id: `session-${index}`, page_path: "/dashboard", target_id: null, target_label: null, error_code: null, duration_seconds: null, click_count: null, metadata: { device_type: index % 2 ? "mobile" : "desktop" }, occurred_at: `2026-09-${day}T12:00:00Z` },
    { event_name: "curated_click", user_id: profile.id, session_id: `session-${index}`, page_path: "/dashboard/resources", target_id: `resource-detail-${index}`, target_label: "Open resource", error_code: null, duration_seconds: 42, click_count: 1, metadata: { device_type: index % 2 ? "mobile" : "desktop" }, occurred_at: `2026-09-${day}T12:05:00Z` },
  ]
})

function syntheticIdentity(index: number) {
  return {
    name: `Review Attendee ${index + 1}`,
    email: `attendee${index + 1}@example.test`,
  }
}

function sanitizedSnapshot(): LegacyAnalyticsSnapshot {
  const review = JSON.parse(JSON.stringify(snapshot)) as LegacyAnalyticsSnapshot
  review.generatedAt = "2026-09-15T12:00:00Z"
  review.members.formRows = []
  review.events.zoom.topAttendees = review.events.zoom.topAttendees.map((row, index) => ({
    ...row,
    ...syntheticIdentity(index),
  }))
  review.events.zoom.events = review.events.zoom.events.map((event, eventIndex) => ({
    ...event,
    topic: `Synthetic Zoom Event ${eventIndex + 1}`,
    participantEmails: event.participantEmails.map((_, index) => syntheticIdentity(index).email),
    participants: event.participants.map((participant, index) => ({ ...participant, ...syntheticIdentity(index) })),
    registrations: event.registrations.map((registration, index) => ({ ...registration, ...syntheticIdentity(index) })),
  }))
  review.events.zoom.upcomingEvents = review.events.zoom.upcomingEvents.map((event, eventIndex) => ({
    ...event,
    topic: `Synthetic Upcoming Zoom Event ${eventIndex + 1}`,
    registrations: event.registrations.map((registration, index) => ({ ...registration, ...syntheticIdentity(index) })),
  }))
  return review
}

export function buildAnalyticsReviewFixture() {
  const memberDirectory = buildMemberDirectoryData({ profiles, legacyRows: [], latestImport: null, geocodes: [] })
  const portalUtilization = buildPortalUtilizationData({
    analyticsEvents,
    analyticsError: null,
    profiles,
    onboardingRows,
    participationRows,
    attendanceRows: [{ user_id: profiles[1].id, occurred_at: "2026-09-11T18:00:00Z", source_record_id: "zoom-review-1" }],
    now: new Date("2026-09-15T12:00:00Z"),
  })
  const onboardingAnalytics = buildOnboardingAnalyticsData({
    profiles,
    progressRows: onboardingRows,
    participationRows,
    now: new Date("2026-09-15T12:00:00Z"),
  })
  const memberInsights: MemberInsightsData = {
    total: profiles.length,
    discoverable: profiles.filter((profile) => profile.is_discoverable).length,
    withTags: profiles.filter((profile) => profile.interest_tags?.length).length,
    whatsappLinked: profiles.filter((profile) => profile.whatsapp_url).length,
    whatsappOnboardingComplete: onboardingRows.filter((row) => row.whatsapp_completed_at).length,
    registrationTrend: [
      { month: "2026-05", registrations: 1, cumulative: 1 },
      { month: "2026-07", registrations: 1, cumulative: 2 },
      { month: "2026-08", registrations: 1, cumulative: 3 },
      { month: "2026-09", registrations: 2, cumulative: 5 },
    ],
    personaItems: [],
    fieldItems: [],
    topTags: [],
    topSchools: [],
    topCountries: [],
    profiles,
    recent: [],
    memberDirectory,
  }
  const portalEvents: PortalAnalyticsEvent[] = [{
    id: "review-event-1",
    title: "Synthetic Community Roundtable",
    slug: "synthetic-community-roundtable",
    startsAt: "2026-09-20T18:00:00Z",
    eventType: "public",
    status: "published",
    externalEventId: null,
    registrationCount: 2,
    totalRegistrationsEver: 2,
    cancellationCount: 0,
    lastRsvpAt: "2026-09-10T12:00:00Z",
    registrations: profiles.slice(0, 2).map((profile) => ({
      userId: profile.id,
      memberName: `${profile.first_name} ${profile.last_name}`,
      memberEmail: profile.email ?? "",
      registeredAt: "2026-09-10T12:00:00Z",
    })),
  }]

  return {
    memberInsights,
    portalUtilization,
    onboardingAnalytics,
    analyticsSnapshot: sanitizedSnapshot(),
    mailchimpAnalytics: {
      available: true,
      contacts: [
        { audienceId: "members", audienceName: "IPN Members", subscriberHash: "review-contact-1", status: "subscribed" },
        { audienceId: "members", audienceName: "IPN Members", subscriberHash: "review-contact-2", status: "subscribed" },
        { audienceId: "members", audienceName: "IPN Members", subscriberHash: "review-contact-3", status: "unsubscribed" },
      ],
      events: [
        { audienceId: "members", audienceName: "IPN Members", subscriberHash: "review-contact-1", newStatus: "subscribed", occurredAt: "2026-09-03T10:00:00Z", source: "initial_backfill" },
        { audienceId: "members", audienceName: "IPN Members", subscriberHash: "review-contact-3", newStatus: "unsubscribed", occurredAt: "2026-09-07T10:00:00Z", source: "daily_reconciliation" },
      ],
      firstSyncedAt: "2026-09-15T10:00:00Z",
      lastSyncedAt: "2026-09-15T10:00:00Z",
    },
    portalEvents,
  }
}
