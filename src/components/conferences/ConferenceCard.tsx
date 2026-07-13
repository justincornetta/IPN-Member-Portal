import Link from "next/link"
import { formatConferenceDateRange } from "@/lib/conferences/format"
import type { ConferenceCategory, ConferenceRecord } from "@/lib/conferences/types"

const CATEGORY_GRADIENTS: Record<ConferenceCategory, string> = {
  Academic: "bg-[radial-gradient(circle_at_20%_20%,#a78bfa_0,#664fa1_30%,#18181b_75%)]",
  Industry: "bg-[radial-gradient(circle_at_20%_20%,#fbbf24_0,#b45309_30%,#18181b_75%)]",
  Community: "bg-[radial-gradient(circle_at_20%_20%,#5eead4_0,#0f766e_30%,#18181b_75%)]",
  "Harm Reduction": "bg-[radial-gradient(circle_at_20%_20%,#f9a8d4_0,#9d174d_30%,#18181b_75%)]",
}

export default function ConferenceCard({ conference }: { conference: ConferenceRecord }) {
  const location = [conference.city, conference.state, conference.country]
    .filter(Boolean)
    .join(", ")

  return (
    <Link
      href={`/dashboard/conferences/${conference.slug}`}
      className="group block h-full min-w-0"
    >
      <article className="flex h-full min-w-0 flex-col rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-ipn/30 hover:shadow-md sm:p-4">
        <div className={`relative aspect-[2/1] overflow-hidden rounded-lg ${CATEGORY_GRADIENTS[conference.category]}`}>
          <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 text-[11px] font-medium text-zinc-800">
            {conference.category}
          </span>
        </div>

        <div className="mt-3 flex min-w-0 flex-1 flex-col sm:mt-4">
          <p className="text-xs font-medium text-zinc-400">
            {formatConferenceDateRange(conference.starts_at, conference.ends_at, conference.timezone)}
          </p>
          <h3 className="mt-1 text-base font-semibold leading-snug text-zinc-900 group-hover:text-ipn">
            {conference.name}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">{location}</p>
          {conference.summary && (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">
              {conference.summary}
            </p>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <span className="text-xs text-zinc-400">
              {conference.rsvp_count
                ? `${conference.rsvp_count} member${conference.rsvp_count === 1 ? "" : "s"} going`
                : "No RSVPs yet"}
            </span>
            <span className="text-sm font-medium text-ipn">View details</span>
          </div>
        </div>
      </article>
    </Link>
  )
}
