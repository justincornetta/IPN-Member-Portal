import type {
  ConferenceMeetup,
  ConferenceRecord,
} from "@/lib/conferences/types"

const RISING_PROFESSIONALS_TITLE =
  "rising psychedelic professionals mixer"

export function meetupDisplayDetails(
  meetup: ConferenceMeetup,
  conference: ConferenceRecord,
) {
  if (meetup.title.trim().toLowerCase() === RISING_PROFESSIONALS_TITLE) {
    return {
      startsAt: "2026-10-16T22:00:00.000Z",
      endsAt: "2026-10-17T00:00:00.000Z",
      timezone: "America/New_York",
      description:
        "Connect with students and early-career psychedelic professionals from across the IPN community. Members and prospective members are welcome.",
    }
  }

  return {
    startsAt: meetup.startsAt,
    endsAt: null,
    timezone: conference.timezone,
    description:
      meetup.description
        ?.replace(/horizons conference meetup[\s:–—-]*/gi, "")
        .trim() || null,
  }
}
