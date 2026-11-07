import { appendFileSync, cpSync, existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawn } from "node:child_process"

// Follow the existing guest-events QA pattern: integration replacements live
// only in a disposable copy, never in production source or environment flags.
const root = process.cwd(), target = resolve(root, ".qa-performance")
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
const fixtures = resolve(target, "src/lib/performance-fixtures")
mkdirSync(fixtures, { recursive: true })
for (const name of ["data.ts", "server.ts"]) cpSync(resolve(root, "qa/performance/fixtures", name), resolve(fixtures, name))
for (const name of ["server", "admin"])
  writeFileSync(resolve(target, `src/lib/supabase/${name}.ts`), 'export {createClient,createAdminClient} from "../performance-fixtures/server"\n')
writeFileSync(resolve(target,"src/lib/connections/actions.ts"), `'use server'\nexport async function getConnectionDetails(){return {error:"Connection details are disabled in this performance preview."}}\nexport async function sendConnectionRequest(){return {error:"Connection changes are disabled in this performance preview."}}\nexport async function acceptConnection(){return {error:"Connection changes are disabled in this performance preview."}}\nexport async function removeConnection(){return {error:"Connection changes are disabled in this performance preview."}}\nexport async function declineConnection(){return {error:"Connection changes are disabled in this performance preview."}}\n`)
writeFileSync(resolve(target,"src/lib/auth/actions.ts"), `'use server'\nexport async function signOut(){}\nexport async function signIn(){return {error:"Preview only"}}\nexport async function signUp(){return {error:"Preview only"}}\nexport async function requestPasswordReset(){return {error:"Preview only"}}\nexport async function updatePassword(){return {error:"Preview only"}}\n`)
writeFileSync(resolve(target,"src/middleware.ts"), `import {NextResponse} from "next/server"\nimport type {NextRequest} from "next/server"\nexport function middleware(request:NextRequest){\nif(request.nextUrl.pathname.startsWith('/api/') || (request.method!=='GET' && request.nextUrl.pathname!=='/dashboard/directory')) return new NextResponse('Disabled in local preview',{status:403})\nreturn NextResponse.next()\n}\n`)
mkdirSync(resolve(target,"src/app/performance-preview"),{recursive:true})
writeFileSync(resolve(target,"src/app/performance-preview/page.tsx"), `import Link from 'next/link'\nexport default function Preview(){return <main className="mx-auto max-w-2xl p-8 text-zinc-900"><h1 className="text-2xl font-semibold">Community and Events preview</h1><p className="mt-4">Fictional members and events. This local preview uses the real pages and loading components with simulated database reads. Connection changes and external integrations are disabled.</p><div className="mt-6 flex flex-col gap-4"><Link href="/preview-settings?delay=0&next=/dashboard/directory">Open Community</Link><Link href="/preview-settings?delay=0&next=/dashboard/events">Open Events</Link><Link href="/preview-settings?delay=800&next=/dashboard/events">Try slower loading (800 ms per database read)</Link><Link href="/preview-settings?delay=0&fail=profiles&next=/dashboard/directory">Try Community error state</Link><Link href="/preview-settings?delay=0&next=/dashboard/directory">Reset preview</Link></div></main>}\n`)
mkdirSync(resolve(target,"src/app/preview-settings"),{recursive:true})
writeFileSync(resolve(target,"src/app/preview-settings/route.ts"), `import {NextRequest,NextResponse} from 'next/server'\nexport function GET(request:NextRequest){const url=request.nextUrl;const next=url.searchParams.get('next');const response=new NextResponse(null,{status:307,headers:{Location:next==='/dashboard/events'?next:'/dashboard/directory'}});response.cookies.set('qa-delay',url.searchParams.get('delay')||'0');response.cookies.set('qa-fail',url.searchParams.get('fail')||'');return response}\n`)
writeFileSync(resolve(target,".gitignore"),"*\n")
// Do not copy any .env files. Use an allowlist instead of inheriting integrations.
const env = Object.fromEntries(["PATH","HOME","TMPDIR","LANG","SHELL"].filter(key=>process.env[key]).map(key=>[key,process.env[key]]))
Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:"https://qa.invalid",NEXT_PUBLIC_SUPABASE_ANON_KEY:"preview-placeholder",NEXT_TELEMETRY_DISABLED:"1",WORKFLOW_INTEGRATION_MODE:"off"})
const child=spawn(process.execPath,[resolve(root,"node_modules/next/dist/bin/next"),"dev","--hostname","127.0.0.1","--port",process.env.PERFORMANCE_PORT||"4341"],{cwd:target,env,stdio:"inherit"})
for (const signal of ["SIGINT","SIGTERM"]) process.on(signal,()=>child.kill(signal))
child.on("exit",code=>process.exit(code??0))
