"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Cropper from "react-easy-crop"
import type { Area } from "react-easy-crop"
import { createClient } from "@/lib/supabase/client"
import { disconnectDiscord, updateProfile } from "@/lib/auth/actions"
import { setCurrentUserMailchimpSubscription } from "@/lib/mailchimp/actions"
import type { MailchimpStatus } from "@/lib/mailchimp/status"
import {
  PERSONA_OPTIONS,
  STUDENT_BACKGROUNDS,
  PROFESSIONAL_BACKGROUNDS,
  FIELD_OPTIONS,
  FIELD_STATUS_OPTIONS,
  INTEREST_TAG_OPTIONS,
} from "@/lib/constants/registration"
import {
  COUNTRIES,
  US_STATES,
  CANADIAN_PROVINCES,
  SCHOOLS_BY_COUNTRY,
} from "@/lib/constants/locations"

const DISCORD_INVITE_URL =
  process.env.NEXT_PUBLIC_DISCORD_INVITE_URL ?? "https://discord.gg/YDdMGNF7X5"

// ── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  first_name: string | null
  last_name: string | null
  country: string | null
  state: string | null
  city: string | null
  persona: string | null
  affiliation: string | null
  school: string | null
  field: string | null
  psychedelic_field_status: string | null
  role_and_goals: string | null
  bio: string | null
  interest_tags: string[] | null
  linkedin_url: string | null
  discord_handle: string | null
  is_discoverable: boolean | null
  share_location: boolean | null
  avatar_url: string | null
  discord_user_id: string | null
  discord_username: string | null
  discord_global_name: string | null
  discord_avatar_url: string | null
  discord_connected_at: string | null
  discord_server_status: string | null
}

type FormState = {
  first_name: string
  last_name: string
  country: string
  state: string
  city: string
  persona: string
  affiliation: string
  school: string
  field: string
  psychedelic_field_status: string
  role_and_goals: string
  bio: string
  interest_tags: string[]
  linkedin_url: string
  discord_handle: string
  is_discoverable: boolean
  share_location: boolean
  avatar_url: string | null
}

function toFormState(profile: Profile | null): FormState {
  return {
    first_name: profile?.first_name ?? "",
    last_name: profile?.last_name ?? "",
    country: profile?.country ?? "",
    state: profile?.state ?? "",
    city: profile?.city ?? "",
    persona: profile?.persona ?? "",
    affiliation: profile?.affiliation ?? "",
    school: profile?.school ?? "",
    field: profile?.field ?? "",
    psychedelic_field_status: profile?.psychedelic_field_status ?? "",
    role_and_goals: profile?.role_and_goals ?? "",
    bio: profile?.bio ?? "",
    interest_tags: profile?.interest_tags ?? [],
    linkedin_url: profile?.linkedin_url ?? "",
    discord_handle: profile?.discord_handle ?? "",
    is_discoverable: profile?.is_discoverable ?? true,
    share_location: profile?.share_location ?? true,
    avatar_url: profile?.avatar_url ?? null,
  }
}

// ── Account field (email / password change) ───────────────────────────────────

function AccountField({ label, value, onEmailChange }: { label: string; value: string; onEmailChange?: (email: string) => void | Promise<void> }) {
  const isPassword = label === "Password"
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)

  async function handleSave() {
    if (!val.trim()) return
    if (!isPassword && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      setMsg({ text: "Enter a valid email address", error: true })
      return
    }
    if (isPassword) {
      if (val.length < 8) { setMsg({ text: "At least 8 characters", error: true }); return }
      if (val !== confirm) { setMsg({ text: "Passwords don't match", error: true }); return }
    }
    setSaving(true)
    setMsg(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser(
      isPassword ? { password: val } : { email: val },
    )
    setSaving(false)
    if (error) {
      setMsg({ text: error.message, error: true })
    } else {
      setMsg({
        text: isPassword
          ? "Password updated"
          : `Confirmation sent to ${val}. Click the link to confirm.`,
      })
      if (!isPassword) void onEmailChange?.(val)
      setVal("")
      setConfirm("")
      if (isPassword) setTimeout(() => { setOpen(false); setMsg(null) }, 2000)
    }
  }

  const inputCls = "rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-ipn focus:ring-2 focus:ring-ipn/20"

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500">{label}</p>
          <p className="mt-0.5 text-sm text-zinc-800">{value}</p>
        </div>
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setMsg(null); setVal(""); setConfirm("") }}
          className="cursor-pointer text-xs font-medium text-ipn transition hover:underline"
        >
          {open ? "Cancel" : "Change"}
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-2 border-t border-zinc-100 pt-3">
          <input
            type={isPassword ? "password" : "email"}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={isPassword ? "New password" : "New email address"}
            autoComplete={isPassword ? "new-password" : "email"}
            className={inputCls}
          />
          {isPassword && (
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className={inputCls}
            />
          )}
          {msg && (
            <p className={`text-xs ${msg.error ? "text-red-600" : "text-zinc-500"}`}>{msg.text}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="cursor-pointer self-end rounded-lg bg-ipn px-4 py-2 text-sm font-medium text-white transition hover:bg-ipn/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : `Update ${label.toLowerCase()}`}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Primitives ────────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 border-b border-zinc-100 pb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
      {children}
    </h2>
  )
}

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-700">
      {children}
    </label>
  )
}

