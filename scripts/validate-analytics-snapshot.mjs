import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return fallback
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function sourceById(snapshot, id) {
  return (snapshot?.dataSources ?? []).find((source) => source.id === id) ?? null
}

function relativeChange(previous, current) {
  if (!Number.isFinite(previous) || previous <= 0 || !Number.isFinite(current)) return 0
  return Math.abs(current - previous) / previous
}

function supportedSocialHistory(snapshot) {
  return (snapshot?.social?.history ?? []).filter((row) => (
    ["instagram", "facebook", "linkedin"].includes(String(row.channel).toLowerCase())
  ))
}

function platformFollowers(snapshot, id) {
  return Number((snapshot?.social?.platforms ?? []).find((platform) => platform.id === id)?.followers ?? 0)
}

function sourceTimestampIsStale(value, now, maximumAgeHours = 36) {
  const timestamp = new Date(value ?? "")
  if (Number.isNaN(timestamp.getTime())) return true
  return now.getTime() - timestamp.getTime() > maximumAgeHours * 60 * 60 * 1000
}

function setSourceFailure(merged, previous, id, message, attemptedAt) {
  const previousSource = sourceById(previous, id)
  const candidateSource = sourceById(merged, id)
  const replacement = {
    ...(candidateSource ?? previousSource ?? { id, label: id }),
    status: "error",
    lastPull: previousSource?.lastSuccessfulAt ?? previousSource?.lastPull ?? null,
    lastAttemptedAt: attemptedAt,
    lastSuccessfulAt: previousSource?.lastSuccessfulAt ?? previousSource?.lastPull ?? null,
    note: message,
  }
  merged.dataSources = (merged.dataSources ?? []).filter((source) => source.id !== id)
  merged.dataSources.push(replacement)
}

function preserveSourceSection(merged, previous, id) {
  if (id === "website") merged.website = clone(previous.website)
  if (id === "mailchimp") merged.marketing = clone(previous.marketing)
  if (id === "zoom") merged.events.zoom = clone(previous.events.zoom)
  if (id === "eventbrite") merged.events.eventbrite = clone(previous.events.eventbrite)
  if (id === "instagram" || id === "facebook") {
    const failedChannels = new Set([id])
    const healthyPlatforms = (merged.social.platforms ?? []).filter((platform) => !failedChannels.has(platform.id))
    const priorPlatforms = (previous.social.platforms ?? []).filter((platform) => failedChannels.has(platform.id))
    merged.social.platforms = [...healthyPlatforms, ...priorPlatforms]
    merged.social.history = [
      ...(merged.social.history ?? []).filter((row) => !failedChannels.has(row.channel)),
      ...(previous.social.history ?? []).filter((row) => failedChannels.has(row.channel)),
    ].sort((a, b) => String(a.date).localeCompare(String(b.date)))
    if (id === "instagram") merged.social.instagramPosts = clone(previous.social.instagramPosts)
  }
}

