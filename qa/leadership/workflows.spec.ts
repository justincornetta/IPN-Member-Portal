import { test, expect, type Page } from "@playwright/test"
import { randomUUID } from "node:crypto"
const errors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page, request }) => {
  await request.post("/api/admin/workflows", { data: { action: "reset_demo" } })
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
  await page.getByLabel("Cost (USD)").fill("40.00")
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
test("general media request, shared assignment, review and posted deliverable", async ({
  page
}) => {
  await page.goto("/workflow-preview/media")
  const previewNav = page.getByRole("navigation", { name: "Preview admin navigation" })
  await expect(previewNav.getByText("Analytics", { exact: true })).toHaveAttribute("aria-disabled", "true")
  await expect(previewNav.getByText("Content", { exact: true })).toHaveAttribute("aria-disabled", "true")
  await expect(page.locator('a[href^="/dashboard"], a[href^="/login"]')).toHaveCount(0)
  await previewNav.getByRole("link", { name: "Expense Submissions", exact: true }).click()
  await expect(page).toHaveURL(/\/workflow-preview\/expenses$/)
  await previewNav.getByRole("link", { name: "Media Requests", exact: true }).click()
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
  await page
    .getByRole("button", { name: "Submit request", exact: true })
    .click()
  await page.getByLabel("Move request to").selectOption("accepted")
  await page.getByRole("button", { name: "Update status", exact: true }).click()
  await page
    .getByLabel("Production owner", { exact: true })
    .selectOption({ label: "Alex Morgan" })
  await page
    .getByLabel("Publishing owner", { exact: true })
    .selectOption({ label: "Agnes Horie" })
  await page
    .getByRole("button", { name: "Add deliverable", exact: true })
    .click()
  await page.getByLabel("Deliverable name").fill("Instagram announcement")
  await page.getByLabel("Platform", { exact: true }).fill("Instagram")
  await page
    .getByLabel("Final asset link (Drive / Canva)")
    .fill("https://www.canva.com/design/example/edit")
  await page.getByLabel("Deliverable status").selectOption("ready")
  await page
    .getByRole("button", { name: "Save production", exact: true })
    .click()
  for (const status of [
    "assigned",
    "in_production",
    "director_review",
    "ready_to_post"
  ]) {
    await page.getByLabel("Move request to").selectOption(status)
    await page
      .getByRole("button", { name: "Update status", exact: true })
      .click()
    await expect(page.getByLabel("Move request to")).toBeVisible()
  }
  await page.getByLabel("Deliverable status").selectOption("posted")
  await page
    .getByLabel("Published link")
    .fill("https://www.instagram.com/p/example/")
  await page
    .getByLabel("Actual posting date")
    .fill(new Date().toISOString().slice(0, 10))
  await page
    .getByRole("button", { name: "Save production", exact: true })
    .click()
  await page.getByLabel("Move request to").selectOption("posted")
  await page.getByRole("button", { name: "Update status", exact: true }).click()
  await expect(page.getByText("Posted", { exact: true }).first()).toBeVisible()
  await page.screenshot({ path: "/tmp/ipn-workflow-media.png", fullPage: true })
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
