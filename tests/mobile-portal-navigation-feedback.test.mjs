import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

const root = new URL("../", import.meta.url)

async function source(path) {
  return readFile(new URL(path, root), "utf8")
}

test("mobile navigation adds Conferences between Events and Resources in five touch-safe slots", async () => {
  const sidebar = await source("src/components/Sidebar.tsx")
  const bottomNav = sidebar.slice(sidebar.indexOf('aria-label="Primary"'))

  assert.match(sidebar, /w-64 max-w-\[80vw\]/)
  assert.match(bottomNav, /grid-cols-5/)
  assert.match(bottomNav, /min-h-14/)
  assert.ok(sidebar.indexOf('label: "Events"') < sidebar.indexOf('label: "Conferences"'))
  assert.ok(sidebar.indexOf('label: "Conferences"') < sidebar.indexOf('label: "Resources"'))
  assert.match(sidebar, /href: "\/dashboard\/conferences"/)
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

test("feedback launcher stays in normal document flow with only bottom-nav clearance", async () => {
  const [feedback, layout] = await Promise.all([
    source("src/components/FeedbackFooter.tsx"),
    source("src/app/dashboard/layout.tsx"),
  ])

  assert.match(feedback, /<footer className="mt-auto px-3 py-5 sm:px-6">/)
  assert.doesNotMatch(feedback, /className="fixed inset-x-0 z-40 px-3 md:hidden"/)
  assert.doesNotMatch(feedback, /calc\(4\.75rem \+ env\(safe-area-inset-bottom\)\)/)
  assert.match(layout, /pb-\[calc\(5rem\+env\(safe-area-inset-bottom\)\)\]/)
  assert.doesNotMatch(layout, /pb-\[calc\(12rem/)
})
