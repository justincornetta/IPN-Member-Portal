import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const SLACK_WEBHOOK_URL = process.env.SLACK_FEEDBACK_WEBHOOK_URL

const TYPE_LABELS: Record<string, string> = {
  bug: "Bug report",
  feedback: "Feedback",
  suggestion: "Suggestion",
}

const TYPE_EMOJIS: Record<string, string> = {
  bug: "🐛",
  feedback: "💬",
  suggestion: "💡",
}

async function sendSlackNotification(payload: {
  type: string
  message: string
  page: string
  userName: string
  userEmail: string
}) {
  if (!SLACK_WEBHOOK_URL) return

  const emoji = TYPE_EMOJIS[payload.type] ?? "📬"
  const label = TYPE_LABELS[payload.type] ?? payload.type

  await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `${emoji} ${label} from ${payload.userName}` },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*From:*\n${payload.userName} (${payload.userEmail})` },
            { type: "mrkdwn", text: `*Page:*\n${payload.page || "Unknown"}` },
          ],
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: payload.message },
        },
      ],
    }),
  }).catch(() => {})
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  let body: { type?: string; message?: string; page?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const type = body.type?.trim()
  const message = body.message?.trim()
  const page = body.page?.trim() ?? ""

  if (!type || !["bug", "feedback", "suggestion"].includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  }
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", user.id)
    .maybeSingle()

  const userName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Unknown"
  const userEmail = profile?.email ?? user.email ?? ""

  const { error } = await supabase.from("feedback_submissions").insert({
    user_id: user.id,
    user_name: userName,
    user_email: userEmail,
    page,
    type,
    message,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await sendSlackNotification({ type, message, page, userName, userEmail })

  return NextResponse.json({ ok: true })
}
