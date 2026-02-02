/* eslint-disable import/no-extraneous-dependencies,import/no-duplicates,import/no-restricted-paths */
import { test, expect } from "@playwright/test"

test.describe("Smoke Test - Homepage", () => {
  test("should load the homepage successfully", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("main")).toBeVisible()
  })

  test("should have correct page title", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/.+/)
  })
})

test.describe("Smoke Test - Program Page B2C", () => {
  // TODO: This will need an update once we have a consistent B2C program to put onto CI/RC/Prod
  test("should load the page successfully", async ({ page }) => {
    // We can remove this once https://github.com/mitodl/mit-learn/pull/2906 lands
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
