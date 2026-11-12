import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createRequest, applyChange } from "../src/lib/leadership-workflows/domain.ts"
import {
  DIRECTOR_SLACK_ID,
  MEDIA_STATUS_EMOJI,
  detectMediaSlackChange,
  formatMediaDate,
  mediaJobsFor,
  mediaParentMessage,
  mediaStatusLabel,
  renderMediaParentText,
  renderMediaThreadReply,
  shouldBroadcastMediaReply,
  shouldNotifyMediaSlack,
  shouldUpdateMediaParent,
  withMediaSlackChange
} from "../src/lib/leadership-workflows/slack-media.ts"

const justin = {
  id: "a8be2531-9c64-4cd6-b1cd-1a12f8465609",
  name: "Justin Cornetta",
  email: "justin@example.test",
  team: "Strategy and Operations"
}
const luke = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Luke Strong",
  email: "luke@example.test",
  team: "Media"
}
const people = [justin, luke]
const now = new Date("2026-11-09T18:00:00Z")
const REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

function mediaInput(extra = {}) {
  return {
    id: REQUEST_ID,
    kind: "media",
    title: "IPN Recruitment 2026-2027",
    media: {
      type: "campaign",
      team: "Strategy and Operations",
      brief: "Launching IPN recruitment for 2026-2027.",
      postedBy: "2026-11-09",
      urgent: true,
      platforms: ["Instagram"],
      formats: ["Story"],
      needsCopyHelp: true,
      destinationUrl: "https://www.intercollegiatepsychedelics.net/join",
      linkPlacement: "Instagram Links",
      ...extra
    }
  }
}

function submitted(extra = {}) {
  return createRequest(mediaInput(extra), justin, now)
}

function save(r, actor, extra) {
  return applyChange(
    r,
    { revision: r.revision, action: "media_save", ...extra },
    actor,
    justin.id,
    people,
    now
  ).record
}

function publication(overrides = {}) {
  return {
    scheduledDate: "",
    assetUrl: "",
    publishedUrl: "",
    postedDate: "",
    ...overrides
  }
}

test("media Slack emoji map covers every media status", () => {
  assert.equal(MEDIA_STATUS_EMOJI.submitted, ":inbox_tray:")
  assert.equal(MEDIA_STATUS_EMOJI.accepted, ":white_check_mark:")
  assert.equal(MEDIA_STATUS_EMOJI.assigned, ":hammer_and_wrench:")
  assert.equal(MEDIA_STATUS_EMOJI.in_production, ":hammer_and_wrench:")
  assert.equal(MEDIA_STATUS_EMOJI.director_review, ":eyes:")
  assert.equal(MEDIA_STATUS_EMOJI.ready_to_post, ":large_green_circle:")
  assert.equal(MEDIA_STATUS_EMOJI.posted, ":tada:")
  assert.equal(MEDIA_STATUS_EMOJI.needs_information, ":raising_hand:")
  assert.equal(MEDIA_STATUS_EMOJI.cancelled, ":no_entry_sign:")
  assert.equal(
    mediaStatusLabel("assigned"),
    ":hammer_and_wrench: Assigned: In Progress"
  )
})

test("jobsFor posts a submission and skips comments, edits, and no-op saves", () => {
  const r = submitted()
  assert.deepEqual(mediaJobsFor(r, "submitted"), [{ target: "slack_media" }])
  assert.deepEqual(mediaJobsFor(r, "comment"), [])
  assert.deepEqual(mediaJobsFor(r, "edit"), [])
  const unchanged = save(r, justin, {
    ownerId: "",
    status: "submitted",
    publication: publication()
  })
  assert.equal(unchanged.status, "submitted")
  const change = detectMediaSlackChange(r, unchanged, "saved")
  assert.equal(shouldNotifyMediaSlack("saved", change), false)
  assert.deepEqual(mediaJobsFor(unchanged, "saved", r), [])
})

test("jobsFor notifies on status, owner, and planned date changes only", () => {
  const r = submitted()
  const accepted = save(r, justin, {
    ownerId: "",
    status: "accepted",
    publication: publication()
  })
  assert.deepEqual(mediaJobsFor(accepted, "saved", r, "Ready for Media"), [
    { target: "slack_media" }
  ])
  const assigned = save(accepted, justin, {
    ownerId: luke.id,
    status: "assigned",
    publication: publication()
  })
  assert.deepEqual(mediaJobsFor(assigned, "saved", accepted), [
    { target: "slack_media" }
  ])
  const scheduled = save(assigned, luke, {
    ownerId: luke.id,
    status: "assigned",
    publication: publication({ scheduledDate: "2026-11-16" })
  })
  assert.deepEqual(mediaJobsFor(scheduled, "saved", assigned), [
    { target: "slack_media" }
  ])
  const assetOnly = save(scheduled, luke, {
    ownerId: luke.id,
    status: "assigned",
    publication: publication({
      scheduledDate: "2026-11-16",
      assetUrl: "https://www.canva.com/design/recruitment/edit"
    })
  })
  assert.deepEqual(mediaJobsFor(assetOnly, "saved", scheduled), [])
})

