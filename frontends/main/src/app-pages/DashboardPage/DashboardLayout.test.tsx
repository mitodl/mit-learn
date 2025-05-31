import {
  screen,
  setMockResponse,
  within,
  renderWithProviders,
} from "@/test-utils"
import { factories, urls } from "api/test-utils"
import {
  factories as mitxOnlineFactories,
  urls as mitxOnlineUrls,
} from "api/mitxonline-test-utils"
import DashboardLayout from "./DashboardLayout"

import React from "react"
import {
  DASHBOARD_HOME,
  MY_LISTS,
  organizationView,
  PROFILE,
  SETTINGS,
} from "@/common/urls"
import { faker } from "@faker-js/faker/locale/en"
import invariant from "tiny-invariant"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { OrganizationPage } from "@mitodl/mitxonline-api-axios/v1"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

describe("DashboardLayout", () => {
  beforeEach(() => {
    mockedUseFeatureFlagEnabled.mockReturnValue(false)
  })

  type SetupOptions = {
    initialUrl?: string
    organizations?: OrganizationPage[]
  }
  const setup = ({
    initialUrl = DASHBOARD_HOME,
    organizations = [],
  }: SetupOptions = {}) => {
    const user = factories.user.user()
    const mitxOnlineUser = mitxOnlineFactories.user.user({
      b2b_organizations: organizations,
    })

    setMockResponse.get(urls.userMe.get(), user)
    setMockResponse.get(mitxOnlineUrls.currentUser.get(), user)

    renderWithProviders(
      <DashboardLayout>
        <div data-testid="dashboard-panel" />
      </DashboardLayout>,
      { url: initialUrl },
    )

    return { user, mitxOnlineUser }
  }

  test("Renders user info", async () => {
    const { user } = setup()
    invariant(user.profile)
    await screen.findByText(user.profile.name)
  })

  test("Renders the expected tab links and labels", async () => {
    const { mitxOnlineUser } = setup()
    const expectedUrls = [
      DASHBOARD_HOME,
      ...mitxOnlineUser.b2b_organizations.map((org) =>
        organizationView(org.id),
      ),
      MY_LISTS,
      PROFILE,
      SETTINGS,
    ]
    const expectedLabels = [
      "Home",
      ...mitxOnlineUser.b2b_organizations.map((org) => org.name),
      "My Lists",
      "Profile",
      "Settings",
    ]

    const desktopNav = await screen.findByTestId("desktop-nav")
    const mobileNav = await screen.findByTestId("mobile-nav")

    expect(desktopNav).toHaveRole("navigation")
    expect(mobileNav).toHaveRole("navigation")
    const desktopTabList = within(desktopNav).getByRole("tablist")
    const mobileTabList = within(mobileNav).getByRole("tablist")

    const desktopTabs = within(desktopTabList).getAllByRole("tab")
    const mobileTabs = within(mobileTabList).getAllByRole("tab")

    // Check URLs
    expect(desktopTabs.map((el) => el.getAttribute("href"))).toEqual(
      expectedUrls,
    )
    expect(mobileTabs.map((el) => el.getAttribute("href"))).toEqual(
      expectedUrls,
    )

    // Check labels
    expect(desktopTabs.map((el) => el.textContent)).toEqual(expectedLabels)
    expect(mobileTabs.map((el) => el.textContent)).toEqual(expectedLabels)
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
