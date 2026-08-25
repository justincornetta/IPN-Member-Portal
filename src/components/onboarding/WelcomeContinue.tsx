"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { saveOnboardingFlowProgress } from "@/lib/onboarding/actions"
import styles from "./onboarding.module.css"

export function WelcomeContinue() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function continueOnboarding() {
    if (pending) return
    setPending(true)
    setError(null)
    const result = await saveOnboardingFlowProgress({
      flow: "welcome",
      currentStep: "complete",
      complete: true,
    })
    if (result.error) {
      setPending(false)
      setError("Your welcome progress could not be saved. Try again.")
      return
    }
    router.push("/dashboard/whatsapp")
  }

  return <div>
    <button type="button" className={styles.continueButton} disabled={pending} onClick={continueOnboarding}>
      {pending ? "Saving…" : "Continue"} <span aria-hidden="true">→</span>
    </button>
    {error && <p className={styles.errorMessage} role="alert">{error}</p>}
  </div>
}
