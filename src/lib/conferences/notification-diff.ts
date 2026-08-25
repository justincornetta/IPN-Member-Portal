type ConferenceNotificationItem = {
  id: string
}

type ConferenceNotificationState<TMeetup, TDiscount> = {
  status: string
  meetups: TMeetup[]
  discounts: TDiscount[]
}

export type ConferenceNotificationChanges<TMeetup, TDiscount> = {
  announceConference: boolean
  addedMeetups: TMeetup[]
  addedDiscounts: TDiscount[]
}

export function conferenceNotificationChanges<
  TMeetup extends ConferenceNotificationItem,
  TDiscount extends ConferenceNotificationItem,
>(
  previous: ConferenceNotificationState<TMeetup, TDiscount> | null,
  next: ConferenceNotificationState<TMeetup, TDiscount>,
): ConferenceNotificationChanges<TMeetup, TDiscount> {
  if (next.status !== "published") {
    return {
      announceConference: false,
      addedMeetups: [],
      addedDiscounts: [],
    }
  }

  if (!previous || previous.status !== "published") {
    return {
      announceConference: true,
      addedMeetups: [],
      addedDiscounts: [],
    }
  }

  const previousMeetupIds = new Set(previous.meetups.map((meetup) => meetup.id))
  const previousDiscountIds = new Set(previous.discounts.map((discount) => discount.id))

  return {
    announceConference: false,
    addedMeetups: next.meetups.filter((meetup) => !previousMeetupIds.has(meetup.id)),
    addedDiscounts: next.discounts.filter(
      (discount) => !previousDiscountIds.has(discount.id),
    ),
  }
}
