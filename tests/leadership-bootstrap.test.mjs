import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import ts from "typescript"
import { PGlite } from "@electric-sql/pglite"
import * as domain from "../src/lib/leadership-workflows/domain.ts"

test("signed-in workflow bootstrap loads an empty queue and existing event/conference schemas", async () => {
  const pg = new PGlite()
  try {
    // Existing portal conferences use name, while events use title.
    await pg.exec(`
      create table profiles (id text, first_name text, last_name text, email text, role text, team text, is_banned boolean);
      insert into profiles values ('leader', 'Test', 'Leader', 'leader@example.test', 'superadmin', 'Media', false);
      create table leadership_workflow_settings (expense_approver_id text);
      insert into leadership_workflow_settings values ('leader');
      create table leadership_requests (data jsonb);
      create table leadership_integration_jobs (id text);
      create table leadership_bank_activity (data jsonb);
      create table events (id text, title text, starts_at text, timezone text, summary text, location_label text, registration_url text);
      insert into events values ('event', 'Research seminar', '2100-01-10T18:00:00Z', 'UTC', 'Event brief', 'Online', 'https://example.test/register');
      create table conferences (id text, name text, timezone text, meetups jsonb);
      insert into conferences values ('conference', 'Annual conference', 'UTC', '[{"id":"meetup","title":"IPN meetup","startsAt":"2100-01-11T18:00:00Z","location":"Conference lobby","description":"Meet the team"}]');
    `)
    const db = {
      from(table) {
        let fields = "*", head = false
        const execute = async () => {
          try {
            const { rows } = await pg.query(`select ${fields} from ${table}`)
            return { data: head ? null : rows, count: rows.length, error: null }
          } catch (error) {
            return { data: null, error }
          }
        }
        const query = {
          select(value, options) { fields = value; head = !!options?.head; return query },
          eq() { return query },
          neq() { return query },
          in() { return query },
          gte() { return query },
          order() { return query },
          limit() { return query },
          single: async () => { const result = await execute(); return { ...result, data: result.data?.[0] } },
          then(resolve, reject) { return execute().then(resolve, reject) }
        }
        return query
      }
    }
    const nativeRequire = createRequire(import.meta.url)
    const mockModule = { exports: {} }
    const source = readFileSync(new URL("../src/lib/leadership-workflows/server.ts", import.meta.url), "utf8")
    const compiled = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText
    const require = (path) => {
      if (path === "@/lib/supabase/server") return { createClient: async () => ({ ...db, auth: { getUser: async () => ({ data: { user: { id: "leader" } } }) } }) }
      if (path === "@/lib/supabase/admin") return { createAdminClient: () => db }
      if (path === "@/lib/admin/leadership") return { LEADERSHIP_TEAMS: ["Media"] }
      if (path === "./domain") return domain
      if (path === "./integrations") return { readCash: async () => null, integrationReady: () => ({ slack: false, sheets: false }) }
      if (path === "./worker") return { drainJobs: async () => {} }
      return nativeRequire(path)
    }
    new Function("require", "module", "exports", compiled)(require, mockModule, mockModule.exports)
    const { api, bootstrap } = mockModule.exports
    const response = await api(new Request("https://preview.example.test/api/admin/workflows"), bootstrap)
    const result = await response.json()
    assert.equal(response.status, 200, JSON.stringify(result))
    assert.equal(result.ok, true)
    assert.equal(result.data.demo, false)
    assert.deepEqual(result.data.requests, [])
    assert.deepEqual(result.data.events.map(({ id, title }) => ({ id, title })), [
      { id: "event", title: "Research seminar" },
      { id: "conference:conference:meetup", title: "IPN meetup" }
    ])
    assert.match(result.data.events[1].details, /Conference lobby/)
    assert.deepEqual(result.data.integrations, { slack: false, sheets: false, pending: 0 })
  } finally {
    await pg.close()
  }
})
