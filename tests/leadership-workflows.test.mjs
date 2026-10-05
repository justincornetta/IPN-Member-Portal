import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID, createHmac } from "node:crypto"
import { readFile } from "node:fs/promises"
import { PGlite } from "@electric-sql/pglite"
import {
  applyChange,
  canRead,
  createRequest,
  date,
  unpaidCents,
  url,
  parseMedia,
  cents,
  mediaFormats
} from "../src/lib/leadership-workflows/domain.ts"
import { parseBankCsv } from "../src/lib/leadership-workflows/bank-csv.ts"
import { verifySlack } from "../src/lib/leadership-workflows/slack-signature.ts"
const justin = {
  id: "a8be2531-9c64-4cd6-b1cd-1a12f8465609",
  name: "Justin",
  email: "justin@example.test",
  team: "Strategy and Operations"
}
const member = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Leader",
  email: "leader@example.test",
  team: "Community"
}
const other = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Other",
  email: "other@example.test",
  team: "Media"
}
const people = [justin, member, other],
  now = new Date("2026-10-05T18:00:00Z")
function expense() {
  return createRequest(
    {
      id: randomUUID(),
      kind: "expense",
      title: "Event supplies",
      expense: {
        purpose: "Community event",
        amountCents: "100.00",
        itemUrl: ""
      }
    },
    member,
    now
  )
}
function change(r, action, actor = justin, extra = {}) {
  return applyChange(
    r,
    { revision: r.revision, action, ...extra },
    actor,
    justin.id,
    people,
    now
  ).record
}
test("expense ownership, approval identity, spending cap and reimbursement cash", () => {
  let r = expense()
  assert.equal(canRead(r, other.id, justin.id), false)
  assert.throws(() => change(r, "approve", member), /Only Justin/)
  assert.throws(
    () =>
      change(r, "purchase", member, {
        paymentMethod: "personal",
        actualAmountCents: "100.00",
        purchaseDate: "2026-10-05"
      }),
    /approval/
  )
  r = change(r, "approve")
  assert.equal(unpaidCents(r), 10000)
  assert.throws(
    () =>
      change(r, "purchase", justin, {
        paymentMethod: "ipn_card",
        actualAmountCents: "101.00",
        purchaseDate: "2026-10-05",
        account: "Relay"
      }),
    /exceeds/
  )
  r = change(r, "purchase", member, {
    paymentMethod: "personal",
    actualAmountCents: "95.00",
    purchaseDate: "2026-10-05"
  })
  assert.equal(r.status, "awaiting_reimbursement")
  assert.equal(r.expense.paidDate, "")
  assert.equal(unpaidCents(r), 9500)
  assert.throws(
    () =>
      change(r, "reimburse", member, {
        paidDate: "2026-10-05",
        account: "Relay"
      }),
    /Only Justin/
  )
  r = change(r, "reimburse", justin, {
    paidDate: "2026-10-05",
    account: "Relay"
  })
  assert.equal(r.expense.paidDate, "2026-10-05")
  assert.equal(unpaidCents(r), 0)
  assert.throws(() => change(r, "cancel"), /cannot be cancelled/)
})
test("material edits invalidate approval; stale requests and premature receipts fail", () => {
  let r = expense()
  assert.throws(
    () =>
      change(r, "receipt", member, {
        receiptUrl: "https://drive.google.com/file/d/test/view"
      }),
    /after purchasing/
  )
  r = change(r, "approve")
  assert.throws(
    () =>
      applyChange(
        r,
        { revision: 1, action: "approve" },
        justin,
        justin.id,
        people,
        now
      ),
    /changed/
  )
  r = change(r, "edit", member, {
    title: r.title,
    expense: { purpose: r.expense.purpose, amountCents: "90.00", itemUrl: "" }
  })
  assert.equal(r.status, "pending")
  assert.equal(r.expense.approvedAt, undefined)
})
test("external asset links and calendar values reject unsafe inputs", () => {
  assert.throws(() => url("javascript:alert(1)"), /HTTPS/)
  assert.throws(
    () => url("https://example.com/asset", "Asset", true),
    /Drive or Canva/
  )
  assert.throws(() => date("2026-02-30"), /valid date/)
  assert.throws(() => date("2026-99-10"), /valid date/)
})
test("media publication requires reviewed linked deliverables and preserves posted records", () => {
  let r = createRequest(
    {
      id: randomUUID(),
      kind: "media",
      title: "Announcement",
      media: {
        type: "announcement",
        team: "Community",
        brief: "Join us",
        postedBy: "2026-10-06",
        platforms: ["Instagram"],
        needsCopyHelp: true
      }
    },
    member,
    now
  )
  r = change(r, "status", other, { status: "accepted" })
  const d = {
    id: randomUUID(),
    name: "Feed post",
    platform: "Instagram",
    format: "Image",
    assigneeId: member.id,
    publisherId: other.id,
    scheduledDate: "2026-10-06",
    status: "ready",
    assetUrl: "https://www.canva.com/design/test/edit",
    publishedUrl: "",
    postedDate: ""
  }
  r = change(r, "production", other, {
    productionOwnerId: member.id,
    publisherId: other.id,
    deliverables: [d]
  })
  r = change(r, "status", member, { status: "assigned" })
  r = change(r, "status", member, { status: "in_production" })
  r = change(r, "status", member, { status: "director_review" })
  r = change(r, "status", other, { status: "ready_to_post" })
  assert.throws(
    () => change(r, "status", other, { status: "posted" }),
    /every deliverable/
  )
  d.status = "posted"
  d.publishedUrl = "https://www.instagram.com/p/test/"
  d.postedDate = "2026-10-05"
  r = change(r, "production", other, {
    productionOwnerId: member.id,
    publisherId: other.id,
    deliverables: [d]
  })
  assert.throws(
    () =>
      change(r, "production", member, {
        productionOwnerId: member.id,
        publisherId: other.id,
        deliverables: []
      }),
    /Retain posted/
  )
  r = change(r, "status", other, { status: "posted" })
  assert.throws(() => change(r, "edit", member), /Posted requests/)
})
test("CSV parsing preserves quoted content and requires IDs for indistinguishable entries", () => {
  const rows = parseBankCsv(
    'Date,Description,Amount,Transaction ID\n10/05/2026,"Supplies, event",-95.00,tx1\n'
  )
  assert.equal(rows[0].description, "Supplies, event")
  assert.equal(rows[0].amountCents, -9500)
  assert.equal(rows[0].date, "2026-10-05")
  assert.throws(
    () =>
      parseBankCsv(
        "Date,Description,Amount\n2026-10-05,Item,-10\n2026-10-05,Item,-10\n"
      ),
    /distinct Transaction IDs/
  )
})
test("Slack signature verification rejects modification and replay", () => {
  const raw = "payload=test",
    stamp = "1791223200",
    secret = "test-secret",
    now = Number(stamp) * 1000
  const signature =
    "v0=" +
    createHmac("sha256", secret).update(`v0:${stamp}:${raw}`).digest("hex")
  assert.equal(verifySlack(raw, signature, stamp, secret, now), true)
  assert.equal(verifySlack(raw + "x", signature, stamp, secret, now), false)
  assert.equal(verifySlack(raw, signature, stamp, secret, now + 301000), false)
})
test("database RLS isolates expenses, permits shared media reads and denies direct mutations", async () => {
  const db = new PGlite()
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to public;grant execute on function auth.uid() to public;create table public.profiles(id uuid primary key,role text,team text,is_banned boolean default false);grant select on public.profiles to authenticated,service_role;insert into profiles(id,role,team) values('${justin.id}','superadmin','Strategy and Operations'),('${member.id}','admin','Community'),('${other.id}','admin','Media');`
    )
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261005173140_leadership_requests.sql",
          import.meta.url
        ),
        "utf8"
      )
    )
    const r = expense()
    await db.query(
      "insert into leadership_requests(id,kind,requester_id,revision,data) values($1,'expense',$2,1,$3)",
      [r.id, member.id, JSON.stringify(r)]
    )
    const m = createRequest(
      {
        id: randomUUID(),
        kind: "media",
        title: "Public leadership brief",
        media: {
          type: "announcement",
          team: "Community",
          brief: "Test",
          postedBy: "2026-10-06",
          needsCopyHelp: true,
          formats: ["Carousel", "Email Campaign"]
        }
      },
      member,
      now
    )
    await db.query(
      "insert into leadership_requests(id,kind,requester_id,revision,data) values($1,'media',$2,1,$3)",
      [m.id, member.id, JSON.stringify(m)]
    )
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${other.id}',false);`
    )
    assert.equal(
      (await db.query("select * from leadership_requests")).rows.length,
      1
    )
    assert.deepEqual(
      (await db.query("select data from leadership_requests")).rows[0].data
        .media.formats,
      ["Carousel", "Email Campaign"]
    )
    await assert.rejects(
      db.query("update leadership_requests set revision=99"),
      /permission denied/
    )
    await assert.rejects(
      db.query("select * from leadership_integration_jobs"),
      /permission denied/
    )
    await db.exec(
      `select set_config('request.jwt.claim.sub','${member.id}',false)`
    )
    assert.equal(
      (await db.query("select * from leadership_requests")).rows.length,
      2
    )
    await db.exec(
      `select set_config('request.jwt.claim.sub','${justin.id}',false)`
    )
    assert.equal(
      (await db.query("select * from leadership_requests")).rows.length,
      2
    )
    await db.exec("reset role;set role anon;")
    await assert.rejects(
      db.query("select * from leadership_requests"),
      /permission denied/
    )
    await db.exec("reset role;set role service_role;")
    assert.equal(
      (
        await db.query("select leadership_acquire_sheet_lock($1) as locked", [
          r.id
        ])
      ).rows[0].locked,
      true
    )
    assert.equal(
      (
        await db.query("select leadership_acquire_sheet_lock($1) as locked", [
          m.id
        ])
      ).rows[0].locked,
      false
    )
    await db.query("delete from leadership_delivery_locks where owner=$1", [
      r.id
    ])
    assert.equal(
      (
        await db.query("select leadership_acquire_sheet_lock($1) as locked", [
          m.id
        ])
      ).rows[0].locked,
      true
    )
    const approved = change(r, "approve")
    await assert.rejects(
      db.query(
        "select leadership_save_request($1,1,$2,'Leader','approve','', '[]'::jsonb)",
        [JSON.stringify(approved), member.id]
      ),
      /designated expense approver/
    )
    await db.query(
      "select leadership_save_request($1,1,$2,'Justin','approve','', '[{\"target\":\"sheets\"}]'::jsonb)",
      [JSON.stringify(approved), justin.id]
    )
    assert.equal(
      (await db.query("select * from leadership_request_activity")).rows.length,
      1
    )
    assert.equal(
      (await db.query("select * from leadership_integration_jobs")).rows.length,
      1
    )
    await assert.rejects(
      db.query(
        "select leadership_save_request($1,1,$2,'Justin','approve','', '[]'::jsonb)",
        [JSON.stringify(approved), justin.id]
      ),
      /changed/
    )
  } finally {
    await db.close()
  }
})

