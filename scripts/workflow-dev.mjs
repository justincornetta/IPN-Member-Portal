import { spawn } from "node:child_process"
const env = {
  ...process.env,
  LEADERSHIP_LOCAL_DEMO: "1",
  WORKFLOW_INTEGRATION_MODE: "off",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-preview-placeholder"
}
for (const key of Object.keys(env))
  if (
    /(SERVICE_ROLE|SECRET|WEBHOOK|API_KEY|BOT_TOKEN|PRIVATE_KEY|GOOGLE_CLIENT_EMAIL)/.test(
      key
    )
  )
    delete env[key]
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    process.env.WORKFLOW_PORT || "4327"
  ],
  { env, stdio: "inherit" }
)
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal))
child.on("exit", (code) => process.exit(code ?? 0))
