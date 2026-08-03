import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

import {
  educationLevelForPersona,
  normalizeInstitutionName,
  validateEducationEntries,
} from "../src/lib/members/education.ts"
import {
  canonicalMemberField,
  canonicalMemberPersona,
  canonicalPsychedelicFieldStatus,
  canonicalReferralSource,
} from "../src/lib/admin/analytics/normalization.ts"
import {
  FIELD_OPTIONS,
  FIELD_STATUS_OPTIONS,
  canonicalPsychedelicFieldBarrier,
  PERSONA_OPTIONS,
  REFERRAL_OPTIONS,
} from "../src/lib/constants/registration.ts"
import {
  buildAnalyticsGeocodeLookup,
  resolveAnalyticsLocation,
} from "../src/lib/admin/analytics/geography.ts"
import { buildCarriedSocialTrend } from "../src/lib/admin/analytics/social-trend.ts"
import {
  buildCountryMemberGeography,
  buildFilteredMemberGeography,
  cityMemberGeography,
  memberGeographyCoverage,
  membershipGeographyKey,
} from "../src/lib/admin/analytics/membership-geography.ts"
import { assembleServerEventAnalytics } from "../src/lib/admin/analytics/events.ts"
import {
  buildOtherVariantItems,
  OTHER_WITHOUT_DETAILS,
} from "../src/lib/admin/analytics/other-variants.ts"
import {
  buildFocusedPortalJourneyFlow,
  buildPortalJourneyFlow,
  buildPortalUtilizationData,
  buildRegistrationStepFlow,
  portalPageCategory,
} from "../src/lib/admin/analytics/portal-utilization.ts"
import { validateAndMergeAnalyticsSnapshot } from "../scripts/validate-analytics-snapshot.mjs"

const PERSONA_MIGRATION_SQL = readFileSync(
  new URL("../supabase/migrations/20260730195316_align_personas_with_registration_labels.sql", import.meta.url),
  "utf8",
)

function snapshotFixture({ sessions = 826, donations = false } = {}) {
  return {
    generatedAt: "2026-07-07T12:00:00Z",
    dashboardRepo: ".",
    dataSources: [
      { id: "website", label: "Website / GA4", status: "success", mode: "API", lastPull: "2026-07-07T12:00:00Z", note: "good" },
      { id: "instagram", label: "Instagram", status: "success", mode: "API", lastPull: "2026-07-07T12:00:00Z", note: "good" },
      { id: "facebook", label: "Facebook", status: "success", mode: "API", lastPull: "2026-07-07T12:00:00Z", note: "good" },
      ...(donations ? [{ id: "donations", label: "Donations", status: "success", mode: "API", lastPull: "2026-07-07T12:00:00Z", note: "legacy" }] : []),
    ],
    overview: { kpis: [], channelHealth: [], insights: [] },
    members: {},
    marketing: { summary: { totalSubscribers: 100 }, lists: [], monthly: [], growth: [], campaigns: [] },
    social: {
      platforms: [
        { id: "instagram", label: "Instagram", followers: 10, engagementRate: 1, postsThisMonth: 1, status: "live", updatedAt: "2026-07-07" },
        { id: "facebook", label: "Facebook", followers: 20, engagementRate: 1, postsThisMonth: 1, status: "live", updatedAt: "2026-07-07" },
      ],
      history: [
        { date: "2026-07-07", month: "2026-07", channel: "instagram", followers: 10, engagementRate: 1, posts: 1 },
        { date: "2026-07-07", month: "2026-07", channel: "facebook", followers: 20, engagementRate: 1, posts: 1 },
      ],
      instagramPosts: [],
    },
    website: {
      overview: { sessions_30d: sessions },
      trend: sessions ? [{ month: "2026-07", sessions, users: 1, pageviews: 1, bounceRate: 0, avgDuration: 1, newUsers: 1 }] : [],
      dailyTrend: [], devices: sessions ? [{ label: "desktop", sessions, users: 1 }] : [],
      channels: sessions ? [{ label: "Direct", sessions, users: 1 }] : [],
      sources: [], countries: [], cities: [], pages: sessions ? [{ path: "/", title: "Home", pageviews: 1, users: 1, avgDuration: 1, bounceRate: 0 }] : [],
      funnels: [], outboundClicks: [], blog: [], pulledAt: "2026-07-07T12:00:00Z",
    },
    events: {
      zoom: {
        stats: { totalEvents: 0, totalParticipants: 0, avgParticipants: 0, avgAttendanceRate: 0, avgRetentionPct: 0, avgDurationMin: 0, repeatRatePct: 0, uniqueAttendees: 0, pulledAt: null },
        byMonth: [], topAttendees: [], events: [], upcomingEvents: [],
      },
      eventbrite: { summary: { totalEvents: 0, ticketsSold: 0, grossRevenue: 0, activeEvents: 0, upcomingEvents: 0, pulledAt: null }, events: [] },
    },
  }
}

