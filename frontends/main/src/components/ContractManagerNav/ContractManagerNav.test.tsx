import React from "react"
import {
  renderWithProviders,
  fireEvent,
  screen,
  within,
  setMockResponse,
} from "@/test-utils"
import userEvent from "@testing-library/user-event"
import { urls, factories } from "api/mitxonline-test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { FeatureFlags } from "@/common/feature_flags"
import {
  contractAdminView,
  contractAnalyticsView,
  contractLearnersView,
  contractView,
} from "@/common/urls"
import ContractManagerNav from "./ContractManagerNav"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  useFeatureFlagEnabled: jest.fn(),
}))
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

const enableFlags = (...flags: FeatureFlags[]) =>
  mockedUseFeatureFlagEnabled.mockImplementation((flag) =>
    flags.includes(flag as FeatureFlags),
  )

const linkNames = () =>
  within(screen.getByRole("navigation", { name: "Contract" }))
    .getAllByRole("link")
    .map((link) => link.textContent)

const mockUserWithContract = (hasContract = true) => {
  const contract = factories.contracts.contract({ slug: "c1" })
  const org = factories.organizations.organization({
    slug: "org-acme",
    contracts: hasContract ? [contract] : [],
  })
  setMockResponse.get(
    urls.userMe.get(),
    factories.user.user({ b2b_organizations: [org] }),
  )
}

describe("ContractManagerNav", () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockUserWithContract()
  })

  test("links to every section for the contract, marking only the current one", async () => {
    enableFlags(
      FeatureFlags.B2BAnalyticsDashboard,
      FeatureFlags.B2BLearnerAnalytics,
      FeatureFlags.B2BContractManagerDashboard,
    )
    renderWithProviders(
      <ContractManagerNav orgSlug="acme" contractSlug="c1" current="seats" />,
    )

    await screen.findByRole("link", { name: "Overview" })
    const nav = screen.getByRole("navigation", { name: "Contract" })
    const expected = [
      ["Overview", contractView("acme", "c1")],
      ["Analytics", contractAnalyticsView("acme", "c1")],
      ["Learners", contractLearnersView("acme", "c1")],
      ["Manage seats", contractAdminView("acme", "c1")],
    ]
    expect(linkNames()).toEqual(expected.map(([name]) => name))
    for (const [name, href] of expected) {
      const link = within(nav).getByRole("link", { name })
      expect(link).toHaveAttribute("href", href)
      if (name === "Manage seats") {
        expect(link).toHaveAttribute("aria-current", "page")
      } else {
        expect(link).not.toHaveAttribute("aria-current")
      }
    }
  })

  test.each([
    {
      flags: [FeatureFlags.B2BAnalyticsDashboard],
      links: ["Overview", "Analytics"],
    },
    {
      flags: [
        FeatureFlags.B2BAnalyticsDashboard,
        FeatureFlags.B2BLearnerAnalytics,
      ],
      links: ["Overview", "Analytics", "Learners"],
    },
    {
      flags: [
        FeatureFlags.B2BLearnerAnalytics,
        FeatureFlags.B2BContractManagerDashboard,
      ],
      links: ["Overview", "Manage seats"],
    },
  ])(
    "shows only the sections whose flags are on: $links",
    async ({ flags, links }) => {
      enableFlags(...flags)
      renderWithProviders(
        <ContractManagerNav
          orgSlug="acme"
          contractSlug="c1"
          current="overview"
        />,
      )
      await screen.findByRole("link", { name: "Overview" })
      expect(linkNames()).toEqual(links)
    },
  )

  test("renders nothing when Overview would be its only link", () => {
    enableFlags(FeatureFlags.B2BLearnerAnalytics)
    renderWithProviders(
      <ContractManagerNav
        orgSlug="acme"
        contractSlug="c1"
        current="overview"
      />,
    )
    expect(
      screen.queryByRole("navigation", { name: "Contract" }),
    ).not.toBeInTheDocument()
  })

  test("omits Overview when the contract is absent from the user's organizations", async () => {
    mockUserWithContract(false)
    enableFlags(
      FeatureFlags.B2BAnalyticsDashboard,
      FeatureFlags.B2BContractManagerDashboard,
    )
    renderWithProviders(
      <ContractManagerNav orgSlug="acme" contractSlug="c1" current="seats" />,
    )
    await screen.findByRole("navigation", { name: "Contract" })
    expect(linkNames()).toEqual(["Analytics", "Manage seats"])
  })

  describe("focus after navigation", () => {
    const stopNavigation = (event: Event) => event.preventDefault()
    beforeEach(() => document.addEventListener("click", stopNavigation))
    afterEach(() => document.removeEventListener("click", stopNavigation))

    const renderNav = () =>
      renderWithProviders(
        <ContractManagerNav
          orgSlug="acme"
          contractSlug="c1"
          current="analytics"
        />,
      )

    const enableLearnerFlags = () =>
      enableFlags(
        FeatureFlags.B2BAnalyticsDashboard,
        FeatureFlags.B2BLearnerAnalytics,
      )

    test.each([
      [
        "keyboard",
        async (link: HTMLElement) => {
          link.focus()
          await userEvent.keyboard("{Enter}")
        },
      ],
      ["mouse", (link: HTMLElement) => userEvent.click(link)],
    ])(
      "refocuses the link that was activated by %s when the nav remounts",
      async (_input, activate) => {
        enableLearnerFlags()
        const { view } = renderNav()
        await activate(await screen.findByRole("link", { name: "Learners" }))
        view.unmount()

        renderNav()
        expect(
          await screen.findByRole("link", { name: "Learners" }),
        ).toHaveFocus()
      },
    )

    test("does not refocus when no link was activated", async () => {
      enableLearnerFlags()
      renderNav()
      await screen.findByRole("link", { name: "Learners" })
      expect(document.body).toHaveFocus()
    })

    test.each([
      ["the current page's link", "Analytics", {}],
      ["a modifier-click that opens a new tab", "Learners", { metaKey: true }],
    ])(
      "does not save %s for refocus",
      async (_case, name, eventInit) => {
        enableLearnerFlags()
        const { view } = renderNav()
        fireEvent.click(
          await screen.findByRole("link", { name }),
          eventInit,
        )
        view.unmount()

        renderNav()
        await screen.findByRole("link", { name })
        expect(document.body).toHaveFocus()
      },
    )

    test("leaves focus alone when it already moved elsewhere", async () => {
      enableLearnerFlags()
      const { view } = renderNav()
      await userEvent.click(
        await screen.findByRole("link", { name: "Learners" }),
      )
      view.unmount()

      renderWithProviders(
        <>
          <button ref={(el) => el?.focus()}>Elsewhere</button>
          <ContractManagerNav
            orgSlug="acme"
            contractSlug="c1"
            current="analytics"
          />
        </>,
      )
      await screen.findByRole("link", { name: "Learners" })
      expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus()
    })
  })
})
