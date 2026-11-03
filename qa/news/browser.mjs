import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
const browser=await chromium.launch({headless:true})
const errors=[]
for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}})
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
 for(const [name,url] of [['portal-home','http://127.0.0.1:4341/dashboard'],['portal-resources','http://127.0.0.1:4341/dashboard/resources?tab=newsletters'],['website-news','http://127.0.0.1:8041/news/'],['website-blog','http://127.0.0.1:8041/news/posts/']]){
  await page.goto(url);await page.waitForTimeout(1800)
  if(!name.endsWith('blog'))await page.getByText('IPN Members Newsletter - November 2026',{exact:true}).first().waitFor()
  assert.equal(await page.locator('[data-nextjs-dialog-overlay]').count(),0)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,name+' overflow')
  if(name==='portal-home'){assert.equal(await page.locator('#latest-from-ipn').evaluate(el=>getComputedStyle(el).fontWeight),'600');await page.locator('#latest-from-ipn').scrollIntoViewIfNeeded();await page.locator('section[aria-labelledby="latest-from-ipn"]').screenshot({path:`docs/news-sync/screenshots/${name}-${width}.png`})}
  else await page.screenshot({path:`docs/news-sync/screenshots/${name}-${width}.png`,fullPage:true})
  console.log('PASS',name,width)
 }
 await page.close()
}
await browser.close();assert.deepEqual(errors,[])
