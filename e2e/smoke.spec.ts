/* eslint-disable import/no-extraneous-dependencies,import/no-duplicates,import/no-restricted-paths */
import { test, expect } from "@playwright/test"

test.describe("Smoke Test - Homepage", () => {
  test("should load the homepage successfully", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("main")).toBeVisible()
    await expect(page).toHaveTitle("Learn with MIT | MIT Learn")
  })
})

test.describe("Smoke Test - Program Page B2C", () => {
  test("should load the page successfully", async ({ page }) => {
    // TODO: This will need to be parameterized based on expected for its environment
    await page.goto("/programs/program-v1:MITx+CTL.SCM")

    // This will only pass on RC as written.
    await expect(page.locator("main")).toBeVisible()

    // Find the program title
    await expect(page.locator("h1")).toHaveText("Supply Chain Management")
    const about = page.locator("#about")
    await expect(about).toBeVisible()
    // Find the program description
    await expect(about.locator("//following-sibling::*[1]")).toContainText(
      "Gain expertise in the growing field of Supply Chain Management through an innovative online program consisting of five courses and a final capstone exam.",
    )
  })
})
