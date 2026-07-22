import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import { act, waitFor } from "@testing-library/react"
import { setMockResponse } from "api/test-utils"
import { factories, urls } from "api/mitxonline-test-utils"
import { useFeatureFlagEnabled } from "posthog-js/react"
import { allowConsoleErrors } from "ol-test-utilities"
import { ForbiddenError } from "@/common/errors"
import { useFeatureFlagsLoaded } from "@/common/useFeatureFlagsLoaded"
import ContractAdminPage from "./ContractAdminPage"

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

jest.mock("posthog-js/react", () => ({
  ...jest.requireActual("posthog-js/react"),
  useFeatureFlagEnabled: jest.fn(),
}))
jest.mock("@/common/useFeatureFlagsLoaded")
const mockedUseFeatureFlagsLoaded = jest.mocked(useFeatureFlagsLoaded)
const mockedUseFeatureFlagEnabled = jest.mocked(useFeatureFlagEnabled)

const managerOrgsUrl = urls.organization.managerOrganizationsList()
const managerContractDetailUrl = urls.contracts.managerContractDetail

const makeContractDetail = (
  contract: ReturnType<typeof factories.contracts.contract>,
  overrides: {
    // null is a meaningful value for uncapped contracts (no max_learners), so
    // these use an explicit `=== undefined` check rather than `??` below — a
    // nullish fallback would clobber an intentional null back to the default.
    total_codes?: number | null
    assigned_codes?: number
    unassigned_codes?: number | null
    redeemed_codes?: number
    total_enrollments?: number
  } = {},
) => ({
  ...contract,
  attachment_percentage: null,
  total_enrollments: overrides.total_enrollments ?? 0,
  total_codes: overrides.total_codes === undefined ? 10 : overrides.total_codes,
  assigned_codes: overrides.assigned_codes ?? 2,
  unassigned_codes:
    overrides.unassigned_codes === undefined ? 6 : overrides.unassigned_codes,
  redeemed_codes: overrides.redeemed_codes ?? 2,
})

const makeOrgWithContract = () => {
  const contract = factories.contracts.contract()
  const org = factories.organizations.organization({ contracts: [contract] })
  return { org, contract }
}

