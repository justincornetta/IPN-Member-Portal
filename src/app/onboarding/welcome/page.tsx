import type { Metadata } from "next"
import Link from "next/link"
import { BrandLockup } from "@/components/onboarding/BrandLockup"
import { PortalFeatureGrid } from "@/components/onboarding/PortalFeatureGrid"
import styles from "@/components/onboarding/onboarding.module.css"

export const metadata: Metadata = {
  title: "Welcome to IPN | Member Portal",
  description: "Meet the IPN Member Portal and continue to community onboarding.",
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ motion?: string | string[] }>
}) {
  const motion = (await searchParams).motion
  const editorialMotion = motion === "editorial"

  return (
    <main className={`${styles.onboardingShell} ${editorialMotion ? styles.motionEditorial : ""}`}>
      <section className={styles.welcomeFrame}>
        <div className={styles.welcomeHero}>
          <div className={styles.welcomeMap} aria-hidden="true" />
          <BrandLockup />
          <div className={styles.welcomeCopy}>
            <p className={styles.eyebrow}>Welcome to IPN</p>
            <h1>A global community for what comes next.</h1>
            <p>
              IPN is a global student-led organization empowering, developing,
              and connecting the next generation of students and rising
              professionals in the psychedelic ecosystem.
            </p>
          </div>
        </div>

        <div className={styles.portalPanel}>
          <div className={styles.portalIntro}>
            <p className={styles.stepLabel}>Your IPN Member Portal</p>
            <h2>Your member-exclusive home</h2>
            <p>Find events, useful resources, and the people who make this community move.</p>
          </div>
          <PortalFeatureGrid />
          <Link
            className={styles.continueButton}
            href={editorialMotion ? "/onboarding/whatsapp?motion=editorial" : "/onboarding/whatsapp"}
          >
            Continue <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </main>
  )
}
