import test from 'node:test'
import assert from 'node:assert/strict'
import { parseNewsFeed, fetchNewsFeed } from '../src/lib/sync/public-news.mjs'
import { persistNewsletters } from '../src/lib/sync/newsletter-import.mjs'
const item=(title='IPN Members Newsletter - November 2026',date='Sun, 01 Nov 2026 23:28:42 +0000',url='https://mailchi.mp/ipn/november')=>`<item><title>${title}</title><link>${url}</link><pubDate>${date}</pubDate><description><![CDATA[<style>secret</style><span class="mcnPreviewText">New website &amp; events</span><img width="10" src="https://mcusercontent.com/pixel.png"><img width="612" src="https://mcusercontent.com/cover.png">]]></description></item>`
const rss=items=>`<rss><channel>${items}</channel></rss>`
test('imports older issues after day five, excludes unrelated and future campaigns, and deduplicates',()=>{
 const result=parseNewsFeed(rss(item()+item()+item('Event reminder')+item('IPN Members Newsletter - December 2026','Tue, 01 Dec 2026 12:00:00 +0000')),'newsletter',new Date('2026-11-20'))
 assert.equal(result.length,1);assert.equal(result[0].summary,'New website & events');assert.equal(result[0].image,'https://mcusercontent.com/cover.png')
})
test('rejects malformed feeds, empty matching feeds and unsafe destinations',()=>{
 for(const input of ['<html>error</html>',rss(item('Event reminder')),rss(item(undefined,undefined,'javascript:alert(1)'))])assert.throws(()=>parseNewsFeed(input,'newsletter'))
})
test('accepts apostrophes and XML entities without interpreting instructions or HTML',()=>{
 const result=parseNewsFeed(rss(item('IPN Members’ Newsletter - November 2026')),'newsletter',new Date('2026-11-20'))
 assert.equal(result.length,1)
})
test('feed request fails visibly on upstream errors',async()=>{
 await assert.rejects(fetchNewsFeed('newsletter',async()=>new Response('down',{status:503})),/503/)
})
function database({failWrite=false,failVerify=false}={}){
 const rows=new Map();let writes=0
 return {rows,get writes(){return writes},from(){let operation='read',selected=[];const q={
  select(){return q},eq(){return q},neq(){return q},in(k,values){selected=values;return q},
  upsert(values){operation='write';writes++;if(!failWrite)for(const v of values)rows.set(v.slug,v);return q},update(){operation='feature';return q},
  then(resolve){return Promise.resolve(operation==='write'&&failWrite?{error:{message:'write failed'}}:{data:failVerify&&selected.length?[]:[...rows.values()],error:null}).then(resolve)}
 };return q}}
}
const issue={slug:'newsletter-november-2026',url:'https://mailchi.mp/ipn/nov',published_at:'2026-11-01',image_url:'https://mcusercontent.com/nov.png',status:'published'}
test('repeated imports update one issue, retain curated artwork, and verify saved links',async()=>{
 const db=database();db.rows.set(issue.slug,{...issue,image_url:'curated.png',thumbnail_url:'square.png'})
 await persistNewsletters(db,[issue]);await persistNewsletters(db,[issue]);assert.equal(db.rows.size,1);assert.equal(db.rows.get(issue.slug).image_url,'curated.png');assert.equal(db.rows.get(issue.slug).featured,true)
})
test('database failures and missing persisted rows fail the job',async()=>{
 await assert.rejects(persistNewsletters(database({failWrite:true}),[issue]),/write failed/)
 await assert.rejects(persistNewsletters(database({failVerify:true}),[issue]),/verification failed/)
})
