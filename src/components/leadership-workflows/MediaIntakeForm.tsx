"use client"

import { cloneElement, useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from "react"
import {
  MEDIA_FORMATS, mediaFormats, mediaDateLabel, mediaPlatformChoices, toggleMediaPlatform, text, date, url,
  EVENT_FIELD_LABELS, emptyEventFields, eventFieldsText, hasEventFields,
  type Bootstrap, type EventFields, type MediaBrief
} from "@/lib/leadership-workflows/domain"
import styles from "./MediaIntakeForm.module.css"

const steps = ["Idea", "When and where", "Copy and files", "Review"]
const headings = ["What's the idea?", "When and where?", "Copy and files", "Anything else?"]
const introductions = [
  "Rough is fine — the Media team will help shape it.",
  "Not sure about channels or formats? Leave them with the Media team.",
  "Write it yourself or hand it off — either works.",
  "Give it a once-over, then send it off."
]
const eventFieldHints: Record<keyof EventFields, string> = {
  name: "The event's public title.",
  kind: "For example: IPN Labs, Webinar, Workshop or Meetup.",
  time: "Date, start and end time, and time zone.",
  leader: "Who is leading it, speaking or hosting.",
  howTo: "Where it happens, or how people join online.",
  registrationUrl: "Where people sign up. Must start with https://."
}
const eventFieldMax: Record<keyof EventFields, number> = {
  name: 300, kind: 150, time: 300, leader: 1000, howTo: 2000, registrationUrl: 2000
}
const types = [
  ["event", "Event", "Promote something on the calendar"],
  ["announcement", "Announcement", "Share news with the network"],
  ["campaign", "Campaign", "A push across several posts"],
  ["educational", "Educational content", "Teach or explain something"]
] as const

function toggleChoice(current: string[], value: string) {
  if (value === "Media to advise") return [value]
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current.filter((item) => item !== "Media to advise"), value]
  return next.length ? next : ["Media to advise"]
}

