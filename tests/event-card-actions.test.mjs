import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"
import test from "node:test"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"
import * as calendar from "../src/lib/events/calendar.ts"
import * as external from "../src/lib/events/external-registration.ts"

const require = createRequire(import.meta.url)
const source = readFileSync(new URL("../src/components/events/EventCard.tsx", import.meta.url), "utf8")
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
const dependencies = {
  "next/link": ({ children, href, ...props }) => React.createElement("a", { href, ...props }, children),
  "./EventArtworkCard.module.css": { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) },
  "@/components/events/EventArtwork": ({ src }) => React.createElement("img", { src, alt: "" }),
  "@/components/events/AddToCalendarButton": ({ className }) => React.createElement("button", { className, type: "button" }, "Add to Calendar"),
  "@/components/events/EventDateTime": () => React.createElement("span", null, "Example event date"),
  "@/components/events/ExternalRegistrationAction": ({ url, className }) => React.createElement("a", { href: url, className }, "Register on Eventbrite"),
  "@/components/whatsapp/WhatsAppHandoffAction": ({ label, className }) => React.createElement("button", { className, type: "button" }, label),
  "@/lib/events/actions": { registerForEvent: async () => { throw Error("Not called in render tests") }, unregisterFromEvent: async () => { throw Error("Not called in render tests") } },
  "@/lib/events/calendar": { ...calendar, canJoinEvent: (startsAt, timezone) => calendar.canJoinEvent(startsAt, timezone, new Date(now)) },
  "@/lib/events/external-registration": external,
  "@/lib/portal-analytics/client": { getPortalAnalyticsContext: () => ({}) },
}
const compiledModule = { exports: {} }
vm.runInNewContext(js, { module: compiledModule, exports: compiledModule.exports, require: name => name in dependencies ? dependencies[name] : require(name) })
const EventCard = compiledModule.exports.default
const now = Date.parse("2026-11-17T18:00:00Z")
const event = {
  id: "example", slug: "example", title: "IPN Member Office Hours", event_type: "Other",
  starts_at: new Date(now + 48 * 3600000).toISOString(), ends_at: new Date(now + 48.5 * 3600000).toISOString(), timezone: "America/New_York",
  thumbnail_url: "/example.jpg", summary: "Example summary", speakers: "IPN Leadership Team", location_label: "Online - Zoom",
  registration_count: 0, is_registered: true, join_url: "https://example.test/join", requires_verified_ticket: false, has_verified_ticket: false,
  registration_url: null, registration_provider: null, chat_platform: null, chat_status: null, chat_external_url: null,
}
function render(overrides = {}, variant = "full") {
  return renderToStaticMarkup(React.createElement(EventCard, { event: { ...event, ...overrides }, variant }))
}
function joinButton(html) { return html.match(/<button[^>]*>Join event<\/button>/)?.[0] }

test("registered join-soon state uses status text, disabled join and quiet secondary controls", () => {
  const html = render()
  assert.match(html, /registeredStatus[\s\S]*You’re registered/)
  assert.match(joinButton(html), /disabled=""/)
  assert.match(html, /Opens 24 hours before start\./)
  assert.match(html, /<span class="unavailableChat">Chat coming soon<\/span>/)
  assert.match(html, /class="quietAction cancelAction">Cancel RSVP/)
  assert.ok(html.indexOf("You’re registered") < html.indexOf("Join event</button>"))
  assert.ok(html.indexOf("Join event</button>") < html.indexOf("Add to Calendar</button>"))
})
test("the existing 24-hour gate opens exactly at the boundary, with a join URL", () => {
  for (const hours of [24, 6]) {
    const html = render({ starts_at: new Date(now + hours * 3600000).toISOString() })
    assert.doesNotMatch(joinButton(html), /disabled/)
    assert.doesNotMatch(html, /Opens 24 hours before start/)
  }
  const html = render({ starts_at: new Date(now + 24 * 3600000 + 1).toISOString() })
  assert.match(joinButton(html), /disabled=""/)
})
test("missing join URLs stay disabled even after the time gate opens", () => {
  const html = render({ starts_at: new Date(now + 6 * 3600000).toISOString(), join_url: null })
  assert.match(joinButton(html), /disabled=""/)
  assert.match(html, /Join link not available yet\./)
})
test("unregistered and compact states retain RSVP and calendar without member-only actions", () => {
  for (const variant of ["full", "compact"]) {
    const html = render({ is_registered: false }, variant)
    assert.match(html, />RSVP<\/button>/)
    assert.match(html, /Add to Calendar/)
    assert.doesNotMatch(html, /Join event<\/button>|Cancel RSVP|Join chat/)
    assert.ok(html.indexOf(">RSVP</button>") < html.indexOf("Add to Calendar</button>"))
  }
})
test("active event chat and attendance count remain available only after registration", () => {
  const overrides = { chat_platform: "whatsapp", chat_status: "active", chat_external_url: "available", registration_count: 20 }
  assert.match(render(overrides), /Join chat/)
  assert.match(render(overrides), /registered/)
  assert.doesNotMatch(render({ ...overrides, is_registered: false }), /Join chat/)
})
test("external ticket access keeps the provider registration path and no portal RSVP", () => {
  const html = render({ registration_url: "https://example.test/tickets", registration_provider: "Eventbrite", requires_verified_ticket: true, has_verified_ticket: false })
  assert.match(html, /Register on Eventbrite/)
  assert.match(html, /same email/)
  assert.doesNotMatch(html, />RSVP<\/button>|Join event<\/button>/)
})
