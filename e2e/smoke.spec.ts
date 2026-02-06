/* eslint-disable import/no-extraneous-dependencies,import/no-duplicates,import/no-restricted-paths */
import { test, expect } from "@playwright/test"
const LOCAL_DEFAULT = "http://nginx:8063"
const RC_DEFAULT = "http://rc.learn.mit.edu"
const KNOWN_BASE_URLS = [LOCAL_DEFAULT, RC_DEFAULT]

test.describe("Smoke Test - Homepage", () => {
  test("should load the homepage successfully", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("main")).toBeVisible()
    await expect(page).toHaveTitle("Learn with MIT | MIT Learn")
  })
})

const programPageB2CTestInfo = {
  [RC_DEFAULT]: {
    url: "/programs/program-v1:MITx+CTL.SCM",
    title: "Supply Chain Management",
    description:
      "Gain expertise in the growing field of Supply Chain Management through an innovative online program consisting of five courses and a final capstone exam.",
    courseCount: 6,
  },
  [LOCAL_DEFAULT]: {
    url: "/programs/program-v1:PLACEHOLDER+PROGRAM",
    title: "PLACEHOLDER - Data, Economics and Development Policy",
    description:
      "PLACEHOLDER - In this engineering program, we will explore the processing and structure of cellular solids as they are created from polymers, metals, ceramics, glasses and composites.",
    courseCount: 2,
  },
}

async function getProgramPageB2CTestInfo(baseUrl) {
  let urlToLookup = baseUrl
  if (!KNOWN_BASE_URLS.includes(baseUrl)) {
    urlToLookup = LOCAL_DEFAULT
  }
  return programPageB2CTestInfo[urlToLookup]
}

test.describe("Smoke Test - Program Page B2C", () => {
  test("should load the page successfully", async ({ page }, testInfo) => {
    const { url, title, description, courseCount } =
      await getProgramPageB2CTestInfo(testInfo.config.projects[0].use.baseURL)
    await page.goto(url)

    // This will only pass on RC as written.
    await expect(page.locator("main")).toBeVisible()

    // Find the program title
    await expect(page.locator("h1")).toHaveText(title)
    const about = page.locator("#about")
    await expect(about).toBeVisible()
    // Find the program description
    await expect(about.locator("//following-sibling::*[1]")).toContainText(
      description,
    )
    // Assert that we have multiple courses
    const coursesHeader = page.locator("#required-courses")
    await expect(coursesHeader).toBeVisible()
    // This should be an unordered list containing multiple courses
    const requiredCourses = coursesHeader.locator("//following-sibling::*[1]")
    await expect(requiredCourses.locator("li")).toHaveCount(courseCount)
    // Assert that it is enrollable
    await expect(
      page.getByRole("button", { name: "Enroll for Free" }),
    ).toBeVisible({ timeout: 30_000 })
    // Certificate Track label only exists if there's a price afaict
    // Should we have a stronger assertion? The value comes from the CMS, so it can change underneath us.
    await expect(page.getByText("Certificate Track")).toBeVisible()
  })
})
