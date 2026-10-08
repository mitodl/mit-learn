import React from "react"
import { renderWithProviders, screen, user, within } from "@/test-utils"
import { act, waitFor } from "@testing-library/react"
import { setMockResponse } from "api/test-utils"
import {
  factories as mitxFactories,
  urls as mitxUrls,
} from "api/mitxonline-test-utils"
import {
  factories as analyticsFactories,
  urls as analyticsUrls,
} from "api/analytics-test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { allowConsoleErrors } from "ol-test-utilities"
import { ForbiddenError } from "@/common/errors"
import { FeatureFlags } from "@/common/feature_flags"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import { contractAnalyticsView, contractLearnersView } from "@/common/urls"
import ContractLearnersPage from "./ContractLearnersPage"

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  useFeatureFlagEnabled: jest.fn(),
}))
jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

const ORG_UUID = "11111111-2222-3333-4444-555555555555"
const PAGE_SIZE = 25

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
 * without firing any analytics request — enough for the back link.
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
 * The page fires one list query plus one unfiltered total-count query, used
 * for the "X of Y enrollments" summary text. Mocking by exact URL keeps the
 * assertion pinned to the request it is about.
 */
const mockTotal = (contractId: string, total: number, withheld = 0) => {
  setMockResponse.get(
    analyticsUrls.contracts.learnerProgress(ORG_UUID, contractId, {
      limit: 1,
    }),
    analyticsFactories.learnerProgressEnvelope([], {
      total_count: total,
      outcomes_withheld_count: withheld,
    }),
  )
}

const mockList = (
  contractId: string,
  rows: ReturnType<typeof analyticsFactories.learnerProgress>[],
  extraParams: Record<string, unknown> = {},
  envelopeOverrides: Record<string, unknown> = {},
) => {
  setMockResponse.get(
    analyticsUrls.contracts.learnerProgress(ORG_UUID, contractId, {
      limit: PAGE_SIZE,
      offset: 0,
      sort: "full_name",
      ...extraParams,
    }),
    analyticsFactories.learnerProgressEnvelope(rows, envelopeOverrides),
  )
}

/**
 * The module dropdown's options. Every queryable render fires this, so it is
 * mocked even in tests that never open the dropdown — an unmocked request
 * throws rather than resolving empty.
 */
const mockCourseRuns = (
  contractId: string,
  runs = [
    analyticsFactories.courseRun({
      courserun_id: "course-v1:MITx+M5+2026",
      courserun_title: "Module 5",
    }),
    analyticsFactories.courseRun({
      courserun_id: "course-v1:MITx+M6+2026",
      courserun_title: "Module 6",
    }),
  ],
) => {
  setMockResponse.get(
    analyticsUrls.contracts.courseRuns(ORG_UUID, contractId, { limit: 1000 }),
    analyticsFactories.envelope(runs),
  )
}

/**
 * The contract-wide distinct-learner count, fetched only while the Needs
 * attention filter is on. An empty envelope is a contract under the floor.
 */
const mockNeedsAttention = (
  contractId: string,
  learners: number | null = 0,
) => {
  setMockResponse.get(
    analyticsUrls.contracts.needsAttention(ORG_UUID, contractId),
    analyticsFactories.envelope([
      analyticsFactories.contractNeedsAttention({
        contract_id: Number(contractId),
        learners_needing_attention: learners,
      }),
    ]),
  )
}

