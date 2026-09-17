export type MailchimpAudienceContact = {
  audienceId: string
  audienceName: string
  subscriberHash: string
  status: string
}

export type MailchimpSubscriptionEvent = {
  audienceId: string
  audienceName: string
  subscriberHash: string
  newStatus: string
  occurredAt: string
  source: "initial_backfill" | "daily_reconciliation" | "webhook" | string
}

export type MailchimpContactAnalytics = {
  available: boolean
  contacts: MailchimpAudienceContact[]
  events: MailchimpSubscriptionEvent[]
  firstSyncedAt: string | null
  lastSyncedAt: string | null
}

export type MailchimpAudienceMetrics = {
  subscribers: number | null
  newSubscribers30d: number | null
  unsubscribes30d: number | null
  includesBackfill: boolean
}

function rollingWindowStart(through: string, days: number) {
  const date = new Date(`${through.slice(0, 10)}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - Math.max(0, days - 1))
  return date.toISOString().slice(0, 10)
}

export function buildMailchimpAudienceMetrics(
  analytics: MailchimpContactAnalytics,
  audienceName: string,
  through: string,
): MailchimpAudienceMetrics {
  if (!analytics.available) {
    return {
      subscribers: null,
      newSubscribers30d: null,
      unsubscribes30d: null,
      includesBackfill: false,
    }
  }

  const includesAudience = (row: { audienceName: string }) => audienceName === "all" || row.audienceName === audienceName
  const activeSubscriberHashes = new Set(
    analytics.contacts
      .filter((row) => includesAudience(row) && row.status === "subscribed")
      .map((row) => row.subscriberHash),
  )
  const start = rollingWindowStart(through, 30)
  const inWindow = analytics.events.filter((row) => (
    includesAudience(row)
    && row.occurredAt.slice(0, 10) >= start
    && row.occurredAt.slice(0, 10) <= through.slice(0, 10)
  ))
  const subscribed = new Set(
    inWindow.filter((row) => row.newStatus === "subscribed").map((row) => row.subscriberHash),
  )
  const unsubscribed = new Set(
    inWindow.filter((row) => row.newStatus === "unsubscribed").map((row) => row.subscriberHash),
  )

  return {
    subscribers: activeSubscriberHashes.size,
    newSubscribers30d: subscribed.size,
    unsubscribes30d: unsubscribed.size,
    includesBackfill: inWindow.some((row) => row.source === "initial_backfill"),
  }
}
