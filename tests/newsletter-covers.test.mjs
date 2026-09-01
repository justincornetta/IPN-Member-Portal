import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_NEWSLETTERS,
  latestPublishedDefaultNewsletter,
  withNewsletterCoverImage,
  withNewsletterFallback,
} from "../src/lib/resources/newsletters.ts"

test("newsletter cover art is attached to matching live records", () => {
  const august = withNewsletterCoverImage({
    ...DEFAULT_NEWSLETTERS.find(
      (resource) => resource.slug === "newsletter-august-2026",
    ),
    image_url: null,
    image_alt: null,
    thumbnail_url: null,
  })

  assert.equal(august.image_url, "/newsletters/2026/august.png")
  assert.equal(august.thumbnail_url, "/newsletters/2026/august-square.png")
  assert.equal(
    august.image_alt,
    "IPN Members Newsletter cover for August 2026",
  )
})

test("newsletter summaries are content-specific and replace generic live copy", () => {
  const june = withNewsletterCoverImage({
    ...DEFAULT_NEWSLETTERS.find(
      (resource) => resource.slug === "newsletter-june-2026",
    ),
    description: "The June monthly update for IPN members.",
  })

  assert.equal(
    june.description,
    "The June update seeks feedback on community chat and shares IPN Labs, PsychedelX, conferences, and field news.",
  )

  for (const newsletter of DEFAULT_NEWSLETTERS) {
    assert.match(newsletter.description, /\.$/)
    assert.equal(newsletter.description.slice(0, -1).includes("."), false)
    assert.ok(newsletter.description.length <= 150)
  }
})

test("September stays hidden until publication and joins the archive afterward", () => {
  const august31 = new Date("2026-08-31T23:59:59Z")
  const september1 = new Date("2026-09-01T12:00:00Z")

  assert.equal(
    latestPublishedDefaultNewsletter(august31).slug,
    "newsletter-august-2026",
  )
  assert.equal(withNewsletterFallback([], august31).length, 4)

  assert.equal(
    latestPublishedDefaultNewsletter(september1).slug,
    "newsletter-september-2026",
  )
  assert.equal(withNewsletterFallback([], september1).length, 5)
})
