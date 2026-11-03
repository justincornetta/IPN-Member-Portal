import { persistNewsletters } from "./newsletter-import.mjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildNewsletterResource } from "./mailchimp-newsletter-core"
import { fetchNewsFeed } from "./public-news.mjs"

// Keep the existing entry point for manual and scheduled callers. No Mailchimp
// API credentials or generated artwork are needed to publish an existing issue.
export async function syncLatestMailchimpNewsletter(
  options: { dryRun?: boolean; force?: boolean; now?: Date } = {},
) {
  const issues = await fetchNewsFeed("newsletter")
  const payloads = issues.map(issue => buildNewsletterResource({
    id: issue.url,
    archive_url: issue.url,
    send_time: issue.date,
    settings: { title: issue.title, preview_text: issue.summary },
    social_card: { image_url: issue.image },
  }))
  // One monthly issue even when the archive contains a resend. Newest wins.
  const unique = [...new Map([...payloads].reverse().map(p => [p.slug, p])).values()]
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
  if (options.dryRun) return { status: "dry_run", payloads: unique }

  return persistNewsletters(createAdminClient(), unique)
}