test("canonical member aliases collapse historical wording and punctuation", () => {
  assert.equal(canonicalMemberPersona("Undergraduate Student (B.A./B.S.)"), "Undergraduate student")
  assert.equal(canonicalMemberPersona("Graduate Student (Master's or PhD)"), "Graduate student (Master's or PhD)")
  assert.equal(canonicalMemberPersona("Graduate Student (M.A./M.S./Ph.D/MBA)"), "Graduate student (Master's or PhD)")
  assert.equal(canonicalMemberPersona("Professional Student (M.D./J.D./D.O)"), "Professional degree student (MD, JD, MBA, etc.)")
  assert.equal(canonicalMemberPersona("Professional degree student (MD, JD, MBA, etc.)"), "Professional degree student (MD, JD, MBA, etc.)")
  assert.equal(canonicalMemberPersona("Current Industry Professional"), "Professional in psychedelics")
  assert.equal(canonicalMemberPersona("Professional in a related field (e.g., healthcare, education, nonprofit, tech, law)"), "Professional in another field")
  assert.equal(canonicalMemberPersona("Faculty"), "Other")
  assert.ok(PERSONA_OPTIONS.some((option) => option.value === canonicalMemberPersona("Current Industry Professional")))
  for (const option of PERSONA_OPTIONS) {
    assert.equal(canonicalMemberPersona(option.value), option.value)
  }

  assert.equal(canonicalMemberField("Science, Technology, Engineering, & Mathematics"), "Science, Technology, Engineering, Mathematics (STEM)")
  assert.equal(canonicalMemberField("Law and Policy"), "Law & Policy")
  assert.equal(canonicalMemberField("Trade and Personal Services"), "Skilled Trades & Personal Services")
  for (const option of FIELD_OPTIONS) {
    assert.equal(canonicalMemberField(option), option)
  }

  assert.equal(canonicalReferralSource("A Friend/Colleague"), "Friend / Colleague")
  assert.equal(canonicalReferralSource("Friend/Colleague"), "Friend / Colleague")
  assert.equal(canonicalReferralSource("Google/Search Engine"), "Google / Search Engine")
  assert.equal(canonicalReferralSource("The Psychedelic Handbook by Rick Strassman"), "Other")
  assert.ok(REFERRAL_OPTIONS.includes(canonicalReferralSource("A Friend/Colleague")))
  for (const option of REFERRAL_OPTIONS) {
    assert.equal(canonicalReferralSource(option), option)
  }

  assert.equal(canonicalPsychedelicFieldStatus("Not yet – I’m interested in working in the field"), "Not yet — I'm interested in working in the field")
  for (const option of FIELD_STATUS_OPTIONS) {
    assert.equal(canonicalPsychedelicFieldStatus(option), option)
  }
  assert.equal(canonicalPsychedelicFieldBarrier("I haven’t found the right opportunity yet"), "I haven't found the right opportunity yet")
  assert.equal(canonicalPsychedelicFieldBarrier("I am balancing crisis management work right now"), "Other")
})

test("registration persona values match the database constraint", () => {
  const constraintStart = PERSONA_MIGRATION_SQL.lastIndexOf(
    "profiles_persona_registration_values_check",
  )
  assert.notEqual(constraintStart, -1)

  const constraintSql = PERSONA_MIGRATION_SQL.slice(constraintStart)
  const arrayMatch = constraintSql.match(/array\[(.*?)\]\s*\)\s*\)/s)
  assert.ok(arrayMatch, "profiles persona constraint must define an allowed-values array")

  const databaseValues = [...arrayMatch[1].matchAll(/'((?:''|[^'])*)'/g)]
    .map((match) => match[1].replaceAll("''", "'"))
  const registrationValues = PERSONA_OPTIONS.map((option) => option.value)

  assert.deepEqual(registrationValues, databaseValues)
  for (const option of PERSONA_OPTIONS) {
    assert.equal(option.value, option.label)
  }
})

test("education validation enforces profile education requirements", () => {
  assert.match(validateEducationEntries([], { required: true }), /at least one/i)
  assert.equal(validateEducationEntries([{
    institution: "Princeton University",
    education_level: "undergraduate",
    degree_credential: "BA",
    area_of_study: "Neuroscience",
    status: "completed",
    graduation_year: 2024,
  }], { required: true }), null)
  assert.equal(educationLevelForPersona("Graduate student (Master's or PhD)"), "graduate")
  assert.equal(
    normalizeInstitutionName("University of Pennsylvania"),
    normalizeInstitutionName("  University of Pennsylvania  "),
  )
  assert.equal(
    normalizeInstitutionName("William & Mary"),
    normalizeInstitutionName("William and Mary"),
  )
})

test("other category drill-down groups raw variants without crowding charts", () => {
  assert.deepEqual(buildOtherVariantItems([
    { canonicalLabel: "Other", rawValues: ["Aspiring Student"] },
    { canonicalLabel: "Other", rawValues: ["Aspiring Student"] },
    { canonicalLabel: "Other", rawValues: ["Other"] },
    { canonicalLabel: "Other", rawValues: [] },
    { canonicalLabel: "Undergraduate student", rawValues: ["Undergraduate Student (B.A./B.S.)"] },
  ]), [
    { label: "Aspiring Student", value: 2 },
    { label: OTHER_WITHOUT_DETAILS, value: 2 },
  ])
})

test("country centroids map Germany when a city coordinate is unavailable", () => {
  const lookup = buildAnalyticsGeocodeLookup([{
    city: null,
    state: null,
    country: "Germany",
    latitude: 51.1657,
    longitude: 10.4515,
    precision: "country",
  }])
  assert.deepEqual(resolveAnalyticsLocation(lookup, "Hamburg", "", "Germany"), {
    lat: 51.1657,
    lng: 10.4515,
  })
})

