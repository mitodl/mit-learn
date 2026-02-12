/* eslint-disable import/no-extraneous-dependencies,import/no-duplicates,import/no-restricted-paths */
import { test, expect } from "@playwright/test"
const LOCAL_DEFAULT = "http://nginx:8063"
const RC_DEFAULT = "https://rc.learn.mit.edu"
const KNOWN_BASE_URLS = [LOCAL_DEFAULT, RC_DEFAULT]

// The behavior of non-dev and dev keycloak login appears to differ significantly
// Locally, you get a single screen login with a username and password
// On RC/Prod, you get a multi-screen login where you enter your email first, then your password
export const login = async (page: Page, email: string, password: string) => {
  await page.goto("/")
  await page.getByText("Log In").click()
  await page.getByLabel("Email").fill(email)
  await page.getByRole("Button", { name: "Next" }).click()
  await page.getByLabel("Password", { exact: true }).fill(password)
  await page.getByRole("Button", { name: "Next" }).click()
}

export const localLogin = async (
  page: Page,
  email: string,
  password: string,
) => {
  await page.goto("/")
  await page.getByText("Log In").click()
  await page.getByLabel("Email").fill(email)
  const passwordElement = await page.getByLabel("Password", { exact: true })
  if ((await passwordElement.count()) > 0) {
    await passwordElement.fill(password)
    await page.getByRole("Button", { name: "Sign In" }).click()
    return
  }
}

test.describe("Smoke Test - Homepage", () => {
  test("should load the homepage successfully", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("main")).toBeVisible()
    await expect(page).toHaveTitle("Learn with MIT | MIT Learn")
  })
})

/*
For now, we're going to parameterize the test values we're going to assert
Longer term, we probably want to use the same test data generation process in RC, meaning we won't as much different data
If we keep this, we probably want to load this from a file or come up w/ a less annoying fixture setup
*/
const programPageB2CTestInfo = {
  [RC_DEFAULT]: {
    url: "/programs/program-v1:MITx+CTL.SCM",
    title: "Supply Chain Management",
    description:
      "Gain expertise in the growing field of Supply Chain Management through an innovative online program consisting of five courses and a final capstone exam.",
    courseCount: 6,
    email: "daniel.subak+test@gmail.com",
    password: "testpassword",
    loginFunc: login,
    certificateSelectionText: "",
  },
  [LOCAL_DEFAULT]: {
    url: "/programs/program-v1:PLACEHOLDER+PROGRAM",
    title: "PLACEHOLDER - Data, Economics and Development Policy",
    description:
      "PLACEHOLDER - In this engineering program, we will explore the processing and structure of cellular solids as they are created from polymers, metals, ceramics, glasses and composites.",
    courseCount: 1,
    email: "admin@odl.local",
    password: "admin",
    loginFunc: localLogin,
    certificateSelectionText:
      "PLACEHOLDER - Demonstration Course in Program (Elective) - COURSE_IN_PROGRAM_ELECTIVE",
  },
}

const coursePageB2CTestInfo = {
  [RC_DEFAULT]: {
    url: "/courses/course-v1:MITxT+14.740x",
    title: "Foundations of Development Policy",
    description:
      "This course is part of the MITx MicroMasters program in Data, Economics, and Development Policy (DEDP).",
    certPrice: "Certificate Track: $1,000.00",
    loginFunc: login,
    email: "daniel.subak+test@gmail.com",
    password: "testpassword",
  },
  [LOCAL_DEFAULT]: {
    url: "/courses/course-v1:PLACEHOLDER+COURSE_IN_PROGRAM_ELECTIVE",
    title: "PLACEHOLDER - Demonstration Course in Program (Elective)",
    description:
      "PLACEHOLDER - In this engineering course, we will explore the processing and structure of cellular solids as they are created from polymers, metals, ceramics, glasses and composites.",
    certPrice: "Certificate Track: $999.00",
    email: "admin@odl.local",
    password: "admin",
    loginFunc: localLogin,
  },
}

async function getProgramPageB2CTestInfo(baseUrl) {
  let urlToLookup = baseUrl
  if (!KNOWN_BASE_URLS.includes(baseUrl)) {
    urlToLookup = LOCAL_DEFAULT
  }
  return programPageB2CTestInfo[urlToLookup]
}

async function getCoursePageB2CTestInfo(baseUrl) {
  let urlToLookup = baseUrl
  if (!KNOWN_BASE_URLS.includes(baseUrl)) {
    urlToLookup = LOCAL_DEFAULT
  }
  return coursePageB2CTestInfo[urlToLookup]
}

test.describe("Smoke Test - Program Page B2C Logged In", () => {
  test("should load the page successfully", async ({ page }, testInfo) => {
    // Log in, visit a program page, add a certificate to a cart and assert that we're redirected to a checkout page.

    const {
      url,
      title,
      description,
      courseCount,
      email,
      password,
      loginFunc,
      certificateSelectionText,
    } = await getProgramPageB2CTestInfo(testInfo.project.use.baseURL)
    await loginFunc(page, email, password)
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

    // Open the enrollment modal, select a certificate track, assert it redirects us to a checkout page
    await page.getByText("Enroll for Free").click()
    await page.getByText("Please Select").click()
    if (certificateSelectionText) {
      await page.getByText(certificateSelectionText).click()
      await page.getByRole("button", { name: "Add to Cart" }).click()
      await page.waitForURL("**/cart/")
    }
  })
})

test.describe("Smoke Test - Course Page B2C Logged In", () => {
  test("should load the page successfully", async ({ page }, testInfo) => {
    // Log in, visit a course page, assert it's correctly set up.
    const { url, title, description, certPrice, loginFunc, email, password } =
      await getCoursePageB2CTestInfo(testInfo.project.use.baseURL)
    await loginFunc(page, email, password)
    await page.goto(url)

    await expect(page.locator("main")).toBeVisible()

    // Find the program title
    await expect(page.locator("h1")).toHaveText(title)
    const about = page.locator("#about")
    await expect(about).toBeVisible()
    // Find the program description
    await expect(about.locator("//following-sibling::*[1]")).toContainText(
      description,
    )

    // Assert that it is enrollable
    await expect(
      page.getByRole("button", { name: "Enroll for Free" }),
    ).toBeVisible({ timeout: 30_000 })

    await expect(page.getByText(certPrice)).toBeVisible()

    await expect(page.getByText("Part of the following program")).toBeVisible()

    // Open the enrollment modal
    await page.getByText("Enroll for Free").click()
  })
})
