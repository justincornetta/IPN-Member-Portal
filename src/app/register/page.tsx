"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import icon from "../../../assets/purple_icon.png"
import { signUp } from "@/lib/auth/actions"
import { getPortalAnalyticsContext, trackPortalEvent } from "@/lib/portal-analytics/client"
import NeuralBackground from "@/components/NeuralBackground"
import CityVerificationField from "@/components/location/CityVerificationField"
import type {
  LocationVerificationStatus,
  VerifiedLocation,
} from "@/components/location/CityVerificationField"
import {
  PERSONA_OPTIONS,
  STUDENT_BACKGROUNDS,
  PROFESSIONAL_BACKGROUNDS,
  FIELD_OPTIONS,
  FIELD_STATUS_OPTIONS,
  BARRIER_OPTIONS,
  REFERRAL_OPTIONS,
  STEPS,
} from "@/lib/constants/registration"
import {
  COUNTRIES,
  US_STATES,
  CANADIAN_PROVINCES,
  SCHOOLS_BY_COUNTRY,
} from "@/lib/constants/locations"

type FormData = {
  first_name: string
  last_name: string
  email: string
  password: string
  confirm_password: string
  country: string
  state: string
  city: string
  city_lat: number | null
  city_lng: number | null
  persona: string
  affiliation: string
  school: string
  field: string
  field_status: string
  barriers: string[]
  barriers_other: string
  role_and_goals: string
  inspiration: string
  support_needs: string
  referral_source: string
}

type StringFormKey = {
  [K in keyof FormData]: FormData[K] extends string ? K : never
}[keyof FormData]

const EMPTY: FormData = {
  first_name: "", last_name: "", email: "", password: "", confirm_password: "",
  country: "", state: "", city: "", city_lat: null, city_lng: null,
  persona: "", affiliation: "", school: "",
  field: "", field_status: "",
  barriers: [], barriers_other: "",
  role_and_goals: "", inspiration: "", support_needs: "", referral_source: "",
}

// ── Shared primitives ────────────────────────────────────────────────────────

function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-700">
      {children}
    </label>
  )
}

function TextInput({
  id, name, type = "text", value, onChange, placeholder, required, autoComplete,
}: {
  id: string; name: string; type?: string; value: string
  onChange: (v: string) => void; placeholder?: string
  required?: boolean; autoComplete?: string
}) {
  return (
    <input
      id={id} name={name} type={type} value={value} required={required}
      autoComplete={autoComplete} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-zinc-300 px-3 py-2 text-base text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20 sm:text-sm"
    />
  )
}

function Select({
  id, name, value, onChange, options, placeholder, required,
}: {
  id: string; name: string; value: string
  onChange: (v: string) => void; options: readonly string[]
  placeholder?: string; required?: boolean
}) {
  return (
    <select
      id={id} name={name} value={value} required={required}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base text-zinc-900 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20 sm:text-sm"
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

  // Sync display text when value is cleared externally (e.g. country changes)
  useEffect(() => {
    if (!value) {
      const timer = window.setTimeout(() => setQuery(""), 0)
      return () => window.clearTimeout(timer)
    }
  }, [value])

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
        className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-base text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20 sm:text-sm"
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
      className="rounded-lg border border-zinc-300 px-3 py-2 text-base text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20 resize-none sm:text-sm"
    />
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-600">{msg}</p>
}

// ── Step components ──────────────────────────────────────────────────────────

function StepAccount({
  data, update, errors,
}: {
  data: FormData
  update: (k: StringFormKey, v: string) => void
  errors: Record<string, string>
}) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="flex flex-col gap-0.5 sm:gap-1">
          <Label htmlFor="first_name">First name</Label>
          <TextInput id="first_name" name="first_name" value={data.first_name}
            onChange={(v) => update("first_name", v)} required autoComplete="given-name" />
          <FieldError msg={errors.first_name} />
        </div>
        <div className="flex flex-col gap-0.5 sm:gap-1">
          <Label htmlFor="last_name">Last name</Label>
          <TextInput id="last_name" name="last_name" value={data.last_name}
            onChange={(v) => update("last_name", v)} required autoComplete="family-name" />
          <FieldError msg={errors.last_name} />
        </div>
      </div>

      <div className="flex flex-col gap-0.5 sm:gap-1">
        <Label htmlFor="email">Email</Label>
        <TextInput id="email" name="email" type="email" value={data.email}
          onChange={(v) => update("email", v)} required autoComplete="email" />
        <FieldError msg={errors.email} />
      </div>

      <div className="flex flex-col gap-0.5 sm:gap-1">
        <Label htmlFor="password">Password</Label>
        <TextInput id="password" name="password" type="password" value={data.password}
          onChange={(v) => update("password", v)} required autoComplete="new-password"
          placeholder="At least 8 characters" />
        <FieldError msg={errors.password} />
      </div>

      <div className="flex flex-col gap-0.5 sm:gap-1">
        <Label htmlFor="confirm_password">Confirm password</Label>
        <TextInput id="confirm_password" name="confirm_password" type="password"
          value={data.confirm_password} onChange={(v) => update("confirm_password", v)}
          required autoComplete="new-password" />
        <FieldError msg={errors.confirm_password} />
      </div>
    </div>
  )
}