function Field({ label, children, hint }: {
  label: string
  children: ReactElement<{ id?: string; "aria-describedby"?: string }>
  hint?: string
}) {
  const id = useId()
  return <div className={styles.field}>
    <label htmlFor={id}>{label}</label>
    {cloneElement(children, {
      id,
      "aria-describedby": [children.props["aria-describedby"], hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined
    })}
    {hint && <span id={`${id}-hint`} className={styles.hint}>{hint}</span>}
  </div>
}

export default function MediaIntakeForm({ data, initialMedia, busy, save, close }: {
  data: Bootstrap
  initialMedia: MediaBrief
  busy: boolean
  save: (body: Record<string, unknown>) => Promise<void>
  close: () => void
}) {
  const [id] = useState(() => crypto.randomUUID())
  const [step, setStep] = useState(0)
  const [furthest, setFurthest] = useState(0)
  const [title, setTitle] = useState("")
  const [media, setMedia] = useState(initialMedia)
  const [copyChoice, setCopyChoice] = useState("")
  const [links, setLinks] = useState("")
  const [showLink, setShowLink] = useState(false)
  const [error, setError] = useState<{ field: string; message: string } | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const submitting = useRef(false)
  const prefix = useId()
  const patch = (values: Partial<MediaBrief>) => setMedia((previous) => ({ ...previous, ...values }))
  const supportingLinks = links.split(/\n/).map((value) => value.trim()).filter(Boolean)
  const dateLabel = mediaDateLabel(media)
  const assetOnly = Boolean(media.assetOnly)
  const isEvent = media.type === "event"
  const eventFields = media.eventFields ?? emptyEventFields()

  useEffect(() => {
    const target = error
      ? form.current?.querySelector<HTMLElement>(`[data-field="${error.field}"]`)
      : heading.current
    target?.focus()
  }, [step, error])

  function fieldProps(name: string) {
    return {
      "data-field": name,
      "aria-invalid": error?.field === name || undefined,
      "aria-describedby": error?.field === name ? `${prefix}-error` : undefined
    }
  }

  function validate(index: number) {
    // Use the same value rules as the API before leaving each step.
    let field = "title"
    try {
      if (index === 0) {
        text(title, "Give your idea a name", true, 180)
        field = "team"; text(media.team, "Team or project", true, 150)
        field = "brief"; text(media.brief, isEvent ? "Event description" : "A brief description", true)
        if (isEvent) for (const [key, label] of EVENT_FIELD_LABELS) {
          field = `event-${key}`
          if (key === "registrationUrl") url(eventFields[key], label)
          else text(eventFields[key], label, false, eventFieldMax[key])
        }
      }
      if (index === 1) {
        field = "postedBy"
        if (!media.postedByTbd) {
          if (!media.postedBy) throw new Error(`Choose a ${dateLabel.toLowerCase()} date or mark it TBD.`)
          date(media.postedBy, `${dateLabel} date`)
        }
      }
      if (index === 2) {
        field = "copyChoice"
        if (!copyChoice && !media.assetOnly) throw new Error("Choose who will write the copy.")
        if (!media.assetOnly && copyChoice === "self" && !media.caption.trim()) {
          throw new Error("Add a post caption, or choose copywriting help.")
        }
        field = "caption"; text(media.caption, media.assetOnly ? "Partner captions" : "Post caption", false, 20002)
        field = "usageNotes"; text(media.usageNotes, "Usage notes", false, 10000)
        field = "links"
        if (supportingLinks.length > 20) throw new Error("Use at most 20 supporting links.")
        supportingLinks.forEach((link) => url(link, "Supporting material", true))
        field = "destinationUrl"; url(media.destinationUrl, "Link for readers")
        if (media.linkPlacement?.trim() && !media.destinationUrl?.trim()) {
          throw new Error("Add the destination URL for the link instructions.")
        }
        field = "linkPlacement"
        text(media.linkPlacement, "Where to include the link", Boolean(media.destinationUrl?.trim()), 1000)
      }
      if (index === 3) {
        field = "additionalDetails"; text(media.additionalDetails, "Notes", false, 10000)
      }
      return true
    } catch (cause) {
      setStep(index)
      setError({ field, message: cause instanceof Error ? cause.message : "Check this field." })
      return false
    }
  }

  function goTo(next: number) {
    if (busy) return
    if (next > step && !validate(step)) return
    setError(null)
    setStep(next)
    setFurthest((previous) => Math.max(previous, next))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || submitting.current) return
    if (step < 3) { goTo(step + 1); return }
    for (let index = 0; index < 4; index++) if (!validate(index)) return
    submitting.current = true
    setError(null)
    try {
      await save({ id, kind: "media", title, media: {
        ...media,
        eventDetails: "",
        eventFields: isEvent ? eventFields : undefined,
        needsCopyHelp: copyChoice === "help",
        links: supportingLinks.map((link) => ({ label: "Supporting material", url: link }))
      } })
    } catch (cause) {
      setError({ field: "review", message: cause instanceof Error ? cause.message : "Unable to send. Please try again." })
    } finally {
      submitting.current = false
    }
  }

  const review: { label: string; value: string; step: number }[] = [
    { label: "Idea", value: `${title} · ${types.find(([value]) => value === media.type)?.[1]}`, step: 0 },
    { label: "Team", value: media.team, step: 0 },
    ...(isEvent && hasEventFields(eventFields) ? [{ label: "Event", value: eventFieldsText(eventFields), step: 0 }] : []),
    { label: isEvent ? "Description" : "Brief", value: media.brief, step: 0 },
    ...(assetOnly ? [{ label: "Use", value: "Asset for partner/internal use, not posted by IPN", step: 1 }] : []),
    { label: dateLabel, value: media.postedByTbd ? "TBD" : media.postedBy ? new Date(`${media.postedBy}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "", step: 1 },
    { label: "Where", value: media.platforms.join(", "), step: 1 },
    { label: "Format", value: mediaFormats(media).join(", "), step: 1 },
    ...(media.urgent ? [{ label: "Priority", value: "Urgent — alert Agnes", step: 1 }] : []),
    ...(media.placeholder ? [{ label: "Placeholder", value: "Not ready for production", step: 1 }] : []),
    {
      label: assetOnly ? "Captions" : "Caption",
      value: copyChoice === "help"
        ? ["Media team drafts", media.caption ? `Suggested wording:\n${media.caption}` : ""].filter(Boolean).join("\n\n")
        : media.caption || "None",
      step: 2
    },
    ...(assetOnly && media.usageNotes ? [{ label: "Usage notes", value: media.usageNotes, step: 2 }] : []),
    { label: "Files", value: supportingLinks.join("\n") || "None", step: 2 },
    ...(media.destinationUrl ? [{ label: "Link for readers", value: `${media.destinationUrl}\n${media.linkPlacement}`, step: 2 }] : [])
  ]

  return <form ref={form} onSubmit={submit} noValidate className={styles.form} aria-label="New media request" aria-busy={busy}>
    <header>
      <h2>New media request</h2>
      <p className={styles.hint}>About 3 minutes · you can go back anytime</p>
    </header>
    <nav aria-label="Request steps">
      <ol className={styles.steps}>
        {steps.map((label, index) => <li key={label}>
          <button type="button" aria-label={`Step ${index + 1}: ${label}`} aria-current={step === index ? "step" : undefined}
            disabled={busy || index > furthest} onClick={() => goTo(index)}>
            <span>{index + 1}</span><span>{label}</span>
          </button>
        </li>)}
      </ol>
    </nav>
    <section aria-labelledby={`${prefix}-heading`}>
      <h3 ref={heading} tabIndex={-1} id={`${prefix}-heading`}>{step === 2 && assetOnly ? "Partner captions and usage notes" : headings[step]}</h3>
      <p className={styles.intro}>{step === 2 && assetOnly ? "Optional. Add captions partners can post and how they may use the asset." : introductions[step]}</p>
      {error && <p id={`${prefix}-error`} className={styles.error} role="alert">{error.message}</p>}
      <fieldset disabled={busy} className={styles.fields}>
        <legend className="sr-only">{steps[step]}</legend>
        {step === 0 && <>
          <p className={styles.submitter}>Submitting as <strong>{data.user.name}</strong></p>
          <fieldset>
            <legend>What kind of request is it?</legend>
            <div className={styles.cards}>
              {types.map(([value, label, hint]) => <label key={value} className={styles.card}>
                <input type="radio" name={`${prefix}-type`} value={value} checked={media.type === value}
                  onChange={() => patch({ type: value, eventId: "", eventDetails: "", eventFields: undefined })} />
                <span><strong>{label}</strong><span className={styles.hint}>{hint}</span></span>
              </label>)}
            </div>
          </fieldset>
          {isEvent && <Field label="Existing event" hint="Select an event to prefill the fields below, then check and update them.">
            <select value={media.eventId} onChange={(event) => {
              const selected = data.events.find((item) => item.id === event.target.value)
              patch({ eventId: selected?.id || "", eventDetails: "", eventFields: selected ? { ...selected.fields } : emptyEventFields(), brief: selected?.description || "", postedBy: selected?.postedBy || "", postedByTbd: false })
              setTitle(selected?.title || "")
            }}>
              <option value="">Write an event brief from scratch</option>
              {data.events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
            </select>
          </Field>}
          <div className={styles.columns}>
            <Field label="Give it a name"><input {...fieldProps("title")} value={title} required maxLength={180} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Team or project"><input {...fieldProps("team")} value={media.team} required maxLength={150} onChange={(e) => patch({ team: e.target.value })} /></Field>
          </div>
          {isEvent && <fieldset>
            <legend>Event details</legend>
            <div className={styles.columns}>
              {EVENT_FIELD_LABELS.map(([key, label]) => <div key={key} className={key === "name" || key === "leader" ? styles.wide : undefined}>
                <Field label={label} hint={eventFieldHints[key]}>
                  <input {...fieldProps(`event-${key}`)} type={key === "registrationUrl" ? "url" : "text"} maxLength={eventFieldMax[key]}
                    placeholder={key === "registrationUrl" ? "https://…" : undefined} value={eventFields[key]}
                    onChange={(e) => patch({ eventFields: { ...eventFields, [key]: e.target.value } })} />
                </Field>
              </div>)}
            </div>
          </fieldset>}
          <Field label={isEvent ? "Event description" : "What's it about?"} hint={isEvent ? "What the event is about, who it's for, and what people should do." : undefined}>
            <textarea {...fieldProps("brief")} rows={isEvent ? 6 : 4} required maxLength={8000} value={media.brief} onChange={(e) => patch({ brief: e.target.value })} />
          </Field>
        </>}
        {step === 1 && <>
          <label className={styles.card}>
            <input type="checkbox" checked={assetOnly} onChange={(e) => patch({ assetOnly: e.target.checked, platforms: [mediaPlatformChoices(e.target.checked)[0]] })} />
            <span><strong>Asset for partner/internal use, not posted</strong><span className={styles.hint}>For example, a media kit partners will post. IPN won&apos;t publish it.</span></span>
          </label>
          <div className={styles.field}>
            <Field label={dateLabel} hint={assetOnly ? "The day the asset should be ready, not a posting date." : "The last day it can go live — not the event date."}>
              <input {...fieldProps("postedBy")} type="date" required={!media.postedByTbd} disabled={media.postedByTbd} value={media.postedBy} onChange={(e) => patch({ postedBy: e.target.value })} />
            </Field>
            <label className={styles.chip}>
              <input type="checkbox" checked={Boolean(media.postedByTbd)} onChange={(e) => {
                patch({ postedByTbd: e.target.checked, postedBy: "" })
                if (e.target.checked && error?.field === "postedBy") setError(null)
              }} />Date is TBD
            </label>
          </div>
          <fieldset><legend>{assetOnly ? "Where will it be used?" : "Where should it go?"}</legend><div className={styles.chips}>
            {mediaPlatformChoices(assetOnly).map((platform) => <label key={platform} className={styles.chip}>
              <input type="checkbox" checked={media.platforms.includes(platform)} onChange={() => patch({ platforms: toggleMediaPlatform(media.platforms, platform, assetOnly) })} />{platform}
            </label>)}
          </div></fieldset>
          <fieldset><legend>What format?</legend><div className={styles.chips}>
            {MEDIA_FORMATS.map((format) => <label key={format} className={styles.chip}>
              <input type="checkbox" checked={mediaFormats(media).includes(format)} onChange={() => {
                const formats = toggleChoice(mediaFormats(media), format)
                patch({ formats, format: formats.join(", ") })
              }} />{format}
            </label>)}
          </div></fieldset>
          <p className={styles.hint}>Need outputs on different dates? Send them as separate requests.</p>
          <label className={styles.card}>
            <input type="checkbox" checked={media.urgent} onChange={(e) => patch({ urgent: e.target.checked })} />
            <span><strong>This is urgent</strong><span className={styles.hint}>Alerts Agnes when you send. She&apos;ll still review the brief.</span></span>
          </label>
          <label className={styles.card}>
            <input type="checkbox" checked={Boolean(media.placeholder)} onChange={(e) => patch({ placeholder: e.target.checked })} />
            <span><strong>Placeholder, not ready for production</strong><span className={styles.hint}>Holds a spot. The Media team won&apos;t start until you confirm the details.</span></span>
          </label>
        </>}
        {step === 2 && <>
          <fieldset {...fieldProps("copyChoice")} tabIndex={-1}>
            <legend>{assetOnly ? "Who's writing partner captions? (optional)" : "Who's writing the copy?"}</legend>
            <div className={styles.cards}>
              {(assetOnly
                ? [["self", "I'll write them", "I have captions ready"], ["help", "Help me write them", "The Media team drafts from my brief"]]
                : [["self", "I'll write it", "I have a caption ready"], ["help", "Help me write it", "The Media team drafts from my brief"]]
              ).map(([value, label, hint]) => <label key={value} className={styles.card}>
                <input type="radio" name={`${prefix}-copy`} checked={copyChoice === value} onChange={() => { setCopyChoice(value); patch({ needsCopyHelp: value === "help" }) }} />
                <span><strong>{label}</strong><span className={styles.hint}>{hint}</span></span>
              </label>)}
            </div>
          </fieldset>
          {assetOnly ? <>
            <Field label="Partner captions (optional)" hint="Text partners can post with the asset."><textarea {...fieldProps("caption")} rows={14} maxLength={20002} value={media.caption} onChange={(e) => patch({ caption: e.target.value })} /></Field>
            <Field label="Usage notes (optional)" hint="Who may use it, where, and any rules, such as tagging IPN."><textarea {...fieldProps("usageNotes")} rows={3} maxLength={10000} value={media.usageNotes || ""} onChange={(e) => patch({ usageNotes: e.target.value })} /></Field>
          </> : (copyChoice === "self" || media.caption) && <>
            <Field label="Post caption" hint="The full text for the post: headline or opening line, main message, key details, call to action and any useful links."><textarea {...fieldProps("caption")} rows={14} maxLength={20002} value={media.caption} onChange={(e) => patch({ caption: e.target.value })} /></Field>
          </>}
          <Field label="Files in Drive or Canva (optional)" hint="One link per line. Make sure the Media team has access.">
            <textarea {...fieldProps("links")} rows={3} value={links} onChange={(e) => setLinks(e.target.value)} />
          </Field>
          {showLink ? <div className={styles.linkBox}>
            <div className={styles.linkHeader}><strong>Link for readers</strong><button type="button" className={styles.textButton} onClick={() => {
              patch({ destinationUrl: "", linkPlacement: "" }); setShowLink(false); setError(null)
            }}>Remove reader link</button></div>
            <Field label="Destination URL"><input {...fieldProps("destinationUrl")} type="url" maxLength={2000} placeholder="https://…" value={media.destinationUrl || ""} onChange={(e) => patch({ destinationUrl: e.target.value })} /></Field>
            <Field label="Where to include the link" hint="For example: Instagram bio, caption or email button."><input {...fieldProps("linkPlacement")} maxLength={1000} value={media.linkPlacement || ""} onChange={(e) => patch({ linkPlacement: e.target.value })} /></Field>
          </div> : <button type="button" className={styles.textButton} onClick={() => setShowLink(true)}>+ Add a link for readers</button>}
        </>}
        {step === 3 && <>
          <Field label="Notes for the Media team (optional)"><textarea {...fieldProps("additionalDetails")} rows={3} maxLength={10000} value={media.additionalDetails || ""} onChange={(e) => patch({ additionalDetails: e.target.value })} /></Field>
          <dl {...fieldProps("review")} tabIndex={-1} className={styles.review}>
            {review.map((item) => <div key={item.label}>
              <dt>{item.label}</dt><dd>{item.value}</dd>
              <dd><button type="button" className={styles.textButton} aria-label={`Edit ${item.label.toLowerCase()}`} onClick={() => goTo(item.step)}>Edit</button></dd>
            </div>)}
          </dl>
        </>}
      </fieldset>
    </section>
    <footer className={styles.footer}>
      <button type="button" disabled={busy} className={styles.textButton} onClick={close}>Cancel</button>
      <div>
        {step > 0 && <button type="button" disabled={busy} className={styles.textButton} onClick={() => goTo(step - 1)}>Back</button>}
        <button type="submit" disabled={busy} className={styles.primary}>{busy ? "Sending…" : step === 3 ? "Send request" : "Continue"}</button>
      </div>
    </footer>
  </form>
}