function geographyMemberRow({ id, city = "", state = "", country }) {
  return {
    id,
    normalizedEmail: `${id}@example.com`,
    portalId: null,
    legacyId: id,
    name: id,
    email: `${id}@example.com`,
    location: [city, state, country].filter(Boolean).join(", "),
    city,
    state,
    country,
    persona: "",
    selfDescription: "",
    primaryField: "-",
    psychedelicFieldStatus: "",
    psychedelicFieldBarriers: [],
    referralSource: "",
    rawCategoryResponses: { persona: [], primaryField: [], psychedelicFieldStatus: [], psychedelicFieldBarriers: [], referralSource: [] },
    school: "",
    schools: [],
    interestTags: [],
    firstSeenAt: null,
    firstSeenSource: "",
    firstSeenConfidence: "high",
    sources: { portal: false, form: true, mailchimp: false, oldapp: false },
    sourceCount: 1,
    channelsPresent: "Google Form",
    whatsappConnected: false,
    portalDiscoverable: null,
    portalInterestTagCount: 0,
    mailchimpStatus: "unknown",
    eventCount: 0,
    engagementStatus: "",
  }
}

function geographyLocation({ city, state = "", country, lat = null, lng = null, countryLat = null, countryLng = null, coordinatePrecision = null }) {
  return {
    id: [city, state, country].map((part) => part.toLowerCase()).join("|"),
    city,
    state,
    country,
    lat,
    lng,
    countryLat,
    countryLng,
    coordinatePrecision,
    memberCount: 1,
    identifiableCount: 1,
    sourceCounts: [{ id: "form", label: "Google Form", value: 1 }],
    members: [],
  }
}

function geographyDirectory(geography) {
  return {
    geography,
    sourceTotals: [{ id: "form", label: "Google Form", value: geography.length }],
  }
}

test("country geography includes country-only members while city geography does not invent cities", () => {
  const rows = [
    geographyMemberRow({ id: "berlin", city: "Berlin", state: "Berlin", country: "Germany" }),
    geographyMemberRow({ id: "puerto-rico", country: "Puerto Rico" }),
    geographyMemberRow({ id: "placeholder", city: "*City", state: "Prague 5", country: "Czech Republic" }),
  ]
  const geography = [
    geographyLocation({ city: "Berlin", state: "Berlin", country: "Germany", lat: 51.1657, lng: 10.4515, countryLat: 51.1657, countryLng: 10.4515, coordinatePrecision: "country" }),
    geographyLocation({ city: "Unknown city", country: "Puerto Rico", lat: 18.2208, lng: -66.5901, countryLat: 18.2208, countryLng: -66.5901, coordinatePrecision: "country" }),
    geographyLocation({ city: "*City", state: "Prague 5", country: "Czech Republic", lat: 49.8175, lng: 15.473, countryLat: 49.8175, countryLng: 15.473, coordinatePrecision: "country" }),
  ]
  const filtered = buildFilteredMemberGeography(rows, geographyDirectory(geography))
  const cities = cityMemberGeography(filtered)
  const countries = buildCountryMemberGeography(filtered)

  assert.equal(filtered.reduce((sum, location) => sum + location.memberCount, 0), 3)
  assert.equal(cities.length, 1)
  assert.equal(countries.length, 3)
  assert.equal(countries.find((location) => location.country === "Puerto Rico").memberCount, 1)
  assert.deepEqual(memberGeographyCoverage(countries), {
    totalLocations: 3,
    mappedLocations: 3,
    unmappedLocations: 0,
    totalMembers: 3,
    mappedMembers: 3,
    unmappedMembers: 0,
    countryFallbackLocations: 3,
    percent: 100,
  })
})

test("membership geography collapses safe city aliases and inferred missing states", () => {
  const rows = [
    geographyMemberRow({ id: "montreal-accented", city: "Montréal", state: "Quebec", country: "Canada" }),
    geographyMemberRow({ id: "montreal-plain", city: "Montreal", state: "Quebec", country: "Canada" }),
    geographyMemberRow({ id: "saint", city: "Saint Augustine", state: "Florida", country: "United States" }),
    geographyMemberRow({ id: "st", city: "St. Augustine", state: "Florida", country: "United States" }),
    geographyMemberRow({ id: "sf", city: "San Francisco", state: "California", country: "United States" }),
    geographyMemberRow({ id: "sf-county", city: "City and County of San Francisco", state: "California", country: "United States" }),
    geographyMemberRow({ id: "maastricht-state", city: "Maastricht", state: "Limburg", country: "Netherlands" }),
    geographyMemberRow({ id: "maastricht-empty", city: "Maastricht", country: "Netherlands" }),
  ]
  const geography = rows.map((row) => geographyLocation({ city: row.city, state: row.state, country: row.country }))
  const filtered = buildFilteredMemberGeography(rows, geographyDirectory(geography))

  assert.equal(filtered.length, 4)
  assert.equal(filtered.find((location) => location.id === membershipGeographyKey("Montreal", "Quebec", "Canada")).memberCount, 2)
  assert.equal(filtered.find((location) => location.id === membershipGeographyKey("Maastricht", "Limburg", "Netherlands")).memberCount, 2)
})

