"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { saveOnboardingFlowProgress } from "@/lib/onboarding/actions"
import styles from "./onboarding.module.css"

export function WelcomeContinue({ editorialMotion = false }: { editorialMotion?: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function continueOnboarding() {
    if (pending) return
    setPending(true)
    try {
      await saveOnboardingFlowProgress({
        flow: "welcome",
        currentStep: "complete",
        complete: true,
      })
    } finally {
      setPending(false)
      router.push(editorialMotion ? "/onboarding/whatsapp?motion=editorial" : "/onboarding/whatsapp")
    }
  }

  return <div>
    <button type="button" className={styles.continueButton} disabled={pending} onClick={continueOnboarding}>
      {pending ? "Saving…" : "Continue"} <span aria-hidden="true">→</span>
    </button>
  </div>
}
