import { previewEventSlug } from "@/lib/guest-events/preview-mode"

export default function PreviewBanner() {
  return <aside aria-label="Test preview" className="border-b border-purple-200 bg-purple-50 px-5 py-3 text-sm text-zinc-800">
    <div className="mx-auto max-w-5xl">
      <p><strong>Test preview.</strong> No real registrations, accounts or emails. Use sample details; test state stays in this browser for 24 hours.</p>
      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-ipn underline">
        <a className="inline-flex min-h-11 items-center" href={"/events/" + previewEventSlug}>Guest / member login</a>
        <a className="inline-flex min-h-11 items-center" href={"/events/" + previewEventSlug + "?view=member"}>Signed-in member</a>
        <a className="inline-flex min-h-11 items-center" href="/event-preview/emails">Preview inbox</a>
      </div>
    </div>
  </aside>
}
