"use client"

import { useState, useTransition } from "react"
import type { ReactNode } from "react"
import { publishAdminContent } from "@/lib/admin/actions"
import type { AdminContentPayload, AdminContentType } from "@/lib/admin/actions"

const CONTENT_TYPES: { id: AdminContentType; label: string }[] = [
  { id: "upcoming_event", label: "Upcoming event" },
  { id: "past_recording", label: "Past recording" },
  { id: "member_resource", label: "Member resource" },
  { id: "blog_post", label: "Blog post" },
  { id: "partner", label: "Partner" },
]

type Field = keyof Omit<AdminContentPayload, "contentType">

function inputClass() {
  return "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-ipn focus:ring-2 focus:ring-ipn/20"
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      {children}
    </label>
  )
}

export default function ContentIntakeForm() {
  const [contentType, setContentType] = useState<AdminContentType>("upcoming_event")
  const [values, setValues] = useState<Record<string, string>>({})
  const [requiresVerifiedTicket, setRequiresVerifiedTicket] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const isEvent = contentType === "upcoming_event"
  const isRecording = contentType === "past_recording"
  const isResource =
    contentType === "member_resource" ||
    contentType === "blog_post" ||
    contentType === "partner"

  function update(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  function value(field: Field) {
    return values[field] ?? ""
  }

  function submit() {
    setMessage(null)
    setError(null)

    const payload: AdminContentPayload = {
      contentType,
      title: value("title"),
      slug: value("slug"),
      summary: value("summary"),
      description: value("description"),
      url: value("url"),
      imageUrl: value("imageUrl"),
      category: value("category"),
      startsAt: value("startsAt"),
      endsAt: value("endsAt"),
      timezone: value("timezone"),
      eventType: value("eventType"),
      speakers: value("speakers"),
      locationLabel: value("locationLabel"),
      locationDetails: value("locationDetails"),
      joinUrl: value("joinUrl"),
      registrationUrl: value("registrationUrl"),
      registrationProvider: value("registrationProvider"),
      externalEventId: value("externalEventId"),
      requiresVerifiedTicket,
      recordingProvider: value("recordingProvider"),
      recordingCategory: value("recordingCategory"),
      sourceId: value("sourceId"),
      sourceName: value("sourceName"),
      author: value("author"),
      publishedAt: value("publishedAt"),
      benefitNote: value("benefitNote"),
      detailBody: value("detailBody"),
    }

    startTransition(async () => {
      const result = await publishAdminContent(payload)
      if (result.error) {
        setError(result.error)
        return
      }
      setMessage(`Published ${result.slug}`)
    })
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-zinc-900">Content Intake</h2>
        <p className="text-sm text-zinc-500">
          Publish events, recordings, resources, blog posts, and partners from one form.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <FieldRow label="Content type">
          <select
            value={contentType}
            onChange={(event) => {
              setContentType(event.target.value as AdminContentType)
              setMessage(null)
              setError(null)
            }}
            className={inputClass()}
          >
            {CONTENT_TYPES.map((type) => (
              <option key={type.id} value={type.id}>{type.label}</option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Title">
          <input
            value={value("title")}
            onChange={(event) => update("title", event.target.value)}
            className={inputClass()}
            placeholder="Content title"
          />
        </FieldRow>

        <FieldRow label="Slug">
          <input
            value={value("slug")}
            onChange={(event) => update("slug", event.target.value)}
            className={inputClass()}
            placeholder="Optional; generated from title if blank"
          />
        </FieldRow>

        {(isEvent || isRecording) && (
          <>
            <FieldRow label="Event type">
              <input
                value={value("eventType")}
                onChange={(event) => update("eventType", event.target.value)}
                className={inputClass()}
                placeholder={isRecording ? "PsychedelX" : "IPN Lab"}
              />
            </FieldRow>
            <FieldRow label={isRecording ? "Published date" : "Start date"}>
              <input
                type="datetime-local"
                value={value(isRecording ? "publishedAt" : "startsAt")}
                onChange={(event) =>
                  update(isRecording ? "publishedAt" : "startsAt", event.target.value)
                }
                className={inputClass()}
              />
            </FieldRow>
            {isEvent && (
              <FieldRow label="End date">
                <input
                  type="datetime-local"
                  value={value("endsAt")}
                  onChange={(event) => update("endsAt", event.target.value)}
                  className={inputClass()}
                />
              </FieldRow>
            )}
            <FieldRow label="Timezone">
              <input
                value={value("timezone")}
                onChange={(event) => update("timezone", event.target.value)}
                className={inputClass()}
                placeholder="America/New_York"
              />
            </FieldRow>
            <FieldRow label="Speakers">
              <input
                value={value("speakers")}
                onChange={(event) => update("speakers", event.target.value)}
                className={inputClass()}
              />
            </FieldRow>
            <FieldRow label={isRecording ? "Recording URL" : "Join URL"}>
              <input
                value={value(isRecording ? "url" : "joinUrl")}
                onChange={(event) => update(isRecording ? "url" : "joinUrl", event.target.value)}
                className={inputClass()}
                placeholder={isRecording ? "YouTube URL" : "Zoom URL"}
              />
            </FieldRow>
          </>
        )}

        {isEvent && (
          <>
            <FieldRow label="Location label">
              <input
                value={value("locationLabel")}
                onChange={(event) => update("locationLabel", event.target.value)}
                className={inputClass()}
                placeholder="Zoom, Online, etc."
              />
            </FieldRow>
            <FieldRow label="External registration URL">
              <input
                value={value("registrationUrl")}
                onChange={(event) => update("registrationUrl", event.target.value)}
                className={inputClass()}
                placeholder="Eventbrite URL"
              />
            </FieldRow>
            <FieldRow label="Registration provider">
              <input
                value={value("registrationProvider")}
                onChange={(event) => update("registrationProvider", event.target.value)}
                className={inputClass()}
                placeholder="Eventbrite"
              />
            </FieldRow>
            <FieldRow label="External event ID">
              <input
                value={value("externalEventId")}
                onChange={(event) => update("externalEventId", event.target.value)}
                className={inputClass()}
                placeholder="Eventbrite event ID"
              />
            </FieldRow>
            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={requiresVerifiedTicket}
                onChange={(event) => setRequiresVerifiedTicket(event.target.checked)}
                className="h-4 w-4"
              />
              Require verified Eventbrite ticket for Join
            </label>
          </>
        )}

        {isRecording && (
          <>
            <FieldRow label="Recording provider">
              <input
                value={value("recordingProvider")}
                onChange={(event) => update("recordingProvider", event.target.value)}
                className={inputClass()}
                placeholder="YouTube"
              />
            </FieldRow>
            <FieldRow label="Recording category">
              <input
                value={value("recordingCategory")}
                onChange={(event) => update("recordingCategory", event.target.value)}
                className={inputClass()}
                placeholder="Participant Talk, Q&A, Panel"
              />
            </FieldRow>
          </>
        )}

        {isResource && (
          <>
            <FieldRow label="URL">
              <input
                value={value("url")}
                onChange={(event) => update("url", event.target.value)}
                className={inputClass()}
                placeholder="External URL"
              />
            </FieldRow>
            <FieldRow label="Category">
              <input
                value={value("category")}
                onChange={(event) => update("category", event.target.value)}
                className={inputClass()}
                placeholder={contentType === "blog_post" ? "IPN Blog" : "Member benefits"}
              />
            </FieldRow>
            <FieldRow label="Author">
              <input
                value={value("author")}
                onChange={(event) => update("author", event.target.value)}
                className={inputClass()}
              />
            </FieldRow>
            <FieldRow label="Published date">
              <input
                type="datetime-local"
                value={value("publishedAt")}
                onChange={(event) => update("publishedAt", event.target.value)}
                className={inputClass()}
              />
            </FieldRow>
            <FieldRow label="Source name">
              <input
                value={value("sourceName")}
                onChange={(event) => update("sourceName", event.target.value)}
                className={inputClass()}
                placeholder={contentType === "blog_post" ? "Substack or IPN Blog" : ""}
              />
            </FieldRow>
            {contentType === "member_resource" && (
              <FieldRow label="Benefit note">
                <input
                  value={value("benefitNote")}
                  onChange={(event) => update("benefitNote", event.target.value)}
                  className={inputClass()}
                />
              </FieldRow>
            )}
          </>
        )}

        <FieldRow label="Image URL">
          <input
            value={value("imageUrl")}
            onChange={(event) => update("imageUrl", event.target.value)}
            className={inputClass()}
            placeholder="Optional image or thumbnail URL"
          />
        </FieldRow>

        <FieldRow label="Source ID">
          <input
            value={value("sourceId")}
            onChange={(event) => update("sourceId", event.target.value)}
            className={inputClass()}
            placeholder="Optional external ID for de-duplication"
          />
        </FieldRow>
      </div>

      <div className="mt-4 grid gap-4">
        <FieldRow label="Summary">
          <textarea
            value={value("summary")}
            onChange={(event) => update("summary", event.target.value)}
            className={`${inputClass()} min-h-24`}
          />
        </FieldRow>
        <FieldRow label="Description">
          <textarea
            value={value("description")}
            onChange={(event) => update("description", event.target.value)}
            className={`${inputClass()} min-h-28`}
          />
        </FieldRow>
        {isResource && (
          <FieldRow label="IPN Recommendation">
            <textarea
              value={value("detailBody")}
              onChange={(event) => update("detailBody", event.target.value)}
              className={`${inputClass()} min-h-28`}
            />
          </FieldRow>
        )}
        {isEvent && (
          <FieldRow label="Location details">
            <textarea
              value={value("locationDetails")}
              onChange={(event) => update("locationDetails", event.target.value)}
              className={`${inputClass()} min-h-20`}
            />
          </FieldRow>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {message && <p className="mt-4 text-sm text-green-700">{message}</p>}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Publishing..." : "Publish"}
        </button>
      </div>
    </section>
  )
}
