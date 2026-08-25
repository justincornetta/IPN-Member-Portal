import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { BrandLockup } from "@/components/onboarding/BrandLockup"
import { PortalFeatureGrid } from "@/components/onboarding/PortalFeatureGrid"
import { WelcomeContinue } from "@/components/onboarding/WelcomeContinue"
import { createClient } from "@/lib/supabase/server"
import styles from "@/components/onboarding/onboarding.module.css"

export const metadata: Metadata = {
  title: "Welcome to IPN | Member Portal",
  description: "Meet the IPN Member Portal and continue to community onboarding.",
}

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: progress } = await supabase
    .from("member_onboarding_progress")
    .select("welcome_completed_at")
    .eq("user_id", user.id)
    .maybeSingle()
  if (progress?.welcome_completed_at) redirect("/dashboard")

  return (
    <main className={styles.onboardingShell}>
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
          <WelcomeContinue />
        </div>
      </section>
    </main>
  )
}
