import { test, expect, type Page } from "@playwright/test"
import { randomUUID } from "node:crypto"
const errors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page, request }) => {
  await request.post("/api/admin/workflows", {
    data: { action: "reset_demo" }
  })
  const found: string[] = []
  errors.set(page, found)
  page.on("pageerror", (e) => found.push(e.message))
  page.on("console", (m) => {
    if (m.type() === "error") found.push(m.text())
  })
})
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([])
  await expect(page.locator("nextjs-portal [data-nextjs-dialog]")).toHaveCount(
    0
  )
})
test("expense approval, purchase and receipt through the browser", async ({
  page
}) => {
  await page.goto("/workflow-preview/expenses")
  await page
    .getByRole("button", { name: "Submit expense", exact: true })
    .click()
  await page
    .getByLabel("Expense", { exact: true })
    .fill("Approved event supplies")
  await page
    .getByLabel("Purpose", { exact: true })
    .fill("Supplies for the Community meetup")
  const cost = page.getByLabel("Cost (USD)")
  await expect(cost).toHaveAttribute("placeholder", "45.00")
  await cost.fill("40.00")
  await cost.fill("$40.00")
  await expect(cost).toHaveValue("40.00")
  await cost.fill("40.001")
  await expect(cost).toHaveValue("40.00")
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click()
  await expect(
    page.getByText("Pending approval", { exact: true }).first()
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Approve expense", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Record the purchase" })
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Record purchase", exact: true })
    .click()
  await expect(
    page.getByText("Purchased", { exact: true }).first()
  ).toBeVisible()
  await page
    .getByLabel("Add or update receipt link")
    .fill("https://drive.google.com/file/d/example-receipt/view")
  await page.getByRole("button", { name: "Save receipt", exact: true }).click()
  await expect(
    page.getByRole("link", { name: "View saved receipt" })
  ).toHaveAttribute(
    "href",
    "https://drive.google.com/file/d/example-receipt/view"
  )
  await expect(page.getByLabel("Add a comment")).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: /Activity history/ })
  ).toBeVisible()
  await expect(
    page.getByText("Reconcile bank activity", { exact: true })
  ).toHaveCount(0)
  await page.screenshot({
    path: "/tmp/ipn-workflow-expense.png",
    fullPage: true
  })
})
test("leadership expense privacy and preapproved reimbursement", async ({
  page,
  request
}) => {
  const privateExpense = await request.post("/api/admin/workflows", {
    data: {
      id: randomUUID(),
      kind: "expense",
      title: "Justin private expense",
      expense: { purpose: "Private review", amountCents: "10.00" }
    }
  })
  expect(privateExpense.ok()).toBeTruthy()
  await page.goto("/workflow-preview/expenses")
  await page.getByLabel("Preview as").selectOption("member")
  await expect(
    page.getByText("Justin private expense", { exact: true })
  ).toHaveCount(0)
  await page
    .getByRole("button", { name: "Submit expense", exact: true })
    .click()
  await page
    .getByLabel("Expense", { exact: true })
    .fill("Leadership personal purchase")
  await page
    .getByLabel("Purpose", { exact: true })
    .fill("Preapproved meetup materials")
  await page.getByLabel("Cost (USD)").fill("25")
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Approve expense" })
  ).toHaveCount(0)
  await page.getByLabel("Preview as").selectOption("approver")
  await page
    .getByRole("button", { name: /Leadership personal purchase/ })
    .click()
  await page
    .getByRole("button", { name: "Approve expense", exact: true })
    .click()
  await page.getByLabel("Preview as").selectOption("member")
  await page
    .getByRole("button", { name: /Leadership personal purchase/ })
    .click()
  await page
    .getByRole("button", { name: "Record purchase", exact: true })
    .click()
  await expect(
    page.getByText("Awaiting reimbursement", { exact: true }).first()
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Mark reimbursed" })
  ).toHaveCount(0)
  await page.getByLabel("Preview as").selectOption("approver")
  await page
    .getByRole("button", { name: /Leadership personal purchase/ })
    .click()
  await page
    .getByRole("button", { name: "Mark reimbursed", exact: true })
    .click()
  await expect(
    page.getByText("Reimbursed", { exact: true }).first()
  ).toBeVisible()
})
test("general media request, shared assignment, review and request publication", async ({
  page,
  request
}) => {
  await page.goto("/workflow-preview/media")
  const previewNav = page.getByRole("navigation", {
    name: "Preview admin navigation"
  })
  await expect(
    previewNav.getByText("Analytics", { exact: true })
  ).toHaveAttribute("aria-disabled", "true")
  await expect(
    previewNav.getByText("Content", { exact: true })
  ).toHaveAttribute("aria-disabled", "true")
  await expect(
    page.locator('a[href^="/dashboard"], a[href^="/login"]')
  ).toHaveCount(0)
  await previewNav
    .getByRole("link", { name: "Expense Submissions", exact: true })
    .click()
  await expect(page).toHaveURL(/\/workflow-preview\/expenses$/)
  await previewNav
    .getByRole("link", { name: "Media Requests", exact: true })
    .click()
  await expect(page).toHaveURL(/\/workflow-preview\/media$/)
  await page
    .getByRole("button", { name: "New media request", exact: true })
    .click()
  await page
    .getByLabel("Idea name", { exact: true })
    .fill("Leadership announcement")
  await page.getByLabel("Team / project").fill("IPN Media")
  await page
    .getByLabel("Idea / brief")
    .fill(
      "Introduce our new Director of Media and invite leaders to use the queue."
    )
  await page
    .getByLabel("When does this need to be posted by?")
    .fill("2026-10-20")
  await page.getByLabel("Urgent — alert Agnes").check()
  await page.locator('summary[aria-label="Media format"]').click()
  const formats = page.getByRole("group", { name: "Media format options" })
  await formats.getByLabel("Carousel", { exact: true }).check()
  await formats.getByLabel("Email Campaign", { exact: true }).check()
  await expect(
    formats.getByLabel("Media to advise", { exact: true })
  ).not.toBeChecked()
  await page.locator('summary[aria-label="Media format"]').click()
  await page.getByLabel("Email", { exact: true }).check()
  await page
    .getByLabel("Destination URL")
    .fill("https://members.intercollegiatepsychedelics.net/events/seminar")
  await page
    .getByLabel("Where to include the link")
    .fill("Instagram bio and email button")
  await page.getByLabel("Draft copy", { exact: true }).selectOption("help")
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click()
  const publishingLink = page.getByRole("region", {
    name: "Requested publishing link"
  })
  await expect(publishingLink.getByRole("link")).toHaveAttribute(
    "href",
    "https://members.intercollegiatepsychedelics.net/events/seminar"
  )
  await expect(publishingLink).toContainText("Instagram bio and email button")
  await expect(
    page.getByLabel("I included the requested link in the specified location")
  ).toHaveCount(0)
  await expect(page.getByLabel("Move request to")).toHaveValue("submitted")
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(1)
  await expect(page.getByRole("button", { name: "Save production", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Update status", exact: true })).toHaveCount(0)
  expect(await page.getByLabel("Move request to").evaluate((element) => Boolean(element.compareDocumentPosition(document.querySelector('[aria-label="Final asset link (Drive / Canva)"]')!) & Node.DOCUMENT_POSITION_FOLLOWING))).toBeTruthy()
  await page.getByLabel("Media owner", { exact: true }).selectOption({ label: "Alex Morgan" })
  await page.getByLabel("Move request to").selectOption("accepted")
  await page.getByLabel("Review notes / missing information").fill("Complete brief, assigned to Alex.")
  const acceptanceSaved = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes("/api/admin/workflows/"))
  await page.getByRole("button", { name: "Save", exact: true }).click()
  expect((await acceptanceSaved).ok()).toBeTruthy()
  await expect(page.getByLabel("Move request to")).toHaveValue("accepted")
  const saved = (await (await request.get("/api/admin/workflows")).json()).data
  const accepted = saved.requests.find((record: { title: string }) => record.title === "Leadership announcement")
  expect(accepted.revision).toBe(2)
  expect(accepted.media.productionOwnerId).toBe(saved.people.find((person: { name: string }) => person.name === "Alex Morgan").id)
  const history = saved.activity.filter((activity: { requestId: string }) => activity.requestId === accepted.id)
  expect(history).toHaveLength(2)
  expect(history.find((activity: { event: string }) => activity.event === "saved").note).toBe("Complete brief, assigned to Alex.")
  const invalid = await request.patch(`/api/admin/workflows/${accepted.id}`, {
    data: { revision: 2, action: "media_save", ownerId: saved.user.id, status: "assigned", publication: { assetUrl: "https://example.com/asset" } }
  })
  expect(invalid.status()).toBe(400)
  const unchanged = (await (await request.get("/api/admin/workflows")).json()).data.requests.find((record: { id: string }) => record.id === accepted.id)
  expect(unchanged.revision).toBe(2)
  expect(unchanged.status).toBe("accepted")
  expect(unchanged.media.productionOwnerId).toBe(accepted.media.productionOwnerId)
  await page.getByRole("region", { name: "Production and publication", exact: true }).screenshot({ path: "/tmp/ipn-workflow-media-single-save.png" })
  await page
    .getByLabel("Media owner", { exact: true })
    .selectOption({ label: "Alex Morgan" })
  await expect(
    page.getByLabel("Publishing owner", { exact: true })
  ).toHaveCount(0)
  const overview = page.getByRole("region", { name: "Request overview", exact: true })
  await expect(overview.getByText("Email", { exact: true })).toBeVisible()
  await expect(overview.getByText("Carousel, Email Campaign", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Add content item", exact: true })
  ).toHaveCount(0)
  await expect(page.getByLabel("Content status")).toHaveCount(0)
  await expect(page.getByLabel("Content owner (optional)")).toHaveCount(0)
  await page
    .getByLabel("Final asset link (Drive / Canva)")
    .fill("https://www.canva.com/design/example/edit")
  await page.getByLabel("Scheduled posting date").fill("2026-10-19")
  await page
    .getByRole("button", { name: "Save", exact: true })
    .click()
  for (const status of [
    "assigned",
    "director_review",
    "ready_to_post"
  ]) {
    await page.getByLabel("Move request to").selectOption(status)
    await page
      .getByRole("button", { name: "Save", exact: true })
      .click()
    await expect(page.getByLabel("Move request to")).toBeVisible()
  }
  await page.getByRole("button", { name: "Back to queue", exact: true }).click()
  await page
    .getByRole("button", { name: "Media calendar", exact: true })
    .click()
  await page.getByLabel("Calendar month").fill("2026-10")
  const calendar = page.getByRole("region", { name: "Media calendar" })
  await expect(
    calendar.getByRole("button", { name: /Deadline.*Leadership announcement/ })
  ).toBeVisible()
  const scheduled = calendar.getByRole("button", {
    name: /Scheduled.*Leadership announcement/
  })
  await expect(scheduled).toBeVisible()
  await page.getByLabel("Calendar month").fill("2028-02")
  await expect(calendar.getByText("29", { exact: true })).toBeVisible()
  await expect(calendar.getByText("30", { exact: true })).toHaveCount(0)
  await page.getByLabel("Calendar month").fill("2026-10")
  await page.screenshot({
    path: "/tmp/ipn-workflow-calendar.png",
    fullPage: true
  })
  await scheduled.click()
  await expect(page.getByLabel("Published link")).toBeVisible()
  await expect(page.locator("summary").filter({ hasText: "Publication record" })).toHaveCount(0)
  await expect(page.getByText("Posting checklist", { exact: true })).toHaveCount(0)
  await page
    .getByLabel("Published link")
    .fill("https://www.instagram.com/p/example/")
  await page
    .getByLabel("Actual posting date")
    .fill(new Date().toISOString().slice(0, 10))
  await page.getByLabel("Move request to").selectOption("posted")
  await page
    .getByRole("button", { name: "Save", exact: true })
    .click()
  await expect(page.getByText("Published", { exact: true }).first()).toBeVisible()
  await page.screenshot({
    path: "/tmp/ipn-workflow-media.png",
    fullPage: true
  })
})
test("event prefill, mobile layout and Admin dropdown", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/workflow-preview/media")
  await page
    .getByRole("button", { name: "New media request", exact: true })
    .click()
  await page.getByLabel("Request type").selectOption("event")
  await page.getByLabel("Existing event").selectOption("demo-event")
  await expect(page.getByLabel("Idea name", { exact: true })).toHaveValue(
    "IPN Labs research seminar"
  )
  await expect(page.getByLabel("Event details")).toHaveValue(/October 20, 2026/)
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBeTruthy()
  await page.screenshot({
    path: "/tmp/ipn-workflow-mobile.png",
    fullPage: true
  })
})
test("API rejects cross-site access, unauthorized approvals and stale revisions", async ({
  request
}) => {
  const id = randomUUID()
  const made = await request.post("/api/admin/workflows", {
    headers: { "x-workflow-demo-user": "member" },
    data: {
      id,
      kind: "expense",
      title: "Private member expense",
      expense: { purpose: "Meetup", amountCents: "12.50" }
    }
  })
  expect(made.ok()).toBeTruthy()
  const denied = await request.patch(`/api/admin/workflows/${id}`, {
    headers: { "x-workflow-demo-user": "member" },
    data: { revision: 1, action: "approve" }
  })
  expect(denied.status()).toBe(403)
  const approval = await request.patch(`/api/admin/workflows/${id}`, {
    data: { revision: 1, action: "approve" }
  })
  expect(approval.ok()).toBeTruthy()
  const stale = await request.patch(`/api/admin/workflows/${id}`, {
    data: { revision: 1, action: "approve" }
  })
  expect(stale.status()).toBe(409)
  const csrf = await request.post("/api/admin/workflows", {
    headers: { Origin: "https://unrelated.example" },
    data: { action: "reset_demo" }
  })
  expect(csrf.status()).toBe(403)
  const slack = await request.post("/api/slack/expenses", {
    data: "payload=invalid"
  })
  expect(slack.status()).toBe(401)
  const auth = await request.get("/dashboard/admin/expenses", {
    maxRedirects: 0
  })
  expect(auth.status()).toBe(307)
})

test("media copy choice and supplied draft validation", async ({
  page,
  request
}) => {
  await page.goto("/workflow-preview/media")
  await page
    .getByRole("button", { name: "New media request", exact: true })
    .click()
  await page.getByLabel("Idea name", { exact: true }).fill("Educational email")
  await page.getByLabel("Team / project").fill("Education")
  await page
    .getByLabel("Idea / brief")
    .fill("Explain how members can join the research seminar.")
  await page
    .getByLabel("When does this need to be posted by?")
    .fill("2026-10-15")
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click()
  await expect(page.getByLabel("Draft copy", { exact: true })).toHaveValue("")
  await page.getByLabel("Draft copy", { exact: true }).selectOption("self")
  await expect(page.getByLabel("Body", { exact: true })).toHaveCount(0)
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click()
  expect(
    await page
      .getByLabel("Headline", { exact: true })
      .evaluate((input: HTMLInputElement) => input.validity.valueMissing)
  ).toBeTruthy()
  await page
    .getByLabel("Post caption", { exact: true })
    .fill("Join our research seminar")
  await expect(page.getByLabel("Headline", { exact: true })).not.toHaveAttribute("required")
  const extraNotes = "Please coordinate with the Education team.\nUse the IPN brand colors."
  await page
    .getByLabel("Additional details for the media team (optional)", { exact: true })
    .fill(extraNotes)
  await page.screenshot({
    path: "/tmp/ipn-workflow-media-form.png",
    fullPage: true
  })
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click()
  await expect(
    page.getByText("Join our research seminar", { exact: true })
  ).toBeVisible()
  await expect(page.getByText("Post caption", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Additional details for the media team", exact: true })).toBeVisible()
  await expect(page.getByText(extraNotes, { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Edit request", exact: true }).click()
  await expect(page.getByLabel("Post caption", { exact: true })).toHaveValue("Join our research seminar")
  await expect(page.getByLabel("Body", { exact: true })).toHaveCount(0)
  await expect(page.getByLabel("Additional details for the media team (optional)", { exact: true })).toHaveValue(extraNotes)
  await page.getByLabel("Additional details for the media team (optional)", { exact: true }).fill(extraNotes + "\nCheck the event invite before posting.")
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  await expect(page.getByText(extraNotes + "\nCheck the event invite before posting.", { exact: true })).toBeVisible()
  const bad = await request.post("/api/admin/workflows", {
    data: {
      id: randomUUID(),
      kind: "media",
      title: "Missing copy",
      media: {
        type: "announcement",
        team: "Media",
        brief: "Test",
        postedBy: "2026-10-10",
        needsCopyHelp: false
      }
    }
  })
  expect(bad.status()).toBe(400)
  await page.getByRole("button", { name: "Back to queue", exact: true }).click()
  await page
    .getByRole("button", { name: "Media calendar", exact: true })
    .click()
  await page.getByLabel("Calendar month").fill("2026-10")
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page
      .getByRole("region", { name: "Media calendar" })
      .getByRole("button", { name: /Deadline.*Educational email/ })
  ).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBeTruthy()
})

test("expense list columns, row opening, filters and mobile scrolling", async ({
  page,
  request
}) => {
  const pendingId = randomUUID(),
    paidId = randomUUID()
  for (const item of [
    {
      id: pendingId,
      title: "Workshop materials",
      purpose: "Materials for the leadership workshop",
      amount: "45.00"
    },
    {
      id: paidId,
      title: "Event printing",
      purpose: "Print materials for the member meetup",
      amount: "75.00"
    }
  ]) {
    const made = await request.post("/api/admin/workflows", {
      data: {
        id: item.id,
        kind: "expense",
        title: item.title,
        expense: { purpose: item.purpose, amountCents: item.amount }
      }
    })
    expect(made.ok()).toBeTruthy()
  }
  const approval = await request.patch(`/api/admin/workflows/${paidId}`, {
    data: { revision: 1, action: "approve" }
  })
  expect(approval.ok()).toBeTruthy()
  const paid = await request.patch(`/api/admin/workflows/${paidId}`, {
    data: {
      revision: 2,
      action: "purchase",
      paymentMethod: "ipn_card",
      actualAmountCents: "67.50",
      purchaseDate: new Date().toISOString().slice(0, 10),
      account: "Relay"
    }
  })
  expect(paid.ok()).toBeTruthy()
  await page.goto("/workflow-preview/expenses")
  const table = page.getByRole("table")
  await expect(table.getByRole("columnheader")).toHaveText([
    "Expense",
    "Purpose",
    "Submitter",
    "Submitted date",
    "Cost",
    "Status"
  ])
  const pendingRow = table.getByRole("row", { name: /Workshop materials/ })
  await expect(pendingRow).toContainText(
    "Materials for the leadership workshop"
  )
  await expect(pendingRow).toContainText("Justin Cornetta")
  await expect(pendingRow).toContainText("$45.00")
  await pendingRow
    .getByRole("cell", {
      name: "Materials for the leadership workshop",
      exact: true
    })
    .click()
  await expect(
    page.getByRole("heading", { name: "Workshop materials", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Back to queue", exact: true }).click()
  await table
    .getByRole("button", {
      name: "Open expense: Workshop materials",
      exact: true
    })
    .focus()
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("heading", { name: "Workshop materials", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Back to queue", exact: true }).click()
  await page.getByLabel("Search requests").fill("no matching entry")
  await expect(
    table.getByRole("button", { name: /Open expense:/ })
  ).toHaveCount(0)
  await page.getByLabel("Search requests").fill("")
  await page.getByLabel("Filter by status").selectOption("rejected")
  await expect(
    table.getByRole("button", { name: /Open expense:/ })
  ).toHaveCount(0)
  await page.getByLabel("Filter by status").selectOption("")
  await page
    .getByRole("button", { name: "Approved expenses", exact: true })
    .click()
  const paidRow = table.getByRole("row", { name: /Event printing/ })
  await expect(paidRow).toContainText("$67.50")
  await expect(paidRow).toContainText("Purchased")
  await expect(
    table.getByRole("row", { name: /Workshop materials/ })
  ).toHaveCount(0)
  await page.screenshot({
    path: "/tmp/ipn-workflow-expense-list.png",
    fullPage: true
  })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBeTruthy()
  const region = page.getByRole("region", {
    name: "Expense list",
    exact: true
  })
  expect(
    await region.evaluate(
      (element) => element.scrollWidth > element.clientWidth
    )
  ).toBeTruthy()
  await page.screenshot({
    path: "/tmp/ipn-workflow-expense-list-mobile.png",
    fullPage: true
  })
  await table
    .getByRole("button", { name: "Open expense: Event printing", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Event printing", exact: true })
  ).toBeVisible()
})

test("media list default deadline ordering, column sorting, search and row opening", async ({
  page,
  request
}) => {
  const ids = [randomUUID(), randomUUID(), randomUUID()]
  const entries = [
    {
      id: ids[0],
      title: "Alpha Seminar",
      type: "event",
      deadline: "2026-10-20",
      owner: "22222222-2222-4222-8222-222222222222"
    },
    {
      id: ids[1],
      title: "Beta Education",
      type: "educational",
      deadline: "2026-10-09",
      owner: "11111111-1111-4111-8111-111111111111"
    },
    {
      id: ids[2],
      title: "Zeta Campaign",
      type: "campaign",
      deadline: "2026-10-07",
      owner: ""
    }
  ]
  for (const entry of entries) {
    const headers =
      entry.type === "educational"
        ? { "x-workflow-demo-user": "member" }
        : undefined
    const made = await request.post("/api/admin/workflows", {
      headers,
      data: {
        id: entry.id,
        kind: "media",
        title: entry.title,
        media: {
          type: entry.type,
          team: "Media",
          brief: "Member communications",
          postedBy: entry.deadline,
          needsCopyHelp: true,
          urgent: entry.type === "campaign"
        }
      }
    })
    expect(made.ok()).toBeTruthy()
    if (entry.owner) {
      const assigned = await request.patch(`/api/admin/workflows/${entry.id}`, {
        data: {
          revision: 1,
          action: "production",
          ownerId: entry.owner,
          deliverables: []
        }
      })
      expect(assigned.ok()).toBeTruthy()
    }
  }
  const accepted = await request.patch(`/api/admin/workflows/${ids[1]}`, {
    data: { revision: 2, action: "status", status: "accepted" }
  })
  expect(accepted.ok()).toBeTruthy()
  await page.goto("/workflow-preview/media")
  const table = page.getByRole("table")
  const titles = table.getByRole("button", { name: /^Open media request:/ })
  await expect(table.getByRole("columnheader")).toHaveCount(7)
  await expect(page.getByLabel("Sort media by")).toHaveValue("deadline")
  await expect(
    table.getByRole("columnheader", { name: /Publish by date/ })
  ).toHaveAttribute("aria-sort", "ascending")
  await expect(titles).toHaveText([
    "Zeta Campaign",
    "Beta Education",
    "Alpha Seminar"
  ])
  await expect(table.getByRole("row", { name: /Alpha Seminar/ })).toContainText(
    "Agnes Horie"
  )
  await expect(table.getByRole("row", { name: /Zeta Campaign/ })).toContainText(
    "Urgent"
  )
  await table
    .getByRole("button", { name: "Sort by Publish by date", exact: true })
    .click()
  await expect(titles).toHaveText([
    "Alpha Seminar",
    "Beta Education",
    "Zeta Campaign"
  ])
  await expect(
    table.getByRole("columnheader", { name: /Publish by date/ })
  ).toHaveAttribute("aria-sort", "descending")
  await page.getByLabel("Sort media by").selectOption("title")
  await expect(titles).toHaveText([
    "Alpha Seminar",
    "Beta Education",
    "Zeta Campaign"
  ])
  await page
    .getByRole("button", { name: "Toggle media sort direction", exact: true })
    .click()
  await expect(titles).toHaveText([
    "Zeta Campaign",
    "Beta Education",
    "Alpha Seminar"
  ])
  await page.getByLabel("Sort media by").selectOption("type")
  await expect(titles).toHaveText([
    "Zeta Campaign",
    "Beta Education",
    "Alpha Seminar"
  ])
  await page.getByLabel("Sort media by").selectOption("submitter")
  await expect(titles.first()).toHaveText("Beta Education")
  await page.getByLabel("Sort media by").selectOption("submitted")
  await expect(titles.first()).toHaveText("Zeta Campaign")
  await page.getByLabel("Sort media by").selectOption("status")
  await expect(titles.first()).toHaveText("Beta Education")
  await page.getByLabel("Sort media by").selectOption("owner")
  await expect(titles).toHaveText([
    "Alpha Seminar",
    "Beta Education",
    "Zeta Campaign"
  ])
  await page.getByLabel("Search requests").fill("agnes")
  await expect(titles).toHaveText(["Alpha Seminar"])
  await page.getByLabel("Search requests").fill("educational")
  await expect(titles).toHaveText(["Beta Education"])
  await page.getByLabel("Search requests").fill("2026-10-09")
  await expect(titles).toHaveText(["Beta Education"])
  await page.getByLabel("Search requests").fill("")
  await page.getByLabel("Filter by status").selectOption("accepted")
  await expect(titles).toHaveText(["Beta Education"])
  await table
    .getByRole("cell", { name: "Educational content", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Beta Education", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Back to queue", exact: true }).click()
  await expect(page.getByLabel("Sort media by")).toHaveValue("owner")
  await page.getByLabel("Filter by status").selectOption("")
  await page.getByLabel("Sort media by").selectOption("deadline")
  await page.screenshot({
    path: "/tmp/ipn-workflow-media-list.png",
    fullPage: true
  })
  await titles.first().focus()
  await page.keyboard.press("Enter")
  await expect(
    page.getByRole("heading", { name: "Zeta Campaign", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Back to queue", exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBeTruthy()
  const list = page.getByRole("region", {
    name: "Media request list",
    exact: true
  })
  expect(
    await list.evaluate((element) => element.scrollWidth > element.clientWidth)
  ).toBeTruthy()
  await page.screenshot({
    path: "/tmp/ipn-workflow-media-list-mobile.png",
    fullPage: true
  })
})

test("submitted media sections retain content and omit duplicated event text", async ({ page, request }) => {
  const eventDetails = "Research seminar\nOctober 17, 2026 · 6 PM Eastern\nOnline\nMeet the IPN research team."
  const notes = "Please coordinate the announcement with Education."
  const id = randomUUID()
  const response = await request.post("/api/admin/workflows", {
    data: {
      id,
      kind: "media",
      title: "Research seminar media brief",
      media: {
        type: "event",
        team: "Education",
        brief: eventDetails,
        eventDetails,
        postedBy: "2026-10-17",
        platforms: ["Instagram", "Email"],
        formats: ["Carousel", "Email Campaign"],
        needsCopyHelp: false,
        headline: "Meet the research team",
        caption: "Join our seminar and bring your questions.",
        additionalDetails: notes,
        destinationUrl: "https://example.com/events/seminar",
        linkPlacement: "Instagram bio and email button",
        links: [{ label: "Source artwork", url: "https://www.canva.com/design/example/edit" }]
      }
    }
  })
  expect(response.ok()).toBeTruthy()
  await page.goto("/workflow-preview/media")
  await page.getByRole("button", { name: "Open media request: Research seminar media brief", exact: true }).click()
  for (const title of ["Request overview", "Brief and event details", "Draft copy", "Links and assets", "Additional details for the media team", "Production and publication", "Review and status"]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(1)
  }
  await expect(page.getByText(eventDetails, { exact: true })).toHaveCount(1)
  await expect(page.getByRole("region", { name: "Draft copy", exact: true })).toContainText("Join our seminar and bring your questions.")
  await expect(page.getByRole("region", { name: "Links and assets", exact: true }).getByRole("link", { name: "Source artwork 1", exact: true })).toHaveAttribute("href", "https://www.canva.com/design/example/edit")
  await expect(page.getByRole("region", { name: "Additional details for the media team", exact: true })).toContainText(notes)
  await page.setViewportSize({ width: 1440, height: 1800 })
  await page.getByRole("heading", { name: "Research seminar media brief", exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: "/tmp/ipn-workflow-media-sections.png", fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole("button", { name: "Edit request", exact: true }).click()
  await expect(page.getByLabel("Idea / brief", { exact: true })).toHaveValue(eventDetails)
  await expect(page.getByLabel("Event details", { exact: true })).toHaveValue(eventDetails)
  await page.getByLabel("Idea / brief", { exact: true }).fill("Invite new members to learn about IPN research.")
  await page.getByRole("button", { name: "Save changes", exact: true }).click()
  const brief = page.getByRole("region", { name: "Brief and event details", exact: true })
  await expect(brief).toContainText("Invite new members to learn about IPN research.")
  await expect(brief).toContainText("Meet the IPN research team.")
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole("heading", { name: "Request overview", exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: "/tmp/ipn-workflow-media-sections-mobile.png", fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
})

test("long media details scroll within the content pane and keep the sidebar full height", async ({
  page,
  request
}) => {
  const id = randomUUID()
  const made = await request.post("/api/admin/workflows", {
    data: {
      id,
      kind: "media",
      title: "Multi-platform campaign",
      media: {
        type: "campaign",
        team: "Media",
        brief: "Campaign context and reference notes.\n".repeat(60),
        postedBy: "2026-10-20",
        platforms: ["Instagram", "Email"],
        needsCopyHelp: true
      }
    }
  })
  expect(made.ok()).toBeTruthy()
  await page.goto("/workflow-preview/media")
  await page
    .getByRole("button", {
      name: "Open media request: Multi-platform campaign",
      exact: true
    })
    .click()
  const history = page
    .locator("details")
    .filter({ has: page.getByRole("heading", { name: /Activity history/ }) })
  await expect(history).not.toHaveAttribute("open")
  await expect(
    page.getByRole("button", { name: "Add content item", exact: true })
  ).toHaveCount(0)
  await expect(page.getByLabel("Final asset link (Drive / Canva)")).toHaveValue(
    ""
  )
  const content = page.getByRole("region", {
    name: "Workflow content",
    exact: true
  })
  expect(
    await content.evaluate(
      (element) => element.scrollHeight > element.clientHeight
    )
  ).toBeTruthy()
  await content.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight + 1
    )
  ).toBeTruthy()
  expect(
    await page.locator("aside").evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      return (
        Math.abs(bounds.top) < 1 &&
        Math.abs(bounds.bottom - window.innerHeight) < 1
      )
    })
  ).toBeTruthy()
  await history.locator("summary").click()
  await expect(page.getByLabel("Add a comment")).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBeTruthy()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight + 1
    )
  ).toBeTruthy()
})

test("six media stages, visible publication fields and confirmed deletion distinct from cancellation", async ({ page, request }) => {
  const created = await request.post("/api/admin/workflows", {
    data: { id: randomUUID(), kind: "media", title: "Media review example", media: {
      type: "announcement", team: "Media", brief: "Share the leadership announcement", postedBy: "2026-10-20", needsCopyHelp: true,
      destinationUrl: "https://example.test/event", linkPlacement: "Instagram bio"
    } }
  })
  const result = await created.json()
  expect(result.ok).toBeTruthy()
  const id = result.data.id
  await page.goto("/workflow-preview/media")
  await page.getByRole("button", { name: "Open media request: Media review example", exact: true }).click()
  const stage = page.getByLabel("Move request to")
  await expect(stage.locator("option")).toHaveText([
    "Submitted", "Accepted", "Assigned: In Progress", "Draft Complete: Pending Review", "Approved: Ready to Publish", "Published", "Needs information", "Cancelled"
  ])
  const review = page.getByRole("region", { name: "Review and status", exact: true })
  await expect(review.getByLabel("Published link")).toBeVisible()
  await expect(review.getByLabel("Actual posting date")).toBeVisible()
  await expect(page.getByText("Posting checklist", { exact: true })).toHaveCount(0)
  await stage.selectOption("cancelled")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(stage).toHaveValue("cancelled")
  await page.screenshot({ path: "/tmp/ipn-media-review-simplified.png", fullPage: true })
  page.once("dialog", (dialog) => dialog.dismiss())
  await page.getByRole("button", { name: "Delete request", exact: true }).click()
  await expect(page.getByRole("button", { name: "Delete request", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Back to queue", exact: true }).click()
  await expect(page.getByRole("button", { name: "Open media request: Media review example", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Open media request: Media review example", exact: true }).click()
  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: "Delete request", exact: true }).click()
  await expect(page.getByRole("button", { name: "Open media request: Media review example", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Delete request", exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole("button", { name: "Open media request: Media review example", exact: true })).toHaveCount(0)
  await page.getByRole("button", { name: "Media calendar", exact: true }).click()
  await page.getByLabel("Calendar month").fill("2026-10")
  await expect(page.getByRole("button", { name: /Media review example/ })).toHaveCount(0)
  const stale = await request.patch(`/api/admin/workflows/${id}`, { data: { action: "status", revision: result.data.revision, status: "accepted" } })
  expect(stale.status()).toBe(404)
})
