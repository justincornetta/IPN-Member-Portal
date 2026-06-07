import { runContentSync } from "../../src/lib/sync/content"

export default async function handler() {
  const result = await runContentSync()

  return new Response(JSON.stringify({ ok: true, result }), {
    headers: { "content-type": "application/json" },
  })
}

export const config = {
  schedule: "@hourly",
}
