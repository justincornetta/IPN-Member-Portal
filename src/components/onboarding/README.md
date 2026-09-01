# Onboarding UI integration contract

This directory owns the UI-only Welcome and WhatsApp onboarding experience.
It intentionally does not import or modify the production onboarding,
analytics, Supabase, or Resend modules.

## Foundation adapter

`foundation-adapter.ts` currently provides an asynchronous browser fixture. At
integration, `issueWhatsAppHandoff()` uses the definitive foundation client
while keeping the `OnboardingFoundationAdapter` seam in `types.ts`:

```ts
issueWhatsAppHandoff({
  kind: "permanent",
  slug: "general" | "labs" | "conferences",
  source: "onboarding",
  surface: "desktop_qr_scan" | "desktop_direct" | "mobile_direct",
  sessionId,
}): Promise<{ handoffPath: string; expiresAt: string; channel: object }>

resolveWhatsAppQrTarget({
  kind: "permanent",
  slug: "general" | "labs" | "conferences",
  source: "onboarding",
  surface: "desktop_qr_scan",
  sessionId,
}): Promise<{ imageSrc: string; handoffPath: string; expiresAt: string }>
```

By user direction, desktop shows the selected channel QR immediately. The
authenticated adapter issues a short-lived handoff automatically for the QR or
when a member chooses the same-device action. Issuance is not join intent. The
public `/go` route records intent only when the handoff is consumed; neither
that redirect nor a QR scan proves WhatsApp membership.

`resolveWhatsAppQrTarget()` turns the absolute one-time `handoffPath` into a
replaceable in-memory QR data URL. The landing screen refreshes it about one
minute before `expiresAt`. The QR remains scan-safe without portal auth and is
loaded automatically without a reveal step.

## Redirect contract

Channel metadata retains these tokenless paths only as compatibility hrefs:

- `/go/whatsapp/general?source=onboarding`
- `/go/whatsapp/labs?source=onboarding`
- `/go/whatsapp/conferences?source=onboarding`

The interactive UI must navigate to the one-time `handoffPath` returned by the
foundation client. This branch deliberately contains no `/go` implementation;
the foundation owns the authenticated issuance endpoint, public scan-safe
handoff, server-only invites, intent recording, and redirect analytics.

Same-device actions keep onboarding open and launch the returned
`handoffPath` in a new tab. Because issuance is asynchronous, the UI opens a
blank tab synchronously from the member's click, removes its opener reference,
and replaces that tab's location when the handoff is ready. Integration must
preserve this behavior, close the pending tab on issuance failure, and reset
the loading state after navigation so a member can join another channel.

Temporary event chats are supplied later through an RSVP-gated collection. The
current UI renders the empty-state contract and makes no temporary chats
available.

## Image and QR asset record

`public/onboarding/global-network.png` was created with the built-in imagegen
tool from the approved Option C mockup. The prompt requested a wide, decorative
connected-world-map background with left-side copy space, deep plum and violet
only, selective node/arc glow, and no text, logo, UI, people, mushrooms, green,
teal, or watermark. The official, unmodified logo source is copied to
`public/onboarding/ipn-logo.png`.

No tracked QR asset contains a channel destination. QR images are generated
dynamically from short-lived first-party handoff URLs.
