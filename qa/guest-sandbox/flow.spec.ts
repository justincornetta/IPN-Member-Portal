import {test,expect} from "@playwright/test"
import {completeRegistrationPreview} from "../registration-preview"
const slug="global-psychedelic-week-so-you-want-to-be-a-psychedelic-professional"
const event="/events/"+slug
const dir="docs/guest-event-rsvp/screenshots"

for(const width of [1440,1280,390])test(`isolated hosted guest RSVP, inbox, signup and cancellation at ${width}px`,async({page,browser})=>{
 await page.setViewportSize({width,height:900})
 const errors:string[]=[],external:string[]=[]
 page.on("pageerror",e=>errors.push(e.message))
 page.on("console",m=>{if(m.type()==="error")errors.push(m.text())})
 page.on("request",r=>{if(/supabase|resend|\/api\/analytics/.test(r.url()))external.push(r.url())})
 await page.goto(event)
 await expect(page.getByRole("complementary",{name:"Test preview"})).toBeVisible()
 await expect(page.getByText(/Before his involvement/)).toContainText("community support and ancient mind-body practices.")
 await page.screenshot({path:`${dir}/sandbox-${width}-landing.png`,fullPage:true})
 await page.getByRole("button",{name:"RSVP without an account",exact:true}).click()
 await page.getByLabel("First name",{exact:true}).fill("Sandbox")
 await page.getByLabel("Last name",{exact:true}).fill("Tester")
 await page.getByLabel("Email",{exact:true}).fill(`sandbox-${width}@example.com`)
 await page.getByRole("button",{name:"Confirm RSVP",exact:true}).click()
 await expect(page.getByRole("heading",{name:"You’re registered",exact:true})).toBeVisible()
 await expect(page.getByRole("link",{name:"Open the preview inbox",exact:true})).toBeVisible()
 await page.getByRole("link",{name:/Join IPN free/}).click()
 await expect(page).toHaveURL(/\/register\?from=event$/)
 await expect(page.getByLabel("Email",{exact:true})).toHaveValue(`sandbox-${width}@example.com`)
 await page.screenshot({path:`${dir}/sandbox-${width}-registration.png`,fullPage:true})
 await completeRegistrationPreview(page)
 await page.screenshot({path:`${dir}/sandbox-${width}-signup.png`,fullPage:true})
 await page.goto("/register")
 await expect(page.getByLabel("Email",{exact:true})).toHaveValue("")
 await page.getByRole("link",{name:"Preview inbox",exact:true}).click()
 await expect(page.frameLocator('iframe[title="rsvp confirmation"]').getByText("Hi Sandbox,",{exact:true})).toBeVisible()
 for(const kind of ["rsvp confirmation","reminder 24h","reminder 1h","membership invitation"]){
  const frame=page.locator(`iframe[title="${kind}"]`)
  await frame.scrollIntoViewIfNeeded()
  await expect(page.frameLocator(`iframe[title="${kind}"]`).getByRole("heading",{level:1})).toBeVisible()
 }
 await page.screenshot({path:`${dir}/sandbox-${width}-inbox.png`,fullPage:true})
 const fresh=await browser.newContext()
 const separate=await fresh.newPage()
 await separate.goto("http://127.0.0.1:4341/event-preview/emails")
 await expect(separate.frameLocator('iframe[title="rsvp confirmation"]').getByText("Hi Alex,",{exact:true})).toBeVisible()
 await fresh.close()
 await page.getByRole("link",{name:"View or cancel your test RSVP",exact:true}).click()
 await page.getByRole("link",{name:/Join IPN free/}).click()
 await expect(page.getByLabel("Email",{exact:true})).toHaveValue(`sandbox-${width}@example.com`)
 await page.goBack()
 await page.getByRole("button",{name:"Cancel my RSVP",exact:true}).click()
 await expect(page.getByText("This RSVP or event is no longer available.",{exact:false})).toBeVisible()
 await page.reload()
 await expect(page.getByText("This RSVP or event is no longer available.",{exact:false})).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 expect(errors).toEqual([]);expect(external).toEqual([])
})

test("member login and signed-in RSVP are simulated; unrelated writes are blocked",async({page,request})=>{
 await page.goto(event)
 await page.getByRole("button",{name:"Sign in & RSVP",exact:true}).click()
 const dialog=page.getByRole("dialog")
 await dialog.getByLabel("Email",{exact:true}).fill("member@example.com")
 await dialog.getByLabel("Password",{exact:true}).fill("preview-password")
 await dialog.getByRole("button",{name:"Sign in & RSVP",exact:true}).click()
 await expect(page.getByRole("heading",{name:"You’re registered",exact:true})).toBeVisible()
 await page.getByRole("link",{name:"Signed-in member",exact:true}).click()
 await page.getByRole("button",{name:"RSVP",exact:true}).click()
 await expect(page.getByRole("heading",{name:"You’re registered",exact:true})).toBeVisible()
 for(const path of ["/api/events/another-event/rsvp","/api/analytics","/auth/callback","/login"]){
  expect((await request.post(path,{data:{}})).status()).toBe(403)
 }
 await page.goto("/dashboard")
 await expect(page).toHaveURL(new RegExp(slug+"$"))
})
