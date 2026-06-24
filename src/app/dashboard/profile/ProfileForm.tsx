"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Cropper from "react-easy-crop"
import type { Area } from "react-easy-crop"
import { createClient } from "@/lib/supabase/client"
import { updateProfile } from "@/lib/auth/actions"
import { completeOnboardingStep } from "@/lib/onboarding/actions"
import { isProfileOnboardingComplete } from "@/lib/onboarding/progress"
import { setCurrentUserMailchimpSubscription } from "@/lib/mailchimp/actions"
import type { MailchimpStatus } from "@/lib/mailchimp/status"
import CityVerificationField from "@/components/location/CityVerificationField"
import type { VerifiedLocation } from "@/components/location/CityVerificationField"
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

// ── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  first_name: string | null
  last_name: string | null
  country: string | null
  state: string | null
  city: string | null
  city_lat: number | null
  city_lng: number | null
  persona: string | null
  affiliation: string | null
  school: string | null
  field: string | null
  psychedelic_field_status: string | null
  role_and_goals: string | null
  bio: string | null
  interest_tags: string[] | null
  linkedin_url: string | null
  is_discoverable: boolean | null
  share_location: boolean | null
  avatar_url: string | null
}

type Contact = {
  whatsapp_url: string | null
}

type FormState = {
  first_name: string
  last_name: string
  country: string
  state: string
  city: string
  city_lat: number | null
  city_lng: number | null
  persona: string
  affiliation: string
  school: string
  field: string
  psychedelic_field_status: string
  role_and_goals: string
  bio: string
  interest_tags: string[]
  linkedin_url: string
  whatsapp_country_code: string
  whatsapp_country_iso: string
  whatsapp_number: string
  is_discoverable: boolean
  share_location: boolean
  avatar_url: string | null
}

