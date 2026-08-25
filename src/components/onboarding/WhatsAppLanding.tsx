"use client"

import Image from "next/image"
import { useState } from "react"
import { onboardingFoundationAdapter } from "./foundation-adapter"
import { whatsappChannels } from "./channels"
import type { WhatsAppChannelId } from "./types"
import styles from "./onboarding.module.css"

type RevealState = "idle" | "loading" | "revealed" | "error"

function ChannelIcon({ id }: { id: WhatsAppChannelId }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {id === "general" && <><path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z" /><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" /></>}
      {id === "labs" && <><path d="M9 3h6M10 3v6l-5 9.2A1.9 1.9 0 0 0 6.7 21h10.6a1.9 1.9 0 0 0 1.7-2.8L14 9V3" /><path d="M8 15h8" /></>}
      {id === "conferences" && <><circle cx="8" cy="9" r="3" /><circle cx="17" cy="10" r="2.3" /><path d="M2.8 20c.5-4.1 2.2-6 5.2-6s4.8 1.9 5.2 6M13.5 15.3c3.7-1 6.8.9 7.5 4.7" /></>}
    </svg>
  )
}

export function WhatsAppLanding() {
  const [selectedId, setSelectedId] = useState<WhatsAppChannelId>("general")
  const [revealState, setRevealState] = useState<RevealState>("idle")
  const [revealedChannelId, setRevealedChannelId] = useState<WhatsAppChannelId | null>(null)
  const [mobileLoadingId, setMobileLoadingId] = useState<WhatsAppChannelId | null>(null)
  const [mobileErrorId, setMobileErrorId] = useState<WhatsAppChannelId | null>(null)
  const selected = whatsappChannels.find((channel) => channel.id === selectedId)!

  function selectChannel(id: WhatsAppChannelId) {
    setSelectedId(id)
    setRevealState("idle")
    setRevealedChannelId(null)
  }

  function handleChannelKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return
    event.preventDefault()
    const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1
    const nextIndex = (index + direction + whatsappChannels.length) % whatsappChannels.length
    selectChannel(whatsappChannels[nextIndex].id)
    const radios = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role='radio']")
    radios?.[nextIndex]?.focus()
  }

  async function revealQr() {
    const requestedChannelId = selected.id
    setRevealState("loading")
    setRevealedChannelId(null)
    try {
      const result = await onboardingFoundationAdapter.recordWhatsAppJoinIntent({
        channel: requestedChannelId,
        source: "onboarding",
        surface: "desktop_qr",
      })
      if (!result.accepted) throw new Error("Intent was not accepted")
      setRevealedChannelId(requestedChannelId)
      setRevealState("revealed")
    } catch {
      setRevealState("error")
    }
  }

  async function handleMobileJoin(
    event: React.MouseEvent<HTMLAnchorElement>,
    id: WhatsAppChannelId,
    redirectPath: string,
  ) {
    event.preventDefault()
    if (mobileLoadingId !== null) return
    setMobileLoadingId(id)
    setMobileErrorId(null)

    try {
      const result = await onboardingFoundationAdapter.recordWhatsAppJoinIntent({
        channel: id,
        source: "onboarding",
        surface: "mobile_direct",
      })
      if (!result.accepted) throw new Error("Intent was not accepted")
      window.location.assign(redirectPath)
    } catch {
      setMobileLoadingId(null)
      setMobileErrorId(id)
    }
  }

  return (
    <div className={styles.whatsappLayout}>
      <div className={styles.whatsappIntro}>
        <p className={styles.eyebrow}>Member community</p>
        <h1>Connect with IPN on WhatsApp</h1>
        <p>
          IPN uses WhatsApp for everyday community conversation, ongoing
          programs, conference coordination, and time-limited event chats.
        </p>
      </div>

      <section className={styles.channelPanel} aria-labelledby="channel-heading">
        <div className={styles.channelPanelHeader}>
          <div>
            <p className={styles.stepLabel}>Choose where to start</p>
            <h2 id="channel-heading">Your IPN conversations</h2>
          </div>
          <p className={styles.announcementNote}>
            <span aria-hidden="true">✦</span>
            Joining any IPN group automatically adds you to Announcements.
          </p>
        </div>

        <div className={styles.desktopChannels}>
          <div className={styles.channelList} role="radiogroup" aria-label="WhatsApp channels">
            {whatsappChannels.map((channel, index) => {
              const isSelected = selectedId === channel.id
              return (
                <button
                  key={channel.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  disabled={revealState === "loading"}
                  className={`${styles.channelChoice} ${isSelected ? styles.channelChoiceSelected : ""} ${channel.recommended ? styles.channelChoiceFeatured : ""}`}
                  onClick={() => selectChannel(channel.id)}
                  onKeyDown={(event) => handleChannelKeyDown(event, index)}
                >
                  <span className={styles.channelIcon}><ChannelIcon id={channel.id} /></span>
                  <span className={styles.channelCopy}>
                    <span className={styles.channelNameRow}>
                      <strong>{channel.name}</strong>
                      {channel.recommended && <span className={styles.recommended}>Recommended</span>}
                    </span>
                    <span>{channel.description}</span>
                  </span>
                  <span className={styles.selectionMark} aria-hidden="true">{isSelected ? "●" : "○"}</span>
                </button>
              )
            })}

            <div className={styles.eventEmptyState}>
              <span className={styles.eventIcon} aria-hidden="true">◇</span>
              <span>
                <strong>No active event chats</strong>
                <small>When an RSVP-gated chat opens, it will appear here.</small>
              </span>
            </div>
          </div>

          <div className={styles.qrStage} aria-live="polite">
            <div className={styles.qrTitle}>
              <span className={styles.channelIcon}><ChannelIcon id={selected.id} /></span>
              <div><span>Selected channel</span><strong>{selected.name}</strong></div>
            </div>

            {revealState === "revealed" && revealedChannelId === selected.id ? (
              <>
                <div className={styles.qrFrame}>
                  <Image src={selected.qrAsset} alt={`QR code for the IPN ${selected.name} WhatsApp channel`} width={244} height={244} />
                </div>
                <p className={styles.qrHelp}>Scan with your phone. Portal login is not required on the scanning device.</p>
                <a className={styles.primaryAction} href={selected.redirectPath}>Open {selected.shortName} on this device</a>
              </>
            ) : (
              <div className={styles.qrPrompt}>
                <div className={styles.qrPlaceholder} aria-hidden="true"><span /><span /><span /></div>
                <p>Reveal a QR code to join <strong>{selected.name}</strong> from your phone.</p>
                <button className={styles.primaryAction} type="button" onClick={revealQr} disabled={revealState === "loading"}>
                  {revealState === "loading" ? "Recording your choice…" : `Show ${selected.shortName} QR`}
                </button>
                {revealState === "error" && (
                  <p className={styles.errorMessage} role="alert">Your choice could not be recorded. Try again to reveal the QR.</p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.mobileChannels}>
          {whatsappChannels.map((channel) => (
            <article key={channel.id} className={`${styles.mobileChannelCard} ${channel.recommended ? styles.mobileFeatured : ""}`}>
              <div className={styles.mobileChannelHeading}>
                <span className={styles.channelIcon}><ChannelIcon id={channel.id} /></span>
                <div><h3>{channel.name}</h3>{channel.recommended && <span className={styles.recommended}>Recommended</span>}</div>
              </div>
              <p>{channel.description}</p>
              <a
                href={channel.redirectPath}
                aria-disabled={mobileLoadingId !== null}
                onClick={(event) => handleMobileJoin(event, channel.id, channel.redirectPath)}
              >
                {mobileLoadingId === channel.id ? "Recording your choice…" : `Join ${channel.shortName}`}
                {mobileLoadingId !== channel.id && <span aria-hidden="true"> →</span>}
              </a>
              {mobileErrorId === channel.id && (
                <p className={styles.mobileError} role="alert">Your choice could not be recorded. Try again.</p>
              )}
            </article>
          ))}

          <div className={styles.eventEmptyState}>
            <span className={styles.eventIcon} aria-hidden="true">◇</span>
            <span><strong>No active event chats</strong><small>RSVP-gated chats will appear here when available.</small></span>
          </div>
        </div>
      </section>
    </div>
  )
}
