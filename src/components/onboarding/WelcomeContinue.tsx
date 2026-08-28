"use client"

import Link from "next/link"
import { saveOnboardingFlowProgress } from "@/lib/onboarding/actions"
import styles from "./onboarding.module.css"

export function WelcomeContinue({ editorialMotion = false }: { editorialMotion?: boolean }) {
  const destination = editorialMotion
    ? "/onboarding/whatsapp?motion=editorial"
    : "/onboarding/whatsapp"

  function saveWelcomeProgress() {
    void saveOnboardingFlowProgress({
      flow: "welcome",
      currentStep: "complete",
      complete: true,
    })
  }

  return <div className={styles.continueAction}>
    <Link href={destination} className={styles.continueButton} onClick={saveWelcomeProgress}>
      Continue <span aria-hidden="true">→</span>
    </Link>
  </div>
}
