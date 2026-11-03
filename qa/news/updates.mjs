import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
const data=await fetch('http://127.0.0.1:8041/api/public-news').then(response=>response.json())
const futureIssue={...data.newsletters[0],title:'IPN Members Newsletter - December 2026',url:'https://mailchi.mp/ipn/december-test',date:'2026-12-01T12:00:00Z'}
const futurePost={...data.posts[0],title:'Future article fixture',url:'https://ipnblog.substack.com/p/future-fixture',date:'2026-12-02T12:00:00Z'}
const browser=await chromium.launch()
const page=await browser.newPage()
await page.route('**/api/public-news',route=>route.fulfill({json:{newsletters:[futureIssue,...data.newsletters],posts:[futurePost,...data.posts]}}))
await page.goto('http://127.0.0.1:8041/news/')
await page.getByRole('heading',{name:futureIssue.title,exact:true}).waitFor()
assert.ok(await page.locator('#newsletter-rail').getByText(data.newsletters[0].title,{exact:true}).count())
await page.locator('#blog').getByRole('heading',{name:futurePost.title,exact:true}).waitFor()
await page.getByRole('button',{name:'Next newsletters'}).click()
assert.ok(await page.locator('#newsletter-rail').evaluate(el=>el.scrollWidth>el.clientWidth))
console.log('PASS future newsletter promoted, November archived, new Substack article shown')
await page.goto('http://127.0.0.1:8041/news/posts/')
await page.getByRole('heading',{name:futurePost.title,exact:true}).waitFor()
console.log('PASS future article added to full website blog archive')
await page.unroute('**/api/public-news');await page.route('**/api/public-news',route=>route.fulfill({status:502,json:{error:'test outage'}}))
await page.goto('http://127.0.0.1:8041/news/')
await page.getByRole('heading',{name:data.newsletters[0].title,exact:true}).waitFor()
console.log('PASS feed outage retains November and saved articles')
await browser.close()
