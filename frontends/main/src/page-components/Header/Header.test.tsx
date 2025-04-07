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
import { setMockResponse, urls, makeRequest } from "api/test-utils"

import { waitFor } from "@testing-library/react"

const oldWindowLocation = window.location

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (window as any).location

  window.location = Object.defineProperties({} as Location, {
    ...Object.getOwnPropertyDescriptors(oldWindowLocation),
    assign: {
      configurable: true,
      value: jest.fn(),
    },
  })
})

afterAll(() => {
  window.location = oldWindowLocation
})

describe("Header", () => {
  it("Includes a link to the Homepage", async () => {
    setMockResponse.get(urls.userMe.get(), { is_authenticated: true })
    renderWithProviders(<Header />)
    const header = screen.getByRole("banner")
    within(header).getAllByTitle("MIT Learn Homepage")
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

  const setup = async () => {
    setMockResponse.get(urls.userMe.get(), {
      is_learning_path_editor: true,
      is_authenticated: true,
      profile: { completed_onboarding: true },
    })
    setMockResponse.patch(urls.profileMe.patch(), () => ({}))
  }

  test.each([{}, { profile: null }, { profile: {} }])(
    "Trigger button shows UserIcon for authenticated users w/o initials",
    async (userSettings) => {
      setup()
      setMockResponse.get(urls.userMe.get(), {
        is_authenticated: true,
        ...userSettings,
      })

      renderWithProviders(<Header />)

      const trigger = await screen.findByRole("button", { name: "User Menu" })
      within(trigger).getByTestId("UserIcon")
    },
  )

  test("Trigger button shows name if available", async () => {
    setup()
    setMockResponse.get(urls.userMe.get(), {
      is_authenticated: true,
      profile: { name: "Alice Bee" },
    })

    renderWithProviders(<Header />)
    const trigger = await screen.findByRole("button", { name: "User Menu" })
    expect(trigger.textContent).toBe("Alice Bee")
  })

  test("Unauthenticated users see the Sign Up / Login link", async () => {
    setup()
    const isAuthenticated = false
    const initialUrl = "/foo/bar?cat=meow"
    const expectedUrl = urlConstants.login({
      pathname: "/foo/bar",
      searchParams: new URLSearchParams("?cat=meow"),
    })
    setMockResponse.get(urls.userMe.get(), {
      is_authenticated: isAuthenticated,
    })
    renderWithProviders(<Header />, {
      url: initialUrl,
    })
    const desktopLoginButton = await screen.findByTestId("login-button-desktop")
    const mobileLoginButton = await screen.findByTestId("login-button-mobile")
    invariant(desktopLoginButton instanceof HTMLAnchorElement)
    invariant(mobileLoginButton instanceof HTMLAnchorElement)
    expect(desktopLoginButton.href).toBe(expectedUrl)
    expect(mobileLoginButton.href).toBe(expectedUrl)

    // Check for real navigation; Login page needs a page reload
    await expectWindowNavigation(() => user.click(desktopLoginButton))
    await expectWindowNavigation(() => user.click(mobileLoginButton))
  })

  test("Authenticated users see the Log Out link", async () => {
    setup()
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
    setup()
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
    setup()
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
  test("Users who have not completed onboarding are redirected to onboarding flow", async () => {
    setup()

    setMockResponse.get(urls.userMe.get(), {
      is_authenticated: true,
      profile: { completed_onboarding: false },
    })

    renderWithProviders(<Header />, { url: "/some-page" })
    await findUserMenu()
    await waitFor(() => {
      expect(window.location.assign).toHaveBeenCalledWith(
        urlConstants.ONBOARDING,
      )
    })
  })

  test("Users who have completed onboarding are not redirected to the onboarding flow", async () => {
    setup()
    setMockResponse.get(urls.userMe.get(), {
      is_authenticated: true,
      profile: { completed_onboarding: true },
    })
    const pagePath = "/some-page"
    renderWithProviders(<Header />, { url: pagePath })
    await findUserMenu()
    expect(window.location.pathname).toBe(pagePath)
  })
  test("Sets 'completed_onboarding' on redirect", async () => {
    setup()
    setMockResponse.get(urls.userMe.get(), {
      is_authenticated: true,
      profile: { completed_onboarding: false },
    })

    renderWithProviders(<Header />)
    await findUserMenu()

    // Verify that "completed_onboarding" was set to true
    expect(makeRequest).toHaveBeenCalledWith("patch", urls.profileMe.patch(), {
      completed_onboarding: true,
    })
  })
})
