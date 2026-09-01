import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

const root = new URL("../", import.meta.url)

async function source(path) {
  return readFile(new URL(path, root), "utf8")
}

test("mobile navigation keeps five primary destinations while the drawer retains every route", async () => {
  const sidebar = await source("src/components/Sidebar.tsx")
  const bottomNav = sidebar.slice(sidebar.indexOf('aria-label="Primary"'))

  assert.match(sidebar, /w-64 max-w-\[80vw\]/)
  assert.match(bottomNav, /grid-cols-5/)
  assert.match(bottomNav, /min-h-14/)
  assert.match(sidebar, /const MOBILE_NAV =/)
  assert.match(sidebar, /label: "Home"/)
  assert.match(sidebar, /const MOBILE_NAV = \[[\s\S]*?NAV\[3\]/)
  assert.match(sidebar, /label: "Profile"/)
  assert.ok(sidebar.indexOf('label: "Events"') < sidebar.indexOf('label: "Conferences"'))
  assert.ok(sidebar.indexOf('label: "Conferences"') < sidebar.indexOf('label: "Resources"'))
  assert.match(sidebar, /href: "\/dashboard\/conferences"/)
  assert.match(sidebar, /href: "\/dashboard\/resources"/)
  assert.match(sidebar, /Join IPN on WhatsApp/)
  assert.match(sidebar, /aria-current=\{active \? "page" : undefined\}/)
})

test("tour prefers the visible guided feedback sheet and keeps the feedback prompt at the top on mobile", async () => {
  const [provider, feedback] = await Promise.all([
    source("src/components/product-tour/ProductTourProvider.tsx"),
    source("src/components/FeedbackFooter.tsx"),
  ])

  assert.match(provider, /data-tour-guided-feedback="true"/)
  assert.match(provider, /step\.id === "feedback"/)
  assert.match(provider, /top-\[calc\(1rem\+env\(safe-area-inset-top\)\)\]/)
  assert.match(feedback, /role=\{guided \? "region" : "dialog"\}/)
  assert.match(feedback, /<FeedbackForm onComplete=\{onClose\} autoFocus=\{!guided\} \/>/)
  assert.match(feedback, /if \(embedded \|\| !autoFocus\) return/)
  assert.doesNotMatch(feedback, /hidden md:block/)
})

test("feedback remains event-driven without a persistent launcher or mobile-nav regression", async () => {
  const [feedback, layout, sidebar, provider, dashboard] = await Promise.all([
    source("src/components/FeedbackFooter.tsx"),
    source("src/app/dashboard/layout.tsx"),
    source("src/components/Sidebar.tsx"),
    source("src/components/product-tour/ProductTourProvider.tsx"),
    source("src/app/dashboard/page.tsx"),
  ])

  assert.doesNotMatch(feedback, /<footer/)
  assert.doesNotMatch(feedback, /Found an issue\?/)
  assert.doesNotMatch(feedback, /Send feedback or report a bug/)
  assert.match(feedback, /return open \? \(/)
  assert.match(feedback, /addEventListener\("ipn:open-feedback"/)
  assert.match(sidebar, /data-tour-nav="feedback"/)
  assert.match(sidebar, /dispatchEvent\(new Event\("ipn:open-feedback"\)\)/)
  assert.match(provider, /CustomEvent\("ipn:open-feedback", \{ detail: \{ guided: true \} \}\)/)
  assert.match(layout, /<FeedbackFooter \/>/)
  assert.match(layout, /pb-\[calc\(5rem\+env\(safe-area-inset-bottom\)\)\] md:pb-0/)
  assert.doesNotMatch(layout, /pb-\[calc\(12rem/)
  assert.match(dashboard, /<div className="shrink-0 bg-white">/)
  assert.doesNotMatch(dashboard, /<div className="min-h-full bg-white">/)
})

test("dashboard newsletter links use Mailchimp issues and a dedicated portal archive", async () => {
  const [dashboard, resources, defaults, admin] = await Promise.all([
    source("src/app/dashboard/page.tsx"),
    source("src/app/dashboard/resources/ResourcesHub.tsx"),
    source("src/lib/resources/newsletters.ts"),
    source("src/app/dashboard/admin/ContentIntakeForm.tsx"),
  ])

  assert.match(dashboard, /eq\("resource_type", "newsletter"\)/)
  assert.match(dashboard, /\/dashboard\/resources\?tab=newsletters/)
  assert.doesNotMatch(dashboard.slice(dashboard.indexOf("function LatestFromIpn"), dashboard.indexOf("function greetingForDate")), /tab=blog/)
  assert.match(resources, /activeTab === "newsletter"/)
  assert.match(resources, /IPN Members Newsletter/)
  assert.match(defaults, /campaign-archive\.com/)
  assert.match(defaults, /eepurl\.com\/jccYiYwGYy/)
  assert.match(defaults, /newsletter-september-2026/)
  assert.match(defaults, /\/newsletters\/2026\/september\.png/)
  assert.match(defaults, /\/newsletters\/2026\/june-square\.png/)
  assert.match(dashboard, /withNewsletterCoverImage/)
  assert.match(admin, /Newsletter: monthly Mailchimp member issues/)
  assert.match(admin, /Link to the hosted Mailchimp issue/)
})
