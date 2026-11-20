import { expect, test, type Locator } from "@playwright/test"
import { mkdir } from "node:fs/promises"

async function expectReachable(link: Locator) {
  await link.page().evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))) })
  await link.scrollIntoViewIfNeeded()
  // Playwright's visibility check alone passes for links clipped by an ancestor.
  expect(await link.evaluate(element => {
    const rect = element.getBoundingClientRect()
    for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect()
      if (["hidden", "clip", "auto", "scroll"].includes(style.overflowX)
        && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) return false
      if (["hidden", "clip", "auto", "scroll"].includes(style.overflowY)
        && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)) return false
    }
    return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
  })).toBe(true)
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()) })
  Object.assign(page, { onboardingErrors: errors })
})
test.afterEach(async ({ page }) => {
  expect((page as typeof page & { onboardingErrors: string[] }).onboardingErrors).toEqual([])
  await expect(page.locator("nextjs-portal").getByText("Runtime Error", { exact: false })).toHaveCount(0)
})

for (const [width, height] of [[1440, 1080], [1440, 900], [1280, 800], [1024, 768], [800, 600], [761, 600], [760, 600], [390, 844], [320, 568]]) {
  for (const editorial of [true, false]) {
    test(`all channels can continue at ${width}x${height}, editorial=${editorial}`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await page.goto(`/onboarding/whatsapp${editorial ? "?motion=editorial" : ""}`)
      await page.evaluate(() => document.fonts.ready)
      for (const name of ["General", "Labs Events", "Conferences"]) {
        await page.getByRole("radio", { name: new RegExp(name) }).click()
        if (width > 760) await expect(page.getByRole("img", { name: new RegExp(`QR code for the IPN ${name}`) })).toBeVisible()
        const link = page.getByRole("link", { name: "Continue to member portal" })
        await expectReachable(link)
        await link.click({ trial: true })
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (editorial) {
        await mkdir("docs/signup-whatsapp/screenshots", { recursive: true })
        await page.screenshot({ path: `docs/signup-whatsapp/screenshots/after-${width}x${height}.png`, fullPage: true, animations: "disabled" })
      }
      await page.getByRole("link", { name: "Continue to member portal" }).click()
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(page.getByRole("heading", { name: "Member portal QA destination" })).toBeVisible()
    })
  }
}

test("QR failure and blocked popup keep the portal link reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1080 })
  await page.route("**/api/whatsapp/handoffs/**", route => route.fulfill({ json: { error: "QA unavailable" } }))
  await page.goto("/onboarding/whatsapp?motion=editorial")
  await expect(page.getByText("The QR code could not be loaded.")).toBeVisible()
  await page.evaluate(() => { window.open = () => null })
  await expectReachable(page.getByRole("link", { name: /Join General channel/ }))
  await page.getByRole("link", { name: /Join General channel/ }).click()
  await expect(page.getByText("Allow new tabs for this site, then try again.").filter({ visible: true })).toBeVisible()
  await expectReachable(page.getByRole("link", { name: "Continue to member portal" }))
  await page.screenshot({ path: "docs/signup-whatsapp/screenshots/after-errors.png", fullPage: true, animations: "disabled" })
  await page.getByRole("link", { name: "Continue to member portal" }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
})

test("welcome, keyboard channel switching and same-device joining preserve continuation", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto("/onboarding/welcome?motion=editorial")
  await page.getByRole("link", { name: "Continue", exact: false }).click()
  await expect(page).toHaveURL(/\/onboarding\/whatsapp\?motion=editorial$/)
  await page.getByRole("radio", { name: /General/ }).focus()
  await page.keyboard.press("ArrowDown")
  await expect(page.getByRole("radio", { name: "Labs Events" })).toBeFocused()
  const popupPromise = context.waitForEvent("page")
  await page.getByRole("link", { name: /Join Labs Events channel/ }).click()
  const popup = await popupPromise
  await expect(popup.getByRole("heading", { name: "Local channel handoff" })).toBeVisible()
  await popup.close()
  const link = page.getByRole("link", { name: "Continue to member portal" })
  await expectReachable(link)
  await link.focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/dashboard$/)
})
