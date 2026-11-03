import {expect, type Page} from "@playwright/test"

export async function completeRegistrationPreview(page: Page) {
  await expect(page.getByRole("heading", {name: "Create your account", exact: true})).toBeVisible()
  await expect(page.getByText("Your event RSVP is already confirmed. Creating an IPN account is optional.")).toBeVisible()
  await page.getByLabel("Password", {exact:true}).fill("sample-preview-only")
  await page.getByLabel("Confirm password", {exact:true}).fill("sample-preview-only")
  await page.getByRole("button", {name:"Next", exact:true}).click()
  await page.getByLabel("Country", {exact:true}).selectOption("United States")
  await page.getByLabel("City", {exact:true}).fill("Orlando")
  await page.getByLabel("What best describes you?", {exact:true}).selectOption("Professional in another field")
  await page.getByRole("button", {name:"Next", exact:true}).click()
  await page.getByRole("radio", {name:"Health & Medicine", exact:true}).check()
  await page.getByRole("radio", {name:"Yes — I currently work in the field", exact:true}).check()
  await page.getByRole("button", {name:"Next", exact:true}).click()
  await page.getByRole("radio", {name:"Social Media", exact:true}).check()
  await page.getByRole("button", {name:"Create account", exact:true}).click()
  await expect(page.getByRole("heading", {name:"Registration preview complete", exact:true})).toBeVisible()
  await expect(page.getByRole("status")).toContainText("No account was created and no email was sent.")
}
