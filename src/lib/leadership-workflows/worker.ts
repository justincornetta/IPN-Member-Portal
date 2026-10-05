import type { SupabaseClient } from "@supabase/supabase-js"
import type { WorkflowRequest } from "./domain"
import { deliverJob } from "./integrations"
type DB = SupabaseClient
export type IntegrationJob = {
  id: string
  request_id: string
  target: string
  event: string
  recipient_id: string | null
  payload: WorkflowRequest
  attempts: number
}
export async function drainJobs(db: DB, requestId?: string) {
  let q = db
    .from("leadership_integration_jobs")
    .select("id")
    .neq("state", "done")
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at")
    .limit(30)
  if (requestId) q = q.eq("request_id", requestId)
  const { data } = await q
  for (const pending of data ?? []) {
    const { data: claimed } = await db.rpc("leadership_claim_job", {
      p_id: pending.id
    })
    const job = claimed?.[0] as IntegrationJob | undefined
    if (!job) continue
    try {
      let sheetLocked = false
      if (job.target === "sheets") {
        const lock = await db.rpc("leadership_acquire_sheet_lock", {
          p_owner: job.id
        })
        if (lock.error || lock.data !== true)
          throw new Error("Tracker sync is busy; retry queued.")
        sheetLocked = true
      }
      let result
      try {
        result = await deliverJob(db, job)
      } finally {
        if (sheetLocked)
          await db
            .from("leadership_delivery_locks")
            .delete()
            .eq("name", "sheets")
            .eq("owner", job.id)
      }
      await db
        .from("leadership_integration_jobs")
        .update({ state: "done", result, last_error: null })
        .eq("id", job.id)
    } catch (e) {
      await db
        .from("leadership_integration_jobs")
        .update({
          state: "pending",
          last_error: e instanceof Error ? e.message : "Delivery failed",
          next_attempt_at: new Date(
            Date.now() + Math.min(60, 2 ** Math.min(job.attempts, 6)) * 60_000
          ).toISOString()
        })
        .eq("id", job.id)
    }
  }
}
