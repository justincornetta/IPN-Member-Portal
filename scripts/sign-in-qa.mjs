import {appendFileSync,cpSync,existsSync,mkdirSync,readFileSync,rmSync,symlinkSync,writeFileSync} from "node:fs"
import {resolve} from "node:path"
import {execFileSync,spawn} from "node:child_process"

const root=process.cwd(), before=process.env.QA_SIGN_IN_BASELINE==="1"
const target=resolve(root,before?".qa-sign-in-before":".qa-sign-in-after")
mkdirSync(target,{recursive:true})
for(const name of ["src","public","assets"]){rmSync(resolve(target,name),{recursive:true,force:true});cpSync(resolve(root,name),resolve(target,name),{recursive:true})}
for(const name of ["package.json","package-lock.json","tsconfig.json","postcss.config.mjs"])cpSync(resolve(root,name),resolve(target,name))
if(!existsSync(resolve(target,"node_modules")))symlinkSync(resolve(root,"node_modules"),resolve(target,"node_modules"),"dir")
writeFileSync(resolve(target,"next.config.ts"),`export default {turbopack:{root:${JSON.stringify(root)}},logging:{serverFunctions:false}}\n`)
writeFileSync(resolve(target,".gitignore"),"*\n")
appendFileSync(resolve(target,"src/app/globals.css"),`\n@source "${root}/src";\n`)
const fixtures=resolve(target,"src/lib/sign-in-fixtures");mkdirSync(fixtures,{recursive:true})
cpSync(resolve(root,"qa/performance/fixtures/data.ts"),resolve(fixtures,"data.ts"))
for(const name of ["server.ts","state.ts"])writeFileSync(resolve(fixtures,name),readFileSync(resolve(root,"qa/sign-in",name),"utf8").replace('"../performance/fixtures/data"','"./data"'))
for(const name of ["server","admin"])writeFileSync(resolve(target,`src/lib/supabase/${name}.ts`),'export {createClient,createAdminClient} from "../sign-in-fixtures/server"\n')
// The real login UI, action, redirects and Home render remain intact. Only
// external integration boundaries are replaced in this disposable copy.
if(before)writeFileSync(resolve(target,"src/lib/auth/actions.ts"),execFileSync("git",["show","5a23bd6:src/lib/auth/actions.ts"],{cwd:root}))
const eventPath=resolve(target,"src/lib/portal-analytics/events.ts")
const eventSource=readFileSync(eventPath,"utf8")
writeFileSync(eventPath,'import {recordFixtureAnalytics} from "../sign-in-fixtures/state"\n'+eventSource.slice(0,eventSource.indexOf('export async function recordPortalAnalyticsEvent('))+`export async function recordPortalAnalyticsEvent(payload: PortalAnalyticsPayload & {userId?:string|null;occurredAt?:string}) {await recordFixtureAnalytics(payload.eventName)}\n`)
writeFileSync(resolve(target,"src/middleware.ts"),`import {NextResponse} from "next/server";import type {NextRequest} from "next/server";export function middleware(request:NextRequest){const path=request.nextUrl.pathname;if(request.method!=="GET" && path!=="/login" && path!=="/api/sign-in-qa" && path!=="/api/portal-analytics")return new NextResponse("Disabled in QA",{status:403});return NextResponse.next()}\n`)
writeFileSync(resolve(target,"src/app/api/portal-analytics/route.ts"),'export async function POST(){return new Response(null,{status:204})}\n')
const api=resolve(target,"src/app/api/sign-in-qa");mkdirSync(api,{recursive:true})
writeFileSync(resolve(api,"route.ts"),'import {entries,reset} from "@/lib/sign-in-fixtures/state";export async function GET(){return Response.json(entries())}export async function POST(){reset();return Response.json({ok:true})}\n')
const env=Object.fromEntries(["PATH","HOME","TMPDIR","LANG","SHELL"].filter(k=>process.env[k]).map(k=>[k,process.env[k]]))
Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:"https://qa.invalid",NEXT_PUBLIC_SUPABASE_ANON_KEY:"qa-placeholder",NEXT_TELEMETRY_DISABLED:"1",WORKFLOW_INTEGRATION_MODE:"off",GUEST_EVENT_RSVP_ENABLED:"false"})
const next=resolve(root,"node_modules/next/dist/bin/next")
execFileSync(process.execPath,[next,"build"],{cwd:target,env,stdio:"inherit"})
const child=spawn(process.execPath,[next,"start","--hostname","127.0.0.1","--port",before?"4350":"4351"],{cwd:target,env,stdio:"inherit"})
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal))
child.on("exit",code=>process.exit(code??0))
