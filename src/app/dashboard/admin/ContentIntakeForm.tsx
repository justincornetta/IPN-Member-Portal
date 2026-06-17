"use client"

import { useState, useTransition, useEffect, useCallback, useRef } from "react"
import Cropper from "react-easy-crop"
import type { Area } from "react-easy-crop"
import {
  publishAdminContent,
  listAdminEvents,
  listAdminResources,
  deleteAdminContent,
  uploadContentImage,
  promoteToRecording,
} from "@/lib/admin/actions"
import type {
  AdminContentPayload,
  AdminEventSummary,
  AdminResourceSummary,
} from "@/lib/admin/actions"
import type { EventSpeakerLinkType } from "@/lib/events/types"

// ─── Speaker & materials form types ──────────────────────────────────────────

type SpeakerLinkRow = { label: string; url: string; linkType: string }
type PaperRow = { title: string; url: string; citation: string; note: string }
type MaterialRow = { title: string; url: string; source: string; note: string }

// ─── Image crop helper ────────────────────────────────────────────────────────

async function getCropped169Blob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.addEventListener("load", () => resolve(img))
    img.addEventListener("error", reject)
    img.src = imageSrc
  })
  const canvas = document.createElement("canvas")
  canvas.width = 1280
  canvas.height = 720
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, 1280, 720)
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas empty"))),
      "image/jpeg", 0.92,
    ),
  )
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function inputCls() {
  return "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-ipn focus:ring-2 focus:ring-ipn/20"
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
    </label>
  )
}

