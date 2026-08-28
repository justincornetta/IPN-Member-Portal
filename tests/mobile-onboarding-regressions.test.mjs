import assert from "node:assert/strict"
import test from "node:test"
import { readFile } from "node:fs/promises"

const root = new URL("../", import.meta.url)

async function source(path) {
  return readFile(new URL(path, root), "utf8")
}

test("registration step changes reset scroll and focus an announced step heading", async () => {
  const register = await source("src/app/register/page.tsx")

  assert.match(register, /contentRef\.current\?\.scrollIntoView\(\{[\s\S]*?block: "start"/)
  assert.match(register, /prefers-reduced-motion: reduce/)
  assert.match(register, /stepHeadingRef\.current\?\.focus\(\{ preventScroll: true \}\)/)
  assert.match(register, /Step \{step\} of \{STEPS\.length\}: \{STEPS\[step - 1\]\}/)
})

test("registration school guidance uses readable spacing and secondary contrast", async () => {
  const register = await source("src/app/register/page.tsx")

  assert.match(register, /mt-1\.5 text-xs leading-5 text-zinc-500[^>]*>Showing schools/)
})

test("mobile profile owns one save action and reserves space for it", async () => {
  const profile = await source("src/app/dashboard/profile/ProfileForm.tsx")

  assert.match(profile, /flex flex-col gap-10 pb-28 sm:pb-0/)
  assert.match(profile, /hidden items-center justify-end gap-3 sm:flex/)
  assert.match(profile, /fixed inset-x-4 z-40[^"]*sm:hidden/)
  assert.doesNotMatch(profile, /fixed inset-x-4 z-40[^"]*sm:static/)
})

test("profile crop dialog keeps visible context, square crop area, and touch-safe controls", async () => {
  const profile = await source("src/app/dashboard/profile/ProfileForm.tsx")

  assert.match(profile, /max-h-\[calc\(100dvh-2rem\)\]/)
  assert.match(profile, /id="crop-dialog-title" className="text-base font-semibold text-white"/)
  assert.match(profile, /relative aspect-square w-full flex-none bg-zinc-950/)
  assert.match(profile, /paddingBottom: "max\(1rem, env\(safe-area-inset-bottom\)\)"/)
  assert.match(profile, /min-h-11 flex-1[^>]*>[\s\S]*?Cancel/)
  assert.match(profile, /min-h-11 flex-1[^>]*>[\s\S]*?Save photo/)
})

test("feedback tour step opens the form below a top-positioned prompt with resilient controls", async () => {
  const [tour, feedback] = await Promise.all([
    source("src/components/product-tour/ProductTourProvider.tsx"),
    source("src/components/FeedbackFooter.tsx"),
  ])

  assert.match(tour, /CustomEvent\("ipn:open-feedback", \{ detail: \{ guided: true \} \}\)/)
  assert.match(tour, /window\.scrollTo\(\{ top: 0, behavior: reduceMotion \? "auto" : "smooth" \}\)/)
  assert.match(tour, /fixed inset-0 z-\[70\]/)
  assert.match(tour, /step\.id === "feedback"/)
  assert.match(tour, /top-\[calc\(1rem\+env\(safe-area-inset-top\)\)\]/)
  assert.ok((tour.match(/min-h-11 min-w-11/g) ?? []).length >= 2)
  assert.match(feedback, /data-tour-guided-feedback=\{guided \? "true" : undefined\}/)
  assert.match(feedback, /max-h-\[calc\(100dvh-18rem\)\]/)
  assert.doesNotMatch(feedback, /hidden md:block/)
  assert.match(feedback, /<FeedbackForm onComplete=\{onClose\} autoFocus=\{!guided\} \/>/)
})

test("mobile welcome blends the map, centers feature groups, and keeps Continue in one viewport", async () => {
  const styles = await source("src/components/onboarding/onboarding.module.css")
  const mobileRules = styles.slice(styles.indexOf("@media (max-width: 760px)"))

  assert.match(mobileRules, /\.welcomeFrame \{[^}]*height: 100svh;[^}]*grid-template-rows: minmax\(0, 44%\) minmax\(0, 56%\);[^}]*overflow-y: hidden;/)
  assert.match(mobileRules, /@media \(max-width: 760px\) and \(max-height: 720px\) \{[\s\S]*?\.welcomeFrame \{[^}]*grid-template-rows: minmax\(0, 49%\) minmax\(0, 51%\);/)
  assert.match(mobileRules, /\.welcomeMap \{[^}]*inset: -4% -16% -8%;[^}]*background-size: cover;/)
  assert.match(mobileRules, /\.featureItem \{[^}]*grid-template-columns: minmax\(0, 1fr\);[^}]*justify-items: center;[^}]*text-align: center;/)
  assert.match(mobileRules, /\.featureCopy \{[^}]*justify-items: center;/)
  assert.match(mobileRules, /@media \(max-width: 760px\) and \(max-height: 720px\) \{[\s\S]*?\.continueButton \{[^}]*min-height: 40px;[^}]*margin-top: 5px;/)
})

test("WhatsApp onboarding uses responsive channel previews and concise join actions", async () => {
  const [landing, channels, styles] = await Promise.all([
    source("src/components/onboarding/WhatsAppLanding.tsx"),
    source("src/components/onboarding/channels.ts"),
    source("src/components/onboarding/onboarding.module.css"),
  ])
  const mobileRules = styles.slice(styles.indexOf("@media (max-width: 760px)"))

  assert.doesNotMatch(landing, /Join channel on this device/)
  assert.doesNotMatch(landing, /Finish joining channels/)
  assert.doesNotMatch(landing, /Continue to your member portal to complete your profile and start exploring/)
  assert.doesNotMatch(landing, /mobileChannelHelp/)
  assert.match(landing, /Meet the community on WhatsApp/)
  assert.equal(landing.match(/"Join channel"/g)?.length, 2)
  assert.match(landing, /className=\{styles\.desktopExperience\}/)
  assert.match(landing, /className=\{styles\.mobileExperience\}/)
  assert.match(landing, /className=\{styles\.desktopChannelSelector\} role="radiogroup"/)
  assert.match(landing, /className=\{styles\.mobileChannelSelector\} role="radiogroup"/)
  assert.match(landing, /<ChannelPreview channel=\{selected\} \/>/)
  assert.match(channels, /promptLabel: "Your first message"/)
  assert.match(channels, /promptLabel: "Join the discussion"/)
  assert.match(channels, /promptLabel: "Plan together"/)
  assert.match(mobileRules, /\.whatsappFrame \{[^}]*height: auto;[^}]*grid-template-rows: auto auto;/)
  assert.match(mobileRules, /\.desktopExperience \{ display: none; \}/)
  assert.match(mobileRules, /\.mobileExperience \{[^}]*display: block;/)
  assert.match(mobileRules, /\.mobilePreviewPanel \.previewHeader \{ display: none; \}/)
  assert.match(mobileRules, /\.mobileChannelSelector \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/)
  assert.match(mobileRules, /\.mobileChannelChoice \{[^}]*min-height: 58px;/)
  assert.match(mobileRules, /\.mobileJoinAction \{[^}]*min-height: 48px;/)
  assert.match(mobileRules, /\.mobilePortalNextStep a \{[^}]*min-height: 46px;/)
  assert.match(styles, /\.desktopExperience \{[\s\S]*?grid-template-columns: minmax\(220px, \.78fr\) minmax\(430px, 1\.72fr\) minmax\(285px, \.92fr\);/)
  assert.match(styles, /\.qrStage \{[^}]*background: linear-gradient\(155deg, #1a1034, #110827\);/)
})
