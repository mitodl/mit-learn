import React from "react"
import { renderWithProviders, screen, user, within } from "@/test-utils"
import { act, fireEvent, waitFor } from "@testing-library/react"
import { makeRequest, setMockResponse } from "api/test-utils"
import {
  factories as mitxFactories,
  urls as mitxUrls,
} from "api/mitxonline-test-utils"
import {
  factories as analyticsFactories,
  urls as analyticsUrls,
} from "api/analytics-test-utils"
import type { CompletionStatusFilter } from "api/analytics-hooks/organizations"
import { useFeatureFlag } from "@/common/useFeatureFlag"
import { allowConsoleErrors } from "ol-test-utilities"
import { ForbiddenError } from "@/common/errors"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { contractAnalyticsView } from "@/common/urls"
import ContractLearnersPage from "./ContractLearnersPage"

jest.mock("@/common/useFeatureFlag")

jest.mock("@/common/analytics/posthog", () => ({
  capturePostHog: jest.fn(),
  initPostHog: jest.fn(),
}))

jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)
const mockedUseFeatureFlag = jest.mocked(useFeatureFlag)

const ORG_UUID = "11111111-2222-3333-4444-555555555555"
const GRID_PAGE_SIZE = 25
const M5 = "course-v1:MITx+M5+2026"
const M6 = "course-v1:MITx+M6+2026"
const NEEDS_ATTENTION = "Not started or inactive 30+ days"
/** Every learners request asks for these, which leaves out learners who haven't consented. */
const SHARED_STATUSES: CompletionStatusFilter[] = [
  "not_started",
  "in_progress",
  "passed",
  "certified",
]

/** managerOrganizationsList reads `res.data.results`, so a bare array is not enough. */
const paginate = (orgs: unknown[]) => ({
  count: orgs.length,
  next: null,
  previous: null,
  results: orgs,
})

/** `closest` returns Element; testing-library's `within` wants an HTMLElement. */
const rowOf = (el: HTMLElement): HTMLElement =>
  el.closest<HTMLElement>('[role="row"]')!

const setup = () => {
  const contract = mitxFactories.contracts.contract()
  const org = mitxFactories.organizations.organization({
    contracts: [contract],
    sso_organization_id: ORG_UUID,
  })
  return { org, contract, orgSlug: org.slug.replace(/^org-/, "") }
}

/**
 * A managed org with no analytics org ID, so the page renders its chrome
 * without firing any analytics request.
 */
const setupUnqueryable = () => {
  const contract = mitxFactories.contracts.contract()
  const org = mitxFactories.organizations.organization({
    contracts: [contract],
    sso_organization_id: null,
  })
  setMockResponse.get(
    mitxUrls.organization.managerOrganizationsList(),
    paginate([org]),
  )
  return { org, contract, orgSlug: org.slug.replace(/^org-/, "") }
}

/**
 * The grid's columns and the Modules filter's options. Every queryable render
 * fires this; an unmocked request throws rather than resolving empty.
 */
const mockCourseRuns = (
  contractId: number,
  runs = [
    analyticsFactories.courseRun({
      courserun_id: M5,
      courserun_title: "Module 5",
    }),
    analyticsFactories.courseRun({
      courserun_id: M6,
      courserun_title: "Module 6",
    }),
  ],
) => {
  setMockResponse.get(
    analyticsUrls.contracts.courseRuns(ORG_UUID, contractId, { limit: 1000 }),
    analyticsFactories.envelope(runs),
  )
}

const mockGridPage = (
  contractId: number,
  offset: number,
  rows: ReturnType<typeof analyticsFactories.learnerProgress>[],
  envelopeOverrides: Record<string, unknown> = {},
  extraParams: Record<string, unknown> = {},
) => {
  setMockResponse.get(
    analyticsUrls.contracts.learners(ORG_UUID, contractId, {
      limit: GRID_PAGE_SIZE,
      offset,
      completion_status: SHARED_STATUSES,
      ...extraParams,
    }),
    analyticsFactories.learnersEnvelope(
      analyticsFactories.learnersFromRows(rows),
      envelopeOverrides,
    ),
  )
}

/**
 * Mocks everything but the grid's own pages, which each test adds after this
 * returns: no request fires until the org list resolves.
 */
const learnerTotalUrl = (contractId: number) =>
  analyticsUrls.contracts.learners(ORG_UUID, contractId, {
    limit: 1,
    offset: 0,
    completion_status: SHARED_STATUSES,
  })

const renderGrid = (url = "/", runs?: Parameters<typeof mockCourseRuns>[1]) => {
  const { org, contract, orgSlug } = setup()
  const contractId = contract.id
  setMockResponse.get(
    mitxUrls.organization.managerOrganizationsList(),
    paginate([org]),
  )
  mockCourseRuns(contractId, runs)
  setMockResponse.get(
    learnerTotalUrl(contractId),
    analyticsFactories.learnersEnvelope([], { total_count: 28 }),
  )
  const { location, queryClient } = renderWithProviders(
    <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    { url },
  )
  return { contractId, orgSlug, contract, location, queryClient }
}

const learnerNamed = (name: string) =>
  analyticsFactories.learnerProgress({
    full_name: name,
    courserun_readable_id: M5,
  })

const gridTable = () =>
  screen.getByRole("table", { name: "Learner progress by module" })

const pickStatus = async (label: string) => {
  await user.click(await screen.findByRole("combobox", { name: /status/i }))
  await user.click(within(await screen.findByRole("listbox")).getByText(label))
}

const statusField = () => screen.getByRole("combobox", { name: /status/i })

const toggleModule = async (name: string) => {
  await user.click(screen.getByRole("combobox", { name: /modules/i }))
  await user.click(
    within(await screen.findByRole("listbox")).getByRole("option", { name }),
  )
  await user.keyboard("{Escape}")
}

/** A contract with one module has no Modules filter, so Status applies to that module. */
const oneModule = () => [
  analyticsFactories.courseRun({
    courserun_id: M5,
    courserun_title: "Module 5",
  }),
]

