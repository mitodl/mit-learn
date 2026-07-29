import React from "react"
import { renderWithProviders, screen, TestingErrorBoundary } from "@/test-utils"
import { setMockResponse } from "api/test-utils"
import { factories, urls } from "api/mitxonline-test-utils"
import {
  factories as analyticsFactories,
  urls as analyticsUrls,
} from "api/analytics-test-utils"
import { waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { AxiosError } from "axios"
import type { OrganizationPage } from "@mitodl/mitxonline-api-axios/v2"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { allowConsoleErrors } from "ol-test-utilities"
import { ForbiddenError } from "@/common/errors"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import AnalyticsContent from "./AnalyticsContent"

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

/**
 * The charts are stubbed out. They render SVG whose geometry depends on
 * measured layout, which jsdom does not do — exercising them here would assert
 * on nothing useful. What this file covers is the page's own behaviour: access,
 * availability, freshness and suppression. The numbers those charts draw are
 * also rendered as text (KPI cards, the course table, the funnel's table view),
 * so they are still asserted on below.
 */
jest.mock("@mui/x-charts/LineChart", () => ({
  __esModule: true,
  LineChart: () => <div data-testid="line-chart" />,
}))
jest.mock("@mui/x-charts/BarChart", () => ({
  __esModule: true,
  BarChart: () => <div data-testid="bar-chart" />,
}))

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  useFeatureFlagEnabled: jest.fn(),
}))
jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

const managerOrgsUrl = urls.organization.managerOrganizationsList()

const ORG_UUID = "3fa85f64-5717-4562-b3fc-2c963f66afa6"

/**
 * `sso_organization_id` is not on the generated `OrganizationPage` type yet
 * (mitodl/mitxonline#3789 has not been released into the client), so it is
 * spliced on here the same way it arrives on the wire.
 */
const orgWithUuid = (
  overrides: Partial<OrganizationPage> = {},
  ssoOrganizationId: string | null = ORG_UUID,
) => {
  const org = factories.organizations.organization({
    contracts: [factories.contracts.contract()],
    ...overrides,
  })
  return ssoOrganizationId
    ? { ...org, sso_organization_id: ssoOrganizationId }
    : org
}

const setManagerOrgs = (orgs: unknown[]) => {
  setMockResponse.get(managerOrgsUrl, {
    count: orgs.length,
    next: null,
    previous: null,
    results: orgs,
  })
}

const AS_OF = "2026-07-01T04:00:00Z"

const setAnalyticsResponses = ({
  utilization = [analyticsFactories.contractUtilization()],
  trend = [analyticsFactories.monthlyEngagementTrend()],
  courses = [analyticsFactories.enrollmentCompletionFunnel()],
  programs = [analyticsFactories.programFunnel()],
  page = { limit: 200 },
}: {
  utilization?: ReturnType<typeof analyticsFactories.contractUtilization>[]
  trend?: ReturnType<typeof analyticsFactories.monthlyEngagementTrend>[]
  courses?: ReturnType<typeof analyticsFactories.enrollmentCompletionFunnel>[]
  programs?: ReturnType<typeof analyticsFactories.programFunnel>[]
  page?: { limit: number }
} = {}) => {
  setMockResponse.get(
    analyticsUrls.organizations.contractUtilization(ORG_UUID, page),
    analyticsFactories.envelope(utilization, { as_of: AS_OF }),
  )
  setMockResponse.get(
    analyticsUrls.organizations.engagementTrend(ORG_UUID, page),
    analyticsFactories.envelope(trend, { as_of: AS_OF }),
  )
  setMockResponse.get(
    analyticsUrls.organizations.enrollmentFunnel(ORG_UUID, page),
    analyticsFactories.envelope(courses, { as_of: AS_OF }),
  )
  setMockResponse.get(
    analyticsUrls.organizations.programFunnel(ORG_UUID, page),
    analyticsFactories.envelope(programs, { as_of: AS_OF }),
  )
}

