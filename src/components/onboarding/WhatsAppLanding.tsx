"use client"

import Image from "next/image"
import { useEffect, useState } from "react"
import { onboardingFoundationAdapter } from "./foundation-adapter"
import { whatsappChannels } from "./channels"
import type { WhatsAppChannelId } from "./types"
import styles from "./onboarding.module.css"

type QrState =
  | { status: "loading" }
  | { status: "ready"; imageSrc: string }
  | { status: "error" }

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
  const [joiningId, setJoiningId] = useState<WhatsAppChannelId | null>(null)
  const [joinErrorId, setJoinErrorId] = useState<WhatsAppChannelId | null>(null)
  const [qrState, setQrState] = useState<QrState>({ status: "loading" })
  const selected = whatsappChannels.find((channel) => channel.id === selectedId)!

  useEffect(() => {
    let active = true

    onboardingFoundationAdapter
      .resolveWhatsAppQrTarget({
        kind: "permanent",
        slug: selectedId,
        source: "onboarding",
        surface: "desktop_qr_scan",
      })
      .then((target) => {
        if (active) setQrState({ status: "ready", imageSrc: target.imageSrc })
      })
      .catch(() => {
        if (active) setQrState({ status: "error" })
      })

    return () => {
      active = false
    }
  }, [selectedId])

  function selectChannel(id: WhatsAppChannelId) {
    setQrState({ status: "loading" })
    setSelectedId(id)
    setJoinErrorId(null)
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

  async function handleJoin(
    event: React.MouseEvent<HTMLAnchorElement>,
    id: WhatsAppChannelId,
    surface: "desktop_direct" | "mobile_direct",
  ) {
    event.preventDefault()
    if (joiningId !== null) return
    setJoiningId(id)
    setJoinErrorId(null)

    try {
      const result = await onboardingFoundationAdapter.issueWhatsAppHandoff({
        kind: "permanent",
        slug: id,
        source: "onboarding",
        surface,
      })
      window.location.assign(result.handoffPath)
    } catch {
      setJoiningId(null)
      setJoinErrorId(id)
    }
  }

  return (
    <div className={styles.whatsappLayout}>
      <div className={styles.whatsappIntro}>
        <p className={styles.eyebrow}>Member community</p>
        <h1>Connect with IPN on WhatsApp</h1>
        <p>
          IPN uses WhatsApp for everyday community conversation, ongoing
          programs, conference coordination, and event-specific chats.
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
                  disabled={joiningId !== null}
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

            <div className={styles.qrFrame}>
              {qrState.status === "ready" ? (
                <Image src={qrState.imageSrc} alt={`QR code for the IPN ${selected.name} WhatsApp channel`} width={244} height={244} loading="eager" />
              ) : qrState.status === "error" ? (
                <p className={styles.qrStatus} role="alert">The QR code could not be loaded.</p>
              ) : (
                <p className={styles.qrStatus}>Loading QR code…</p>
              )}
            </div>
            <p className={styles.qrHelp}>Scan with your phone, or join from this device.</p>
            <a
              className={styles.primaryAction}
              href={selected.redirectPath}
              aria-label={`Join ${selected.name} channel on this device`}
              aria-disabled={joiningId !== null}
              onClick={(event) => handleJoin(event, selected.id, "desktop_direct")}
            >
              {joiningId === selected.id ? "Opening channel…" : "Join channel on this device"}
            </a>
            {joinErrorId === selected.id && (
              <p className={styles.errorMessage} role="alert">The channel could not be opened. Try again.</p>
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
                aria-label={`Join ${channel.name} channel on this device`}
                aria-disabled={joiningId !== null}
                onClick={(event) => handleJoin(event, channel.id, "mobile_direct")}
              >
                {joiningId === channel.id ? "Opening channel…" : "Join channel on this device"}
                {joiningId !== channel.id && <span aria-hidden="true"> →</span>}
              </a>
              {joinErrorId === channel.id && (
                <p className={styles.mobileError} role="alert">The channel could not be opened. Try again.</p>
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
