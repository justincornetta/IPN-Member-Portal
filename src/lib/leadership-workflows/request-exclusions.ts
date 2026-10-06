// Server-managed quarantine for simulated requests stored during deploy-preview QA.
// Keep the original records/history; never deliver or mutate them in live workflows.
export function isExcludedRequest(id: string): boolean {
  return (process.env.WORKFLOW_EXCLUDED_REQUEST_IDS || "")
    .split(",")
    .some((value) => value.trim() === id)
}