test("country markers prefer an explicit country centroid over a weighted city point", () => {
  const countries = buildCountryMemberGeography([
    geographyLocation({ city: "Philadelphia", state: "Pennsylvania", country: "United States", lat: 39.95, lng: -75.16, coordinatePrecision: "city" }),
    geographyLocation({ city: "Unknown city", country: "United States", lat: 39.83, lng: -98.58, countryLat: 39.83, countryLng: -98.58, coordinatePrecision: "country" }),
  ])
  assert.equal(countries[0].memberCount, 2)
  assert.equal(countries[0].lat, 39.83)
  assert.equal(countries[0].lng, -98.58)
  assert.equal(countries[0].coordinatePrecision, "country")
})

test("social history carries platform values and starts total after all baselines exist", () => {
  const rows = buildCarriedSocialTrend({
    points: [
      { period: "2026-07-09", channel: "instagram", followers: 10, engagementRate: 1, posts: 1, timestamp: 1 },
      { period: "2026-07-09", channel: "facebook", followers: 20, engagementRate: 1, posts: 1, timestamp: 1 },
      { period: "2026-07-10", channel: "instagram", followers: 11, engagementRate: 1, posts: 1, timestamp: 2 },
      { period: "2026-07-10", channel: "linkedin", followers: 30, engagementRate: 0, posts: 0, timestamp: 2 },
    ],
    channels: ["instagram", "facebook", "linkedin"],
    metric: "followers",
    includeTotal: true,
  })
  assert.equal(rows[0].total, null)
  assert.equal(rows[1].facebook, 20)
  assert.equal(rows[1].total, 61)
})

