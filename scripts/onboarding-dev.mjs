import { appendFileSync, cpSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawn } from "node:child_process"

// Exercise the shipping onboarding pages in a disposable, credential-free copy.
const root = process.cwd(), target = resolve(root, ".qa-onboarding")
mkdirSync(target, { recursive: true })
for (const name of ["src", "public", "assets"]) {
  rmSync(resolve(target, name), { recursive: true, force: true })
  cpSync(resolve(root, name), resolve(target, name), { recursive: true })
}
for (const name of ["package.json", "package-lock.json", "tsconfig.json", "postcss.config.mjs"])
  cpSync(resolve(root, name), resolve(target, name))
if (!existsSync(resolve(target, "node_modules"))) symlinkSync(resolve(root, "node_modules"), resolve(target, "node_modules"), "dir")
writeFileSync(resolve(target, "next.config.ts"), `export default {turbopack:{root:${JSON.stringify(root)}},logging:{serverFunctions:false}}\n`)
appendFileSync(resolve(target, "src/app/globals.css"), `\n@source "${root}/src";\n`)
writeFileSync(resolve(target, "src/lib/supabase/server.ts"), `export async function createClient(){return {auth:{getUser:async()=>({data:{user:{id:'qa-member'}}})}}}\n`)
writeFileSync(resolve(target, "src/lib/onboarding/actions.ts"), `'use server'\nexport async function saveOnboardingFlowProgress(){return {}}\n`)
writeFileSync(resolve(target, "src/components/PortalAnalyticsTracker.tsx"), `export default function PortalAnalyticsTracker(){return null}\n`)
writeFileSync(resolve(target, "src/middleware.ts"), `import {NextResponse} from 'next/server'\nexport function middleware(){return NextResponse.next()}\n`)
// A neutral destination confirms navigation without exercising unrelated dashboard integrations.
rmSync(resolve(target, "src/app/dashboard"), { recursive: true, force: true })
mkdirSync(resolve(target, "src/app/dashboard"), { recursive: true })
writeFileSync(resolve(target, "src/app/dashboard/page.tsx"), `export default function Dashboard(){return <main><h1>Member portal QA destination</h1></main>}\n`)
rmSync(resolve(target, "src/app/api"), { recursive: true, force: true })
const api = resolve(target, "src/app/api/whatsapp/handoffs/permanent/[slug]")
mkdirSync(api, { recursive: true })
writeFileSync(resolve(api, "route.ts"), `export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){const {slug}=await params;return Response.json({handoffPath:'/go/whatsapp/'+slug,expiresAt:new Date(Date.now()+600000).toISOString(),channel:{kind:'permanent',slug,label:slug,featured:false}})}\n`)
rmSync(resolve(target, "src/app/go"), { recursive: true, force: true })
mkdirSync(resolve(target, "src/app/go/whatsapp/[slug]"), { recursive: true })
writeFileSync(resolve(target, "src/app/go/whatsapp/[slug]/page.tsx"), `export default function Channel(){return <h1>Local channel handoff</h1>}\n`)
writeFileSync(resolve(target, ".gitignore"), "*\n")
// No .env files or integration credentials are copied or inherited.
const env = Object.fromEntries(["PATH", "HOME", "TMPDIR", "LANG", "SHELL"].filter(key => process.env[key]).map(key => [key, process.env[key]]))
Object.assign(env, { NEXT_PUBLIC_SUPABASE_URL: "https://qa.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "preview-placeholder", NEXT_TELEMETRY_DISABLED: "1", WORKFLOW_INTEGRATION_MODE: "off" })
const child = spawn(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", process.env.ONBOARDING_PORT || "4360"], { cwd: target, env, stdio: "inherit" })
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal))
child.on("exit", code => process.exit(code ?? 0))
