import styles from "./onboarding.module.css"

const features = [
  {
    label: "Join events",
    description: "Browse IPN events and watch past recordings.",
    icon: "calendar",
  },
  {
    label: "Explore conferences",
    description: "View upcoming conferences, see who's attending, RSVP to IPN meetups, and access discounts.",
    icon: "globe",
  },
  {
    label: "Discover & connect",
    description: "Search the member directory to find members in your area and with similar interests.",
    icon: "people",
  },
  {
    label: "Access resources",
    description: "A growing repository of IPN-exclusive discounts and resources.",
    icon: "book",
  },
  {
    label: "Connect on WhatsApp",
    description: "Join the IPN WhatsApp for announcements, discussion, and chatting with other members.",
    icon: "message",
  },
] as const

function FeatureIcon({ name }: { name: (typeof features)[number]["icon"] }) {
  const paths = {
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h2M14 14h2" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
    people: <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.4" /><path d="M3.5 20c.5-4 2.3-6 5.5-6s5 2 5.5 6M14 15c3.6-.7 5.8 1 6.5 4.5" /></>,
    book: <><path d="M4 5.5c3.3-.8 5.9 0 8 2.1v12c-2.1-2.1-4.7-2.9-8-2.1zM20 5.5c-3.3-.8-5.9 0-8 2.1v12c2.1-2.1 4.7-2.9 8-2.1z" /></>,
    message: <><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z" /><path d="M8.5 10.5h7M8.5 14h4" /></>,
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

export function PortalFeatureGrid() {
  return (
    <ul className={styles.featureGrid} aria-label="What you can do in the portal">
      {features.map((feature) => (
        <li key={feature.label} className={styles.featureItem}>
          <span className={styles.featureIcon}><FeatureIcon name={feature.icon} /></span>
          <span className={styles.featureCopy}>
            <strong>{feature.label}</strong>
            <span>{feature.description}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