test("portal utilization resolves member type, rolling activity, errors, pages, and journeys", () => {
  const event = (event_name, session_id, occurred_at, overrides = {}) => ({
    event_name,
    session_id,
    occurred_at,
    user_id: null,
    page_path: null,
    target_id: null,
    target_label: null,
    error_code: null,
    duration_seconds: null,
    click_count: null,
    metadata: { deviceType: "desktop" },
    ...overrides,
  })
  const memberId = "00000000-0000-0000-0000-000000000001"
  const leaderId = "00000000-0000-0000-0000-000000000002"
  const result = buildPortalUtilizationData({
    now: new Date("2026-07-15T12:00:00Z"),
    analyticsError: null,
    profiles: [
      {
        id: memberId,
        first_name: "Member",
        last_name: "One",
        email: "member@example.com",
        role: null,
        whatsapp_url: "https://wa.me/15555555555",
        created_at: "2026-07-01T12:00:00Z",
        last_sign_in_at: "2026-07-14T12:00:00Z",
        mailchimp_status: "subscribed",
      },
      {
        id: leaderId,
        first_name: "Leader",
        last_name: "One",
        email: "leader@example.com",
        role: "admin",
        whatsapp_url: null,
        created_at: "2026-07-02T12:00:00Z",
        last_sign_in_at: "2026-07-11T10:01:00Z",
        mailchimp_status: "unsubscribed",
      },
    ],
    onboardingRows: [],
    connections: [{
      requester_id: memberId,
      addressee_id: leaderId,
      status: "accepted",
    }],
    analyticsEvents: [
      event("page_view", "member-session", "2026-07-10T10:00:00Z", { page_path: "/login" }),
      event("sign_in_success", "member-session", "2026-07-10T10:01:00Z", { page_path: "/login", user_id: memberId }),
      event("page_view", "member-session", "2026-07-10T10:02:00Z", { page_path: "/dashboard", user_id: memberId }),
      event("page_view", "member-session", "2026-07-10T10:02:30Z", { page_path: "/dashboard", user_id: memberId }),
      event("page_duration", "member-session", "2026-07-10T10:03:00Z", {
        page_path: "/dashboard",
        user_id: memberId,
        click_count: 1,
        duration_seconds: 80,
      }),
      event("session_summary", "member-session", "2026-07-10T10:03:30Z", {
        page_path: "/dashboard",
        user_id: memberId,
        click_count: 1,
        duration_seconds: 95,
      }),
      event("curated_click", "member-session", "2026-07-10T10:04:00Z", {
        page_path: "/dashboard",
        user_id: memberId,
        target_id: "sidebar-feedback-open",
        target_label: "Feedback",
      }),
      event("page_view", "leader-session", "2026-07-11T10:00:00Z", { page_path: "/login" }),
      event("sign_in_success", "leader-session", "2026-07-11T10:01:00Z", { page_path: "/login", user_id: leaderId }),
      event("page_view", "leader-session", "2026-07-11T10:02:00Z", { page_path: "/dashboard/directory", user_id: leaderId }),
      event("page_duration", "leader-session", "2026-07-11T10:03:00Z", {
        page_path: "/dashboard/directory",
        user_id: leaderId,
        click_count: 1,
        duration_seconds: 30,
      }),
      event("sign_in_error", "failed-session", "2026-07-12T10:00:00Z", { page_path: "/login", error_code: "Invalid login credentials" }),
      event("page_view", "registration-session", "2026-07-13T09:59:00Z", { page_path: "/" }),
      event("page_view", "registration-session", "2026-07-13T10:00:00Z", { page_path: "/register" }),
      event("registration_step_view", "registration-session", "2026-07-13T10:00:01Z", { page_path: "/register", metadata: { deviceType: "desktop", step: 1, stepLabel: "Account" } }),
      event("registration_step_view", "registration-session", "2026-07-13T10:00:10Z", { page_path: "/register", metadata: { deviceType: "desktop", step: 2, stepLabel: "Location" } }),
      event("registration_step_view", "registration-session", "2026-07-13T10:00:20Z", { page_path: "/register", metadata: { deviceType: "desktop", step: 3, stepLabel: "Background" } }),
      event("registration_step_view", "registration-session", "2026-07-13T10:00:30Z", { page_path: "/register", metadata: { deviceType: "desktop", step: 4, stepLabel: "About You" } }),
      event("registration_submit", "registration-session", "2026-07-13T10:00:50Z", { page_path: "/register" }),
      event("registration_success", "registration-session", "2026-07-13T10:01:00Z", { page_path: "/register", user_id: memberId }),
      event("page_view", "registration-session", "2026-07-13T10:02:00Z", { page_path: "/dashboard/events", user_id: memberId }),
      event("page_duration", "registration-session", "2026-07-13T10:02:42Z", {
        page_path: "/dashboard/events",
        user_id: memberId,
        duration_seconds: 42,
      }),
    ],
  })

  assert.equal(result.funnel.find((row) => row.date === "2026-07-10" && row.audience === "member" && row.device === "all")?.signInTraffic, 1)
  assert.equal(result.funnel.find((row) => row.date === "2026-07-11" && row.audience === "leadership" && row.device === "all")?.signInCompleted, 1)
  assert.equal(result.monthlyActiveUsers.find((row) => row.date === "2026-07-15" && row.audience === "all" && row.device === "all")?.users, 2)
  assert.equal(result.monthlyActiveUsers.find((row) => row.date === "2026-07-15" && row.audience === "all" && row.device === "all")?.members.find((member) => member.userId === memberId)?.uniqueSessions, 2)
  assert.equal(result.pageViews.find((row) => row.date === "2026-07-10" && row.page === "Dashboard" && row.audience === "member" && row.device === "all")?.views, 1)
  assert.equal(result.pageViews.find((row) => row.page === "Feedback" && row.audience === "member" && row.device === "all")?.views, 1)
  assert.equal(result.errors.filter((row) => row.audience === "member").length, 0)
  assert.equal(result.errors.find((row) => row.audience === "all")?.count, 1)
  assert.equal(result.journeys.length, 3)
  const registrationFlowRow = result.registrationFlow.rows.find((row) => (
    row.date === "2026-07-13" && row.device === "all" && row.audience === "all"
  ))
  assert.deepEqual(registrationFlowRow && {
    home: registrationFlowRow.home,
    account: registrationFlowRow.account,
    location: registrationFlowRow.location,
    background: registrationFlowRow.background,
    about: registrationFlowRow.about,
    completed: registrationFlowRow.completed,
  }, {
    home: 1,
    account: 1,
    location: 1,
    background: 1,
    about: 1,
    completed: 1,
  })
  const registrationStepFlow = buildRegistrationStepFlow(registrationFlowRow)
  assert.equal(registrationStepFlow.nodes.find((node) => node.label === "Registration completed")?.sessions, 1)
  assert.equal(registrationStepFlow.links.length, 5)
  assert.equal(result.journeys.find((journey) => journey.startType === "registration")?.steps.at(-1)?.label, "Events")
  assert.equal(result.journeys.find((journey) => journey.sessionId === "member-session")?.durationSeconds, 95)
  assert.equal(
    result.journeys
      .find((journey) => journey.sessionId === "member-session")
      ?.steps.find((step) => step.label === "Dashboard")
      ?.durationSeconds,
    95,
  )
  assert.equal(
    result.journeys
      .find((journey) => journey.sessionId === "member-session")
      ?.steps.find((step) => step.label === "Feedback")
      ?.durationSeconds,
    null,
  )
  assert.equal(result.journeys.find((journey) => journey.startType === "registration")?.durationSeconds, 42)
  const memberActivity = result.members.find((member) => member.userId === memberId)
  assert.equal(memberActivity?.firstRegisteredAt, "2026-07-01T12:00:00Z")
  assert.equal(memberActivity?.signInActivity.all.lastSignedInAt, "2026-07-14T12:00:00Z")
  assert.equal(memberActivity?.signInActivity.all.signInsLast30Days, 1)
  assert.equal(memberActivity?.connectionCount, 1)
  assert.equal(memberActivity?.whatsappConnected, true)
  assert.equal(memberActivity?.mailchimpStatus, "subscribed")
  assert.equal(portalPageCategory("/dashboard/conferences/horizons-2026"), "Conferences")

  const signInFlow = buildPortalJourneyFlow(result.journeys.filter((journey) => journey.startType === "sign_in"))
  assert.equal(signInFlow.nodes.find((node) => node.step === 0)?.sessions, 2)
  assert.equal(signInFlow.nodes.some((node) => node.label === "Dashboard"), true)
  assert.equal(signInFlow.links.reduce((sum, link) => sum + (link.source === 0 ? link.value : 0), 0), 2)
})

test("registration flow exposes step conversion and drop-off branches", () => {
  const flow = buildRegistrationStepFlow({
    home: 10,
    account: 8,
    location: 6,
    background: 4,
    about: 2,
    completed: 1,
  })
  assert.equal(flow.nodes.find((node) => node.label === "Step 2 · Location")?.sessions, 6)
  assert.equal(flow.nodes.find((node) => node.label === "Exited before Step 1 · Account")?.sessions, 2)
  assert.equal(flow.nodes.find((node) => node.label === "Exited after Step 4 · About You")?.sessions, 1)
  assert.equal(flow.nodes.find((node) => node.label === "Registration completed")?.percentOfPrior, 50)
})

