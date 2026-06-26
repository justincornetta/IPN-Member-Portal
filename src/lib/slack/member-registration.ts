import "server-only"

import { PERSONA_OPTIONS } from "@/lib/constants/registration"
import type { RegistrationData } from "@/lib/auth/actions"

const WEBHOOK_TIMEOUT_MS = 10000

const personaLabels = new Map<string, string>(
  PERSONA_OPTIONS.map((option) => [option.value, option.label]),
)

function escapeSlackText(value: string | null | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return "Not provided"

  return trimmed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function field(label: string, value: string) {
  return {
    type: "mrkdwn" as const,
    text: `*${label}:*\n${escapeSlackText(value)}`,
    verbatim: true,
  }
}

function section(label: string, value: string) {
  return {
    type: "section" as const,
    text: {
      type: "mrkdwn" as const,
      text: `*${label}:*\n${escapeSlackText(value)}`,
      verbatim: true,
    },
  }
}

function formatLocation(data: RegistrationData): string {
  return [data.city, data.state, data.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ")
}

function formatBackground(data: RegistrationData): string {
  const persona = personaLabels.get(data.persona) ?? data.persona
  const affiliation = data.school ?? data.affiliation ?? ""
  return [persona, affiliation].filter(Boolean).join(" - ")
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function postToSlack(webhookUrl: string, body: unknown): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error("Member registration Slack notification failed", {
        status: response.status,
        statusText: response.statusText,
      })
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function sendMemberRegistrationSlackNotification(
  data: RegistrationData,
): Promise<void> {
  const webhookUrl = process.env.SLACK_MEMBER_REGISTRATIONS_WEBHOOK_URL
  if (!webhookUrl) return

  const fullName = [data.first_name, data.last_name].filter(Boolean).join(" ")
  const payload = {
    text: `New member registration: ${fullName || data.email}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "New member registration",
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Full Name:*\n${escapeSlackText(fullName)}`,
            verbatim: true,
          },
          field("Location", formatLocation(data)),
          field("Background", formatBackground(data)),
          field("How Did They Hear About Us", data.referral_source),
        ],
      },
      section(
        "What is your current role or interest, and what are your professional goals?",
        data.role_and_goals,
      ),
      section("What inspired you to get involved with IPN?", data.inspiration),
      section(
        "What resource or support would help you most right now?",
        data.support_needs,
      ),
    ],
  }

  await postToSlack(webhookUrl, payload).catch((error: unknown) => {
    console.error(
      "Member registration Slack notification failed",
      errorMessage(error),
    )
  })
}
