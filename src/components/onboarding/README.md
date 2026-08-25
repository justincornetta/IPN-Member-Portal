# Onboarding UI integration contract

This directory owns the UI-only Welcome and WhatsApp onboarding experience.
It intentionally does not import or modify the production onboarding,
analytics, Supabase, or Resend modules.

## Foundation adapter

`foundation-adapter.ts` currently provides an asynchronous browser fixture. The
foundation task should replace its body with an authenticated mutation matching
`OnboardingFoundationAdapter` in `types.ts`:

```ts
recordWhatsAppJoinIntent({
  channel: "general" | "labs" | "conferences",
  source: "onboarding",
  surface: "desktop_qr" | "mobile_direct",
}): Promise<{ accepted: boolean; intentId?: string }>
```

Desktop must await `accepted: true` before revealing a QR. The event means that
an authenticated member expressed join intent; it does not mean the QR was
scanned or that WhatsApp membership was verified.

## Redirect contract

Presentational components use only these first-party paths:

- `/go/whatsapp/general?source=onboarding`
- `/go/whatsapp/labs?source=onboarding`
- `/go/whatsapp/conferences?source=onboarding`

The foundation task owns those redirects, their invite configuration, and
redirect analytics. They must remain usable without portal authentication so a
different phone can scan a desktop QR without receiving a surprise login page.
Static QR assets encode the production origin plus these paths and therefore do
not contain direct WhatsApp invite links.

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

The three deterministic SVG QR assets encode the production member-portal
origin plus the corresponding first-party redirect path above. They are not
generated from direct WhatsApp invite URLs.
