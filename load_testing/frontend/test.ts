import { check } from "k6"
import { browser, Page } from "k6/browser"
import {
  randomIntBetween,
  randomItem,
} from "https://jslib.k6.io/k6-utils/1.2.0/index.js"
import {
  BROWSER_CONTEXT_OPTIONS,
  FRONTEND_BASE_URL,
  SSO_BASE_URL,
} from "../config.ts"
import { AuthCredential, credentials } from "../auth.ts"
import { escapeRegex } from "../utils.ts"

type Context = {
  loggedIn: boolean
  credential: AuthCredential | null
}

async function home(page: Page, context: Context) {
  await page.goto(FRONTEND_BASE_URL)

  const carousel = await page.getByTestId("resource-carousel")
  const articlesCount = await carousel.locator("article").count()
  await check(carousel, {
    "home page carousel has 12 items": () => articlesCount === 12,
  })

  await carousel
    .locator("article")
    .nth(randomIntBetween(0, articlesCount - 1))
    .click()
}

async function search(page: Page, context: Context) {
  await page.goto(`${FRONTEND_BASE_URL}/search?sortby=-views`)
  await page.goto(`${FRONTEND_BASE_URL}/search?resource_type_group=program`)
  await page.goto(
    `${FRONTEND_BASE_URL}/search?resource_type_group=learning_material`,
  )
}

async function topics(page: Page, context: Context) {
  await page.goto(`${FRONTEND_BASE_URL}/topics`)
}

async function departments(page: Page, context: Context) {
  await page.goto(`${FRONTEND_BASE_URL}/departments`)
}

async function units(page: Page, context: Context) {
  await page.goto(`${FRONTEND_BASE_URL}/units`)
}

async function login(page: Page, context: Context) {
  const credential: AuthCredential = randomItem(credentials)

  if (credential == null) {
    console.log("Login > skipping because no credentials provided")
  }
  if (page.url() == "about:blank") {
    await page.goto(FRONTEND_BASE_URL)
  }

  console.log(`Login > using '${credential.email}'`)

  const loginButton = page.getByTestId("login-button-desktop")
  await loginButton.first().click()

  await loginKeycloak(page, credential, context)

  await page.waitForURL(/.*\/dashboard.*/)

  console.log("Login > reached dashboard")
}

const ESCAPED_SSO_URL = escapeRegex(SSO_BASE_URL)

const KEYCLOAK_USERNAME_URL_RE = new RegExp(
  `${ESCAPED_SSO_URL}\/realms\/[a-z\-]+\/protocol\/openid-connect\/auth.*`,
)
const KEYCLOAK_PASSWORD_URL_RE = new RegExp(
  `${ESCAPED_SSO_URL}\/realms\/[a-z\-]+\/login-actions\/authenticate.*`,
)

async function loginKeycloak(
  page: Page,
  credential: AuthCredential,
  context: Context,
) {
  await page.waitForURL(KEYCLOAK_USERNAME_URL_RE, {
    waitUntil: "load",
  })

  console.log("Login > Keycloak > on login email page")

  const credentialnameInput = await page.locator("input[name=username]")
  console.log("Login > Keycloak > found username input")
  await credentialnameInput.focus()
  await credentialnameInput.fill(credential.email)
  console.log("Login > Keycloak > entered email address")

  await page.locator("button[type=submit]").click()
  console.log("Login > Keycloak > submitting email address")

  await page.waitForNavigation(KEYCLOAK_PASSWORD_URL_RE)
  console.log("Login > Keycloak > on login password page")

  const passwordInput = await page.locator("input[name=password]")
  console.log("Login > Keycloak > found password input")
  await passwordInput.focus()
  await passwordInput.fill(credential.password, {
    force: true,
  })
  await page.locator("button[type=submit]").click()
  console.log("Login > Keycloak > submitting password")
  await page.waitForNavigation()

  context.loggedIn = true
  context.credential = credential
}

async function dashboard(page: Page, context: Context) {
  if (!context.loggedIn) {
    return
  }
  await page.goto(`${FRONTEND_BASE_URL}/dashboard`)
}

export async function testFrontend() {
  const page = await browser.newPage(BROWSER_CONTEXT_OPTIONS)
  const context: Context = {
    loggedIn: false,
    credential: null,
  }

  try {
    // always home page first
    await home(page, context)
    await search(page, context)
    await topics(page, context)
    await departments(page, context)
    await units(page, context)
    await login(page, context)
    await dashboard(page, context)
    await search(page, context)
    await topics(page, context)
    await departments(page, context)
    await units(page, context)
    await home(page, context)
  } finally {
    await page.close()
  }
}
