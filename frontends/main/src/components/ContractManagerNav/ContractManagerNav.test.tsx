import React from "react"
import { renderWithProviders, screen, within } from "@/test-utils"
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

describe("ContractManagerNav", () => {
  test("links to every section for the contract, marking only the current one", () => {
    enableFlags(
      FeatureFlags.B2BAnalyticsDashboard,
      FeatureFlags.B2BLearnerAnalytics,
      FeatureFlags.B2BContractManagerDashboard,
    )
    renderWithProviders(
      <ContractManagerNav orgSlug="acme" contractSlug="c1" current="seats" />,
    )

    const nav = screen.getByRole("navigation", { name: "Contract" })
    const expected = [
      ["Overview", contractView("acme", "c1")],
      ["Analytics", contractAnalyticsView("acme", "c1")],
      ["Learners", contractLearnersView("acme", "c1")],
      ["Seats", contractAdminView("acme", "c1")],
    ]
    expect(linkNames()).toEqual(expected.map(([name]) => name))
    for (const [name, href] of expected) {
      const link = within(nav).getByRole("link", { name })
      expect(link).toHaveAttribute("href", href)
      if (name === "Seats") {
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
      links: ["Overview", "Seats"],
    },
  ])(
    "shows only the sections whose flags are on: $links",
    ({ flags, links }) => {
      enableFlags(...flags)
      renderWithProviders(
        <ContractManagerNav
          orgSlug="acme"
          contractSlug="c1"
          current="overview"
        />,
      )
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
})
