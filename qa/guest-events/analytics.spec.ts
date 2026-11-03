import {test,expect} from '@playwright/test'
test('guest journey emits privacy-safe observations and signup navigation survives',async({page})=>{
 await page.addInitScript(() => {
  const send = navigator.sendBeacon.bind(navigator)
  navigator.sendBeacon = (url, data) => {
   if (String(url).endsWith('/api/portal-analytics') && data instanceof Blob) {
    void data.text().then(text => { const body=JSON.parse(text); if(body.metadata?.flow==='event_rsvp') sessionStorage.setItem('qa-rsvp-beacon',text) })
   }
   return send(url,data)
  }
 })
 const observations:Record<string,unknown>[]=[]
 page.on('request',r=>{if(r.url().endsWith('/api/portal-analytics')&&r.method()==='POST'){const body=r.postDataJSON();if(body?.metadata?.flow==='event_rsvp')observations.push(body)}})
 await page.goto('/events/guest-rsvp-preview')
 await page.getByRole('button',{name:'RSVP without an account',exact:true}).click()
 await page.getByLabel('First name',{exact:true}).fill('Private')
 await page.getByLabel('Last name',{exact:true}).fill('Identity')
 await page.getByLabel('Email',{exact:true}).fill('private@example.com')
 await page.getByRole('button',{name:'Confirm RSVP',exact:true}).click()
 await expect(page.getByRole('heading',{name:'You’re registered'})).toBeVisible({timeout:15000})
 await page.getByRole('link',{name:/Join IPN free/}).click()
 await expect(page.getByLabel('Email',{exact:true})).toHaveValue('private@example.com')
 await expect.poll(()=>observations.map(o=>(o.metadata as Record<string,unknown>).stage)).toEqual(expect.arrayContaining(['view','open','submit','confirmed']))
 await expect.poll(()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('qa-rsvp-beacon')??'{}').metadata?.stage)).toBe('signup')
 expect(JSON.stringify(observations)).not.toContain('private@example.com')
 expect(JSON.stringify(observations)).not.toContain('Identity')
})
for(const width of [1440,1280,390])test(`RSVP analytics table and empty filter at ${width}`,async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.setViewportSize({width,height:900});await page.goto('/rsvp-analytics-review')
 await expect(page.getByRole('heading',{name:'Event RSVP journey'})).toBeVisible()
 await expect(page.getByRole('cell',{name:'100%',exact:true})).toHaveCount(2)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:`docs/guest-event-rsvp/analytics-${width}.png`,fullPage:true})
 await page.getByLabel('RSVP journey from').fill('2099-01-01')
 await expect(page.getByText('No RSVP journey activity recorded for these dates.',{exact:false})).toBeVisible()
 expect(errors).toEqual([])
})

test('member login failures and confirmation retain the member sign-in attribution', async ({page}) => {
 const observations:Record<string,unknown>[]=[]
 page.on('request', r => {
  if(r.url().endsWith('/api/portal-analytics') && r.method()==='POST') {
   const body=r.postDataJSON()
   if(body?.metadata?.flow==='event_rsvp') observations.push(body)
  }
 })
 await page.addInitScript(() => {
  navigator.sendBeacon = (_url, data) => {
   if(data instanceof Blob) void data.text().then(text => sessionStorage.setItem('qa-member-beacon',text))
   return true
  }
 })
 await page.goto('/events/guest-rsvp-preview')
 await page.getByRole('button',{name:'Sign in & RSVP',exact:true}).click()
 const dialog=page.getByRole('dialog')
 await dialog.getByLabel('Email',{exact:true}).fill('member@example.com')
 await dialog.getByLabel('Password',{exact:true}).fill('wrong-password')
 await dialog.getByRole('button',{name:'Sign in & RSVP',exact:true}).click()
 await expect(dialog.getByRole('alert')).toContainText('incorrect')
 await dialog.getByLabel('Password',{exact:true}).fill('preview-password')
 await dialog.getByRole('button',{name:'Sign in & RSVP',exact:true}).click()
 await expect(page.getByRole('heading',{name:'You’re registered',exact:true})).toBeVisible()
 await expect.poll(() => observations.filter(o => (o.metadata as Record<string,unknown>).path==='member_login').map(o => (o.metadata as Record<string,unknown>).stage)).toEqual(expect.arrayContaining(['open','submit','error','confirmed']))
 // Prevent leaving the fixture while exercising the actual analytics click handler.
 await page.getByRole('link',{name:'Add to calendar',exact:true}).evaluate(el => el.addEventListener('click',e => e.preventDefault()))
 await page.getByRole('link',{name:'Add to calendar',exact:true}).click()
 await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('qa-member-beacon')??'{}').metadata)).toMatchObject({stage:'calendar',path:'member_login'})
 expect(JSON.stringify(observations)).not.toContain('member@example.com')
 expect(JSON.stringify(observations)).not.toContain('wrong-password')
})
