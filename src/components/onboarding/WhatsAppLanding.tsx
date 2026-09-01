"use client"

import Image from "next/image"
import {
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  BeakerIcon,
  ChatBubbleOvalLeftEllipsisIcon,
  PencilSquareIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { onboardingFoundationAdapter } from "./foundation-adapter"
import { whatsappChannels } from "./channels"
import { getPortalAnalyticsContext } from "@/lib/portal-analytics/client"
import { saveOnboardingFlowProgress } from "@/lib/onboarding/actions"
import type { WhatsAppChannel, WhatsAppChannelId } from "./types"
import styles from "./onboarding.module.css"

type QrState =
  | { status: "loading" }
  | { status: "ready"; imageSrc: string; expiresAt: string }
  | { status: "error" }

type JoinErrorState = {
  id: WhatsAppChannelId
  reason: "handoff" | "popup"
}

function ChannelIcon({ id }: { id: WhatsAppChannelId }) {
  const Icon = id === "general"
    ? ChatBubbleOvalLeftEllipsisIcon
    : id === "labs"
      ? BeakerIcon
      : UserGroupIcon

  return <Icon aria-hidden="true" />
}

function ChannelPreview({ channel }: { channel: WhatsAppChannel }) {
  return (
    <>
      <div className={styles.previewHeader}>
        <span className={styles.previewIcon}><ChannelIcon id={channel.id} /></span>
        <div>
          <p className={styles.desktopPreviewName}>{channel.name}</p>
          <p className={styles.mobilePreviewName}>Preview: {channel.name}</p>
          <p>{channel.previewDescription}</p>
        </div>
      </div>

      <div className={styles.previewMessages} aria-label={`${channel.name} conversation preview`}>
        {channel.previewMessages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </div>

      <div className={styles.previewPrompt}>
        <span className={styles.promptIcon}><PencilSquareIcon aria-hidden="true" /></span>
        <div>
          <strong>{channel.promptLabel}</strong>
          <p>{channel.prompt}</p>
        </div>
      </div>
    </>
  )
}

export function WhatsAppLanding() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<WhatsAppChannelId>("general")
  const [joiningId, setJoiningId] = useState<WhatsAppChannelId | null>(null)
  const [joinError, setJoinError] = useState<JoinErrorState | null>(null)
  const [qrState, setQrState] = useState<QrState>({ status: "loading" })
  const [qrAttempt, setQrAttempt] = useState(0)
  const [continuing, setContinuing] = useState(false)
  const requestSequence = useRef(0)
  const selected = whatsappChannels.find((channel) => channel.id === selectedId)!

  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) return
    const sequence = ++requestSequence.current
    let refreshTimer: number | undefined
    onboardingFoundationAdapter
      .resolveWhatsAppQrTarget({
        kind: "permanent",
        slug: selectedId,
        source: "onboarding",
        surface: "desktop_qr_scan",
        sessionId: getPortalAnalyticsContext().sessionId,
      })
      .then((target) => {
        if (sequence !== requestSequence.current) return
        setQrState({ status: "ready", imageSrc: target.imageSrc, expiresAt: target.expiresAt })
        const refreshIn = Math.max(5_000, Date.parse(target.expiresAt) - Date.now() - 60_000)
        refreshTimer = window.setTimeout(() => {
          setQrState({ status: "loading" })
          setQrAttempt((attempt) => attempt + 1)
        }, refreshIn)
      })
      .catch(() => {
        if (sequence === requestSequence.current) setQrState({ status: "error" })
      })

    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer)
    }
  }, [selectedId, qrAttempt])

  useEffect(() => {
    void saveOnboardingFlowProgress({ flow: "whatsapp", currentStep: "channels" })
  }, [])

  function selectChannel(id: WhatsAppChannelId) {
    if (id === selectedId) {
      setJoinError(null)
      return
    }

    setQrState({ status: "loading" })
    setSelectedId(id)
    setJoinError(null)
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

    const handoffWindow = window.open("about:blank", "_blank")
    if (!handoffWindow) {
      setJoinError({ id, reason: "popup" })
      return
    }

    handoffWindow.opener = null
    setJoiningId(id)
    setJoinError(null)

    try {
      const result = await onboardingFoundationAdapter.issueWhatsAppHandoff({
        kind: "permanent",
        slug: id,
        source: "onboarding",
        surface,
        sessionId: getPortalAnalyticsContext().sessionId,
      })
      handoffWindow.location.replace(
        new URL(result.handoffPath, window.location.origin).toString(),
      )
      setJoiningId(null)
    } catch {
      handoffWindow.close()
      setJoiningId(null)
      setJoinError({ id, reason: "handoff" })
    }
  }

  const continueToDashboard = useCallback(async () => {
    if (continuing) return
    setContinuing(true)
    try {
      await saveOnboardingFlowProgress({ flow: "whatsapp", currentStep: "continued" })
    } finally {
      setContinuing(false)
      router.push("/dashboard")
    }
  }, [continuing, router])

  function joinErrorMessage(id: WhatsAppChannelId) {
    if (joinError?.id !== id) return null
    return joinError.reason === "popup"
      ? "Allow new tabs for this site, then try again."
      : "The channel could not be opened. Try again."
  }

  return (
    <div className={styles.whatsappLayout}>
      <div className={styles.whatsappIntro}>
        <p className={styles.eyebrow}>Member community</p>
        <h1>Meet the community on WhatsApp</h1>
        <p>
          Connect in focused spaces for conversations, resources, and
          real-world opportunities.
        </p>
      </div>

      <section className={styles.channelExperience} aria-label="Choose an IPN WhatsApp channel">
        <div className={styles.desktopExperience}>
          <aside className={styles.desktopChannelNav}>
            <p className={styles.channelNavLabel}>Choose a channel</p>
            <div className={styles.desktopChannelSelector} role="radiogroup" aria-label="WhatsApp channels">
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
                    className={`${styles.channelChoice} ${isSelected ? styles.channelChoiceSelected : ""}`}
                    onClick={() => selectChannel(channel.id)}
                    onKeyDown={(event) => handleChannelKeyDown(event, index)}
                  >
                    <span className={styles.channelIcon}><ChannelIcon id={channel.id} /></span>
                    <span className={styles.channelNameRow}>
                      <strong>{channel.name}</strong>
                      {channel.recommended && <span className={styles.recommended}>Start here</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <article className={styles.previewPanel} aria-live="polite">
            <ChannelPreview channel={selected} />
          </article>

          <aside className={styles.qrStage} aria-live="polite">
            <p className={styles.qrEyebrow}>Scan to join</p>
            <h2>Scan to join {selected.name}</h2>
            <span className={styles.qrAccent} aria-hidden="true" />
            <div className={styles.qrFrame}>
              {qrState.status === "ready" ? (
                <Image src={qrState.imageSrc} alt={`QR code for the IPN ${selected.name} WhatsApp channel`} width={244} height={244} loading="eager" />
              ) : qrState.status === "error" ? (
                <div className={styles.qrStatus} role="alert">
                  <p>The QR code could not be loaded.</p>
                  <button type="button" onClick={() => {
                    setQrState({ status: "loading" })
                    setQrAttempt((attempt) => attempt + 1)
                  }}>Try again</button>
                </div>
              ) : (
                <p className={styles.qrStatus}>Loading QR code…</p>
              )}
            </div>
            <p className={styles.qrHelp}>Scan with your phone, or open the channel in a new tab.</p>
            <a
              className={styles.primaryAction}
              href={selected.redirectPath}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Join ${selected.name} channel on this device (opens in a new tab)`}
              aria-disabled={joiningId !== null}
              onClick={(event) => handleJoin(event, selected.id, "desktop_direct")}
            >
              {joiningId === selected.id ? "Opening channel…" : "Join channel"}
              {joiningId !== selected.id && <ArrowTopRightOnSquareIcon aria-hidden="true" />}
            </a>
            {joinError?.id === selected.id && (
              <p className={styles.errorMessage} role="alert">{joinErrorMessage(selected.id)}</p>
            )}
            <div className={styles.desktopPortalNextStep}>
              <span>Or</span>
              <a
                href="/dashboard"
                aria-disabled={continuing}
                onClick={(event) => {
                  event.preventDefault()
                  void continueToDashboard()
                }}
              >
                {continuing ? "Opening member portal…" : "Continue to member portal"}
                {!continuing && <ArrowRightIcon aria-hidden="true" />}
              </a>
            </div>
          </aside>
        </div>

        <div className={styles.mobileExperience}>
          <div className={styles.mobileChannelSelector} role="radiogroup" aria-label="WhatsApp channels">
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
                  className={`${styles.mobileChannelChoice} ${isSelected ? styles.mobileChannelChoiceSelected : ""}`}
                  onClick={() => selectChannel(channel.id)}
                  onKeyDown={(event) => handleChannelKeyDown(event, index)}
                >
                  <span className={styles.channelIcon}><ChannelIcon id={channel.id} /></span>
                  <span>
                    <strong>{channel.name}</strong>
                    {channel.recommended && <span className={styles.recommended}>Start here</span>}
                  </span>
                </button>
              )
            })}
          </div>

          <article className={styles.mobilePreviewPanel} aria-live="polite">
            <ChannelPreview channel={selected} />
          </article>

          <a
            className={styles.mobileJoinAction}
            href={selected.redirectPath}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Join ${selected.name} channel on this device (opens in a new tab)`}
            aria-disabled={joiningId !== null}
            onClick={(event) => handleJoin(event, selected.id, "mobile_direct")}
          >
            {joiningId === selected.id ? "Opening channel…" : "Join channel"}
          </a>
          {joinError?.id === selected.id && (
            <p className={styles.mobileError} role="alert">{joinErrorMessage(selected.id)}</p>
          )}
          <div className={styles.mobilePortalNextStep}>
            <a
              href="/dashboard"
              aria-disabled={continuing}
              onClick={(event) => {
                event.preventDefault()
                void continueToDashboard()
              }}
            >
              {continuing ? "Opening member portal…" : "Continue to member portal"}
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