const WHATSAPP_COUNTRIES: { name: string; iso: string; dial: string }[] = [
  { name: "Afghanistan", iso: "AF", dial: "93" },
  { name: "Albania", iso: "AL", dial: "355" },
  { name: "Algeria", iso: "DZ", dial: "213" },
  { name: "Andorra", iso: "AD", dial: "376" },
  { name: "Angola", iso: "AO", dial: "244" },
  { name: "Argentina", iso: "AR", dial: "54" },
  { name: "Armenia", iso: "AM", dial: "374" },
  { name: "Australia", iso: "AU", dial: "61" },
  { name: "Austria", iso: "AT", dial: "43" },
  { name: "Azerbaijan", iso: "AZ", dial: "994" },
  { name: "Bahamas", iso: "BS", dial: "1" },
  { name: "Bahrain", iso: "BH", dial: "973" },
  { name: "Bangladesh", iso: "BD", dial: "880" },
  { name: "Barbados", iso: "BB", dial: "1" },
  { name: "Belarus", iso: "BY", dial: "375" },
  { name: "Belgium", iso: "BE", dial: "32" },
  { name: "Belize", iso: "BZ", dial: "501" },
  { name: "Benin", iso: "BJ", dial: "229" },
  { name: "Bolivia", iso: "BO", dial: "591" },
  { name: "Bosnia and Herzegovina", iso: "BA", dial: "387" },
  { name: "Botswana", iso: "BW", dial: "267" },
  { name: "Brazil", iso: "BR", dial: "55" },
  { name: "Bulgaria", iso: "BG", dial: "359" },
  { name: "Burkina Faso", iso: "BF", dial: "226" },
  { name: "Burundi", iso: "BI", dial: "257" },
  { name: "Cambodia", iso: "KH", dial: "855" },
  { name: "Cameroon", iso: "CM", dial: "237" },
  { name: "Canada", iso: "CA", dial: "1" },
  { name: "Cape Verde", iso: "CV", dial: "238" },
  { name: "Central African Republic", iso: "CF", dial: "236" },
  { name: "Chad", iso: "TD", dial: "235" },
  { name: "Chile", iso: "CL", dial: "56" },
  { name: "China", iso: "CN", dial: "86" },
  { name: "Colombia", iso: "CO", dial: "57" },
  { name: "Congo (DRC)", iso: "CD", dial: "243" },
  { name: "Congo (Republic)", iso: "CG", dial: "242" },
  { name: "Costa Rica", iso: "CR", dial: "506" },
  { name: "Côte d'Ivoire", iso: "CI", dial: "225" },
  { name: "Croatia", iso: "HR", dial: "385" },
  { name: "Cuba", iso: "CU", dial: "53" },
  { name: "Cyprus", iso: "CY", dial: "357" },
  { name: "Czech Republic", iso: "CZ", dial: "420" },
  { name: "Denmark", iso: "DK", dial: "45" },
  { name: "Dominican Republic", iso: "DO", dial: "1" },
  { name: "Ecuador", iso: "EC", dial: "593" },
  { name: "Egypt", iso: "EG", dial: "20" },
  { name: "El Salvador", iso: "SV", dial: "503" },
  { name: "Estonia", iso: "EE", dial: "372" },
  { name: "Ethiopia", iso: "ET", dial: "251" },
  { name: "Fiji", iso: "FJ", dial: "679" },
  { name: "Finland", iso: "FI", dial: "358" },
  { name: "France", iso: "FR", dial: "33" },
  { name: "Gabon", iso: "GA", dial: "241" },
  { name: "Gambia", iso: "GM", dial: "220" },
  { name: "Georgia", iso: "GE", dial: "995" },
  { name: "Germany", iso: "DE", dial: "49" },
  { name: "Ghana", iso: "GH", dial: "233" },
  { name: "Greece", iso: "GR", dial: "30" },
  { name: "Guatemala", iso: "GT", dial: "502" },
  { name: "Guinea", iso: "GN", dial: "224" },
  { name: "Guinea-Bissau", iso: "GW", dial: "245" },
  { name: "Guyana", iso: "GY", dial: "592" },
  { name: "Haiti", iso: "HT", dial: "509" },
  { name: "Honduras", iso: "HN", dial: "504" },
  { name: "Hong Kong", iso: "HK", dial: "852" },
  { name: "Hungary", iso: "HU", dial: "36" },
  { name: "Iceland", iso: "IS", dial: "354" },
  { name: "India", iso: "IN", dial: "91" },
  { name: "Indonesia", iso: "ID", dial: "62" },
  { name: "Iran", iso: "IR", dial: "98" },
  { name: "Iraq", iso: "IQ", dial: "964" },
  { name: "Ireland", iso: "IE", dial: "353" },
  { name: "Israel", iso: "IL", dial: "972" },
  { name: "Italy", iso: "IT", dial: "39" },
  { name: "Jamaica", iso: "JM", dial: "1" },
  { name: "Japan", iso: "JP", dial: "81" },
  { name: "Jordan", iso: "JO", dial: "962" },
  { name: "Kazakhstan", iso: "KZ", dial: "7" },
  { name: "Kenya", iso: "KE", dial: "254" },
  { name: "Kosovo", iso: "XK", dial: "383" },
  { name: "Kuwait", iso: "KW", dial: "965" },
  { name: "Kyrgyzstan", iso: "KG", dial: "996" },
  { name: "Laos", iso: "LA", dial: "856" },
  { name: "Latvia", iso: "LV", dial: "371" },
  { name: "Lebanon", iso: "LB", dial: "961" },
  { name: "Libya", iso: "LY", dial: "218" },
  { name: "Lithuania", iso: "LT", dial: "370" },
  { name: "Luxembourg", iso: "LU", dial: "352" },
  { name: "Macau", iso: "MO", dial: "853" },
  { name: "Madagascar", iso: "MG", dial: "261" },
  { name: "Malawi", iso: "MW", dial: "265" },
  { name: "Malaysia", iso: "MY", dial: "60" },
  { name: "Maldives", iso: "MV", dial: "960" },
  { name: "Mali", iso: "ML", dial: "223" },
  { name: "Malta", iso: "MT", dial: "356" },
  { name: "Mauritania", iso: "MR", dial: "222" },
  { name: "Mauritius", iso: "MU", dial: "230" },
  { name: "Mexico", iso: "MX", dial: "52" },
  { name: "Moldova", iso: "MD", dial: "373" },
  { name: "Mongolia", iso: "MN", dial: "976" },
  { name: "Montenegro", iso: "ME", dial: "382" },
  { name: "Morocco", iso: "MA", dial: "212" },
  { name: "Mozambique", iso: "MZ", dial: "258" },
  { name: "Myanmar", iso: "MM", dial: "95" },
  { name: "Namibia", iso: "NA", dial: "264" },
  { name: "Nepal", iso: "NP", dial: "977" },
  { name: "Netherlands", iso: "NL", dial: "31" },
  { name: "New Zealand", iso: "NZ", dial: "64" },
  { name: "Nicaragua", iso: "NI", dial: "505" },
  { name: "Niger", iso: "NE", dial: "227" },
  { name: "Nigeria", iso: "NG", dial: "234" },
  { name: "North Macedonia", iso: "MK", dial: "389" },
  { name: "Norway", iso: "NO", dial: "47" },
  { name: "Oman", iso: "OM", dial: "968" },
  { name: "Pakistan", iso: "PK", dial: "92" },
  { name: "Palestine", iso: "PS", dial: "970" },
  { name: "Panama", iso: "PA", dial: "507" },
  { name: "Papua New Guinea", iso: "PG", dial: "675" },
  { name: "Paraguay", iso: "PY", dial: "595" },
  { name: "Peru", iso: "PE", dial: "51" },
  { name: "Philippines", iso: "PH", dial: "63" },
  { name: "Poland", iso: "PL", dial: "48" },
  { name: "Portugal", iso: "PT", dial: "351" },
  { name: "Qatar", iso: "QA", dial: "974" },
  { name: "Romania", iso: "RO", dial: "40" },
  { name: "Russia", iso: "RU", dial: "7" },
  { name: "Rwanda", iso: "RW", dial: "250" },
  { name: "Saudi Arabia", iso: "SA", dial: "966" },
  { name: "Senegal", iso: "SN", dial: "221" },
  { name: "Serbia", iso: "RS", dial: "381" },
  { name: "Sierra Leone", iso: "SL", dial: "232" },
  { name: "Singapore", iso: "SG", dial: "65" },
  { name: "Slovakia", iso: "SK", dial: "421" },
  { name: "Slovenia", iso: "SI", dial: "386" },
  { name: "Somalia", iso: "SO", dial: "252" },
  { name: "South Africa", iso: "ZA", dial: "27" },
  { name: "South Korea", iso: "KR", dial: "82" },
  { name: "South Sudan", iso: "SS", dial: "211" },
  { name: "Spain", iso: "ES", dial: "34" },
  { name: "Sri Lanka", iso: "LK", dial: "94" },
  { name: "Sudan", iso: "SD", dial: "249" },
  { name: "Suriname", iso: "SR", dial: "597" },
  { name: "Sweden", iso: "SE", dial: "46" },
  { name: "Switzerland", iso: "CH", dial: "41" },
  { name: "Syria", iso: "SY", dial: "963" },
  { name: "Taiwan", iso: "TW", dial: "886" },
  { name: "Tajikistan", iso: "TJ", dial: "992" },
  { name: "Tanzania", iso: "TZ", dial: "255" },
  { name: "Thailand", iso: "TH", dial: "66" },
  { name: "Togo", iso: "TG", dial: "228" },
  { name: "Trinidad and Tobago", iso: "TT", dial: "1" },
  { name: "Tunisia", iso: "TN", dial: "216" },
  { name: "Turkey", iso: "TR", dial: "90" },
  { name: "Turkmenistan", iso: "TM", dial: "993" },
  { name: "Uganda", iso: "UG", dial: "256" },
  { name: "Ukraine", iso: "UA", dial: "380" },
  { name: "United Arab Emirates", iso: "AE", dial: "971" },
  { name: "United Kingdom", iso: "GB", dial: "44" },
  { name: "United States", iso: "US", dial: "1" },
  { name: "Uruguay", iso: "UY", dial: "598" },
  { name: "Uzbekistan", iso: "UZ", dial: "998" },
  { name: "Venezuela", iso: "VE", dial: "58" },
  { name: "Vietnam", iso: "VN", dial: "84" },
  { name: "Yemen", iso: "YE", dial: "967" },
  { name: "Zambia", iso: "ZM", dial: "260" },
  { name: "Zimbabwe", iso: "ZW", dial: "263" },
]

