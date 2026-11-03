import {appendFileSync,readFileSync,cpSync,existsSync,mkdirSync,rmSync,symlinkSync,writeFileSync} from "node:fs"
import {resolve} from "node:path"
import {spawn} from "node:child_process"

// Build an isolated copy for QA, replacing only integration boundaries.
// No fixture routes, credentials or simulation flags ship in the application.
const root=process.cwd(), target=resolve(root,".qa-guest")
mkdirSync(target,{recursive:true})
for(const name of ["src","public","assets"]){
  rmSync(resolve(target,name),{recursive:true,force:true})
  cpSync(resolve(root,name),resolve(target,name),{recursive:true})
}
for(const name of ["package.json","package-lock.json","tsconfig.json","postcss.config.mjs"])
  cpSync(resolve(root,name),resolve(target,name))
if(!existsSync(resolve(target,"node_modules")))symlinkSync(resolve(root,"node_modules"),resolve(target,"node_modules"),"dir")
writeFileSync(resolve(target,"next.config.ts"),`export default {turbopack:{root:${JSON.stringify(root)}},logging:{serverFunctions:false}}\n`)
appendFileSync(resolve(target,"src/app/globals.css"),`\n@source "${root}/src";\n`)
const fixtures=resolve(target,"src/lib/qa-fixtures")
mkdirSync(fixtures,{recursive:true})
for(const name of ["demo.ts","supabase.ts"])cpSync(resolve(root,"qa/guest-events/fixtures",name),resolve(fixtures,name))
for(const name of ["server","admin"])
  writeFileSync(resolve(target,`src/lib/supabase/${name}.ts`),'export {createClient,createAdminClient} from "../qa-fixtures/supabase"\n')
cpSync(resolve(root,"qa/guest-events/fixtures/event-actions.ts"),resolve(target,"src/lib/events/actions.ts"))
cpSync(resolve(root,"qa/guest-events/fixtures/auth-actions.ts"),resolve(target,"src/lib/auth/actions.ts"))
cpSync(resolve(root,"qa/guest-events/fixtures/event.jpg"),resolve(target,"public/events/guest-rsvp-preview.jpg"))
writeFileSync(resolve(target,"src/app/api/locations/verify/route.ts"),'export async function POST(){return Response.json({candidates:[]})}\n')
const env={...process.env,CONTEXT:"production",GUEST_EVENT_RSVP_ENABLED:"true",GUEST_EVENT_EMAIL_MODE:"live",GUEST_EVENT_TOKEN_SECRET:"qa-only-token-not-a-production-secret",NEXT_PUBLIC_SITE_URL:"https://qa.invalid",NEXT_PUBLIC_SUPABASE_URL:"https://qa.invalid",NEXT_PUBLIC_SUPABASE_ANON_KEY:"qa-placeholder"}
for(const key of Object.keys(env))if(/(SERVICE_ROLE|SECRET|WEBHOOK|API_KEY|BOT_TOKEN|PRIVATE_KEY|GOOGLE_CLIENT_EMAIL)/.test(key))delete env[key]
env.GUEST_EVENT_TOKEN_SECRET="qa-only-token-not-a-production-secret"
env.RESEND_API_KEY="qa-placeholder-never-used"
// Do not copy .env files: the fixture cannot inherit local integration secrets.
writeFileSync(resolve(target,".gitignore"),"*\n")
// Enable observation capture only inside the disposable QA copy. The local
// analytics API still discards requests; no analytics database is contacted.
const analyticsClient=resolve(target,"src/lib/portal-analytics/client.ts")
writeFileSync(analyticsClient,readFileSync(analyticsClient,"utf8").replace(' || process.env.NODE_ENV !== "production"',''))
mkdirSync(resolve(target,"src/app/rsvp-analytics-review"),{recursive:true})
writeFileSync(resolve(target,"src/app/rsvp-analytics-review/page.tsx"),`import Panel from "@/app/dashboard/admin/EventRsvpAnalytics";
export default function Review(){return <main className="p-6 bg-zinc-50 text-zinc-900"><Panel journeys={[
{date:"2026-11-03",eventSlug:"global-psychedelic-week-so-you-want-to-be-a-psychedelic-professional",path:"guest",stages:["open","submit","error","confirmed","signup"],signupCompleted:true},
{date:"2026-11-03",eventSlug:"global-psychedelic-week-so-you-want-to-be-a-psychedelic-professional",path:"member",stages:["view","submit","confirmed","join"],signupCompleted:false}
]}/></main>}`)
const child=spawn(process.execPath,[resolve(root,"node_modules/next/dist/bin/next"),"dev","--hostname","127.0.0.1","--port","4331"],{cwd:target,env,stdio:"inherit"})
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal))
child.on("exit",code=>process.exit(code??0))
