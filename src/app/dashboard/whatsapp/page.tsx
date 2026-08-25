import type { Metadata } from "next"
import { WhatsAppLanding } from "@/components/onboarding/WhatsAppLanding"
import styles from "@/components/onboarding/onboarding.module.css"

export const metadata: Metadata = {
  title: "Connect on WhatsApp | IPN Member Portal",
  description: "Choose the IPN WhatsApp conversations that fit you.",
}

export default function DashboardWhatsAppPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className={styles.whatsappFrame}>
        <WhatsAppLanding />
      </div>
    </div>
  )
}
