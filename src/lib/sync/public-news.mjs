// Public, already-published sources only. Shared with the public website.
export const NEWSLETTER_FEED = "https://us10.campaign-archive.com/feed?u=7c3bc2754f93c026395a7a78e&id=e7bcf08ab8"
export const BLOG_FEED = "https://ipnblog.substack.com/feed"

export function decode(value = "") {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (_, n) => {
      const code = n[0].toLowerCase() === "x" ? parseInt(n.slice(1), 16) : Number(n)
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ""
    })
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '\"')
    .replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
}
export function plain(value = "") {
  return decode(value.replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
}
function tag(block, name) {
  return decode(block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? "").trim()
}
function attr(block, name) {
  return decode(block.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"))?.[1] ?? "")
}
function safeUrl(value, hosts) {
  try {
    const url = new URL(value)
    return ["https:", "http:"].includes(url.protocol) && (!hosts || hosts.some(h => url.hostname === h || url.hostname.endsWith(`.${h}`)))
      ? url.href.replace(/^http:/, "https:") : ""
  } catch { return "" }
}
export function parseNewsFeed(xml, kind, now = new Date()) {
  if (!/<rss\b/i.test(xml) || !/<channel[>\s]/i.test(xml) || !/<\/rss>/i.test(xml)) throw new Error(`Invalid ${kind} RSS feed`)
  const rows = []
  for (const match of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const item = match[1], title = plain(tag(item, "title"))
    if (kind === "newsletter" && !/\bIPN\s+Members[’']?\s+Newsletter\b/i.test(title)) continue
    const url = safeUrl(tag(item, "link"), kind === "newsletter" ? ["mailchi.mp", "campaign-archive.com", "eepurl.com"] : ["ipnblog.substack.com"])
    const date = new Date(tag(item, "pubDate"))
    if (!title || !url || !Number.isFinite(date.getTime()) || date > now) continue
    const body = tag(item, "description") || tag(item, "content:encoded")
    const images = [...body.matchAll(/<img\b[^>]*>/gi)].map(m => ({url: safeUrl(attr(m[0], "src"), ["mcusercontent.com"]), width: parseFloat(attr(m[0], "width"))}))
    const image = kind === "newsletter" ? images.find(i => i.url && i.width >= 400)?.url ?? "" : safeUrl(attr(item.match(/<enclosure\b[^>]*>/i)?.[0] ?? "", "url"))
    const preview = body.match(/<span[^>]*class=["'][^"']*mcnPreviewText[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]
    const summary = kind === "newsletter" ? plain(preview || `${title}. Community updates, events, and opportunities for IPN members.`) : plain(body)
    rows.push({title, url, date: date.toISOString(), image, summary: summary.slice(0, 300), source: kind === "newsletter" ? "Mailchimp" : "Substack"})
  }
  if (!rows.length) throw new Error(`No valid ${kind} entries in RSS feed`)
  const unique = new Map()
  for (const row of rows.sort((a,b) => b.date.localeCompare(a.date))) if (!unique.has(row.url)) unique.set(row.url, row)
  return [...unique.values()]
}
export async function fetchNewsFeed(kind, fetcher = fetch) {
  const response = await fetcher(kind === "newsletter" ? NEWSLETTER_FEED : BLOG_FEED, {
    headers: { Accept: "application/rss+xml, application/xml", "User-Agent": "IPN-News-Sync/1.0" },
    signal: AbortSignal.timeout(15000), cache: "no-store",
  })
  if (!response.ok) throw new Error(`${kind} feed returned HTTP ${response.status}`)
  return parseNewsFeed(await response.text(), kind)
}
