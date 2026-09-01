import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { BrandLockup } from "@/components/onboarding/BrandLockup"
import { OnboardingProgress } from "@/components/onboarding/OnboardingProgress"
import { WhatsAppLanding } from "@/components/onboarding/WhatsAppLanding"
import { createClient } from "@/lib/supabase/server"
import styles from "@/components/onboarding/onboarding.module.css"

export const metadata: Metadata = {
  title: "Connect on WhatsApp | IPN Member Portal",
  description: "Choose the IPN WhatsApp conversations that fit you.",
}

export default async function WhatsAppPage({
  searchParams,
}: {
  searchParams: Promise<{ motion?: string | string[] }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const motion = (await searchParams).motion
  const editorialMotion = motion === "editorial"

  return (
    <main className={`${styles.onboardingShell} ${styles.whatsappShell} ${editorialMotion ? styles.motionEditorial : ""}`}>
      <div className={styles.whatsappFrame}>
        <header className={styles.whatsappHeader}>
          <BrandLockup />
          <OnboardingProgress current="whatsapp" editorialMotion={editorialMotion} />
        </header>
        <WhatsAppLanding />
      </div>
    </main>
  )
}
