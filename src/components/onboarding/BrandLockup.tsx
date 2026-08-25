import Image from "next/image"
import styles from "./onboarding.module.css"

export function BrandLockup() {
  return (
    <div className={styles.brandLockup}>
      <span className={styles.logoHalo}>
        <Image
          src="/onboarding/ipn-logo.png"
          alt=""
          width={64}
          height={64}
          priority
        />
      </span>
      <span className={styles.brandName}>
        Intercollegiate
        <br />
        Psychedelics Network
      </span>
    </div>
  )
}