test("registration submits reconstruct pre-fix step journeys without waiting for session exit", () => {
  const event = (event_name, session_id, occurred_at, overrides = {}) => ({
    event_name,
    session_id,
    occurred_at,
    page_path: overrides.page_path ?? null,
    user_id: overrides.user_id ?? null,
    metadata: overrides.metadata ?? {},
    error_code: overrides.error_code ?? null,
  })
  const result = buildPortalUtilizationData({
    now: new Date("2026-07-31T18:00:00Z"),
    analyticsError: null,
    profiles: [],
    onboardingRows: [],
    connections: [],
    analyticsEvents: [
      event("page_view", "pre-fix-registration-session", "2026-07-31T16:30:00Z", { page_path: "/" }),
      event("page_view", "pre-fix-registration-session", "2026-07-31T16:31:00Z", { page_path: "/register" }),
      event("registration_submit", "pre-fix-registration-session", "2026-07-31T16:33:00Z", { page_path: "/register" }),
      event("registration_error", "pre-fix-registration-session", "2026-07-31T16:33:01Z", {
        page_path: "/register",
        error_code: "Database error saving new user",
      }),
    ],
  })
  const flow = result.registrationFlow.rows.find((row) => (
    row.date === "2026-07-31" && row.device === "all" && row.audience === "all"
  ))
  assert.deepEqual(flow && {
    home: flow.home,
    account: flow.account,
    location: flow.location,
    background: flow.background,
    about: flow.about,
    completed: flow.completed,
  }, {
    home: 1,
    account: 1,
    location: 1,
    background: 1,
    about: 1,
    completed: 0,
  })
  assert.equal(result.registrationFlow.trackingStartedAt, "2026-07-31T16:33:00Z")
})

test("member journey flow reveals five steps at a time and retains end-session branches", () => {
  const baseJourney = {
    memberName: "Test Member",
    memberEmail: "member@example.com",
    audience: "member",
    device: "desktop",
    startType: "sign_in",
    startedAt: "2026-07-30T12:00:00Z",
    lastSeenAt: "2026-07-30T12:15:00Z",
    durationSeconds: 900,
  }
  const startStep = {
    occurredAt: "2026-07-30T12:00:00Z",
    eventName: "sign_in_success",
    label: "Signed in",
    page: "/login",
    durationSeconds: null,
  }
  const longJourney = {
    ...baseJourney,
    sessionId: "long-session",
    steps: [
      startStep,
      ...Array.from({ length: 7 }, (_, index) => ({
        occurredAt: `2026-07-30T12:0${index + 1}:00Z`,
        eventName: "page_view",
        label: `Page ${index + 1}`,
        page: `/page-${index + 1}`,
        durationSeconds: 60,
      })),
    ],
  }
  const shortJourney = {
    ...baseJourney,
    sessionId: "short-session",
    steps: [startStep],
  }

  const firstFiveSteps = buildPortalJourneyFlow([longJourney, shortJourney], 6, 5)
  assert.equal(firstFiveSteps.totalSteps, 9)
  assert.equal(firstFiveSteps.maxStep, 4)
  assert.equal(firstFiveSteps.truncatedSessions, 1)
  assert.equal(firstFiveSteps.nodes.find((node) => node.label === "End session")?.step, 1)
  assert.equal(firstFiveSteps.nodes.filter((node) => node.label === "End session").reduce((sum, node) => sum + node.sessions, 0), 1)

  const allSteps = buildPortalJourneyFlow([longJourney, shortJourney], 6, 10)
  assert.equal(allSteps.maxStep, 8)
  assert.equal(allSteps.truncatedSessions, 0)
  assert.equal(allSteps.nodes.find((node) => node.label === "End session" && node.step === 8)?.sessions, 1)
})

test("member journey flow keeps repeated events scoped to their parent path", () => {
  const baseJourney = {
    memberName: "Test Member",
    memberEmail: "member@example.com",
    audience: "member",
    device: "desktop",
    startType: "sign_in",
    startedAt: "2026-07-30T12:00:00Z",
    lastSeenAt: "2026-07-30T12:15:00Z",
    durationSeconds: 900,
  }
  const journey = (sessionId, branch) => ({
    ...baseJourney,
    sessionId,
    steps: [
      { occurredAt: "2026-07-30T12:00:00Z", eventName: "sign_in_success", label: "Signed in", page: "/login", durationSeconds: null },
      { occurredAt: "2026-07-30T12:01:00Z", eventName: "page_view", label: branch, page: `/${branch}`, durationSeconds: 60 },
      { occurredAt: "2026-07-30T12:02:00Z", eventName: "page_view", label: "Shared destination", page: "/shared", durationSeconds: 60 },
    ],
  })
  const fullFlow = buildPortalJourneyFlow([
    journey("branch-a", "Branch A"),
    journey("branch-b", "Branch B"),
  ])
  const repeatedNodes = fullFlow.nodes.filter((node) => node.label === "Shared destination")
  assert.equal(repeatedNodes.length, 2)
  assert.equal(new Set(repeatedNodes.map((node) => node.parentId)).size, 2)

  const focusedFlow = buildFocusedPortalJourneyFlow(fullFlow)
  assert.deepEqual(
    focusedFlow.nodes.filter((node) => node.step === 1).map((node) => node.label),
    ["Branch A", "Branch B"],
  )
  assert.deepEqual(
    focusedFlow.nodes.filter((node) => node.step === 2).map((node) => node.label),
    ["Shared destination"],
  )
  assert.equal(focusedFlow.nodes.find((node) => node.label === "Branch A")?.selected, true)
  assert.equal(focusedFlow.nodes.find((node) => node.label === "Branch B")?.selected, false)

  const branchB = fullFlow.nodes.find((node) => node.label === "Branch B")
  assert.ok(branchB)
  const branchBFlow = buildFocusedPortalJourneyFlow(fullFlow, { 1: branchB.id })
  assert.equal(branchBFlow.nodes.find((node) => node.label === "Branch B")?.selected, true)
  assert.equal(
    branchBFlow.nodes.find((node) => node.label === "Shared destination")?.parentId,
    branchB.id,
  )
})