describe("ContractLearnersPage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    setMockResponse.get(
      mitxUrls.userMe.get(),
      mitxFactories.user.user({ email: "manager@test.com" }),
    )
  })

  test("throws ForbiddenError when the learner analytics flag is off", () => {
    mockedUseFeatureFlagEnabled.mockReturnValue(false)
    allowConsoleErrors()

    expect(() =>
      renderWithProviders(
        <ContractLearnersPage orgSlug="acme" contractSlug="c1" />,
      ),
    ).toThrow(ForbiddenError)
  })

  test("the aggregate analytics flag alone does not open this page", () => {
    // The two dashboards roll out independently: aggregate analytics must not
    // confer access to per-learner data.
    mockedUseFeatureFlagEnabled.mockImplementation(
      (flag) => flag === FeatureFlags.B2BAnalyticsDashboard,
    )
    allowConsoleErrors()

    expect(() =>
      renderWithProviders(
        <ContractLearnersPage orgSlug="acme" contractSlug="c1" />,
      ),
    ).toThrow(ForbiddenError)
  })

  test("the learner flag alone does not open this page", () => {
    // Learner analytics is nested inside the analytics rollout: the back link
    // and framing assume the aggregate page is reachable.
    mockedUseFeatureFlagEnabled.mockImplementation(
      (flag) => flag === FeatureFlags.B2BLearnerAnalytics,
    )
    allowConsoleErrors()

    expect(() =>
      renderWithProviders(
        <ContractLearnersPage orgSlug="acme" contractSlug="c1" />,
      ),
    ).toThrow(ForbiddenError)
  })

  test("opens with both analytics flags on, linking back to aggregate analytics", async () => {
    mockedUseFeatureFlagEnabled.mockImplementation(
      (flag) =>
        flag === FeatureFlags.B2BAnalyticsDashboard ||
        flag === FeatureFlags.B2BLearnerAnalytics,
    )
    const { contract, orgSlug } = setupUnqueryable()

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    const back = await screen.findByRole("link", { name: /Program analytics/ })
    expect(back).toHaveAttribute(
      "href",
      contractAnalyticsView(orgSlug, contract.slug),
    )
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

  test("disables Export and skips the request when the org has no analytics org ID", async () => {
    const contract = mitxFactories.contracts.contract()
    const org = mitxFactories.organizations.organization({
      contracts: [contract],
      sso_organization_id: null,
    })
    const orgSlug = org.slug.replace(/^org-/, "")
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )

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
    // Ties the disabled button to the reason it's disabled, so a screen
    // reader user tabbing to it hears why, not just that it's dimmed.
    expect(exportButton).toHaveAttribute(
      "aria-describedby",
      unavailableMessage.id,
    )

    // No analytics endpoint is mocked here. If the click handler ignored
    // `canQuery` the way it ignored it before this fix, it would still call
    // `fetchQuery`, hit the unmocked endpoint, and surface a misleading
    // generic failure instead of silently no-opping.
    await user.click(exportButton)
    expect(
      screen.queryByText("Could not export learners. Please try again."),
    ).not.toBeInTheDocument()
  })

  test("renders a learner row with its real status", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockTotal(contractId, 1)
    mockCourseRuns(contractId)
    mockList(contractId, [
      analyticsFactories.learnerProgress({
        full_name: "Anton Petrov",
        courserun_title: "Module 5",
        completion_status: "certified",
        enrollment_mode: "verified",
      }),
    ])

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    const name = await screen.findByText("Anton Petrov")
    const row = rowOf(name)
    expect(within(row).getByText("Module 5")).toBeInTheDocument()
    expect(within(row).getByText("Certificate")).toBeInTheDocument()
  })

  test("a learner row shows the email alongside the name", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockTotal(contractId, 1)
    mockCourseRuns(contractId)
    mockList(contractId, [
      analyticsFactories.learnerProgress({
        full_name: "Anton Petrov",
        email: "anton@example.com",
        courserun_title: "Module 5",
      }),
    ])

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    const name = await screen.findByText("Anton Petrov")
    const row = rowOf(name)
    expect(within(row).getByText("anton@example.com")).toBeInTheDocument()
    expect(within(row).getByText("AP")).toBeInTheDocument()
  })

  test.each([
    { fullName: null, label: "null" },
    { fullName: "", label: "empty" },
    { fullName: "   ", label: "whitespace-only" },
  ])(
    "a learner with a $label name shows only the email and an icon avatar",
    async ({ fullName }) => {
      const { org, contract, orgSlug } = setup()
      const contractId = String(contract.id)
      setMockResponse.get(
        mitxUrls.organization.managerOrganizationsList(),
        paginate([org]),
      )
      mockTotal(contractId, 1)
      mockCourseRuns(contractId)
      mockList(contractId, [
        analyticsFactories.learnerProgress({
          full_name: fullName,
          email: "x7k2m@example.com",
          courserun_title: "Module 5",
        }),
      ])

      renderWithProviders(
        <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
      )

      const email = await screen.findByText("x7k2m@example.com")
      const row = rowOf(email)
      expect(within(row).getByText("Module 5")).toBeInTheDocument()
      expect(within(row).queryByText("?")).not.toBeInTheDocument()
      expect(within(row).queryByText("Unknown learner")).not.toBeInTheDocument()
      expect(row.querySelector("[aria-hidden='true'] svg")).not.toBeNull()
    },
  )

  test("a learner who withheld consent shows No consent given", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockTotal(contractId, 1)
    mockCourseRuns(contractId)
    mockList(
      contractId,
      [
        analyticsFactories.withheldLearnerProgress({
          full_name: "Private Learner",
        }),
      ],
      {},
      { outcomes_withheld_count: 1, total_count: 1 },
    )

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    const name = await screen.findByText("Private Learner")
    const row = rowOf(name)
    expect(within(row).getByText("No consent given")).toBeInTheDocument()
  })

  test("the consent banner counts withheld rows", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockTotal(contractId, 10)
    mockCourseRuns(contractId)
    mockList(
      contractId,
      [analyticsFactories.learnerProgress()],
      {},
      {
        total_count: 10,
        outcomes_withheld_count: 3,
      },
    )

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    await screen.findByText(/3 of these 10 enrollments/)
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

    test("exports the same status label the table shows, not the raw completion_status enum", async () => {
      /**
       * The analytics API deploys separately, so `needs_attention` can be
       * absent rather than null. Deleted rather than set to undefined: the
       * field is required on the type, and the point is a response that never
       * carried the key.
       */
      const legacyRow = analyticsFactories.learnerProgress({
        full_name: "Legacy Row",
      })
      delete (legacyRow as Partial<typeof legacyRow>).needs_attention

      const { org, contract, orgSlug } = setup()
      const contractId = String(contract.id)
      setMockResponse.get(
        mitxUrls.organization.managerOrganizationsList(),
        paginate([org]),
      )
      mockTotal(contractId, 2)
      mockCourseRuns(contractId)
      mockList(
        contractId,
        [
          analyticsFactories.learnerProgress({
            full_name: "Certified Learner",
          }),
        ],
        {},
        { total_count: 2 },
      )
      setMockResponse.get(
        analyticsUrls.contracts.learnerProgress(ORG_UUID, contractId, {
          sort: "full_name",
          limit: 500,
          offset: 0,
        }),
        analyticsFactories.learnerProgressEnvelope([
          analyticsFactories.learnerProgress({
            full_name: "Certified Learner",
            completion_status: "certified",
            last_active_on: "2026-09-30",
          }),
          analyticsFactories.withheldLearnerProgress({
            full_name: "Private Learner",
          }),
          legacyRow,
        ]),
      )

      renderWithProviders(
        <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
      )

      await user.click(
        await screen.findByRole("button", { name: "Export learners" }),
      )

      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      })
      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob
      const csv = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsText(blob)
      })

      // A "certified" row reads "Certificate" on screen (statusDisplay.ts)
      // and should export the same label, not the raw API enum.
      expect(csv).toContain("Certificate")
      expect(csv).not.toMatch(/,certified,/)
      expect(csv).toContain("No consent given")
      // Raw, not the screen's "Sep 30, 2026", so a spreadsheet reads it as a
      // date; the withheld row exports empty rather than a fabricated stub.
      expect(csv).toContain("Last activity")
      expect(csv).toContain(",2026-09-30")
      expect(csv).not.toContain("Sep 30, 2026")
      // Yes/No for the consented row; empty for the withheld one, whose
      // `needs_attention` is null rather than false, and empty for the row
      // from an API that does not send the field at all.
      expect(csv).toContain("Needs attention")
      const [, consented, withheld, legacy] = csv.trim().split("\n")
      expect(consented).toMatch(/,No$/)
      expect(withheld).toMatch(/,$/)
      expect(legacy).toMatch(/,$/)
    })

    test("carries the active status filter, not just pagination", async () => {
      const { org, contract, orgSlug } = setup()
      const contractId = String(contract.id)
      setMockResponse.get(
        mitxUrls.organization.managerOrganizationsList(),
        paginate([org]),
      )
      mockTotal(contractId, 2)
      mockCourseRuns(contractId)
      mockList(contractId, [
        analyticsFactories.learnerProgress({ full_name: "Everyone" }),
      ])
      mockList(
        contractId,
        [analyticsFactories.learnerProgress({ full_name: "Only Not Started" })],
        { completion_status: ["not_started"] },
      )
      // No mock for the unfiltered `{ limit: 500, offset: 0 }` export
      // request: if the export ever drops the filter again, this request
      // goes unmocked and the export fails instead of silently exporting
      // the whole contract.
      setMockResponse.get(
        analyticsUrls.contracts.learnerProgress(ORG_UUID, contractId, {
          sort: "full_name",
          completion_status: ["not_started"],
          limit: 500,
          offset: 0,
        }),
        analyticsFactories.learnerProgressEnvelope([
          analyticsFactories.learnerProgress({
            full_name: "Exported Not Started Learner",
          }),
        ]),
      )

      renderWithProviders(
        <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
      )

      await screen.findByText("Everyone")
      await user.click(await screen.findByRole("combobox", { name: /status/i }))
      await user.click(
        within(await screen.findByRole("listbox")).getByText("Not started"),
      )
      await screen.findByText("Only Not Started")

      await user.click(
        await screen.findByRole("button", { name: "Export learners" }),
      )

      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      })
      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob
      const csv = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsText(blob)
      })

      expect(csv).toContain("Exported Not Started Learner")
    })
  })

  test("shows an error state instead of a false empty result when a query fails", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    // The total-count query 500s while the list query succeeds. A single
    // failed query should still surface a combined error rather than a false
    // empty state.
    setMockResponse.get(
      analyticsUrls.contracts.learnerProgress(ORG_UUID, contractId, {
        limit: 1,
      }),
      "Internal Server Error",
      { code: 500 },
    )
    mockList(
      contractId,
      [analyticsFactories.learnerProgress()],
      {},
      { total_count: 5 },
    )
    mockCourseRuns(contractId)

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    await screen.findByText("Something went wrong loading learner data.")
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument()
    expect(screen.queryByText("No learners found.")).not.toBeInTheDocument()
  })

  test("the module dropdown lists every course run on the contract", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockTotal(contractId, 1)
    mockCourseRuns(contractId)
    mockList(contractId, [analyticsFactories.learnerProgress()])

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    const moduleSelect = await screen.findByRole("combobox", {
      name: /module/i,
    })
    await user.click(moduleSelect)

    const listbox = await screen.findByRole("listbox")
    expect(within(listbox).getByText("All modules")).toBeInTheDocument()
    // Sourced from the contract's course runs, so it covers runs with no row
    // on the current page — and runs nobody has enrolled in at all.
    expect(within(listbox).getByText("Module 5")).toBeInTheDocument()
    expect(within(listbox).getByText("Module 6")).toBeInTheDocument()
  })

  test("selecting a module sends courserun_readable_id", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockTotal(contractId, 2)
    mockCourseRuns(contractId)
    mockList(contractId, [
      analyticsFactories.learnerProgress({ full_name: "Unfiltered Learner" }),
    ])
    mockList(
      contractId,
      [analyticsFactories.learnerProgress({ full_name: "Module Six Learner" })],
      { courserun_readable_id: "course-v1:MITx+M6+2026" },
    )

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    await screen.findByText("Unfiltered Learner")

    await user.click(await screen.findByRole("combobox", { name: /module/i }))
    await user.click(
      within(await screen.findByRole("listbox")).getByText("Module 6"),
    )

    await screen.findByText("Module Six Learner")
    expect(screen.getByRole("combobox", { name: /module/i })).toHaveTextContent(
      "Module 6",
    )
  })

  /**
   * Covered separately from the request assertion above because the
   * announcement is keyed on the active filters as one string: a module-only
   * change that is missing from that key refetches the table and announces
   * nothing, with no other symptom.
   */
  test("announces the result count when the module filter changes", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockTotal(contractId, 9)
    mockCourseRuns(contractId)
    mockList(contractId, [
      analyticsFactories.learnerProgress({ full_name: "Unfiltered Learner" }),
    ])
    mockList(
      contractId,
      [analyticsFactories.learnerProgress({ full_name: "Module Six Learner" })],
      { courserun_readable_id: "course-v1:MITx+M6+2026" },
      { total_count: 4 },
    )

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )
    await screen.findByText("Unfiltered Learner")

    await user.click(await screen.findByRole("combobox", { name: /module/i }))
    await user.click(
      within(await screen.findByRole("listbox")).getByText("Module 6"),
    )
    await screen.findByText("Module Six Learner")

    expect(document.querySelector('[aria-live="assertive"]')?.textContent).toBe(
      "4 results",
    )
  })

  /**
   * A failed *refetch* keeps the last good options, so the field must not
   * claim a failure the dropdown contradicts — see its `error` prop.
   */
  test("keeps the module options and stays quiet when a refetch fails", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockTotal(contractId, 1)
    mockCourseRuns(contractId)
    mockList(contractId, [
      analyticsFactories.learnerProgress({ full_name: "Anton Petrov" }),
    ])

    const { queryClient } = renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )
    await screen.findByText("Anton Petrov")

    setMockResponse.get(
      analyticsUrls.contracts.courseRuns(ORG_UUID, contractId, { limit: 1000 }),
      "Internal Server Error",
      { code: 500 },
    )
    // A visible change on the rows query, which refetches in the same pass, is
    // the settle point: the field's own failure is by design invisible, so
    // asserting its absence straight after `refetchQueries` resolves would run
    // before React had committed either result.
    mockList(contractId, [
      analyticsFactories.learnerProgress({ full_name: "Refetched Learner" }),
    ])
    await act(async () => {
      await queryClient.refetchQueries()
    })
    await screen.findByText("Refetched Learner")

    expect(
      screen.queryByText("Couldn't load modules. Reload to try again."),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole("combobox", { name: /module/i }))
    expect(
      within(await screen.findByRole("listbox")).getByText("Module 6"),
    ).toBeInTheDocument()
  })

  test("falls back to All modules when the selected run leaves the contract", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockTotal(contractId, 2)
    mockCourseRuns(contractId)
    mockList(contractId, [
      analyticsFactories.learnerProgress({ full_name: "Unfiltered Learner" }),
    ])
    mockList(
      contractId,
      [analyticsFactories.learnerProgress({ full_name: "Module Six Learner" })],
      { courserun_readable_id: "course-v1:MITx+M6+2026" },
    )

    const { queryClient } = renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )
    await screen.findByText("Unfiltered Learner")

    await user.click(await screen.findByRole("combobox", { name: /module/i }))
    await user.click(
      within(await screen.findByRole("listbox")).getByText("Module 6"),
    )
    await screen.findByText("Module Six Learner")

    mockCourseRuns(contractId, [
      analyticsFactories.courseRun({
        courserun_id: "course-v1:MITx+M5+2026",
        courserun_title: "Module 5",
      }),
    ])
    await act(async () => {
      await queryClient.refetchQueries()
    })

    await screen.findByText("Unfiltered Learner")
    expect(screen.getByRole("combobox", { name: /module/i })).toHaveTextContent(
      "All modules",
    )
  })

  test("marks the module filter when its options fail to load", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockTotal(contractId, 1)
    mockList(contractId, [
      analyticsFactories.learnerProgress({ full_name: "Anton Petrov" }),
    ])
    setMockResponse.get(
      analyticsUrls.contracts.courseRuns(ORG_UUID, contractId, { limit: 1000 }),
      "Internal Server Error",
      { code: 500 },
    )

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    await screen.findByText("Anton Petrov")
    // The learner data loaded, so the page-level error must stay away.
    expect(
      screen.queryByText("Something went wrong loading learner data."),
    ).not.toBeInTheDocument()

    const message = screen.getByText(
      "Couldn't load modules. Reload to try again.",
    )
    expect(screen.getByRole("combobox", { name: /module/i })).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining(message.id),
    )
  })

  describe("the Last activity column", () => {
    const rowFor = async (
      overrides: Parameters<typeof analyticsFactories.learnerProgress>[0],
    ) => {
      const { org, contract, orgSlug } = setup()
      const contractId = String(contract.id)
      setMockResponse.get(
        mitxUrls.organization.managerOrganizationsList(),
        paginate([org]),
      )
      mockTotal(contractId, 1)
      mockCourseRuns(contractId)
      mockList(contractId, [
        analyticsFactories.learnerProgress({
          full_name: "Anton Petrov",
          ...overrides,
        }),
      ])

      renderWithProviders(
        <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
      )
      return rowOf(await screen.findByText("Anton Petrov"))
    }

    test("shows the day the learner was last active", async () => {
      const row = await rowFor({ last_active_on: "2026-09-30" })

      expect(within(row).getByText("Sep 30, 2026")).toBeInTheDocument()
    })

    /**
     * `last_active_on` is a plain `YYYY-MM-DD`, which `new Date` reads as UTC
     * midnight — so formatting it through a `Date` renders the day before
     * anywhere west of Greenwich. Pinned to a negative-offset zone because in
     * UTC the correct and incorrect implementations agree, and CI runs in UTC.
     */
    test("shows the same calendar day west of Greenwich", async () => {
      const tz = process.env.TZ
      process.env.TZ = "America/Los_Angeles"
      try {
        const row = await rowFor({ last_active_on: "2026-09-30" })

        expect(within(row).getByText("Sep 30, 2026")).toBeInTheDocument()
        expect(within(row).queryByText("Sep 29, 2026")).not.toBeInTheDocument()
      } finally {
        /**
         * Not a plain reassignment: `process.env` stringifies, so restoring an
         * originally-unset `TZ` would store the literal "undefined", which
         * Node reads as an invalid zone and resolves to UTC — leaving every
         * later test in this worker in UTC rather than the host zone.
         */
        if (tz === undefined) {
          delete process.env.TZ
        } else {
          process.env.TZ = tz
        }
      }
    })

    test("says so when a consenting learner has no recorded activity", async () => {
      const row = await rowFor({ last_active_on: null })

      expect(within(row).getByText("No activity")).toBeInTheDocument()
    })

    /**
     * A withheld row's activity is hidden, not absent — "No activity" there
     * would state a fact about the learner that they declined to share.
     */
    test("shows a stub, not 'No activity', for a withheld learner", async () => {
      const { org, contract, orgSlug } = setup()
      const contractId = String(contract.id)
      setMockResponse.get(
        mitxUrls.organization.managerOrganizationsList(),
        paginate([org]),
      )
      mockTotal(contractId, 1)
      mockCourseRuns(contractId)
      mockList(contractId, [
        analyticsFactories.withheldLearnerProgress({
          full_name: "Priya Raman",
        }),
      ])

      renderWithProviders(
        <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
      )

      const row = rowOf(await screen.findByText("Priya Raman"))
      expect(within(row).getByText("—")).toBeInTheDocument()
      expect(within(row).queryByText("No activity")).not.toBeInTheDocument()
    })
  })

  test("the status filter sends completion_status", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockTotal(contractId, 2)
    mockCourseRuns(contractId)
    mockList(contractId, [
      analyticsFactories.learnerProgress({ full_name: "Everyone" }),
    ])
    mockList(
      contractId,
      [analyticsFactories.learnerProgress({ full_name: "Only Not Started" })],
      { completion_status: ["not_started"] },
    )

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    await screen.findByText("Everyone")

    await user.click(await screen.findByRole("combobox", { name: /status/i }))
    await user.click(
      within(await screen.findByRole("listbox")).getByText("Not started"),
    )

    await screen.findByText("Only Not Started")
  })

  test("the Completed filter matches passed and certified, with no separate Certificate option", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockTotal(contractId, 3)
    mockCourseRuns(contractId)
    mockList(contractId, [
      analyticsFactories.learnerProgress({ full_name: "Everyone" }),
    ])
    mockList(
      contractId,
      [
        analyticsFactories.learnerProgress({
          full_name: "Passed",
          completion_status: "passed",
        }),
        analyticsFactories.learnerProgress({
          full_name: "Certified",
          completion_status: "certified",
        }),
      ],
      { completion_status: ["passed", "certified"] },
    )

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    await screen.findByText("Everyone")

    await user.click(await screen.findByRole("combobox", { name: /status/i }))
    const listbox = await screen.findByRole("listbox")
    expect(within(listbox).queryByText("Certificate")).not.toBeInTheDocument()
    await user.click(within(listbox).getByText("Completed"))

    await screen.findByText("Passed")
    await screen.findByText("Certified")
  })

  test("a status filter with no matches reads as a filter, not an empty contract", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockTotal(contractId, 5)
    mockCourseRuns(contractId)
    mockList(contractId, [
      analyticsFactories.learnerProgress({ full_name: "Everyone" }),
    ])
    mockList(contractId, [], { completion_status: ["not_started"] })

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    await screen.findByText("Everyone")

    await user.click(await screen.findByRole("combobox", { name: /status/i }))
    await user.click(
      within(await screen.findByRole("listbox")).getByText("Not started"),
    )

    // Not "No learners found." — that would read as if the contract has no
    // learners at all, when really none match the selected filter. The text
    // appears twice (the visible cell and its role="status" echo), so scope
    // to the cell.
    await within(await screen.findByRole("cell")).findByText(
      "No learners match this filter.",
    )
  })

  describe("the Needs attention filter", () => {
    /**
     * `contractWithheldCount` lands on the unfiltered total rather than the
     * row list: that is where the page reads it from, because the filtered
     * envelope reports no withheld rows by construction.
     */
    const renderWithRows = async (
      rows: ReturnType<typeof analyticsFactories.learnerProgress>[],
      extra?: (contractId: string) => void,
      contractWithheldCount = 0,
    ) => {
      const { org, contract, orgSlug } = setup()
      const contractId = String(contract.id)
      setMockResponse.get(
        mitxUrls.organization.managerOrganizationsList(),
        paginate([org]),
      )
      mockTotal(contractId, rows.length, contractWithheldCount)
      mockCourseRuns(contractId)
      mockNeedsAttention(contractId)
      mockList(contractId, rows)
      extra?.(contractId)
      renderWithProviders(
        <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
      )
      return { contractId }
    }

    const checkbox = () =>
      screen.findByRole("checkbox", { name: "Needs attention only" })

    test("flags the rows the API says need attention, and only those", async () => {
      await renderWithRows([
        analyticsFactories.learnerProgress({
          full_name: "Stale Learner",
          needs_attention: true,
        }),
        analyticsFactories.learnerProgress({
          full_name: "Active Learner",
          needs_attention: false,
        }),
      ])

      const stale = rowOf(await screen.findByText("Stale Learner"))
      const active = rowOf(await screen.findByText("Active Learner"))

      const badge = within(stale).getByText("Needs attention")
      expect(badge).toBeInTheDocument()
      expect(
        within(active).queryByText("Needs attention"),
      ).not.toBeInTheDocument()

      // The badge sits inside `CellText`, a span, so a Chip left on its
      // default `div` root would nest flow content in phrasing content —
      // which React's nesting validator does not catch.
      expect(badge.closest(".MuiChip-root")?.tagName).toBe("SPAN")
    })

    /**
     * The field is null on a withheld row, so the label must not appear
     * beside "No consent given" — it would assert an outcome the learner
     * declined to share.
     */
    test("says nothing about a learner who withheld consent", async () => {
      await renderWithRows([
        analyticsFactories.withheldLearnerProgress({
          full_name: "Private Learner",
        }),
      ])

      const row = rowOf(await screen.findByText("Private Learner"))
      expect(within(row).getByText("No consent given")).toBeInTheDocument()
      expect(within(row).queryByText("Needs attention")).not.toBeInTheDocument()
    })

    test("sends needs_attention=true when checked", async () => {
      await renderWithRows(
        [analyticsFactories.learnerProgress({ full_name: "Everyone" })],
        (contractId) =>
          mockList(
            contractId,
            [
              analyticsFactories.learnerProgress({
                full_name: "Only Stale",
                needs_attention: true,
              }),
            ],
            { needs_attention: true },
          ),
      )

      await screen.findByText("Everyone")
      await user.click(await checkbox())

      await screen.findByText("Only Stale")
    })

    /**
     * The rows are enrollments, but the dashboard card that links here counts
     * learners; naming both keeps the two numbers from reading as a mismatch.
     */
    test("names the learners behind the enrollments when it is the only filter", async () => {
      await renderWithRows(
        [analyticsFactories.learnerProgress({ full_name: "Everyone" })],
        (contractId) => {
          mockNeedsAttention(contractId, 2)
          mockList(
            contractId,
            [
              analyticsFactories.learnerProgress({ full_name: "Stale One" }),
              analyticsFactories.learnerProgress({ full_name: "Stale Two" }),
              analyticsFactories.learnerProgress({ full_name: "Stale Three" }),
            ],
            { needs_attention: true },
            { total_count: 3 },
          )
        },
      )

      await screen.findByText("Everyone")
      expect(screen.queryByText(/learners\)/)).not.toBeInTheDocument()

      await user.click(await checkbox())
      expect(
        await screen.findByText(/^3 of \d+ enrollments \(2 learners\)$/),
      ).toBeInTheDocument()
    })

    /**
     * The param is dropped rather than sent as `false`. Sending `false` would
     * ask for "only the learners who are fine", which silently drops every
     * withheld row from what reads as the unfiltered view.
     */
    test("drops the param again when unchecked, rather than sending false", async () => {
      await renderWithRows(
        [analyticsFactories.learnerProgress({ full_name: "Everyone" })],
        (contractId) =>
          mockList(
            contractId,
            [
              analyticsFactories.learnerProgress({
                full_name: "Only Stale",
                needs_attention: true,
              }),
            ],
            { needs_attention: true },
          ),
      )

      await screen.findByText("Everyone")
      await user.click(await checkbox())
      await screen.findByText("Only Stale")

      // An unmocked `needs_attention=false` URL would throw, so reaching the
      // unfiltered rows again is the assertion.
      await user.click(await checkbox())
      await screen.findByText("Everyone")
    })

    /**
     * The point of a separate control: needing attention overlaps the
     * completion statuses instead of partitioning them, so "in progress AND
     * stale" has to be expressible.
     */
    test("combines with the status filter instead of replacing it", async () => {
      await renderWithRows(
        [analyticsFactories.learnerProgress({ full_name: "Everyone" })],
        (contractId) => {
          mockList(
            contractId,
            [
              analyticsFactories.learnerProgress({
                full_name: "In Progress Only",
              }),
            ],
            { completion_status: ["in_progress"] },
          )
          mockList(
            contractId,
            [
              analyticsFactories.learnerProgress({
                full_name: "Stale And In Progress",
                needs_attention: true,
              }),
            ],
            { completion_status: ["in_progress"], needs_attention: true },
          )
        },
      )

      await screen.findByText("Everyone")

      await user.click(await screen.findByRole("combobox", { name: /status/i }))
      await user.click(
        within(await screen.findByRole("listbox")).getByText("In progress"),
      )
      await screen.findByText("In Progress Only")

      await user.click(await checkbox())
      await screen.findByText("Stale And In Progress")
    })

    test("says that withheld learners are hidden while the filter is on", async () => {
      await renderWithRows(
        [analyticsFactories.learnerProgress({ full_name: "Everyone" })],
        (contractId) =>
          mockList(
            contractId,
            [
              analyticsFactories.learnerProgress({
                full_name: "Only Stale",
                needs_attention: true,
              }),
            ],
            { needs_attention: true },
          ),
        1,
      )

      await screen.findByText("Everyone")
      expect(screen.queryByText(/are hidden while this filter/)).toBeNull()

      await user.click(await checkbox())
      await screen.findByText("Only Stale")

      await screen.findByText(/are hidden while this filter is on/)
    })

    /**
     * The notice states a fact about this contract, so on one where everybody
     * consented it would be false: nothing is hidden, and saying otherwise
     * invents a consent problem on the page meant to report consent honestly.
     */
    test("stays quiet when the contract has no withheld learners to hide", async () => {
      await renderWithRows(
        [analyticsFactories.learnerProgress({ full_name: "Everyone" })],
        (contractId) =>
          mockList(
            contractId,
            [
              analyticsFactories.learnerProgress({
                full_name: "Only Stale",
                needs_attention: true,
              }),
            ],
            { needs_attention: true },
          ),
      )

      await screen.findByText("Everyone")
      await user.click(await checkbox())
      await screen.findByText("Only Stale")

      expect(screen.queryByText(/are hidden while this filter/)).toBeNull()
    })

    test("announces the result count when the filter changes", async () => {
      await renderWithRows(
        [
          analyticsFactories.learnerProgress({ full_name: "Everyone" }),
          analyticsFactories.learnerProgress({ full_name: "Someone Else" }),
        ],
        (contractId) =>
          mockList(
            contractId,
            [
              analyticsFactories.learnerProgress({
                full_name: "Only Stale",
                needs_attention: true,
              }),
            ],
            { needs_attention: true },
          ),
      )

      await screen.findByText("Everyone")
      await user.click(await checkbox())
      await screen.findByText("Only Stale")

      await screen.findByText("1 result")
    })

    /**
     * The notice sits in no live region, so the count alone would reach a
     * screen reader as a smaller number with no reason given — the exclusion
     * has to ride along with it.
     */
    test("announces the exclusion alongside the count, not just the count", async () => {
      await renderWithRows(
        [
          analyticsFactories.learnerProgress({ full_name: "Everyone" }),
          analyticsFactories.learnerProgress({ full_name: "Someone Else" }),
        ],
        (contractId) =>
          mockList(
            contractId,
            [
              analyticsFactories.learnerProgress({
                full_name: "Only Stale",
                needs_attention: true,
              }),
            ],
            { needs_attention: true },
          ),
        1,
      )

      await screen.findByText("Everyone")
      await user.click(await checkbox())
      await screen.findByText("Only Stale")

      await waitFor(() => {
        expect(
          screen.getByText(
            "1 result. Learners who have not agreed to share their progress are hidden.",
          ),
        ).toBeInTheDocument()
      })
    })

    test("reads as a filter, not an empty contract, when nothing matches", async () => {
      await renderWithRows(
        [analyticsFactories.learnerProgress({ full_name: "Everyone" })],
        (contractId) => mockList(contractId, [], { needs_attention: true }),
      )

      await screen.findByText("Everyone")
      await user.click(await checkbox())

      await within(await screen.findByRole("cell")).findByText(
        "No learners match this filter.",
      )
    })
  })

  describe("URL state", () => {
    const renderAt = (
      filters: Parameters<typeof contractLearnersView>[2],
      mock: (contractId: string) => void,
    ) => {
      const { org, contract, orgSlug } = setup()
      const contractId = String(contract.id)
      setMockResponse.get(
        mitxUrls.organization.managerOrganizationsList(),
        paginate([org]),
      )
      mockTotal(contractId, 60)
      mockCourseRuns(contractId)
      mockNeedsAttention(contractId)
      mock(contractId)
      return renderWithProviders(
        <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
        { url: contractLearnersView(orgSlug, contract.slug, filters) },
      )
    }

    /** The learner count is contract-wide, so it cannot describe narrower rows. */
    test("leaves the learner count out once another filter narrows the rows", async () => {
      renderAt({ q: "ada", needsAttention: true }, (contractId) => {
        mockNeedsAttention(contractId, 2)
        mockList(
          contractId,
          [analyticsFactories.learnerProgress({ full_name: "Ada Stale" })],
          { search: "ada", needs_attention: true },
          { total_count: 1 },
        )
      })

      await screen.findByText("Ada Stale")
      expect(await screen.findByText("1 of 60 enrollments")).toBeInTheDocument()
    })

    test("opens with the filters a link carries", async () => {
      renderAt(
        { q: "ada", status: "in_progress", needsAttention: true },
        (contractId) =>
          mockList(
            contractId,
            [analyticsFactories.learnerProgress({ full_name: "Ada Stale" })],
            {
              search: "ada",
              completion_status: ["in_progress"],
              needs_attention: true,
            },
          ),
      )

      await screen.findByText("Ada Stale")
      expect(screen.getByPlaceholderText("Search name or email")).toHaveValue(
        "ada",
      )
      expect(
        screen.getByRole("combobox", { name: /status/i }),
      ).toHaveTextContent("In progress")
      expect(
        screen.getByRole("checkbox", { name: "Needs attention only" }),
      ).toBeChecked()
    })

    test("a Completed link matches passed and certified", async () => {
      renderAt({ status: "passed" }, (contractId) =>
        mockList(
          contractId,
          [analyticsFactories.learnerProgress({ full_name: "Finished" })],
          { completion_status: ["passed", "certified"] },
        ),
      )

      await screen.findByText("Finished")
    })

    test("applies a linked module once the contract's runs load", async () => {
      renderAt({ module: "course-v1:MITx+M6+2026" }, (contractId) =>
        mockList(
          contractId,
          [analyticsFactories.learnerProgress({ full_name: "Module 6 Only" })],
          { courserun_readable_id: "course-v1:MITx+M6+2026" },
        ),
      )

      await screen.findByText("Module 6 Only")
      expect(
        screen.getByRole("combobox", { name: /module/i }),
      ).toHaveTextContent("Module 6")
    })

    test("opens on the linked page", async () => {
      renderAt({ page: 2 }, (contractId) =>
        mockList(
          contractId,
          [analyticsFactories.learnerProgress({ full_name: "Second Page" })],
          { offset: PAGE_SIZE },
          { total_count: 60 },
        ),
      )

      await screen.findByText("Second Page")
      expect(screen.getByText("Page 2 of 3")).toBeInTheDocument()
    })

    test("ignores filter values it does not recognize", async () => {
      const { org, contract, orgSlug } = setup()
      const contractId = String(contract.id)
      setMockResponse.get(
        mitxUrls.organization.managerOrganizationsList(),
        paginate([org]),
      )
      mockTotal(contractId, 1)
      mockCourseRuns(contractId)
      mockList(contractId, [
        analyticsFactories.learnerProgress({ full_name: "Everyone" }),
      ])

      renderWithProviders(
        <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
        {
          url: `${contractLearnersView(orgSlug, contract.slug)}?status=bogus&module=course-v1:Gone&needs_attention=yes`,
        },
      )

      await screen.findByText("Everyone")
      expect(
        screen.getByRole("combobox", { name: /status/i }),
      ).toHaveTextContent("All learners")
      expect(
        screen.getByRole("combobox", { name: /module/i }),
      ).toHaveTextContent("All modules")
      expect(
        screen.getByRole("checkbox", { name: "Needs attention only" }),
      ).not.toBeChecked()
    })

    test("drops a page past the last one", async () => {
      const { location } = renderAt({ page: 9 }, (contractId) => {
        mockList(contractId, [], { offset: 8 * PAGE_SIZE }, { total_count: 1 })
        mockList(contractId, [
          analyticsFactories.learnerProgress({ full_name: "Only Learner" }),
        ])
      })

      await screen.findByText("Only Learner")
      expect(location.current.searchParams.has("page")).toBe(false)
    })

    test("writes filter changes to the URL and resets the page", async () => {
      const { location } = renderAt({ page: 2 }, (contractId) => {
        mockList(
          contractId,
          [analyticsFactories.learnerProgress({ full_name: "Second Page" })],
          { offset: PAGE_SIZE },
          { total_count: 60 },
        )
        mockList(
          contractId,
          [analyticsFactories.learnerProgress({ full_name: "Not Started" })],
          { completion_status: ["not_started"] },
        )
        mockList(
          contractId,
          [analyticsFactories.learnerProgress({ full_name: "Stale" })],
          { completion_status: ["not_started"], needs_attention: true },
        )
      })

      await screen.findByText("Second Page")
      await user.click(screen.getByRole("combobox", { name: /status/i }))
      await user.click(
        within(await screen.findByRole("listbox")).getByText("Not started"),
      )
      await screen.findByText("Not Started")
      expect(location.current.search).toBe("?status=not_started")

      await user.click(
        screen.getByRole("checkbox", { name: "Needs attention only" }),
      )
      await screen.findByText("Stale")
      expect(location.current.search).toBe(
        "?status=not_started&needs_attention=true",
      )
    })

    test("writes the search to the URL once typing settles", async () => {
      const { location } = renderAt({}, (contractId) => {
        mockList(contractId, [
          analyticsFactories.learnerProgress({ full_name: "Everyone" }),
        ])
        mockList(
          contractId,
          [analyticsFactories.learnerProgress({ full_name: "Ada" })],
          { search: "ada" },
        )
      })

      await screen.findByText("Everyone")
      await user.type(
        screen.getByPlaceholderText("Search name or email"),
        "ada",
      )
      await screen.findByText("Ada")
      expect(location.current.searchParams.get("q")).toBe("ada")
    })

    test("clearing a filter leaves no trace in the URL", async () => {
      const { location } = renderAt({ needsAttention: true }, (contractId) => {
        mockList(
          contractId,
          [analyticsFactories.learnerProgress({ full_name: "Stale" })],
          { needs_attention: true },
        )
        mockList(contractId, [
          analyticsFactories.learnerProgress({ full_name: "Everyone" }),
        ])
      })

      await screen.findByText("Stale")
      await user.click(
        screen.getByRole("checkbox", { name: "Needs attention only" }),
      )
      await screen.findByText("Everyone")
      expect(location.current.search).toBe("")
    })

    test("does not announce the filters a link opened with", async () => {
      renderAt({ status: "in_progress" }, (contractId) =>
        mockList(
          contractId,
          [analyticsFactories.learnerProgress({ full_name: "In Progress" })],
          { completion_status: ["in_progress"] },
        ),
      )

      await screen.findByText("In Progress")
      expect(screen.queryByText(/^\d+ results?$/)).not.toBeInTheDocument()
    })
  })
})
