import React from "react"
import { renderWithProviders, screen, user, within } from "@/test-utils"
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
  const base = { limit: 1, include_inactive: true }
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
      include_inactive: true,
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

  test("shows an error state instead of a false empty result when a query fails", async () => {
    const { org, contract, orgSlug } = setup()
    const contractId = String(contract.id)
    setMockResponse.get(
      mitxUrls.organization.managerOrganizationsList(),
      paginate([org]),
    )
    const base = { limit: 1, include_inactive: true }
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
