import {chromium,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {writeFileSync} from 'node:fs'
const browser=await chromium.launch()
const results={method:'Local production builds: real login UI/action/redirect/Home, simulated auth150ms, database100ms per read, analytics1000ms. Wall time from click to Members to know visible. Fresh browser context each run; includes automation overhead. No live auth, DB, RSVP or analytics writes.',before:[],after:[]}
for(let i=0;i<5;i++)for(const variant of ['before','after']){
 const base=`http://127.0.0.1:${variant==='before'?4350:4351}`
 const context=await browser.newContext();const page=await context.newPage();const errors=[],adminRequests=[]
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/dashboard/admin'))adminRequests.push(r.url())})
 await page.request.post(`${base}/api/sign-in-qa`)
 await page.goto(`${base}/login`)
 await page.getByLabel('Email',{exact:true}).fill(i===4?'admin@example.test':'member@example.test')
 await page.getByLabel('Password',{exact:true}).fill('preview-password')
 const started=performance.now();await page.getByRole('button',{name:'Sign in',exact:true}).click()
 await page.getByRole('heading',{name:'Members to know',exact:true}).waitFor()
 const elapsedMs=Math.round(performance.now()-started)
 const atVisible=await (await page.request.get(`${base}/api/sign-in-qa`)).json()
 await expect.poll(async()=> (await (await page.request.get(`${base}/api/sign-in-qa`)).json()).some(e=>e.event==='sign_in_success-complete')).toBe(true)
 const events=await (await page.request.get(`${base}/api/sign-in-qa`)).json()
 assert.deepEqual(adminRequests,[]);assert.deepEqual(errors,[])
 await expect(page.locator('nextjs-portal [data-nextjs-dialog]')).toHaveCount(0)
 assert.equal(await page.getByText('Admin',{exact:true}).count(),i===4?1:0)
 const analyticsCompleteAtVisible=atVisible.some(e=>e.event==='sign_in_success-complete')
 assert.equal(analyticsCompleteAtVisible,variant==='before')
 results[variant].push({elapsedMs,role:i===4?'admin':'member',analyticsCompleteAtVisible,events:events.map(e=>({event:e.event,relativeMs:e.at-events[0].at})),adminRequests:adminRequests.length})
 console.log(`${variant} ${i+1}: ${elapsedMs}ms, analytics complete at content: ${analyticsCompleteAtVisible}`)
 await context.close()
}
// Exercise the real form's failure state without a successful session.
const page=await browser.newPage();await page.goto('http://127.0.0.1:4351/login')
await page.getByLabel('Email',{exact:true}).fill('member@example.test');await page.getByLabel('Password',{exact:true}).fill('wrong')
const started=performance.now();await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByText('Invalid login credentials',{exact:true}).waitFor()
results.invalidCredentialsMs=Math.round(performance.now()-started)
await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeEnabled()
await expect.poll(async()=> (await (await page.request.get('http://127.0.0.1:4351/api/sign-in-qa')).json()).some(e=>e.event==='sign_in_error-complete')).toBe(true)
writeFileSync('docs/navigation-performance/sign-in-measurements.json',JSON.stringify(results,null,2)+'\n')
await browser.close()