test("invalid GA4 candidates retain last-known-good data and remove donations", () => {
  const previous = snapshotFixture({ sessions: 826, donations: true })
  const candidate = snapshotFixture({ sessions: 0, donations: true })
  const { snapshot, report } = validateAndMergeAnalyticsSnapshot({
    previous,
    candidate,
    pullStatus: {
      generatedAt: "2026-07-10T12:00:00Z",
      sources: [{ id: "website", label: "GA4", status: "success", lastRefreshedAt: "2026-07-10T12:00:00Z", note: "pulled" }],
    },
    now: new Date("2026-07-10T12:00:00Z"),
  })
  assert.equal(report.status, "partial_failure")
  assert.equal(snapshot.website.overview.sessions_30d, 826)
  assert.equal(snapshot.dataSources.some((source) => source.id === "donations"), false)
})

test("July 7 Portal and Zoom event rows merge to 22 registrants and 8 attendees", () => {
  const snapshot = snapshotFixture()
  const zoomRegistrants = Array.from({ length: 10 }, (_, index) => ({
    source: "zoom", record_type: "registrant", source_record_id: `zr${index}`,
    event_source_id: "+bhULZKTSjqX8PF90Iof2g==", event_name: "IPN Labs Harmonic Patterns of Consciousness",
    event_started_at: "2026-07-07T16:00:00Z", occurred_at: null, registered_at: "2026-07-01T00:00:00Z",
    name: `Zoom ${index}`, email: `zoom${index}@example.com`, normalized_email: `zoom${index}@example.com`, attended: null, duration_minutes: null, details: {},
  }))
  const participants = Array.from({ length: 8 }, (_, index) => ({
    source: "zoom", record_type: "participant", source_record_id: `zp${index}`,
    event_source_id: "+bhULZKTSjqX8PF90Iof2g==", event_name: "IPN Labs Harmonic Patterns of Consciousness",
    event_started_at: "2026-07-07T16:00:00Z", occurred_at: "2026-07-07T16:00:00Z", registered_at: null,
    name: `Attendee ${index}`, email: `attendee${index}@example.com`, normalized_email: `attendee${index}@example.com`, attended: true, duration_minutes: 45, details: {},
  }))
  const portalRegistrations = Array.from({ length: 13 }, (_, index) => ({
    memberName: `Portal ${index}`,
    memberEmail: index === 0 ? "zoom0@example.com" : `portal${index}@example.com`,
    registeredAt: "2026-07-02T00:00:00Z",
  }))
  const result = assembleServerEventAnalytics({
    snapshot,
    portalEvents: [{
      id: "0ccf7127-2c2f-4eee-979e-f793f9a2fcd4",
      title: "IPN Labs: Harmonic Patterns of Consciousness with Dr. Selen Atasoy",
      startsAt: "2026-07-07T16:00:00Z",
      eventType: "IPN Labs",
      status: "published",
      externalEventId: null,
      registrationCount: 13,
      registrations: portalRegistrations,
    }],
    sourceRecords: [...zoomRegistrants, ...participants],
    now: new Date("2026-07-10T00:00:00Z"),
  })
  const event = result.events.zoom.events[0]
  assert.equal(event.id, "0ccf7127-2c2f-4eee-979e-f793f9a2fcd4")
  assert.equal(event.registrants, 22)
  assert.equal(event.attendees, 8)
  assert.equal(event.registrationSource, "portal-zoom-transition")
  assert.equal(result.events.zoom.topAttendees.length, 8)
})