test("needs information DMs the submitter and broadcasts; owner saves do not DM the owner", () => {
  const r = submitted()
  const asked = save(r, justin, {
    ownerId: "",
    status: "needs_information",
    note: "Please confirm the Instagram link placement.",
    publication: publication()
  })
  assert.deepEqual(
    mediaJobsFor(asked, "saved", r, "Please confirm the Instagram link placement."),
    [
      { target: "slack_media" },
      { target: "slack_dm", recipientId: justin.id }
    ]
  )
  const change = detectMediaSlackChange(
    r,
    asked,
    "saved",
    "Please confirm the Instagram link placement."
  )
  assert.equal(shouldBroadcastMediaReply(change), true)
  const assigned = save(r, justin, {
    ownerId: luke.id,
    status: "assigned",
    publication: publication()
  })
  const jobs = mediaJobsFor(assigned, "saved", r)
  assert.deepEqual(jobs, [{ target: "slack_media" }])
  assert.equal(
    jobs.some((job) => job.recipientId === luke.id),
    false
  )
})

test("published and cancelled replies broadcast; accepted does not", () => {
  assert.equal(
    shouldBroadcastMediaReply({
      event: "saved",
      statusChanged: true,
      previousStatus: "ready_to_post",
      status: "posted",
      ownerChanged: false,
      previousOwnerId: luke.id,
      ownerId: luke.id,
      scheduledDateChanged: false,
      previousScheduledDate: "2026-11-16",
      scheduledDate: "2026-11-16",
      note: "",
      publishedUrl: "https://www.instagram.com/p/example/"
    }),
    true
  )
  assert.equal(
    shouldBroadcastMediaReply({
      event: "saved",
      statusChanged: true,
      previousStatus: "submitted",
      status: "cancelled",
      ownerChanged: false,
      previousOwnerId: "",
      ownerId: "",
      scheduledDateChanged: false,
      previousScheduledDate: "",
      scheduledDate: "",
      note: "",
      publishedUrl: ""
    }),
    true
  )
  assert.equal(
    shouldBroadcastMediaReply({
      event: "saved",
      statusChanged: true,
      previousStatus: "submitted",
      status: "accepted",
      ownerChanged: false,
      previousOwnerId: "",
      ownerId: "",
      scheduledDateChanged: false,
      previousScheduledDate: "",
      scheduledDate: "",
      note: "",
      publishedUrl: ""
    }),
    false
  )
})

test("parent message includes every key field, uses Not set, and tags Agnes only on submission", () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL
  process.env.NEXT_PUBLIC_SITE_URL =
    "https://members.intercollegiatepsychedelics.net"
  try {
    const r = submitted()
    const text = renderMediaParentText(r, { tagDirector: true })
    assert.match(text, /^:triangular_flag_on_post: URGENT\n/)
    assert.match(
      text,
      new RegExp(`^:triangular_flag_on_post: URGENT\\n<@${DIRECTOR_SLACK_ID}>, new media request`, "m")
    )
    assert.match(text, /\*Status:\* :inbox_tray: Submitted/)
    assert.match(text, /\*Owner:\* Not set/)
    assert.match(text, /\*IPN Recruitment 2026-2027\*/)
    assert.match(text, /Campaign · Strategy and Operations/)
    assert.match(text, /From Justin Cornetta/)
    assert.match(text, /:calendar: \*Requested post by:\* Nov 9, 2026/)
    assert.match(text, /:calendar: \*Planned post date:\* Not set/)
    assert.match(text, /\*Platforms:\* Instagram/)
    assert.match(text, /\*Formats:\* Story/)
    assert.match(
      text,
      /:link: \*Link to include:\* https:\/\/www\.intercollegiatepsychedelics\.net\/join/
    )
    assert.match(text, /\*Where:\* Instagram Links/)
    assert.match(text, /Launching IPN recruitment for 2026-2027\./)
    assert.match(
      text,
      new RegExp(
        `Open request: https://members.intercollegiatepsychedelics.net/dashboard/admin/media\\?request=${REQUEST_ID}`
      )
    )
    const message = mediaParentMessage(r, { tagDirector: true })
    assert.equal(message.blocks[1].elements[0].text.text, "Open request")
    const updated = renderMediaParentText(
      {
        ...r,
        status: "assigned",
        media: {
          ...r.media,
          productionOwnerId: luke.id,
          deliverables: [
            {
              id: "publication-" + REQUEST_ID,
              name: r.title,
              platform: "Instagram",
              format: "Story",
              assigneeId: "",
              publisherId: luke.id,
              scheduledDate: "2026-11-16",
              status: "planned",
              assetUrl: "",
              publishedUrl: "",
              postedDate: ""
            }
          ]
        }
      },
      { tagDirector: false, ownerName: "Luke Strong" }
    )
    assert.match(updated, /^:triangular_flag_on_post: URGENT\nMedia request\n/)
    assert.doesNotMatch(updated, new RegExp(`<@${DIRECTOR_SLACK_ID}>`))
    assert.match(updated, /\*Status:\* :hammer_and_wrench: Assigned: In Progress/)
    assert.match(updated, /\*Owner:\* Luke Strong/)
    assert.match(updated, /:calendar: \*Planned post date:\* Nov 16, 2026/)
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
    else process.env.NEXT_PUBLIC_SITE_URL = previous
  }
})

