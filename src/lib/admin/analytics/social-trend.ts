export type SocialTrendMetric = "followers" | "engagementRate" | "posts"

export type SocialHistoryPoint = {
  period: string
  channel: string
  followers: number
  engagementRate: number
  posts: number
  timestamp: number
}

export function buildCarriedSocialTrend({
  points,
  channels,
  metric,
  includeTotal,
}: {
  points: SocialHistoryPoint[]
  channels: string[]
  metric: SocialTrendMetric
  includeTotal: boolean
}) {
  const latestByPeriodChannel = new Map<string, SocialHistoryPoint>()
  for (const point of points) {
    const key = `${point.period}:${point.channel}`
    const current = latestByPeriodChannel.get(key)
    if (!current || point.timestamp >= current.timestamp) latestByPeriodChannel.set(key, point)
  }
  const periods = Array.from(new Set(points.map((point) => point.period))).sort()
  const lastByChannel = new Map<string, SocialHistoryPoint>()
  return periods.map((period) => {
    const row: Record<string, string | number | null> = { month: period }
    for (const channel of channels) {
      const current = latestByPeriodChannel.get(`${period}:${channel}`)
      if (current) lastByChannel.set(channel, current)
      row[channel] = lastByChannel.get(channel)?.[metric] ?? null
    }
    row.total = includeTotal && metric === "followers" && channels.every((channel) => lastByChannel.has(channel))
      ? channels.reduce((sum, channel) => sum + Number(lastByChannel.get(channel)?.followers ?? 0), 0)
      : null
    return row
  })
}
