import React from "react"
import Header from "./Header"
import {
  renderWithProviders,
  screen,
  within,
  user,
  expectWindowNavigation,
} from "@/test-utils"
import invariant from "tiny-invariant"
import * as urlConstants from "@/common/urls"
import { setMockResponse, urls } from "api/test-utils"

describe("Header", () => {
  it("Includes a link to the Homepage for anonymous user", async () => {
    setMockResponse.get(urls.userMe.get(), { is_authenticated: false })
    renderWithProviders(<Header />)
    const header = screen.getByRole("banner")
    const links = within(header).getAllByRole("link", {
      name: "MIT Learn Homepage",
    })
    links.forEach((link) => {
      expect(link).toHaveAttribute("href", "/")
    })
  })

  it("Includes a link to the Homepage for authenticated user", async () => {
    setMockResponse.get(urls.userMe.get(), { is_authenticated: true })
    renderWithProviders(<Header />)
    const header = screen.getByRole("banner")
    const links = await within(header).findAllByRole("link", {
      name: "MIT Learn Homepage",
    })
    links.forEach((link) => {
      expect(link).toHaveAttribute("href", "/")
    })
  })
})

describe("UserMenu", () => {
  /**
   * Opens the user menu and returns the HTML element for the menu (contains
   * child `menuitem`s.)
   */
  const findUserMenu = async () => {
    const trigger = await screen.findByRole("button", { name: "User Menu" })
    await user.click(trigger)
    return screen.findByRole("menu")
  }

  test.each([{}, { profile: null }, { profile: {} }])(
    "Trigger button shows icons only for authenticated users w/o a name",
    async (userSettings) => {
      setMockResponse.get(urls.userMe.get(), {
        is_authenticated: true,
        ...userSettings,
      })

      renderWithProviders(<Header />)

      const trigger = await screen.findByRole("button", { name: "User Menu" })
      expect(trigger.textContent).toBe("")
      // The account icon and the chevron, which is all there is without a name.
      expect(trigger.querySelectorAll("svg.remixicon")).toHaveLength(2)
    },
  )

  test("Trigger button shows name if available", async () => {
    setMockResponse.get(urls.userMe.get(), {
      is_authenticated: true,
      profile: { name: "Alice Bee" },
    })

    renderWithProviders(<Header />)
    const trigger = await screen.findByRole("button", { name: "User Menu" })
    expect(trigger.textContent).toBe("Alice Bee")
  })

  test("Unauthenticated users see the Sign Up / Login link", async () => {
    const isAuthenticated = false
    const initialUrl = "/foo/bar?cat=meow"
    const expectedUrl = urlConstants.auth({
      next: {
        pathname: urlConstants.DASHBOARD_HOME,
        searchParams: null,
      },
    })
    setMockResponse.get(urls.userMe.get(), {
      is_authenticated: isAuthenticated,
    })
    renderWithProviders(<Header />, {
      url: initialUrl,
    })
    /**
     * The desktop button is labelled by its visible text and the mobile one by
     * its aria-label, which differ only in case. Role queries are exact, so
     * this is enough to tell them apart.
     */
    const desktopLoginButton = await screen.findByRole("link", {
      name: "Log In",
    })
    const mobileLoginButton = await screen.findByRole("link", {
      name: "Log in",
    })
    invariant(desktopLoginButton instanceof HTMLAnchorElement)
    invariant(mobileLoginButton instanceof HTMLAnchorElement)
    expect(desktopLoginButton.href).toBe(expectedUrl)
    expect(mobileLoginButton.href).toBe(expectedUrl)

    // Check for real navigation; Login page needs a page reload
    await expectWindowNavigation(() => user.click(desktopLoginButton))
    await expectWindowNavigation(() => user.click(mobileLoginButton))
  })

  test.each([
    { url: "/foo/bar", expectDashboardLink: true },
    { url: "/dashboard/my-lists", expectDashboardLink: false },
  ])(
    "Dashboard button is shown off the dashboard only (url=$url)",
    async ({ url, expectDashboardLink }) => {
      setMockResponse.get(urls.userMe.get(), { is_authenticated: true })
      renderWithProviders(<Header />, { url })

      await screen.findByRole("button", { name: "User Menu" })
      const link = screen.queryByRole("link", { name: "Dashboard" })
      if (expectDashboardLink) {
        expect(link).toHaveAttribute("href", urlConstants.DASHBOARD_HOME)
      } else {
        expect(link).toBe(null)
      }
    },
  )

  test("Authenticated users see the Log Out link", async () => {
    const isAuthenticated = true
    const initialUrl = "/foo/bar?cat=meow"
    const expected = { text: "Log Out", url: urlConstants.LOGOUT }
    setMockResponse.get(urls.userMe.get(), {
      is_authenticated: isAuthenticated,
    })
    renderWithProviders(<Header />, {
      url: initialUrl,
    })
    const menu = await findUserMenu()
    const authLink = within(menu).getByRole("menuitem", {
      name: expected.text,
    })

    invariant(authLink instanceof HTMLAnchorElement)
    expect(authLink.href).toBe(expected.url)

    // Check for real navigation; Login page needs a page reload
    await expectWindowNavigation(() => user.click(authLink))
  })

  test("Learning path editors see 'Learning Paths' link", async () => {
    setMockResponse.get(urls.userMe.get(), {
      is_learning_path_editor: true,
      is_authenticated: true,
    })
    renderWithProviders(<Header />)
    const menu = await findUserMenu()
    const link = within(menu).getByRole("menuitem", {
      name: "Learning Paths",
    })
    expect(link).toHaveAttribute("href", "/learningpaths")
  })

  test("Users WITHOUT LearningPathEditor permission do not see 'Learning Paths' link", async () => {
    setMockResponse.get(urls.userMe.get(), {
      is_learning_path_editor: false,
      is_authenticated: true,
    })
    renderWithProviders(<Header />)
    const menu = await findUserMenu()
    const link = within(menu).queryByRole("menuitem", {
      name: "Learning Paths",
    })
    expect(link).toBe(null)
  })

  test("Article editors see 'Article' and 'News' links in the user menu", async () => {
    setMockResponse.get(urls.userMe.get(), {
      is_authenticated: true,
      is_article_editor: true,
    })
    renderWithProviders(<Header />)
    const menu = await findUserMenu()

    const articleLink = within(menu).getByRole("menuitem", { name: "Article" })
    expect(articleLink).toHaveAttribute("href", "/website_content/article/new")

    const newsLink = within(menu).getByRole("menuitem", { name: "News" })
    expect(newsLink).toHaveAttribute("href", "/website_content/news/new")
  })

  test("Users WITHOUT ArticleEditor permission do not see 'Article' or 'News' links", async () => {
    setMockResponse.get(urls.userMe.get(), {
      is_authenticated: true,
      is_article_editor: false,
    })
    renderWithProviders(<Header />)
    const menu = await findUserMenu()

    expect(within(menu).queryByRole("menuitem", { name: "Article" })).toBe(null)
    expect(within(menu).queryByRole("menuitem", { name: "News" })).toBe(null)
  })
})
