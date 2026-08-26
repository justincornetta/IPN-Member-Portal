import type { Config, Context } from "@netlify/functions"
import {
  memberNotificationMode,
  processPendingMemberNotifications,
} from "../../src/lib/member-notifications/email-service"

export default async function runConferenceNotificationQa(
  request: Request,
  context: Context,
) {
  const isApprovedPreview =
    request.method === "POST" &&
    context.deploy?.context === "deploy-preview" &&
    memberNotificationMode() === "test"

  if (!isApprovedPreview) return new Response(null, { status: 404 })

  try {
    const result = await processPendingMemberNotifications()
    return Response.json({ ok: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

export const config: Config = {
  path: "/__qa/conference-notifications-pr58-20260826",
}
