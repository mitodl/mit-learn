import React from "react"
import { renderWithProviders, screen, user } from "@/test-utils"
import { waitFor } from "@testing-library/react"
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
    total_codes?: number
    assigned_codes?: number
    unassigned_codes?: number
    redeemed_codes?: number
    total_enrollments?: number
  } = {},
) => ({
  ...contract,
  attachment_percentage: null,
  total_enrollments: overrides.total_enrollments ?? 0,
  total_codes: overrides.total_codes ?? 10,
  assigned_codes: overrides.assigned_codes ?? 2,
  unassigned_codes: overrides.unassigned_codes ?? 6,
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
    setMockResponse.get(managerOrgsUrl, [otherOrg])

    renderWithProviders(
      <ContractAdminPage orgSlug="not-my-org" contractSlug="some-contract" />,
    )

    await screen.findByRole("heading", { name: "Access denied" })
  })

  test("shows 'Contract not found' when org is found but contract slug does not match", async () => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlagEnabled.mockReturnValue(true)

    const { org } = makeOrgWithContract()
    setMockResponse.get(managerOrgsUrl, [org])

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
    setMockResponse.get(managerOrgsUrl, [org])
    setMockResponse.get(
      managerContractDetailUrl(org.id, contract.id),
      makeContractDetail(contract),
    )
    setMockResponse.get(
      urls.contracts.managerContractCodes(org.id, contract.id, {
        page: 1,
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
    setMockResponse.get(managerOrgsUrl, [org])
    setMockResponse.get(
      managerContractDetailUrl(org.id, contract.id),
      makeContractDetail(contract, { total_codes: 75, total_enrollments: 12 }),
    )
    setMockResponse.get(
      urls.contracts.managerContractCodes(org.id, contract.id, {
        page: 1,
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
    setMockResponse.get(managerOrgsUrl, [org])
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
    setMockResponse.get(managerOrgsUrl, [org])
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
      }),
      factories.contracts.paginatedContractCodes([assignedCode, redeemedCode]),
    )
    setMockResponse.get(
      urls.contracts.managerContractCodes(org.id, contract.id, {
        page: 1,
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
      setMockResponse.get(managerOrgsUrl, [org])
      setMockResponse.get(
        managerContractDetailUrl(org.id, contract.id),
        makeContractDetail(contract, overrides),
      )
      setMockResponse.get(
        urls.contracts.managerContractCodes(org.id, contract.id, { page: 1 }),
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
  })

  test("Pending claim tab filters to assigned codes only", async () => {
    mockedUseFeatureFlagsLoaded.mockReturnValue(true)
    mockedUseFeatureFlagEnabled.mockReturnValue(true)

    const { org, contract } = makeOrgWithContract()
    setMockResponse.get(managerOrgsUrl, [org])
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
      }),
      factories.contracts.paginatedContractCodes([assignedCode, redeemedCode]),
    )
    setMockResponse.get(
      urls.contracts.managerContractCodes(org.id, contract.id, {
        page: 1,
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
})