function StepBar({ step, total, title, sub }: { step: number; total: number; title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < step ? "bg-ipn" : "bg-zinc-200"}`} />
        ))}
      </div>
      <p className="text-[11px] text-zinc-400">Step {step} of {total}</p>
      <h3 className="mt-0.5 text-base font-semibold text-zinc-900">{title}</h3>
      {sub && <p className="mt-0.5 text-sm text-zinc-500">{sub}</p>}
    </div>
  )
}

function NavRow({
  step, total, onBack, onNext, onSubmit, pending, submitLabel,
}: {
  step: number; total: number
  onBack: () => void; onNext: () => void; onSubmit: () => void
  pending: boolean; submitLabel: string
}) {
  return (
    <div className="mt-7 flex items-center justify-between border-t border-zinc-100 pt-5">
      {step > 1 ? (
        <button type="button" onClick={onBack} className="cursor-pointer text-sm text-zinc-500 transition hover:text-zinc-800">
          ← Back
        </button>
      ) : <span />}
      {step < total ? (
        <button type="button" onClick={onNext} className="cursor-pointer rounded-lg bg-ipn px-5 py-2 text-sm font-medium text-white transition hover:bg-ipn/90">
          Next →
        </button>
      ) : (
        <button type="button" onClick={onSubmit} disabled={pending} className="cursor-pointer rounded-lg bg-ipn px-5 py-2 text-sm font-medium text-white transition hover:bg-ipn/90 disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? "Publishing…" : submitLabel}
        </button>
      )}
    </div>
  )
}

// ─── Image upload with 16:9 crop ──────────────────────────────────────────────

function ImageUploadField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onCropComplete = useCallback((_: Area, pixels: Area) => setCroppedAreaPixels(pixels), [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleCropConfirm() {
    if (!cropSrc || !croppedAreaPixels) return
    setUploading(true)
    setUploadError(null)
    setCropSrc(null)
    try {
      const blob = await getCropped169Blob(cropSrc, croppedAreaPixels)
      const fd = new FormData()
      fd.append("file", blob, "thumbnail.jpg")
      const result = await uploadContentImage(fd)
      if (result.error) setUploadError(result.error)
      else if (result.url) onChange(result.url)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value && (
        <div className="relative aspect-video w-56 overflow-hidden rounded-lg bg-zinc-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-2 cursor-pointer rounded-md bg-black/50 px-2 py-1 text-xs text-white transition hover:bg-black/70"
          >
            Remove
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="cursor-pointer rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 transition hover:border-ipn hover:text-ipn disabled:opacity-50"
        >
          {uploading ? "Uploading…" : value ? "Replace" : "Upload image"}
        </button>
        <span className="text-xs text-zinc-400">or paste a URL</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-ipn focus:ring-2 focus:ring-ipn/20"
        />
      </div>
      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* Crop modal */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <p className="text-sm font-medium text-white">Crop to 16:9 thumbnail</p>
            <button type="button" onClick={() => setCropSrc(null)} className="cursor-pointer text-sm text-zinc-400 transition hover:text-white">
              Cancel
            </button>
          </div>
          <div className="relative flex-1">
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={16 / 9}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400">Zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-32 cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={handleCropConfirm}
              className="cursor-pointer rounded-lg bg-ipn px-5 py-2 text-sm font-medium text-white transition hover:bg-ipn/90"
            >
              Use this crop
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Event form (3 steps) ─────────────────────────────────────────────────────

type EventFields = {
  title: string; eventType: string; startsAt: string; endsAt: string; timezone: string
  joinUrl: string; locationLabel: string; locationDetails: string
  whatsappChatUrl: string
  hasRegistration: boolean; registrationUrl: string; registrationProvider: string
  externalEventId: string; requiresVerifiedTicket: boolean
  summary: string; description: string; speakers: string; imageUrl: string; slug: string
  speakerLinks: SpeakerLinkRow[]
  papers: PaperRow[]
  eventMaterials: MaterialRow[]
}

const EVENT_DEFAULTS: EventFields = {
  title: "", eventType: "IPN Labs", startsAt: "", endsAt: "", timezone: "America/New_York",
  joinUrl: "", locationLabel: "Online", locationDetails: "",
  whatsappChatUrl: "",
  hasRegistration: false, registrationUrl: "", registrationProvider: "Eventbrite",
  externalEventId: "", requiresVerifiedTicket: false,
  summary: "", description: "", speakers: "", imageUrl: "", slug: "",
  speakerLinks: [], papers: [], eventMaterials: [],
}

const EVENT_TYPES = ["IPN Labs", "PsychedelX", "Symposium", "Workshop", "Webinar", "Other"]

function EventForm({ initial, onSubmit, pending }: {
  initial?: Partial<EventFields>; onSubmit: (p: AdminContentPayload) => void; pending: boolean
}) {
  const [step, setStep] = useState(1)
  const [f, setF] = useState<EventFields>({ ...EVENT_DEFAULTS, ...initial })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(key: keyof EventFields, value: EventFields[typeof key]) {
    setF((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => { const e = { ...prev }; delete e[key as string]; return e })
  }

  function validate1() {
    const e: Record<string, string> = {}
    if (!f.title.trim()) e.title = "Required"
    if (!f.startsAt) e.startsAt = "Required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    const links = f.speakerLinks.filter((l) => l.label.trim())
    const papers = f.papers.filter((p) => p.title.trim())
    const materials = f.eventMaterials.filter((r) => r.title.trim())
    const hasSpeakerData = links.length > 0 || papers.length > 0 || materials.length > 0

    onSubmit({
      contentType: "upcoming_event", title: f.title,
      slug: f.slug || undefined, eventType: f.eventType,
      startsAt: f.startsAt, endsAt: f.endsAt || undefined,
      timezone: f.timezone || "America/New_York",
      joinUrl: f.joinUrl || undefined,
      chatExternalUrl: f.whatsappChatUrl || undefined,
      locationLabel: f.locationLabel || "Online",
      locationDetails: f.locationDetails || undefined,
      registrationUrl: f.hasRegistration ? f.registrationUrl || undefined : undefined,
      registrationProvider: f.hasRegistration ? f.registrationProvider || undefined : undefined,
      externalEventId: f.hasRegistration && f.registrationProvider === "Eventbrite" ? f.externalEventId || undefined : undefined,
      requiresVerifiedTicket: f.hasRegistration ? f.requiresVerifiedTicket : false,
      summary: f.summary || undefined, description: f.description || undefined,
      speakers: f.speakers || undefined, imageUrl: f.imageUrl || undefined,
      speakerResources: hasSpeakerData ? {
        speakerLinks: links.map((l) => ({ label: l.label.trim(), url: l.url.trim() || null, type: (l.linkType as EventSpeakerLinkType) || null })),
        papers: papers.map((p) => ({ title: p.title.trim(), url: p.url.trim() || null, citation: p.citation.trim() || null, note: p.note.trim() || null })),
        resources: materials.map((r) => ({ title: r.title.trim(), url: r.url.trim() || null, source: r.source.trim() || null, note: r.note.trim() || null })),
      } : undefined,
    })
  }

  return (
    <>
      {step === 1 && (
        <>
          <StepBar step={1} total={3} title="Basics" sub="Title, type, and when it happens" />
          <div className="flex flex-col gap-4">
            <Field label="Title" required hint="Keep it short. Shown on event cards and emails (e.g. 'IPN Labs: Psilocybin-Assisted Therapy Update').">
              <input value={f.title} onChange={(e) => set("title", e.target.value)} className={inputCls()} placeholder="IPN Labs: …" />
              {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
            </Field>
            <Field label="Event type" hint="Shown as a badge on the event card">
              <select value={f.eventType} onChange={(e) => set("eventType", e.target.value)} className={`cursor-pointer ${inputCls()}`}>
                {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date & time" required hint="Your local time; pick the timezone below.">
                <input type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} className={inputCls()} />
                {errors.startsAt && <p className="text-xs text-red-600">{errors.startsAt}</p>}
              </Field>
              <Field label="End date & time" hint="Optional. Shows duration on the event page.">
                <input type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} className={inputCls()} />
              </Field>
            </div>
            <Field label="Timezone" hint="IANA name (e.g. America/New_York, America/Chicago, America/Los_Angeles)">
              <input value={f.timezone} onChange={(e) => set("timezone", e.target.value)} className={inputCls()} placeholder="America/New_York" />
            </Field>
          </div>
          <NavRow step={1} total={3} onBack={() => {}} onNext={() => { if (validate1()) setStep(2) }} onSubmit={() => {}} pending={pending} submitLabel="" />
        </>
      )}

      {step === 2 && (
        <>
          <StepBar step={2} total={3} title="Access & registration" sub="How do people join or sign up?" />
          <div className="flex flex-col gap-4">
            <Field label="Join URL" hint="The direct Zoom / Google Meet / etc. link. Only shown to members (or ticketed attendees if gated below).">
              <input value={f.joinUrl} onChange={(e) => set("joinUrl", e.target.value)} className={inputCls()} placeholder="https://zoom.us/j/..." />
            </Field>
            <Field label="WhatsApp event chat invite URL" hint="Optional — when added, registered members see a Join chat button for this event">
              <input value={f.whatsappChatUrl} onChange={(e) => set("whatsappChatUrl", e.target.value)} className={inputCls()} placeholder="https://chat.whatsapp.com/..." />
            </Field>
            <Field label="Location label" hint="Shown on the event card (e.g. 'Online', 'San Francisco', 'Zoom')">
              <input value={f.locationLabel} onChange={(e) => set("locationLabel", e.target.value)} className={inputCls()} placeholder="Online" />
            </Field>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3.5 transition hover:border-zinc-300">
              <input type="checkbox" checked={f.hasRegistration} onChange={(e) => set("hasRegistration", e.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer flex-shrink-0" />
              <span className="text-sm text-zinc-700">This event uses external registration (Eventbrite, Lu.ma, etc.)</span>
            </label>

            {f.hasRegistration && (
              <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                <Field label="Registration URL" hint="The public Eventbrite / Lu.ma page where people sign up">
                  <input value={f.registrationUrl} onChange={(e) => set("registrationUrl", e.target.value)} className={inputCls()} placeholder="https://eventbrite.com/e/..." />
                </Field>
                <Field label="Provider">
                  <select value={f.registrationProvider} onChange={(e) => set("registrationProvider", e.target.value)} className={`cursor-pointer ${inputCls()}`}>
                    {["Eventbrite", "Lu.ma", "Other"].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </Field>
                {f.registrationProvider === "Eventbrite" && (
                  <Field label="Eventbrite event ID" hint="Numeric ID from the Eventbrite URL, used to automatically sync ticket holders.">
                    <input value={f.externalEventId} onChange={(e) => set("externalEventId", e.target.value)} className={inputCls()} placeholder="e.g. 1234567890" />
                  </Field>
                )}
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input type="checkbox" checked={f.requiresVerifiedTicket} onChange={(e) => set("requiresVerifiedTicket", e.target.checked)} className="h-4 w-4 cursor-pointer" />
                  <span className="text-sm text-zinc-700">Hide Join URL until attendee has a verified Eventbrite ticket</span>
                </label>
              </div>
            )}
          </div>
          <NavRow step={2} total={3} onBack={() => setStep(1)} onNext={() => setStep(3)} onSubmit={() => {}} pending={pending} submitLabel="" />
        </>
      )}

      {step === 3 && (
        <>
          <StepBar step={3} total={4} title="Details" sub="Description, speakers, and thumbnail (all optional)" />
          <div className="flex flex-col gap-4">
            <Field label="Summary" hint="1–2 sentences shown on event cards and previews">
              <textarea value={f.summary} onChange={(e) => set("summary", e.target.value)} rows={2} className={inputCls()} placeholder="A brief, compelling description of the event…" />
            </Field>
            <Field label="Description" hint="Full text shown on the event detail page. Supports multiple paragraphs.">
              <textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={5} className={inputCls()} placeholder="Detailed overview, agenda, or notes about the event…" />
            </Field>
            <Field label="Speakers" hint="Comma-separated names shown below the title (e.g. 'Dr. Jane Smith, Dr. John Doe')">
              <input value={f.speakers} onChange={(e) => set("speakers", e.target.value)} className={inputCls()} placeholder="Dr. Jane Smith, Dr. John Doe" />
            </Field>
            <Field label="Thumbnail" hint="Uploaded at 1280×720 (16:9). Used on event cards and the public event page.">
              <ImageUploadField value={f.imageUrl} onChange={(url) => set("imageUrl", url)} />
            </Field>
            <Field label="Slug" hint="URL path for this event, auto-generated from the title if left blank (e.g. 'ipn-labs-psilocybin-update').">
              <input value={f.slug} onChange={(e) => set("slug", e.target.value)} className={inputCls()} placeholder="auto-generated" />
            </Field>
          </div>
          <NavRow step={3} total={4} onBack={() => setStep(2)} onNext={() => setStep(4)} onSubmit={() => {}} pending={pending} submitLabel="" />
        </>
      )}

      {step === 4 && (
        <>
          <StepBar step={4} total={4} title="Speaker & materials" sub="Shown on the event page for IPN Labs events (all optional)" />
          <div className="flex flex-col gap-6">

            {/* Speaker links */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-zinc-600">Speaker links</p>
              <p className="text-[11px] text-zinc-400">Website, email, research profile, or social links for the speaker</p>
              {f.speakerLinks.map((link, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <input
                    value={link.label}
                    onChange={(e) => { const next = [...f.speakerLinks]; next[i] = { ...next[i], label: e.target.value }; set("speakerLinks", next) }}
                    placeholder="Label (e.g. Speaker website)"
                    className={inputCls()}
                  />
                  <input
                    value={link.url}
                    onChange={(e) => { const next = [...f.speakerLinks]; next[i] = { ...next[i], url: e.target.value }; set("speakerLinks", next) }}
                    placeholder="https://..."
                    className={inputCls()}
                  />
                  <select
                    value={link.linkType}
                    onChange={(e) => { const next = [...f.speakerLinks]; next[i] = { ...next[i], linkType: e.target.value }; set("speakerLinks", next) }}
                    className={`cursor-pointer ${inputCls()}`}
                  >
                    {["website", "email", "profile", "social", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button type="button" onClick={() => set("speakerLinks", f.speakerLinks.filter((_, j) => j !== i))} className="cursor-pointer rounded-lg border border-zinc-200 px-2 text-zinc-400 hover:border-red-200 hover:text-red-500 transition">✕</button>
                </div>
              ))}
              <button type="button" onClick={() => set("speakerLinks", [...f.speakerLinks, { label: "", url: "", linkType: "website" }])} className="cursor-pointer self-start rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-ipn hover:text-ipn">
                + Add link
              </button>
            </div>

            {/* Papers */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-zinc-600">Relevant papers</p>
              <p className="text-[11px] text-zinc-400">Academic papers or pre-reads for attendees</p>
              {f.papers.map((paper, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input value={paper.title} onChange={(e) => { const next = [...f.papers]; next[i] = { ...next[i], title: e.target.value }; set("papers", next) }} placeholder="Paper title" className={inputCls()} />
                    <input value={paper.url} onChange={(e) => { const next = [...f.papers]; next[i] = { ...next[i], url: e.target.value }; set("papers", next) }} placeholder="URL (optional)" className={inputCls()} />
                    <button type="button" onClick={() => set("papers", f.papers.filter((_, j) => j !== i))} className="cursor-pointer rounded-lg border border-zinc-200 px-2 text-zinc-400 hover:border-red-200 hover:text-red-500 transition">✕</button>
                  </div>
                  <input value={paper.citation} onChange={(e) => { const next = [...f.papers]; next[i] = { ...next[i], citation: e.target.value }; set("papers", next) }} placeholder="Citation (optional: author, journal, year)" className={inputCls()} />
                  <input value={paper.note} onChange={(e) => { const next = [...f.papers]; next[i] = { ...next[i], note: e.target.value }; set("papers", next) }} placeholder="Note (optional, e.g. 'Focus on section 3')" className={inputCls()} />
                </div>
              ))}
              <button type="button" onClick={() => set("papers", [...f.papers, { title: "", url: "", citation: "", note: "" }])} className="cursor-pointer self-start rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-ipn hover:text-ipn">
                + Add paper
              </button>
            </div>

            {/* Resources */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-zinc-600">Event resources</p>
              <p className="text-[11px] text-zinc-400">Slides, recordings, supplementary reading, or any other materials</p>
              {f.eventMaterials.map((resource, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                    <input value={resource.title} onChange={(e) => { const next = [...f.eventMaterials]; next[i] = { ...next[i], title: e.target.value }; set("eventMaterials", next) }} placeholder="Resource title" className={inputCls()} />
                    <input value={resource.url} onChange={(e) => { const next = [...f.eventMaterials]; next[i] = { ...next[i], url: e.target.value }; set("eventMaterials", next) }} placeholder="URL (optional)" className={inputCls()} />
                    <button type="button" onClick={() => set("eventMaterials", f.eventMaterials.filter((_, j) => j !== i))} className="cursor-pointer rounded-lg border border-zinc-200 px-2 text-zinc-400 hover:border-red-200 hover:text-red-500 transition">✕</button>
                  </div>
                  <input value={resource.source} onChange={(e) => { const next = [...f.eventMaterials]; next[i] = { ...next[i], source: e.target.value }; set("eventMaterials", next) }} placeholder="Source (optional, e.g. 'Google Drive')" className={inputCls()} />
                  <input value={resource.note} onChange={(e) => { const next = [...f.eventMaterials]; next[i] = { ...next[i], note: e.target.value }; set("eventMaterials", next) }} placeholder="Note (optional)" className={inputCls()} />
                </div>
              ))}
              <button type="button" onClick={() => set("eventMaterials", [...f.eventMaterials, { title: "", url: "", source: "", note: "" }])} className="cursor-pointer self-start rounded-lg border border-dashed border-zinc-300 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-ipn hover:text-ipn">
                + Add resource
              </button>
            </div>
          </div>
          <NavRow step={4} total={4} onBack={() => setStep(3)} onNext={() => {}} onSubmit={handleSubmit} pending={pending} submitLabel="Publish event" />
        </>
      )}
    </>
  )
}

// ─── Recording form (2 steps) ─────────────────────────────────────────────────

type RecordingFields = {
  title: string; url: string; publishedAt: string; recordingCategory: string
  summary: string; description: string; imageUrl: string; slug: string
}

const RECORDING_DEFAULTS: RecordingFields = {
  title: "", url: "", publishedAt: "", recordingCategory: "Participant Talk",
  summary: "", description: "", imageUrl: "", slug: "",
}

const RECORDING_CATEGORIES = ["Participant Talk", "Q&A", "Panel", "Keynote Speech", "Closing Ceremony"]

function RecordingForm({ initial, onSubmit, pending }: {
  initial?: Partial<RecordingFields>; onSubmit: (p: AdminContentPayload) => void; pending: boolean
}) {
  const [step, setStep] = useState(1)
  const [f, setF] = useState<RecordingFields>({ ...RECORDING_DEFAULTS, ...initial })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set(key: keyof RecordingFields, value: string) {
    setF((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => { const e = { ...prev }; delete e[key]; return e })
  }

  function validate1() {
    const e: Record<string, string> = {}
    if (!f.title.trim()) e.title = "Required"
    if (!f.url.trim()) e.url = "Required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    onSubmit({
      contentType: "past_recording", title: f.title, slug: f.slug || undefined, url: f.url,
      publishedAt: f.publishedAt || undefined, recordingCategory: f.recordingCategory || undefined,
      summary: f.summary || undefined, description: f.description || undefined,
      imageUrl: f.imageUrl || undefined,
    })
  }

  return (
    <>
      {step === 1 && (
        <>
          <StepBar step={1} total={2} title="Recording basics" />
          <div className="flex flex-col gap-4">
            <Field label="Title" required hint="Shown on recording cards. Include the event name for context (e.g. 'PsychedelX 2024: Opening Keynote').">
              <input value={f.title} onChange={(e) => set("title", e.target.value)} className={inputCls()} placeholder="PsychedelX 2024: …" />
              {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
            </Field>
            <Field label="YouTube URL" required hint="Full video URL. The video ID is extracted automatically for embedding.">
              <input value={f.url} onChange={(e) => set("url", e.target.value)} className={inputCls()} placeholder="https://youtube.com/watch?v=..." />
              {errors.url && <p className="text-xs text-red-600">{errors.url}</p>}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Published date" hint="When the video was released">
                <input type="datetime-local" value={f.publishedAt} onChange={(e) => set("publishedAt", e.target.value)} className={inputCls()} />
              </Field>
              <Field label="Category" hint="Shown as a badge on the recording">
                <select value={f.recordingCategory} onChange={(e) => set("recordingCategory", e.target.value)} className={`cursor-pointer ${inputCls()}`}>
                  {RECORDING_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <NavRow step={1} total={2} onBack={() => {}} onNext={() => { if (validate1()) setStep(2) }} onSubmit={() => {}} pending={pending} submitLabel="" />
        </>
      )}

      {step === 2 && (
        <>
          <StepBar step={2} total={2} title="Details" sub="All optional" />
          <div className="flex flex-col gap-4">
            <Field label="Summary" hint="1–2 sentences shown on recording cards">
              <textarea value={f.summary} onChange={(e) => set("summary", e.target.value)} rows={2} className={inputCls()} />
            </Field>
            <Field label="Description" hint="Longer description shown on the recording detail page">
              <textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} className={inputCls()} />
            </Field>
            <Field label="Thumbnail" hint="Uploaded at 1280×720 (16:9). Leave blank to use the YouTube thumbnail.">
              <ImageUploadField value={f.imageUrl} onChange={(url) => set("imageUrl", url)} />
            </Field>
            <Field label="Slug" hint="Auto-generated from title if blank">
              <input value={f.slug} onChange={(e) => set("slug", e.target.value)} className={inputCls()} placeholder="auto-generated" />
            </Field>
          </div>
          <NavRow step={2} total={2} onBack={() => setStep(1)} onNext={() => {}} onSubmit={handleSubmit} pending={pending} submitLabel="Publish recording" />
        </>
      )}
    </>
  )
}

// ─── Resource form (2 steps) ──────────────────────────────────────────────────

type ResourceFields = {
  resourceType: "blog_post" | "partner" | "member_resource"
  title: string; url: string; publishedAt: string; category: string; author: string
  summary: string; detailBody: string; benefitNote: string; imageUrl: string; slug: string
}

const RESOURCE_DEFAULTS: ResourceFields = {
  resourceType: "blog_post", title: "", url: "", publishedAt: "",
  category: "", author: "", summary: "", detailBody: "", benefitNote: "", imageUrl: "", slug: "",
}

const RESOURCE_TYPE_LABELS: Record<ResourceFields["resourceType"], string> = {
  blog_post: "Blog post", partner: "Partner", member_resource: "Member benefit",
}

function ResourceForm({ initial, onSubmit, pending }: {
  initial?: Partial<ResourceFields>; onSubmit: (p: AdminContentPayload) => void; pending: boolean
}) {
  const [step, setStep] = useState(1)
  const [f, setF] = useState<ResourceFields>({ ...RESOURCE_DEFAULTS, ...initial })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set<K extends keyof ResourceFields>(key: K, value: ResourceFields[K]) {
    setF((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => { const e = { ...prev }; delete e[key as string]; return e })
  }

  function validate1() {
    const e: Record<string, string> = {}
    if (!f.title.trim()) e.title = "Required"
    if (!f.url.trim()) e.url = "Required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    onSubmit({
      contentType: f.resourceType, title: f.title, slug: f.slug || undefined, url: f.url,
      publishedAt: f.publishedAt || undefined, category: f.category || undefined,
      author: f.author || undefined, summary: f.summary || undefined,
      detailBody: f.detailBody || undefined, benefitNote: f.benefitNote || undefined,
      imageUrl: f.imageUrl || undefined,
    })
  }

  const typeLabel = RESOURCE_TYPE_LABELS[f.resourceType]

  return (
    <>
      {step === 1 && (
        <>
          <StepBar step={1} total={2} title="Resource basics" />
          <div className="flex flex-col gap-4">
            <Field label="Resource type" hint="Determines how this item is displayed and categorized in the member portal">
              <select value={f.resourceType} onChange={(e) => set("resourceType", e.target.value as ResourceFields["resourceType"])} className={`cursor-pointer ${inputCls()}`}>
                <option value="blog_post">Blog post: IPN Substack articles</option>
                <option value="partner">Partner: organizations IPN works with</option>
                <option value="member_resource">Member benefit: perks and discounts for IPN members</option>
              </select>
            </Field>
            <Field label="Title" required hint="Shown on resource cards. Keep it concise (under 80 characters).">
              <input value={f.title} onChange={(e) => set("title", e.target.value)} className={inputCls()} />
              {errors.title && <p className="text-xs text-red-600">{errors.title}</p>}
            </Field>
            <Field label="URL" required hint={f.resourceType === "blog_post" ? "Link to the Substack post" : f.resourceType === "partner" ? "Partner website or landing page" : "Link to where members redeem this benefit"}>
              <input value={f.url} onChange={(e) => set("url", e.target.value)} className={inputCls()} placeholder="https://..." />
              {errors.url && <p className="text-xs text-red-600">{errors.url}</p>}
            </Field>
            {f.resourceType === "blog_post" && (
              <>
                <Field label="Published date" hint="Publication date of the article">
                  <input type="datetime-local" value={f.publishedAt} onChange={(e) => set("publishedAt", e.target.value)} className={inputCls()} />
                </Field>
                <Field label="Author" hint="Full name, shown below the article title.">
                  <input value={f.author} onChange={(e) => set("author", e.target.value)} className={inputCls()} placeholder="e.g. Intercollegiate Psychedelics Network" />
                </Field>
              </>
            )}
          </div>
          <NavRow step={1} total={2} onBack={() => {}} onNext={() => { if (validate1()) setStep(2) }} onSubmit={() => {}} pending={pending} submitLabel="" />
        </>
      )}

      {step === 2 && (
        <>
          <StepBar step={2} total={2} title="Details" sub="All optional" />
          <div className="flex flex-col gap-4">
            <Field label="Summary" hint="1–2 sentences shown on resource cards in the member portal">
              <textarea value={f.summary} onChange={(e) => set("summary", e.target.value)} rows={2} className={inputCls()} placeholder="A brief description of this resource…" />
            </Field>
            {f.resourceType === "member_resource" && (
              <Field label="Benefit note" hint="Short discount or perk summary shown prominently (e.g. '20% off for IPN members')">
                <input value={f.benefitNote} onChange={(e) => set("benefitNote", e.target.value)} className={inputCls()} placeholder="20% off for IPN members" />
              </Field>
            )}
            <Field label="IPN recommendation" hint="Longer body text shown on the resource detail page. Why IPN recommends this.">
              <textarea value={f.detailBody} onChange={(e) => set("detailBody", e.target.value)} rows={3} className={inputCls()} placeholder="Why IPN recommends this resource and how members can benefit…" />
            </Field>
            <Field label="Image" hint="Uploaded at 1280×720 (16:9). Shown as the resource thumbnail.">
              <ImageUploadField value={f.imageUrl} onChange={(url) => set("imageUrl", url)} />
            </Field>
            <Field label="Slug" hint="Auto-generated from title if blank">
              <input value={f.slug} onChange={(e) => set("slug", e.target.value)} className={inputCls()} placeholder="auto-generated" />
            </Field>
          </div>
          <NavRow step={2} total={2} onBack={() => setStep(1)} onNext={() => {}} onSubmit={handleSubmit} pending={pending} submitLabel={`Publish ${typeLabel.toLowerCase()}`} />
        </>
      )}
    </>
  )
}

// ─── DB record → form fields ──────────────────────────────────────────────────

function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return ""
  return iso.slice(0, 16)
}

function eventToFields(e: AdminEventSummary): EventFields {
  const sr = e.speaker_resources
  return {
    title: e.title ?? "", eventType: e.event_type ?? "IPN Labs",
    startsAt: isoToLocal(e.starts_at), endsAt: isoToLocal(e.ends_at),
    timezone: e.timezone ?? "America/New_York",
    joinUrl: e.join_url ?? "", locationLabel: e.location_label ?? "Online",
    whatsappChatUrl: e.chat_platform === "whatsapp" ? e.chat_external_url ?? "" : "",
    locationDetails: e.location_details ?? "",
    hasRegistration: !!(e.registration_url),
    registrationUrl: e.registration_url ?? "",
    registrationProvider: e.registration_provider ?? "Eventbrite",
    externalEventId: e.external_event_id ?? "",
    requiresVerifiedTicket: e.requires_verified_ticket ?? false,
    summary: e.summary ?? "", description: e.description ?? "",
    speakers: e.speakers ?? "", imageUrl: e.thumbnail_url ?? "", slug: e.slug ?? "",
    speakerLinks: (sr?.speakerLinks ?? []).map((l) => ({ label: l.label ?? "", url: l.url ?? "", linkType: l.type ?? "website" })),
    papers: (sr?.papers ?? []).map((p) => ({ title: p.title ?? "", url: p.url ?? "", citation: p.citation ?? "", note: p.note ?? "" })),
    eventMaterials: (sr?.resources ?? []).map((r) => ({ title: r.title ?? "", url: r.url ?? "", source: r.source ?? "", note: r.note ?? "" })),
  }
}

function recordingToFields(e: AdminEventSummary): RecordingFields {
  return {
    title: e.title ?? "", url: e.recording_url ?? "",
    publishedAt: isoToLocal(e.starts_at),
    recordingCategory: e.recording_category ?? "Participant Talk",
    summary: e.summary ?? "", description: e.description ?? "",
    imageUrl: e.thumbnail_url ?? "", slug: e.slug ?? "",
  }
}

function resourceToFields(r: AdminResourceSummary): ResourceFields {
  const resourceType: ResourceFields["resourceType"] =
    r.resource_type === "blog_post" ? "blog_post"
    : r.resource_type === "partner" ? "partner"
    : "member_resource"
  return {
    resourceType, title: r.title ?? "", url: r.url ?? "",
    publishedAt: isoToLocal(r.published_at), category: r.category ?? "",
    author: r.author ?? "", summary: r.description ?? "",
    detailBody: r.detail_body ?? "", benefitNote: r.benefit_note ?? "",
    imageUrl: r.image_url ?? "", slug: r.slug ?? "",
  }
}

// ─── Awaiting-recording row ───────────────────────────────────────────────────

function PromoteRow({
  event,
  onPromote,
  onDelete,
  promoting,
}: {
  event: AdminEventSummary
  onPromote: (id: string, url: string) => void
  onDelete: () => void
  promoting: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [url, setUrl] = useState("")
  const [confirming, setConfirming] = useState(false)

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900">{event.title}</p>
          <p className="truncate text-xs text-zinc-400">{event.event_type} · {formatDate(event.starts_at)}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => { setExpanded((v) => !v); setConfirming(false) }}
            className="cursor-pointer rounded-md border border-ipn/30 bg-ipn/5 px-2.5 py-1 text-xs font-medium text-ipn transition hover:bg-ipn/10"
          >
            {expanded ? "Cancel" : "Add recording"}
          </button>
          {confirming ? (
            <>
              <button
                type="button"
                onClick={() => { onDelete(); setConfirming(false) }}
                className="cursor-pointer rounded-md border border-ipn bg-ipn px-2.5 py-1 text-xs font-medium text-white transition hover:bg-ipn/90"
              >
                Confirm delete
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="cursor-pointer text-xs text-zinc-400 transition hover:text-zinc-600"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="cursor-pointer rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-ipn/30 hover:bg-ipn/5 hover:text-ipn"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 flex gap-2 border-t border-zinc-100 pt-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube or recording URL…"
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-ipn focus:ring-2 focus:ring-ipn/20"
          />
          <button
            type="button"
            onClick={() => { if (url.trim()) onPromote(event.id, url.trim()) }}
            disabled={!url.trim() || promoting}
            className="cursor-pointer flex-shrink-0 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {promoting ? "Saving…" : "Mark as recording"}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── List row ─────────────────────────────────────────────────────────────────

type EditTarget =
  | { type: "event"; fields: EventFields }
  | { type: "recording"; fields: RecordingFields }
  | { type: "resource"; fields: ResourceFields }

function ContentRow({
  title, meta, showPublicLink, slug, onEdit, onDelete,
}: {
  title: string; meta: string; showPublicLink?: boolean; slug?: string
  onEdit: () => void; onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)

  function copyPublicLink() {
    if (!slug) return
    navigator.clipboard.writeText(`${window.location.origin}/events/${slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900">{title}</p>
        <p className="truncate text-xs text-zinc-400">{meta}</p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {showPublicLink && slug && (
          <button
            type="button"
            onClick={copyPublicLink}
            title="Copy public event link"
            className="cursor-pointer rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-800"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          className="cursor-pointer rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
        >
          Edit
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              onClick={() => { onDelete(); setConfirming(false) }}
              className="cursor-pointer rounded-md border border-ipn bg-ipn px-2.5 py-1 text-xs font-medium text-white transition hover:bg-ipn/90"
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="cursor-pointer text-xs text-zinc-400 transition hover:text-zinc-600"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="cursor-pointer rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-ipn/30 hover:bg-ipn/5 hover:text-ipn"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

const PER_PAGE_OPTIONS = [10, 25, 50, 100]

function Pagination({ page, totalPages, perPage, onPage, onPerPage }: {
  page: number; totalPages: number; perPage: number
  onPage: (p: number) => void; onPerPage: (n: number) => void
}) {
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
      <div className="flex items-center gap-2">
        <span>Show</span>
        <select
          value={perPage}
          onChange={(e) => { onPerPage(Number(e.target.value)); onPage(1) }}
          className="cursor-pointer rounded border border-zinc-200 bg-white px-2 py-1 text-xs"
        >
          {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>per page</span>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page === 1}
            className="cursor-pointer rounded border border-zinc-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-zinc-50"
          >
            ←
          </button>
          <span className="px-1">{page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page === totalPages}
            className="cursor-pointer rounded border border-zinc-200 px-2 py-1 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-zinc-50"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function ResourceGroup({
  label,
  items,
  onEdit,
  onDelete,
}: {
  label: string
  items: AdminResourceSummary[]
  onEdit: (resource: AdminResourceSummary) => void
  onDelete: (id: string) => void
}) {
  if (items.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label} <span className="normal-case font-normal">({items.length})</span>
      </p>
      {items.map((r) => {
        const date = r.published_at ? formatDate(r.published_at) : "—"
        const typeLabel = r.resource_type === "blog_post" ? "Blog" : r.resource_type === "partner" ? "Partner" : "Benefit"
        return (
          <ContentRow
            key={r.id}
            title={r.title}
            meta={`${typeLabel} · ${date}`}
            onEdit={() => onEdit(r)}
            onDelete={() => onDelete(r.id)}
          />
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type SubTab = "events" | "recordings" | "awaiting" | "resources"

export default function ContentIntakeForm() {
  const [subTab, setSubTab] = useState<SubTab>("events")
  const [view, setView] = useState<"list" | "form">("list")
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [events, setEvents] = useState<AdminEventSummary[]>([])
  const [resources, setResources] = useState<AdminResourceSummary[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Pagination
  const [perPage, setPerPage] = useState(10)
  const [eventsPage, setEventsPage] = useState(1)
  const [recordingsPage, setRecordingsPage] = useState(1)

  const loadData = useCallback(async () => {
    setLoadingList(true)
    const [evts, res] = await Promise.all([listAdminEvents(), listAdminResources()])
    setEvents(evts)
    setResources(res)
    setLoadingList(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const upcomingEvents = events.filter((e) => !e.is_recording && e.status === "published")
  const endedEvents = events.filter((e) => !e.is_recording && e.status === "ended")
  const recordings = events.filter((e) => e.is_recording)

  // Paginated slices
  function paginate<T>(items: T[], page: number) {
    const start = (page - 1) * perPage
    return { items: items.slice(start, start + perPage), totalPages: Math.max(1, Math.ceil(items.length / perPage)) }
  }

  const { items: pagedEvents, totalPages: eventTotalPages } = paginate(upcomingEvents, eventsPage)
  const { items: pagedRecordings, totalPages: recordingTotalPages } = paginate(recordings, recordingsPage)

  // Resources grouped by type (no pagination — grouping is more useful)
  const blogResources = resources.filter((r) => r.resource_type === "blog_post")
  const partnerResources = resources.filter((r) => r.resource_type === "partner")
  const benefitResources = resources.filter((r) => !["blog_post", "partner"].includes(r.resource_type))

  function openNew() {
    setEditTarget(null)
    setSuccessMsg(null)
    setErrorMsg(null)
    setView("form")
  }

  function openEdit(target: EditTarget) {
    setEditTarget(target)
    setSuccessMsg(null)
    setErrorMsg(null)
    setView("form")
  }

  function backToList() {
    setView("list")
    setEditTarget(null)
  }

  function handleSubmit(payload: AdminContentPayload) {
    setSuccessMsg(null)
    setErrorMsg(null)
    startTransition(async () => {
      const result = await publishAdminContent(payload)
      if (result.error) {
        setErrorMsg(result.error)
      } else {
        setSuccessMsg(`Published: ${result.slug}`)
        await loadData()
        setView("list")
      }
    })
  }

  function handleDelete(id: string, table: "events" | "resources") {
    startTransition(async () => {
      const result = await deleteAdminContent(id, table)
      if (result.error) setErrorMsg(result.error)
      else await loadData()
    })
  }

  function handlePromote(id: string, url: string) {
    startTransition(async () => {
      const result = await promoteToRecording(id, url)
      if (result.error) setErrorMsg(result.error)
      else await loadData()
    })
  }

  const tabCounts: Record<SubTab, number> = {
    events: upcomingEvents.length,
    recordings: recordings.length,
    awaiting: endedEvents.length,
    resources: resources.length,
  }

  const newLabel = subTab === "events" ? "New event" : subTab === "recordings" ? "New recording" : subTab === "awaiting" ? "" : "New resource"

  const formTitle = editTarget === null ? newLabel
    : editTarget.type === "event" ? `Edit: ${editTarget.fields.title}`
    : editTarget.type === "recording" ? `Edit: ${editTarget.fields.title}`
    : `Edit: ${editTarget.fields.title}`

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-900">
            {view === "list" ? "Content" : formTitle}
          </h2>
          {view === "list" ? (
            <p className="mt-0.5 text-sm text-zinc-400">Manage events, recordings, and resources</p>
          ) : (
            <button type="button" onClick={backToList} className="cursor-pointer mt-0.5 flex items-center gap-1 text-xs text-zinc-400 transition hover:text-zinc-700">
              ← Back to list
            </button>
          )}
        </div>
        {view === "list" && subTab !== "awaiting" && (
          <button type="button" onClick={openNew} className="cursor-pointer ml-4 flex-shrink-0 rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn/90">
            {newLabel}
          </button>
        )}
      </div>

      {/* Sub-tabs (list only) */}
      {view === "list" && (
        <div className="flex border-b border-zinc-100">
          {(["events", "recordings", "awaiting", "resources"] as SubTab[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`cursor-pointer px-5 py-2.5 text-sm font-medium transition ${
                subTab === id ? "-mb-px border-b-2 border-ipn text-ipn" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {id === "awaiting" ? "Awaiting" : id.charAt(0).toUpperCase() + id.slice(1)}
              {!loadingList && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  id === "awaiting" && tabCounts.awaiting > 0
                    ? "bg-amber-100 text-amber-700"
                    : "bg-zinc-100 text-zinc-500"
                }`}>
                  {tabCounts[id]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Feedback */}
      {successMsg && <p className="border-b border-green-100 bg-green-50 px-5 py-2.5 text-sm text-green-700">{successMsg}</p>}
      {errorMsg && <p className="border-b border-red-100 bg-red-50 px-5 py-2.5 text-sm text-red-600">{errorMsg}</p>}

      {/* List view */}
      {view === "list" && (
        <div className="p-5">
          {loadingList ? (
            <p className="text-sm text-zinc-400">Loading…</p>
          ) : (
            <>
              {subTab === "events" && (
                upcomingEvents.length === 0
                  ? <p className="text-sm text-zinc-400">No upcoming events. Select New event to add one.</p>
                  : <>
                      <div className="flex flex-col gap-2">
                        {pagedEvents.map((event) => (
                          <ContentRow
                            key={event.id}
                            title={event.title}
                            meta={`${event.event_type} · ${formatDate(event.starts_at)}`}
                            showPublicLink
                            slug={event.slug}
                            onEdit={() => openEdit({ type: "event", fields: eventToFields(event) })}
                            onDelete={() => handleDelete(event.id, "events")}
                          />
                        ))}
                      </div>
                      <Pagination page={eventsPage} totalPages={eventTotalPages} perPage={perPage} onPage={setEventsPage} onPerPage={setPerPage} />
                    </>
              )}

              {subTab === "recordings" && (
                recordings.length === 0
                  ? <p className="text-sm text-zinc-400">No recordings. Select New recording to add one.</p>
                  : <>
                      <div className="flex flex-col gap-2">
                        {pagedRecordings.map((event) => (
                          <ContentRow
                            key={event.id}
                            title={event.title}
                            meta={`${event.event_type} · ${formatDate(event.starts_at)}`}
                            onEdit={() => openEdit({ type: "recording", fields: recordingToFields(event) })}
                            onDelete={() => handleDelete(event.id, "events")}
                          />
                        ))}
                      </div>
                      <Pagination page={recordingsPage} totalPages={recordingTotalPages} perPage={perPage} onPage={setRecordingsPage} onPerPage={setPerPage} />
                    </>
              )}

              {subTab === "awaiting" && (
                endedEvents.length === 0
                  ? <p className="text-sm text-zinc-400">No events awaiting recording. Events appear here after they end.</p>
                  : <div className="flex flex-col gap-2">
                      {endedEvents.map((event) => (
                        <PromoteRow
                          key={event.id}
                          event={event}
                          onPromote={handlePromote}
                          onDelete={() => handleDelete(event.id, "events")}
                          promoting={pending}
                        />
                      ))}
                    </div>
              )}

              {subTab === "resources" && (
                resources.length === 0
                  ? <p className="text-sm text-zinc-400">No resources. Select New resource to add one.</p>
                  : <div className="flex flex-col gap-6">
                      <ResourceGroup
                        label="Blog posts"
                        items={blogResources}
                        onEdit={(resource) => openEdit({ type: "resource", fields: resourceToFields(resource) })}
                        onDelete={(id) => handleDelete(id, "resources")}
                      />
                      <ResourceGroup
                        label="Partners"
                        items={partnerResources}
                        onEdit={(resource) => openEdit({ type: "resource", fields: resourceToFields(resource) })}
                        onDelete={(id) => handleDelete(id, "resources")}
                      />
                      <ResourceGroup
                        label="Member benefits"
                        items={benefitResources}
                        onEdit={(resource) => openEdit({ type: "resource", fields: resourceToFields(resource) })}
                        onDelete={(id) => handleDelete(id, "resources")}
                      />
                    </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Form view (awaiting tab has no form — all actions are inline) */}
      {view === "form" && subTab !== "awaiting" && (
        <div className="p-5">
          {subTab === "events" && (
            <EventForm
              initial={editTarget?.type === "event" ? editTarget.fields : undefined}
              onSubmit={handleSubmit}
              pending={pending}
            />
          )}
          {subTab === "recordings" && (
            <RecordingForm
              initial={editTarget?.type === "recording" ? editTarget.fields : undefined}
              onSubmit={handleSubmit}
              pending={pending}
            />
          )}
          {subTab === "resources" && (
            <ResourceForm
              initial={editTarget?.type === "resource" ? editTarget.fields : undefined}
              onSubmit={handleSubmit}
              pending={pending}
            />
          )}
        </div>
      )}
    </section>
  )
}
