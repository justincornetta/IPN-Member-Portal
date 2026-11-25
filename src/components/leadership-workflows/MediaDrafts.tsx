"use client"
import { useState } from "react"
import type { WorkflowRequest } from "@/lib/leadership-workflows/domain"

const TYPES = {
  event: "Event",
  announcement: "Announcement",
  campaign: "Campaign",
  educational: "Educational content"
}
const button =
  "min-h-[44px] rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
const primary =
  "min-h-[44px] rounded-lg bg-ipn px-4 py-2.5 text-sm font-medium text-white hover:bg-ipn-dark disabled:opacity-50"

function saved(value: string) {
  const when = new Date(value)
  if (Number.isNaN(when.getTime())) return "Not saved yet"
  return `Last saved ${when.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  })}`
}

// The signed-in user's unsent media requests. Nobody else sees these, and they
// are not in the queue, calendar or Slack until they are sent.
export default function MediaDrafts({
  drafts,
  busy,
  open,
  remove
}: {
  drafts: WorkflowRequest[]
  busy: boolean
  open: (draft: WorkflowRequest) => void
  remove: (draft: WorkflowRequest) => Promise<void>
}) {
  const [confirming, setConfirming] = useState("")
  return (
    <section aria-label="My drafts" className="flex flex-col gap-4">
      <p className="max-w-2xl text-sm text-zinc-500">
        Only you can see your drafts. They are not sent to Slack, the Media
        queue or the calendar until you send them.
      </p>
      {drafts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <p className="font-medium">No drafts yet</p>
          <p className="mt-2 text-sm text-zinc-500">
            Start a media request and choose Save draft to keep it here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {drafts.map((draft) => {
            const media = draft.media
            return (
              <li
                key={draft.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4"
              >
                <div className="min-w-0">
                  <h2 className="break-words text-base font-semibold">
                    {draft.title || "Untitled draft"}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {[media ? TYPES[media.type] : "", media?.team]
                      .filter(Boolean)
                      .join(" · ") || "Nothing else filled in yet"}
                    {" · "}
                    {saved(draft.updatedAt)}
                  </p>
                </div>
                {confirming === draft.id ? (
                  <div
                    role="alertdialog"
                    aria-label={`Delete ${draft.title || "untitled draft"}`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <span className="text-sm">Delete this draft?</span>
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => setConfirming("")}
                    >
                      Keep it
                    </button>
                    <button
                      className={`${button} border-red-300 text-red-800`}
                      disabled={busy}
                      onClick={async () => {
                        await remove(draft)
                        setConfirming("")
                      }}
                    >
                      Delete draft
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className={button}
                      disabled={busy}
                      aria-label={`Delete draft: ${draft.title || "Untitled draft"}`}
                      onClick={() => setConfirming(draft.id)}
                    >
                      Delete
                    </button>
                    <button
                      className={primary}
                      disabled={busy}
                      aria-label={`Continue editing: ${draft.title || "Untitled draft"}`}
                      onClick={() => open(draft)}
                    >
                      Continue editing
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
