import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const sql=readFileSync(new URL('../supabase/migrations/20261103162429_reconcile_newsletter_resource_schema.sql',import.meta.url),'utf8')
test('reconciles old production schema, preserves existing types and rejects duplicate newsletter sources',async()=>{
 const db=new PGlite()
 await db.exec(`create table resources (slug text unique,resource_type text constraint resources_resource_type_check check(resource_type in ('affiliate_benefit','blog_post','partner')),source_id text,source_name text); insert into resources values ('blog','blog_post','old','Substack');`)
 await assert.rejects(db.exec("insert into resources values ('nov','newsletter','nov','Mailchimp')"),/resources_resource_type_check/)
 await db.transaction(async tx=>{await tx.exec(sql)})
 await db.exec("insert into resources values ('nov','newsletter','nov','Mailchimp') on conflict (slug) do update set source_id=excluded.source_id")
 await db.exec("insert into resources values ('nov','newsletter','nov','Mailchimp') on conflict (slug) do update set source_id=excluded.source_id")
 await assert.rejects(db.exec("insert into resources values ('duplicate','newsletter','nov','Mailchimp')"),/resources_mailchimp_newsletter_source_id_uidx/)
 await db.transaction(async tx=>{await tx.exec(sql)})
 assert.equal((await db.query('select count(*)::int as count from resources')).rows[0].count,2)
 await db.close()
})