export function validateAndMergeAnalyticsSnapshot({
  previous,
  candidate,
  pullStatus,
  detailSummary = {},
  lastKnownGood = previous,
  now = new Date(),
}) {
  const baseline = clone(previous)
  if (Number(baseline.website?.overview?.sessions_30d ?? 0) <= 0
    && Number(lastKnownGood.website?.overview?.sessions_30d ?? 0) > 0) {
    baseline.website = clone(lastKnownGood.website)
    baseline.dataSources = (baseline.dataSources ?? []).filter((source) => source.id !== "website")
    if (sourceById(lastKnownGood, "website")) baseline.dataSources.push(clone(sourceById(lastKnownGood, "website")))
  }
  if (supportedSocialHistory(lastKnownGood).length > supportedSocialHistory(baseline).length) {
    baseline.social = clone(lastKnownGood.social)
    for (const id of ["instagram", "facebook"]) {
      baseline.dataSources = (baseline.dataSources ?? []).filter((source) => source.id !== id)
      if (sourceById(lastKnownGood, id)) baseline.dataSources.push(clone(sourceById(lastKnownGood, id)))
    }
  }
  const merged = clone(candidate)
  merged.dataSources = (merged.dataSources ?? []).filter((source) => source.id !== "donations")
  merged.social.platforms = (merged.social.platforms ?? []).filter((platform) => (
    ["instagram", "facebook", "linkedin"].includes(platform.id)
  ))
  merged.social.history = supportedSocialHistory(merged)
  const attemptedAt = pullStatus.generatedAt ?? now.toISOString()
  const validations = []
  const sources = (pullStatus.sources ?? []).filter((source) => source.id !== "donations").map((source) => ({ ...source }))
  const previousCumulativeBySource = detailSummary?.previousCumulativeBySource ?? {}
  const cumulativeBySource = detailSummary?.cumulativeBySource ?? {}

  function fail(id, message) {
    const status = sources.find((source) => source.id === id)
    if (status) {
      status.status = "error"
      status.note = message
      status.lastAttemptedAt = attemptedAt
      status.lastSuccessfulAt = sourceById(previous, id)?.lastSuccessfulAt ?? sourceById(previous, id)?.lastPull ?? null
      status.lastRefreshedAt = status.lastSuccessfulAt
    }
    preserveSourceSection(merged, baseline, id)
    setSourceFailure(merged, baseline, id, message, attemptedAt)
    validations.push({ source: id, level: "error", message })
  }

  function warn(id, message) {
    const status = sources.find((source) => source.id === id)
    if (status?.status === "success") status.status = "warning"
    if (status) status.note = status.note ? `${status.note} ${message}` : message
    const snapshotSource = sourceById(merged, id)
    if (snapshotSource) {
      if (snapshotSource.status === "success") snapshotSource.status = "warning"
      snapshotSource.note = snapshotSource.note ? `${snapshotSource.note} ${message}` : message
    }
    validations.push({ source: id, level: "warning", message })
  }

  for (const source of sources) {
    source.lastAttemptedAt = attemptedAt
    if (source.status === "success") {
      source.lastSuccessfulAt = source.lastRefreshedAt ?? attemptedAt
      if (sourceTimestampIsStale(source.lastRefreshedAt, now)) {
        fail(source.id, `${source.label} returned a stale or missing source timestamp.`)
      }
    } else {
      fail(source.id, source.note || `${source.label} pull failed.`)
    }
  }

  const websiteSessions = Number(merged.website?.overview?.sessions_30d ?? 0)
  const websiteHasRows = [
    merged.website?.dailyTrend,
    merged.website?.trend,
    merged.website?.devices,
    merged.website?.channels,
    merged.website?.pages,
  ].some((rows) => Array.isArray(rows) && rows.length > 0)
  if (sources.find((source) => source.id === "website")?.status !== "error" && (websiteSessions <= 0 || !websiteHasRows)) {
    fail("website", "GA4 returned zero sessions or no structured report rows.")
  }

  const previousSocialRows = supportedSocialHistory(baseline)
  const candidateSocialRows = supportedSocialHistory(merged)
  if (candidateSocialRows.length < previousSocialRows.length) {
    for (const platform of ["instagram", "facebook"]) {
      if (sources.find((source) => source.id === platform)?.status !== "error") {
        fail(platform, `Social history regressed from ${previousSocialRows.length} to ${candidateSocialRows.length} rows.`)
      }
    }
  }

  const zoomStatus = sources.find((source) => source.id === "zoom")
  const zoomDetailCount = Number(detailSummary?.bySource?.zoom ?? 0)
  if (zoomStatus?.status !== "error" && (merged.events?.zoom?.events?.length ?? 0) > 0 && zoomDetailCount === 0) {
    fail("zoom", "Zoom produced aggregate events but no participant or registrant detail rows.")
  }

  for (const id of ["zoom", "eventbrite"]) {
    const previousCount = Number(previousCumulativeBySource?.[id] ?? 0)
    const currentCount = Number(cumulativeBySource?.[id] ?? previousCount)
    if (sources.find((source) => source.id === id)?.status !== "error" && currentCount < previousCount) {
      fail(id, `Cumulative private detail records regressed from ${previousCount} to ${currentCount}.`)
    }
  }

  const endedPendingZoomEvents = [
    ...(merged.events?.zoom?.events ?? []),
    ...(merged.events?.zoom?.upcomingEvents ?? []),
  ].filter((event) => {
    const startedAt = new Date(event.date ?? "")
    if (Number.isNaN(startedAt.getTime()) || startedAt > now) return false
    return event.status === "pending" || event.registrationSource === "pending"
  })
  if (sources.find((source) => source.id === "zoom")?.status !== "error" && endedPendingZoomEvents.length > 0) {
    fail("zoom", `${endedPendingZoomEvents.length} ended Zoom event(s) still have pending attendance.`)
  }

  const metricComparisons = [
    ["website", "GA4 sessions", Number(baseline.website?.overview?.sessions_30d ?? 0), websiteSessions],
    ["mailchimp", "Mailchimp subscribers", Number(baseline.marketing?.summary?.totalSubscribers ?? 0), Number(merged.marketing?.summary?.totalSubscribers ?? 0)],
    ["instagram", "Instagram followers", platformFollowers(baseline, "instagram"), platformFollowers(merged, "instagram")],
    ["facebook", "Facebook followers", platformFollowers(baseline, "facebook"), platformFollowers(merged, "facebook")],
    ["zoom", "Zoom participants", Number(baseline.events?.zoom?.stats?.totalParticipants ?? 0), Number(merged.events?.zoom?.stats?.totalParticipants ?? 0)],
    ["eventbrite", "Eventbrite tickets", Number(baseline.events?.eventbrite?.summary?.ticketsSold ?? 0), Number(merged.events?.eventbrite?.summary?.ticketsSold ?? 0)],
  ]
  for (const [id, label, priorValue, currentValue] of metricComparisons) {
    if (sources.find((source) => source.id === id)?.status !== "error" && relativeChange(priorValue, currentValue) > 0.25) {
      warn(id, `${label} changed by more than 25% (${priorValue} → ${currentValue}).`)
    }
  }

  for (const source of merged.dataSources ?? []) {
    if (source.status !== "error") {
      source.lastAttemptedAt = attemptedAt
      source.lastSuccessfulAt = source.lastPull ?? attemptedAt
    }
  }

  const errors = validations.filter((item) => item.level === "error")
  const warnings = validations.filter((item) => item.level === "warning")
  return {
    snapshot: merged,
    report: {
      generatedAt: now.toISOString(),
      status: errors.length ? "partial_failure" : "success",
      sources,
      validations,
      errorCount: errors.length,
      warningCount: warnings.length,
      metrics: {
        headline: Object.fromEntries(metricComparisons.map(([id, label, previousValue, currentValue]) => [id, {
          label,
          previous: previousValue,
          current: currentValue,
        }])),
        socialHistoryRows: {
          previous: previousSocialRows.length,
          current: candidateSocialRows.length,
        },
        cumulativeDetailRecords: {
          previous: previousCumulativeBySource,
          current: cumulativeBySource,
        },
        endedPendingZoomEvents: endedPendingZoomEvents.length,
      },
    },
  }
}

