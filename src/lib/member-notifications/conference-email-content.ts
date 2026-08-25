import { formatConferenceDateRange, formatMeetupDateTime } from "@/lib/conferences/format"
import { conferenceNotificationMessage } from "@/lib/conferences/notification-copy"
import type {
  ConferenceDiscount,
  ConferenceMeetup,
  ConferenceRecord,
} from "@/lib/conferences/types"

export type ConferenceEmailDetail = {
  label: string
  value: string
}

export type ConferenceEmailContent = {
  subject: string
  preview: string
  greeting: string
  body: string[]
  details?: ConferenceEmailDetail[]
  afterDetails?: string[]
  buttonLabel: string
  buttonUrl: string
  closing?: string[]
  receiptReason: string
}

function greeting(firstName: string | null | undefined) {
  return `Hi ${firstName?.trim() || "there"},`
}

function conferenceLocation(conference: ConferenceRecord) {
  return [conference.venue, conference.city, conference.state, conference.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ") || "Location to be announced"
}

export function buildNewConferenceEmailContent(
  conference: ConferenceRecord,
  firstName: string | null | undefined,
  buttonUrl: string,
): ConferenceEmailContent {
  return {
    subject: `New conference opportunity: ${conference.name}`,
    preview: `${conference.name} is now in the IPN Member Portal.`,
    greeting: greeting(firstName),
    body: [
      "We just added a new conference opportunity to the IPN Member Portal.",
    ],
    details: [
      { label: "Conference", value: conference.name },
      {
        label: "When",
        value: formatConferenceDateRange(
          conference.starts_at,
          conference.ends_at,
          conference.timezone,
        ),
      },
      { label: "Where", value: conferenceLocation(conference) },
      ...(conference.organizer
        ? [{ label: "Organizer", value: conference.organizer }]
        : []),
    ],
    afterDetails: [
      "Open the portal to learn why this conference may be worth attending, see available IPN member discounts and meetups, and find other members who plan to go.",
    ],
    buttonLabel: "View conference",
    buttonUrl,
    receiptReason:
      "You are receiving this because you have an IPN Member Portal account.",
  }
}

export function buildConferenceMeetupEmailContent(
  conference: ConferenceRecord,
  meetup: ConferenceMeetup,
  firstName: string | null | undefined,
  buttonUrl: string,
): ConferenceEmailContent {
  const message = conferenceNotificationMessage(
    meetup.notificationMessage,
    meetup.description,
  )

  return {
    subject: `New IPN meetup at ${conference.name}`,
    preview: `${meetup.title} has been added to ${conference.name}.`,
    greeting: greeting(firstName),
    body: [
      `IPN just added a new member meetup during ${conference.name}.`,
    ],
    details: [
      { label: "Meetup", value: meetup.title },
      {
        label: "When",
        value: formatMeetupDateTime(meetup.startsAt, conference.timezone, meetup.endsAt),
      },
      { label: "Where", value: meetup.location ?? "Location to be announced" },
    ],
    afterDetails: [
      ...(message ? [message] : []),
      "Open the conference page to learn more, tell other members you’re going, and RSVP to the meetup.",
    ],
    buttonLabel: "View meetup",
    buttonUrl,
    receiptReason:
      "You are receiving this because you have an IPN Member Portal account.",
  }
}

export function buildConferenceDiscountEmailContent(
  conference: ConferenceRecord,
  discount: ConferenceDiscount,
  firstName: string | null | undefined,
  buttonUrl: string,
): ConferenceEmailContent {
  const expires = discount.expiresAt
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: conference.timezone,
      }).format(new Date(discount.expiresAt))
    : null
  const message = conferenceNotificationMessage(
    discount.notificationMessage,
    discount.description,
  )

  return {
    subject: `New IPN member discount for ${conference.name}`,
    preview: `${discount.label} is now available to IPN members.`,
    greeting: greeting(firstName),
    body: [
      `A new member discount is now available for ${conference.name}.`,
    ],
    details: [
      { label: "Discount", value: discount.label },
      ...(discount.code ? [{ label: "Code", value: discount.code }] : []),
      ...(expires ? [{ label: "Expires", value: expires }] : []),
    ],
    afterDetails: [
      ...(message ? [message] : []),
      ...(discount.howToApply
        ? [`How to apply: ${discount.howToApply}`]
        : []),
      "Open the conference page to see the complete offer and registration details.",
    ],
    buttonLabel: "View member discount",
    buttonUrl,
    receiptReason:
      "You are receiving this because you have an IPN Member Portal account.",
  }
}
