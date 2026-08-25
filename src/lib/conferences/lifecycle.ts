import type { ConferenceRecord, PastConferenceRecord } from "./types"

export function splitConferencesByEndDate(
  conferences: ConferenceRecord[],
  now: Date = new Date(),
) {
  const cutoff = now.getTime()
  const upcoming: ConferenceRecord[] = []
  const completed: ConferenceRecord[] = []

  for (const conference of conferences) {
    const endsAt = new Date(conference.ends_at).getTime()
    if (Number.isFinite(endsAt) && endsAt < cutoff) completed.push(conference)
    else upcoming.push(conference)
  }

  return { upcoming, completed }
}

function pastConferenceKey(conference: Pick<PastConferenceRecord, "name" | "starts_at">) {
  return `${conference.name.trim().toLocaleLowerCase()}|${conference.starts_at?.slice(0, 10) ?? ""}`
}

function completedConferenceAsPast(conference: ConferenceRecord): PastConferenceRecord {
  return {
    id: conference.id,
    slug: conference.slug,
    name: conference.name,
    organizer: conference.organizer,
    category: conference.category,
    cover_image_url: conference.cover_image_url,
    starts_at: conference.starts_at,
    ends_at: conference.ends_at,
    city: conference.city,
    state: conference.state,
    country: conference.country,
    summary: conference.summary,
    drive_folder_url: null,
  }
}

export function mergeCompletedAndHistoricalConferences(
  completed: ConferenceRecord[],
  historical: PastConferenceRecord[],
) {
  const merged = new Map<string, PastConferenceRecord>()

  for (const conference of completed) {
    const pastConference = completedConferenceAsPast(conference)
    merged.set(pastConferenceKey(pastConference), pastConference)
  }

  // Curated historical records take precedence because they may include a
  // photo folder and edited retrospective copy.
  for (const conference of historical) {
    merged.set(pastConferenceKey(conference), conference)
  }

  return Array.from(merged.values()).sort((a, b) =>
    (b.starts_at ?? "").localeCompare(a.starts_at ?? ""),
  )
}