describe("ContractAdminPage", () => {
  beforeEach(() => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(false)
    mockedUseFeatureFlagEnabled.mockReturnValue(undefined)
    setMockResponse.get(
      urls.userMe.get(),
      factories.user.user({ email: "manager@test.com" }),
    )
  })

  test("throws ForbiddenError when feature flag is disabled", () => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlagEnabled.mockReturnValue(false)
    allowConsoleErrors()

    expect(() =>
      renderWithProviders(
        <ContractAdminPage orgSlug="any-org" contractSlug="any-contract" />,
      ),
    ).toThrow(ForbiddenError)
  })

  test("throws ForbiddenError when flags are loaded but flag is absent", () => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlagEnabled.mockReturnValue(undefined)
    allowConsoleErrors()

    expect(() =>
      renderWithProviders(
        <ContractAdminPage orgSlug="any-org" contractSlug="any-contract" />,
      ),
    ).toThrow(ForbiddenError)
  })

  test("renders a skeleton while PostHog flags are still loading", () => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(false)
    mockedUseFeatureFlagEnabled.mockReturnValue(undefined)

    renderWithProviders(
      <ContractAdminPage orgSlug="any-org" contractSlug="any-contract" />,
    )

    // Skeleton renders as a non-null child; not a 403 error page
    expect(
      screen.queryByRole("heading", { name: /forbidden/i }),
    ).not.toBeInTheDocument()
  })

  test("shows 'Something went wrong' when the manager orgs API call fails", async () => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlagEnabled.mockReturnValue(true)
    allowConsoleErrors()

    setMockResponse.get(managerOrgsUrl, "Internal Server Error", { code: 500 })

    renderWithProviders(
      <ContractAdminPage orgSlug="any-org" contractSlug="any-contract" />,
    )

    await screen.findByRole("heading", { name: "Something went wrong" })
  })

  test("shows 'Access denied' when user is not a manager for the requested org", async () => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlagEnabled.mockReturnValue(true)

    const otherOrg = factories.organizations.organization({})
    setMockResponse.get(managerOrgsUrl, {
      count: 1,
      next: null,
      previous: null,
      results: [otherOrg],
    })

    renderWithProviders(
      <ContractAdminPage orgSlug="not-my-org" contractSlug="some-contract" />,
    )

    await screen.findByRole("heading", { name: "Access denied" })
  })

  test("shows 'Contract not found' when org is found but contract slug does not match", async () => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlagEnabled.mockReturnValue(true)

    const { org } = makeOrgWithContract()
    setMockResponse.get(managerOrgsUrl, {
      count: 1,
      next: null,
      previous: null,
      results: [org],
    })

    renderWithProviders(
      <ContractAdminPage
        orgSlug={org.slug}
        contractSlug="wrong-contract-slug"
      />,
    )

    await screen.findByRole("heading", { name: "Contract not found" })
  })

  test("renders org name and contract name when flag is on and user is a manager", async () => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlagEnabled.mockReturnValue(true)

    const { org, contract } = makeOrgWithContract()
    setMockResponse.get(managerOrgsUrl, {
      count: 1,
      next: null,
      previous: null,
      results: [org],
    })
    setMockResponse.get(
      managerContractDetailUrl(org.id, contract.id),
      makeContractDetail(contract),
    )
    setMockResponse.get(
      urls.contracts.managerContractCodes(org.id, contract.id, {
        page: 1,
        page_size: 25,
      }),
      factories.contracts.paginatedContractCodes([]),
    )

    renderWithProviders(
      <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
    )

    await screen.findByRole("heading", { name: org.name })
    expect(screen.getByText(contract.name)).toBeInTheDocument()
  })

  test("renders seat count from contract detail", async () => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlagEnabled.mockReturnValue(true)

    const { org, contract } = makeOrgWithContract()
    setMockResponse.get(managerOrgsUrl, {
      count: 1,
      next: null,
      previous: null,
      results: [org],
    })
    setMockResponse.get(
      managerContractDetailUrl(org.id, contract.id),
      makeContractDetail(contract, { total_codes: 75, total_enrollments: 12 }),
    )
    setMockResponse.get(
      urls.contracts.managerContractCodes(org.id, contract.id, {
        page: 1,
        page_size: 25,
      }),
      factories.contracts.paginatedContractCodes([]),
    )

    renderWithProviders(
      <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
    )

    await screen.findByText("75 seats")
  })

  test("renders per-status stats from contract detail", async () => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlagEnabled.mockReturnValue(true)

    const { org, contract } = makeOrgWithContract()
    setMockResponse.get(managerOrgsUrl, {
      count: 1,
      next: null,
      previous: null,
      results: [org],
    })
    setMockResponse.get(
      managerContractDetailUrl(org.id, contract.id),
      makeContractDetail(contract, {
        total_codes: 30,
        assigned_codes: 10,
        unassigned_codes: 15,
        redeemed_codes: 5,
      }),
    )
    setMockResponse.get(
      urls.contracts.managerContractCodes(org.id, contract.id, {
        page: 1,
        page_size: 25,
      }),
      factories.contracts.paginatedContractCodes([]),
    )

    renderWithProviders(
      <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
    )

    // Wait for contract detail to finish loading (skeletons replaced by values)
    await screen.findByText("30")
    expect(
      screen.getByRole("group", { name: "Total purchased" }),
    ).toHaveTextContent("30")
    expect(screen.getByRole("group", { name: "Unassigned" })).toHaveTextContent(
      "15",
    )
    expect(
      screen.getByRole("group", { name: "Pending claim" }),
    ).toHaveTextContent("10")
    expect(screen.getByRole("group", { name: "Redeemed" })).toHaveTextContent(
      "5",
    )
  })

  test("Redeemed tab filters to redeemed codes only", async () => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlagEnabled.mockReturnValue(true)

    const { org, contract } = makeOrgWithContract()
    setMockResponse.get(managerOrgsUrl, {
      count: 1,
      next: null,
      previous: null,
      results: [org],
    })
    setMockResponse.get(
      managerContractDetailUrl(org.id, contract.id),
      makeContractDetail(contract, {
        total_codes: 2,
        assigned_codes: 1,
        redeemed_codes: 1,
        unassigned_codes: 0,
      }),
    )

    const assignedCode = factories.contracts.contractCode({
      redemption_status: "assigned",
      assigned_to: "pending@example.com",
    })
    const redeemedCode = factories.contracts.contractCode({
      redemption_status: "redeemed",
      assigned_to: "redeemed@example.com",
      redeemed_by: "claimer@example.com",
      redeemed_on: new Date().toISOString(),
    })

    setMockResponse.get(
      urls.contracts.managerContractCodes(org.id, contract.id, {
        page: 1,
        page_size: 25,
      }),
      factories.contracts.paginatedContractCodes([assignedCode, redeemedCode]),
    )
    setMockResponse.get(
      urls.contracts.managerContractCodes(org.id, contract.id, {
        page: 1,
        page_size: 25,
        status: "redeemed",
      }),
      factories.contracts.paginatedContractCodes([redeemedCode]),
    )

    renderWithProviders(
      <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
    )

    await screen.findByText("pending@example.com")

    await user.click(screen.getByRole("tab", { name: "Redeemed" }))

    await screen.findByText("redeemed@example.com")
    expect(screen.queryByText("pending@example.com")).not.toBeInTheDocument()
  })

  describe("CSV export", () => {
    const setupPage = (
      org: ReturnType<typeof factories.organizations.organization>,
      contract: ReturnType<typeof factories.contracts.contract>,
      overrides: Parameters<typeof makeContractDetail>[1] = {},
    ) => {
      setMockResponse.get(managerOrgsUrl, {
        count: 1,
        next: null,
        previous: null,
        results: [org],
      })
      setMockResponse.get(
        managerContractDetailUrl(org.id, contract.id),
        makeContractDetail(contract, overrides),
      )
      setMockResponse.get(
        urls.contracts.managerContractCodes(org.id, contract.id, {
          page: 1,
          page_size: 25,
        }),
        factories.contracts.paginatedContractCodes([]),
      )
    }

    const mockAnchorClick = jest.fn()
    const mockCreateObjectURL = jest.fn().mockReturnValue("blob:fake-url")
    const mockRevokeObjectURL = jest.fn()

    beforeEach(() => {
      mockedUseFeatureFlagsLoaded.mockReturnValue(true)
      mockedUseFeatureFlagEnabled.mockReturnValue(true)
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

    test("triggers download with correct filename for a single page of results", async () => {
      const { org, contract } = makeOrgWithContract()
      setupPage(org, contract, { total_codes: 2 })

      setMockResponse.get(
        urls.contracts.managerContractCodes(org.id, contract.id, {
          page: 1,
          page_size: 500,
        }),
        factories.contracts.paginatedContractCodes([
          factories.contracts.contractCode({
            assigned_to: "alice@example.com",
          }),
          factories.contracts.contractCode({ assigned_to: "bob@example.com" }),
        ]),
      )

      renderWithProviders(
        <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
      )

      await screen.findByRole("button", { name: "Export CSV" })
      await user.click(screen.getByRole("button", { name: "Export CSV" }))

      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalledWith(expect.any(Blob))
      })
      expect(mockAnchorClick).toHaveBeenCalledTimes(1)
      const clickedAnchor = mockAnchorClick.mock
        .instances[0] as HTMLAnchorElement
      expect(clickedAnchor.download).toBe("seat-assignments.csv")
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:fake-url")
      await screen.findByText("CSV download started.")
    })

    test("fetches additional pages and includes all rows in the CSV", async () => {
      const { org, contract } = makeOrgWithContract()
      setupPage(org, contract, { total_codes: 2 })

      setMockResponse.get(
        urls.contracts.managerContractCodes(org.id, contract.id, {
          page: 1,
          page_size: 500,
        }),
        factories.contracts.paginatedContractCodes(
          [
            factories.contracts.contractCode({
              assigned_to: "alice@example.com",
            }),
          ],
          { count: 2, next: "next-page" },
        ),
      )
      setMockResponse.get(
        urls.contracts.managerContractCodes(org.id, contract.id, {
          page: 2,
          page_size: 500,
        }),
        factories.contracts.paginatedContractCodes([
          factories.contracts.contractCode({ assigned_to: "bob@example.com" }),
        ]),
      )

      renderWithProviders(
        <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
      )

      await screen.findByRole("button", { name: "Export CSV" })
      await user.click(screen.getByRole("button", { name: "Export CSV" }))

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
      expect(csv).toContain("alice@example.com")
      expect(csv).toContain("bob@example.com")
    })

    test("shows error alert when the export request fails", async () => {
      allowConsoleErrors()
      const { org, contract } = makeOrgWithContract()
      setupPage(org, contract, { total_codes: 1 })

      setMockResponse.get(
        urls.contracts.managerContractCodes(org.id, contract.id, {
          page: 1,
          page_size: 500,
        }),
        "Internal Server Error",
        { code: 500 },
      )

      renderWithProviders(
        <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
      )

      await screen.findByRole("button", { name: "Export CSV" })
      await user.click(screen.getByRole("button", { name: "Export CSV" }))

      await screen.findByText("Could not export CSV. Please try again.")
    })

    const assertiveLiveRegionText = () =>
      [...document.querySelectorAll('[aria-live="assertive"]')]
        .map((el) => el.textContent ?? "")
        .join(" ")

    // The smoot-design Alert only exposes its aria-describedby ("success/error
    // message") to NVDA, not its children, so the real message is mirrored into
    // an assertive live region. It must be assertive: the Alert's hardcoded
    // role="alert" already fires assertively, and a polite mirror lands right
    // after it and gets dropped by NVDA.
    test("announces a successful export via an assertive live region", async () => {
      const { org, contract } = makeOrgWithContract()
      setupPage(org, contract, { total_codes: 1 })

      setMockResponse.get(
        urls.contracts.managerContractCodes(org.id, contract.id, {
          page: 1,
          page_size: 500,
        }),
        factories.contracts.paginatedContractCodes([
          factories.contracts.contractCode({
            assigned_to: "alice@example.com",
          }),
        ]),
      )

      renderWithProviders(
        <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
      )

      await screen.findByRole("button", { name: "Export CSV" })
      await user.click(screen.getByRole("button", { name: "Export CSV" }))

      await waitFor(() => {
        expect(assertiveLiveRegionText()).toContain("CSV download started.")
      })
    })

    test("announces an export failure via an assertive live region", async () => {
      allowConsoleErrors()
      const { org, contract } = makeOrgWithContract()
      setupPage(org, contract, { total_codes: 1 })

      setMockResponse.get(
        urls.contracts.managerContractCodes(org.id, contract.id, {
          page: 1,
          page_size: 500,
        }),
        "Internal Server Error",
        { code: 500 },
      )

      renderWithProviders(
        <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
      )

      await screen.findByRole("button", { name: "Export CSV" })
      await user.click(screen.getByRole("button", { name: "Export CSV" }))

      await waitFor(() => {
        expect(assertiveLiveRegionText()).toContain(
          "Could not export CSV. Please try again.",
        )
      })
    })

    // The visual Alert (role="alert") is the auto-dismissing element; the
    // message also lives in the aria-live mirror region (no role), so querying
    // by role="alert" targets only the toast, not the mirror.
    test("auto-dismisses the success alert after its timeout", async () => {
      jest.useFakeTimers()
      try {
        const timerUser = user.setup({
          advanceTimers: jest.advanceTimersByTime,
        })
        const { org, contract } = makeOrgWithContract()
        setupPage(org, contract, { total_codes: 1 })

        setMockResponse.get(
          urls.contracts.managerContractCodes(org.id, contract.id, {
            page: 1,
            page_size: 500,
          }),
          factories.contracts.paginatedContractCodes([
            factories.contracts.contractCode({
              assigned_to: "alice@example.com",
            }),
          ]),
        )

        renderWithProviders(
          <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
        )

        await timerUser.click(
          await screen.findByRole("button", { name: "Export CSV" }),
        )

        const alert = await screen.findByRole("alert")
        expect(alert).toHaveTextContent("CSV download started.")

        act(() => {
          jest.advanceTimersByTime(5000)
        })

        await waitFor(() => {
          expect(screen.queryByRole("alert")).not.toBeInTheDocument()
        })
      } finally {
        jest.useRealTimers()
      }
    })

    test("does not auto-dismiss the error alert", async () => {
      allowConsoleErrors()
      jest.useFakeTimers()
      try {
        const timerUser = user.setup({
          advanceTimers: jest.advanceTimersByTime,
        })
        const { org, contract } = makeOrgWithContract()
        setupPage(org, contract, { total_codes: 1 })

        setMockResponse.get(
          urls.contracts.managerContractCodes(org.id, contract.id, {
            page: 1,
            page_size: 500,
          }),
          "Internal Server Error",
          { code: 500 },
        )

        renderWithProviders(
          <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
        )

        await timerUser.click(
          await screen.findByRole("button", { name: "Export CSV" }),
        )

        const alert = await screen.findByRole("alert")
        expect(alert).toHaveTextContent(
          "Could not export CSV. Please try again.",
        )

        // Advance well past the success auto-hide window; the error must remain.
        act(() => {
          jest.advanceTimersByTime(10000)
        })

        expect(screen.getByRole("alert")).toHaveTextContent(
          "Could not export CSV. Please try again.",
        )
      } finally {
        jest.useRealTimers()
      }
    })
  })

  describe("header stat counts refresh after mutations", () => {
    test("bulk-assigning seats updates Unassigned and Pending claim counts", async () => {
      mockedUseFeatureFlagsLoaded.mockReturnValue(true)
      mockedUseFeatureFlagEnabled.mockReturnValue(true)

      const { org, contract } = makeOrgWithContract()
      setMockResponse.get(managerOrgsUrl, {
        count: 1,
        next: null,
        previous: null,
        results: [org],
      })

      let contractDetailCalls = 0
      setMockResponse.get(managerContractDetailUrl(org.id, contract.id), () => {
        contractDetailCalls += 1
        return contractDetailCalls === 1
          ? makeContractDetail(contract, {
              total_codes: 10,
              assigned_codes: 2,
              unassigned_codes: 6,
              redeemed_codes: 2,
            })
          : makeContractDetail(contract, {
              total_codes: 10,
              assigned_codes: 3,
              unassigned_codes: 5,
              redeemed_codes: 2,
            })
      })
      setMockResponse.get(
        urls.contracts.managerContractCodes(org.id, contract.id, {
          page: 1,
          page_size: 25,
        }),
        factories.contracts.paginatedContractCodes([]),
      )
      setMockResponse.post(
        urls.contracts.managerContractBulkAssign(org.id, contract.id),
        factories.contracts.bulkAssignResult({
          assigned: [factories.contracts.contractCode()],
          errors: [],
        }),
      )

      renderWithProviders(
        <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
      )

      expect(
        await screen.findByRole("group", { name: "Unassigned" }),
      ).toHaveTextContent("6")

      const textarea = screen.getByPlaceholderText(/enter employee emails/i)
      await user.click(textarea)
      await user.paste("alice@example.com")
      await user.click(screen.getByRole("button", { name: "Assign Seats" }))
      await user.click(
        screen.getByRole("button", { name: /send 1 invitation/i }),
      )

      await waitFor(() => {
        expect(
          screen.getByRole("group", { name: "Unassigned" }),
        ).toHaveTextContent("5")
      })
      expect(
        screen.getByRole("group", { name: "Pending claim" }),
      ).toHaveTextContent("3")
    })

    test("releasing a seat updates Unassigned and Pending claim counts", async () => {
      mockedUseFeatureFlagsLoaded.mockReturnValue(true)
      mockedUseFeatureFlagEnabled.mockReturnValue(true)

      const { org, contract } = makeOrgWithContract()
      setMockResponse.get(managerOrgsUrl, {
        count: 1,
        next: null,
        previous: null,
        results: [org],
      })

      let contractDetailCalls = 0
      setMockResponse.get(managerContractDetailUrl(org.id, contract.id), () => {
        contractDetailCalls += 1
        return contractDetailCalls === 1
          ? makeContractDetail(contract, {
              total_codes: 10,
              assigned_codes: 2,
              unassigned_codes: 6,
              redeemed_codes: 2,
            })
          : makeContractDetail(contract, {
              total_codes: 10,
              assigned_codes: 1,
              unassigned_codes: 7,
              redeemed_codes: 2,
            })
      })

      const assignedCode = factories.contracts.contractCode({
        redemption_status: "assigned",
        assigned_to: "pending@example.com",
      })
      setMockResponse.get(
        urls.contracts.managerContractCodes(org.id, contract.id, {
          page: 1,
          page_size: 25,
        }),
        factories.contracts.paginatedContractCodes([assignedCode]),
      )
      setMockResponse.delete(
        urls.contracts.managerContractCodeRevoke(
          org.id,
          contract.id,
          assignedCode.code,
        ),
        assignedCode,
      )

      renderWithProviders(
        <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
      )

      expect(
        await screen.findByRole("group", { name: "Unassigned" }),
      ).toHaveTextContent("6")

      await user.click(screen.getByRole("button", { name: /more actions/i }))
      await user.click(screen.getByRole("menuitem", { name: "Release seat" }))
      await user.click(screen.getByRole("button", { name: "Release seat" }))

      await waitFor(() => {
        expect(
          screen.getByRole("group", { name: "Unassigned" }),
        ).toHaveTextContent("7")
      })
      expect(
        screen.getByRole("group", { name: "Pending claim" }),
      ).toHaveTextContent("1")
    })
  })

  test("Pending claim tab filters to assigned codes only", async () => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlagEnabled.mockReturnValue(true)

    const { org, contract } = makeOrgWithContract()
    setMockResponse.get(managerOrgsUrl, {
      count: 1,
      next: null,
      previous: null,
      results: [org],
    })
    setMockResponse.get(
      managerContractDetailUrl(org.id, contract.id),
      makeContractDetail(contract, {
        total_codes: 2,
        assigned_codes: 1,
        redeemed_codes: 1,
        unassigned_codes: 0,
      }),
    )

    const assignedCode = factories.contracts.contractCode({
      redemption_status: "assigned",
      assigned_to: "pending@example.com",
    })
    const redeemedCode = factories.contracts.contractCode({
      redemption_status: "redeemed",
      assigned_to: "redeemed@example.com",
      redeemed_by: "redeemed@example.com",
      redeemed_on: new Date().toISOString(),
    })

    setMockResponse.get(
      urls.contracts.managerContractCodes(org.id, contract.id, {
        page: 1,
        page_size: 25,
      }),
      factories.contracts.paginatedContractCodes([assignedCode, redeemedCode]),
    )
    setMockResponse.get(
      urls.contracts.managerContractCodes(org.id, contract.id, {
        page: 1,
        page_size: 25,
        status: "assigned",
      }),
      factories.contracts.paginatedContractCodes([assignedCode]),
    )

    renderWithProviders(
      <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
    )

    await screen.findByText("pending@example.com")

    await user.click(screen.getByRole("tab", { name: "Pending claim" }))

    await waitFor(() => {
      expect(screen.queryByText("redeemed@example.com")).not.toBeInTheDocument()
    })
    expect(screen.getByText("pending@example.com")).toBeInTheDocument()
  })

  // Uncapped contracts have no max_learners, so total_codes comes back null or 0.
  // Existing tests only cover numeric caps; these lock in the "unlimited" branch.
  describe("uncapped contract (no seat cap)", () => {
    beforeEach(() => {
      mockedUseFeatureFlagsLoaded.mockReturnValue(true)
      mockedUseFeatureFlagEnabled.mockReturnValue(true)
    })

    const setupUncapped = (
      overrides: Parameters<typeof makeContractDetail>[1] = {},
    ) => {
      const { org, contract } = makeOrgWithContract()
      setMockResponse.get(managerOrgsUrl, {
        count: 1,
        next: null,
        previous: null,
        results: [org],
      })
      setMockResponse.get(
        managerContractDetailUrl(org.id, contract.id),
        // Uncapped: no total_codes and no unassigned_codes cap.
        makeContractDetail(contract, {
          total_codes: null,
          unassigned_codes: null,
          ...overrides,
        }),
      )
      setMockResponse.get(
        urls.contracts.managerContractCodes(org.id, contract.id, {
          page: 1,
          page_size: 25,
        }),
        factories.contracts.paginatedContractCodes([]),
      )
      return { org, contract }
    }

    test.each([{ totalCodes: null }, { totalCodes: 0 }])(
      "shows 'Unlimited seats' subtitle and hides Total purchased / Unassigned stats (total_codes=$totalCodes)",
      async ({ totalCodes }) => {
        const { org, contract } = setupUncapped({
          total_codes: totalCodes,
          assigned_codes: 4,
          redeemed_codes: 3,
        })

        renderWithProviders(
          <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
        )

        // Subtitle only renders once contract detail has loaded.
        await screen.findByText("Unlimited seats")
        expect(screen.queryByText(/\d+ seats/)).not.toBeInTheDocument()

        // Seat-cap stat blocks are meaningless without a cap and are hidden.
        expect(
          screen.queryByRole("group", { name: "Total purchased" }),
        ).not.toBeInTheDocument()
        expect(
          screen.queryByRole("group", { name: "Unassigned" }),
        ).not.toBeInTheDocument()

        // Per-status stats are still shown — they don't depend on the cap.
        expect(
          screen.getByRole("group", { name: "Pending claim" }),
        ).toHaveTextContent("4")
        expect(
          screen.getByRole("group", { name: "Redeemed" }),
        ).toHaveTextContent("3")
      },
    )

    test("AssignSeatsSection is not over-capacity-blocked when there is no seat cap", async () => {
      const { org, contract } = setupUncapped()

      renderWithProviders(
        <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
      )

      await screen.findByText("Unlimited seats")

      const textarea = screen.getByPlaceholderText(/enter employee emails/i)
      await user.type(
        textarea,
        "a@example.com, b@example.com, c@example.com, d@example.com",
      )

      // No cap → the Assign Seats button is enabled and no over-capacity error.
      expect(
        screen.getByRole("button", { name: "Assign Seats" }),
      ).not.toBeDisabled()
      expect(
        screen.queryByText(/unassigned seat.* available/i),
      ).not.toBeInTheDocument()
    })

    test("Export CSV is enabled when there are assigned/redeemed rows despite no seat cap", async () => {
      const { org, contract } = setupUncapped({
        assigned_codes: 3,
        redeemed_codes: 2,
      })

      renderWithProviders(
        <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
      )

      await screen.findByText("Unlimited seats")

      // Export gating uses assigned+redeemed rows, not total_codes (null here).
      expect(
        screen.getByRole("button", { name: "Export CSV" }),
      ).not.toBeDisabled()
    })

    test("Export CSV is disabled when there are no assigned/redeemed rows (uncapped)", async () => {
      const { org, contract } = setupUncapped({
        assigned_codes: 0,
        redeemed_codes: 0,
      })

      renderWithProviders(
        <ContractAdminPage orgSlug={org.slug} contractSlug={contract.slug} />,
      )

      await screen.findByText("Unlimited seats")

      expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled()
    })
  })
})
