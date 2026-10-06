import { after } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  APPROVER_SLACK_ID,
  parseSlackAction,
  slack,
  verifySlack
} from "@/lib/leadership-workflows/integrations"
import { change, type Context } from "@/lib/leadership-workflows/server"
export async function POST(request: Request) {
  const raw = await request.text()
  if (
    raw.length > 100_000 ||
    !verifySlack(
      raw,
      request.headers.get("x-slack-signature"),
      request.headers.get("x-slack-request-timestamp"),
      process.env.WORKFLOW_SLACK_SIGNING_SECRET || ""
    )
  )
    return new Response("Invalid signature", { status: 401 })
  let payload: Record<string, unknown>
  try {
    payload = parseSlackAction(raw)
  } catch {
    return new Response("Invalid payload", { status: 400 })
  }
  const user = payload.user as { id?: string } | undefined
  const team = payload.team as { id?: string } | undefined
  if (
    user?.id !== APPROVER_SLACK_ID ||
    (process.env.WORKFLOW_SLACK_TEAM_ID &&
      team?.id !== process.env.WORKFLOW_SLACK_TEAM_ID)
  )
    return Response.json({
      response_type: "ephemeral",
      text: "Only Justin can approve IPN expenses."
    })
  const action = (
    payload.actions as { action_id?: string; value?: string }[] | undefined
  )?.[0]
  const isModal = payload.type === "view_submission"
  const view = payload.view as
    | {
        callback_id?: string
        private_metadata?: string
        state?: { values?: Record<string, Record<string, { value?: string }>> }
      }
    | undefined
  if (isModal && view?.callback_id !== "ipn_expense_reject")
    return new Response("Unsupported action", { status: 400 })
  if (
    !isModal &&
    !["ipn_expense_approve", "ipn_expense_reject"].includes(
      action?.action_id || ""
    )
  )
    return new Response("Unsupported action", { status: 400 })
  const value = isModal ? view?.private_metadata : action?.value
  const [id, revisionText] = (value || "").split(":")
  const revision = Number(revisionText)
  if (
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    return new Response("Invalid request", { status: 400 })
  if (!isModal && action?.action_id === "ipn_expense_reject") {
    try {
      await slack("views.open", {
        trigger_id: payload.trigger_id,
        view: {
          type: "modal",
          callback_id: "ipn_expense_reject",
          private_metadata: value,
          title: { type: "plain_text", text: "Reject expense" },
          submit: { type: "plain_text", text: "Reject" },
          close: { type: "plain_text", text: "Cancel" },
          blocks: [
            {
              type: "input",
              block_id: "reason",
              label: { type: "plain_text", text: "Reason" },
              element: {
                type: "plain_text_input",
                action_id: "note",
                multiline: true,
                max_length: 2000
              }
            }
          ]
        }
      })
      return new Response("")
    } catch {
      return Response.json({
        response_type: "ephemeral",
        text: "Open the request in the portal to record the rejection reason."
      })
    }
  }
  const note = isModal
    ? view?.state?.values?.reason?.note?.value?.trim() || ""
    : "Approved from Slack"
  if (isModal && !note)
    return Response.json({
      response_action: "errors",
      errors: { reason: "Add a reason for rejection." }
    })
  // Acknowledge within Slack's deadline; durable save and delivery happen after ACK.
  after(async () => {
    try {
      const db = createAdminClient()
      const { data: settings } = await db
        .from("leadership_workflow_settings")
        .select("expense_approver_id")
        .eq("singleton", true)
        .single()
      if (!settings) throw new Error("Database setup is pending.")
      const { data: p } = await db
        .from("profiles")
        .select("id,first_name,last_name,email,team,role,is_banned")
        .eq("id", settings.expense_approver_id)
        .single()
      if (!p || p.is_banned || !["admin", "superadmin"].includes(p.role))
        throw new Error("Approver access is unavailable.")
      const c: Context = {
        db,
        demo: false,
        approverId: p.id,
        user: {
          id: p.id,
          name: [p.first_name, p.last_name].filter(Boolean).join(" "),
          email: p.email || "",
          team: p.team
        }
      }
      await change(c, id, {
        revision,
        action: isModal ? "reject" : "approve",
        note
      })
    } catch (e) {
      console.error(
        "Slack expense action failed",
        e instanceof Error ? e.message : "Unknown failure"
      )
      await slack("chat.postMessage", {
        channel: APPROVER_SLACK_ID,
        text: "The expense decision could not be saved. It may have changed or already been reviewed. Open the latest request in the portal.",
        parse: "none"
      }).catch(() => {})
    }
  })
  return isModal
    ? Response.json({ response_action: "clear" })
    : Response.json({
        response_type: "ephemeral",
        text: "Saving your approval. The updated status will appear in this channel."
      })
}