async function main() {
  const previousPath = resolve(process.argv[2] || "src/lib/admin/analytics/legacy-snapshot.json")
  const candidatePath = resolve(process.argv[3] || "data/legacy-snapshot-candidate.json")
  const statusPath = resolve(process.argv[4] || "data/analytics-source-status.json")
  const detailPath = resolve("data/analytics-source-detail-upload.json")
  const lastKnownGoodPath = resolve("data/analytics-last-known-good.json")
  const reportPath = resolve("data/analytics-validation-report.json")
  const outputPath = resolve(process.argv[5] || previousPath)
  if (!existsSync(candidatePath)) throw new Error(`Candidate snapshot is missing: ${candidatePath}`)

  const result = validateAndMergeAnalyticsSnapshot({
    previous: readJson(previousPath, {}),
    candidate: readJson(candidatePath, {}),
    pullStatus: readJson(statusPath, { sources: [] }),
    detailSummary: readJson(detailPath, {}),
    lastKnownGood: readJson(lastKnownGoodPath, readJson(previousPath, {})),
  })
  writeFileSync(outputPath, `${JSON.stringify(result.snapshot, null, 2)}\n`)
  writeFileSync(reportPath, `${JSON.stringify(result.report, null, 2)}\n`)
  writeFileSync(statusPath, `${JSON.stringify({
    generatedAt: result.report.generatedAt,
    status: result.report.status,
    sources: result.report.sources,
  }, null, 2)}\n`)
  console.log(`Validation status: ${result.report.status}`)
  for (const validation of result.report.validations) {
    console.log(`- ${validation.level}: ${validation.source}: ${validation.message}`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
