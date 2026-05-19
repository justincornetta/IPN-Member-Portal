"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { updateProfile } from "@/lib/auth/actions"
import {
  BACKGROUND_OPTIONS,
  STUDENT_BACKGROUNDS,
  PROFESSIONAL_BACKGROUNDS,
  FIELD_OPTIONS,
  FIELD_STATUS_OPTIONS,
} from "@/lib/constants/registration"
import {
  COUNTRIES,
  US_STATES,
  CANADIAN_PROVINCES,
  SCHOOLS_BY_COUNTRY,
} from "@/lib/constants/locations"

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
  area_of_interest: string | null
  linkedin_url: string | null
  is_discoverable: boolean | null
  avatar_url: string | null
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
  area_of_interest: string
  linkedin_url: string
  is_discoverable: boolean
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
    area_of_interest: profile?.area_of_interest ?? "",
    linkedin_url: profile?.linkedin_url ?? "",
    is_discoverable: profile?.is_discoverable ?? true,
    avatar_url: profile?.avatar_url ?? null,
  }
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
      className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
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
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
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
      className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileForm({
  profile,
  userId,
}: {
  profile: Profile | null
  userId: string
}) {
  const [data, setData] = useState<FormState>(() => toFormState(profile))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setAvatarUploading(true)
    setError(null)
    const supabase = createClient()

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(userId, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setError(uploadError.message)
      setAvatarUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(userId)
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`

    // Persist avatar_url immediately via client (RLS allows updating own row)
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId)

    update("avatar_url", publicUrl)
    setAvatarUploading(false)
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
      area_of_interest: data.area_of_interest || null,
      linkedin_url: data.linkedin_url || null,
      is_discoverable: data.is_discoverable,
      avatar_url: data.avatar_url,
    })

    setSaving(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setSaved(true)
    }
  }

  const showStateDropdown = data.country === "United States" || data.country === "Canada"
  const stateOptions = data.country === "Canada" ? CANADIAN_PROVINCES : US_STATES
  const showSchool = STUDENT_BACKGROUNDS.has(data.persona)
  const showAffiliation = PROFESSIONAL_BACKGROUNDS.has(data.persona)
  const schoolOptions = SCHOOLS_BY_COUNTRY[data.country] ?? []

  const initials = data.first_name
    ? `${data.first_name[0]}${data.last_name?.[0] ?? ""}`.toUpperCase()
    : userId[0].toUpperCase()

  return (
    <div className="flex flex-col gap-10">

      {/* ── Photo ── */}
      <section>
        <SectionHeading>Photo</SectionHeading>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-full transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ipn focus:ring-offset-2 disabled:opacity-50"
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
            <div className="absolute inset-0 flex items-end justify-center rounded-full bg-black/0 pb-1.5 opacity-0 transition hover:bg-black/30 hover:opacity-100">
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
      </section>

      {/* ── Personal info ── */}
      <section>
        <SectionHeading>Personal info</SectionHeading>
        <div className="flex flex-col gap-4">
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

          <div className="flex flex-col gap-1">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" name="bio" value={data.bio}
              onChange={(v) => update("bio", v)} rows={3}
              placeholder="A short introduction visible to other members…" />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="area_of_interest">Area of interest</Label>
            <TextInput id="area_of_interest" name="area_of_interest" value={data.area_of_interest}
              onChange={(v) => update("area_of_interest", v)}
              placeholder="e.g. Psilocybin therapy, clinical trials, harm reduction…" />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="linkedin_url">LinkedIn</Label>
            <TextInput id="linkedin_url" name="linkedin_url" value={data.linkedin_url}
              onChange={(v) => update("linkedin_url", v)}
              placeholder="https://linkedin.com/in/yourname" />
          </div>

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
        </div>
      </section>

      {/* ── About you ── */}
      <section>
        <SectionHeading>About you</SectionHeading>
        <div className="flex flex-col gap-1">
          <Label htmlFor="role_and_goals">Current role and professional goals</Label>
          <Textarea id="role_and_goals" name="role_and_goals" value={data.role_and_goals}
            onChange={(v) => update("role_and_goals", v)} rows={4}
            placeholder="Your current area of focus, roles you hope to pursue, and the types of organizations or impact areas you're most drawn to…" />
        </div>
      </section>

      {/* ── Background ── */}
      <section>
        <SectionHeading>Background</SectionHeading>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="persona">What best describes you?</Label>
            <Select id="persona" name="persona" value={data.persona}
              onChange={(v) => { update("persona", v); update("school", ""); update("affiliation", "") }}
              options={BACKGROUND_OPTIONS as unknown as string[]}
              placeholder="Select…" />
          </div>

          {showSchool && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="school">School</Label>
              <Combobox id="school" name="school" value={data.school}
                onChange={(v) => update("school", v)}
                options={schoolOptions}
                placeholder={data.country ? "Type to search…" : "Select a country first"} />
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
        {saved && (
          <span className="text-sm text-zinc-500">Changes saved</span>
        )}
        {error && (
          <span className="text-sm text-red-600">{error}</span>
        )}
      </div>
    </div>
  )
}
