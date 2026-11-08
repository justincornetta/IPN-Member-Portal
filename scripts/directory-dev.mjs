import {appendFileSync,cpSync,existsSync,mkdirSync,rmSync,symlinkSync,writeFileSync} from "node:fs"
import {resolve} from "node:path"
import {spawn} from "node:child_process"
const root=process.cwd(),target=resolve(root,".qa-directory")
mkdirSync(target,{recursive:true})
for(const name of ["src","public","assets"]){rmSync(resolve(target,name),{recursive:true,force:true});cpSync(resolve(root,name),resolve(target,name),{recursive:true})}
for(const name of ["package.json","package-lock.json","tsconfig.json","postcss.config.mjs"])cpSync(resolve(root,name),resolve(target,name))
if(!existsSync(resolve(target,"node_modules")))symlinkSync(resolve(root,"node_modules"),resolve(target,"node_modules"),"dir")
writeFileSync(resolve(target,"next.config.ts"),`export default {turbopack:{root:${JSON.stringify(root)}},logging:{serverFunctions:false}}\n`)
writeFileSync(resolve(target,".gitignore"),"*\n")
appendFileSync(resolve(target,"src/app/globals.css"),`\n@source "${root}/src";\n`)
const fixtures=resolve(target,"src/lib/directory-fixtures");mkdirSync(fixtures,{recursive:true})
for(const name of ["state.ts","server.ts"])cpSync(resolve(root,"qa/directory/fixtures",name),resolve(fixtures,name))
for(const name of ["server","admin"])writeFileSync(resolve(target,`src/lib/supabase/${name}.ts`),'export {createClient,createAdminClient} from "../directory-fixtures/server"\n')
writeFileSync(resolve(target,"src/middleware.ts"),'import {NextResponse} from "next/server"; export function middleware(){return NextResponse.next()}\n')
// Exercise the real connection server actions and revalidatePath, but never send notifications.
writeFileSync(resolve(target,"src/lib/member-notifications/email-service.ts"),'export async function notifyConnectionRequestAccepted(){}; export async function notifyConnectionRequestReceived(){}\n')
cpSync(resolve(root,"qa/directory/fixtures/page.tsx"),resolve(target,"src/app/dashboard/directory/page.tsx"))
const api=resolve(target,"src/app/api/directory-qa");mkdirSync(api,{recursive:true})
writeFileSync(resolve(api,"route.ts"),`import {state,reset,userId,idFor} from "@/lib/directory-fixtures/state";
export async function GET(){return Response.json(state())}
export async function POST(request:Request){const input=await request.json();if(input.reset)reset();if(input.failNext)state().failNext=true;if(input.loadMoreFailure)state().loadMoreFailure=true;if(input.contactFailure!==undefined)state().contactFailure=input.contactFailure;if(input.incoming!==undefined)state().connections.push({id:"incoming",requester_id:idFor(input.incoming),addressee_id:userId,status:"pending"});return Response.json({ok:true})}`)
const env=Object.fromEntries(["PATH","HOME","TMPDIR","LANG","SHELL"].filter(key=>process.env[key]).map(key=>[key,process.env[key]]))
Object.assign(env,{NEXT_PUBLIC_SUPABASE_URL:"https://qa.invalid",NEXT_PUBLIC_SUPABASE_ANON_KEY:"qa-placeholder",NEXT_TELEMETRY_DISABLED:"1",PORTAL_EVENT_EMAIL_MODE:"off",WORKFLOW_INTEGRATION_MODE:"off"})
// No .env files or live credentials are copied. All database access fails closed in fixtures.
const child=spawn(process.execPath,[resolve(root,"node_modules/next/dist/bin/next"),"dev","--hostname","127.0.0.1","--port","4342"],{cwd:target,env,stdio:"inherit"})
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal))
child.on("exit",code=>process.exit(code??0))
