import Link from "next/link"
import styles from "./onboarding.module.css"

type OnboardingStep = "welcome" | "whatsapp"

export function OnboardingProgress({
  current,
  editorialMotion,
}: {
  current: OnboardingStep
  editorialMotion: boolean
}) {
  const welcome = (
    <>
      <span aria-hidden="true">1</span>
      Welcome
    </>
  )

  return (
    <nav className={styles.journeyProgress} aria-label="Onboarding progress">
      <ol>
        <li aria-current={current === "welcome" ? "step" : undefined} className={current === "welcome" ? styles.journeyCurrent : undefined}>
          {current === "whatsapp" ? (
            <Link href={editorialMotion ? "/onboarding/welcome?motion=editorial" : "/onboarding/welcome"}>
              {welcome}
            </Link>
          ) : welcome}
        </li>
        <li aria-current={current === "whatsapp" ? "step" : undefined} className={current === "whatsapp" ? styles.journeyCurrent : undefined}>
          <span aria-hidden="true">2</span>
          WhatsApp
        </li>
        <li>
          <span aria-hidden="true">3</span>
          Member portal
        </li>
      </ol>
    </nav>
  )
}