function StepLocation({
  data,
  update,
  errors,
  onVerifiedLocation,
  onLocationStatus,
}: {
  data: FormData
  update: (k: StringFormKey, v: string) => void
  errors: Record<string, string>
  onVerifiedLocation: (location: VerifiedLocation | null) => void
  onLocationStatus: (status: LocationVerificationStatus) => void
}) {
  const [atUniversity, setAtUniversity] = useState(false)
  const showStateDropdown = data.country === "United States" || data.country === "Canada"
  const stateOptions = data.country === "Canada" ? CANADIAN_PROVINCES : US_STATES
  const isProfessional = PROFESSIONAL_BACKGROUNDS.has(data.persona)
  const showSchool = STUDENT_BACKGROUNDS.has(data.persona) || (isProfessional && atUniversity)
  const showAffiliation = isProfessional && !atUniversity
  const schoolLabel = isProfessional ? "University" : "School"
  const schoolOptions = SCHOOLS_BY_COUNTRY[data.country] ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="country">Country</Label>
        <Select id="country" name="country" value={data.country}
          onChange={(v) => {
            update("country", v)
            update("state", "")
            update("school", "")
            onVerifiedLocation(null)
          }}
          options={COUNTRIES} placeholder="Select a country" required />
        <FieldError msg={errors.country} />
      </div>

      {showStateDropdown && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="state">
            {data.country === "Canada" ? "Province / Territory" : "State / Territory"}
          </Label>
          <Select id="state" name="state" value={data.state}
            onChange={(v) => {
              update("state", v)
              onVerifiedLocation(null)
            }}
            options={stateOptions} placeholder="Select…" />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <Label htmlFor="city">City</Label>
        <CityVerificationField
          city={data.city}
          state={data.state}
          country={data.country}
          required
          error={errors.city}
          onCityChange={(value) => update("city", value)}
          onVerifiedLocationChange={onVerifiedLocation}
          onStatusChange={onLocationStatus}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="persona">What best describes you?</Label>
        <select
          id="persona"
          name="persona"
          value={data.persona}
          required
          onChange={(e) => { update("persona", e.target.value); update("school", ""); update("affiliation", ""); setAtUniversity(false) }}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
        >
          <option value="">Select…</option>
          {PERSONA_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <FieldError msg={errors.persona} />
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
          {data.country && <p className="text-xs text-zinc-400">Showing schools in {data.country}. Change your country selection above to search elsewhere.</p>}
          <FieldError msg={errors.school} />
        </div>
      )}

      {showAffiliation && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="affiliation">Organization or affiliation</Label>
          <TextInput id="affiliation" name="affiliation" value={data.affiliation}
            onChange={(v) => update("affiliation", v)}
            placeholder="Company, organization, self-employed…" />
          <FieldError msg={errors.affiliation} />
        </div>
      )}
    </div>
  )
}