describe("ContractLearnersPage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlag.mockReturnValue(true)
    setMockResponse.get(
      mitxUrls.userMe.get(),
      mitxFactories.user.user({ email: "manager@test.com" }),
    )
  })

  describe("access", () => {
    test("throws ForbiddenError when the learner analytics flag is off", () => {
      mockedUseFeatureFlag.mockReturnValue(false)
      allowConsoleErrors()

      expect(() =>
        renderWithProviders(
          <ContractLearnersPage orgSlug="acme" contractSlug="c1" />,
        ),
      ).toThrow(ForbiddenError)
    })

    /**
     * The two dashboards roll out independently: aggregate analytics must not
     * confer access to per-learner data.
     */
    test("the aggregate analytics flag alone does not open this page", () => {
      mockedUseFeatureFlag.mockImplementation(
        (flag) => flag === FeatureFlags.B2BAnalyticsDashboard,
      )
      allowConsoleErrors()

      expect(() =>
        renderWithProviders(
          <ContractLearnersPage orgSlug="acme" contractSlug="c1" />,
        ),
      ).toThrow(ForbiddenError)
    })

    /**
     * Learner analytics is nested inside the analytics rollout: the contract
     * nav assumes the aggregate page is reachable.
     */
    test("the learner flag alone does not open this page", () => {
      mockedUseFeatureFlag.mockImplementation(
        (flag) => flag === FeatureFlags.B2BLearnerAnalytics,
      )
      allowConsoleErrors()

      expect(() =>
        renderWithProviders(
          <ContractLearnersPage orgSlug="acme" contractSlug="c1" />,
        ),
      ).toThrow(ForbiddenError)
    })

    test("opens with both analytics flags on, with the contract nav marking Learners current", async () => {
      mockedUseFeatureFlag.mockImplementation(
        (flag) =>
          flag === FeatureFlags.B2BAnalyticsDashboard ||
          flag === FeatureFlags.B2BLearnerAnalytics,
      )
      const { contract, orgSlug } = setupUnqueryable()

      renderWithProviders(
        <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
      )

      const nav = await screen.findByRole("navigation", { name: "Contract" })
      expect(
        within(nav).getByRole("link", { name: "Learners" }),
      ).toHaveAttribute("aria-current", "page")
      expect(
        within(nav).getByRole("link", { name: "Analytics" }),
      ).toHaveAttribute("href", contractAnalyticsView(orgSlug, contract.slug))
    })

    test("denies access when the org is not one the user manages", async () => {
      setMockResponse.get(
        mitxUrls.organization.managerOrganizationsList(),
        paginate([]),
      )

      renderWithProviders(
        <ContractLearnersPage orgSlug="acme" contractSlug="c1" />,
      )

      await screen.findByText("Access denied")
    })

    test("404s when the contract slug does not resolve", async () => {
      const { org, orgSlug } = setup()
      setMockResponse.get(
        mitxUrls.organization.managerOrganizationsList(),
        paginate([org]),
      )

      renderWithProviders(
        <ContractLearnersPage orgSlug={orgSlug} contractSlug="nope" />,
      )

      await screen.findByText("Contract not found")
    })

    /**
     * No analytics endpoint is mocked, so a click that ignored `canQuery`
     * would hit an unmocked endpoint and report a misleading failure.
     */
    test("disables Export and skips the request when the org has no analytics org ID", async () => {
      const { contract, orgSlug } = setupUnqueryable()

      renderWithProviders(
        <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
      )

      const unavailableMessage = await screen.findByText(
        "Learner analytics is not available in this environment.",
      )
      const exportButton = screen.getByRole("button", {
        name: "Export learners",
      })
      expect(exportButton).toHaveAttribute("aria-disabled", "true")
      expect(exportButton).toHaveAttribute(
        "aria-describedby",
        unavailableMessage.id,
      )

      await user.click(exportButton)
      expect(
        screen.queryByText("Could not export learners. Please try again."),
      ).not.toBeInTheDocument()
    })
  })

  describe("page-level states", () => {
    test("shows an error state instead of the grid when the contract's learner count fails", async () => {
      const { contractId } = renderGrid()
      setMockResponse.get(
        learnerTotalUrl(contractId),
        "Internal Server Error",
        { code: 500 },
      )
      mockGridPage(contractId, 0, [learnerNamed("Ada Lovelace")])

      await screen.findByText("Something went wrong loading learner data.")
      expect(
        screen.getByRole("button", { name: "Try again" }),
      ).toBeInTheDocument()
      expect(
        screen.queryByRole("table", { name: "Learner progress by module" }),
      ).not.toBeInTheDocument()
      expect(screen.queryByText("No learners found.")).not.toBeInTheDocument()
    })

    test("says no one is enrolled yet in place of the grid when the contract has no learners to show", async () => {
      const { contractId, contract } = renderGrid()
      setMockResponse.get(
        learnerTotalUrl(contractId),
        analyticsFactories.learnersEnvelope([], { total_count: 0 }),
      )
      mockGridPage(contractId, 0, [])

      const message = await screen.findByText(
        `No learners are enrolled in ${contract.name} yet. They'll appear here once they enroll.`,
      )
      expect(
        screen.queryByRole("table", { name: "Learner progress by module" }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole("combobox", { name: /status/i }),
      ).not.toBeInTheDocument()
      expect(screen.queryByText(/enrolled learners/)).not.toBeInTheDocument()
      const exportButton = screen.getByRole("button", {
        name: "Export learners",
      })
      expect(exportButton).toHaveAttribute("aria-disabled", "true")
      expect(exportButton).toHaveAttribute("aria-describedby", message.id)
    })

    test("says the data is on its way when the warehouse has not loaded the contract", async () => {
      const { contractId, contract } = renderGrid()
      const notLoaded = [
        {
          detail: {
            code: "contract_not_loaded",
            message: "No analytics data has been loaded for contract yet",
          },
        },
        { code: 404 },
      ] as const
      for (const url of [
        analyticsUrls.contracts.learners(ORG_UUID, contractId, {
          limit: GRID_PAGE_SIZE,
          offset: 0,
          completion_status: SHARED_STATUSES,
        }),
        learnerTotalUrl(contractId),
        analyticsUrls.contracts.courseRuns(ORG_UUID, contractId, {
          limit: 1000,
        }),
      ]) {
        setMockResponse.get(url, ...notLoaded)
      }

      const message = await screen.findByText(
        `Learner data for ${contract.name} will be available once it has been loaded. Please check back later.`,
      )
      expect(
        screen.queryByText("Something went wrong loading learner data."),
      ).not.toBeInTheDocument()
      const exportButton = screen.getByRole("button", {
        name: "Export learners",
      })
      expect(exportButton).toHaveAttribute("aria-disabled", "true")
      expect(exportButton).toHaveAttribute("aria-describedby", message.id)
    })
  })

  describe("the grid", () => {
    test("shows one row per learner with a column per module", async () => {
      const { contractId } = renderGrid()
      mockGridPage(contractId, 0, [
        analyticsFactories.learnerProgress({
          learner_id: "a",
          email: "ada@example.com",
          full_name: "Ada Lovelace",
          courserun_readable_id: M5,
          completion_status: "passed",
        }),
        analyticsFactories.learnerProgress({
          learner_id: "a",
          email: "ada@example.com",
          full_name: "Ada Lovelace",
          courserun_readable_id: M6,
          completion_status: "in_progress",
        }),
        analyticsFactories.learnerProgress({
          learner_id: "b",
          email: "bob@example.com",
          full_name: "Bob Barker",
          courserun_readable_id: M5,
          completion_status: "not_started",
        }),
      ])

      const table = await screen.findByRole("table", {
        name: "Learner progress by module",
      })
      expect(
        await within(table).findByRole("columnheader", { name: "Module 5" }),
      ).toBeInTheDocument()
      expect(
        within(table).getByRole("columnheader", { name: "Module 6" }),
      ).toBeInTheDocument()

      const ada = rowOf(await within(table).findByText("Ada Lovelace"))
      expect(within(ada).getByText("Completed")).toBeInTheDocument()
      expect(within(ada).getByText("In progress")).toBeInTheDocument()

      const bob = rowOf(within(table).getByText("Bob Barker"))
      expect(within(bob).getByText("Not started")).toBeInTheDocument()
      expect(within(bob).getByText("N/A")).toBeInTheDocument()
      expect(within(bob).getByText("No activity")).toBeInTheDocument()
      expect(within(table).getAllByRole("row")).toHaveLength(3)
    })

    test("makes a module header focusable once a resize clamps its title", async () => {
      const resizeCallbacks = new Map<Element, () => void>()
      const OriginalResizeObserver = window.ResizeObserver
      window.ResizeObserver = class {
        constructor(private callback: () => void) {}
        observe(el: Element) {
          resizeCallbacks.set(el, this.callback)
        }
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver
      try {
        const { contractId } = renderGrid()
        mockGridPage(contractId, 0, [
          analyticsFactories.learnerProgress({ courserun_readable_id: M5 }),
        ])
        const header = await screen.findByRole("columnheader", {
          name: "Module 5",
        })
        expect(header).not.toHaveAttribute("tabindex")

        Object.defineProperty(header, "scrollHeight", { value: 90 })
        Object.defineProperty(header, "clientHeight", { value: 60 })
        act(() => resizeCallbacks.get(header)?.())

        expect(header).toHaveAttribute("tabindex", "0")
      } finally {
        window.ResizeObserver = OriginalResizeObserver
      }
    })

    test("marks inactive modules and shows the learner's latest activity", async () => {
      const { contractId } = renderGrid()
      mockGridPage(contractId, 0, [
        analyticsFactories.learnerProgress({
          learner_id: "a",
          email: "ada@example.com",
          full_name: "Ada Lovelace",
          courserun_readable_id: M5,
          completion_status: "in_progress",
          last_active_on: "2026-09-30",
          needs_attention: true,
        }),
        analyticsFactories.learnerProgress({
          learner_id: "a",
          email: "ada@example.com",
          full_name: "Ada Lovelace",
          courserun_readable_id: M6,
          completion_status: "not_started",
          last_active_on: "2026-08-01",
          needs_attention: true,
        }),
      ])

      const ada = rowOf(await screen.findByText("Ada Lovelace"))
      expect(
        within(ada).getByText("Last active Sep 30, 2026"),
      ).toBeInTheDocument()
      expect(within(ada).getByText(/, Inactive 30\+ days/)).toBeInTheDocument()
      expect(within(ada).getByText(/, Not started/)).toBeInTheDocument()
    })

    test("shows content progress under started modules only", async () => {
      const { contractId } = renderGrid()
      const ada = {
        learner_id: "a",
        email: "ada@example.com",
        full_name: "Ada Lovelace",
      }
      mockGridPage(contractId, 0, [
        analyticsFactories.learnerProgress({
          ...ada,
          courserun_readable_id: M5,
          completion_status: "in_progress",
          content_progress: 0.45,
        }),
        analyticsFactories.learnerProgress({
          ...ada,
          courserun_readable_id: M6,
          completion_status: "not_started",
          content_progress: 0.1,
        }),
      ])

      const row = rowOf(await screen.findByText("Ada Lovelace"))
      expect(within(row).getByText(/^45%/)).toHaveTextContent("45% complete")
      expect(within(row).queryByText(/^10%/)).not.toBeInTheDocument()
      expect(
        within(screen.getByRole("list", { name: "Legend" })).getByText(
          "Percent shows content completed, not grade",
        ),
      ).toBeInTheDocument()
    })

    test("shadows the pinned learner column only once the grid has scrolled", async () => {
      const { contractId } = renderGrid()
      mockGridPage(contractId, 0, [learnerNamed("Ada Lovelace")])

      const learnerCell = (await screen.findByText("Ada Lovelace")).closest(
        '[role="rowheader"]',
      )!
      expect(learnerCell).toHaveStyle({ boxShadow: "none" })

      const region = screen.getByRole("region", {
        name: /Learner progress by module/,
      })
      fireEvent.scroll(region, { target: { scrollLeft: 40 } })
      expect(learnerCell).not.toHaveStyle({ boxShadow: "none" })

      fireEvent.scroll(region, { target: { scrollLeft: 0 } })
      expect(learnerCell).toHaveStyle({ boxShadow: "none" })
    })

    test("says how many of the contract's enrolled learners match", async () => {
      const { contractId } = renderGrid()
      mockGridPage(contractId, 0, [
        analyticsFactories.learnerProgress({
          learner_id: "a",
          full_name: "Ada",
        }),
        analyticsFactories.learnerProgress({
          learner_id: "b",
          full_name: "Bob",
        }),
      ])

      expect(
        await screen.findByText("2 of 28 enrolled learners"),
      ).toBeInTheDocument()
    })

    test("drops the learner count, rather than loading forever, when the grid fails", async () => {
      const { contractId } = renderGrid()
      setMockResponse.get(
        analyticsUrls.contracts.learners(ORG_UUID, contractId, {
          limit: GRID_PAGE_SIZE,
          offset: 0,
          completion_status: SHARED_STATUSES,
        }),
        "Internal Server Error",
        { code: 500 },
      )

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Something went wrong loading learner data.",
      )
      expect(screen.queryByText("Loading…")).not.toBeInTheDocument()
      expect(screen.queryByText(/enrolled learners/)).not.toBeInTheDocument()
    })

    /** Asking for every shared status is what leaves out learners who haven't consented. */
    test("asks for only learners who consented, in the grid and in the learner total", async () => {
      const { contractId } = renderGrid()
      mockGridPage(contractId, 0, [learnerNamed("Ada Lovelace")])

      await screen.findByText("1 of 28 enrolled learners")

      const learnerRequests = makeRequest.mock.calls
        .map(([{ url }]) => new URL(url, "http://localhost"))
        .filter(({ pathname }) => pathname.split("/").includes("learners"))
      expect(
        learnerRequests.map(({ searchParams }) => ({
          limit: searchParams.get("limit"),
          statuses: searchParams.getAll("completion_status").sort(),
        })),
      ).toEqual(
        expect.arrayContaining([
          { limit: "1", statuses: [...SHARED_STATUSES].sort() },
          {
            limit: String(GRID_PAGE_SIZE),
            statuses: [...SHARED_STATUSES].sort(),
          },
        ]),
      )
      expect(
        learnerRequests.every(
          ({ searchParams }) => searchParams.getAll("completion_status").length,
        ),
      ).toBe(true)
      expect(
        makeRequest.mock.calls.some(([{ url }]) =>
          url.includes("learner-progress"),
        ),
      ).toBe(false)
    })

    test("requests the next page of learners by offset", async () => {
      const { contractId } = renderGrid()
      mockGridPage(contractId, 0, [learnerNamed("Ada Lovelace")], {
        total_count: 30,
      })
      mockGridPage(contractId, GRID_PAGE_SIZE, [learnerNamed("Zed Zimmer")], {
        total_count: 30,
      })

      expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument()

      const pagination = within(
        gridTable().closest("div[role=region]")!.parentElement!,
      )
      await user.click(pagination.getByRole("button", { name: /page 2/i }))

      expect(await screen.findByText("Zed Zimmer")).toBeInTheDocument()
      expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument()
    })
  })

  describe("the learner summary panel", () => {
    const ada = (
      overrides: Parameters<typeof analyticsFactories.learnerProgress>[0],
    ) =>
      analyticsFactories.learnerProgress({
        learner_id: "a",
        email: "ada@example.com",
        full_name: "Ada Lovelace",
        ...overrides,
      })

    /** A `<dt>`'s value is its `<dd>` sibling; the column-reverse layout is visual only. */
    const statValue = (container: HTMLElement, label: string) =>
      within(container).getByText(label, { selector: "dt" })
        .nextElementSibling as HTMLElement

    const openSummary = async () => {
      await user.click(
        await screen.findByRole("button", { name: /Ada Lovelace/ }),
      )
      return screen.findByRole("dialog", { name: "Ada Lovelace" })
    }

    test("sums a consented learner's activity and shows each module's counts", async () => {
      const { contractId } = renderGrid()
      mockGridPage(contractId, 0, [
        ada({
          courserun_readable_id: M5,
          completion_status: "passed",
          content_progress: 1,
          last_active_on: "2026-09-12",
          days_active: 3,
          videos_watched: 10,
          problems_attempted: 0,
          chatbot_interactions: 2,
        }),
        ada({
          courserun_readable_id: M6,
          completion_status: "in_progress",
          content_progress: 0.4,
          last_active_on: "2026-09-30",
          days_active: 5,
          videos_watched: 7,
          problems_attempted: 0,
          chatbot_interactions: 1,
        }),
      ])

      const dialog = await openSummary()

      const progress = within(dialog).getByRole("region", { name: "Progress" })
      expect(statValue(progress, "Completed")).toHaveTextContent("1 of 2")
      expect(statValue(progress, "Not enrolled")).toHaveTextContent("0")
      expect(statValue(progress, "Last activity")).toHaveTextContent(
        "Sep 30, 2026",
      )

      const activity = within(dialog).getByRole("region", {
        name: "Activity across modules",
      })
      expect(
        within(activity).queryByText("Days active", { selector: "dt" }),
      ).not.toBeInTheDocument()
      expect(statValue(activity, "Videos watched")).toHaveTextContent("17")
      expect(statValue(activity, "Problems attempted")).toHaveTextContent("0")
      expect(statValue(activity, "Chatbot interactions")).toHaveTextContent("3")

      const modules = within(
        within(dialog).getByRole("region", { name: "Modules" }),
      ).getAllByRole("listitem")
      expect(modules[0]).toHaveTextContent("Completed 100%")
      expect(modules[1]).toHaveTextContent("In progress 40%")
      expect(statValue(modules[1], "Days active")).toHaveTextContent("5")
      expect(statValue(modules[1], "Videos watched")).toHaveTextContent("7")
      expect(
        within(dialog).getByText(/Activity is counted once per day/),
      ).toBeInTheDocument()
    })

    test("shows refetched counts while the panel stays open", async () => {
      const { contractId, queryClient } = renderGrid()
      mockGridPage(contractId, 0, [
        ada({ courserun_readable_id: M5, videos_watched: 4 }),
      ])

      const dialog = await openSummary()
      const activity = within(dialog).getByRole("region", {
        name: "Activity across modules",
      })
      expect(statValue(activity, "Videos watched")).toHaveTextContent("4")

      mockGridPage(contractId, 0, [
        ada({ courserun_readable_id: M5, videos_watched: 9 }),
      ])
      await act(async () => {
        await queryClient.refetchQueries()
      })

      await waitFor(() => {
        expect(statValue(activity, "Videos watched")).toHaveTextContent("9")
      })
      expect(screen.getByRole("dialog", { name: "Ada Lovelace" })).toBe(dialog)
    })

    test("closes on Escape and returns focus to the learner", async () => {
      const { contractId } = renderGrid()
      mockGridPage(contractId, 0, [ada({ courserun_readable_id: M5 })])

      await openSummary()
      await user.keyboard("{Escape}")

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      })
      expect(screen.getByRole("button", { name: /Ada Lovelace/ })).toHaveFocus()
    })
  })

  describe("the Modules filter", () => {
    test("narrows learners and columns to the selected modules", async () => {
      const { contractId, location } = renderGrid()
      mockGridPage(contractId, 0, [
        analyticsFactories.learnerProgress({
          learner_id: "a",
          full_name: "Ada Lovelace",
          courserun_readable_id: M5,
        }),
      ])
      mockGridPage(
        contractId,
        0,
        [
          analyticsFactories.learnerProgress({
            learner_id: "b",
            full_name: "Bob Barker",
            courserun_readable_id: M6,
          }),
        ],
        {},
        { courserun_readable_id: [M6] },
      )

      await screen.findByText("Ada Lovelace")

      await user.click(screen.getByRole("combobox", { name: /modules/i }))
      const option = within(await screen.findByRole("listbox")).getByRole(
        "option",
        { name: "Module 6" },
      )
      await user.click(option)
      expect(option).toHaveAttribute("aria-selected", "true")
      await user.keyboard("{Escape}")

      expect(await screen.findByText("Bob Barker")).toBeInTheDocument()
      expect(location.current.searchParams.getAll("modules")).toEqual([M6])
      const table = gridTable()
      expect(
        within(table).getByRole("columnheader", { name: "Module 6" }),
      ).toBeInTheDocument()
      expect(
        within(table).queryByRole("columnheader", { name: "Module 5" }),
      ).not.toBeInTheDocument()
      expect(
        screen.getByRole("combobox", { name: /modules/i }),
      ).toHaveAccessibleName(/^Modules\s*, 1 selected$/)
      expect(
        screen.getByRole("combobox", { name: /modules/i }),
      ).toHaveTextContent("Module 6")

      mockGridPage(
        contractId,
        0,
        [
          analyticsFactories.learnerProgress({
            learner_id: "a",
            full_name: "Ada Lovelace",
            courserun_readable_id: M5,
          }),
        ],
        {},
        { courserun_readable_id: [M5, M6] },
      )
      await user.click(screen.getByRole("combobox", { name: /modules/i }))
      await user.click(
        within(await screen.findByRole("listbox")).getByRole("option", {
          name: "Module 5",
        }),
      )
      await user.keyboard("{Escape}")

      const combobox = screen.getByRole("combobox", { name: /modules/i })
      expect(combobox).toHaveAccessibleName(/^Modules\s*, 2 selected$/)
      expect(combobox).toHaveTextContent("Selected2")
    })

    test("drops module ids in the URL that aren't on the contract", async () => {
      const { contractId } = renderGrid(
        `/?modules=${encodeURIComponent(M5)}&modules=gone`,
      )
      mockGridPage(
        contractId,
        0,
        [learnerNamed("Ada Lovelace")],
        {},
        { courserun_readable_id: [M5] },
      )

      expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument()
    })

    test("dates the learner's last activity from the selected modules only", async () => {
      const { contractId } = renderGrid(`/?modules=${encodeURIComponent(M6)}`)
      const ada = { learner_id: "a", full_name: "Ada Lovelace" }
      mockGridPage(
        contractId,
        0,
        [
          analyticsFactories.learnerProgress({
            ...ada,
            courserun_readable_id: M5,
            completion_status: "in_progress",
            last_active_on: "2026-09-30",
          }),
          analyticsFactories.learnerProgress({
            ...ada,
            courserun_readable_id: M6,
            completion_status: "in_progress",
            last_active_on: "2026-08-01",
          }),
        ],
        {},
        { courserun_readable_id: [M6] },
      )

      const row = rowOf(await screen.findByText("Ada Lovelace"))
      expect(
        within(row).getByText("Last active Aug 1, 2026"),
      ).toBeInTheDocument()
    })

    test("is hidden, and ignores modules in the URL, when the contract has one module", async () => {
      const { contractId } = renderGrid(`/?modules=${encodeURIComponent(M5)}`, [
        analyticsFactories.courseRun({
          courserun_id: M5,
          courserun_title: "Module 5",
        }),
      ])
      mockGridPage(contractId, 0, [learnerNamed("Ada Lovelace")])

      await screen.findByText("Ada Lovelace")
      expect(
        screen.queryByRole("combobox", { name: /modules/i }),
      ).not.toBeInTheDocument()
    })

    /**
     * The grid shows its own retry alert for the same failure; this pins the
     * field's message to the field for a screen reader user.
     */
    test("marks the field when its options fail to load", async () => {
      const { contractId } = renderGrid()
      setMockResponse.get(
        analyticsUrls.contracts.courseRuns(ORG_UUID, contractId, {
          limit: 1000,
        }),
        "Internal Server Error",
        { code: 500 },
      )
      mockGridPage(contractId, 0, [learnerNamed("Ada Lovelace")])

      const message = await screen.findByText(
        "Couldn't load modules. Reload to try again.",
      )
      expect(
        screen.getByRole("combobox", { name: /modules/i }),
      ).toHaveAttribute("aria-describedby", expect.stringContaining(message.id))
    })
  })

  describe("the Status filter", () => {
    test("follows Modules in the DOM, so tab and reading order match the screen", async () => {
      const { contractId } = renderGrid()
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])

      await screen.findByText("Everyone")
      const modules = screen.getByRole("combobox", { name: /modules/i })
      expect(
        modules.compareDocumentPosition(statusField()) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })

    test("is unavailable but still reachable, and says why, until a module is selected", async () => {
      const { contractId, location } = renderGrid()
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])
      mockGridPage(
        contractId,
        0,
        [learnerNamed("In Module 6")],
        {},
        { courserun_readable_id: [M6] },
      )
      mockGridPage(
        contractId,
        0,
        [learnerNamed("Completed In Module 6")],
        {},
        {
          completion_status: ["passed", "certified"],
          courserun_readable_id: [M6],
        },
      )

      await screen.findByText("Everyone")
      const status = statusField()
      expect(status).toHaveAttribute("aria-disabled", "true")
      expect(status).toHaveAttribute("tabindex", "0")
      expect(status).toHaveTextContent("Select a module first")
      expect(status).toHaveAccessibleDescription(
        "Select a module to filter by status.",
      )

      await user.click(status)
      expect(status).toHaveFocus()
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
      for (const key of ["{ArrowDown}", "{Enter}", " "]) {
        await user.keyboard(key)
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
      }
      /** `false` means the default was prevented, so the key doesn't scroll the page. */
      for (const key of [" ", "ArrowUp", "ArrowDown", "Enter"]) {
        expect(fireEvent.keyDown(status, { key })).toBe(false)
      }

      await toggleModule("Module 6")
      await screen.findByText("In Module 6")
      expect(statusField()).not.toHaveAttribute("aria-disabled")
      expect(statusField()).toHaveTextContent("All learners")
      expect(statusField()).not.toHaveAccessibleDescription()

      await pickStatus("Completed")
      await screen.findByText("Completed In Module 6")
      expect(location.current.search).toBe(
        `?modules=${encodeURIComponent(M6)}&status=passed`,
      )
    })

    test("stays unavailable while the modules load", async () => {
      const runs =
        Promise.withResolvers<ReturnType<typeof analyticsFactories.envelope>>()
      const { contractId } = renderGrid()
      setMockResponse.get(
        analyticsUrls.contracts.courseRuns(ORG_UUID, contractId, {
          limit: 1000,
        }),
        runs.promise,
      )
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])

      expect(
        await screen.findByRole("combobox", { name: /status/i }),
      ).toHaveAttribute("aria-disabled", "true")

      await act(async () => {
        runs.resolve(analyticsFactories.envelope(oneModule()))
      })
      await waitFor(() =>
        expect(statusField()).not.toHaveAttribute("aria-disabled"),
      )
    })

    test("says why it's unavailable when the modules fail to load", async () => {
      const { contractId } = renderGrid()
      setMockResponse.get(
        analyticsUrls.contracts.courseRuns(ORG_UUID, contractId, {
          limit: 1000,
        }),
        "Internal Server Error",
        { code: 500 },
      )
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])

      await screen.findByText("Couldn't load modules. Reload to try again.")
      expect(statusField()).toHaveAttribute("aria-disabled", "true")
      expect(statusField()).toHaveTextContent("Unavailable")
      expect(statusField()).toHaveAccessibleDescription(
        "Status needs this contract's modules, which couldn't load.",
      )
    })

    test("resets to All learners when the last module is cleared, and says so", async () => {
      const { contractId, location } = renderGrid(
        `/?modules=${encodeURIComponent(M6)}&status=passed`,
      )
      mockGridPage(
        contractId,
        0,
        [learnerNamed("Completed In Module 6")],
        {},
        {
          completion_status: ["passed", "certified"],
          courserun_readable_id: [M6],
        },
      )
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])

      await screen.findByText("Completed In Module 6")
      expect(statusField()).toHaveTextContent("Completed")

      await toggleModule("Module 6")
      await screen.findByText("Everyone")
      expect(location.current.search).toBe("")
      expect(statusField()).toHaveAttribute("aria-disabled", "true")
      expect(screen.getByText("Status filter cleared.")).toHaveAttribute(
        "role",
        "status",
      )

      mockGridPage(
        contractId,
        0,
        [learnerNamed("In Module 6")],
        {},
        { courserun_readable_id: [M6] },
      )
      await toggleModule("Module 6")
      await screen.findByText("In Module 6")
      expect(
        screen.queryByText("Status filter cleared."),
      ).not.toBeInTheDocument()
    })

    /** An old link or bookmark, from before Status needed a module. */
    test("drops a status a link carries without a module", async () => {
      const { contractId, location } = renderGrid("/?status=passed")
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])

      await screen.findByText("Everyone")
      await waitFor(() => expect(location.current.search).toBe(""))
      expect(statusField()).toHaveTextContent("Select a module first")
    })

    test("applies with no module selected when the contract has one module", async () => {
      const { contractId, location } = renderGrid(
        "/?status=passed",
        oneModule(),
      )
      mockGridPage(
        contractId,
        0,
        [learnerNamed("Completed Learner")],
        {},
        { completion_status: ["passed", "certified"] },
      )

      await screen.findByText("Completed Learner")
      expect(statusField()).not.toHaveAttribute("aria-disabled")
      expect(statusField()).not.toHaveAccessibleDescription()
      expect(statusField()).toHaveTextContent("Completed")
      expect(location.current.search).toBe("?status=passed")
      const gridStatuses = makeRequest.mock.calls
        .map(([{ url }]) => new URL(url, "http://localhost"))
        .filter(
          ({ pathname, searchParams }) =>
            pathname.split("/").includes("learners") &&
            searchParams.get("limit") === String(GRID_PAGE_SIZE),
        )
        .map(({ searchParams }) => searchParams.getAll("completion_status"))
      expect(gridStatuses).toEqual([["passed", "certified"]])
    })

    test("offers no Certificate or Consent withheld option, and Completed matches passed and certified", async () => {
      const { contractId } = renderGrid("/", oneModule())
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])
      mockGridPage(
        contractId,
        0,
        [
          analyticsFactories.learnerProgress({
            learner_id: "p",
            full_name: "Passed",
            completion_status: "passed",
          }),
          analyticsFactories.learnerProgress({
            learner_id: "c",
            full_name: "Certified",
            completion_status: "certified",
          }),
        ],
        {},
        { completion_status: ["passed", "certified"] },
      )

      await screen.findByText("Everyone")

      await user.click(await screen.findByRole("combobox", { name: /status/i }))
      const listbox = await screen.findByRole("listbox")
      expect(
        within(listbox)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["All learners", "Not started", "In progress", "Completed"])
      await user.click(within(listbox).getByText("Completed"))

      await screen.findByText("Passed")
      await screen.findByText("Certified")
    })

    /**
     * Not "No learners found." — that would read as if the contract has no
     * learners at all. The text also appears in the role="status" echo, so the
     * query is scoped to the cell.
     */
    test("a status filter with no matches reads as a filter, not an empty contract", async () => {
      const { contractId } = renderGrid("/", oneModule())
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])
      mockGridPage(
        contractId,
        0,
        [],
        {},
        { completion_status: ["not_started"] },
      )

      await screen.findByText("Everyone")
      await pickStatus("Not started")

      await within(await screen.findByRole("cell")).findByText(
        "No learners match this filter.",
      )
    })
  })

  describe("the not started or inactive filter", () => {
    const checkbox = () =>
      screen.findByRole("checkbox", { name: NEEDS_ATTENTION })

    /**
     * Sending `false` would ask for "only the learners who are fine", which is
     * not the unfiltered view. An unmocked `needs_attention=false` request
     * would throw, so reaching the unfiltered rows again is the assertion.
     */
    test("sends needs_attention=true when checked, and drops the param when unchecked", async () => {
      const { contractId, location } = renderGrid()
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])
      mockGridPage(
        contractId,
        0,
        [learnerNamed("Only Stale")],
        {},
        { needs_attention: true },
      )

      await screen.findByText("Everyone")
      await user.click(await checkbox())
      await screen.findByText("Only Stale")
      expect(location.current.search).toBe("?needs_attention=true")

      await user.click(await checkbox())
      await screen.findByText("Everyone")
      expect(location.current.search).toBe("")
    })

    /**
     * Needing attention overlaps the completion statuses instead of
     * partitioning them, so "in progress AND stale" has to be expressible.
     */
    test("combines with the status filter instead of replacing it", async () => {
      const { contractId } = renderGrid("/", oneModule())
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])
      mockGridPage(
        contractId,
        0,
        [learnerNamed("In Progress Only")],
        {},
        { completion_status: ["in_progress"] },
      )
      mockGridPage(
        contractId,
        0,
        [learnerNamed("Stale And In Progress")],
        {},
        { completion_status: ["in_progress"], needs_attention: true },
      )

      await screen.findByText("Everyone")
      await pickStatus("In progress")
      await screen.findByText("In Progress Only")

      await user.click(await checkbox())
      await screen.findByText("Stale And In Progress")
    })
  })

  describe("URL state", () => {
    test("opens with the filters a link carries", async () => {
      const { contractId } = renderGrid(
        `/?modules=${encodeURIComponent(M5)}&modules=${encodeURIComponent(M6)}&status=in_progress&needs_attention=true`,
      )
      mockGridPage(
        contractId,
        0,
        [learnerNamed("Ada Stale")],
        {},
        {
          completion_status: ["in_progress"],
          needs_attention: true,
          courserun_readable_id: [M5, M6],
        },
      )

      await screen.findByText("Ada Stale")
      expect(
        screen.getByRole("combobox", { name: /status/i }),
      ).toHaveTextContent("In progress")
      expect(
        screen.getByRole("checkbox", { name: NEEDS_ATTENTION }),
      ).toBeChecked()
    })

    test("ignores filter values it does not recognize", async () => {
      const { contractId } = renderGrid(
        "/?status=bogus&modules=course-v1:Gone&needs_attention=yes&page=-3",
      )
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])

      await screen.findByText("Everyone")
      expect(statusField()).toHaveTextContent("Select a module first")
      expect(
        screen.getByRole("combobox", { name: /modules/i }),
      ).toHaveTextContent("All modules")
      expect(
        screen.getByRole("checkbox", { name: NEEDS_ATTENTION }),
      ).not.toBeChecked()
    })

    /**
     * `unknown` was the withheld-consent status. Learners who haven't consented
     * are never listed now, so an old link to them opens on everyone else.
     */
    test.each([
      { status: "constructor", reason: "an inherited object key" },
      { status: "unknown", reason: "the removed withheld-consent status" },
    ])("ignores a status that is $reason", async ({ status }) => {
      const { contractId } = renderGrid(`/?status=${status}`, oneModule())
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])

      await screen.findByText("Everyone")
      expect(
        screen.getByRole("combobox", { name: /status/i }),
      ).toHaveTextContent("All learners")
      expect(
        screen.queryByRole("button", { name: "Clear filters" }),
      ).not.toBeInTheDocument()
    })

    test("treats an out-of-range page in the URL as page 1", async () => {
      const { contractId } = renderGrid("/?page=99999999999999999999")
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])

      await screen.findByText("Everyone")
    })

    test("moves a page past the end back to the last page", async () => {
      const { contractId, location } = renderGrid("/?page=999")
      mockGridPage(contractId, 998 * GRID_PAGE_SIZE, [], { total_count: 30 })
      mockGridPage(contractId, GRID_PAGE_SIZE, [learnerNamed("Last Page")], {
        total_count: 30,
      })

      await screen.findByText("Last Page")
      expect(location.current.searchParams.get("page")).toBe("2")
    })

    test("writes filter changes to the URL and sends the page back to 1", async () => {
      const { contractId, location } = renderGrid("/?page=2", oneModule())
      mockGridPage(contractId, GRID_PAGE_SIZE, [learnerNamed("Second Page")], {
        total_count: 30,
      })
      mockGridPage(
        contractId,
        0,
        [learnerNamed("Not Started")],
        {},
        { completion_status: ["not_started"] },
      )
      mockGridPage(
        contractId,
        0,
        [learnerNamed("Stale")],
        {},
        { completion_status: ["not_started"], needs_attention: true },
      )

      await screen.findByText("Second Page")
      expect(screen.getByText("Page 2 of 2")).toBeInTheDocument()

      await pickStatus("Not started")
      await screen.findByText("Not Started")
      expect(location.current.search).toBe("?status=not_started")

      await user.click(screen.getByRole("checkbox", { name: NEEDS_ATTENTION }))
      await screen.findByText("Stale")
      expect(location.current.search).toBe(
        "?status=not_started&needs_attention=true",
      )
    })

    /** A learner's name or email would otherwise be recorded by PostHog and Sentry. */
    test("keeps the search text out of the URL", async () => {
      const { contractId, location } = renderGrid()
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])
      mockGridPage(contractId, 0, [learnerNamed("Ada")], {}, { search: "ada" })

      await screen.findByText("Everyone")
      await user.type(
        screen.getByPlaceholderText("Search name or email"),
        "ada",
      )
      await screen.findByText("Ada")
      expect(location.current.search).toBe("")
    })

    test("Clear filters resets every filter and only shows while one is active", async () => {
      const { contractId, location } = renderGrid(
        `/?status=not_started&needs_attention=true&modules=${encodeURIComponent(M6)}`,
      )
      mockGridPage(contractId, 0, [learnerNamed("Everyone")])
      mockGridPage(
        contractId,
        0,
        [learnerNamed("Filtered")],
        {},
        {
          completion_status: ["not_started"],
          needs_attention: true,
          courserun_readable_id: [M6],
        },
      )
      await screen.findByText("Filtered")

      await user.click(screen.getByRole("button", { name: "Clear filters" }))

      await screen.findByText("Everyone")
      expect(screen.getByPlaceholderText("Search name or email")).toHaveFocus()
      expect(location.current.search).toBe("")
      expect(
        screen.queryByRole("button", { name: "Clear filters" }),
      ).not.toBeInTheDocument()
    })
  })

  describe("CSV export", () => {
    const mockAnchorClick = jest.fn()
    const mockCreateObjectURL = jest.fn().mockReturnValue("blob:fake-url")
    const mockRevokeObjectURL = jest.fn()

    beforeEach(() => {
      mockAnchorClick.mockClear()
      mockCreateObjectURL.mockClear()
      mockRevokeObjectURL.mockClear()
      URL.createObjectURL = mockCreateObjectURL
      URL.revokeObjectURL = mockRevokeObjectURL
      jest
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(mockAnchorClick)
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    const exportCsv = async () => {
      await user.click(
        await screen.findByRole("button", { name: "Export learners" }),
      )
      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      })
      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsText(blob)
      })
    }

    test("writes one row per learner with each module's status and progress", async () => {
      const { contractId } = renderGrid()
      const ada = {
        learner_id: "a",
        email: "ada@example.com",
        full_name: "Ada Lovelace",
      }
      mockGridPage(contractId, 0, [
        analyticsFactories.learnerProgress({
          ...ada,
          courserun_readable_id: M5,
          completion_status: "passed",
          content_progress: 0.9,
          last_active_on: "2026-09-30",
          needs_attention: true,
        }),
        analyticsFactories.learnerProgress({
          ...ada,
          courserun_readable_id: M6,
          completion_status: "not_started",
          content_progress: 0.1,
          last_active_on: null,
          needs_attention: true,
        }),
        analyticsFactories.learnerProgress({
          learner_id: "b",
          email: "bob@example.com",
          full_name: "Bob Barker",
          courserun_readable_id: M5,
          completion_status: "in_progress",
          content_progress: 0.35,
          last_active_on: null,
        }),
      ])
      await screen.findByText("Ada Lovelace")

      const csv = await exportCsv()

      expect(csv.split("\n")).toEqual([
        "Name,Email,Last activity,Module 5 status,Module 5 progress,Module 6 status,Module 6 progress",
        "Ada Lovelace,ada@example.com,2026-09-30,Completed (inactive 30+ days),90%,Not started,",
        "Bob Barker,bob@example.com,,In progress,35%,N/A,",
      ])
      expect(await screen.findByText("CSV download started.")).toBeVisible()
    })

    /**
     * Neither the unfiltered request nor the other module's columns are
     * mocked or expected, so an export that dropped a filter would fail.
     */
    test("carries the active filters and narrows the columns to the selected modules", async () => {
      const { contractId } = renderGrid(
        `/?status=not_started&modules=${encodeURIComponent(M6)}`,
      )
      mockGridPage(
        contractId,
        0,
        [
          analyticsFactories.learnerProgress({
            email: "ada@example.com",
            full_name: "Ada Lovelace",
            courserun_readable_id: M6,
            completion_status: "not_started",
          }),
        ],
        {},
        { completion_status: ["not_started"], courserun_readable_id: [M6] },
      )
      await screen.findByText("Ada Lovelace")

      const csv = await exportCsv()

      expect(csv.split("\n")).toEqual([
        "Name,Email,Last activity,Module 6 status,Module 6 progress",
        "Ada Lovelace,ada@example.com,,Not started,",
      ])
    })

    test("fetches every page of learners, not just the one on screen", async () => {
      const { contractId } = renderGrid()
      const pages = [["Ada Lovelace"], ["Bob Barker"], ["Cy Young"]] as const
      pages.forEach((names, index) =>
        mockGridPage(
          contractId,
          index * GRID_PAGE_SIZE,
          names.map(learnerNamed),
          { total_count: 60 },
        ),
      )
      await screen.findByText("Ada Lovelace")

      const csv = await exportCsv()

      const rows = csv.split("\n").slice(1)
      expect(rows.map((row) => row.split(",")[0])).toEqual([
        "Ada Lovelace",
        "Bob Barker",
        "Cy Young",
      ])
    })

    test("holds Export until the contract's modules load", async () => {
      const runs =
        Promise.withResolvers<ReturnType<typeof analyticsFactories.envelope>>()
      const { contractId } = renderGrid()
      setMockResponse.get(
        analyticsUrls.contracts.courseRuns(ORG_UUID, contractId, {
          limit: 1000,
        }),
        runs.promise,
      )
      mockGridPage(contractId, 0, [learnerNamed("Ada Lovelace")])

      const exportButton = await screen.findByRole("button", {
        name: "Export learners",
      })
      expect(exportButton).toHaveAttribute("aria-disabled", "true")
      await user.click(exportButton)
      expect(exportButton).toHaveTextContent("Export learners")
      expect(mockCreateObjectURL).not.toHaveBeenCalled()

      await act(async () => {
        runs.resolve(
          analyticsFactories.envelope([
            analyticsFactories.courseRun({
              courserun_id: M5,
              courserun_title: "Module 5",
            }),
          ]),
        )
      })
      await screen.findByText("Ada Lovelace")
      expect(exportButton).toHaveAttribute("aria-disabled", "false")
    })

    test("says why Export is disabled when the modules fail to load", async () => {
      const { contractId } = renderGrid()
      setMockResponse.get(
        analyticsUrls.contracts.courseRuns(ORG_UUID, contractId, {
          limit: 1000,
        }),
        "Internal Server Error",
        { code: 500 },
      )
      mockGridPage(contractId, 0, [learnerNamed("Ada Lovelace")])

      const exportButton = await screen.findByRole("button", {
        name: "Export learners",
      })
      await waitFor(() =>
        expect(exportButton).toHaveAccessibleDescription(
          "Export needs this contract's modules, which couldn't load.",
        ),
      )
      expect(exportButton).toHaveAttribute("aria-disabled", "true")
      expect(exportButton).toHaveAttribute("aria-busy", "false")
    })

    test("reports a failure instead of downloading a partial file", async () => {
      const { contractId } = renderGrid()
      mockGridPage(contractId, 0, [learnerNamed("Ada Lovelace")], {
        total_count: 30,
      })
      setMockResponse.get(
        analyticsUrls.contracts.learners(ORG_UUID, contractId, {
          limit: GRID_PAGE_SIZE,
          offset: GRID_PAGE_SIZE,
          completion_status: SHARED_STATUSES,
        }),
        "Internal Server Error",
        { code: 500 },
      )
      await screen.findByText("Ada Lovelace")

      await user.click(screen.getByRole("button", { name: "Export learners" }))

      expect(
        await screen.findByText("Could not export learners. Please try again."),
      ).toBeInTheDocument()
      expect(mockCreateObjectURL).not.toHaveBeenCalled()
    })
  })
})
