import type { Metadata } from "next"
import Link from "next/link"
import { BrandLockup } from "@/components/onboarding/BrandLockup"
import { WhatsAppLanding } from "@/components/onboarding/WhatsAppLanding"
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
  const motion = (await searchParams).motion
  const editorialMotion = motion === "editorial"

  return (
    <main className={`${styles.onboardingShell} ${styles.whatsappShell} ${editorialMotion ? styles.motionEditorial : ""}`}>
      <div className={styles.whatsappFrame}>
        <header className={styles.whatsappHeader}>
          <BrandLockup />
          <nav className={styles.journeyProgress} aria-label="Onboarding progress">
            <ol>
              <li>
                <Link href={editorialMotion ? "/onboarding/welcome?motion=editorial" : "/onboarding/welcome"}>
                  <span aria-hidden="true">1</span>
                  Welcome
                </Link>
              </li>
              <li aria-current="step" className={styles.journeyCurrent}>
                <span aria-hidden="true">2</span>
                WhatsApp
              </li>
              <li>
                <span aria-hidden="true">3</span>
                Member portal
              </li>
            </ol>
          </nav>
        </header>
        <WhatsAppLanding />
      </div>
    </main>
  )
}
