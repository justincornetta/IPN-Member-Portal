const WIDGETBOT_BASE_URL = "https://e.widgetbot.io/channels"

export function buildWidgetBotUrl(channelId?: string | null): string | null {
  const serverId = process.env.NEXT_PUBLIC_WIDGETBOT_SERVER_ID
  if (!serverId || !channelId) return null
  return `${WIDGETBOT_BASE_URL}/${serverId}/${channelId}`
}

export function getAnnouncementsWidgetBotUrl(): string | null {
  return buildWidgetBotUrl(process.env.NEXT_PUBLIC_WIDGETBOT_JOIN_EVENTS_CHANNEL_ID)
}