function StepBackground({
  data, update, updateBarriers, errors,
}: {
  data: FormData
  update: (k: StringFormKey, v: string) => void
  updateBarriers: (v: string[]) => void
  errors: Record<string, string>
}) {
  const showBarriers = data.field_status !== "" &&
    data.field_status !== "Yes — I currently work in the field"

  function toggleBarrier(option: string) {
    const next = data.barriers.includes(option)
      ? data.barriers.filter((b) => b !== option)
      : [...data.barriers, option]
    updateBarriers(next)
  }

  return (
    <div className="flex flex-col gap-6">

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-700">Which field are you primarily in?</p>
        {FIELD_OPTIONS.map((opt) => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="field" value={opt}
              checked={data.field === opt}
              onChange={() => update("field", opt)}
              className="accent-ipn" />
            <span className="text-sm text-zinc-700">{opt}</span>
          </label>
        ))}
        <FieldError msg={errors.field} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-700">
          Are you currently working in, or interested in working in, the field?
        </p>
        {FIELD_STATUS_OPTIONS.map((opt) => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="field_status" value={opt}
              checked={data.field_status === opt}
              onChange={() => update("field_status", opt)}
              className="accent-ipn" />
            <span className="text-sm text-zinc-700">{opt}</span>
          </label>
        ))}
        <FieldError msg={errors.field_status} />
      </div>

      {showBarriers && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-zinc-700">
            If you&apos;re not currently working in the field, why not?{" "}
            <span className="font-normal text-zinc-400">(Select all that apply)</span>
          </p>
          {BARRIER_OPTIONS.map((opt) => (
            <label key={opt} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" value={opt}
                checked={data.barriers.includes(opt)}
                onChange={() => toggleBarrier(opt)}
                className="accent-ipn rounded" />
              <span className="text-sm text-zinc-700">{opt}</span>
            </label>
          ))}
          {data.barriers.includes("Other") && (
            <TextInput id="barriers_other" name="barriers_other"
              value={data.barriers_other} onChange={(v) => update("barriers_other", v)}
              placeholder="Please specify…" />
          )}
        </div>
      )}
    </div>
  )
}

