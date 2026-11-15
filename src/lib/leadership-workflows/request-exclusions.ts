// Server-managed quarantine for simulated requests stored during deploy-preview QA.
// Keep the original records/history; never deliver or mutate them in live workflows.
// Built-in IDs take effect in every deploy; WORKFLOW_EXCLUDED_REQUEST_IDS can add more.
export const BUILT_IN_EXCLUDED_REQUEST_IDS = [
  // Oct 6, 2026 TEST — Slack approval check (do not purchase), $1.
  // Already synced to Expense Requests row 6; hide it from later workflow syncs.
  "6d4e4dce-0a2a-4c08-8ea6-5cfe34e6d6ab"
] as const

function excludedRequestIds(): string[] {
  return [
    ...BUILT_IN_EXCLUDED_REQUEST_IDS,
    ...(process.env.WORKFLOW_EXCLUDED_REQUEST_IDS || "").split(",")
  ]
    .map((value) => value.trim())
    .filter(Boolean)
}

export function isExcludedRequest(id: string): boolean {
  return excludedRequestIds().includes(id)
}
