const MAX_SOURCE_LENGTH = 14_000
const MAX_SUMMARY_LENGTH = 150

export type MailchimpCampaignContent = {
  html?: string
  plain_text?: string
}

export function stripNewsletterHtml(value: string) {
  return value
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<\/h[1-6]\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function newsletterSourceText(content: MailchimpCampaignContent) {
  const source = content.plain_text?.trim() || stripNewsletterHtml(content.html ?? "")
  return source.slice(0, MAX_SOURCE_LENGTH)
}

function oneSentence(value: string) {
  const normalized = value
    .replace(/^['"“”]+|['"“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
  const first = normalized.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ?? normalized
  if (!first) return ""
  if (first.length <= MAX_SUMMARY_LENGTH) {
    return /[.!?]$/.test(first) ? first : `${first}.`
  }

  const shortened = first.slice(0, MAX_SUMMARY_LENGTH - 1)
  const boundary = shortened.lastIndexOf(" ")
  return `${shortened.slice(0, boundary > 80 ? boundary : -1).replace(/[,:;\s]+$/, "")}.`
}

export function fallbackNewsletterSummary(
  previewText: string | undefined,
  content: MailchimpCampaignContent,
  monthName: string,
) {
  const preview = oneSentence(previewText ?? "")
  if (preview) return preview

  const source = newsletterSourceText(content)
  const candidate = source
    .split(/\n+/)
    .map((line) => line.trim())
    .find(
      (line) =>
        line.length >= 40 &&
        !/unsubscribe|view this email|browser|copyright|mailing address/i.test(line),
    )
  return oneSentence(candidate ?? "") ||
    `The ${monthName} newsletter shares the latest IPN community news, opportunities, and upcoming programs.`
}

export function normalizeNewsletterSummary(
  generated: string,
  fallback: string,
) {
  return oneSentence(generated) || fallback
}

export const NEWSLETTER_SUMMARY_MAX_LENGTH = MAX_SUMMARY_LENGTH

function seasonalDirection(month: number) {
  if ([12, 1, 2].includes(month)) {
    return "cool daylight with warm interior textures and natural knit layers"
  }
  if ([3, 4, 5].includes(month)) {
    return "fresh spring daylight, light layers, planning materials, and restrained greenery"
  }
  if ([6, 7, 8].includes(month)) {
    return "warm summer daylight near a window or outdoor table with breathable professional-casual clothing"
  }
  return "golden autumn light, richer natural textures, and energetic conference-season planning"
}

function contentCue(summary: string) {
  if (/whatsapp|community chat|group chat/i.test(summary)) {
    return "a naturally held phone with a populated, believable community-chat interface"
  }
  if (/portal|dashboard|member platform/i.test(summary)) {
    return "a laptop with a populated, believable member dashboard containing navigation and content cards"
  }
  if (/conference|psychedelx|symposium|event/i.test(summary)) {
    return "conference schedules, badges, annotated research papers, and collaborative planning notes"
  }
  if (/policy|research|field news|report/i.test(summary)) {
    return "highlighted research briefs and printed reports being discussed collaboratively"
  }
  if (/labs|workshop|program/i.test(summary)) {
    return "notebooks, a discussion prompt, and realistic program-planning materials"
  }
  return "notebooks, a phone with a populated interface, and credible monthly planning materials"
}

export function buildNewsletterPhotoPrompt(options: {
  month: number
  monthLabel: string
  summary: string
  corrections?: string
}) {
  const prompt = [
    "Use case: photorealistic-natural",
    "Asset type: photo-only background for an IPN Members’ Newsletter cover",
    `Primary request: Create a candid, warm editorial photograph for the ${options.monthLabel} issue, grounded in this content summary: ${options.summary}`,
    "Scene/backdrop: a diverse group of emerging professionals collaborating around a table",
    `Subject detail: include ${contentCue(options.summary)}`,
    "Style/medium: natural editorial photography, realistic skin tones, contemporary professional-casual clothing, credible devices and table materials",
    "Composition/framing: 3:2 landscape; keep x=0–400 visually quiet for a masthead; place at least one engaged face and the primary content cue within x=430–590; the group may extend right",
    `Lighting/mood: ${seasonalDirection(options.month)}; engaged and collaborative, never posed`,
    "Color palette: natural colors; subtle purple may appear in clothing or a real interface but must not dominate",
    "Text: none",
    "Constraints: all device screens must contain plausible populated content; hands, faces, and devices must be anatomically and perspectivally realistic; the left masthead area must remain unobstructed",
    "Avoid: words, logos, gradients, borders, graphic title treatments, light-purple washes, psychedelic imagery, medical implications, mystical motifs, blank screens, illegible screens, collages, watermarks",
  ]
  if (options.corrections) {
    prompt.push(
      `Quality-review corrections from the previous attempt: ${options.corrections}`,
    )
  }
  return prompt.join("\n")
}
