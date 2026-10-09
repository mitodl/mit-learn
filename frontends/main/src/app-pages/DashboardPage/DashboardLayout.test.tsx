import {
  screen,
  setMockResponse,
  within,
  renderWithProviders,
  user as userEvent,
  waitFor,
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
  contractView,
  PROFILE,
  SETTINGS,
} from "@/common/urls"
import { faker } from "@faker-js/faker/locale/en"
import invariant from "tiny-invariant"
import { UserOrganizationPage } from "@mitodl/mitxonline-api-axios/v0"
import { useFeatureFlagEnabled } from "posthog-js/react"
import mockRouter from "next-router-mock"
import { FeatureFlags } from "@/common/feature_flags"

jest.mock("posthog-js/react")
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

describe("DashboardLayout", () => {
  type SetupOptions = {
    initialUrl?: string
    organizations?: UserOrganizationPage[]
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
    setMockResponse.get(mitxOnlineUrls.userMe.get(), mitxOnlineUser)

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
    const contract = mitxOnlineFactories.contracts.contract({
      name: "Test Contract",
    })
    const organizations = [
      mitxOnlineFactories.organizations.organization({
        slug: "org-test-org",
        name: "Test Organization",
        contracts: [contract],
      }),
    ]
    const contracts = [contract]
    setup({ organizations })
    const expectedUrls = [
      DASHBOARD_HOME,
      ...organizations.map((org, index) =>
        contractView(
          org.slug.replace("org-", ""),
          contracts[index]?.slug ?? "",
        ),
      ),
      MY_LISTS,
      PROFILE,
      SETTINGS,
    ]
    const expectedDesktopLabels = [
      "Home",
      ...organizations.map((org) => `${org.name} - ${contracts[0].name}`),
      "My Lists",
      "Profile",
      "Settings",
    ]
    const expectedMobileLabels = [
      "Home",
      ...organizations.map((org) => `${org.name} - ${contracts[0].name}`),
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
    expect(desktopTabs.map((el) => el.textContent)).toEqual(
      expectedDesktopLabels,
    )
    expect(mobileTabs.map((el) => el.textContent)).toEqual(expectedMobileLabels)
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

  test("A contract tab asks for data consent first, and declining goes to dashboard home", async () => {
    mockedUseFeatureFlagEnabled.mockImplementation(
      (flag) => flag === FeatureFlags.B2BDataConsent,
    )
    const contract = mitxOnlineFactories.contracts.contract({
      name: "Consent Contract",
      consented_to_data_sharing: null,
    })
    setup({
      initialUrl: PROFILE,
      organizations: [
        mitxOnlineFactories.organizations.organization({
          slug: "org-consent-org",
          name: "Consent Org",
          contracts: [contract],
        }),
      ],
    })
    setMockResponse.post(
      mitxOnlineUrls.b2b.dataConsent(contract.id),
      undefined,
      {
        code: 204,
      },
    )

    const desktopNav = await screen.findByTestId("desktop-nav")
    const tab = await within(desktopNav).findByRole("tab", {
      name: /Consent Contract/,
    })
    const mobileTab = within(screen.getByTestId("mobile-nav")).getByRole(
      "tab",
      { name: /Consent Contract/ },
    )
    expect(tab).toHaveAttribute("data-disable-nprogress", "true")
    expect(mobileTab).toHaveAttribute("data-disable-nprogress", "true")
    await userEvent.click(tab)
    await userEvent.click(
      await screen.findByRole("button", { name: "Decline" }),
    )

    await waitFor(() => expect(mockRouter.asPath).toBe(DASHBOARD_HOME))
    expect(screen.getByText("Response recorded.")).toBeInTheDocument()
  })
})
