import { check } from "k6"
import { browser, Page } from "k6/browser"
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.2.0/index.js"
import { BROWSER_CONTEXT_OPTIONS, FRONTEND_BASE_URL } from "../config.ts"

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

export async function testFrontend() {
  const page = await browser.newPage(BROWSER_CONTEXT_OPTIONS)

  try {
    await home(page)
    await search(page)
    await topics(page)
    await departments(page)
    await units(page)
  } finally {
    await page.close()
  }
}
