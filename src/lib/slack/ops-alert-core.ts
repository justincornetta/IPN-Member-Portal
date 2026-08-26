const WEBHOOK_TIMEOUT_MS = 10000

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Best-effort internal alert for failures that would otherwise only show up
 * in server logs (e.g. permanently dead-lettered notifications). No-ops
 * silently if SLACK_OPS_ALERTS_WEBHOOK_URL isn't configured — this is a
 * supplement to console logging, not a replacement.
 */
export async function sendOpsAlert(
  title: string,
  details: Record<string, string>,
): Promise<void> {
  const webhookUrl = process.env.SLACK_OPS_ALERTS_WEBHOOK_URL
  if (!webhookUrl) return

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        text: title,
        blocks: [
          { type: "header", text: { type: "plain_text", text: title } },
          {
            type: "section",
            fields: Object.entries(details).map(([label, value]) => ({
              type: "mrkdwn",
              text: `*${label}:*\n${value}`,
            })),
          },
        ],
      }),
    })
    if (!response.ok) {
      console.error("[ops-alert] Slack post failed", response.status, response.statusText)
    }
  } catch (error) {
    console.error("[ops-alert] Slack post failed:", errorMessage(error))
  } finally {
    clearTimeout(timeout)
  }
}
