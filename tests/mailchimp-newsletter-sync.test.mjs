import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import sharp from "sharp"

import {
  buildNewsletterResource,
  findLatestNewsletterCampaign,
  isAutomaticNewsletterSyncWindow,
} from "../src/lib/sync/mailchimp-newsletter-core.ts"
import {
  fallbackNewsletterSummary,
  buildNewsletterPhotoPrompt,
  NEWSLETTER_SUMMARY_MAX_LENGTH,
  normalizeNewsletterSummary,
  stripNewsletterHtml,
} from "../src/lib/sync/newsletter-content.ts"
import { renderNewsletterCovers } from "../src/lib/sync/newsletter-cover-renderer.ts"

const septemberCampaign = {
  id: "campaign-september-2026",
  type: "regular",
  status: "sent",
  archive_url: "https://example.com/september-2026",
  send_time: "2026-09-02T14:00:00Z",
  recipients: { list_id: "audience-1" },
  settings: {
    title: "September 2026 IPN Members' Newsletter",
    subject_line: "The September member update",
    preview_text: "Community news and upcoming opportunities.",
    folder_id: "newsletter-folder",
  },
  social_card: { image_url: "https://example.com/september-cover.png" },
}

test("newsletter detection selects the current monthly campaign and ignores resends", () => {
  const campaign = findLatestNewsletterCampaign(
    [
      { ...septemberCampaign, id: "resend", parent_campaign_id: "original" },
      { ...septemberCampaign, id: "wrong-folder", settings: { ...septemberCampaign.settings, folder_id: "other" } },
      septemberCampaign,
      { ...septemberCampaign, id: "august", settings: { ...septemberCampaign.settings, title: "IPN Members Newsletter August 2026" } },
    ],
    {
      now: new Date("2026-09-03T12:00:00Z"),
      audienceId: "audience-1",
      folderId: "newsletter-folder",
    },
  )

  assert.equal(campaign?.id, "campaign-september-2026")
})

test("newsletter resource mapping is stable and uses the direct archive URL", () => {
  assert.deepEqual(buildNewsletterResource(septemberCampaign), {
    slug: "newsletter-september-2026",
    resource_type: "newsletter",
    title: "IPN Members Newsletter - September 2026",
    description: "Community news and upcoming opportunities.",
    url: "https://example.com/september-2026",
    category: "Monthly newsletter",
    author: "Intercollegiate Psychedelics Network",
    published_at: "2026-09-02T14:00:00.000Z",
    source_id: "mailchimp:campaign-september-2026",
    source_name: "Mailchimp",
    featured: true,
    sort_order: 5,
    status: "published",
    image_url: "https://example.com/september-cover.png",
    image_alt: "IPN Members Newsletter cover for September 2026",
    thumbnail_url: "https://example.com/september-cover.png",
  })
})

test("generated newsletter enhancements replace the Mailchimp preview and social card", () => {
  const payload = buildNewsletterResource(septemberCampaign, {
    description: "Members can explore the new portal, community events, and fall conference opportunities.",
    imageUrl: "https://example.com/generated-cover.png",
    thumbnailUrl: "https://example.com/generated-square.png",
  })
  assert.equal(
    payload.description,
    "Members can explore the new portal, community events, and fall conference opportunities.",
  )
  assert.equal(payload.image_url, "https://example.com/generated-cover.png")
  assert.equal(payload.thumbnail_url, "https://example.com/generated-square.png")
})

test("newsletter summaries are one sentence, concise, and content-aware without AI", () => {
  const html = `
    <style>.hidden { display: none }</style>
    <h1>September member update</h1>
    <p>Members can join a portal walkthrough and connect at two upcoming fall conferences.</p>
    <p>Second paragraph should not be selected.</p>
  `
  assert.equal(
    stripNewsletterHtml(html).includes("display: none"),
    false,
  )
  const fallback = fallbackNewsletterSummary(
    undefined,
    { html },
    "September",
  )
  assert.equal(
    fallback,
    "Members can join a portal walkthrough and connect at two upcoming fall conferences.",
  )
  const normalized = normalizeNewsletterSummary(
    "Members can explore the portal and upcoming programs. Extra sentence.",
    fallback,
  )
  assert.equal(normalized, "Members can explore the portal and upcoming programs.")
  assert.ok(normalized.length <= NEWSLETTER_SUMMARY_MAX_LENGTH)
})

test("newsletter cover prompt preserves the approved photo-only cover system", () => {
  const prompt = buildNewsletterPhotoPrompt({
    month: 9,
    monthLabel: "September 2026",
    summary: "Members can explore the portal and upcoming conferences.",
  })
  assert.match(prompt, /photo-only/i)
  assert.match(prompt, /x=0–400 visually quiet/)
  assert.match(prompt, /x=430–590/)
  assert.match(prompt, /populated, believable member dashboard/)
  assert.match(prompt, /Text: none/)
  assert.match(prompt, /Avoid: words, logos, gradients/)
})

test("deterministic cover renderer creates the approved master and square sizes", async () => {
  const photo = await sharp({
    create: {
      width: 1536,
      height: 1024,
      channels: 3,
      background: "#b48a62",
    },
  }).png().toBuffer()
  const images = await renderNewsletterCovers({
    photo,
    monthName: "September",
    year: 2026,
  })
  const [cover, square] = await Promise.all([
    sharp(images.cover).metadata(),
    sharp(images.square).metadata(),
  ])
  assert.deepEqual([cover.width, cover.height], [900, 600])
  assert.deepEqual([square.width, square.height], [300, 300])
})

test("automatic newsletter polling is limited to the first five Eastern calendar days", () => {
  assert.equal(
    isAutomaticNewsletterSyncWindow(new Date("2026-09-05T23:59:59-04:00")),
    true,
  )
  assert.equal(
    isAutomaticNewsletterSyncWindow(new Date("2026-09-06T00:00:00-04:00")),
    false,
  )
})

test("the protected cron triggers a Mailchimp background job and exposes a manual dry run", () => {
  const contentSync = readFileSync("src/lib/sync/content.ts", "utf8")
  const route = readFileSync(
    "src/app/api/admin/sync-newsletters/route.ts",
    "utf8",
  )
  const workflow = readFileSync(".github/workflows/content-sync.yml", "utf8")
  const background = readFileSync(
    "netlify/functions/newsletter-sync-background.ts",
    "utf8",
  )
  const newsletterSync = readFileSync(
    "src/lib/sync/mailchimp-newsletters.ts",
    "utf8",
  )
  const migration = readFileSync(
    "supabase/migrations/20260901003145_mailchimp_newsletter_sync_idempotency.sql",
    "utf8",
  )

  assert.doesNotMatch(contentSync, /syncLatestMailchimpNewsletter/)
  assert.match(route, /CONTENT_SYNC_SECRET/)
  assert.match(route, /defaultDryRun/)
  assert.match(route, /defaultDryRun \|\|/)
  assert.match(workflow, /0 \*\/6 \* \* \*/)
  assert.match(workflow, /api\/background\/sync-newsletters/)
  assert.match(background, /syncLatestMailchimpNewsletter/)
  assert.match(background, /path: "\/api\/background\/sync-newsletters"/)
  assert.match(background, /background: true/)
  assert.match(newsletterSync, /reviewNewsletterCovers/)
  assert.match(newsletterSync, /attempt <= 2/)
  assert.match(newsletterSync, /failed visual quality review after two attempts/)
  assert.match(migration, /resources_mailchimp_newsletter_source_id_uidx/)
})
