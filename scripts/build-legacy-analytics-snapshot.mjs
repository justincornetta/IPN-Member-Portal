import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const outputPath = resolve(projectDir, "src/lib/admin/analytics/legacy-snapshot.json")
const defaultLegacyDir = resolve(projectDir, "..", "ipn-dashboard")
const legacyDir = resolve(process.argv[2] || process.env.LEGACY_DASHBOARD_DIR || defaultLegacyDir)
const dataDir = resolve(legacyDir, "data")
const zoomRegistrantBackfillCutoff = new Date("2026-07-01T00:00:00.000Z")

function readJson(path, fallback = {}) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return fallback
  }
}

function readData(filename, fallback = {}) {
  return readJson(resolve(dataDir, filename), fallback)
}

function hasData(filename) {
  return existsSync(resolve(dataDir, filename))
}

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function percent(value) {
  const parsed = number(value)
  return parsed <= 1 ? parsed * 100 : parsed
}

function round(value, digits = 1) {
  const factor = 10 ** digits
  return Math.round(number(value) * factor) / factor
}

function isExcludedLegacyUrl(value) {
  return String(value || "").toLowerCase().includes("discord")
}

function lastPull(payload) {
  return payload?.pulled_at || payload?.last_pull || payload?.lastPull || payload?.timestamp || payload?.updated_at || null
}

function isBeforeCutoff(value, cutoff) {
  if (!value) return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date < cutoff
}

