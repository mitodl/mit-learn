import {
  screen,
  setMockResponse,
  within,
  renderWithProviders,
} from "@/test-utils"
import { factories, urls } from "api/test-utils"
import DashboardLayout from "./DashboardLayout"

import React from "react"
import { DASHBOARD_HOME, MY_LISTS, PROFILE, SETTINGS } from "@/common/urls"
import { faker } from "@faker-js/faker/locale/en"

jest.mock("posthog-js/react")

describe("DashboardLayout", () => {
  type SetupOptions = {
    initialUrl?: string
  }
  const setup = ({ initialUrl = DASHBOARD_HOME }: SetupOptions = {}) => {
    const user = factories.user.user()

    setMockResponse.get(urls.userMe.get(), user)

    renderWithProviders(
      <DashboardLayout>
        <div data-testid="dashboard-panel" />
      </DashboardLayout>,
      { url: initialUrl },
    )

    return { user }
  }

  test("Renders user info", async () => {
    const { user } = setup()

    await screen.findByText(user.profile.name)
  })

  test("Renders the expected tab links and labels", async () => {
    const urls = [DASHBOARD_HOME, MY_LISTS, PROFILE, SETTINGS]
    const initialUrl = faker.helpers.arrayElement(urls)
    setup({ initialUrl })

    const labels = ["Home", "My Lists", "Profile", "Settings"]
    const desktopNav = await screen.findByTestId("desktop-nav")
    const mobileNav = await screen.findByTestId("mobile-nav")

    expect(desktopNav).toHaveRole("navigation")
    expect(mobileNav).toHaveRole("navigation")
    const desktopTabList = within(desktopNav).getByRole("tablist")
    const mobileTabList = within(mobileNav).getByRole("tablist")

    const desktopTabs = within(desktopTabList).getAllByRole("tab")
    const mobileTabs = within(mobileTabList).getAllByRole("tab")

    // Check URLs
    expect(desktopTabs.map((el) => el.getAttribute("href"))).toEqual(urls)
    expect(mobileTabs.map((el) => el.getAttribute("href"))).toEqual(urls)

    // Check labels
    expect(desktopTabs.map((el) => el.textContent)).toEqual(labels)
    expect(mobileTabs.map((el) => el.textContent)).toEqual(labels)
  })

  test("Active tab is set via url", async () => {
    const urls = [DASHBOARD_HOME, MY_LISTS, PROFILE, SETTINGS]
    const initialUrl = faker.helpers.arrayElement(urls)
    setup({ initialUrl })

    const desktopNav = await screen.findByTestId("desktop-nav")
    const mobileNav = await screen.findByTestId("mobile-nav")

    expect(
      within(desktopNav).getByRole("tab", { selected: true }),
    ).toHaveAttribute("href", initialUrl)

    expect(
      within(mobileNav).getByRole("tab", { selected: true }),
    ).toHaveAttribute("href", initialUrl)
  })
})
