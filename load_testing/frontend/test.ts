import { check } from "k6"
import { browser, Page } from "k6/browser"
import {
  randomIntBetween,
  randomItem,
} from "https://jslib.k6.io/k6-utils/1.2.0/index.js"
import { BROWSER_CONTEXT_OPTIONS, FRONTEND_BASE_URL } from "../config.ts"
import { AuthCredential, credentials } from "../auth.ts"

async function home(page: Page) {
  await page.goto(FRONTEND_BASE_URL)

  const carousel = await page.getByTestId("resource-carousel")
  const articlesCount = await carousel.locator("article").count()
  await check(carousel, {
    "has 12 items": () => articlesCount === 12,
  })

  await carousel
    .locator("article")
    .nth(randomIntBetween(0, articlesCount - 1))
    .click()
}

async function search(page: Page) {
  await page.goto(`${FRONTEND_BASE_URL}/search?sortby=-views`)
  await page.goto(`${FRONTEND_BASE_URL}/search?resource_type_group=program`)
  await page.goto(
    `${FRONTEND_BASE_URL}/search?resource_type_group=learning_material`,
  )
}

async function topics(page: Page) {
  await page.goto(`${FRONTEND_BASE_URL}/topics`)
}

async function departments(page: Page) {
  await page.goto(`${FRONTEND_BASE_URL}/departments`)
}

async function units(page: Page) {
  await page.goto(`${FRONTEND_BASE_URL}/units`)
}

async function login(page: Page) {
  const credential: AuthCredential = randomItem(credentials)

  if (!!credential) {
    log.debug("Skipping login because no credentials provided")
    return
  }

  const loginButton = page.getByTestId("login-button-desktop")
  await loginButton.first().click()

  await loginKeycloak(page)

  await page.waitForURL(/.*\/dashboard.*/)
}

async function loginKeycloak(page: Page, credential: AuthCredential) {
  await page.waitForURL(
    /https:\/sso(\-qa)?\.ol\.mit\.edu\/realms\/olapps\/protocol\/openid-connect\/auth.*/,
  )

  const credentialnameInput = await page.locator("input#username")
  await credentialnameInput.type(user.email)
  await page.locator("button#kc-login").click()

  const passwordInput = await page.locator("input#password")
  await passwordInput.type(credential.password)
  await page.locator("button#kc-login").click()
}

export async function testFrontend() {
  const page = await browser.newPage(BROWSER_CONTEXT_OPTIONS)

  try {
    // always home page first
    await home(page)
    await search(page)
    await topics(page)
    await departments(page)
    await units(page)
    await login(page)
  } finally {
    await page.close()
  }
}