const COUNTRY_DIAL_CODES: Record<string, string> = Object.fromEntries(
  WHATSAPP_COUNTRIES.map((c) => [c.name, c.dial]),
)

function flagEmoji(iso: string) {
  return [...iso.toUpperCase()].map((c) => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join("")
}

// Expected subscriber-number digit counts by ISO2 code (after stripping trunk prefix 0).
// Ranges are used for countries where mobile vs. landline differ significantly.
const COUNTRY_PHONE_LENGTHS: Record<string, { min: number; max: number }> = {
  // NANP (+1) — always 10 digits
  US: { min: 10, max: 10 }, CA: { min: 10, max: 10 }, JM: { min: 10, max: 10 },
  DO: { min: 10, max: 10 }, TT: { min: 10, max: 10 }, BS: { min: 10, max: 10 },
  BB: { min: 10, max: 10 },
  // Europe
  GB: { min: 10, max: 10 }, IE: { min: 9, max: 9 }, FR: { min: 9, max: 9 },
  DE: { min: 5, max: 12 }, ES: { min: 9, max: 9 }, PT: { min: 9, max: 9 },
  IT: { min: 6, max: 11 }, NL: { min: 9, max: 9 }, BE: { min: 8, max: 9 },
  CH: { min: 9, max: 9 }, AT: { min: 7, max: 13 }, PL: { min: 9, max: 9 },
  SE: { min: 7, max: 9 }, NO: { min: 8, max: 8 }, DK: { min: 8, max: 8 },
  FI: { min: 7, max: 10 }, CZ: { min: 9, max: 9 }, SK: { min: 9, max: 9 },
  HU: { min: 8, max: 9 }, RO: { min: 9, max: 9 }, BG: { min: 9, max: 9 },
  HR: { min: 8, max: 9 }, RS: { min: 8, max: 9 }, BA: { min: 8, max: 8 },
  ME: { min: 8, max: 8 }, MK: { min: 8, max: 8 }, SI: { min: 8, max: 8 },
  EE: { min: 7, max: 8 }, LV: { min: 8, max: 8 }, LT: { min: 8, max: 8 },
  LU: { min: 8, max: 9 }, MT: { min: 8, max: 8 }, CY: { min: 8, max: 8 },
  IS: { min: 7, max: 7 }, AD: { min: 6, max: 6 }, GR: { min: 10, max: 10 },
  AL: { min: 8, max: 9 }, XK: { min: 8, max: 8 },
  // Former Soviet / Caucasus / Central Asia
  RU: { min: 10, max: 10 }, UA: { min: 9, max: 9 }, BY: { min: 9, max: 9 },
  MD: { min: 8, max: 8 }, GE: { min: 9, max: 9 }, AM: { min: 8, max: 8 },
  AZ: { min: 9, max: 9 }, KZ: { min: 10, max: 10 }, KG: { min: 9, max: 9 },
  TJ: { min: 9, max: 9 }, TM: { min: 8, max: 8 }, UZ: { min: 9, max: 9 },
  // Middle East
  TR: { min: 10, max: 10 }, IL: { min: 9, max: 9 }, SA: { min: 9, max: 9 },
  AE: { min: 9, max: 9 }, JO: { min: 9, max: 9 }, IQ: { min: 10, max: 10 },
  IR: { min: 10, max: 10 }, KW: { min: 8, max: 8 }, BH: { min: 8, max: 8 },
  OM: { min: 8, max: 8 }, QA: { min: 8, max: 8 }, LB: { min: 7, max: 8 },
  PS: { min: 9, max: 9 }, YE: { min: 9, max: 9 }, SY: { min: 9, max: 9 },
  // South Asia
  IN: { min: 10, max: 10 }, PK: { min: 10, max: 10 }, BD: { min: 10, max: 10 },
  LK: { min: 9, max: 9 }, NP: { min: 10, max: 10 }, MV: { min: 7, max: 7 },
  // East / Southeast Asia
  CN: { min: 11, max: 11 }, JP: { min: 10, max: 11 }, KR: { min: 10, max: 11 },
  HK: { min: 8, max: 8 }, MO: { min: 8, max: 8 }, TW: { min: 9, max: 10 },
  SG: { min: 8, max: 8 }, MY: { min: 7, max: 11 }, ID: { min: 8, max: 11 },
  PH: { min: 10, max: 10 }, VN: { min: 9, max: 10 }, TH: { min: 9, max: 9 },
  KH: { min: 8, max: 9 }, MM: { min: 7, max: 10 }, LA: { min: 8, max: 9 },
  MN: { min: 8, max: 8 },
  // Oceania
  AU: { min: 9, max: 9 }, NZ: { min: 8, max: 9 }, PG: { min: 8, max: 8 },
  FJ: { min: 7, max: 7 },
  // Africa
  ZA: { min: 9, max: 9 }, NG: { min: 10, max: 10 }, KE: { min: 9, max: 9 },
  GH: { min: 9, max: 9 }, EG: { min: 10, max: 10 }, MA: { min: 9, max: 9 },
  TN: { min: 8, max: 8 }, DZ: { min: 9, max: 9 }, LY: { min: 9, max: 9 },
  ET: { min: 9, max: 9 }, TZ: { min: 9, max: 9 }, UG: { min: 9, max: 9 },
  RW: { min: 9, max: 9 }, ZM: { min: 9, max: 9 }, ZW: { min: 9, max: 9 },
  MZ: { min: 9, max: 9 }, SD: { min: 9, max: 9 }, SS: { min: 9, max: 9 },
  CM: { min: 9, max: 9 }, SN: { min: 9, max: 9 }, CI: { min: 10, max: 10 },
  GN: { min: 9, max: 9 }, ML: { min: 8, max: 8 }, BF: { min: 8, max: 8 },
  NE: { min: 8, max: 8 }, TG: { min: 8, max: 8 }, BJ: { min: 8, max: 8 },
  MW: { min: 9, max: 9 }, AO: { min: 9, max: 9 }, CD: { min: 9, max: 9 },
  CG: { min: 9, max: 9 }, CF: { min: 8, max: 8 }, NA: { min: 9, max: 9 },
  BW: { min: 8, max: 8 }, MG: { min: 9, max: 9 }, MU: { min: 8, max: 8 },
  SO: { min: 8, max: 9 }, SL: { min: 8, max: 8 }, GM: { min: 7, max: 7 },
  GA: { min: 8, max: 8 }, GW: { min: 7, max: 9 }, BI: { min: 8, max: 8 },
  // Americas
  BR: { min: 10, max: 11 }, MX: { min: 10, max: 10 }, AR: { min: 10, max: 10 },
  CO: { min: 10, max: 10 }, VE: { min: 10, max: 11 }, PE: { min: 9, max: 9 },
  CL: { min: 9, max: 9 }, EC: { min: 9, max: 9 }, BO: { min: 8, max: 8 },
  PY: { min: 9, max: 9 }, UY: { min: 9, max: 9 }, CR: { min: 8, max: 8 },
  GT: { min: 8, max: 8 }, HN: { min: 8, max: 8 }, SV: { min: 8, max: 8 },
  NI: { min: 8, max: 8 }, PA: { min: 7, max: 8 }, CU: { min: 8, max: 8 },
  HT: { min: 8, max: 8 }, SR: { min: 7, max: 7 }, GY: { min: 7, max: 7 },
  BZ: { min: 7, max: 7 },
}

function validateWhatsappNumber(iso: string, rawNumber: string): string | null {
  if (!rawNumber.trim()) return null
  const digits = rawNumber.replace(/\D/g, "")
  if (!digits) return null
  const subscriber = digits.startsWith("0") ? digits.slice(1) : digits
  if (!subscriber) return null
  const lengths = COUNTRY_PHONE_LENGTHS[iso]
  if (!lengths) {
    if (subscriber.length < 5 || subscriber.length > 13) return "Number length looks off"
    return null
  }
  if (subscriber.length < lengths.min) {
    const expected = lengths.min === lengths.max ? `${lengths.min}` : `${lengths.min}–${lengths.max}`
    return `Too short — expected ${expected} digits`
  }
  if (subscriber.length > lengths.max) {
    const expected = lengths.min === lengths.max ? `${lengths.max}` : `${lengths.min}–${lengths.max}`
    return `Too long — expected ${expected} digits`
  }
  return null
}

function parseWhatsappUrl(
  url: string | null,
  country: string | null,
): { countryCode: string; number: string } {
  const dialCode = country ? (COUNTRY_DIAL_CODES[country] ?? "") : ""

  if (!url) {
    return { countryCode: dialCode ? `+${dialCode}` : "", number: "" }
  }

  const match = url.match(/wa\.me\/(\d+)/)
  if (!match) return { countryCode: dialCode ? `+${dialCode}` : "", number: "" }

  const allDigits = match[1]
  if (dialCode && allDigits.startsWith(dialCode)) {
    return { countryCode: `+${dialCode}`, number: allDigits.slice(dialCode.length) }
  }
  return { countryCode: "", number: allDigits }
}

function buildWhatsappUrl(code: string, number: string): string | null {
  const digits = number.replace(/\D/g, "")
  // Strip trunk prefix (leading 0) — E.164 format never includes it
  const subscriber = digits.startsWith("0") ? digits.slice(1) : digits
  if (!subscriber) return null
  const codeDigits = code.replace(/\D/g, "")
  return `https://wa.me/${codeDigits}${subscriber}`
}

function toFormState(profile: Profile | null, contact: Contact | null): FormState {
  const { countryCode, number } = parseWhatsappUrl(
    contact?.whatsapp_url ?? null,
    profile?.country ?? null,
  )
  const byName = WHATSAPP_COUNTRIES.find((c) => c.name === profile?.country)
  const byDial = WHATSAPP_COUNTRIES.find((c) => countryCode && `+${c.dial}` === countryCode)
  const countryIso = byName?.iso ?? byDial?.iso ?? ""
  return {
    first_name: profile?.first_name ?? "",
    last_name: profile?.last_name ?? "",
    country: profile?.country ?? "",
    state: profile?.state ?? "",
    city: profile?.city ?? "",
    city_lat: profile?.city_lat ?? null,
    city_lng: profile?.city_lng ?? null,
    persona: profile?.persona ?? "",
    affiliation: profile?.affiliation ?? "",
    school: profile?.school ?? "",
    field: profile?.field ?? "",
    psychedelic_field_status: profile?.psychedelic_field_status ?? "",
    role_and_goals: profile?.role_and_goals ?? "",
    bio: profile?.bio ?? "",
    interest_tags: profile?.interest_tags ?? [],
    linkedin_url: profile?.linkedin_url ?? "",
    whatsapp_country_code: countryCode,
    whatsapp_country_iso: countryIso,
    whatsapp_number: number,
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

function CountryDialCodeCombobox({
  dialCode,
  countryIso,
  onChange,
}: {
  dialCode: string
  countryIso: string
  onChange: (dialCode: string, iso: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = countryIso
    ? WHATSAPP_COUNTRIES.find((c) => c.iso === countryIso)
    : WHATSAPP_COUNTRIES.find((c) => `+${c.dial}` === dialCode)

  const filtered = query.trim()
    ? WHATSAPP_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.dial.includes(query.replace("+", "")),
      )
    : WHATSAPP_COUNTRIES

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setQuery("") }
    }
    document.addEventListener("mousedown", onOutside)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onOutside)
      document.removeEventListener("keydown", onEsc)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className="flex h-[38px] items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition hover:border-zinc-400 focus:border-ipn focus:ring-2 focus:ring-ipn/20"
      >
        {selected ? (
          <>
            <span className="text-base leading-none">{flagEmoji(selected.iso)}</span>
            <span className="text-zinc-600">+{selected.dial}</span>
          </>
        ) : (
          <span className="text-zinc-400">Country…</span>
        )}
        <svg className="ml-0.5 h-3.5 w-3.5 flex-shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
          <div className="border-b border-zinc-100 p-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code…"
              className="w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm outline-none placeholder:text-zinc-400 focus:border-ipn focus:ring-1 focus:ring-ipn/20"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length > 0 ? (
              filtered.map((c) => (
                <li key={`${c.iso}-${c.dial}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      onChange(`+${c.dial}`, c.iso)
                      setOpen(false)
                      setQuery("")
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-zinc-50 ${
                      selected?.iso === c.iso ? "bg-ipn/5 text-ipn" : "text-zinc-800"
                    }`}
                  >
                    <span className="w-6 text-base leading-none">{flagEmoji(c.iso)}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-xs text-zinc-400">+{c.dial}</span>
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-zinc-400">No results</li>
            )}
          </ul>
        </div>
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
  contact,
  userId,
  userEmail,
  mailchimpStatus,
}: {
  profile: Profile | null
  contact: Contact | null
  userId: string
  userEmail: string
  mailchimpStatus: MailchimpStatus
}) {
  const router = useRouter()
  const [data, setData] = useState<FormState>(() => toFormState(profile, contact))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isDirty) return

    function warn(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", warn)

    // Intercept SPA navigation in the capture phase, before Next.js Link handlers fire.
    // pushState overrides don't work because App Router renders the new page before
    // calling pushState, so blocking pushState only breaks the URL, not the navigation.
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a[href]")
      if (!anchor) return
      const href = (anchor as HTMLAnchorElement).getAttribute("href")
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return
      try {
        const url = new URL(href, window.location.origin)
        if (url.origin !== window.location.origin) return
        if (url.pathname === window.location.pathname) return
      } catch {
        // relative URL — treat as internal
      }
      e.preventDefault()
      e.stopImmediatePropagation()
      if (window.confirm("You have unsaved changes. Leave this page?")) {
        router.push(href)
      }
    }
    document.addEventListener("click", handleClick, true)

    return () => {
      window.removeEventListener("beforeunload", warn)
      document.removeEventListener("click", handleClick, true)
    }
  }, [isDirty, router])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
    setIsDirty(true)
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
    setSaved(false)
    setIsDirty(true)
    setError(null)
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
      if (isProfileOnboardingComplete({
        avatar_url: publicUrl,
        bio: data.bio,
        interest_tags: data.interest_tags,
      })) {
        await completeOnboardingStep("profile")
      }
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
      city_lat: data.city_lat,
      city_lng: data.city_lng,
      persona: data.persona,
      affiliation: data.affiliation || null,
      school: data.school || null,
      field: data.field,
      psychedelic_field_status: data.psychedelic_field_status,
      role_and_goals: data.role_and_goals,
      bio: data.bio || null,
      interest_tags: data.interest_tags.length > 0 ? data.interest_tags : null,
      linkedin_url: data.linkedin_url || null,
      whatsapp_url: buildWhatsappUrl(data.whatsapp_country_code, data.whatsapp_number),
      is_discoverable: data.is_discoverable,
      share_location: data.share_location,
      avatar_url: data.avatar_url,
    })

    setSaving(false)
    if (result?.error) {
      setError(result.error)
    } else {
      setSaved(true)
      setIsDirty(false)
      topRef.current?.scrollIntoView({ behavior: "smooth" })
    }
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

  return (
    <div ref={topRef} className="flex flex-col gap-10">

      {saved && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <svg className="h-4 w-4 flex-shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          Profile saved successfully.
        </div>
      )}

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
        <p className="-mt-2 mb-4 text-xs text-zinc-400">
          Email and WhatsApp are only shown after you accept a connection.
        </p>

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
            <Label htmlFor="whatsapp_number">WhatsApp</Label>
            <div className="flex gap-2">
              <CountryDialCodeCombobox
                dialCode={data.whatsapp_country_code}
                countryIso={data.whatsapp_country_iso}
                onChange={(code, iso) => {
                  setData((prev) => ({ ...prev, whatsapp_country_code: code, whatsapp_country_iso: iso }))
                  setSaved(false)
                  setIsDirty(true)
                }}
              />
              <input
                id="whatsapp_number"
                name="whatsapp_number"
                type="tel"
                value={data.whatsapp_number}
                onChange={(e) => update("whatsapp_number", e.target.value)}
                placeholder="555 123 4567"
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
              />
            </div>
            {(() => {
              const err = validateWhatsappNumber(data.whatsapp_country_iso, data.whatsapp_number)
              const hasDigits = data.whatsapp_number.replace(/\D/g, "").length > 0
              if (!hasDigits) return null
              if (err) return <p className="text-xs text-red-600">{err}</p>
              return <p className="text-xs text-emerald-600">Looks good</p>
            })()}
            <p className="text-xs text-zinc-400">
              Shown only to accepted connections, alongside your email.
            </p>
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

      {/* ── Location ── */}
      <section>
        <SectionHeading>Location</SectionHeading>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="country">Country</Label>
            <Select id="country" name="country" value={data.country}
              onChange={(v) => {
                update("country", v)
                update("state", "")
                update("school", "")
                update("city_lat", null)
                update("city_lng", null)
              }}
              options={COUNTRIES} placeholder="Select a country" />
          </div>

          {showStateDropdown && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="state">
                {data.country === "Canada" ? "Province / Territory" : "State / Territory"}
              </Label>
              <Select id="state" name="state" value={data.state}
                onChange={(v) => {
                  update("state", v)
                  update("city_lat", null)
                  update("city_lng", null)
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
              inputClassName="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none focus:border-ipn focus:ring-2 focus:ring-ipn/20"
              onCityChange={(value) => update("city", value)}
              onVerifiedLocationChange={handleVerifiedLocation}
              onStatusChange={() => {}}
            />
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
              <p className="text-zinc-400">Email and WhatsApp (if added)</p>
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
