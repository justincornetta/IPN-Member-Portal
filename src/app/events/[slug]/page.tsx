import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatEventDateTime } from "@/lib/events/calendar"
import type { EventRecord } from "@/lib/events/types"
import icon from "../../../../assets/purple_icon.png"

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const admin = createAdminClient()
  const { data } = await admin
    .from("events")
    .select("title, summary")
    .eq("slug", slug)
    .eq("status", "published")
    .eq("is_recording", false)
    .single()

  if (!data) return { title: "Event | IPN Member Portal" }

  return {
    title: `${data.title} | IPN`,
    description: data.summary ?? undefined,
    openGraph: {
      title: data.title,
      description: data.summary ?? undefined,
      type: "website",
    },
  }
}

export default async function PublicEventPage({ params }: Props) {
  const { slug } = await params
  const admin = createAdminClient()
  const supabase = await createClient()

  const [{ data: event }, { data: { user } }] = await Promise.all([
    admin
      .from("events")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .eq("is_recording", false)
      .single(),
    supabase.auth.getUser(),
  ])

  if (!event) notFound()

  const e = event as EventRecord
  const dateStr = formatEventDateTime(e.starts_at, e.ends_at, e.timezone)

  return (
    <div className="flex min-h-full flex-col bg-zinc-50">
      {/* Nav */}
      <header className="border-b border-zinc-200 bg-white px-5 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src={icon} alt="IPN" width={24} height={24} />
            <span className="text-sm font-semibold text-zinc-800">IPN Member Portal</span>
          </Link>
          <div className="flex items-center gap-3">
            {user ? (
              <Link
                href={`/dashboard/events/${slug}`}
                className="rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn/90"
              >
                Open in portal →
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-zinc-500 transition hover:text-zinc-800">
                  Sign in
                </Link>
                <Link href="/register" className="rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn/90">
                  Join IPN
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="aspect-video w-full overflow-hidden bg-zinc-900 sm:max-h-80">
        {e.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,#a78bfa_0,#664fa1_28%,#18181b_70%)]" />
        )}
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-ipn-light px-2 py-1 text-xs font-medium text-ipn">
            {e.event_type}
          </span>
          <span className="text-sm text-zinc-500">{dateStr}</span>
          {e.location_label && (
            <span className="text-sm text-zinc-500">· {e.location_label}</span>
          )}
        </div>

        <h1 className="mt-3 text-2xl font-semibold leading-tight text-zinc-900 sm:text-3xl">
          {e.title}
        </h1>

        {e.speakers && (
          <p className="mt-3 text-sm text-zinc-500">
            <span className="font-medium text-zinc-700">Speakers:</span> {e.speakers}
          </p>
        )}

        {/* CTA */}
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          {user ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900">You&apos;re signed in as an IPN member</p>
                <p className="mt-0.5 text-sm text-zinc-500">Open the full event page to RSVP, get the join link, and more.</p>
              </div>
              <Link
                href={`/dashboard/events/${slug}`}
                className="flex-shrink-0 rounded-lg bg-ipn px-5 py-2.5 text-sm font-medium text-white transition hover:bg-ipn/90"
              >
                Open in portal →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-zinc-900">IPN membership is free</p>
                <p className="mt-0.5 text-sm text-zinc-500">Join to RSVP, get the join link, and access the full member portal.</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <Link
                  href={`/login?next=/events/${slug}`}
                  className="rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-ipn px-4 py-2.5 text-sm font-medium text-white transition hover:bg-ipn/90"
                >
                  Join IPN — it&apos;s free
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Description */}
        {(e.description || e.summary) && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">About this event</h2>
            <div className="mt-3 space-y-4 text-sm leading-7 text-zinc-600">
              {(e.description ?? e.summary ?? "").split("\n").map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        )}

        {e.location_details && (
          <div className="mt-8">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Location</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{e.location_details}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white px-5 py-5 text-center text-xs text-zinc-400">
        <Link href="/" className="hover:text-ipn transition">Intercollegiate Psychedelics Network</Link>
        {" · "}
        <Link href="/register" className="hover:text-ipn transition">Join IPN</Link>
        {" · "}
        <Link href="/login" className="hover:text-ipn transition">Sign in</Link>
      </footer>
    </div>
  )
}