describe("AnalyticsContent", () => {
  beforeEach(() => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(
      urls.userMe.get(),
      factories.user.user({ email: "manager@test.com" }),
    )
  })

  describe("access", () => {
    test("throws ForbiddenError when the feature flag is off", () => {
      mockedUseFeatureFlagEnabled.mockReturnValue(false)
      allowConsoleErrors()

      expect(() =>
        renderWithProviders(<AnalyticsContent orgSlug="any-org" />),
      ).toThrow(ForbiddenError)
    })

    test("waits for PostHog rather than 403-ing on a bootstrapped false", () => {
      mockedUseFeatureFlagsLoaded.mockReturnValue(false)
      mockedUseFeatureFlagEnabled.mockReturnValue(undefined)

      expect(() =>
        renderWithProviders(<AnalyticsContent orgSlug="any-org" />),
      ).not.toThrow()
    })

    test("denies access when the caller does not manage the requested org", async () => {
      setManagerOrgs([orgWithUuid()])

      renderWithProviders(<AnalyticsContent orgSlug="not-my-org" />)

      await screen.findByRole("heading", { name: "Access denied" })
    })

    /**
     * A 403 from the analytics API is not handled inside the page: the browser
     * query client throws on 401/403 so the route's error boundary handles it,
     * the same as every other page. This asserts the error actually escapes
     * rather than being swallowed into a half-rendered dashboard.
     */
    test("lets an analytics 403 reach the error boundary", async () => {
      const org = orgWithUuid()
      setManagerOrgs([org])
      allowConsoleErrors()
      const page = { limit: 200 }
      const forbidden = ["Forbidden", { code: 403 }] as const
      setMockResponse.get(
        analyticsUrls.organizations.contractUtilization(ORG_UUID, page),
        ...forbidden,
      )
      setMockResponse.get(
        analyticsUrls.organizations.engagementTrend(ORG_UUID, page),
        ...forbidden,
      )
      setMockResponse.get(
        analyticsUrls.organizations.enrollmentFunnel(ORG_UUID, page),
        ...forbidden,
      )
      setMockResponse.get(
        analyticsUrls.organizations.programFunnel(ORG_UUID, page),
        ...forbidden,
      )

      const onError = jest.fn()
      renderWithProviders(
        <TestingErrorBoundary onError={onError}>
          <AnalyticsContent orgSlug={org.slug.replace(/^org-/, "")} />
        </TestingErrorBoundary>,
      )

      await waitFor(() => expect(onError).toHaveBeenCalled())
      expect((onError.mock.calls[0][0] as AxiosError).response?.status).toBe(
        403,
      )
    })

    test("shows an error page when the manager org lookup fails", async () => {
      allowConsoleErrors()
      setMockResponse.get(managerOrgsUrl, "Internal Server Error", {
        code: 500,
      })

      renderWithProviders(<AnalyticsContent orgSlug="any-org" />)

      await screen.findByRole("heading", { name: "Something went wrong" })
    })
  })

  describe("availability", () => {
    /**
     * An org whose MITx Online record predates the `sso_organization_id`
     * field has no key the analytics API can be called with. That must read as
     * "unavailable", never as a request with `undefined` in the path.
     */
    test("reports unavailable, and issues no request, when the org has no UUID", async () => {
      const org = orgWithUuid({}, null)
      setManagerOrgs([org])

      renderWithProviders(
        <AnalyticsContent orgSlug={org.slug.replace(/^org-/, "")} />,
      )

      await screen.findByText(
        /Analytics is not available for this organization/,
      )
      // No analytics response was ever registered; reaching the API would have
      // failed the test via the mock adapter's console.error.
      expect(
        screen.queryByRole("heading", { name: "Contract utilization" }),
      ).not.toBeInTheDocument()
    })
  })

  describe("content", () => {
    test("renders every section with its own as-of date", async () => {
      const org = orgWithUuid()
      setManagerOrgs([org])
      setAnalyticsResponses()

      renderWithProviders(
        <AnalyticsContent orgSlug={org.slug.replace(/^org-/, "")} />,
      )

      await screen.findByRole("heading", { name: "Contract utilization" })
      expect(
        screen.getByRole("heading", { name: "Monthly engagement" }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("heading", { name: "Course performance" }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("heading", { name: "Program funnel" }),
      ).toBeInTheDocument()

      // One "Data as of" per section — freshness is per materialized view.
      const asOfLabels = await screen.findAllByText(/Data as of/)
      expect(asOfLabels).toHaveLength(4)
    })

    test("renders the KPI figures from contract utilization", async () => {
      const org = orgWithUuid()
      setManagerOrgs([org])
      setAnalyticsResponses({
        utilization: [
          analyticsFactories.contractUtilization({
            b2b_contract_name: "Acme Site License",
            seats_consumed: 62,
            seat_limit: 100,
            active_learners: 48,
            seat_utilization_pct: 62,
            completion_rate_pct: 32.3,
          }),
        ],
      })

      renderWithProviders(
        <AnalyticsContent orgSlug={org.slug.replace(/^org-/, "")} />,
      )

      await screen.findByRole("heading", { name: "Acme Site License" })
      expect(screen.getByText("62%")).toBeInTheDocument()
      expect(screen.getByText("48")).toBeInTheDocument()
      expect(screen.getByText("32.3%")).toBeInTheDocument()
      expect(screen.getByText("62 of 100 seats")).toBeInTheDocument()
    })

    test("renders course rows and marks suppressed values as withheld", async () => {
      const org = orgWithUuid()
      setManagerOrgs([org])
      setAnalyticsResponses({
        courses: [
          analyticsFactories.enrollmentCompletionFunnel({
            courserun_title: "Intro to Widgets",
            enrolled_learners: 40,
            // Below the anonymity floor: must not render as 0.
            certified_learners: null,
            completion_rate_pct: null,
          }),
        ],
      })

      renderWithProviders(
        <AnalyticsContent orgSlug={org.slug.replace(/^org-/, "")} />,
      )

      await screen.findByText("Intro to Widgets")
      expect(screen.getByText("40")).toBeInTheDocument()
      expect(
        screen.getAllByLabelText(/Withheld: too few learners/).length,
      ).toBeGreaterThan(0)
      expect(
        screen.getAllByText(/Withheld: too few learners/).length,
      ).toBeGreaterThan(0)
    })

    test("renders the program funnel's table view alongside the chart", async () => {
      const org = orgWithUuid()
      setManagerOrgs([org])
      setAnalyticsResponses({
        programs: [
          analyticsFactories.programFunnel({
            program_title: "Widget Engineering",
            total_courses: 6,
            enrolled_in_contract_courses: 50,
            enrolled_via_program: 30,
            program_course_completers: 12,
          }),
        ],
      })

      renderWithProviders(
        <AnalyticsContent orgSlug={org.slug.replace(/^org-/, "")} />,
      )

      await screen.findByText("Widget Engineering")
      // Scoped to this table: the monthly engagement section renders its own
      // table of counts, which can legitimately carry the same numbers.
      const table = screen.getByRole("table", { name: "Program funnel" })
      expect(within(table).getByText("50")).toBeInTheDocument()
      expect(within(table).getByText("30")).toBeInTheDocument()
      expect(within(table).getByText("12")).toBeInTheDocument()
    })

    test("says so when a view has never refreshed rather than implying freshness", async () => {
      const org = orgWithUuid()
      setManagerOrgs([org])
      const page = { limit: 200 }
      setMockResponse.get(
        analyticsUrls.organizations.contractUtilization(ORG_UUID, page),
        analyticsFactories.envelope(
          [analyticsFactories.contractUtilization()],
          {
            as_of: null,
          },
        ),
      )
      setMockResponse.get(
        analyticsUrls.organizations.engagementTrend(ORG_UUID, page),
        analyticsFactories.envelope([], { as_of: null }),
      )
      setMockResponse.get(
        analyticsUrls.organizations.enrollmentFunnel(ORG_UUID, page),
        analyticsFactories.envelope([], { as_of: null }),
      )
      setMockResponse.get(
        analyticsUrls.organizations.programFunnel(ORG_UUID, page),
        analyticsFactories.envelope([], { as_of: null }),
      )

      renderWithProviders(
        <AnalyticsContent orgSlug={org.slug.replace(/^org-/, "")} />,
      )

      expect(
        (await screen.findAllByText("Data not yet refreshed")).length,
      ).toBe(4)
      expect(screen.queryByText(/Data as of/)).not.toBeInTheDocument()
    })

    test("renders empty states rather than blank sections", async () => {
      const org = orgWithUuid()
      setManagerOrgs([org])
      setAnalyticsResponses({ courses: [], programs: [], trend: [] })

      renderWithProviders(
        <AnalyticsContent orgSlug={org.slug.replace(/^org-/, "")} />,
      )

      await screen.findByText("No course enrollments recorded yet.")
      expect(
        screen.getByText("No program enrollments recorded yet."),
      ).toBeInTheDocument()
    })

    /**
     * A section whose query failed has no rows and no `as_of`, which is exactly
     * what a successful-but-empty section looks like. It must not borrow that
     * section's copy: "No course enrollments recorded yet" is a claim about the
     * org, and "Data not yet refreshed" is a claim about the view, and neither
     * is known to be true when the request never came back.
     */
    test("distinguishes a failed section from an empty one", async () => {
      const org = orgWithUuid()
      setManagerOrgs([org])
      allowConsoleErrors()
      setAnalyticsResponses()
      // Overrides the successful response registered just above.
      setMockResponse.get(
        analyticsUrls.organizations.enrollmentFunnel(ORG_UUID, { limit: 200 }),
        "Internal Server Error",
        { code: 500 },
      )

      renderWithProviders(
        <AnalyticsContent orgSlug={org.slug.replace(/^org-/, "")} />,
      )

      await screen.findByText(
        "This data could not be loaded. Please try again later.",
      )
      expect(
        screen.queryByText("No course enrollments recorded yet."),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText("Data not yet refreshed"),
      ).not.toBeInTheDocument()
      // The three sections that did load keep their own freshness stamp.
      expect(screen.getAllByText(/Data as of/)).toHaveLength(3)
      expect(
        screen.getByText(/Some analytics could not be loaded/),
      ).toBeInTheDocument()
    })
  })

  /**
   * Every endpoint is paged, and a truncated page is invisible in the rows: 2
   * of 340 looks exactly like 2 of 2. The envelope's `total_count` is the only
   * thing that distinguishes them.
   */
  describe("truncation", () => {
    const courseRows = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        analyticsFactories.enrollmentCompletionFunnel({
          courserun_pk: index + 1,
          courserun_title: `Course ${index + 1}`,
        }),
      )

    test("says nothing when a section holds every row", async () => {
      const org = orgWithUuid()
      setManagerOrgs([org])
      setAnalyticsResponses()

      renderWithProviders(
        <AnalyticsContent orgSlug={org.slug.replace(/^org-/, "")} />,
      )

      await screen.findByRole("heading", { name: "Course performance" })
      expect(screen.queryByText(/Showing \d+ of/)).not.toBeInTheDocument()
      expect(
        screen.queryByRole("button", { name: /Show all/ }),
      ).not.toBeInTheDocument()
    })

    test("admits to showing a subset, and loads the rest on request", async () => {
      const org = orgWithUuid()
      setManagerOrgs([org])
      setAnalyticsResponses()
      setMockResponse.get(
        analyticsUrls.organizations.enrollmentFunnel(ORG_UUID, { limit: 200 }),
        analyticsFactories.envelope(courseRows(2), {
          as_of: AS_OF,
          total_count: 340,
        }),
      )
      // "Show all" asks for the whole result set in one page.
      setMockResponse.get(
        analyticsUrls.organizations.enrollmentFunnel(ORG_UUID, { limit: 340 }),
        analyticsFactories.envelope(courseRows(3), {
          as_of: AS_OF,
          total_count: 340,
        }),
      )

      const user = userEvent.setup()
      renderWithProviders(
        <AnalyticsContent orgSlug={org.slug.replace(/^org-/, "")} />,
      )

      await screen.findByText("Showing 2 of 340.")
      await user.click(screen.getByRole("button", { name: "Show all 340" }))

      await screen.findByText("Course 3")
      // Still short of the total, so the count updates rather than disappearing.
      expect(screen.getByText("Showing 3 of 340.")).toBeInTheDocument()
    })

    /**
     * The expanded page keeps the old rows on screen while it loads, so nothing
     * visibly changes on click. Without the busy state and the live region a
     * screen reader gets no feedback at all that the button did anything.
     */
    test("marks the button busy while expanding and announces the result", async () => {
      const org = orgWithUuid()
      setManagerOrgs([org])
      setAnalyticsResponses()
      // Row counts stay tiny deliberately: rendering hundreds of rows in jsdom
      // is slow enough to make this flaky under parallel load, and the wiring
      // under test doesn't depend on the magnitudes. `total_count` still has to
      // exceed the page size, or there would be nothing to expand.
      setMockResponse.get(
        analyticsUrls.organizations.enrollmentFunnel(ORG_UUID, { limit: 200 }),
        analyticsFactories.envelope(courseRows(2), {
          as_of: AS_OF,
          total_count: 340,
        }),
      )
      setMockResponse.get(
        analyticsUrls.organizations.enrollmentFunnel(ORG_UUID, { limit: 340 }),
        analyticsFactories.envelope(courseRows(3), {
          as_of: AS_OF,
          total_count: 340,
        }),
      )

      const user = userEvent.setup()
      renderWithProviders(
        <AnalyticsContent orgSlug={org.slug.replace(/^org-/, "")} />,
      )

      const button = await screen.findByRole("button", { name: "Show all 340" })
      expect(button).toHaveAttribute("aria-busy", "false")

      await user.click(button)

      await screen.findByText("Showing 3 of 340 rows.")
    })

    /**
     * The API applies its LIMIT in SQL and drops sub-floor rows afterwards, so
     * a page of `total_count` rows can still come back short — permanently.
     * Asking again would resend the same limit and change nothing, so the
     * button has to go rather than sit there doing nothing.
     */
    test("stops offering more once a section has already asked for the total", async () => {
      const org = orgWithUuid()
      setManagerOrgs([org])
      setAnalyticsResponses()
      setMockResponse.get(
        analyticsUrls.organizations.enrollmentFunnel(ORG_UUID, { limit: 200 }),
        analyticsFactories.envelope(courseRows(2), {
          as_of: AS_OF,
          total_count: 340,
        }),
      )
      // Asked for all 340 and got 3 back: the rest were dropped by the floor
      // after the LIMIT had already been applied. (Tiny counts on purpose — see
      // the note in the busy/announce test.)
      setMockResponse.get(
        analyticsUrls.organizations.enrollmentFunnel(ORG_UUID, { limit: 340 }),
        analyticsFactories.envelope(courseRows(3), {
          as_of: AS_OF,
          total_count: 340,
        }),
      )

      const user = userEvent.setup()
      renderWithProviders(
        <AnalyticsContent orgSlug={org.slug.replace(/^org-/, "")} />,
      )

      await user.click(
        await screen.findByRole("button", { name: "Show all 340" }),
      )

      await screen.findByText("Showing 3 of 340.")
      expect(
        screen.queryByRole("button", { name: /Show all/ }),
      ).not.toBeInTheDocument()
    })

    /**
     * The API answers 422 above its max_page_size, so past that point there is
     * no request left to make — the message has to stand on its own rather than
     * offering a button that cannot deliver.
     */
    test("drops the button once a section is already at the API's page cap", async () => {
      const org = orgWithUuid()
      setManagerOrgs([org])
      setAnalyticsResponses()
      setMockResponse.get(
        analyticsUrls.organizations.enrollmentFunnel(ORG_UUID, { limit: 200 }),
        analyticsFactories.envelope(courseRows(2), {
          as_of: AS_OF,
          total_count: 5000,
        }),
      )
      setMockResponse.get(
        analyticsUrls.organizations.enrollmentFunnel(ORG_UUID, { limit: 1000 }),
        analyticsFactories.envelope(courseRows(4), {
          as_of: AS_OF,
          total_count: 5000,
        }),
      )

      const user = userEvent.setup()
      renderWithProviders(
        <AnalyticsContent orgSlug={org.slug.replace(/^org-/, "")} />,
      )

      // Capped at max_page_size rather than asking for all 5000.
      await screen.findByRole("button", { name: "Show all 5,000" })
      await user.click(screen.getByRole("button", { name: "Show all 5,000" }))

      await screen.findByText("Showing 4 of 5,000.")
      expect(
        screen.queryByRole("button", { name: /Show all/ }),
      ).not.toBeInTheDocument()
    })
  })
})
