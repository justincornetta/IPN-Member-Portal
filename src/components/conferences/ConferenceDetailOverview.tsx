import { formatConferenceDateRange } from "@/lib/conferences/format"
import type { ConferenceRecord } from "@/lib/conferences/types"
import ConferenceCover from "@/components/conferences/ConferenceCover"
import CopyCodeButton from "@/components/conferences/CopyCodeButton"
import WhatsAppHandoffAction from "@/components/whatsapp/WhatsAppHandoffAction"

function ExternalLinkIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18m0 0v4.5M18 6l-7.5 7.5M6.75 6.75h3m-3 0A2.25 2.25 0 0 0 4.5 9v8.25a2.25 2.25 0 0 0 2.25 2.25H15a2.25 2.25 0 0 0 2.25-2.25v-3" />
    </svg>
  )
}

function TagIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.169.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
    </svg>
  )
}

export default function ConferenceDetailOverview({
  conference,
  preview = false,
  compact = false,
}: {
  conference: ConferenceRecord
  preview?: boolean
  compact?: boolean
}) {
  const location = [conference.city, conference.state, conference.country].filter(Boolean).join(", ")

  return (
    <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <ConferenceCover
        imageUrl={conference.cover_image_url}
        category={conference.category}
        sizes="(max-width: 639px) calc(100vw - 32px), 896px"
        priority={!preview}
      />

      <div className={`p-5 ${compact ? "" : "sm:p-7"}`}>
        <p className="text-sm font-medium text-ipn">
          {formatConferenceDateRange(conference.starts_at, conference.ends_at, conference.timezone)}
        </p>
        <h1 className="mt-1 text-2xl font-semibold leading-tight text-zinc-900">{conference.name}</h1>
        {location && <p className="mt-2 text-sm text-zinc-500">{location}</p>}
        {conference.venue && <p className="mt-1 text-sm text-zinc-400">{conference.venue}</p>}

        {conference.organizer && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-400">
            <span><span className="font-medium text-zinc-500">Organizer:</span> {conference.organizer}</span>
          </div>
        )}

        {conference.description && (
          <div className="mt-7 space-y-4 text-sm leading-7 text-zinc-600">
            {conference.description.split("\n").map((paragraph, index) => (
              <p key={`${index}-${paragraph}`}>{paragraph}</p>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {conference.website_url && (
            preview ? (
              <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 sm:min-h-0">
                Conference website <ExternalLinkIcon />
              </span>
            ) : (
              <a href={conference.website_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-ipn/30 hover:text-ipn sm:min-h-0">
                Conference website <ExternalLinkIcon />
              </a>
            )
          )}
          {preview ? (
            <span className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white sm:min-h-0">
              Join Conferences channel
            </span>
          ) : (
            <WhatsAppHandoffAction
              kind="permanent"
              slug="conferences"
              source="conference-detail"
              label="Join Conferences channel"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark sm:min-h-0"
            />
          )}
        </div>

        {conference.discounts.length > 0 && (
          <div className="mt-7 border-t border-zinc-100 pt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Member discounts</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">See these before you register — IPN member discounts and how to apply them.</p>
            <div className="mt-4 flex flex-col gap-3">
              {conference.discounts.map((discount, index) => (
                <div key={`${discount.label}-${index}`} className="rounded-lg border border-ipn/20 bg-ipn/5 px-4 py-3">
                  <div className={`flex flex-col gap-3 ${compact ? "" : "sm:flex-row sm:items-start sm:justify-between"}`}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-ipn"><TagIcon /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-zinc-900">{discount.label}</span>
                        {discount.description && <span className="mt-1 block text-xs leading-5 text-zinc-500">{discount.description}</span>}
                        {discount.howToApply && <span className="mt-1.5 block text-xs font-medium leading-5 text-ipn">How to apply: {discount.howToApply}</span>}
                        {discount.expiresAt && (
                          <span className="mt-1 block text-[11px] text-zinc-400">
                            Expires {new Date(discount.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className={`flex flex-shrink-0 flex-wrap items-center gap-2 ${compact ? "" : "sm:justify-end"}`}>
                      {discount.code && <CopyCodeButton code={discount.code} />}
                      {discount.url && (
                        preview ? (
                          <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 sm:min-h-0">Get discount <ExternalLinkIcon /></span>
                        ) : (
                          <a href={discount.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition hover:border-ipn/30 hover:text-ipn sm:min-h-0">Get discount <ExternalLinkIcon /></a>
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