test("media multi-format briefs require copy help or supplied draft; legacy formats remain readable", () => {
  const brief = {
    type: "campaign",
    team: "Media",
    brief: "Join our campaign",
    postedBy: "2026-10-20",
    platforms: ["Email"],
    formats: ["Carousel", "Email Campaign"]
  }
  assert.throws(() => parseMedia(brief), /copywriting help/)
  const helped = parseMedia({ ...brief, needsCopyHelp: true })
  assert.deepEqual(helped.formats, ["Carousel", "Email Campaign"])
  assert.equal(helped.format, "Carousel, Email Campaign")
  assert.equal(
    parseMedia({ ...brief, caption: "Join us" }).needsCopyHelp,
    false
  )
  assert.throws(
    () => parseMedia({ ...brief, needsCopyHelp: true, formats: [] }),
    /at least one/
  )
  assert.throws(
    () =>
      parseMedia({
        ...brief,
        needsCopyHelp: true,
        formats: ["Media to advise", "Carousel"]
      }),
    /specific formats/
  )
  assert.deepEqual(mediaFormats({ format: "Image" }), ["Image"])
  assert.equal(cents("45.00"), 4500)
  assert.throws(() => cents("$45.00"), /positive USD/)
  assert.throws(
    () => change(expense(), "comment", member, { note: "Discuss in Slack" }),
    /Slack/
  )
})
test("one media owner handles production and publication, with per-deliverable overrides", () => {
  const r = createRequest(
    {
      id: randomUUID(),
      kind: "media",
      title: "Announcement",
      media: {
        type: "announcement",
        team: "Media",
        brief: "Announce",
        postedBy: "2026-10-20",
        needsCopyHelp: true
      }
    },
    member,
    now
  )
  const d = {
    id: randomUUID(),
    name: "Email",
    platform: "Email",
    format: "Email Campaign",
    assigneeId: "",
    publisherId: other.id,
    scheduledDate: "2026-10-20",
    status: "planned",
    assetUrl: "",
    publishedUrl: "",
    postedDate: ""
  }
  const assigned = change(r, "production", other, {
    ownerId: member.id,
    deliverables: [d]
  })
  assert.equal(assigned.media.productionOwnerId, member.id)
  assert.equal(assigned.media.publisherId, member.id)
  assert.equal(assigned.media.deliverables[0].assigneeId, "")
  assert.equal(assigned.media.deliverables[0].publisherId, member.id)
  const reassigned = change(assigned, "production", other, {
    ownerId: other.id,
    deliverables: assigned.media.deliverables
  })
  assert.equal(reassigned.media.deliverables[0].publisherId, other.id)
  const delegated = change(assigned, "production", other, {
    ownerId: member.id,
    deliverables: [{ ...d, assigneeId: other.id }]
  })
  assert.equal(delegated.media.deliverables[0].publisherId, other.id)
})
