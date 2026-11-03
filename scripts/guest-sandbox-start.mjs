import {spawn} from "node:child_process"
const env={...process.env,CONTEXT:"deploy-preview",REVIEW_ID:"70",BRANCH:"feature/guest-event-rsvp",DEPLOY_PRIME_URL:"http://127.0.0.1:4341",GUEST_EVENT_EMAIL_MODE:"off",NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",NEXT_PUBLIC_SUPABASE_ANON_KEY:"sandbox-placeholder"}
for(const key of Object.keys(env))if(/(SERVICE_ROLE|SECRET|WEBHOOK|API_KEY|BOT_TOKEN|PRIVATE_KEY|GOOGLE_CLIENT_EMAIL)/.test(key))delete env[key]
const child=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","4341"],{env,stdio:"inherit"})
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,()=>child.kill(signal))
child.on("exit",code=>process.exit(code??0))