function monthFromCompact(value) {
  if (!value) return "Unknown"
  const text = String(value)
  if (/^\d{6}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}`
  if (/^\d{4}-\d{2}/.test(text)) return text.slice(0, 7)
  return text
}

function dateFromCompact(value) {
  if (!value) return null
  const text = String(value)
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10)
  return text
}

function topItems(rows, key, limit = 20) {
  const counts = new Map()
  for (const row of rows) {
    const label = row?.[key] || "Unknown"
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, limit)
}

function dataSource(id, label, status, mode, lastPullValue, note) {
  return { id, label, status, mode, lastPull: lastPullValue, note }
}

function buildMembers(base, sot) {
  const rows = Array.isArray(sot.rows) ? sot.rows : []
  const totals = sot.totals || {}
  const growthMap = new Map()
  for (const row of rows) {
    const month = monthFromCompact(row.first_seen_at)
    if (!month || month === "Unknown") continue
    growthMap.set(month, (growthMap.get(month) || 0) + 1)
  }
  let cumulative = 0
  const growth = Array.from(growthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, newMembers]) => {
      cumulative += newMembers
      return { month, newMembers, cumulative }
    })

  return {
    ...base.members,
    totals: {
      rowCount: number(totals.row_count),
      inForm: number(totals.in_form),
      inMailchimp: number(totals.in_mailchimp),
      inOldApp: number(totals.in_oldapp),
      inEventbrite: number(totals.in_eventbrite),
      inZoom: number(totals.in_zoom),
      pulledAt: totals.pulled_at || null,
      builtAt: totals.built_at || null,
    },
    sourceTotals: [
      { id: "form", label: "Form", value: number(totals.in_form) },
      { id: "mailchimp", label: "Mailchimp", value: number(totals.in_mailchimp) },
      { id: "oldapp", label: "Legacy App", value: number(totals.in_oldapp) },
    ],
    growth: growth.length ? growth : base.members.growth,
    countries: topItems(rows, "country"),
    states: topItems(rows, "state"),
    primaryField: topItems(rows, "primary_field"),
    selfDescription: topItems(rows, "self_description"),
    referralSource: topItems(rows, "referral_source"),
    engagementStatus: topItems(rows, "engagement_status"),
  }
}

function buildMarketing(base, account, listsPayload, campaignsPayload, growthPayload) {
  const lists = Array.isArray(listsPayload.lists) ? listsPayload.lists : []
  const campaigns = Array.isArray(campaignsPayload.campaigns) ? campaignsPayload.campaigns : []
  const monthly = Array.isArray(campaignsPayload.monthly_aggregates) ? campaignsPayload.monthly_aggregates : []
  const mappedCampaigns = campaigns
    .filter((campaign) => campaign.send_time)
    .map((campaign) => {
      const sent = number(campaign.emails_sent || campaign.recipient_count)
      const opens = number(campaign.proxy_excluded_unique_opens ?? campaign.unique_opens ?? campaign.opens)
      const clicks = number(campaign.unique_subscriber_clicks ?? campaign.clicks)
      return {
        id: String(campaign.id || campaign.web_id || campaign.title),
        title: campaign.title || "",
        subject: campaign.subject || "",
        date: campaign.send_time || null,
        listName: campaign.list_name || "",
        sent,
        opens,
        openRate: round(percent(campaign.proxy_excluded_open_rate ?? campaign.open_rate)),
        clicks,
        clickRate: round(percent(campaign.click_rate)),
        unsubscribes: number(campaign.unsubscribed),
        clickDetail: Array.isArray(campaign.click_detail) ? campaign.click_detail
          .filter((click) => !isExcludedLegacyUrl(click.url))
          .map((click) => ({
            url: click.url || "",
            clicks: number(click.clicks),
            uniqueClicks: click.unique == null ? null : number(click.unique),
            percentOfClicks: click.pct == null ? null : number(click.pct),
          })) : [],
      }
    })

  const growth = []
  for (const [listName, value] of Object.entries(growthPayload.growth || {})) {
    const history = Array.isArray(value?.history) ? value.history : Array.isArray(value) ? value : []
    for (const row of history) {
      growth.push({
        listName,
        month: row.month || "Unknown",
        members: number(row.existing) + number(row.imports) + number(row.optins),
        newMembers: number(row.imports) + number(row.optins),
      })
    }
  }

  return {
    summary: {
      totalSubscribers: lists.reduce((sum, list) => sum + number(list.member_count), 0) || number(account.total_subscribers),
      totalLists: number(listsPayload.total_lists, lists.length),
      totalCampaigns: number(campaignsPayload.total_campaigns, campaigns.length),
      avgOpenRate: round(percent(account.industry_stats?.open_rate)),
      avgClickRate: round(percent(account.industry_stats?.click_rate)),
      totalUnsubscribes: mappedCampaigns.reduce((sum, campaign) => sum + campaign.unsubscribes, 0),
      pulledAt: campaignsPayload.pulled_at || listsPayload.pulled_at || account.pulled_at || null,
    },
    lists: lists.map((list) => ({
      id: String(list.id || list.name),
      name: list.name || "",
      members: number(list.member_count),
      unsubscribeCount: number(list.unsubscribe_count),
      openRate: percent(list.open_rate),
      clickRate: percent(list.click_rate),
    })),
    monthly: monthly.map((row) => ({
      month: row.month || "Unknown",
      campaigns: number(row.campaigns_sent),
      sent: number(row.total_sent),
      opens: number(row.total_opens),
      clicks: number(row.total_clicks),
      unsubscribes: number(row.total_unsubscribed),
      openRate: percent(row.open_rate),
      clickRate: percent(row.click_rate),
    })),
    growth: growth.length ? growth : base.marketing.growth,
    campaigns: mappedCampaigns,
  }
}

function buildSocial(base, social, instagramMedia) {
  const instagram = social.instagram || {}
  const facebook = social.facebook || {}
  return {
    platforms: [
      {
        id: "instagram",
        label: "Instagram",
        followers: number(instagram.followers, null),
        engagementRate: percent(instagram.avg_engagement_rate),
        postsThisMonth: number(instagram.posts_this_month, null),
        status: "live",
        updatedAt: instagram.updated_at || null,
      },
      {
        id: "facebook",
        label: "Facebook",
        followers: number(facebook.followers, null),
        engagementRate: percent(facebook.avg_engagement_rate),
        postsThisMonth: number(facebook.posts_this_month, null),
        status: "basic",
        updatedAt: facebook.updated_at || null,
      },
      ...base.social.platforms.filter((platform) => !["instagram", "facebook"].includes(platform.id)),
    ],
    history: (Array.isArray(social.history) ? social.history : []).map((row) => ({
      date: row.updated_at || row.date || null,
      month: row.month || "Unknown",
      channel: row.channel || "",
      followers: number(row.followers),
      engagementRate: percent(row.avg_engagement_rate),
      posts: number(row.posts_this_month),
    })),
    instagramPosts: (Array.isArray(instagramMedia.posts) ? instagramMedia.posts : []).map((post) => ({
      id: String(post.id || post.permalink),
      date: post.timestamp || null,
      type: post.media_type || post.media_product_type || "",
      caption: post.caption || "",
      likes: number(post.like_count),
      comments: number(post.comments_count),
      engagement: number(post.like_count) + number(post.comments_count),
      permalink: post.permalink || "",
    })),
  }
}

function buildWebsite(website) {
  const trendRows = Array.isArray(website.monthly_trend?.monthly) ? website.monthly_trend.monthly : []
  const dailyTrendRows = Array.isArray(website.monthly_trend?.daily) ? website.monthly_trend.daily : []
  const funnelRows = Object.entries(website.funnels || {})
    .filter(([path, value]) => path !== "outbound_clicks" && value && typeof value === "object" && !Array.isArray(value))
    .map(([path, value]) => ({ path, ...value }))
  return {
    overview: website.overview || {},
    trend: trendRows.map((row) => ({
      month: monthFromCompact(row.month),
      sessions: number(row.sessions),
      users: number(row.users),
      pageviews: number(row.pageviews),
      bounceRate: percent(row.bounce_rate),
      avgDuration: number(row.avg_duration),
      newUsers: number(row.new_users),
    })),
    dailyTrend: dailyTrendRows.map((row) => ({
      date: dateFromCompact(row.date),
      sessions: number(row.sessions),
      users: number(row.users),
      pageviews: number(row.pageviews),
      bounceRate: percent(row.bounce_rate),
      avgDuration: number(row.avg_duration),
      newUsers: number(row.new_users),
    })),
    devices: (Array.isArray(website.devices) ? website.devices : []).map((row) => ({
      label: row.device || row.label || "Unknown",
      sessions: number(row.sessions),
      users: number(row.users),
    })),
    channels: (Array.isArray(website.acquisition?.channels) ? website.acquisition.channels : []).map((row) => ({
      label: row.channel || row.label || "Unknown",
      sessions: number(row.sessions),
      users: number(row.users),
    })),
    sources: (Array.isArray(website.acquisition?.sources) ? website.acquisition.sources : []).map((row) => ({
      source: row.source || "(not set)",
      medium: row.medium || "(not set)",
      sessions: number(row.sessions),
      users: number(row.users),
    })),
    countries: (Array.isArray(website.geo?.countries) ? website.geo.countries : []).map((row) => ({
      label: row.country || row.label || "Unknown",
      sessions: number(row.sessions),
      users: number(row.users),
    })),
    cities: (Array.isArray(website.geo?.cities) ? website.geo.cities : []).map((row) => ({
      label: row.city || row.label || "Unknown",
      sessions: number(row.sessions),
      users: number(row.users),
    })),
    pages: (Array.isArray(website.pages) ? website.pages : []).map((row) => ({
      path: row.path || row.page_path || "",
      title: row.title || row.page_title || row.path || "",
      pageviews: number(row.pageviews),
      users: number(row.users),
      avgDuration: number(row.avg_duration),
      bounceRate: percent(row.bounce_rate),
    })),
    funnels: funnelRows.map((row) => ({
      path: row.path || row.page_path || "",
      pageviews: number(row.pageviews),
      users: number(row.users),
      bounceRate: percent(row.bounce_rate),
      avgDuration: number(row.avg_duration),
    })),
    outboundClicks: (Array.isArray(website.funnels?.outbound_clicks) ? website.funnels.outbound_clicks : Array.isArray(website.clicks) ? website.clicks : [])
      .filter((row) => !isExcludedLegacyUrl(row.url))
      .map((row) => ({
        url: row.url || "",
        clicks: number(row.clicks),
      })),
    blog: (Array.isArray(website.blog) ? website.blog : []).map((row) => ({
      path: row.path || row.page_path || "",
      title: row.title || row.page_title || row.path || "",
      pageviews: number(row.pageviews),
      users: number(row.users),
      avgDuration: number(row.avg_duration),
      bounceRate: percent(row.bounce_rate),
    })),
    pulledAt: website.pulled_at || null,
  }
}

function buildZoom(zoomStats, zoomEventsPayload, zoomRegistrationBackfillPayload, zoomAttendeeBackfillPayload) {
  const events = Array.isArray(zoomEventsPayload.events) ? zoomEventsPayload.events : []
  const backfillEvents = Array.isArray(zoomRegistrationBackfillPayload.events) ? zoomRegistrationBackfillPayload.events : []
  const attendeeBackfillEvents = Array.isArray(zoomAttendeeBackfillPayload.events) ? zoomAttendeeBackfillPayload.events : []
  const backfillByEventId = new Map(backfillEvents.filter((event) => event.eventId).map((event) => [String(event.eventId), event]))
  const backfillByMeetingId = new Map(backfillEvents.filter((event) => event.meetingId).map((event) => [String(event.meetingId), event]))
  const attendeeBackfillByEventId = new Map(attendeeBackfillEvents.filter((event) => event.eventId).map((event) => [String(event.eventId), event]))
  const attendeeBackfillByMeetingId = new Map(attendeeBackfillEvents.filter((event) => event.meetingId).map((event) => [String(event.meetingId), event]))
  const mappedEvents = events.map((event) => {
    const includeZoomRegistrantBackfill = isBeforeCutoff(event.start_time, zoomRegistrantBackfillCutoff)
    const registrationBackfill = backfillByEventId.get(String(event.event_id || "")) || backfillByMeetingId.get(String(event.meeting_id || ""))
    const attendeeBackfill = attendeeBackfillByEventId.get(String(event.event_id || "")) || attendeeBackfillByMeetingId.get(String(event.meeting_id || ""))
    const hasApiRegistrants = Array.isArray(event.registrants_detail) && event.registrants_detail.length > 0
    const rawRegistrants = hasApiRegistrants
      ? event.registrants_detail
      : Array.isArray(registrationBackfill?.registrations)
        ? registrationBackfill.registrations
        : []
    const manualRegistrantCount = registrationBackfill?.registrants == null ? null : number(registrationBackfill.registrants, null)
    const rawParticipants = Array.isArray(attendeeBackfill?.participants) && attendeeBackfill.participants.length
      ? attendeeBackfill.participants.map((participant) => ({
          name: participant.name || participant.email || "Unknown",
          email: participant.email || "",
          durationMin: number(participant.durationMin),
          durationSec: number(participant.durationSec),
          daysAttended: number(participant.daysAttended, null),
          roles: Array.isArray(participant.roles) ? participant.roles : [],
          countries: Array.isArray(participant.countries) ? participant.countries : [],
        }))
      : (Array.isArray(event.participants_detail) ? event.participants_detail : []).map((participant) => ({
          name: participant.name || participant.email || "Unknown",
          email: participant.email || "",
          durationMin: round(number(participant.duration_sec) / 60),
          durationSec: number(participant.duration_sec),
          daysAttended: null,
          roles: [],
          countries: [],
        }))

    return {
      id: String(event.event_id || event.meeting_id || event.topic),
      topic: event.topic || "",
      date: event.start_time || null,
      program: event.program || "Other",
      type: event.type || "public",
      attendees: attendeeBackfill?.uniqueAttendees != null
        ? number(attendeeBackfill.uniqueAttendees)
        : number(event.unique_participants ?? event.total_participants),
      registrants: includeZoomRegistrantBackfill
        ? event.registrants != null
          ? number(event.registrants)
          : (manualRegistrantCount ?? rawRegistrants.length) || null
        : null,
      registrationSource: includeZoomRegistrantBackfill && rawRegistrants.length
        ? hasApiRegistrants
          ? "zoom_api_registrants"
          : registrationBackfill?.source || "zoom_registration_backfill"
        : includeZoomRegistrantBackfill && manualRegistrantCount != null
          ? registrationBackfill?.source || "manual_zoom_registration_count"
          : null,
      avgDuration: attendeeBackfill?.avgDurationMin != null
        ? number(attendeeBackfill.avgDurationMin)
        : number(event.retention?.avg_duration_min ?? event.duration_min),
      retentionPct: attendeeBackfill?.retentionPct != null
        ? number(attendeeBackfill.retentionPct)
        : number(event.retention?.avg_retention_pct),
      repeatPct: number(event.repeat_attendee_pct),
      participantEmails: Array.isArray(attendeeBackfill?.participants)
        ? attendeeBackfill.participants.map((participant) => participant.email).filter(Boolean)
        : Array.isArray(event.participant_emails) ? event.participant_emails : [],
      participants: rawParticipants.map((participant) => ({
        name: participant.name || participant.email || "Unknown",
        email: participant.email || "",
        durationMin: participant.durationMin || round(number(participant.durationSec) / 60),
        eventsAttended: 0,
        daysAttended: participant.daysAttended,
        roles: participant.roles,
        countries: participant.countries,
      })),
      registrations: includeZoomRegistrantBackfill
        ? rawRegistrants.map((registrant) => ({
            name: registrant.name || registrant.email || "Unknown",
            email: registrant.email || "",
            registeredAt: registrant.registeredAt || registrant.registered_at || registrant.created_at || null,
          }))
        : [],
    }
  })

  const priorEventsByEmail = new Map()
  for (const event of [...mappedEvents].sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime())) {
    const seenThisEvent = new Set()
    for (const participant of event.participants) {
      const email = String(participant.email || "").toLowerCase()
      if (!email) continue
      participant.eventsAttended = priorEventsByEmail.get(email) || 0
      seenThisEvent.add(email)
    }
    event.repeatPct = event.participants.length
      ? event.participants.filter((participant) => participant.eventsAttended > 0).length / event.participants.length * 100
      : event.repeatPct
    for (const email of seenThisEvent) priorEventsByEmail.set(email, (priorEventsByEmail.get(email) || 0) + 1)
  }

  return {
    stats: {
      totalEvents: number(zoomStats.total_events, events.length),
      totalParticipants: number(zoomStats.total_participants_all_time),
      avgParticipants: number(zoomStats.avg_participants_per_event),
      avgAttendanceRate: percent(zoomStats.avg_attendance_rate),
      avgRetentionPct: number(zoomStats.avg_retention_pct),
      avgDurationMin: number(zoomStats.avg_duration_min),
      repeatRatePct: number(zoomStats.repeat_attendee_stats?.repeat_rate_pct),
      uniqueAttendees: number(zoomStats.repeat_attendee_stats?.total_unique_attendees),
      pulledAt: zoomStats.pulled_at || zoomEventsPayload.pulled_at || null,
    },
    byMonth: (Array.isArray(zoomStats.events_by_month) ? zoomStats.events_by_month : []).map((row) => ({
      month: monthFromCompact(row.month),
      events: number(row.events),
      participants: number(row.total_participants),
      avgParticipants: number(row.avg_participants),
      retentionPct: number(row.avg_retention_pct),
    })),
    topAttendees: (Array.isArray(zoomStats.attendee_summary) ? zoomStats.attendee_summary : []).map((attendee) => ({
      name: attendee.name || attendee.email || "Unknown",
      email: attendee.email || "",
      events: number(attendee.events_attended),
      totalDurationMin: number(attendee.total_duration_min),
      lastEventDate: attendee.last_event_date || null,
    })),
    events: mappedEvents,
    upcomingEvents: (Array.isArray(zoomStats.upcoming_events) ? zoomStats.upcoming_events : []).map((event) => ({
      id: String(event.meeting_id || event.event_id || event.topic),
      topic: event.topic || "",
      date: event.start_time || null,
      program: event.program || "Other",
      type: event.type || "public",
      registrants: event.registrants == null ? null : number(event.registrants),
      registrations: (Array.isArray(event.registrants_detail) ? event.registrants_detail : []).map((registrant) => ({
        name: registrant.name || registrant.email || "Unknown",
        email: registrant.email || "",
        registeredAt: registrant.registered_at || registrant.created_at || null,
      })),
    })),
  }
}

function buildEventbrite(eventbritePayload) {
  const events = Array.isArray(eventbritePayload.events) ? eventbritePayload.events : []
  return {
    summary: {
      totalEvents: number(eventbritePayload.summary?.total_events, events.length),
      ticketsSold: number(eventbritePayload.summary?.total_tickets_sold_all),
      grossRevenue: number(eventbritePayload.summary?.total_gross_revenue_all),
      activeEvents: number(eventbritePayload.summary?.active_events),
      upcomingEvents: number(eventbritePayload.summary?.upcoming_events),
      pulledAt: eventbritePayload.pulled_at || null,
    },
    events: events.map((event) => ({
      id: String(event.id || event.name),
      name: event.name || "",
      date: event.start?.utc || event.start?.local || null,
      status: event.status || "",
      format: event.online_event ? "Online" : "In person",
      url: event.url || "",
      capacity: number(event.capacity),
      tickets: number(event.sales?.total_tickets_sold),
      grossRevenue: number(event.sales?.total_gross_revenue),
      netRevenue: number(event.sales?.total_net_revenue),
      checkIns: number(event.attendance?.checked_in),
      attendanceRate: percent(event.attendance?.attendance_rate),
      ticketClasses: (Array.isArray(event.ticket_classes) ? event.ticket_classes : []).map((ticket) => ({
        name: ticket.name || "",
        price: number(ticket.cost_dollars),
        sold: number(ticket.quantity_sold),
        capacity: number(ticket.quantity_total),
      })),
      dailySales: (Array.isArray(event.sales?.daily_sales) ? event.sales.daily_sales : []).map((sale) => ({
        date: sale.date || "",
        tickets: number(sale.tickets),
        revenue: number(sale.gross),
      })),
    })),
  }
}

const base = readJson(outputPath)
const sot = readData("sot_dashboard.json")
const mailchimpAccount = readData("mailchimp_account.json")
const mailchimpLists = readData("mailchimp_lists.json")
const mailchimpCampaigns = readData("mailchimp_campaigns.json")
const mailchimpGrowth = readData("mailchimp_growth.json")
const socialStats = readData("social_stats.json")
const instagramMedia = readData("instagram_media.json")
const websiteStats = readData("website_stats.json")
const zoomStats = readData("zoom_stats.json")
const zoomEvents = readData("zoom_events.json")
const zoomRegistrationBackfill = readData("zoom_registration_backfill.json", { events: [] })
const zoomAttendeeBackfill = readData("zoom_attendee_backfill.json", { events: [] })
const eventbriteEvents = readData("eventbrite_events.json")
const donationsLastPull = readData("donations_last_pull.json")
const hasSot = hasData("sot_dashboard.json")
const hasMailchimp = hasData("mailchimp_account.json") || hasData("mailchimp_lists.json") || hasData("mailchimp_campaigns.json")
const hasSocial = hasData("social_stats.json") || hasData("instagram_media.json")
const hasWebsite = hasData("website_stats.json")
const hasZoom = hasData("zoom_stats.json") || hasData("zoom_events.json")
const hasEventbrite = hasData("eventbrite_events.json")
const hasDonations = hasData("donations_last_pull.json") || hasData("donations_stats.json")

function existingSource(id) {
  return (base.dataSources || []).find((source) => source.id === id) || null
}

function refreshedSource(id, fallbackSource, factory) {
  return fallbackSource ? factory() : existingSource(id) || factory()
}

const snapshot = {
  ...base,
  generatedAt: new Date().toISOString(),
  dashboardRepo: legacyDir,
  dataSources: [
    refreshedSource("members", hasSot, () => dataSource("members", "Members / SoT", "snapshot", "Server snapshot", sot.totals?.pulled_at || null, `${number(sot.totals?.row_count)} deduped records`)),
    refreshedSource("mailchimp", hasMailchimp, () => dataSource("mailchimp", "Mailchimp", "success", "API snapshot", lastPull(mailchimpCampaigns) || lastPull(mailchimpLists) || lastPull(mailchimpAccount), `${number(mailchimpAccount.total_subscribers)} subscribers`)),
    refreshedSource("instagram", hasSocial, () => dataSource("instagram", "Instagram", "success", "API snapshot", lastPull(readData("instagram_last_pull.json")) || socialStats.instagram?.updated_at || null, `${number(socialStats.instagram?.followers)} followers`)),
    refreshedSource("facebook", hasSocial, () => dataSource("facebook", "Facebook", "success", "Basic API snapshot", lastPull(readData("facebook_last_pull.json")) || socialStats.facebook?.updated_at || null, `${number(socialStats.facebook?.followers)} followers`)),
    refreshedSource("website", hasWebsite, () => dataSource("website", "Website / GA4", "success", "API snapshot", lastPull(websiteStats) || lastPull(readData("website_last_pull.json")), `${number(websiteStats.overview?.sessions_30d)} sessions in 30d`)),
    refreshedSource("zoom", hasZoom, () => dataSource("zoom", "Zoom", "success", "API snapshot", lastPull(zoomStats) || lastPull(zoomEvents) || lastPull(readData("zoom_last_pull.json")), `${number(zoomStats.total_events, zoomEvents.events?.length)} events`)),
    refreshedSource("eventbrite", hasEventbrite, () => dataSource("eventbrite", "Eventbrite", "success", "API snapshot", lastPull(eventbriteEvents) || lastPull(readData("eventbrite_last_pull.json")), `${number(eventbriteEvents.summary?.total_events, eventbriteEvents.events?.length)} events`)),
    refreshedSource("donations", hasDonations, () => dataSource("donations", "Donations", "success", "Pending/manual", lastPull(donationsLastPull), "$0 recorded")),
    ...(base.dataSources || []).filter((source) => ["webapp", "whatsapp", "search-console"].includes(source.id)),
  ],
  members: hasSot ? buildMembers(base, sot) : base.members,
  marketing: hasMailchimp ? buildMarketing(base, mailchimpAccount, mailchimpLists, mailchimpCampaigns, mailchimpGrowth) : base.marketing,
  social: hasSocial ? buildSocial(base, socialStats, instagramMedia) : base.social,
  website: hasWebsite ? buildWebsite(websiteStats) : base.website,
  events: {
    zoom: hasZoom ? buildZoom(zoomStats, zoomEvents, zoomRegistrationBackfill, zoomAttendeeBackfill) : base.events?.zoom,
    eventbrite: hasEventbrite ? buildEventbrite(eventbriteEvents) : base.events?.eventbrite,
  },
}

writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(`Built ${outputPath}`)
console.log(`Source: ${legacyDir}`)