test("blank request fields render as Not set and dates format in UTC", () => {
  const r = createRequest(
    {
      id: randomUUID(),
      kind: "media",
      title: "Untitled idea",
      media: {
        type: "announcement",
        team: "Community",
        brief: "TBD",
        postedBy: "2026-12-01",
        platforms: ["Media to advise"],
        formats: ["Media to advise"],
        needsCopyHelp: true
      }
    },
    justin,
    now
  )
  r.media.brief = ""
  const text = renderMediaParentText(r, { tagDirector: false })
  assert.match(text, /:link: \*Link to include:\* Not set/)
  assert.match(text, /\*Where:\* Not set/)
  assert.match(text, /:calendar: \*Planned post date:\* Not set/)
  assert.match(text, /\nNot set\n/)
  assert.equal(formatMediaDate("2026-11-16"), "Nov 16, 2026")
  assert.equal(formatMediaDate(""), "Not set")
})

test("thread replies mention the submitter, tag a new owner only on assignment, and do not tag Agnes", () => {
  const submitter = { name: "Justin Cornetta", slackId: "U_JUSTIN" }
  const owner = { name: "Luke Strong", slackId: "U_LUKE" }
  const assigned = detectMediaSlackChange(
    submitted(),
    save(submitted(), justin, {
      ownerId: luke.id,
      status: "assigned",
      publication: publication()
    }),
    "saved"
  )
  const assignedText = renderMediaThreadReply(assigned, { submitter, owner })
  assert.equal(
    assignedText,
    [
      "<@U_JUSTIN>",
      ":hammer_and_wrench: Assigned to <@U_LUKE>",
      ":hammer_and_wrench: Status: :inbox_tray: Submitted → :hammer_and_wrench: Assigned: In Progress"
    ].join("\n")
  )
  assert.doesNotMatch(assignedText, new RegExp(DIRECTOR_SLACK_ID))
  const scheduled = renderMediaThreadReply(
    {
      event: "saved",
      statusChanged: false,
      status: "assigned",
      ownerChanged: false,
      previousOwnerId: luke.id,
      ownerId: luke.id,
      scheduledDateChanged: true,
      previousScheduledDate: "",
      scheduledDate: "2026-11-16",
      note: "",
      publishedUrl: ""
    },
    { submitter, owner }
  )
  assert.equal(
    scheduled,
    "<@U_JUSTIN>\n:calendar: Planned post date set to Nov 16, 2026"
  )
  assert.doesNotMatch(scheduled, /<@U_LUKE>/)
  const published = renderMediaThreadReply(
    {
      event: "saved",
      statusChanged: true,
      previousStatus: "ready_to_post",
      status: "posted",
      ownerChanged: false,
      previousOwnerId: luke.id,
      ownerId: luke.id,
      scheduledDateChanged: false,
      previousScheduledDate: "2026-11-16",
      scheduledDate: "2026-11-16",
      note: "",
      publishedUrl: "https://www.instagram.com/p/example/"
    },
    { submitter, owner }
  )
  assert.match(
    published,
    /:tada: Status: :large_green_circle: Approved: Ready to Publish → :tada: Published/
  )
  assert.match(published, /:tada: Published: https:\/\/www\.instagram\.com\/p\/example\//)
  const missing = renderMediaThreadReply(
    {
      event: "saved",
      statusChanged: true,
      previousStatus: "submitted",
      status: "needs_information",
      ownerChanged: false,
      previousOwnerId: "",
      ownerId: "",
      scheduledDateChanged: false,
      previousScheduledDate: "",
      scheduledDate: "",
      note: "Please confirm the Instagram link placement.",
      publishedUrl: ""
    },
    { submitter: { name: "Justin Cornetta" } }
  )
  assert.match(missing, /^Justin Cornetta\n/)
  assert.match(
    missing,
    /:raising_hand: Status: :inbox_tray: Submitted → :raising_hand: Needs information/
  )
  assert.match(missing, /Please confirm the Instagram link placement\./)
  assert.equal(shouldUpdateMediaParent(assigned), true)
})

test("withMediaSlackChange stores a snapshot only when Slack should post", () => {
  const r = submitted()
  const accepted = save(r, justin, {
    ownerId: "",
    status: "accepted",
    publication: publication()
  })
  const stored = withMediaSlackChange(accepted, "saved", r)
  assert.equal(stored.slackChange?.statusChanged, true)
  assert.equal(stored.slackChange?.previousStatus, "submitted")
  assert.equal(stored.slackChange?.status, "accepted")
  const noop = withMediaSlackChange(
    save(r, justin, {
      ownerId: "",
      status: "submitted",
      publication: publication()
    }),
    "saved",
    r
  )
  assert.equal(noop.slackChange, undefined)
})
