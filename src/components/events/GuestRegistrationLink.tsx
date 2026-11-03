"use client"

import { trackRsvp } from "@/lib/portal-analytics/event-rsvp-client"
import Link from "next/link"
import { saveRegistrationHandoff } from "@/lib/guest-events/registration-handoff"

export default function GuestRegistrationLink({identity, slug}: {
  identity: {firstName: string; lastName: string; email: string}; slug: string
}) {
  return <Link href="/register?from=event" onClick={() => { trackRsvp(slug, "signup", "guest"); saveRegistrationHandoff(identity, slug) }}
    className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-ipn">
    Join IPN free → <span className="ml-2 font-normal text-zinc-500">(optional)</span>
  </Link>
}