function StepAbout({
  data, update, errors,
}: {
  data: FormData
  update: (k: StringFormKey, v: string) => void
  errors: Record<string, string>
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Label htmlFor="role_and_goals">
          What is your current role or interest, and what are your professional goals?
        </Label>
        <p className="text-xs text-zinc-400">
          Share your current area of focus, roles you hope to pursue, and the
          types of organizations or impact areas you&apos;re most drawn to.
        </p>
        <Textarea id="role_and_goals" name="role_and_goals" value={data.role_and_goals}
          onChange={(v) => update("role_and_goals", v)} rows={4} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="inspiration">What inspired you to get involved with IPN?</Label>
        <Textarea id="inspiration" name="inspiration" value={data.inspiration}
          onChange={(v) => update("inspiration", v)} rows={3} />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="support_needs">What resource or support would help you most right now?</Label>
        <Textarea id="support_needs" name="support_needs" value={data.support_needs}
          onChange={(v) => update("support_needs", v)} rows={3} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-700">How did you hear about us?</p>
        {REFERRAL_OPTIONS.map((opt) => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="referral_source" value={opt}
              checked={data.referral_source === opt}
              onChange={() => update("referral_source", opt)}
              className="accent-ipn" />
            <span className="text-sm text-zinc-700">{opt}</span>
          </label>
        ))}
        <FieldError msg={errors.referral_source} />
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

function RegisterPageContent() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("next") ?? ""
  const [step, setStep] = useState(1)
  const [data, setData] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  function update(key: StringFormKey, value: string) {
    setData((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => { const e = { ...prev }; delete e[key]; return e })
  }

  function handleVerifiedLocation(location: VerifiedLocation | null) {
    setData((prev) => ({
      ...prev,
      city: location?.city ?? prev.city,
      state: location?.state ?? prev.state,
      country: location?.country ?? prev.country,
      city_lat: location?.lat ?? null,
      city_lng: location?.lng ?? null,
    }))
    setErrors((prev) => { const e = { ...prev }; delete e.city; return e })
  }

  function updateBarriers(value: string[]) {
    setData((prev) => ({ ...prev, barriers: value }))
  }

  function validate(s: number): boolean {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!data.first_name.trim()) e.first_name = "Required"
      if (!data.last_name.trim()) e.last_name = "Required"
      if (!data.email.trim()) e.email = "Required"
      if (data.password.length < 8) e.password = "At least 8 characters"
      if (data.password !== data.confirm_password) e.confirm_password = "Passwords don't match"
    }
    if (s === 2) {
      if (!data.country) e.country = "Required"
      if (!data.city.trim()) e.city = "Required"
      if (!data.persona) e.persona = "Required"
      if (STUDENT_BACKGROUNDS.has(data.persona) && !data.school)
        e.school = "Please select your school from the list"
    }
    if (s === 3) {
      if (!data.field) e.field = "Please select one"
      if (!data.field_status) e.field_status = "Please select one"
    }
    if (s === 4) {
      if (!data.referral_source) e.referral_source = "Please select one"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (validate(step)) setStep((s) => s + 1)
  }

  function back() {
    setStep((s) => s - 1)
    setErrors({})
  }

  async function submit() {
    if (!validate(4)) return
    setLoading(true)
    setGlobalError(null)

    const barriers = data.barriers.map((b) =>
      b === "Other" && data.barriers_other ? data.barriers_other : b,
    )
    const analytics = getPortalAnalyticsContext()
    trackPortalEvent("registration_submit", {
      metadata: {
        step,
        persona: data.persona,
        referral_source: data.referral_source,
      },
    })

    const result = await signUp({
      email: data.email,
      password: data.password,
      first_name: data.first_name,
      last_name: data.last_name,
      country: data.country,
      state: data.state,
      city: data.city,
      city_lat: data.city_lat,
      city_lng: data.city_lng,
      persona: data.persona,
      affiliation: data.affiliation || null,
      school: data.school || null,
      field: data.field,
      psychedelic_field_status: data.field_status,
      psychedelic_field_barriers: barriers,
      role_and_goals: data.role_and_goals,
      inspiration: data.inspiration,
      support_needs: data.support_needs,
      referral_source: data.referral_source,
    }, redirectTo || undefined, analytics)

    if (result?.error) {
      setGlobalError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-4 sm:px-6 sm:py-12">
      <NeuralBackground avoidRef={contentRef} />
      <div ref={contentRef} className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-200 bg-white px-4 py-5 shadow-xl sm:px-8 sm:py-10">
        {/* Header */}
        <div className="mb-4 text-center sm:mb-6">
          <div className="mb-3 flex flex-col items-center gap-1.5 sm:mb-5 sm:gap-2">
            <Image src={icon} alt="IPN" height={40} width={40} className="h-9 w-auto sm:h-10" />
            <p className="text-xs font-semibold text-ipn sm:text-sm">Intercollegiate Psychedelics Network</p>
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 sm:text-2xl">Create your account</h1>
        </div>

        {/* Progress */}
        <div className="mb-4 grid grid-cols-4 gap-2 sm:mb-8">
          {STEPS.map((label, i) => {
            const n = i + 1
            const done = n < step
            const active = n === step
            return (
              <div key={label} className="flex min-w-0 flex-col items-center gap-1">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${
                    done
                      ? "bg-ipn text-white"
                      : active
                      ? "bg-ipn text-white"
                      : "bg-zinc-200 text-zinc-500"
                  }`}
                >
                  {done ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd" />
                    </svg>
                  ) : n}
                </div>
                <span className={`hidden max-w-full truncate text-[10px] min-[380px]:text-xs sm:block ${active ? "text-ipn font-medium" : "text-zinc-400"}`}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>

        {step === 1 && <StepAccount data={data} update={update} errors={errors} />}
        {step === 2 && (
          <StepLocation
            data={data}
            update={update}
            errors={errors}
            onVerifiedLocation={handleVerifiedLocation}
            onLocationStatus={() => {}}
          />
        )}
        {step === 3 && (
          <StepBackground data={data} update={update} updateBarriers={updateBarriers} errors={errors} />
        )}
        {step === 4 && <StepAbout data={data} update={update} errors={errors} />}

        {globalError && (
          <p className="mt-4 text-sm text-red-600">{globalError}</p>
        )}

        {/* Navigation */}
        <div className="sticky bottom-0 -mx-4 mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:mt-6 sm:px-8 sm:py-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={back}
              className="min-h-11 rounded-lg px-3 text-sm font-medium text-zinc-500 hover:text-zinc-800"
            >
              Back
            </button>
          ) : (
            <span />
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={next}
              className="min-h-11 rounded-lg bg-ipn px-5 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="min-h-11 rounded-lg bg-ipn px-5 py-2 text-sm font-medium text-white transition hover:bg-ipn-dark disabled:opacity-50"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          )}
        </div>

        <p className="mt-3 border-t border-zinc-100 pt-3 text-center text-sm text-zinc-500 sm:mt-6 sm:pt-6">
          Already have an account?{" "}
          <Link
            href={redirectTo ? `/login?next=${encodeURIComponent(redirectTo)}` : "/login"}
            className="inline-flex min-h-11 items-center font-medium text-ipn hover:underline sm:min-h-0"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageContent />
    </Suspense>
  )
}
