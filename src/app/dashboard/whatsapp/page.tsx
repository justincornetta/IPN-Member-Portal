import type { Metadata } from "next"
import { WhatsAppLanding } from "@/components/onboarding/WhatsAppLanding"
import styles from "@/components/onboarding/onboarding.module.css"

export const metadata: Metadata = {
  title: "Connect on WhatsApp | IPN Member Portal",
  description: "Choose the IPN WhatsApp conversations that fit you.",
}

export default function DashboardWhatsAppPage() {
  return (
    <main className={`${styles.onboardingShell} ${styles.whatsappShell}`}>
      <div className={styles.whatsappFrame}>
        <WhatsAppLanding />
      </div>
    </main>
  )
}