test("July 7 aggregate Zoom count is retained when private registrant rows are incomplete", () => {
  const snapshot = snapshotFixture()
  snapshot.events.zoom.events = [{
    id: "+bhULZKTSjqX8PF90Iof2g==",
    topic: "IPN Labs Seminar - Harmonic Patterns of Consciousness with Dr. Selen Atasoy",
    date: "2026-07-07T16:00:00Z",
    program: "IPN Labs",
    type: "public",
    attendees: 8,
    registrants: 11,
    registrationSource: "zoom",
    avgDuration: 45,
    retentionPct: 40,
    repeatPct: 0,
    participantEmails: [],
    participants: [],
    registrations: [],
  }]
  const participants = Array.from({ length: 8 }, (_, index) => ({
    source: "zoom", record_type: "participant", source_record_id: `partial-zp${index}`,
    event_source_id: "+bhULZKTSjqX8PF90Iof2g==", event_name: "IPN Labs Harmonic Patterns of Consciousness",
    event_started_at: "2026-07-07T16:00:00Z", occurred_at: "2026-07-07T16:00:00Z", registered_at: null,
    name: `Attendee ${index}`, email: `attendee${index}@example.com`, normalized_email: `attendee${index}@example.com`, attended: true, duration_minutes: 45, details: {},
  }))
  const portalRegistrations = Array.from({ length: 11 }, (_, index) => ({
    memberName: `Portal ${index}`,
    memberEmail: `portal${index}@example.com`,
    registeredAt: "2026-07-02T00:00:00Z",
  }))
  const result = assembleServerEventAnalytics({
    snapshot,
    portalEvents: [{
      id: "0ccf7127-2c2f-4eee-979e-f793f9a2fcd4",
      title: "IPN Labs: Harmonic Patterns of Consciousness with Dr. Selen Atasoy",
      startsAt: "2026-07-07T16:00:00Z",
      eventType: "IPN Labs",
      status: "published",
      externalEventId: null,
      registrationCount: 11,
      registrations: portalRegistrations,
    }],
    sourceRecords: participants,
    now: new Date("2026-07-10T00:00:00Z"),
  })
  assert.equal(result.events.zoom.events[0].registrants, 22)
  assert.equal(result.events.zoom.events[0].attendees, 8)
})

test("historical Zoom-only events hydrate attendee and registrant details from Supabase rows", () => {
  const snapshot = snapshotFixture()
  snapshot.events.zoom.events = [{
    id: "historical-event",
    topic: "Historical IPN Labs Seminar",
    date: "2026-04-22T21:00:00Z",
    program: "IPN Labs",
    type: "public",
    attendees: 2,
    registrants: 3,
    registrationSource: "zoom_registration_csv",
    avgDuration: 30,
    retentionPct: 40,
    repeatPct: 0,
    participantEmails: [],
    participants: [],
    registrations: [],
  }]
  const sourceRecords = [
    ...Array.from({ length: 2 }, (_, index) => ({
      source: "zoom", record_type: "participant", source_record_id: `historical-participant-${index}`,
      event_source_id: "historical-event", event_name: "Historical IPN Labs Seminar",
      event_started_at: "2026-04-22T21:00:00Z", occurred_at: "2026-04-22T21:00:00Z", registered_at: null,
      name: `Attendee ${index}`, email: `attendee${index}@example.com`, normalized_email: `attendee${index}@example.com`,
      attended: true, duration_minutes: 45 + index, details: {},
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      source: "zoom", record_type: "registrant", source_record_id: `historical-registrant-${index}`,
      event_source_id: "historical-event", event_name: "Historical IPN Labs Seminar",
      event_started_at: "2026-04-22T21:00:00Z", occurred_at: null, registered_at: "2026-04-01T00:00:00Z",
      name: `Registrant ${index}`, email: `registrant${index}@example.com`, normalized_email: `registrant${index}@example.com`,
      attended: null, duration_minutes: null, details: {},
    })),
  ]

  const result = assembleServerEventAnalytics({ snapshot, portalEvents: [], sourceRecords })
  const event = result.events.zoom.events[0]
  assert.equal(event.attendees, 2)
  assert.equal(event.registrants, 3)
  assert.equal(event.participants.length, 2)
  assert.equal(event.registrations.length, 3)
  assert.equal(result.events.zoom.topAttendees.length, 2)
})

test("snapshot builder restores a backfill-only PsychedelX webinar omitted by the Zoom API", () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), "ipn-analytics-backfill-"))
  const dataDir = join(fixtureDir, "data")
  const outputPath = join(fixtureDir, "snapshot.json")
  mkdirSync(dataDir)
  writeFileSync(join(dataDir, "zoom_events.json"), JSON.stringify({ events: [], pulled_at: "2026-08-03T12:00:00Z" }))
  writeFileSync(join(dataDir, "zoom_stats.json"), JSON.stringify({ pulled_at: "2026-08-03T12:00:00Z" }))
  writeFileSync(join(dataDir, "zoom_registration_backfill.json"), JSON.stringify({ events: [] }))
  writeFileSync(join(dataDir, "zoom_attendee_backfill.json"), JSON.stringify({ events: [{
    eventId: "xImfgyAlRresYfbr1qlOiQ==",
    meetingId: "89543551090",
    topic: "PsychedelX 2026: The Premier Global Psychedelic Student Talk Conferences",
    date: "2026-06-28T15:00:00Z",
    uniqueAttendees: 85,
    avgDurationMin: 199.9,
    retentionPct: 21.6,
    daySummaries: [{ registrants: 79 }, { registrants: 95 }, { registrants: 100 }],
    participants: [],
  }] }))

  try {
    execFileSync(process.execPath, ["scripts/build-legacy-analytics-snapshot.mjs", fixtureDir, outputPath], {
      cwd: new URL("..", import.meta.url),
      stdio: "pipe",
    })
    const snapshot = JSON.parse(readFileSync(outputPath, "utf8"))
    const event = snapshot.events.zoom.events.find((item) => item.id === "xImfgyAlRresYfbr1qlOiQ==")
    assert.ok(event)
    assert.equal(event.attendees, 85)
    assert.equal(event.registrants, 100)
    assert.equal(event.avgDuration, 199.9)
    assert.equal(event.retentionPct, 21.6)
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true })
  }
})
