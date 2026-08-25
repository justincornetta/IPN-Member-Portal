import type { Metadata } from "next"
import Link from "next/link"
import { BrandLockup } from "@/components/onboarding/BrandLockup"
import { WhatsAppLanding } from "@/components/onboarding/WhatsAppLanding"
import styles from "@/components/onboarding/onboarding.module.css"

export const metadata: Metadata = {
  title: "Connect on WhatsApp | IPN Member Portal",
  description: "Choose the IPN WhatsApp conversations that fit you.",
}

export default function WhatsAppPage() {
  return (
    <main className={`${styles.onboardingShell} ${styles.whatsappShell}`}>
      <div className={styles.whatsappFrame}>
        <header className={styles.whatsappHeader}>
          <BrandLockup />
          <Link href="/onboarding/welcome" className={styles.backLink}>← Back</Link>
        </header>
        <WhatsAppLanding />
      </div>
    </main>
  )
}
