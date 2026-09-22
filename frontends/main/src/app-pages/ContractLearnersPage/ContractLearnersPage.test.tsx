import React from "react"
import { renderWithProviders, screen, user, within } from "@/test-utils"
import { waitFor } from "@testing-library/react"
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
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
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
 * The page fires one list query plus four unfiltered count queries, and the
 * count queries differ from the list only by their params. Mocking them by
 * exact URL keeps each assertion pinned to the request it is about.
 */
const mockCounts = (
  contractId: string,
  counts: {
    total: number
    notStarted: number
    inProgress: number
    completed: number
  },
) => {
  const base = { limit: 1 }
  setMockResponse.get(
    analyticsUrls.contracts.learnerProgress(ORG_UUID, contractId, base),
    analyticsFactories.learnerProgressEnvelope([], {
      total_count: counts.total,
    }),
  )
  setMockResponse.get(
    analyticsUrls.contracts.learnerProgress(ORG_UUID, contractId, {
      ...base,
      completion_status: ["not_started"],
    }),
    analyticsFactories.learnerProgressEnvelope([], {
      total_count: counts.notStarted,
    }),
  )
  setMockResponse.get(
    analyticsUrls.contracts.learnerProgress(ORG_UUID, contractId, {
      ...base,
      completion_status: ["in_progress"],
    }),
    analyticsFactories.learnerProgressEnvelope([], {
      total_count: counts.inProgress,
    }),
  )
  setMockResponse.get(
    analyticsUrls.contracts.learnerProgress(ORG_UUID, contractId, {
      ...base,
      completion_status: ["passed", "certified"],
    }),
    analyticsFactories.learnerProgressEnvelope([], {
      total_count: counts.completed,
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

const mockFunnel = (contractId: string) => {
  setMockResponse.get(
    analyticsUrls.contracts.enrollmentFunnel(ORG_UUID, contractId, {
      limit: 1000,
    }),
    analyticsFactories.envelope([
      analyticsFactories.enrollmentCompletionFunnel({
        courserun_readable_id: "course-v1:MITx+M5+2026",
        courserun_title: "Module 5",
      }),
      analyticsFactories.enrollmentCompletionFunnel({
        courserun_readable_id: "course-v1:MITx+M6+2026",
        courserun_title: "Module 6",
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

  test("throws ForbiddenError when the analytics flag is off", () => {
    mockedUseFeatureFlagEnabled.mockReturnValue(false)
    allowConsoleErrors()

    expect(() =>
      renderWithProviders(
        <ContractLearnersPage orgSlug="acme" contractSlug="c1" />,
      ),
    ).toThrow(ForbiddenError)
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

  test("renders the stat tiles from their own count queries", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockCounts(contractId, {
      total: 168,
      notStarted: 14,
      inProgress: 125,
      completed: 29,
    })
    mockList(
      contractId,
      [analyticsFactories.learnerProgress()],
      {},
      {
        total_count: 168,
      },
    )
    mockFunnel(contractId)

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    const enrollments = await screen.findByRole("group", {
      name: "Enrollments",
    })
    expect(await within(enrollments).findByText("168")).toBeInTheDocument()

    const notStarted = screen.getByRole("group", { name: "Not started" })
    expect(await within(notStarted).findByText("14")).toBeInTheDocument()

    const inProgress = screen.getByRole("group", { name: "In progress" })
    expect(await within(inProgress).findByText("125")).toBeInTheDocument()

    const completed = screen.getByRole("group", { name: "Completed" })
    expect(await within(completed).findByText("29")).toBeInTheDocument()
  })

  test("renders a learner row with its real status", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockCounts(contractId, {
      total: 1,
      notStarted: 0,
      inProgress: 1,
      completed: 0,
    })
    mockList(contractId, [
      analyticsFactories.learnerProgress({
        full_name: "Anton Petrov",
        courserun_title: "Module 5",
        completion_status: "certified",
        enrollment_mode: "verified",
      }),
    ])
    mockFunnel(contractId)

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    const name = await screen.findByText("Anton Petrov")
    const row = rowOf(name)
    expect(within(row).getByText("Module 5")).toBeInTheDocument()
    expect(within(row).getByText("Certificate")).toBeInTheDocument()
  })

  test("a learner who withheld consent shows No consent given", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockCounts(contractId, {
      total: 1,
      notStarted: 0,
      inProgress: 0,
      completed: 0,
    })
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
    mockFunnel(contractId)

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
    mockCounts(contractId, {
      total: 10,
      notStarted: 0,
      inProgress: 10,
      completed: 0,
    })
    mockList(
      contractId,
      [analyticsFactories.learnerProgress()],
      {},
      {
        total_count: 10,
        outcomes_withheld_count: 3,
      },
    )
    mockFunnel(contractId)

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
      const { org, contract, orgSlug } = setup()
      const contractId = String(contract.id)
      setMockResponse.get(
        mitxUrls.organization.managerOrganizationsList(),
        paginate([org]),
      )
      mockCounts(contractId, {
        total: 2,
        notStarted: 0,
        inProgress: 0,
        completed: 1,
      })
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
      mockFunnel(contractId)
      setMockResponse.get(
        analyticsUrls.contracts.learnerProgress(ORG_UUID, contractId, {
          limit: 1000,
          offset: 0,
        }),
        analyticsFactories.learnerProgressEnvelope([
          analyticsFactories.learnerProgress({
            full_name: "Certified Learner",
            completion_status: "certified",
          }),
          analyticsFactories.withheldLearnerProgress({
            full_name: "Private Learner",
          }),
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
    })
  })

  test("shows an error state instead of a false empty result when a query fails", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    const base = { limit: 1 }
    setMockResponse.get(
      analyticsUrls.contracts.learnerProgress(ORG_UUID, contractId, base),
      analyticsFactories.learnerProgressEnvelope([], { total_count: 5 }),
    )
    // The not-started count query 500s; the rest succeed. A single failed
    // query among the five should still surface a combined error rather than
    // a false empty state or a tile that spins forever.
    setMockResponse.get(
      analyticsUrls.contracts.learnerProgress(ORG_UUID, contractId, {
        ...base,
        completion_status: ["not_started"],
      }),
      "Internal Server Error",
      { code: 500 },
    )
    setMockResponse.get(
      analyticsUrls.contracts.learnerProgress(ORG_UUID, contractId, {
        ...base,
        completion_status: ["in_progress"],
      }),
      analyticsFactories.learnerProgressEnvelope([], { total_count: 0 }),
    )
    setMockResponse.get(
      analyticsUrls.contracts.learnerProgress(ORG_UUID, contractId, {
        ...base,
        completion_status: ["passed", "certified"],
      }),
      analyticsFactories.learnerProgressEnvelope([], { total_count: 0 }),
    )
    mockList(
      contractId,
      [analyticsFactories.learnerProgress()],
      {},
      { total_count: 5 },
    )
    mockFunnel(contractId)

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    await screen.findByText("Something went wrong loading learner data.")
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument()
    expect(screen.queryByText("No learners found.")).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Enrollments" })).toBeNull()
  })

  /**
   * Disabled: module filter — see ContractLearnersPage.tsx's file header
   * comment. `test.skip` rather than deleting, so these stay real,
   * type-checked code and re-enable by dropping `.skip` once the block they
   * cover is restored.
   */
  test.skip("the module dropdown lists every course run on the contract", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockCounts(contractId, {
      total: 1,
      notStarted: 0,
      inProgress: 1,
      completed: 0,
    })
    mockList(contractId, [analyticsFactories.learnerProgress()])
    mockFunnel(contractId)

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    const moduleSelect = await screen.findByRole("combobox", {
      name: /module/i,
    })
    await user.click(moduleSelect)

    const listbox = await screen.findByRole("listbox")
    expect(within(listbox).getByText("All modules")).toBeInTheDocument()
    // Sourced from enrollment-funnel, so it covers runs with no row on the
    // current page.
    expect(within(listbox).getByText("Module 5")).toBeInTheDocument()
    expect(within(listbox).getByText("Module 6")).toBeInTheDocument()
  })

  test.skip("selecting a module sends courserun_readable_id", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockCounts(contractId, {
      total: 2,
      notStarted: 0,
      inProgress: 2,
      completed: 0,
    })
    mockList(contractId, [
      analyticsFactories.learnerProgress({ full_name: "Unfiltered Learner" }),
    ])
    mockFunnel(contractId)
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
  })

  test("the status filter sends completion_status", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockCounts(contractId, {
      total: 2,
      notStarted: 1,
      inProgress: 1,
      completed: 0,
    })
    mockList(contractId, [
      analyticsFactories.learnerProgress({ full_name: "Everyone" }),
    ])
    mockFunnel(contractId)
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

  test("the Completed filter matches the Completed tile, with no separate Certificate option", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockCounts(contractId, {
      total: 3,
      notStarted: 1,
      inProgress: 0,
      completed: 2,
    })
    mockList(contractId, [
      analyticsFactories.learnerProgress({ full_name: "Everyone" }),
    ])
    mockFunnel(contractId)
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
    mockCounts(contractId, {
      total: 5,
      notStarted: 0,
      inProgress: 5,
      completed: 0,
    })
    mockList(contractId, [
      analyticsFactories.learnerProgress({ full_name: "Everyone" }),
    ])
    mockFunnel(contractId)
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

  /**
   * Disabled: row/bulk selection + Send reminder — see
   * ContractLearnersPage.tsx's file header comment. `test.skip` rather than
   * deleting; re-enable by dropping `.skip` once that block and the matching
   * one in LearnerRow.tsx are restored.
   */
  test.skip("row checkboxes are individually named for screen readers", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockCounts(contractId, {
      total: 1,
      notStarted: 0,
      inProgress: 1,
      completed: 0,
    })
    mockList(contractId, [
      analyticsFactories.learnerProgress({
        full_name: "Anton Petrov",
        courserun_title: "Module 5",
      }),
    ])
    mockFunnel(contractId)

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    // Guards the MUI-over-smoot-design Checkbox choice: smoot's takes no
    // aria-label, so a regression back to it would leave this unnamed.
    await screen.findByRole("checkbox", {
      name: "Select Anton Petrov, Module 5",
    })
    await screen.findByRole("checkbox", {
      name: "Select all learners on this page",
    })
  })

  test.skip("bulk reminder is disabled until a row is selected", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    mockCounts(contractId, {
      total: 1,
      notStarted: 0,
      inProgress: 1,
      completed: 0,
    })
    mockList(contractId, [
      analyticsFactories.learnerProgress({ full_name: "Anton Petrov" }),
    ])
    mockFunnel(contractId)

    renderWithProviders(
      <ContractLearnersPage orgSlug={orgSlug} contractSlug={contract.slug} />,
    )

    const selectAll = await screen.findByRole("checkbox", {
      name: "Select all learners on this page",
    })
    const bulkButton = screen
      .getAllByRole("button", { name: "Send reminder" })
      .at(-1)!
    expect(bulkButton).toBeDisabled()

    await user.click(selectAll)
    expect(bulkButton).toBeEnabled()
  })
})