function TextInput({
  id, name, type = "text", value, onChange, placeholder, autoComplete,
}: {
  id: string; name: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string; autoComplete?: string
}) {
  return (
    <input
      id={id} name={name} type={type} value={value}
      autoComplete={autoComplete} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
    />
  )
}

function Select({
  id, name, value, onChange, options, placeholder,
}: {
  id: string; name: string; value: string
  onChange: (v: string) => void; options: readonly string[]
  placeholder?: string
}) {
  return (
    <select
      id={id} name={name} value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function Combobox({
  id, name, value, onChange, options, placeholder,
}: {
  id: string; name: string; value: string
  onChange: (v: string) => void; options: string[]
  placeholder?: string
}) {
  const [query, setQuery] = useState(value)
  const [open, setOpen] = useState(false)

  const filtered = query.length >= 2
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase())).slice(0, 60)
    : []

  function select(option: string) {
    onChange(option)
    setQuery(option)
    setOpen(false)
  }

  return (
    <div className="relative">
      <input
        id={id} name={name} type="text" value={query}
        placeholder={placeholder} autoComplete="off"
        onChange={(e) => { setQuery(e.target.value); onChange(""); setOpen(true) }}
        onFocus={() => { if (query.length >= 2) setOpen(true) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {filtered.map((o) => (
            <li
              key={o}
              onMouseDown={() => select(o)}
              className="cursor-pointer px-3 py-2 text-sm text-zinc-900 hover:bg-zinc-50"
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const UPPERCASE_TAG_WORDS = new Set([
  "LSD", "MDMA", "DMT", "PTSD", "OCD", "CBD", "THC", "IBG", "KAP", "PAT",
  "MAPS", "FDA", "DEA", "DNA", "RNA", "ADHD", "ASD", "TBI", "IV",
])

function toTagCase(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((word) =>
      UPPERCASE_TAG_WORDS.has(word.toUpperCase())
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ")
}

function TagPickerModal({
  selected,
  onChange,
  onClose,
}: {
  selected: string[]
  onChange: (tags: string[]) => void
  onClose: () => void
}) {
  const [local, setLocal] = useState<string[]>(selected)
  const [search, setSearch] = useState("")

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  function toggle(tag: string) {
    setLocal((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : prev.length < 3
          ? [...prev, tag]
          : prev,
    )
  }

  const q = search.trim()
  const presetSet = new Set(INTEREST_TAG_OPTIONS as readonly string[])
  const customSelected = local.filter((t) => !presetSet.has(t))
  const filtered = INTEREST_TAG_OPTIONS.filter((t) =>
    t.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-zinc-900">Pick your interests</p>
            <p className="mt-0.5 text-xs text-zinc-400">{local.length} / 3 selected</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-zinc-100 px-5 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search interests…"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-ipn focus:outline-none focus:ring-1 focus:ring-ipn"
            autoFocus
          />
        </div>

        {/* Tag list */}
        <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto px-5 py-4">
          {customSelected.length > 0 && (
            <>
              {customSelected.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  className="rounded-full bg-ipn px-3 py-1 text-xs font-medium text-white cursor-pointer"
                >
                  {tag}
                </button>
              ))}
              {(filtered.length > 0 || q) && <div className="w-full border-t border-zinc-100 mt-1 mb-1" />}
            </>
          )}
          {filtered.length > 0 ? (
            filtered.map((tag) => {
              const active = local.includes(tag)
              const disabled = !active && local.length >= 3
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  disabled={disabled}
                  className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-ipn text-white"
                      : disabled
                        ? "bg-zinc-100 text-zinc-300 cursor-not-allowed"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {tag}
                </button>
              )
            })
          ) : (
            <p className="text-xs text-zinc-400">{q ? "No matching interests found." : ""}</p>
          )}
        </div>

        <div className="border-t border-zinc-100 px-5 py-4">
          <button
            type="button"
            onClick={() => { onChange(local); onClose() }}
            className="w-full rounded-lg bg-ipn py-2.5 text-sm font-medium text-white transition hover:bg-ipn-dark"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function Textarea({
  id, name, value, onChange, placeholder, rows = 4,
}: {
  id: string; name: string; value: string
  onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  return (
    <textarea
      id={id} name={name} value={value} rows={rows} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
    />
  )
}

// ── Crop helper ──────────────────────────────────────────────────────────────

async function getCroppedBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = imageSrc
  })
  const canvas = document.createElement("canvas")
  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Canvas empty"))), "image/jpeg", 0.92),
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileForm({
  profile,
  userId,
  userEmail,
  discordStatus,
  mailchimpStatus,
}: {
  profile: Profile | null
  userId: string
  userEmail: string
  discordStatus: string | null
  mailchimpStatus: MailchimpStatus
}) {
  const router = useRouter()
  const [data, setData] = useState<FormState>(() => toFormState(profile))
  const [discordProfile, setDiscordProfile] = useState(() => ({
    userId: profile?.discord_user_id ?? null,
    username: profile?.discord_username ?? null,
    globalName: profile?.discord_global_name ?? null,
    avatarUrl: profile?.discord_avatar_url ?? null,
    connectedAt: profile?.discord_connected_at ?? null,
    serverStatus: profile?.discord_server_status ?? null,
  }))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discordDisconnecting, setDiscordDisconnecting] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [subscribed, setSubscribed] = useState(mailchimpStatus === "subscribed")
  const [subscriptionSaving, setSubscriptionSaving] = useState(false)
  const [subscriptionMsg, setSubscriptionMsg] = useState<string | null>(null)
  const [atUniversity, setAtUniversity] = useState(() =>
    PROFESSIONAL_BACKGROUNDS.has(profile?.persona ?? "") && !!profile?.school,
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""
    const reader = new FileReader()
    reader.onload = () => setCropSrc(reader.result as string)
    reader.readAsDataURL(file)
  }

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  async function handleCropConfirm() {
    if (!cropSrc || !croppedAreaPixels) return
    setAvatarUploading(true)
    setError(null)
    setCropSrc(null)

    try {
      const blob = await getCroppedBlob(cropSrc, croppedAreaPixels)
      const supabase = createClient()

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(userId, blob, { upsert: true, contentType: "image/jpeg" })

      if (uploadError) { setError(uploadError.message); return }

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(userId)
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId)
      update("avatar_url", publicUrl)
      router.refresh()
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)

    const result = await updateProfile({
      first_name: data.first_name,
      last_name: data.last_name,
      country: data.country,
      state: data.state,
      city: data.city,
      persona: data.persona,
      affiliation: data.affiliation || null,
      school: data.school || null,
      field: data.field,
      psychedelic_field_status: data.psychedelic_field_status,
      role_and_goals: data.role_and_goals,
      bio: data.bio || null,
      interest_tags: data.interest_tags.length > 0 ? data.interest_tags : null,
      linkedin_url: data.linkedin_url || null,
      discord_handle: data.discord_handle || null,
      is_discoverable: data.is_discoverable,
      share_location: data.share_location,
      avatar_url: data.avatar_url,
    })

    setSaving(false)
    if (result?.error) setError(result.error)
    else setSaved(true)
  }

  async function handleDisconnectDiscord() {
    setDiscordDisconnecting(true)
    setError(null)

    const result = await disconnectDiscord()

    setDiscordDisconnecting(false)
    if (result?.error) {
      setError(result.error)
      return
    }

    setDiscordProfile({
      userId: null,
      username: null,
      globalName: null,
      avatarUrl: null,
      connectedAt: null,
      serverStatus: null,
    })
    router.refresh()
  }

  const showStateDropdown = data.country === "United States" || data.country === "Canada"
  const stateOptions = data.country === "Canada" ? CANADIAN_PROVINCES : US_STATES
  const isProfessional = PROFESSIONAL_BACKGROUNDS.has(data.persona)
  const showSchool = STUDENT_BACKGROUNDS.has(data.persona) || (isProfessional && atUniversity)
  const showAffiliation = isProfessional && !atUniversity
  const schoolLabel = isProfessional ? "University" : "School"
  const schoolOptions = SCHOOLS_BY_COUNTRY[data.country] ?? []

  const initials = data.first_name
    ? `${data.first_name[0]}${data.last_name?.[0] ?? ""}`.toUpperCase()
    : userId[0].toUpperCase()
  const discordConnected = Boolean(discordProfile.userId)
  const discordName =
    discordProfile.globalName ?? discordProfile.username ?? "Discord account"
  const discordConnectHref = "/auth/discord/start?next=/dashboard/profile"
  const discordNeedsInvite =
    discordConnected &&
    (discordProfile.serverStatus === "failed" ||
      discordProfile.serverStatus === "skipped" ||
      discordStatus === "connected_invite" ||
      discordStatus === "connected_join_failed")
  const discordMessage =
    discordStatus === "missing_config"
      ? "Discord OAuth is not configured for this environment yet."
      : discordStatus === "invalid_state"
        ? "Discord verification expired. Please try connecting again."
        : discordStatus === "not_authenticated"
          ? "Sign in to the portal before connecting Discord."
          : discordStatus === "connected_joined"
            ? "Discord connected and server access was added."
            : discordStatus === "connected_invite"
              ? "Discord connected. Use the Discord button below to join the IPN server."
              : discordStatus === "connected_join_failed"
                ? "Discord connected, but automatic server join did not complete. Use the Discord button below to join manually."
          : discordStatus === "token_error" ||
              discordStatus === "user_error" ||
              discordStatus === "save_error"
            ? "Discord could not be connected. Please try again."
            : null

  return (
    <div className="flex flex-col gap-10">

      {/* ── Photo & Name ── */}
      <section>
        <SectionHeading>Photo &amp; Name</SectionHeading>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="group relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full transition focus:outline-none focus:ring-2 focus:ring-ipn focus:ring-offset-2 disabled:opacity-50"
              title="Change photo"
            >
              {data.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-ipn text-2xl font-semibold text-white">
                  {initials}
                </div>
              )}
              <div className="absolute inset-0 flex items-end justify-center rounded-full bg-black/0 pb-1.5 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                <span className="text-[10px] font-medium text-white">Edit</span>
              </div>
            </button>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="text-sm font-medium text-ipn hover:underline disabled:opacity-50"
              >
                {avatarUploading ? "Uploading…" : "Upload new photo"}
              </button>
              <p className="mt-0.5 text-xs text-zinc-400">JPG, PNG or GIF · max 5 MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="first_name">First name</Label>
              <TextInput id="first_name" name="first_name" value={data.first_name}
                onChange={(v) => update("first_name", v)} autoComplete="given-name" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="last_name">Last name</Label>
              <TextInput id="last_name" name="last_name" value={data.last_name}
                onChange={(v) => update("last_name", v)} autoComplete="family-name" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Public Profile ── */}
      <section>
        <SectionHeading>Public Profile</SectionHeading>


        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" name="bio" value={data.bio}
              onChange={(v) => update("bio", v)} rows={3}
              placeholder="A short introduction visible to other members…" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="interest_tags">Interests</Label>
            <p className="text-xs text-zinc-400">Up to 3, shown on your directory profile.</p>
            {data.interest_tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {data.interest_tags.map((t) => (
                  <span key={t} className="rounded-full bg-ipn-light px-3 py-1 text-xs font-medium text-ipn">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setTagPickerOpen(true)}
              className="self-start rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
            >
              {data.interest_tags.length > 0 ? "Edit interests" : "Add interests"}
            </button>
          </div>

          {tagPickerOpen && (
            <TagPickerModal
              selected={data.interest_tags}
              onChange={(tags) => update("interest_tags", tags)}
              onClose={() => setTagPickerOpen(false)}
            />
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="linkedin_url">LinkedIn</Label>
            <TextInput id="linkedin_url" name="linkedin_url" value={data.linkedin_url}
              onChange={(v) => update("linkedin_url", v)}
              placeholder="https://linkedin.com/in/yourname" />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="discord_handle">Discord handle</Label>
            <TextInput id="discord_handle" name="discord_handle" value={data.discord_handle}
              onChange={(v) => update("discord_handle", v)}
              placeholder="e.g. username or @username" />
            <p className="text-xs text-zinc-400">Shared with your connections</p>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="persona">What best describes you?</Label>
            <select
              id="persona"
              name="persona"
              value={data.persona}
              onChange={(e) => { update("persona", e.target.value); update("school", ""); update("affiliation", ""); setAtUniversity(false) }}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
            >
              <option value="">Select…</option>
              {PERSONA_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {isProfessional && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={atUniversity}
                onChange={(e) => {
                  setAtUniversity(e.target.checked)
                  if (e.target.checked) update("affiliation", "")
                  else update("school", "")
                }}
                className="h-4 w-4 rounded border-zinc-300 accent-[#664fa1]"
              />
              <span className="text-sm text-zinc-700">I work at or am affiliated with a university</span>
            </label>
          )}

          {showSchool && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="school">{schoolLabel}</Label>
              <Combobox id="school" name="school" value={data.school}
                onChange={(v) => update("school", v)}
                options={schoolOptions}
                placeholder={data.country ? "Type to search…" : "Select a country first"} />
              <p className="text-xs text-zinc-400">
                Schools are filtered by country. Update your country in the Location section to see schools in a different country.
              </p>
            </div>
          )}

          {showAffiliation && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="affiliation">Organization or affiliation</Label>
              <TextInput id="affiliation" name="affiliation" value={data.affiliation}
                onChange={(v) => update("affiliation", v)}
                placeholder="Company, organization, self-employed…" />
            </div>
          )}
        </div>
      </section>

      {/* ── Community Chat ── */}
      <section>
        <SectionHeading>Community Chat</SectionHeading>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          {discordMessage && (
            <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {discordMessage}
            </p>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {discordProfile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={discordProfile.avatarUrl}
                  alt=""
                  className="h-11 w-11 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#5865F2] text-sm font-semibold text-white">
                  DC
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  {discordConnected ? discordName : "Connect Discord"}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-zinc-500">
                  {discordConnected
                    ? "Your portal profile is linked for community chat access."
                    : "Optional, but recommended for event chats and Discord updates."}
                </p>
                {discordConnected && discordProfile.serverStatus === "failed" && (
                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    Discord was linked, but automatic server join did not complete. Use Reconnect to try again.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={discordConnectHref}
                className="rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#4752C4]"
              >
                {discordConnected ? "Reconnect" : "Connect"}
              </a>
              {discordConnected && (
                <a
                  href={DISCORD_INVITE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    discordNeedsInvite
                      ? "border-[#5865F2] text-[#5865F2] hover:bg-[#5865F2]/5"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  Open Discord
                </a>
              )}
              {discordConnected && (
                <button
                  type="button"
                  onClick={handleDisconnectDiscord}
                  disabled={discordDisconnecting}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  {discordDisconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Location ── */}
      <section>
        <SectionHeading>Location</SectionHeading>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="country">Country</Label>
            <Select id="country" name="country" value={data.country}
              onChange={(v) => { update("country", v); update("state", ""); update("school", "") }}
              options={COUNTRIES} placeholder="Select a country" />
          </div>

          {showStateDropdown && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="state">
                {data.country === "Canada" ? "Province / Territory" : "State / Territory"}
              </Label>
              <Select id="state" name="state" value={data.state}
                onChange={(v) => update("state", v)}
                options={stateOptions} placeholder="Select…" />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="city">City</Label>
            <TextInput id="city" name="city" value={data.city}
              onChange={(v) => update("city", v)}
              placeholder="Your current city or town" />
          </div>
        </div>
      </section>

      {/* ── Visibility ── */}
      <section>
        <SectionHeading>Visibility</SectionHeading>
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={data.is_discoverable}
              onChange={(e) => update("is_discoverable", e.target.checked)}
              className="mt-0.5 accent-ipn"
            />
            <div>
              <p className="text-sm font-medium text-zinc-700">Make my profile discoverable</p>
              <p className="text-xs text-zinc-400">
                Other members can find you in the directory. Uncheck to stay private.
              </p>
            </div>
          </label>

          {data.is_discoverable && (
            <label className="ml-6 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={data.share_location}
                onChange={(e) => update("share_location", e.target.checked)}
                className="mt-0.5 accent-ipn"
              />
              <div>
                <p className="text-sm font-medium text-zinc-700">Allow location-based discovery</p>
                <p className="text-xs text-zinc-400">
                  Members in your area can find you. Approximate region only, nothing specific.
                </p>
              </div>
            </label>
          )}

          {/* What each level can see */}
          <div className="mt-1 rounded-lg border border-zinc-100 bg-zinc-50 p-4 flex flex-col gap-3 text-xs">
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold text-zinc-500">Directory members see</p>
              <p className="text-zinc-400">Bio, interests, LinkedIn, stage, school or affiliation</p>
            </div>
            <div className="h-px bg-zinc-200" />
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold text-zinc-500">Connections also see</p>
              <p className="text-zinc-400">
                Email
                {data.discord_handle
                  ? `, Discord (${data.discord_handle})`
                  : " · Discord handle (if added)"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── About You ── */}
      <section>
        <SectionHeading>About You</SectionHeading>
        <div className="flex flex-col gap-1">
          <Label htmlFor="role_and_goals">Current role and professional goals</Label>
          <Textarea id="role_and_goals" name="role_and_goals" value={data.role_and_goals}
            onChange={(v) => update("role_and_goals", v)} rows={4}
            placeholder="Your current area of focus, roles you hope to pursue, and the types of organizations or impact areas you're most drawn to…" />
        </div>
      </section>

      {/* ── Field & Focus ── */}
      <section>
        <SectionHeading>Field &amp; Focus</SectionHeading>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-zinc-700">Which field are you primarily in?</p>
            {FIELD_OPTIONS.map((opt) => (
              <label key={opt} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="field" value={opt}
                  checked={data.field === opt}
                  onChange={() => update("field", opt)}
                  className="accent-ipn" />
                <span className="text-sm text-zinc-700">{opt}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-zinc-700">
              Are you currently working in, or interested in working in, the psychedelics field?
            </p>
            {FIELD_STATUS_OPTIONS.map((opt) => (
              <label key={opt} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="psychedelic_field_status" value={opt}
                  checked={data.psychedelic_field_status === opt}
                  onChange={() => update("psychedelic_field_status", opt)}
                  className="accent-ipn" />
                <span className="text-sm text-zinc-700">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* ── Email preferences ── */}
      <section>
        <SectionHeading>Email preferences</SectionHeading>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={subscribed}
            disabled={subscriptionSaving}
            onChange={async (e) => {
              const next = e.target.checked
              setSubscribed(next)
              setSubscriptionSaving(true)
              setSubscriptionMsg(null)
              const result = await setCurrentUserMailchimpSubscription(userEmail, next)
              setSubscriptionSaving(false)
              if (result.error) {
                setSubscribed(!next)
                setSubscriptionMsg(result.errorDescription ?? result.error)
              } else {
                setSubscriptionMsg(next ? "Subscribed" : "Unsubscribed")
                setTimeout(() => setSubscriptionMsg(null), 3000)
              }
            }}
            className="mt-0.5 accent-ipn"
          />
          <div>
            <p className="text-sm font-medium text-zinc-700">IPN member updates</p>
            <p className="text-xs text-zinc-400">
              Event announcements, community news, and member resources.
            </p>
            {subscriptionMsg && (
              <p className="mt-1 text-xs text-zinc-500">{subscriptionMsg}</p>
            )}
          </div>
        </label>
      </section>

      {/* ── Account ── */}
      <section>
        <SectionHeading>Account</SectionHeading>
        <div className="flex flex-col gap-3">
          <AccountField label="Email" value={userEmail} onEmailChange={subscribed ? async (email) => { await setCurrentUserMailchimpSubscription(email, true) } : undefined} />
          <AccountField label="Password" value="••••••••••••" />
        </div>
      </section>

      {/* ── Save ── */}
      <div className="flex items-center gap-4 border-t border-zinc-100 pt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-ipn px-6 py-2.5 text-sm font-medium text-white transition hover:bg-ipn-dark disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && <span className="text-sm text-zinc-500">Changes saved</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      {/* ── Crop modal ── */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/80">
          <div className="relative flex-1">
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div className="flex flex-col gap-3 bg-zinc-900 px-6 py-5">
            <div className="flex items-center gap-3">
              <svg className="h-4 w-4 flex-shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-ipn"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCropSrc(null)}
                className="flex-1 rounded-lg border border-zinc-600 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCropConfirm}
                className="flex-1 rounded-lg bg-ipn py-2.5 text-sm font-medium text-white hover:bg-ipn/90 transition"
              >
                Save photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
